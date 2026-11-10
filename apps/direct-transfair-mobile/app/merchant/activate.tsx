// apps/direct-transfair-mobile/app/merchant/activate.tsx
// =========================================================
// ACTIVER L'ESPACE MARCHAND v1.0 — Lot 11
// Pour un client qui a déjà un compte : nom du commerce, catégorie, adresse du commerce (code postal facultatif), numéro Orange Money de
// retrait, puis code secret.
// ✅ Compte marchand ≠ compte client : l'adresse, la ville et le téléphone du commerce sont saisis ici et ne sont JAMAIS repris
//    (ni préremplis) depuis l'adresse ou la ville personnelles du client.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Button, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { OptionPicker } from "../../components/ui/OptionPicker";
import { RCCM_EXAMPLE, normalizeRccm, validateRccm } from "../../utils/rccm";
import { BusinessInfoFields, EMPTY_BUSINESS_INFO, type BusinessInfoValue } from "../../components/merchant/BusinessInfoFields";
import {
  cleanText, normalizeBusinessPhone, validateBusinessAddress, validateBusinessCity, validateBusinessPhone, validatePostalCode, validateTaxId,
} from "../../utils/businessInfo";
import { RccmDocumentPicker, type RccmPick } from "../../components/merchant/RccmDocumentPicker";
import { MERCHANT_CATEGORIES, PinPrompt, Rise, apiProblem } from "../../components/merchant/merchantUi";
import { accountCurrencyForCountry, fixedDialFor, isOrangeMoneyCurrency, orangeHintFor, ORANGE_NOT_AVAILABLE_TEXT, validateOrangeFor } from "../../services/orangeRules";

export default function ActivateMerchantScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { C } = useUI();
  const [name, setName] = useState("");
  const [rccm, setRccm] = useState("");
  const [rccmDoc, setRccmDoc] = useState<RccmPick | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  // Coordonnées du COMMERCE : volontairement vides au départ (pas de reprise de la ville ou de l'adresse personnelles du client).
  const [info, setInfo] = useState<BusinessInfoValue>(EMPTY_BUSINESS_INFO);
  const patchInfo = (patch: Partial<BusinessInfoValue>) => setInfo((v) => ({ ...v, ...patch }));
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
  const rccmError = showErrors ? validateRccm(rccm) : null;
  const catError = showErrors && !category ? "Choisissez une catégorie." : null;
  // Devise du compte : décide si Orange Money existe et quel numéro est exigé (GNF → guinéen, XOF → zone CFA, EUR… → aucun).
  const currency = me.currency ?? accountCurrencyForCountry(user?.country);
  const orangeAllowed = me.orangeMoneyAllowed ?? isOrangeMoneyCurrency(currency);
  const dialCountry = currency === "GNF" ? findCountry("Guinée") ?? country : country;
  const fullPhone = `${dialCountry.dial}${normalizeNationalNumber(phone)}`;
  const phoneProblem = (): string | null => (orangeAllowed ? validatePhone(phone) ?? validateOrangeFor(fullPhone, currency) : null);
  const phoneError = showErrors ? phoneProblem() : null;
  const infoErrors = showErrors
    ? {
        address: validateBusinessAddress(info.address), city: validateBusinessCity(info.city), postalCode: validatePostalCode(info.postalCode),
        phone: validateBusinessPhone(info.phone), taxId: validateTaxId(info.taxId),
      }
    : {};
  const infoInvalid = !!(validateBusinessAddress(info.address) || validateBusinessCity(info.city) || validatePostalCode(info.postalCode) || validateBusinessPhone(info.phone) || validateTaxId(info.taxId));

  const submit = async () => {
    setShowErrors(true);
    setProblem(null);
    if (name.trim().length < 2 || validateRccm(rccm) || !category || infoInvalid || phoneProblem() || pin.length !== 6) return;
    setBusy(true);
    try {
      await api.activateMerchant({
        businessName: name.trim(),
        rccm: normalizeRccm(rccm),
        category,
        address: cleanText(info.address),
        city: cleanText(info.city),
        ...(cleanText(info.district) ? { district: cleanText(info.district) } : {}),
        ...(cleanText(info.postalCode) ? { postalCode: cleanText(info.postalCode).toUpperCase() } : {}),
        ...(info.country ? { country: info.country } : {}),
        ...(cleanText(info.phone) ? { businessPhone: normalizeBusinessPhone(info.phone) } : {}),
        ...(cleanText(info.taxId) ? { taxId: cleanText(info.taxId).toUpperCase() } : {}),
        ...(orangeAllowed ? { orangeMoneyPhone: fullPhone } : {}),
        pin,
      });
      // Pièce justificative : envoyée une fois le compte créé. Un échec ne bloque pas l'activation (renvoi possible dans les réglages).
      if (rccmDoc) {
        try { await api.saveMerchantRccmDocument(rccmDoc.base64); }
        catch { Alert.alert("Document non envoyé", "Votre espace marchand est activé, mais le document RCCM n'a pas pu être envoyé. Vous pourrez le renvoyer depuis les réglages du commerce."); }
      }
      try { await refreshUser?.(); } catch { /* sans incidence */ }
      router.replace("/merchant" as any);
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else setProblem(pr.message); // inclut « RCCM obligatoire / invalide / déjà utilisé » renvoyés par le serveur
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
        <Field
          label="Numéro RCCM" icon="document-text-outline" value={rccm} onChangeText={setRccm} autoCapitalize="characters" maxLength={40}
          placeholder={RCCM_EXAMPLE} error={rccmError}
          hint="Registre du Commerce et du Crédit Mobilier : obligatoire pour ouvrir un compte marchand."
        />
        <RccmDocumentPicker value={rccmDoc} onChange={setRccmDoc} disabled={busy} />
        <OptionPicker label="Catégorie" title="Catégorie du commerce" icon="pricetag-outline" value={category} options={categories.map((c) => ({ key: c, label: c }))} onChange={setCategory} placeholder="Choisir une catégorie" error={catError} />
        <BusinessInfoFields value={info} onChange={patchInfo} errors={infoErrors} />
        {orangeAllowed ? (
          <PhoneField
            country={dialCountry}
            onCountryChange={(c) => { if (!fixedDialFor(currency) || c.dial === fixedDialFor(currency)) setCountry(c); }}
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
            hint={`Numéro où seront versés vos retraits. ${orangeHintFor(currency)}`}
            accent={C.accent}
          />
        ) : (
          <Notice tone="warn" style={{ marginBottom: 14 }}>{ORANGE_NOT_AVAILABLE_TEXT(currency)}</Notice>
        )}
        <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? (showErrors && pin.length !== 6 ? "Saisissez votre code secret à 6 chiffres." : null)} label="Code secret pour confirmer" />
      </Rise>
    </Screen>
  );
}
