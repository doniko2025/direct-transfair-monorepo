// apps/direct-transfair-mobile/app/merchant/activate.tsx
// =========================================================
// ACTIVER L'ESPACE MARCHAND v1.0 — Lot 11
// Pour un client qui a déjà un compte : nom du commerce, catégorie, numéro Orange Money de retrait, puis code secret.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Button, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { MERCHANT_CATEGORIES, PinPrompt, Rise, apiProblem } from "../../components/merchant/merchantUi";
import { Text } from "../../components/ui/Text";

export default function ActivateMerchantScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { C, R } = useUI();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState(user?.city ?? "");
  const [country, setCountry] = useState<AuthCountry>(findCountry(user?.country ?? "Guinée") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const { data: me, status, error, reload } = useLoader(() => api.getMerchantMe());

  if (status === "loading") return <Screen header={<NavBar onBack={() => router.back()} title="Devenir marchand" />}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !me) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Devenir marchand" />}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  if (me.isMerchant) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Devenir marchand" />} footer={<Button label="Ouvrir mon espace marchand" onPress={() => router.replace("/merchant" as any)} />}>
        <Notice tone="pos">Votre espace marchand est déjà actif.</Notice>
      </Screen>
    );
  }
  if (!me.canActivate) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Devenir marchand" />}><Notice tone="warn">Les comptes marchands ne sont pas disponibles pour le moment.</Notice></Screen>;
  }

  const categories = me.categories.length ? me.categories : MERCHANT_CATEGORIES;
  const nameError = showErrors && name.trim().length < 2 ? "Saisissez le nom de votre commerce." : null;
  const catError = showErrors && !category ? "Choisissez une catégorie." : null;
  const phoneError = showErrors ? validatePhone(phone) : null;

  const submit = async () => {
    setShowErrors(true);
    setProblem(null);
    if (name.trim().length < 2 || !category || validatePhone(phone) || pin.length !== 6) return;
    setBusy(true);
    try {
      await api.activateMerchant({
        businessName: name.trim(),
        category,
        city: city.trim() || undefined,
        orangeMoneyPhone: `${country.dial}${normalizeNationalNumber(phone)}`,
        pin,
      });
      try { await refreshUser?.(); } catch { /* sans incidence */ }
      router.replace("/merchant" as any);
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else setProblem(pr.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title="Devenir marchand" />}
      footer={<Button label="Activer mon espace marchand" icon="storefront-outline" loading={busy} onPress={submit} testID="activate-merchant" />}
    >
      <Rise>
        <UText v="body" tone="muted" style={{ marginBottom: 18 }}>
          Encaissez vos clients par QR code ou par téléphone et retirez vos gains vers votre Orange Money. Votre portefeuille actuel est conservé.
        </UText>
        {!!problem && <Notice tone="danger" style={{ marginBottom: 14 }}>{problem}</Notice>}
        <Field label="Nom du commerce" icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} error={nameError} />
        <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>Catégorie</UText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: catError ? 6 : 18 }}>
          {categories.map((c) => {
            const on = category === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{ paddingHorizontal: 14, height: 38, borderRadius: R.pill, borderWidth: 1.5, borderColor: on ? C.dark : C.line, backgroundColor: on ? C.dark : C.surface, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: on ? C.darkInk : C.dark }}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!!catError && <UText v="caption" tone="danger" style={{ marginBottom: 14 }}>{catError}</UText>}
        <Field label="Ville" icon="business-outline" value={city} onChangeText={setCity} autoCapitalize="words" maxLength={80} />
        <PhoneField
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onChangeText={setPhone}
          error={phoneError}
          hint="Numéro Orange Money où seront versés vos retraits. Sans le 0 de tête."
          accent={C.accent}
        />
        <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? (showErrors && pin.length !== 6 ? "Saisissez votre code secret à 6 chiffres." : null)} label="Code secret pour confirmer" />
      </Rise>
    </Screen>
  );
}
