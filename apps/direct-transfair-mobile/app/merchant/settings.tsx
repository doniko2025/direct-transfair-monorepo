// apps/direct-transfair-mobile/app/merchant/settings.tsx
// =========================================================
// RÉGLAGES DU COMMERCE v1.0 — Lot 11
// • Fiche du commerce (nom, catégorie, adresse, ville) : modifiable librement.
// • Destination des retraits (Orange Money, IBAN) : modifiable UNIQUEMENT avec le code secret ; après un changement,
//   les retraits sont suspendus quelques heures (réglage de la société) pour bloquer un détournement de compte.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { MerchantMe } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { Button, Card, ErrorView, Field, NavBar, Notice, Screen, SectionHeader, SkeletonRows, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { MERCHANT_CATEGORIES, PinPrompt, Rise, apiProblem, shortDateTime } from "../../components/merchant/merchantUi";
import { Text } from "../../components/ui/Text";

function CategoryChips({ value, onChange, options }: { value: string | null; onChange: (v: string) => void; options: readonly string[] }) {
  const { C, R } = useUI();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((c) => {
        const on = value === c;
        return (
          <TouchableOpacity
            key={c}
            onPress={() => onChange(c)}
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
  );
}

function ProfileForm({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const profile = me.profile!;
  const [name, setName] = useState(profile.businessName);
  const [category, setCategory] = useState<string | null>(profile.category);
  const [address, setAddress] = useState(profile.address ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);
  const categories = me.categories.length ? me.categories : MERCHANT_CATEGORIES;

  const dirty = name.trim() !== profile.businessName || category !== profile.category || address.trim() !== (profile.address ?? "") || city.trim() !== (profile.city ?? "");
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.updateMerchantProfile({ businessName: name.trim(), category: category ?? undefined, address: address.trim(), city: city.trim() });
      setMsg({ tone: "pos", text: "Informations du commerce enregistrées." });
      onSaved();
    } catch (e) {
      setMsg({ tone: "danger", text: apiProblem(e).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card pad={20}>
      {msg && <Notice tone={msg.tone} style={{ marginBottom: 14 }}>{msg.text}</Notice>}
      <Field label="Nom du commerce" icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
      <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>Catégorie</UText>
      <CategoryChips value={category} onChange={setCategory} options={categories} />
      <View style={{ height: 16 }} />
      <Field label="Adresse" icon="location-outline" value={address} onChangeText={setAddress} autoCapitalize="sentences" maxLength={160} />
      <Field label="Ville" icon="business-outline" value={city} onChangeText={setCity} autoCapitalize="words" maxLength={80} />
      <Button label="Enregistrer" disabled={!dirty || name.trim().length < 2} loading={busy} onPress={save} />
    </Card>
  );
}

function DestinationForm({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const { C } = useUI();
  const profile = me.profile!;
  const bankEnabled = me.settings.payoutMethods.includes("BANK_TRANSFER");
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<AuthCountry>(findCountry("Guinée") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);

  const wantsPhone = phone.trim().length > 0;
  const wantsBank = bankEnabled && iban.trim().length > 0;
  const phoneError = showErrors && wantsPhone ? validatePhone(phone) : null;
  const holderError = showErrors && wantsBank && holder.trim().length < 2 ? "Saisissez le titulaire du compte." : null;
  const nothing = !wantsPhone && !wantsBank;

  const submit = async () => {
    setShowErrors(true);
    setMsg(null);
    if (nothing || pin.length !== 6) return;
    if ((wantsPhone && validatePhone(phone)) || (wantsBank && holder.trim().length < 2)) return;
    setBusy(true);
    try {
      await api.changeMerchantDestination({
        pin,
        ...(wantsPhone ? { orangeMoneyPhone: `${country.dial}${normalizeNationalNumber(phone)}` } : {}),
        ...(wantsBank ? { bankHolderName: holder.trim(), bankIban: iban.replace(/\s+/g, ""), ...(bic.trim() ? { bankBic: bic.trim() } : {}) } : {}),
      });
      setOpen(false);
      setPhone(""); setIban(""); setHolder(""); setBic(""); setPin(""); setShowErrors(false);
      setMsg({ tone: "pos", text: "Destination de retrait mise à jour. Vous avez reçu une notification de confirmation." });
      onSaved();
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else setMsg({ tone: "danger", text: pr.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card pad={20}>
      {msg && <Notice tone={msg.tone} style={{ marginBottom: 14 }}>{msg.text}</Notice>}
      <UText v="caption" tone="muted">Orange Money</UText>
      <UText v="bodyStrong" style={{ marginBottom: 12 }}>{profile.orangeMoneyMasked}</UText>
      {bankEnabled && (
        <>
          <UText v="caption" tone="muted">Compte bancaire (virement)</UText>
          <UText v="bodyStrong">{profile.bank ? `${profile.bank.holderName ?? ""} · ${profile.bank.ibanMasked}` : "Non renseigné"}</UText>
        </>
      )}
      {profile.destinationChangedAt && (
        <UText v="caption" tone="muted" style={{ marginTop: 10 }}>Dernière modification : {shortDateTime(profile.destinationChangedAt)}</UText>
      )}

      {!open ? (
        <Button label="Modifier la destination" kind="outline" icon="create-outline" onPress={() => setOpen(true)} style={{ marginTop: 16 }} />
      ) : (
        <View style={{ marginTop: 18 }}>
          <Notice tone="warn" style={{ marginBottom: 16 }}>
            Pour votre sécurité, votre code secret est demandé et les retraits sont suspendus {me.settings.payoutCooldownHours} h après le changement.
          </Notice>
          <PhoneField
            country={country}
            onCountryChange={setCountry}
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
            hint="Nouveau numéro Orange Money (laisser vide pour le conserver)."
            accent={C.accent}
          />
          {bankEnabled && (
            <>
              <Field label="Titulaire du compte bancaire" icon="person-outline" value={holder} onChangeText={setHolder} autoCapitalize="words" error={holderError} />
              <Field label="IBAN (laisser vide pour ne pas changer)" icon="business-outline" value={iban} onChangeText={(t) => setIban(t.toUpperCase())} autoCapitalize="characters" maxLength={42} />
              <Field label="BIC (facultatif)" icon="card-outline" value={bic} onChangeText={(t) => setBic(t.toUpperCase())} autoCapitalize="characters" maxLength={11} />
            </>
          )}
          <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? (showErrors && nothing ? "Renseignez au moins un nouveau numéro ou un IBAN." : null)} label="Code secret pour confirmer" />
          <View style={{ gap: 10 }}>
            <Button label="Confirmer le changement" loading={busy} disabled={pin.length !== 6} onPress={submit} />
            <Button label="Annuler" kind="ghost" onPress={() => { setOpen(false); setPin(""); setShowErrors(false); }} />
          </View>
        </View>
      )}
    </Card>
  );
}

export default function MerchantSettingsScreen() {
  const router = useRouter();
  const { data: me, status, error, refreshing, reload, refresh } = useLoader(() => api.getMerchantMe());
  // Un rechargement conserve les saisies : on ne remonte les formulaires qu'au changement de fiche.
  const [version, setVersion] = useState(0);

  if (status === "loading") return <Screen header={<NavBar onBack={() => router.back()} title="Réglages du commerce" />}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !me) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Réglages du commerce" />}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  if (!me.isMerchant || !me.profile) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Réglages du commerce" />}><Notice tone="warn">Activez d'abord votre espace marchand.</Notice></Screen>;
  }

  return (
    <Screen header={<NavBar onBack={() => router.back()} title="Réglages du commerce" />} refreshing={refreshing} onRefresh={refresh}>
      <Rise>
        <SectionHeader title="Mon commerce" style={{ marginTop: 4 }} />
        <ProfileForm key={`p-${me.profile.businessName}-${version}`} me={me} onSaved={() => { reload(); }} />
      </Rise>
      <Rise delay={100}>
        <SectionHeader title="Destination des retraits" />
        <DestinationForm key={`d-${me.profile.destinationChangedAt ?? "0"}`} me={me} onSaved={() => { setVersion((v) => v + 1); reload(); }} />
      </Rise>
    </Screen>
  );
}
