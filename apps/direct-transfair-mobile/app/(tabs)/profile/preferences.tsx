// apps/direct-transfair-mobile/app/(tabs)/profile/preferences.tsx
// =========================================================
// PRÉFÉRENCES v1.0 — apparence (thème Clair / Sombre / Automatique) et langue (FR / EN / PT).
// Le choix est appliqué tout de suite à toute l'application et mémorisé sur l'appareil.
// Accessible depuis Profil → « Préférences » (compte client comme compte marchand).
// =========================================================

import React from "react";
import { useRouter } from "expo-router";
import { Group, NavBar, Screen, SectionHeader, UText } from "../../../components/ui";
import { ThemeCards } from "../../../components/theme/ThemeSwitcher";
import { LanguageRow } from "../../../components/i18n/LanguageSwitcher";
import { useT } from "../../../providers/I18nProvider";

export default function PreferencesScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen header={<NavBar title={t("th.title")} onBack={() => router.back()} />}>
      <UText v="body" tone="muted" style={{ marginTop: 4 }}>{t("th.subtitle")}</UText>

      <SectionHeader title={t("th.appearance")} />
      <ThemeCards />
      <UText v="caption" tone="muted" style={{ marginTop: 12 }}>{t("th.hint")}</UText>

      <SectionHeader title={t("lang.title")} />
      <Group>
        <LanguageRow last />
      </Group>
      <UText v="caption" tone="muted" style={{ marginTop: 10 }}>{t("th.languageHint")}</UText>
    </Screen>
  );
}
