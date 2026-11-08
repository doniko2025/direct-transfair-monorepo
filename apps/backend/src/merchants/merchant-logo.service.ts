// apps/backend/src/merchants/merchant-logo.service.ts
// =========================================================
// LOGO DU COMMERCE (lot 13) — le marchand choisit un logo (galerie ou appareil photo) ; il est montré au client qui paie et sur le QR de caisse.
//   PUT    /merchants/me/logo        envoi (JSON { image: base64 }) — remplace l'éventuel logo précédent (propriétaire seulement)
//   GET    /merchants/me/logo        octets de MON logo ; 404 si aucun
//   GET    /merchants/:shopId/logo   logo d'un commerce de MA société (le client qui paie, le caissier) ; 404 si aucun
//   DELETE /merchants/me/logo        retire le logo
// Règles : image seulement (JPEG, PNG, WebP — type RÉEL lu dans les premiers octets), 1 Mo au plus. Stocké à part (table merchant_logos).
// =========================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { decodeUpload, KycFileError } from '../kyc/kyc-rules';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantsService } from './merchants.service';

export const MAX_LOGO_BYTES = 1024 * 1024; // 1 Mo
const MIN_LOGO_BYTES = 1024;

@Injectable()
export class MerchantLogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
  ) {}

  async save(userId: string, image: unknown): Promise<{ version: string; sizeBytes: number; mimeType: string }> {
    const { profile } = await this.merchants.assertActiveMerchant(userId);
    let file;
    try {
      file = decodeUpload(image, 'Le logo');
    } catch (err) {
      if (err instanceof KycFileError) throw new BadRequestException(err.message);
      throw err;
    }
    if (file.mimeType === 'application/pdf') throw new BadRequestException('Le logo doit être une image (JPEG, PNG ou WebP).');
    if (file.sizeBytes > MAX_LOGO_BYTES) throw new BadRequestException('Logo trop lourd (1 Mo au plus). Choisissez une image plus petite.');
    if (file.sizeBytes < MIN_LOGO_BYTES) throw new BadRequestException('Logo vide ou illisible. Réessayez.');
    await this.prisma.merchantLogo.upsert({
      where: { merchantId: profile.id },
      create: { merchantId: profile.id, mimeType: file.mimeType, sizeBytes: file.sizeBytes, sha256: file.sha256, data: file.buffer },
      update: { mimeType: file.mimeType, sizeBytes: file.sizeBytes, sha256: file.sha256, data: file.buffer },
    });
    return { version: file.sha256, sizeBytes: file.sizeBytes, mimeType: file.mimeType };
  }

  async remove(userId: string): Promise<{ removed: boolean }> {
    const { profile } = await this.merchants.assertActiveMerchant(userId);
    const res = await this.prisma.merchantLogo.deleteMany({ where: { merchantId: profile.id } });
    return { removed: res.count > 0 };
  }

  /** Id du commerce de l'utilisateur (propriétaire), sans exiger qu'il soit actif : il doit toujours pouvoir voir son propre logo. */
  async shopIdOf(userId: string): Promise<string> {
    const p = await this.prisma.merchantProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!p) throw new NotFoundException('Aucun logo.');
    return p.id;
  }

  /** Empreinte seule (réponse 304 sans relire les octets). Le commerce doit appartenir à la société du demandeur. */
  async version(shopId: string, viewerClientId: number | undefined): Promise<string | null> {
    const row = await this.prisma.merchantLogo.findFirst({ where: { merchantId: shopId, merchant: { clientId: viewerClientId ?? -1 } }, select: { sha256: true } });
    return row?.sha256 ?? null;
  }

  async read(shopId: string, viewerClientId: number | undefined): Promise<{ buffer: Buffer; mimeType: string; sha256: string }> {
    const row = await this.prisma.merchantLogo.findFirst({
      where: { merchantId: shopId, merchant: { clientId: viewerClientId ?? -1 } },
      select: { data: true, mimeType: true, sha256: true },
    });
    if (!row) throw new NotFoundException('Aucun logo.');
    return { buffer: Buffer.from(row.data), mimeType: row.mimeType, sha256: row.sha256 };
  }
}
