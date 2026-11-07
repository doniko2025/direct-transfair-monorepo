// apps/backend/src/profile-photo/profile-photo.service.ts
// =========================================================
// PHOTO DE PROFIL v1.0 — le client choisit sa photo (appareil photo ou galerie) ; elle remplace les initiales de son avatar.
//   PUT    /profile-photo   envoi (JSON { image: base64 }) — remplace l'éventuelle photo précédente
//   GET    /profile-photo   octets de SA photo (ETag : l'application ne retélécharge que si elle a changé) ; 404 si aucune
//   DELETE /profile-photo   supprime la photo (retour aux initiales)
// Règles : image seulement (JPEG, PNG, WebP — type RÉEL lu dans les premiers octets, pas celui déclaré), 2 Mo au plus, 
// lisible seulement par son propriétaire (jamais par un autre client). Stockée à part (table user_photos), pas dans la fiche utilisateur.
// =========================================================

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { decodeUpload, KycFileError } from '../kyc/kyc-rules';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 Mo
const MIN_PHOTO_BYTES = 2 * 1024; // en dessous : image vide ou corrompue

@Injectable()
export class ProfilePhotoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre (ou remplace) la photo. Renvoie l'empreinte (utile comme version côté application). */
  async save(userId: string, image: unknown): Promise<{ version: string; sizeBytes: number; mimeType: string }> {
    let file;
    try {
      file = decodeUpload(image, 'La photo');
    } catch (err) {
      if (err instanceof KycFileError) throw new BadRequestException(err.message);
      throw err;
    }
    if (file.mimeType === 'application/pdf') throw new BadRequestException('La photo de profil doit être une image (JPEG, PNG ou WebP).');
    if (file.sizeBytes > MAX_PHOTO_BYTES) throw new BadRequestException('Photo trop lourde (2 Mo au plus). Choisissez une photo plus petite.');
    if (file.sizeBytes < MIN_PHOTO_BYTES) throw new BadRequestException('Photo vide ou illisible. Réessayez.');

    await this.prisma.userPhoto.upsert({
      where: { userId },
      create: { userId, mimeType: file.mimeType, sizeBytes: file.sizeBytes, sha256: file.sha256, data: file.buffer },
      update: { mimeType: file.mimeType, sizeBytes: file.sizeBytes, sha256: file.sha256, data: file.buffer },
    });
    return { version: file.sha256, sizeBytes: file.sizeBytes, mimeType: file.mimeType };
  }

  /** Octets de la photo du client ; 404 s'il n'en a pas. */
  async read(userId: string): Promise<{ buffer: Buffer; mimeType: string; sha256: string }> {
    const row = await this.prisma.userPhoto.findUnique({ where: { userId }, select: { data: true, mimeType: true, sha256: true } });
    if (!row) throw new NotFoundException('Aucune photo de profil.');
    return { buffer: Buffer.from(row.data), mimeType: row.mimeType, sha256: row.sha256 };
  }

  /** Empreinte seule (pour répondre 304 sans relire les octets) ; null s'il n'y a pas de photo. */
  async version(userId: string): Promise<string | null> {
    const row = await this.prisma.userPhoto.findUnique({ where: { userId }, select: { sha256: true } });
    return row?.sha256 ?? null;
  }

  async remove(userId: string): Promise<{ removed: boolean }> {
    const res = await this.prisma.userPhoto.deleteMany({ where: { userId } });
    return { removed: res.count > 0 };
  }
}
