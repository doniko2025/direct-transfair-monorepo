//apps/backend/src/payments/payment-methods.service.ts
// v1.1 (phase 6, passe 3) :
//   - addCard : 10 cartes au plus par compte ; une seule carte par défaut (avant, on pouvait en avoir plusieurs) ;
//     la première carte devient la carte par défaut.
//   - linkMobileWallet : lier un nouveau numéro REMPLACE l'ancien du même opérateur (avant, les deux restaient et
//     l'écran affichait l'un ou l'autre au hasard).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardBrand, PaymentMethod } from '@prisma/client';
import { AddCardDto } from './dto/add-card.dto';
import { LinkMobileWalletDto } from './dto/link-mobile-wallet.dto';

export const MAX_CARDS_PER_USER = 10;

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

    const last4 = dto.cardNumber.slice(-4);
    const select = { id: true, last4: true, expiry: true, brand: true, isDefault: true } as const;

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.userCard.count({ where: { userId } });
      if (count >= MAX_CARDS_PER_USER) {
        throw new BadRequestException(`Vous ne pouvez pas enregistrer plus de ${MAX_CARDS_PER_USER} cartes.`);
      }
      // La première carte est la carte par défaut ; sinon une seule peut l'être.
      const makeDefault = count === 0 || dto.isDefault === true;
      if (makeDefault) {
        await tx.userCard.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.userCard.create({
        data: { userId, last4, expiry: dto.expiry, brand, isDefault: makeDefault },
        select,
      });
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
    // Un seul numéro par opérateur : les autres sont retirés dans la même transaction.
    const number = dto.number.trim();
    return this.prisma.$transaction(async (tx) => {
      await tx.userMobileWallet.deleteMany({
        where: { userId, provider: dto.provider, number: { not: number } },
      });
      return tx.userMobileWallet.upsert({
        where: { userId_provider_number: { userId, provider: dto.provider, number } },
        create: { userId, provider: dto.provider, number },
        update: { number },
        select: { id: true, provider: true, number: true },
      });
    });
  }
}
