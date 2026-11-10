// apps/direct-transfair-mobile/providers/I18nProvider.tsx
// =========================================================
// LANGUE DE L'APPLICATION (FR / EN / PT) — v1.0
//  • Au premier lancement : langue du téléphone si elle est gérée, sinon français. Ensuite : le dernier choix, mémorisé sur l'appareil.
//  • Le changement est immédiat (toute l'interface se redessine) et se propage : intercepteur d'API (en-tête Accept-Language → erreurs,
//    emails, notifications traduits par le serveur) et compte (voir <LanguageSync /> dans _layout.tsx).
// =========================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CATALOG, type MessageKey } from '../i18n/catalog';
import { detectDeviceLang, infoOf, normalizeLang, translateWith, type Lang, type LangInfo, type Params } from '../i18n/core';
import { fmtDate, fmtDateTime, fmtNumber, getLang, setRuntimeLang } from '../i18n/runtime';

export const LANG_STORAGE_KEY = 'app.lang.v1';

type Ctx = {
  lang: Lang;
  info: LangInfo;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
  fmtDate: typeof fmtDate;
  fmtDateTime: typeof fmtDateTime;
  fmtNumber: typeof fmtNumber;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang());

  // Lecture du choix mémorisé (une fois). Sans choix : langue du téléphone.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LANG_STORAGE_KEY)
      .then((saved) => {
        const next = normalizeLang(saved) ?? detectDeviceLang();
        if (!alive) return;
        setRuntimeLang(next);
        setLangState(next);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setRuntimeLang(next);
    setLangState(next);
    AsyncStorage.setItem(LANG_STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang,
    info: infoOf(lang),
    locale: infoOf(lang).locale,
    setLang,
    t: (key, params) => translateWith(CATALOG, lang, key, params),
    fmtDate, fmtDateTime, fmtNumber,
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Hors fournisseur (test, écran isolé) : français / langue courante, sans plantage.
  const lang = getLang();
  return {
    lang, info: infoOf(lang), locale: infoOf(lang).locale, setLang: setRuntimeLang,
    t: (key, params) => translateWith(CATALOG, lang, key, params),
    fmtDate, fmtDateTime, fmtNumber,
  };
}

export const useT = () => useI18n().t;
