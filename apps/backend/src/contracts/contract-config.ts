// apps/backend/src/contracts/contract-config.ts
// =========================================================
// CONTRATS — identité de l'émetteur (le Prestataire) et réglages, pilotables par variables d'environnement.
// Lues À CHAQUE APPEL (getters), comme platform.config.ts : le .env est chargé après l'import des modules.
//
//   CONTRACT_ISSUER_NAME            nom / raison sociale du Prestataire (défaut : PLATFORM_LEGAL_NAME, puis nom de la plateforme)
//   CONTRACT_ISSUER_LEGAL_FORM      forme juridique, ex. « SAS », « Entreprise individuelle » (omis si absent)
//   CONTRACT_ISSUER_REGISTRATION    immatriculation, ex. « SIRET 123 456 789 00012 » (omise si absente)
//   CONTRACT_ISSUER_ADDRESS         adresse du siège (omise si absente)
//   CONTRACT_ISSUER_REPRESENTATIVE  représentant légal (défaut : Thierno Doniko)
//   CONTRACT_ISSUER_TITLE           qualité du représentant (défaut : Grand Chef)
//   CONTRACT_ISSUER_EMAIL           e-mail du Prestataire (défaut : PLATFORM_SUPPORT_EMAIL)
//   CONTRACT_COPY_EMAIL             reçoit une copie de chaque contrat signé (défaut : CONTRACT_ISSUER_EMAIL)
//   CONTRACT_JURISDICTION_CITY      ville des tribunaux compétents (défaut : Paris)
//   CONTRACT_SIGN_LINK_DAYS         validité du lien de signature en jours (défaut : 30)
// =========================================================

import { platform } from '../common/platform.config';

const env = (key: string): string | undefined => {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
};

export const contractConfig = {
  get issuerName(): string {
    return env('CONTRACT_ISSUER_NAME') ?? platform.legalName;
  },
  get issuerLegalForm(): string | null {
    return env('CONTRACT_ISSUER_LEGAL_FORM') ?? null;
  },
  get issuerRegistration(): string | null {
    return env('CONTRACT_ISSUER_REGISTRATION') ?? null;
  },
  get issuerAddress(): string | null {
    return env('CONTRACT_ISSUER_ADDRESS') ?? null;
  },
  get issuerRepresentative(): string {
    return env('CONTRACT_ISSUER_REPRESENTATIVE') ?? 'Thierno Doniko';
  },
  get issuerTitle(): string {
    return env('CONTRACT_ISSUER_TITLE') ?? 'Grand Chef';
  },
  get issuerEmail(): string | null {
    return env('CONTRACT_ISSUER_EMAIL') ?? platform.supportEmail;
  },
  get copyEmail(): string | null {
    return env('CONTRACT_COPY_EMAIL') ?? this.issuerEmail;
  },
  get jurisdictionCity(): string {
    return env('CONTRACT_JURISDICTION_CITY') ?? 'Paris';
  },
  get signLinkDays(): number {
    const n = Number(env('CONTRACT_SIGN_LINK_DAYS'));
    return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
  },
};

/** Version du modèle de contrat : à incrémenter à chaque évolution du texte (les contrats déjà émis ne changent jamais). */
export const CONTRACT_TEMPLATE_VERSION = '1.0';
