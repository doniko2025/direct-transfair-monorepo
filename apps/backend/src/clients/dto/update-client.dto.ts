// apps/backend/src/clients/dto/update-client.dto.ts
// =========================================================
// UPDATE CLIENT DTO — corps de PATCH /clients/:id (SUPER_ADMIN).
// Avant : `@Body() data: any` copié tel quel dans prisma.client.update → n'importe quel champ du modèle (isActive, tenantId,
// deletedAt, subscriptionStatus, limites de transfert…) pouvait être écrit, sans aucune validation. Désormais :
//   - liste blanche de champs (le ValidationPipe retire tout le reste) ;
//   - mêmes règles que la création (CreateClientDto) ;
//   - un champ facultatif peut être vidé avec `null` (le web envoie null, jamais "" : subdomain et customDomain sont uniques).
// Le statut d'abonnement a sa propre route (PATCH /clients/:id/status) ; le code société, lui, ne change jamais.
// =========================================================

import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { SubscriptionStatus, SubscriptionType } from '@prisma/client';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Chaîne vide venue d'un formulaire = champ vidé. */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class UpdateClientDto {
  // ═══ IDENTITÉ ═══════════════════════════════════════════
  @ValidateIf((o: UpdateClientDto) => o.name !== undefined)
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120)
  name?: string;

  // ═══ BRANDING ═══════════════════════════════════════════
  /** Adresse https ou image intégrée : la taille et le format sont contrôlés par normalizeLogoUrl. */
  @IsOptional() @IsString() @MaxLength(100_000)
  logoUrl?: string | null;

  @IsOptional() @Transform(emptyToNull) @Matches(HEX, { message: 'primaryColor doit être une couleur hex valide ex: #059669' })
  primaryColor?: string | null;

  @IsOptional() @Transform(emptyToNull) @Matches(HEX, { message: 'secondaryColor doit être une couleur hex valide ex: #10B981' })
  secondaryColor?: string | null;

  @IsOptional() @Transform(emptyToNull) @Matches(HEX, { message: 'splashBgColor doit être une couleur hex valide' })
  splashBgColor?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160)
  tagline?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(80)
  fontFamily?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  welcomeMessage?: string | null;

  // ═══ PORTAIL WEB ════════════════════════════════════════
  @IsOptional() @Transform(emptyToNull)
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/, { message: 'subdomain: minuscules/chiffres/tirets, 3–32 caractères, sans tiret en début ou fin.' })
  subdomain?: string | null;

  @IsOptional() @Transform(emptyToNull)
  @Matches(/^(www\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/, { message: 'customDomain invalide. Ex: "www.flash-transfer.com"' })
  customDomain?: string | null;

  // ═══ COORDONNÉES ════════════════════════════════════════
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  country?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(80)
  city?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(250)
  address?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsEmail()
  email?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300)
  website?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120)
  activitySector?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(30)
  contactPhone?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsEmail()
  contactEmail?: string | null;

  // ═══ MENTIONS LÉGALES (mêmes bornes que CreateClientDto) ═
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160)
  legalCompanyName?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(200)
  regulatorName?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(20)
  regulatorAcronym?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40)
  regulatoryFrameworkLabel?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120)
  regulatorLicenseType?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  regulatorLicenseNumber?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(80)
  capitalSocial?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsEmail()
  supportEmail?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(30)
  whatsappNumber?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160)
  mediatorName?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300)
  mediatorUrl?: string | null;

  // ═══ ABONNEMENT ═════════════════════════════════════════
  /** Le statut (actif / suspendu…) se change par PATCH /clients/:id/status. */
  @IsOptional() @IsEnum(SubscriptionType)
  subscriptionType?: SubscriptionType;

  // ═══ PROPRIÉTAIRE LÉGAL ═════════════════════════════════
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(80)
  ownerFirstName?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(80)
  ownerLastName?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  ownerCountry?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40)
  ownerBirthDate?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120)
  ownerBirthPlace?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300)
  ownerAddress?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(160)
  representativeName?: string | null;
}

/** Corps de PATCH /clients/:id/status. */
export class UpdateClientStatusDto {
  @IsEnum(SubscriptionStatus, { message: 'Statut invalide.' })
  status!: SubscriptionStatus;
}
