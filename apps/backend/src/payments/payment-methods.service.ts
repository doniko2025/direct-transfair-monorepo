//apps/backend/src/payments/payment-methods.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardBrand, PaymentMethod } from '@prisma/client';
import { AddCardDto } from './dto/add-card.dto';
import { LinkMobileWalletDto } from './dto/link-mobile-wallet.dto';

const SUPPORTED_WALLETS: PaymentMethod[] = [
  PaymentMethod.ORANGE_MONEY,
  PaymentMethod.SENDWAVE,
];

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMethods(userId: string) {
    const [cards, linked] = await Promise.all([
      this.prisma.userCard.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, last4: true, expiry: true, brand: true, isDefault: true },
      }),
      this.prisma.userMobileWallet.findMany({
        where: { userId },
        select: { id: true, provider: true, number: true },
      }),
    ]);

    const mobileWallets = SUPPORTED_WALLETS.map((provider) => {
      const record = linked.find((w) => w.provider === provider);
      return {
        provider,
        number:   record?.number ?? null,
        isLinked: !!record,
        recordId: record?.id ?? null,
      };
    });

    return { cards, mobileWallets };
  }

  async addCard(userId: string, dto: AddCardDto) {
    // ✅ FIX : convertir string → enum CardBrand
    const brandInput = (dto.brand?.toUpperCase() ?? 'VISA') as string;
    const brand: CardBrand = Object.values(CardBrand).includes(brandInput as CardBrand)
      ? (brandInput as CardBrand)
      : CardBrand.VISA;

    return this.prisma.userCard.create({
      data: {
        userId,
        last4:     dto.cardNumber.slice(-4),
        expiry:    dto.expiry,
        brand,
        isDefault: dto.isDefault ?? false,
      },
      select: { id: true, last4: true, expiry: true, brand: true, isDefault: true },
    });
  }

  async removeCard(userId: string, cardId: string) {
    const exists = await this.prisma.userCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!exists) throw new NotFoundException('Carte introuvable');
    await this.prisma.userCard.delete({ where: { id: cardId } });
    return { deleted: true };
  }

  async linkMobileWallet(userId: string, dto: LinkMobileWalletDto) {
    if (!SUPPORTED_WALLETS.includes(dto.provider)) {
      throw new BadRequestException('Provider non supporté');
    }

    // Pas de numéro = délier
    if (!dto.number) {
      await this.prisma.userMobileWallet.deleteMany({
        where: { userId, provider: dto.provider },
      });
      return { unlinked: true };
    }

    // ✅ FIX : unique sur userId + provider + number (migration v4.1)
    return this.prisma.userMobileWallet.upsert({
      where: {
        userId_provider_number: {
          userId,
          provider: dto.provider,
          number:   dto.number,
        },
      },
      create: { userId, provider: dto.provider, number: dto.number },
      update: { number: dto.number },
      select: { id: true, provider: true, number: true },
    });
  }
}