// apps/backend/src/common/utils/phone.util.ts
// =========================================================
// UTILITAIRE CENTRALISÉ — NORMALISATION TÉLÉPHONE
// =========================================================
// 🚨 SOURCE UNIQUE DE VÉRITÉ — SÉCURITÉ CRITIQUE
//
// Bug corrigé (juillet 2026) :
//   auth.service.ts, v2-auth.service.ts, users.service.ts et
//   transactions.service.ts avaient CHACUN leur propre fonction
//   normalizePhone() légèrement différente, et aucune n'était
//   appliquée de façon cohérente à l'écriture en base. Résultat :
//   deux comptes différents (Alpha DIALLO — client — et Thierno
//   DIALLO — admin) ont pu stocker LE MÊME numéro réel sous deux
//   formats différents :
//       "+33766736226"    (Alpha)
//       "0033766736226"   (Thierno)
//   La contrainte `phone @unique` de Prisma ne les a jamais bloqués
//   car ce sont deux chaînes différentes au sens strict.
//
//   Ensuite, la recherche "tolérante" utilisée pour retrouver un
//   client par téléphone (dépôt agent, transfert wallet-to-wallet)
//   comparait les numéros par SUFFIXE plutôt que par égalité stricte,
//   ce qui rendait les deux comptes ci-dessus indiscernables l'un de
//   l'autre pour cette recherche (l'un est un suffixe strict de
//   l'autre : "0033766736226" se termine par "33766736226"). Un
//   dépôt de 50 000 € destiné au client a été crédité sur le wallet
//   de l'admin.
//
// CORRECTIF (défense en profondeur) :
//   1. Toute écriture d'un numéro de téléphone en base DOIT passer
//      par normalizePhoneE164() avant le create/update (voir
//      UsersService.create/update, AuthService.register/updateProfile).
//   2. Toute recherche par téléphone DOIT normaliser l'entrée avec
//      la MÊME fonction puis faire une correspondance EXACTE sur le
//      champ `phone` (colonne @unique) — plus jamais de "contains"
//      ou de comparaison par suffixe pour une opération qui déplace
//      de l'argent ou authentifie un compte.
//
// ⚠️ Ne réimplémentez JAMAIS une variante de cette fonction ailleurs.
// Si un nouveau besoin de normalisation téléphone apparaît, importez
// cette fonction.
// =========================================================

/**
 * Normalise un numéro de téléphone vers un format canonique de type
 * E.164 : toujours préfixé par "+", uniquement des chiffres ensuite.
 *
 * Règles appliquées :
 *   - Suppression de tout caractère non numérique (espaces, points,
 *     tirets, parenthèses…), en gardant la trace d'un éventuel "+"
 *     de tête avant nettoyage.
 *   - Un préfixe "00" en tête (convention internationale utilisée à
 *     la place de "+") est converti en "+".
 *       "0033766736226" → "+33766736226"
 *       "+33766736226"  → "+33766736226"  (déjà bon, inchangé)
 *       "33766736226"   → "+33766736226"  (indicatif nu → on ajoute le +)
 *
 * ⚠️ LIMITE CONNUE : un numéro saisi en format purement LOCAL sans
 * indicatif (ex: "0766736226" pour un numéro français) sera normalisé
 * en "+0766736226", ce qui est incorrect (indicatif +33 manquant)
 * mais reste DÉTERMINISTE : le même numéro local produit toujours la
 * même sortie, donc plus de collision silencieuse entre deux comptes
 * sur ce cas précis. Pour une normalisation 100% correcte y compris
 * les formats locaux (avec détection automatique de l'indicatif par
 * pays), il faudra migrer vers une librairie dédiée comme
 * `libphonenumber-js` (voir suggestion en bas de fichier). Dans
 * l'immédiat, le formulaire d'inscription mobile (register.tsx)
 * construit déjà le numéro avec l'indicatif du pays sélectionné
 * (`${phoneCode}${phone}`), donc ce cas ne se présente pas pour les
 * inscriptions via l'app — le risque concerne surtout une éventuelle
 * saisie manuelle côté admin/agence.
 *
 * @returns le numéro normalisé (toujours préfixé par "+"), ou null
 *          si l'entrée est vide, invalide, ou trop courte pour être
 *          un numéro plausible.
 */
export function normalizePhoneE164(raw?: string | null): string | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const hadLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;

  let nationalDigits = digitsOnly;
  if (!hadLeadingPlus && digitsOnly.startsWith('00') && digitsOnly.length > 2) {
    nationalDigits = digitsOnly.slice(2);
  }

  // Trop court pour être un numéro plausible (protège aussi contre
  // des entrées du type "00" seul ou une suite de zéros)
  if (nationalDigits.length < 6) return null;

  return `+${nationalDigits}`;
}

/**
 * Compare deux numéros après normalisation. Pratique pour éviter de
 * répéter normalizePhoneE164() des deux côtés d'une comparaison.
 */
export function isSamePhone(a?: string | null, b?: string | null): boolean {
  const na = normalizePhoneE164(a);
  const nb = normalizePhoneE164(b);
  return na !== null && nb !== null && na === nb;
}

// =========================================================
// 🔧 ÉVOLUTION RECOMMANDÉE (non bloquante pour ce correctif) :
//
// Pour une normalisation robuste même sur les numéros locaux sans
// indicatif, remplacer l'implémentation ci-dessus par :
//
//   import { parsePhoneNumberFromString } from 'libphonenumber-js';
//
//   export function normalizePhoneE164(
//     raw?: string | null,
//     defaultCountry?: string, // ex: user.country ("FR", "GN"…)
//   ): string | null {
//     if (!raw) return null;
//     try {
//       const parsed = parsePhoneNumberFromString(raw, defaultCountry as any);
//       if (parsed?.isValid()) return parsed.number; // déjà en E.164
//     } catch {}
//     return null;
//   }
//
// `npm install libphonenumber-js` puis passer le pays connu de
// l'utilisateur (extra.country / dto.country) en 2e argument partout
// où c'est disponible, pour lever l'ambiguïté sur les formats locaux.
// =========================================================