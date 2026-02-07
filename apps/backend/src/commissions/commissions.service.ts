//apps/backend/src/commissions/commissions.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { CommissionSourceType, CommissionDestType, TransactionStatus, AgencyType } from '@prisma/client';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where: { clientId },
      orderBy: [{ sourceType: 'asc' }, { destType: 'asc' }],
    });
  }

  async upsertRule(clientId: number, dto: UpdateCommissionDto) {
    const platformShare = 100 - (dto.senderShare + dto.payerShare);
    if (platformShare < 0) throw new BadRequestException("Total > 100%");
    
    return this.prisma.commissionConfig.upsert({
      where: { clientId_sourceType_destType: { clientId, sourceType: dto.sourceType, destType: dto.destType } },
      update: { senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
      create: { clientId, sourceType: dto.sourceType, destType: dto.destType, senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
    });
  }

  // ✅ CORRECTION TYPE : On force le type des variables pour éviter l'erreur TS
  async getHistory(clientId: number, period: string) {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
        case 'TODAY': startDate.setHours(0, 0, 0, 0); break;
        case 'WEEK': startDate.setDate(now.getDate() - 7); break;
        case 'MONTH': startDate.setMonth(now.getMonth() - 1); break;
        case 'QUARTER': startDate.setMonth(now.getMonth() - 3); break;
        case 'YEAR': startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate = new Date(0); break;
    }

    const transactions = await this.prisma.transaction.findMany({
        where: {
            clientId,
            status: { in: [TransactionStatus.VALIDATED, TransactionStatus.PAID] },
            createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        include: {
            sender: { include: { agency: true } },
            withdrawal: { include: { processedBy: { include: { agency: true } } } }
        }
    });

    const rules = await this.prisma.commissionConfig.findMany({ where: { clientId } });

    const history = transactions.map(tx => {
        // ✅ CORRECTION 1 : Déclaration explicite du type
        let sourceT: CommissionSourceType = CommissionSourceType.WALLET;
        
        if (tx.sender?.agency) {
            // On force la comparaison avec l'enum AgencyType
            if (tx.sender.agency.type === AgencyType.PARTNER) {
                sourceT = CommissionSourceType.PARTNER;
            } else {
                sourceT = CommissionSourceType.SUBSIDIARY;
            }
        }

        // ✅ CORRECTION 2 : Pareil pour la destination
        let destT: CommissionDestType = CommissionDestType.SUBSIDIARY; 
        let payerAgencyName = "En attente";
        
        if (tx.withdrawal?.processedBy?.agency) {
            payerAgencyName = tx.withdrawal.processedBy.agency.name;
            if (tx.withdrawal.processedBy.agency.type === AgencyType.PARTNER) {
                destT = CommissionDestType.PARTNER;
            } else {
                destT = CommissionDestType.SUBSIDIARY;
            }
        }

        const rule = rules.find(r => r.sourceType === sourceT && r.destType === destT);
        
        const fees = Number(tx.fees);
        const senderCom = rule ? (fees * rule.senderShare / 100) : 0;
        const payerCom = (rule && tx.status === 'PAID') ? (fees * rule.payerShare / 100) : 0;
        const platformCom = fees - senderCom - payerCom;

        return {
            id: tx.id,
            reference: tx.reference,
            date: tx.createdAt,
            amount: Number(tx.amount),
            fees: fees,
            type: tx.payoutMethod,
            status: tx.status,
            breakdown: {
                sender: { 
                    name: tx.sender?.agency?.name || "Client Wallet", 
                    amount: senderCom 
                },
                payer: { 
                    name: payerAgencyName, 
                    amount: payerCom 
                },
                platform: { 
                    amount: platformCom 
                }
            }
        };
    });

    return history;
  }
}