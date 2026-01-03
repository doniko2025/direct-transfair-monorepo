// apps/backend/src/withdrawals/withdrawals.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, WithdrawalStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';

const TERMINAL_WITHDRAWAL: WithdrawalStatus[] = [
  WithdrawalStatus.PAID,
  WithdrawalStatus.REJECTED,
];

function assertTransition(from: WithdrawalStatus, to: WithdrawalStatus) {
  if (from === to) return;

  if (TERMINAL_WITHDRAWAL.includes(from)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }

  const allowed: Record<WithdrawalStatus, WithdrawalStatus[]> = {
    PENDING: [WithdrawalStatus.APPROVED, WithdrawalStatus.REJECTED],
    APPROVED: [WithdrawalStatus.PAID, WithdrawalStatus.REJECTED],
    PAID: [],
    REJECTED: [],
  };

  if (!allowed[from].includes(to)) {
    throw new BadRequestException(`Transition interdite: ${from} -> ${to}`);
  }
}

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * USER — créer un retrait
   * Règle stricte: retrait autorisé uniquement si transaction PAID
   * Anti double-retrait: unique constraint + gestion P2002 (atomique)
   */
  async create(clientId: number, userId: string, dto: CreateWithdrawalDto) {
    const transactionId = String(dto.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('transactionId manquant');

    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, clientId },
      select: {
        id: true,
        senderId: true,
        status: true,
        payoutMethod: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction introuvable');
    if (tx.senderId !== userId) {
      throw new ForbiddenException('Transaction non appartenant à l’utilisateur');
    }
    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        `Retrait interdit: transaction status=${tx.status} (attendu: PAID)`,
      );
    }

    try {
      return await this.prisma.withdrawal.create({
        data: {
          clientId,
          transactionId: tx.id,
          method: dto.method ?? tx.payoutMethod,
          status: WithdrawalStatus.PENDING,
        },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          processedAt: true,
          processedById: true,
          transactionId: true,
          method: true,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // unique constraint (transactionId)
        throw new ConflictException('Un retrait existe déjà pour cette transaction');
      }
      throw e;
    }
  }

  /**
   * USER — mes retraits
   */
  async listMine(clientId: number, userId: string) {
    return this.prisma.withdrawal.findMany({
      where: {
        clientId,
        transaction: { senderId: userId },
      },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        processedAt: true,
        processedById: true,
        transactionId: true,
        method: true,
        transaction: {
          select: {
            id: true,
            total: true,
            status: true,
            payoutMethod: true,
          },
        },
      },
    });
  }

  /**
   * ADMIN — tous les retraits
   */
  async adminListAll(clientId: number) {
    return this.prisma.withdrawal.findMany({
      where: { clientId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        processedAt: true,
        processedById: true,
        transactionId: true,
        method: true,
        processedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        transaction: {
          select: {
            id: true,
            total: true,
            status: true,
            sender: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * ADMIN — mise à jour statut retrait (transition stricte)
   * + sécurité: impossible de PAID un retrait si la transaction n’est plus PAID
   */
  async adminUpdateStatus(
    clientId: number,
    adminId: string,
    withdrawalId: string,
    dto: UpdateWithdrawalStatusDto,
  ) {
    const w = await this.prisma.withdrawal.findFirst({
      where: { id: withdrawalId, clientId },
      select: {
        id: true,
        status: true,
        transaction: { select: { status: true } },
      },
    });

    if (!w) throw new NotFoundException('Retrait introuvable');

    const from = w.status;
    const to = dto.status;

    assertTransition(from, to);

    if (to === WithdrawalStatus.PAID && w.transaction.status !== TransactionStatus.PAID) {
      throw new BadRequestException('Paiement retrait interdit: la transaction n’est plus PAID');
    }

    const now = new Date();
    const shouldStamp =
      to === WithdrawalStatus.APPROVED ||
      to === WithdrawalStatus.PAID ||
      to === WithdrawalStatus.REJECTED;

    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: to,
        processedById: shouldStamp ? adminId : null,
        processedAt: shouldStamp ? now : null,
      },
      select: {
        id: true,
        status: true,
        processedAt: true,
        processedById: true,
      },
    });
  }
}
