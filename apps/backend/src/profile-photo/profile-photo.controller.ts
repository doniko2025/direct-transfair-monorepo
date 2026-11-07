// apps/backend/src/profile-photo/profile-photo.controller.ts
// Photo de profil du client connecté. Réponses « private, no-cache » + ETag : jamais gardées par un cache partagé, mais
// l'application évite de retélécharger une photo inchangée (If-None-Match → 304).
import { Body, Controller, Delete, ForbiddenException, Get, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { IsString, MinLength } from 'class-validator';
import { ProfilePhotoService } from './profile-photo.service';

type Authed = Request & { user?: AuthUserPayload };

function meId(req: Authed): string {
  if (!req.user?.id) throw new ForbiddenException('Non authentifié');
  return req.user.id;
}

export class SavePhotoDto {
  /** Image en base64, avec ou sans préfixe « data:image/...;base64, ». */
  @IsString()
  @MinLength(100, { message: 'Photo manquante.' })
  image: string;
}

@ApiTags('Profile photo')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('profile-photo')
export class ProfilePhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Put()
  save(@Req() req: Authed, @Body() dto: SavePhotoDto) {
    return this.photos.save(meId(req), dto.image);
  }

  @Get()
  async get(@Req() req: Authed, @Res() res: Response) {
    const userId = meId(req);
    const version = await this.photos.version(userId);
    const etag = version ? `"${version}"` : null;
    if (etag && req.headers['if-none-match'] === etag) {
      res.status(304).setHeader('ETag', etag).setHeader('Cache-Control', 'private, no-cache').end();
      return;
    }
    const f = await this.photos.read(userId); // 404 si aucune photo
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Length', String(f.buffer.length));
    res.setHeader('ETag', `"${f.sha256}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(f.buffer);
  }

  @Delete()
  remove(@Req() req: Authed) {
    return this.photos.remove(meId(req));
  }
}
