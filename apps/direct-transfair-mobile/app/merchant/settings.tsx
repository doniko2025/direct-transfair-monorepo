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
import { LanguageRow } from "../../components/i18n/LanguageSwitcher";
import { useT } from "../../providers/I18nProvider";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";
import { ShopLogoSheet } from "../../components/merchant/ShopLogoSheet";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { OptionPicker } from "../../components/ui/OptionPicker";
import { MERCHANT_CATEGORIES, PinPrompt, Rise, apiProblem, categoryLabel, shortDateTime } from "../../components/merchant/merchantUi";
import { RCCM_EXAMPLE, normalizeRccm, validateRccm } from "../../utils/rccm";
import { RccmDocumentCard } from "../../components/merchant/RccmDocumentPicker";
import { BusinessInfoFields, type BusinessInfoValue } from "../../components/merchant/BusinessInfoFields";
import {
  cleanText, normalizeBusinessPhone, validateBusinessAddress, validateBusinessCity, validateBusinessPhone, validatePostalCode, validateTaxId,
} from "../../utils/businessInfo";
import { fixedDialFor, isOrangeMoneyCurrency, orangeHintFor, ORANGE_NOT_AVAILABLE_TEXT, validateOrangeFor } from "../../services/orangeRules";

function ProfileForm({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const t = useT();
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
      setMsg({ tone: "pos", text: t("mset.saved") });
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
          {t("mset.rccmRequired")}
        </Notice>
      )}
      {addressMissing && (
        <Notice tone="warn" icon="location-outline" style={{ marginBottom: 14 }}>
          {t("mset.addrMissing")}
        </Notice>
      )}
      <Field label={t("mset.shopName")} icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
      <Field
        label={t("mset.rccm")} icon="document-text-outline" value={rccm} onChangeText={setRccm} autoCapitalize="characters" maxLength={40}
        editable={!rccmLocked} placeholder={RCCM_EXAMPLE} error={rccmError}
        hint={rccmLocked ? t("mset.rccmLocked") : t("mset.rccmHint")}
      />
      <OptionPicker label={t("mset.category")} title={t("mset.categoryTitle")} icon="pricetag-outline" value={category} options={categories.map((c) => ({ key: c, label: categoryLabel(c) }))} onChange={setCategory} placeholder={t("mset.categoryPh")} />
      <BusinessInfoFields value={info} onChange={patchInfo} errors={infoErrors} />
      <Button label={t("common.save")} disabled={!dirty || name.trim().length < 2} loading={busy} onPress={save} />
    </Card>
  );
}

function LogoCard({ me, onChanged }: { me: MerchantMe; onChanged: () => void }) {
  const t = useT();
  const profile = me.profile!;
  const [open, setOpen] = useState(false);
  return (
    <Card pad={18}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ShopAvatar shopId={profile.shopId} version={profile.logoVersion} name={profile.businessName} size={64} />
        <View style={{ flex: 1 }}>
          <UText v="bodyStrong">{profile.logoVersion ? t("mset.logoTitle") : t("mset.noLogo")}</UText>
          <UText v="caption" tone="muted">{t("mset.logoInfo")}</UText>
        </View>
      </View>
      <Button label={profile.logoVersion ? t("mset.logoChange") : t("mset.logoAdd")} icon="image-outline" kind="outline" small full={false} onPress={() => setOpen(true)} style={{ marginTop: 14 }} />
      <ShopLogoSheet visible={open} onClose={() => setOpen(false)} shopId={profile.shopId} hasLogo={!!profile.logoVersion} onChanged={onChanged} />
    </Card>
  );
}

function AlertsCard({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const t = useT();
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
      setMsg({ tone: "pos", text: t("mset.alertsSaved") });
      onSaved();
    } catch (e) { setMsg({ tone: "danger", text: apiProblem(e).message }); }
    finally { setBusy(false); }
  };

  return (
    <Card pad={20}>
      {msg && <Notice tone={msg.tone} style={{ marginBottom: 14 }}>{msg.text}</Notice>}
      <Field
        label={t("mset.lowBalance", { currency })}
        icon="notifications-outline" value={threshold} keyboardType="number-pad"
        onChangeText={(v) => setThreshold(v.replace(/[^0-9]/g, ""))}
        hint={t("mset.lowBalanceHint")}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <UText v="bodyStrong">{t("mset.failures")}</UText>
          <UText v="caption" tone="muted">{t("mset.failuresInfo")}</UText>
        </View>
        <Toggle value={failures} onValueChange={setFailures} />
      </View>
      <Button label={t("mset.saveAlerts")} disabled={!dirty} loading={busy} onPress={save} />
    </Card>
  );
}

function DestinationForm({ me, onSaved }: { me: MerchantMe; onSaved: () => void }) {
  const t = useT();
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
  const holderError = showErrors && wantsBank && holder.trim().length < 2 ? t("mset.holderRequired") : null;
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
      setMsg({ tone: "pos", text: t("mset.destSaved") });
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
          {t("mset.orangeMismatch", { currency })}{orangeAllowed ? "" : t("mset.orInstead")}
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
          <UText v="caption" tone="muted">{t("mset.bankAccount")}</UText>
          <UText v="bodyStrong">{profile.bank ? `${profile.bank.holderName ?? ""} · ${profile.bank.ibanMasked}` : t("mset.notSet")}</UText>
        </>
      )}
      {profile.destinationChangedAt && (
        <UText v="caption" tone="muted" style={{ marginTop: 10 }}>{t("mset.lastChange", { date: shortDateTime(profile.destinationChangedAt) })}</UText>
      )}

      {!open ? (
        <Button label={t("mset.changeDest")} kind="outline" icon="create-outline" onPress={() => setOpen(true)} style={{ marginTop: 16 }} />
      ) : (
        <View style={{ marginTop: 18 }}>
          <Notice tone="warn" style={{ marginBottom: 16 }}>
            {t("mset.secNotice", { hours: me.settings.payoutCooldownHours })}
          </Notice>
          {orangeAllowed && (
            <PhoneField
              country={dialCountry}
              onCountryChange={(c) => { if (!fixedDialFor(currency) || c.dial === fixedDialFor(currency)) setCountry(c); }}
              value={phone}
              onChangeText={setPhone}
              error={phoneError}
              hint={t("mset.newOrange", { hint: orangeHintFor(currency) })}
              accent={C.accent}
            />
          )}
          {bankEnabled && (
            <>
              <Field label={t("mset.holder")} icon="person-outline" value={holder} onChangeText={setHolder} autoCapitalize="words" error={holderError} />
              <Field label={t("mset.iban")} icon="business-outline" value={iban} onChangeText={(v) => setIban(v.toUpperCase())} autoCapitalize="characters" maxLength={42} />
              <Field label={t("mset.bic")} icon="card-outline" value={bic} onChangeText={(v) => setBic(v.toUpperCase())} autoCapitalize="characters" maxLength={11} />
            </>
          )}
          <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError ?? (showErrors && nothing ? (orangeAllowed ? t("mset.needOne") : t("mset.needIban")) : null)} label={t("mpo.pinLabel")} />
          <View style={{ gap: 10 }}>
            <Button label={t("mset.confirmChange")} loading={busy} disabled={pin.length !== 6} onPress={submit} />
            <Button label={t("common.cancel")} kind="ghost" onPress={() => { setOpen(false); setPin(""); setShowErrors(false); }} />
          </View>
        </View>
      )}
    </Card>
  );
}

export default function MerchantSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me, status, error, refreshing, reload, refresh } = useLoader(() => api.getMerchantMe());
  const go = (path: string) => router.push(path as any);
  // Un rechargement conserve les saisies : on ne remonte les formulaires qu'au changement de fiche.
  const [version, setVersion] = useState(0);

  const hdr = <NavBar onBack={() => router.back()} title={t("mset.title")} />;
  if (status === "loading") return <Screen header={hdr}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !me) {
    return <Screen header={hdr}><ErrorView title={error?.title ?? t("mx.error")} message={error?.message ?? t("mx.loadFail")} onRetry={reload} /></Screen>;
  }
  if (!me.isMerchant || !me.profile) {
    return <Screen header={hdr}><Notice tone="warn">{t("mset.activateFirst")}</Notice></Screen>;
  }

  return (
    <Screen header={hdr} refreshing={refreshing} onRefresh={refresh}>
      <Rise>
        <SectionHeader title={t("mset.secMyShop")} style={{ marginTop: 4 }} />
        <ProfileForm key={`p-${me.profile.businessName}-${version}`} me={me} onSaved={() => { reload(); }} />
      </Rise>
      <Rise delay={40}>
        <SectionHeader title={t("mset.secProof")} />
        <RccmDocumentCard me={me} onChanged={reload} />
      </Rise>
      <Rise delay={60}>
        <SectionHeader title={t("mset.secLogo")} />
        <LogoCard me={me} onChanged={reload} />
      </Rise>
      <Rise delay={80}>
        <SectionHeader title={t('lang.title')} />
        <Group>
          <LanguageRow last />
        </Group>

        <SectionHeader title={t("mset.secTools")} />
        <Group>
          <ListRow icon="qr-code-outline" title={t("mset.toolQr")} subtitle={t("mset.toolQrSub")} onPress={() => go("/merchant/qr")} />
          <ListRow icon="people-outline" title={t("mset.toolStaff")} subtitle={t("mset.toolStaffSub")} onPress={() => go("/merchant/staff")} />
          <ListRow icon="lock-closed-outline" title={t("mset.toolClosing")} subtitle={t("mset.toolClosingSub")} onPress={() => go("/merchant/closing")} last />
        </Group>
      </Rise>
      <Rise delay={90}>
        <SectionHeader title={t("mset.secAlerts")} />
        <AlertsCard key={`a-${me.profile.alerts?.lowBalanceThreshold ?? "x"}-${me.profile.alerts?.failureAlertsEnabled ?? "y"}`} me={me} onSaved={reload} />
      </Rise>
      <Rise delay={100}>
        <SectionHeader title={t("mset.secDest")} />
        <DestinationForm key={`d-${me.profile.destinationChangedAt ?? "0"}`} me={me} onSaved={() => { setVersion((v) => v + 1); reload(); }} />
      </Rise>
    </Screen>
  );
}
