// src/pages/companies/companyFields.ts
// Champs éditables de la fiche société, regroupés par carte.
// Volontairement absents : `country` et `ownerCountry` (le backend en recalcule la devise
// par défaut de la société à chaque mise à jour — à ne pas toucher sans le vouloir),
// le code société (identifiant de portail) et les champs du propriétaire légal.

import { DOMAIN, EMAIL, HEX_COLOR, SUBDOMAIN, TYPE_LABEL } from '../../lib/companyRules';
import type { FieldDef } from './EditableSection';

const emailRule = (v: string) => (EMAIL.test(v) ? null : 'Adresse email invalide.');
const urlRule = (v: string) => (/^https?:\/\/\S+\.\S+$/i.test(v) ? null : 'Adresse web invalide (https://…).');

export const IDENTITY_FIELDS: readonly FieldDef[] = [
  { key: 'name', label: 'Nom de la société', required: true, maxLength: 120 },
  { key: 'activitySector', label: "Secteur d'activité", maxLength: 120 },
  {
    key: 'subscriptionType',
    label: "Type d'abonnement",
    kind: 'select',
    required: true,
    options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
  },
  { key: 'contactEmail', label: 'Email de contact', kind: 'email', validate: emailRule },
  { key: 'contactPhone', label: 'Téléphone de contact', kind: 'tel', maxLength: 30 },
  { key: 'city', label: 'Ville', maxLength: 80 },
  { key: 'website', label: 'Site web', kind: 'url', validate: urlRule, placeholder: 'https://' },
  { key: 'address', label: 'Adresse', wide: true, maxLength: 200 },
];

export const PORTAL_FIELDS: readonly FieldDef[] = [
  {
    key: 'subdomain',
    label: 'Sous-domaine',
    lowercase: true,
    maxLength: 32,
    hint: 'Minuscules, chiffres et tirets, 3 à 32 caractères.',
    validate: (v) =>
      SUBDOMAIN.test(v) ? null : 'Sous-domaine invalide : minuscules, chiffres, tirets (3 à 32 caractères).',
  },
  {
    key: 'customDomain',
    label: 'Domaine personnalisé',
    lowercase: true,
    maxLength: 120,
    placeholder: 'admin.ma-societe.com',
    hint: 'Sans « https:// ». Laisser vide pour retirer le domaine.',
    validate: (v) => (DOMAIN.test(v) ? null : 'Domaine invalide. Exemple : admin.ma-societe.com'),
  },
];

export const APPEARANCE_FIELDS: readonly FieldDef[] = [
  {
    key: 'primaryColor',
    label: 'Couleur principale',
    kind: 'color',
    required: true,
    fallback: '#059669',
    validate: (v) => (HEX_COLOR.test(v) ? null : 'Code couleur invalide, exemple : #059669.'),
  },
  {
    key: 'secondaryColor',
    label: 'Couleur d’accent',
    kind: 'color',
    required: true,
    fallback: '#10B981',
    validate: (v) => (HEX_COLOR.test(v) ? null : 'Code couleur invalide, exemple : #10B981.'),
  },
  { key: 'tagline', label: 'Slogan', maxLength: 140, wide: true },
  { key: 'welcomeMessage', label: "Message d'accueil", kind: 'textarea', maxLength: 400 },
  { key: 'logoUrl', label: 'Adresse du logo', kind: 'url', validate: urlRule, placeholder: 'https://', wide: true },
  { key: 'fontFamily', label: 'Police', maxLength: 60, hint: 'Nom d’une police Google Fonts, exemple : Poppins.' },
];

export const LEGAL_FIELDS: readonly FieldDef[] = [
  { key: 'legalCompanyName', label: 'Raison sociale', maxLength: 160, wide: true },
  { key: 'regulatorName', label: 'Autorité de contrôle', maxLength: 200, wide: true },
  { key: 'regulatorAcronym', label: 'Sigle de l’autorité', maxLength: 20 },
  { key: 'regulatoryFrameworkLabel', label: 'Cadre réglementaire', maxLength: 40, hint: 'Ex. DSP2. Vide : le badge est masqué.' },
  { key: 'regulatorLicenseType', label: "Type d'agrément", maxLength: 120 },
  { key: 'regulatorLicenseNumber', label: "Numéro d'agrément", maxLength: 60 },
  { key: 'capitalSocial', label: 'Capital social', maxLength: 80 },
  { key: 'supportEmail', label: 'Email d’assistance', kind: 'email', validate: emailRule },
  { key: 'whatsappNumber', label: 'WhatsApp', kind: 'tel', maxLength: 30 },
  { key: 'mediatorName', label: 'Médiateur', maxLength: 160 },
  { key: 'mediatorUrl', label: 'Site du médiateur', kind: 'url', validate: urlRule, placeholder: 'https://' },
];
