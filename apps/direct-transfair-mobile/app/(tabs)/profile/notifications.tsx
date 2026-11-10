// apps/direct-transfair-mobile/app/(tabs)/profile/notifications.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// NOTIFICATIONS (préférences) v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE THÈME CLAIR — grand titre, interrupteur « Tout activer » par canal,
//    catégories en lignes à filet avec deux interrupteurs (Push | Email) aux couleurs de la
//    société, confirmation d'enregistrement en bandeau, bouton pilule collé en bas. Plus de
//    teintes par rôle codées en dur ; interrupteurs du design system ; police système.
//    En-têtes de colonnes Push | Email placés AVANT la ligne « Tout activer ».
//    LOGIQUE INCHANGÉE (préférences par catégorie et canal, persistance locale
//    AsyncStorage `dt_notif_prefs_v1`, fusion avec les valeurs par défaut).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v1.1 : WHITE-LABEL — couleurs suivent la marque ; en-tête commun du wallet.
// ✅ Canaux : Push (mobile) + Email · Toast de confirmation.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, NavBar, Notice, Screen, Toggle, UText, useUI } from "../../../components/ui";
import { useT } from "../../../providers/I18nProvider";
import type { MessageKey } from "../../../i18n/catalog";

const STORAGE_KEY = "dt_notif_prefs_v1";

// ─── Types ───────────────────────────────────────────────
type NotifCategory = "b2b" | "agencyRefill" | "lowBalance" | "security" | "system";
type NotifChannel = "push" | "email";

interface NotifPrefs {
  push: Record<NotifCategory, boolean>;
  email: Record<NotifCategory, boolean>;
}

// ─── Défauts ─────────────────────────────────────────────
const DEFAULT_PREFS: NotifPrefs = {
  push: { b2b: true, agencyRefill: true, lowBalance: true, security: true, system: false },
  email: { b2b: true, agencyRefill: false, lowBalance: false, security: true, system: false },
};

// ─── Définition des catégories ───────────────────────────
const CATEGORIES: { key: NotifCategory; icon: string; label: MessageKey; desc: MessageKey }[] = [
  { key: "b2b", icon: "swap-horizontal-outline", label: "np.b2b", desc: "np.b2bDesc" },
  { key: "agencyRefill", icon: "storefront-outline", label: "np.refill", desc: "np.refillDesc" },
  { key: "lowBalance", icon: "alert-circle-outline", label: "np.low", desc: "np.lowDesc" },
  { key: "security", icon: "shield-checkmark-outline", label: "np.security", desc: "np.securityDesc" },
  { key: "system", icon: "megaphone-outline", label: "np.system", desc: "np.systemDesc" },
];

/** Colonne de deux interrupteurs (Push | Email), largeur fixe pour aligner les lignes. */
const COL = 62;

export default function NotificationsPrefsScreen() {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | { ok: boolean; message: string }>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chargement AsyncStorage ────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as NotifPrefs;
          // Fusion avec les défauts pour gérer les nouvelles clés
          setPrefs({
            push: { ...DEFAULT_PREFS.push, ...parsed.push },
            email: { ...DEFAULT_PREFS.email, ...parsed.email },
          });
        }
      } catch {
        // Silencieux — on reste sur les défauts
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  const toggle = (cat: NotifCategory, channel: NotifChannel) => {
    setPrefs((prev) => ({ ...prev, [channel]: { ...prev[channel], [cat]: !prev[channel][cat] } }));
  };

  const toggleAll = (channel: NotifChannel, value: boolean) => {
    const all = {} as Record<NotifCategory, boolean>;
    CATEGORIES.forEach((c) => { all[c.key] = value; });
    setPrefs((prev) => ({ ...prev, [channel]: all }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved({ ok: true, message: t("np.savedMsg") });
    } catch {
      setSaved({ ok: false, message: t("np.saveFail") });
    } finally {
      setSaving(false);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(null), 3500);
    }
  };

  const allPushOn = CATEGORIES.every((c) => prefs.push[c.key]);
  const allEmailOn = CATEGORIES.every((c) => prefs.email[c.key]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.ink} size="large" />
      </View>
    );
  }

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 10 }}>
      <View style={{ flex: 1 }} />
      {([["phone-portrait-outline", "Push"], ["mail-outline", "Email"]] as const).map(([icon, label]) => (
        <View key={label} style={{ width: COL, alignItems: "center", gap: 2 }}>
          <Ionicons name={icon} size={15} color={C.muted} />
          <UText v="label" tone="muted">{label}</UText>
        </View>
      ))}
    </View>
  );

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      footer={<Button label={t("np.save")} icon="checkmark-done-outline" onPress={handleSave} loading={saving} disabled={saving} />}
    >
      <UText v="hero">{t("np.title")}</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 20 }}>
        {t("np.intro")}
      </UText>

      {saved && (
        <Notice tone={saved.ok ? "pos" : "danger"} title={saved.ok ? t("np.savedTitle") : t("common.error")} style={{ marginBottom: 16 }}>
          {saved.message}
        </Notice>
      )}

      {header}

      {/* Tout activer */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line }}>
        <UText v="overline" tone="muted" style={{ flex: 1 }}>{t("np.all")}</UText>
        <View style={{ width: COL, alignItems: "center" }}>
          <Toggle value={allPushOn} onValueChange={(v) => toggleAll("push", v)} />
        </View>
        <View style={{ width: COL, alignItems: "center" }}>
          <Toggle value={allEmailOn} onValueChange={(v) => toggleAll("email", v)} />
        </View>
      </View>


      {CATEGORIES.map((cat, i) => (
        <View
          key={cat.key}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: i === CATEGORIES.length - 1 ? 0 : 1, borderBottomColor: C.line }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={cat.icon as any} size={20} color={C.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong">{t(cat.label)}</UText>
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{t(cat.desc)}</UText>
          </View>
          <View style={{ width: COL, alignItems: "center" }}>
            <Toggle value={prefs.push[cat.key]} onValueChange={() => toggle(cat.key, "push")} />
          </View>
          <View style={{ width: COL, alignItems: "center" }}>
            <Toggle value={prefs.email[cat.key]} onValueChange={() => toggle(cat.key, "email")} />
          </View>
        </View>
      ))}

      <Notice tone="info" icon="information-circle-outline" style={{ marginTop: 20 }}>
        {t("np.footer")}
      </Notice>
    </Screen>
  );
}
