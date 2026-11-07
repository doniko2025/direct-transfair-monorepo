// apps/backend/src/support/support-permissions.ts
// =========================================================
// Lot 9 — Catalogue des délégations du service client (rôle SUPPORT).
//
// L'administrateur de la société active ou coupe chaque délégation par un interrupteur. Une délégation coupée = la route est
// refusée côté serveur (403) ET le bouton disparaît côté web. Le catalogue est la source unique : l'écran admin le lit via
// GET /support-staff/catalog, il n'est donc jamais recopié en dur côté web.
//
// Implications : certaines délégations n'ont aucun sens seules (valider une pièce sans pouvoir ouvrir la fiche client).
// `expandPermissions` ajoute les délégations impliquées ; l'écran admin les affiche « activées d'office » et verrouillées.
// =========================================================

export const SUPPORT_PERMISSIONS = [
  'CLIENTS_VIEW',
  'KYC_REVIEW',
  'KYC_COUNTER',
  'ACCOUNT_SUSPEND',
  'ACCOUNT_REACTIVATE',
  'TICKETS_HANDLE',
  'DISPUTES_RESOLVE',
  'REFUNDS_DECIDE',
  'TRANSACTIONS_VIEW',
] as const;

export type SupportPermission = (typeof SUPPORT_PERMISSIONS)[number];

export interface SupportPermissionMeta {
  key: SupportPermission;
  group: 'COMPTES' | 'CONFORMITE' | 'ASSISTANCE' | 'ARGENT';
  label: string;
  description: string;
  /** Délégations activées d'office quand celle-ci l'est. */
  implies: SupportPermission[];
  /** Délégation sensible (mouvement d'argent ou gel de compte) : mise en avant dans l'écran admin. */
  sensitive: boolean;
}

export const SUPPORT_PERMISSION_META: SupportPermissionMeta[] = [
  {
    key: 'CLIENTS_VIEW',
    group: 'COMPTES',
    label: 'Consulter les comptes clients',
    description: 'Voir la liste et la fiche des clients de la société (lecture seule).',
    implies: [],
    sensitive: false,
  },
  {
    key: 'ACCOUNT_SUSPEND',
    group: 'COMPTES',
    label: 'Suspendre un compte',
    description: 'Geler un compte client (connexion et opérations bloquées).',
    implies: ['CLIENTS_VIEW'],
    sensitive: true,
  },
  {
    key: 'ACCOUNT_REACTIVATE',
    group: 'COMPTES',
    label: 'Réactiver un compte',
    description: 'Lever la suspension d\'un compte client.',
    implies: ['CLIENTS_VIEW'],
    sensitive: true,
  },
  {
    key: 'KYC_REVIEW',
    group: 'CONFORMITE',
    label: 'Valider les pièces d\'identité',
    description: 'Consulter les pièces des clients wallet, les valider, les refuser, les révoquer et relancer le client.',
    implies: ['CLIENTS_VIEW'],
    sensitive: true,
  },
  {
    key: 'KYC_COUNTER',
    group: 'CONFORMITE',
    label: 'Pièces des clients de passage',
    description: 'Consulter les pièces photographiées par les agents lors des envois au comptoir.',
    implies: [],
    sensitive: true,
  },
  {
    key: 'TICKETS_HANDLE',
    group: 'ASSISTANCE',
    label: 'Traiter les demandes',
    description: 'Lire les demandes d\'assistance, y répondre et les clôturer.',
    implies: [],
    sensitive: false,
  },
  {
    key: 'TRANSACTIONS_VIEW',
    group: 'ARGENT',
    label: 'Consulter les opérations',
    description: 'Rechercher une opération et voir son statut (lecture seule, sans données sensibles).',
    implies: [],
    sensitive: false,
  },
  {
    key: 'DISPUTES_RESOLVE',
    group: 'ASSISTANCE',
    label: 'Régler les litiges',
    description: 'Rendre une décision sur un litige lié à une opération (accepté, rejeté, information).',
    implies: ['TICKETS_HANDLE', 'TRANSACTIONS_VIEW'],
    sensitive: true,
  },
  {
    key: 'REFUNDS_DECIDE',
    group: 'ARGENT',
    label: 'Décider des remboursements',
    description: 'Approuver ou refuser les remboursements en attente. Un support ne peut jamais valider une demande qu\'il a créée.',
    implies: ['TRANSACTIONS_VIEW'],
    sensitive: true,
  },
];

const KNOWN = new Set<string>(SUPPORT_PERMISSIONS);
const META = new Map(SUPPORT_PERMISSION_META.map((m) => [m.key, m]));

export function isSupportPermission(v: unknown): v is SupportPermission {
  return typeof v === 'string' && KNOWN.has(v);
}

/** Garde les seules clés connues, sans doublon, dans l'ordre du catalogue (entrée libre venant d'un formulaire). */
export function sanitizePermissions(input: unknown): SupportPermission[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter(isSupportPermission));
  return SUPPORT_PERMISSIONS.filter((p) => wanted.has(p));
}

/** Ajoute les délégations impliquées (fermeture transitive). */
export function expandPermissions(input: unknown): SupportPermission[] {
  const out = new Set<SupportPermission>(sanitizePermissions(input));
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of Array.from(out)) {
      for (const dep of META.get(p)?.implies ?? []) {
        if (!out.has(dep)) {
          out.add(dep);
          grew = true;
        }
      }
    }
  }
  return SUPPORT_PERMISSIONS.filter((p) => out.has(p));
}

/** Rôles qui ont d'office toutes les délégations (ils les accordent). */
const FULL_ACCESS_ROLES = new Set(['SUPER_ADMIN', 'COMPANY_ADMIN']);

export interface PermissionSubject {
  role?: string | null;
  permissions?: readonly string[] | null;
}

/** true si l'utilisateur peut exercer la délégation : admin → toujours ; SUPPORT → seulement si l'interrupteur est actif. */
export function hasPermission(user: PermissionSubject | null | undefined, perm: SupportPermission): boolean {
  if (!user) return false;
  const role = String(user.role ?? '').toUpperCase();
  if (FULL_ACCESS_ROLES.has(role)) return true;
  if (role !== 'SUPPORT') return false;
  return (user.permissions ?? []).includes(perm);
}

export function hasAnyPermission(user: PermissionSubject | null | undefined, perms: SupportPermission[]): boolean {
  return perms.some((p) => hasPermission(user, p));
}

/** Message commun quand l'administrateur n'a pas (ou plus) délégué l'action au service client. */
export const SUPPORT_NOT_DELEGATED = "Cette action n'est pas déléguée à votre compte. Contactez votre administrateur.";
