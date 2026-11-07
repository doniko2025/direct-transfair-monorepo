// apps/direct-transfair-mobile/app/(tabs)/profile/delete-account.tsx
// =========================================================
// SUPPRIMER MON COMPTE v1.0 — suppression définitive de son propre compte, confirmée par DEUX preuves :
//   1. le numéro de téléphone du compte (indicatif + numéro) ;
//   2. le code secret à 6 chiffres.
// Le serveur (POST /account/delete) refuse tant qu'il reste de l'argent (compte client ou commerce) ou un retrait marchand en attente ;
// en cas de succès la session est fermée et la personne revient à l'écran de connexion. Un dernier écran de confirmation (case à cocher)
// évite un toucher accidentel.
// =========================================================

import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../../components/auth/PhoneField";
import PinInput from "../../../components/auth/PinInput";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../../components/auth/authCountries";
import { PIN_LENGTH } from "../../../components/auth/pinRules";
import { Ionicons } from "../../../components/ui/Icon";
import { Button, NavBar, Notice, Screen, UText, useUI } from "../../../components/ui";

/** Pays dont l'indicatif commence le numéro du compte (le plus long gagne : +224 avant +2…). */
function countryOf(phone?: string | null): AuthCountry {
  const p = (phone ?? "").replace(/[^\d+]/g, "");
  const hit = [...AUTH_COUNTRIES].filter((c) => p.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  return hit ?? findCountry("France") ?? AUTH_COUNTRIES[0]!;
}

/** Message lisible selon le code renvoyé par le serveur. */
function explain(e: any): string {
  const data = e?.response?.data;
  const code = data?.code ?? data?.message?.code;
  const msg = Array.isArray(data?.message) ? data.message[0] : typeof data?.message === "string" ? data.message : null;
  if (code === "PHONE_MISMATCH") return "Ce numéro ne correspond pas à celui de votre compte.";
  if (code === "PIN_INVALID" || code === "PIN_LOCKED" || code === "BALANCE_NOT_EMPTY" || code === "PENDING_OPERATIONS") return msg ?? data?.message?.message ?? "Suppression impossible pour le moment.";
  if (msg) return msg;
  if (!e?.response) return "Connexion impossible : vérifiez votre réseau et réessayez.";
  return "Suppression impossible pour le moment. Réessayez plus tard.";
}

export default function DeleteAccountScreen() {
  const { C } = useUI();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [country, setCountry] = useState<AuthCountry>(() => countryOf((user as any)?.phone));
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [sure, setSure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneError = useMemo(() => (phone ? validatePhone(phone) : null), [phone]);
  const canSubmit = sure && !validatePhone(phone) && pin.length === PIN_LENGTH && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await api.http.post("/account/delete", { phone: `${country.dial}${normalizeNationalNumber(phone)}`, pin }, { timeout: 30_000 });
      await logout(); // ferme la session et revient à la connexion
    } catch (e) {
      setError(explain(e));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      footer={<Button label="Supprimer définitivement mon compte" kind="danger" onPress={submit} loading={loading} disabled={!canSubmit} />}
    >
      <UText v="hero">Supprimer mon compte</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 18 }}>
        Cette action est définitive : vous ne pourrez plus vous connecter avec ce compte.
      </UText>

      <Notice tone="warn" title="Avant de continuer" style={{ marginBottom: 18 }}>
        Votre solde doit être à zéro (compte client et, le cas échéant, compte marchand) et aucun retrait ne doit être en cours. Retirez ou transférez
        vos fonds d'abord : sinon la suppression sera refusée.
      </Notice>

      {error ? <Notice tone="danger" style={{ marginBottom: 18 }}>{error}</Notice> : null}

      <UText v="subheading" style={{ marginBottom: 4 }}>Pour confirmer</UText>
      <PhoneField
        country={country}
        onCountryChange={setCountry}
        value={phone}
        onChangeText={(t) => { setPhone(t); if (error) setError(null); }}
        error={phoneError}
        hint="Le numéro de téléphone de votre compte."
        accent={C.accent}
      />
      <PinInput label="Code secret" value={pin} onChange={(v) => { setPin(v); if (error) setError(null); }} accent={C.accent} disabled={loading} />

      <Pressable
        onPress={() => setSure((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: sure }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, paddingVertical: 10 }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: sure ? C.danger : C.lineStrong, backgroundColor: sure ? C.danger : "transparent", alignItems: "center", justifyContent: "center" }}>
          {sure ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
        </View>
        <UText v="body" style={{ flex: 1 }}>Je comprends que la suppression de mon compte est irréversible.</UText>
      </Pressable>
    </Screen>
  );
}
