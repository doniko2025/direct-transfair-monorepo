// apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
// =========================================================
// SECURITY v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — grand titre, champs arrondis avec œil, jauge de force
//    fine, indicateur de correspondance, message de résultat en bandeau (remplace le toast
//    animé plein écran) et bouton pilule collé en bas. Couleurs = palette du design system
//    et marque du tenant (plus de vert/ambre par rôle codés en dur). Le journal de débogage
//    (console.log des longueurs de saisie) et les compteurs « 0/0/0 » dans le message
//    d'erreur sont retirés.
//    LOGIQUE INCHANGÉE (mêmes validations : champs requis, 6 caractères minimum, deux codes
//    identiques, différent de l'ancien ; même appel api.changePassword ; retour automatique
//    après succès).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.2 : WHITE-LABEL — couleurs vertes suivent la couleur de marque du tenant.
// ✅ Fix web : outlineStyle inline + underlineColorAndroid · trim() sur valeurs state.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { Button, Field, NavBar, Notice, Screen, UText, useUI } from "../../../components/ui";

export default function SecurityScreen() {
  const { C } = useUI();
  const router = useRouter();

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { type: "pos" | "danger"; title: string; message: string }>(null);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current); }, []);

  const handleSave = async () => {
    // Trim uniquement ici, au moment de la validation
    const oldTrimmed = oldPass.trim();
    const newTrimmed = newPass.trim();
    const confirmTrimmed = confirmPass.trim();

    if (!oldTrimmed || !newTrimmed || !confirmTrimmed) {
      setResult({ type: "danger", title: "Champs manquants", message: "Remplis tous les champs." });
      return;
    }
    if (newTrimmed.length < 6) {
      setResult({ type: "danger", title: "Sécurité", message: "Le nouveau code doit contenir au moins 6 caractères." });
      return;
    }
    if (newTrimmed !== confirmTrimmed) {
      setResult({ type: "danger", title: "Erreur", message: "Les deux nouveaux codes ne correspondent pas." });
      return;
    }
    if (newTrimmed === oldTrimmed) {
      setResult({ type: "danger", title: "Erreur", message: "Le nouveau code doit être différent de l'ancien." });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      await api.changePassword({
        oldPassword: oldTrimmed,
        currentPassword: oldTrimmed,
        newPassword: newTrimmed,
        password: newTrimmed,
      });
      setOldPass(""); setNewPass(""); setConfirmPass("");
      setResult({ type: "pos", title: "Code mis à jour", message: "Ton code secret a bien été modifié." });
      backTimer.current = setTimeout(() => router.back(), 1800);
    } catch (e: any) {
      const raw = e?.response?.data?.message || e?.message || "Impossible de modifier le code.";
      const msg = Array.isArray(raw) ? raw[0] : String(raw);
      setResult({ type: "danger", title: "Erreur", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const strengthLevel =
    newPass.length === 0 ? null
    : newPass.length < 6 ? "weak"
    : newPass.length < 10 ? "medium"
    : "strong";
  const strengthColor = strengthLevel === "weak" ? C.danger : strengthLevel === "medium" ? C.warn : C.pos;
  const strengthLabel = strengthLevel === "weak" ? "Trop court" : strengthLevel === "medium" ? "Acceptable" : "Fort ✓";

  const mismatch = confirmPass.length > 0 && newPass.length > 0 && newPass !== confirmPass;
  const match = confirmPass.length > 0 && newPass.length > 0 && newPass === confirmPass;

  const canSave = oldPass.trim().length > 0 && newPass.trim().length >= 6 && confirmPass.trim().length > 0;

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      footer={<Button label="Mettre à jour le code" onPress={handleSave} loading={loading} disabled={!canSave || loading} />}
    >
      <UText v="hero">Code secret</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 24 }}>
        Renforce la sécurité de ton compte en modifiant régulièrement ton code secret.
      </UText>

      {result && (
        <Notice tone={result.type} title={result.title} style={{ marginBottom: 18 }}>
          {result.message}
        </Notice>
      )}

      <Field
        label="Ancien code secret"
        icon="lock-closed-outline"
        value={oldPass}
        onChangeText={setOldPass}
        secure
        autoCapitalize="none"
      />
      <Field
        label="Nouveau code secret"
        icon="lock-closed-outline"
        value={newPass}
        onChangeText={setNewPass}
        placeholder="Minimum 6 caractères"
        secure
        autoCapitalize="none"
      />

      {strengthLevel && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: -6, marginBottom: 18 }}>
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: C.line, overflow: "hidden" }}>
            <View
              style={{
                height: 5, borderRadius: 3, backgroundColor: strengthColor,
                width: strengthLevel === "weak" ? "30%" : strengthLevel === "medium" ? "65%" : "100%",
              }}
            />
          </View>
          <UText v="label" color={strengthColor}>{strengthLabel}</UText>
        </View>
      )}

      <Field
        label="Confirmer le nouveau code"
        icon="lock-closed-outline"
        value={confirmPass}
        onChangeText={setConfirmPass}
        placeholder="Répète le nouveau code"
        secure
        autoCapitalize="none"
        error={mismatch ? "Les codes ne correspondent pas" : null}
        valid={match}
        hint={match ? "Les codes correspondent" : undefined}
      />
    </Screen>
  );
}
