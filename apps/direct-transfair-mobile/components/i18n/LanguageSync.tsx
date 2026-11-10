// apps/direct-transfair-mobile/components/i18n/LanguageSync.tsx
// =========================================================
// SYNCHRONISATION DE LA LANGUE AVEC LE COMPTE — v1.0 (sans affichage)
//   • À la connexion : si l'utilisateur a choisi une langue sur cet appareil, elle est envoyée au compte ; sinon l'appareil adopte celle du compte
//     (changement de téléphone, réinstallation).
//   • Ensuite : chaque changement de langue est envoyé au compte, pour que les emails, SMS et notifications arrivent dans la bonne langue.
// Un échec réseau n'empêche jamais le changement de langue : le prochain changement ou la prochaine connexion réessaie.
// À placer sous <AuthProvider> et <I18nProvider> (voir app/_layout.tsx).
// =========================================================

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeLang, type Lang } from '../../i18n/core';
import { LANG_STORAGE_KEY, useI18n } from '../../providers/I18nProvider';
import { useAuth } from '../../providers/AuthProvider';
import { api } from '../../services/api';

export default function LanguageSync() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  const userId: string | null = (user as any)?.id ?? null;
  const accountLang = normalizeLang((user as any)?.preferredLanguage);

  const startedFor = useRef<string | null>(null);   // compte pour lequel la comparaison de départ est faite
  const known = useRef<Lang | null>(null);          // langue que le serveur connaît pour ce compte

  useEffect(() => {
    if (!userId) { startedFor.current = null; known.current = null; return; }
    let alive = true;

    (async () => {
      if (startedFor.current !== userId) {
        startedFor.current = userId;
        known.current = accountLang;
        let saved: string | null = null;
        try { saved = await AsyncStorage.getItem(LANG_STORAGE_KEY); } catch { /* lecture impossible : on suit l'appareil */ }
        if (!alive) return;
        if (!saved && accountLang && accountLang !== lang) { setLang(accountLang); return; }   // nouvel appareil : on suit le compte
      }
      if (known.current !== lang) {
        known.current = lang;
        api.setLanguage(lang).catch(() => { known.current = null; });                        // réessai au prochain changement
      }
    })();

    return () => { alive = false; };
  }, [userId, accountLang, lang, setLang]);

  return null;
}
