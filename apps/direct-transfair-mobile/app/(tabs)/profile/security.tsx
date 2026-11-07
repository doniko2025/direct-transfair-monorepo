// apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
// =========================================================
// SECURITY v7.0 — Direct Transf'air
// ✅ v7.0 (lot 10) : le code secret est désormais un CODE À 6 CHIFFRES robuste. Trois saisies à cases masquées (ancien code, nouveau code,
//    confirmation), jauge qui explique pourquoi un code est refusé (suite, date de naissance, répétition, morceau du téléphone…) — même
//    règle que le serveur (components/auth/pinRules.ts). Mêmes appels (api.changePassword), même retour automatique après succès.
// ✅ v6.0 : refonte thème clair (bandeau de résultat, bouton pilule collé en bas).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { TextInput as RNTextInput } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import PinGuide from "../../../components/auth/PinGuide";
import PinInput from "../../../components/auth/PinInput";
import { PIN_LENGTH, pinProblem } from "../../../components/auth/pinRules";
import { Button, NavBar, Notice, Screen, UText, useUI } from "../../../components/ui";

export default function SecurityScreen() {
  const { C } = useUI();
  const router = useRouter();
  const { user } = useAuth();

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverWeak, setServerWeak] = useState<string | null>(null);
  const [result, setResult] = useState<null | { type: "pos" | "danger"; title: string; message: string }>(null);
  const newRef = useRef<RNTextInput | null>(null);
  const confirmRef = useRef<RNTextInput | null>(null);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (backTimer.current) clearTimeout(backTimer.current); }, []);

  // La date de naissance et le téléphone du client servent à refuser les codes évidents.
  const pinContext = { birthDate: (user as any)?.birthDate ?? null, phone: user?.phone ?? null };

  const weak = newPin.length === PIN_LENGTH ? pinProblem(newPin, pinContext) : null;
  const same = newPin.length === PIN_LENGTH && newPin === oldPin;
  const mismatch = confirmPin.length === PIN_LENGTH && newPin.length === PIN_LENGTH && confirmPin !== newPin;
  const canSave =
    oldPin.length === PIN_LENGTH && newPin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && !weak && !same && !mismatch;

  const handleSave = async () => {
    if (!canSave || loading) return;
    setLoading(true);
    setResult(null);
    setServerWeak(null);
    try {
      await api.changePassword({ oldPassword: oldPin, newPassword: newPin });
      setOldPin(""); setNewPin(""); setConfirmPin("");
      setResult({ type: "pos", title: "Code mis à jour", message: "Ton code secret a bien été modifié." });
      backTimer.current = setTimeout(() => router.back(), 1800);
    } catch (e: any) {
      const raw = e?.response?.data?.message || e?.message || "Impossible de modifier le code.";
      const msg = Array.isArray(raw) ? String(raw[0]) : String(raw);
      if (e?.response?.data?.code === "PIN_WEAK") setServerWeak(msg);
      else setResult({ type: "danger", title: "Erreur", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      footer={<Button label="Mettre à jour le code" onPress={handleSave} loading={loading} disabled={!canSave || loading} />}
    >
      <UText v="hero">Code secret</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 24 }}>
        Ton code à 6 chiffres protège ton portefeuille. Change-le régulièrement et ne le partage jamais, même avec nous.
      </UText>

      {result && (
        <Notice tone={result.type} title={result.title} style={{ marginBottom: 18 }}>
          {result.message}
        </Notice>
      )}

      <PinInput
        label="Code actuel"
        value={oldPin}
        onChange={setOldPin}
        onComplete={() => newRef.current?.focus()}
        accent={C.accent}
        disabled={loading}
      />
      <PinInput
        label="Nouveau code"
        value={newPin}
        onChange={(v) => { setNewPin(v); setServerWeak(null); }}
        onComplete={() => confirmRef.current?.focus()}
        accent={C.accent}
        error={serverWeak ?? (same ? "Le nouveau code doit être différent de l'ancien." : null)}
        disabled={loading}
        inputRef={newRef}
      />
      <PinGuide pin={newPin} context={pinContext} />
      <PinInput
        label="Confirmer le nouveau code"
        value={confirmPin}
        onChange={setConfirmPin}
        accent={C.accent}
        error={mismatch ? "Les deux codes ne correspondent pas." : null}
        disabled={loading}
        noReveal
        inputRef={confirmRef}
      />
    </Screen>
  );
}
