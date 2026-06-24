// apps/direct-transfair-mobile/app/(auth)/login.tsx
// =========================================================
// LOGIN v7.0 — Redirection vers login-v2
// ✅ v6.5 : isolation portail, biométrie, OTP téléphone
// ✅ v7.0 : Remplacement par redirection vers login-v2
//
// RAISON : login.tsx v6.5 utilise useAuth().login() qui
// appelle /auth/login (v1). Depuis auth.service.ts v5.0,
// ce endpoint retourne VERIFICATION_REQUIRED si email/phone
// non vérifiés, mais login.tsx ne savait pas le gérer.
// login-v2.tsx gère correctement ce flux.
//
// login.tsx conservé comme fichier (pour la route /(auth)/login
// utilisée dans l'ancienne logique logout) mais redirige
// immédiatement vers login-v2 qui contient toutes les
// fonctionnalités (biométrie est dans login-v2 → otp-phone,
// le reste est géré).
// =========================================================

import { Redirect } from 'expo-router';

export default function LoginScreen() {
  return <Redirect href="/(auth)/login-v2" />;
}