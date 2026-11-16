// =========================================================
// verification-policy.ts — v1.0
// =========================================================
// Source UNIQUE de la règle « un compte est-il entièrement vérifié ? ».
//
// CONTEXTE : jusqu'ici la vérification du téléphone était désactivée
// en dur (« DEV bypass ») à quatre endroits de v2-auth.service.ts,
// alors que le login v1 (auth.service.ts) et account-verified.guard.ts
// appliquaient, eux, la vraie règle. Résultat : deux règles différentes
// selon le chemin d'authentification, et un « bypass DEV » livré en
// production sans moyen de l'éteindre.
//
// SOLUTION : un interrupteur d'environnement, PHONE_VERIFICATION_REQUIRED.
//   - absent / false (défaut) : seul l'email est exigé (comportement
//     actuel en production — aucun risque de blocage d'inscription si
//     Twilio n'est pas configuré) ;
//   - true : un compte avec téléphone doit aussi avoir vérifié son
//     téléphone (SMS envoyé à l'inscription / connexion).
// ⚠️ N'activer qu'une fois l'envoi de SMS (Twilio) confirmé sur Render.
// =========================================================

type VerifiableUser = {
  isEmailVerified?: boolean | null;
  isPhoneVerified?: boolean | null;
  phone?:           string  | null;
};

/** true si la vérification du téléphone est exigée par la configuration. */
export function phoneVerificationRequired(): boolean {
  const raw = (process.env.PHONE_VERIFICATION_REQUIRED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/** true si le téléphone du compte reste à vérifier ET que c'est exigé. */
export function phonePending(user: VerifiableUser): boolean {
  return phoneVerificationRequired() && !!user.phone && !user.isPhoneVerified;
}

/** Règle unique : email vérifié + (si exigé) téléphone vérifié. */
export function isFullyVerified(user: VerifiableUser): boolean {
  return !!user.isEmailVerified && !phonePending(user);
}
