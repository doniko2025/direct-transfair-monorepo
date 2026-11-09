// apps/direct-transfair-mobile/app/merchant/settings.tsx
// =========================================================
// RÉGLAGES DU COMMERCE v1.0 — Lot 11
// • Fiche du commerce (nom, catégorie, adresse, quartier, ville, code postal facultatif, pays, téléphone du commerce, NIF / IFU) : modifiable librement.
//   Ces coordonnées sont celles du COMMERCE, indépendantes de l'adresse personnelle du client (comptes client et marchand isolés).
// • Destination des retraits (Orange Money, IBAN) : modifiable UNIQUEMENT avec le code secret ; après un changement,
//   les retraits sont suspendus quelques heures (réglage de la société) pour bloquer un détournement de compte.
// • Lot 13 : logo du commerce, alertes (solde bas, échecs de paiement répétés), raccourcis QR de caisse / équipe / clôture.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { MerchantMe } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { Button, Card, ErrorView, Field, NavBar, Notice, Screen, SectionHeader, SkeletonRows, Toggle, UText, useUI } from "../../components/ui";
import { Group, ListRow } from "../../components/ui/Layout";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";
import { ShopLogoSheet } from "../../components/merchant/ShopLogoSheet";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { OptionPicker } from "../../components/ui/OptionPicker";
import { MERCHANT_CATEGORIES, PinPrompt, Rise, apiProblem, shortDateTime } from "../../components/merchant/merchantUi";
import { RCCM_EXAMPLE, normalizeRccm, validateRccm } from "../../utils/rccm";
import { BusinessInfoFields, type BusinessInfoValue } from "../../components/merchant/BusinessInfoFields";
import {
  cleanText, normalizeBusinessPhone, validateBusinessAddress, validateBusinessCity, validateBusinessPhone, validatePostalCode, validateTaxId,
} from "../../utils/businessInfo";
import { fixedDialFor, isOrangeMoneyCurrency, orangeHintFor, ORANGE_NOT_AVAILABLE_TEXT, validateOrangeFor } from "../../services/orangeRules";

function ProfileForm({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const profile = me.profile!;
  const [name, setName] = useState(profile.businessName);
  const [category, setCategory] = useState<string | null>(profile.category);
  const initialInfo: BusinessInfoValue = {
    address: profile.address ?? "",
    district: profile.district ?? "",
    city: profile.city ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country ?? null,
    phone: profile.businessPhone ?? "",
    taxId: profile.taxId ?? "",
  };
  const [info, setInfo] = useState<BusinessInfoValue>(initialInfo);
  const patchInfo = (patch: Partial<BusinessInfoValue>) => setInfo((v) => ({ ...v, ...patch }));
  // RCCM : obligatoire à l'ouverture d'un compte. Un compte plus ancien peut ne pas l'avoir : on le demande ici. Une fois
  // renseigné, il n'est plus modifiable depuis l'application (changement via le support).
  const rccmLocked = !!profile.rccm;
  const [rccm, setRccm] = useState(profile.rccm ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);
  const categories = me.categories.length ? me.categories : MERCHANT_CATEGORIES;

  // Comptes créés avant que l'adresse ne soit demandée : on les invite à compléter leur fiche (sans les bloquer).
  const addressMissing = !profile.address || !profile.city;
  const rccmError = showErrors && !rccmLocked ? validateRccm(rccm) : null;
  const rccmToSave = !rccmLocked && rccm.trim().length > 0;

  // Champs modifiés (seuls ceux-là sont envoyés : un ancien compte sans adresse peut ainsi changer son nom librement).
  const changed: Record<string, string> = {};
  if (name.trim() !== profile.businessName) changed.businessName = name.trim();
  if ((category ?? "") !== (profile.category ?? "") && category) changed.category = category;
  if (cleanText(info.address) !== (profile.address ?? "")) changed.address = cleanText(info.address);
  if (cleanText(info.city) !== (profile.city ?? "")) changed.city = cleanText(info.city);
  if (cleanText(info.district) !== (profile.district ?? "")) changed.district = cleanText(info.district);
  if (cleanText(info.postalCode).toUpperCase() !== (profile.postalCode ?? "")) changed.postalCode = cleanText(info.postalCode).toUpperCase();
  if ((info.country ?? "") !== (profile.country ?? "")) changed.country = info.country ?? "";
  if (normalizeBusinessPhone(info.phone) !== (profile.businessPhone ?? "")) changed.businessPhone = normalizeBusinessPhone(info.phone);
  if (cleanText(info.taxId).toUpperCase() !== (profile.taxId ?? "")) changed.taxId = cleanText(info.taxId).toUpperCase();
  if (rccmToSave) changed.rccm = normalizeRccm(rccm);
  const dirty = Object.keys(changed).length > 0;

  const infoErrors = showErrors
    ? {
        // L'adresse et la ville ne se vident pas : on ne les contrôle que si elles ont été touchées (ou déjà renseignées).
        address: "address" in changed || profile.address ? validateBusinessAddress(info.address) : null,
        city: "city" in changed || profile.city ? validateBusinessCity(info.city) : null,
        postalCode: validatePostalCode(info.postalCode), phone: validateBusinessPhone(info.phone), taxId: validateTaxId(info.taxId),
      }
    : {};

  const save = async () => {
    setShowErrors(true);
    if (rccmToSave && validateRccm(rccm)) return;
    if (("address" in changed || profile.address) && validateBusinessAddress(info.address)) return;
    if (("city" in changed || profile.city) && validateBusinessCity(info.city)) return;
    if (validatePostalCode(info.postalCode) || validateBusinessPhone(info.phone) || validateTaxId(info.taxId)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.updateMerchantProfile(changed);
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
      {!rccmLocked && (
        <Notice tone="warn" icon="document-text-outline" style={{ marginBottom: 14 }}>
          Le numéro RCCM est désormais obligatoire pour les comptes marchands. Renseignez-le pour mettre votre fiche en règle.
        </Notice>
      )}
      {addressMissing && (
        <Notice tone="warn" icon="location-outline" style={{ marginBottom: 14 }}>
          Complétez l'adresse et la ville de votre commerce pour mettre votre fiche en règle.
        </Notice>
      )}
      <Field label="Nom du commerce" icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
      <Field
        label="Numéro RCCM" icon="document-text-outline" value={rccm} onChangeText={setRccm} autoCapitalize="characters" maxLength={40}
        editable={!rccmLocked} placeholder={RCCM_EXAMPLE} error={rccmError}
        hint={rccmLocked ? "Pour modifier ce numéro, contactez le support." : "Registre du Commerce et du Crédit Mobilier."}
      />
      <OptionPicker label="Catégorie" title="Catégorie du commerce" icon="pricetag-outline" value={category} options={categories.map((c) => ({ key: c, label: c }))} onChange={setCategory} placeholder="Choisir une catégorie" />
      <BusinessInfoFields value={info} onChange={patchInfo} errors={infoErrors} />
      <Button label="Enregistrer" disabled={!dirty || name.trim().length < 2} loading={busy} onPress={save} />
    </Card>
  );
}

function LogoCard({ me, onChanged }: { me: MerchantMe; onChanged: () => void }) {
  const profile = me.profile!;
  const [open, setOpen] = useState(false);
  return (
    <Card pad={18}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ShopAvatar shopId={profile.shopId} version={profile.logoVersion} name={profile.businessName} size={64} />
        <View style={{ flex: 1 }}>
          <UText v="bodyStrong">{profile.logoVersion ? "Logo du commerce" : "Aucun logo"}</UText>
          <UText v="caption" tone="muted">Visible par vos clients au moment de payer, sur les reçus et sur l'affiche du QR de caisse.</UText>
        </View>
      </View>
      <Button label={profile.logoVersion ? "Changer le logo" : "Ajouter un logo"} icon="image-outline" kind="outline" small full={false} onPress={() => setOpen(true)} style={{ marginTop: 14 }} />
      <ShopLogoSheet visible={open} onClose={() => setOpen(false)} shopId={profile.shopId} hasLogo={!!profile.logoVersion} onChanged={onChanged} />
    </Card>
  );
}

function AlertsCard({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const profile = me.profile!;
  const currency = me.currency ?? "XOF";
  const [threshold, setThreshold] = useState(profile.alerts?.lowBalanceThreshold ? String(profile.alerts.lowBalanceThreshold) : "");
  const [failures, setFailures] = useState(profile.alerts?.failureAlertsEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);

  const current = profile.alerts?.lowBalanceThreshold ? String(profile.alerts.lowBalanceThreshold) : "";
  const dirty = threshold !== current || failures !== (profile.alerts?.failureAlertsEnabled ?? true);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const n = Number(threshold);
      await api.updateMerchantAlerts({ lowBalanceThreshold: threshold.trim() && n > 0 ? n : null, failureAlertsEnabled: failures });
      setMsg({ tone: "pos", text: "Alertes enregistrées." });
      onSaved();
    } catch (e) { setMsg({ tone: "danger", text: apiProblem(e).message }); }
    finally { setBusy(false); }
  };

  return (
    <Card pad={20}>
      {msg && <Notice tone={msg.tone} style={{ marginBottom: 14 }}>{msg.text}</Notice>}
      <Field
        label={`Prévenez-moi si le solde disponible passe sous (${currency})`}
        icon="notifications-outline" value={threshold} keyboardType="number-pad"
        onChangeText={(t) => setThreshold(t.replace(/[^0-9]/g, ""))}
        hint="Laissez vide pour désactiver. Une seule alerte, réarmée quand le solde remonte."
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <UText v="bodyStrong">Échecs de paiement répétés</UText>
          <UText v="caption" tone="muted">Alerte si plusieurs paiements échouent en peu de temps (solde client insuffisant, code erroné…).</UText>
        </View>
        <Toggle value={failures} onValueChange={setFailures} />
      </View>
      <Button label="Enregistrer les alertes" disabled={!dirty} loading={busy} onPress={save} />
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

  const currency = me.currency ?? "XOF";
  const orangeAllowed = me.orangeMoneyAllowed ?? isOrangeMoneyCurrency(currency);
  const dialCountry = currency === "GNF" ? findCountry("Guinée") ?? country : country;
  const fullPhone = `${dialCountry.dial}${normalizeNationalNumber(phone)}`;
  const wantsPhone = orangeAllowed && phone.trim().length > 0;
  const wantsBank = bankEnabled && iban.trim().length > 0;
  const phoneProblem = (): string | null => (wantsPhone ? validatePhone(phone) ?? validateOrangeFor(fullPhone, currency) : null);
  const phoneError = showErrors ? phoneProblem() : null;
  const holderError = showErrors && wantsBank && holder.trim().length < 2 ? "Saisissez le titulaire du compte." : null;
  const nothing = !wantsPhone && !wantsBank;

  const submit = async () => {
    setShowErrors(true);
    setMsg(null);
    if (nothing || pin.length !== 6) return;
    if (phoneProblem() || (wantsBank && holder.trim().length < 2)) return;
    setBusy(true);
    try {
      await api.changeMerchantDestination({
        pin,
        ...(wantsPhone ? { orangeMoneyPhone: fullPhone } : {}),
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
      {me.orangeNeedsUpdate && (
        <Notice tone="warn" style={{ marginBottom: 14 }}>
          Votre numéro Orange Money ne correspond pas à la devise de votre compte ({currency}). Enregistrez un numéro valide pour pouvoir retirer vos gains{orangeAllowed ? "" : " — ou utilisez un compte bancaire (IBAN)"}.
        </Notice>
      )}
      {orangeAllowed ? (
        <>
          <UText v="caption" tone="muted">Orange Money</UText>
          <UText v="bodyStrong" style={{ marginBottom: 12 }}>{profile.orangeMoneyMasked}</UText>
        </>
      ) : (
        <Notice tone="info" style={{ marginBottom: 14 }}>{ORANGE_NOT_AVAILABLE_TEXT(currency)}</Notice>
      )}
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
          {orangeAllowed && (
            <PhoneField
              country={dialCountry}
              onCountryChange={(c) => { if (!fixedDialFor(currency) || c.dial === fixedDialFor(currency)) setCountry(c); }}
              value={phone}
              onChangeText={setPhone}
              error={phoneError}
              hint={`Nouveau numéro Orange Money (laisser vide pour le conserver). ${orangeHintFor(currency)}`}
              accent={C.accent}
            />
          )}
          {bankEnabled && (
            <>
              <Field label="Titulaire du compte bancaire" icon="person-outline" value={holder} onChangeText={setHolder} autoCapitalize="words" error={holderError} />
              <Field label="IBAN (laisser vide pour ne pas changer)" icon="business-outline" value={iban} onChangeText={(t) => setIban(t.toUpperCase())} autoCapitalize="characters" maxLength={42} />
              <Field label="BIC (facultatif)" icon="card-outline" value={bic} onChangeText={(t) => setBic(t.toUpperCase())} autoCapitalize="characters" maxLength={11} />
            </>
          )}
          <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? (showErrors && nothing ? (orangeAllowed ? "Renseignez au moins un nouveau numéro ou un IBAN." : "Renseignez votre IBAN.") : null)} label="Code secret pour confirmer" />
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
  const go = (path: string) => router.push(path as any);
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
      <Rise delay={60}>
        <SectionHeader title="Logo" />
        <LogoCard me={me} onChanged={reload} />
      </Rise>
      <Rise delay={80}>
        <SectionHeader title="Outils de caisse" />
        <Group>
          <ListRow icon="qr-code-outline" title="QR de caisse permanent" subtitle="À afficher ou imprimer au comptoir" onPress={() => go("/merchant/qr")} />
          <ListRow icon="people-outline" title="Équipe de caisse" subtitle="Caissiers et droits (remboursement, plafond)" onPress={() => go("/merchant/staff")} />
          <ListRow icon="lock-closed-outline" title="Clôture & exports" subtitle="Fin de journée, PDF et CSV" onPress={() => go("/merchant/closing")} last />
        </Group>
      </Rise>
      <Rise delay={90}>
        <SectionHeader title="Alertes" />
        <AlertsCard key={`a-${me.profile.alerts?.lowBalanceThreshold ?? "x"}-${me.profile.alerts?.failureAlertsEnabled ?? "y"}`} me={me} onSaved={reload} />
      </Rise>
      <Rise delay={100}>
        <SectionHeader title="Destination des retraits" />
        <DestinationForm key={`d-${me.profile.destinationChangedAt ?? "0"}`} me={me} onSaved={() => { setVersion((v) => v + 1); reload(); }} />
      </Rise>
    </Screen>
  );
}
