// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// BENEFICIARY DETAIL v6.1 — Direct Transf'air
// ✅ v6.1 : INDICATIF UNIQUE (audit) — le numéro enregistré commence par « + » : l'ancienne détection (startsWith sur l'indicatif sans « + ») ne trouvait jamais
//    le pays, laissait « +224622… » dans le champ, et chaque modification enregistrait « +224+224622… » (indicatif doublé, puis triplé aux modifications
//    suivantes). Désormais (utils/phone.ts) : le pays est reconnu, le champ ne garde que le numéro national, et l'enregistrement reconstruit
//    « +<indicatif><numéro national> » (indicatif répété et 0 de tête retirés — les numéros déjà doublés en base sont réparés à la prochaine modification).
// ✅ v6.0 : REFONTE THÈME CLAIR — fini le hero dégradé sombre : barre de navigation claire
//    (crayon / croix), avatar centré avec nom, localisation et téléphone, puis « Envoyer de
//    l'argent » en deux lignes à filet (Vers un wallet / Envoi d'argent), formulaire de
//    modification avec champs arrondis du design system, sélecteurs pays / ville / indicatif
//    dans des feuilles basses claires avec recherche (components/ui/ChoiceSheet), bouton
//    « Enregistrer » pilule collé en bas, « Supprimer le bénéficiaire » en zone discrète
//    rouge. États chargement / erreur / introuvable du design system (squelette, « Réessayer »).
//    Plus de vert/bleu/ambre écrits en dur ni de police serif / mono : tout suit la marque.
//    LOGIQUE INCHANGÉE (id depuis les paramètres, chargement borné 20 s avec withTimeout /
//    explainLoadError, rechargement au focus, hydrateForm avec détection de l'indicatif,
//    onSave → api.updateBeneficiary, onDelete avec confirmation → api.deleteBeneficiary,
//    goSendWallet / goSendCash vers /(tabs)/send avec les mêmes paramètres).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.3 : WHITE-LABEL + chargement BORNÉ (20 s) : état d'erreur + « Réessayer »
//    (plus de « introuvable » sur une simple erreur réseau).
// ✅ v5.2 : HERO sombre (remplacé en v6.0).
// ✅ v5.1 : fond blanc neutre, ombres neutres.
// ✅ v5.0 : Thème clair, voir / modifier / supprimer, actions rapides.
// =========================================================

import React, { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import { api } from "../../../services/api";
import type { Beneficiary, CreateBeneficiaryPayload } from "../../../services/types";
import { showAlert, showConfirm } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";
import { nationalOf, parseInternational, toE164 } from "../../../utils/phone";
import { citiesByCountry } from "../../../data/cities";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../../components/wallet/useLoader";
import {
  Avatar, Button, EmptyView, ErrorView, Field, IconButton, ListRow, NavBar, Pill, Screen, SectionHeader, SelectRow, SkeletonRows, UText, useUI,
} from "../../../components/ui";
import { ChoiceSheet } from "../../../components/ui/ChoiceSheet";

function getIdParam(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.id;
  if (typeof raw === "string") { const v = raw.trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  if (Array.isArray(raw)) { const v = (raw[0] ?? "").trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  return null;
}

export default function BeneficiaireDetailScreen() {
  const { C, R } = useUI();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = useMemo(() => getIdParam(params as any), [params]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [item, setItem] = useState<Beneficiary | null>(null);
  const [editing, setEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const hydrateForm = (b: Beneficiary) => {
    const parts = (b.fullName || "").split(" ");
    if (parts.length > 1) { setFirstName(parts.slice(0, -1).join(" ")); setLastName(parts[parts.length - 1]); }
    else { setFirstName(b.fullName || ""); setLastName(""); }
    const found = countriesList.find((c) => c.name === b.country);
    if (found) { setAddressCountry(found); if (!b.phone) setPhoneCountry(found); }
    setCity(b.city || "");
    if (b.phone) {
      const intl = parseInternational(`+${String(b.phone).replace(/\D/g, "")}`);
      if (intl && intl.national) { setPhoneCountry(intl.country); setPhoneNumber(intl.national); }
      else setPhoneNumber(String(b.phone));
    } else { setPhoneNumber(""); }
  };

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      setLoadError(null);
      const b = await withTimeout(api.getBeneficiary(id), defaultTimeoutMs());
      setItem(b); hydrateForm(b);
    } catch (e) { setLoadError(explainLoadError(e)); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setLoading(true); setEditing(false);
    void load();
    return () => {};
  }, [load]));

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && city.trim().length >= 2;

  const onSave = async () => {
    if (!id || !item || !canSave) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    let fullPhone: string | null = null;
    if (phoneNumber.trim().length > 0) {
      const dial = phoneCountry.dialCode.replace("+", "");
      fullPhone = toE164(dial, nationalOf(phoneNumber, dial));
    }
    try {
      setSaving(true);
      const updated = await api.updateBeneficiary(id, { fullName, country: addressCountry.name, city: city.trim(), phone: fullPhone } as Partial<CreateBeneficiaryPayload>);
      setItem(updated); hydrateForm(updated); setEditing(false);
    } catch { showAlert("Erreur", "Impossible de mettre à jour."); }
    finally { setSaving(false); }
  };

  const onDelete = () => {
    if (!id) return;
    showConfirm("Supprimer le bénéficiaire", "Cette action est irréversible. Confirmer ?", async () => {
      try {
        setDeleting(true);
        await api.deleteBeneficiary(id);
        showAlert("Supprimé", "Bénéficiaire supprimé.", () => router.back());
      } catch { showAlert("Erreur", "Impossible de supprimer (lié à une transaction ?)."); }
      finally { setDeleting(false); }
    });
  };

  const onCancelEdit = () => { if (item) hydrateForm(item); setEditing(false); };

  const goSendWallet = () => {
    if (!item?.phone) { showAlert("Info", "Ce bénéficiaire n'a pas de numéro enregistré."); return; }
    router.push({ pathname: "/(tabs)/send", params: { mode: "WALLET", phone: item.phone } });
  };
  const goSendCash = () => {
    router.push({ pathname: "/(tabs)/send", params: { mode: "CASH", beneficiaryId: item?.id } });
  };

  const availableCities: string[] = (citiesByCountry as any)[addressCountry.name] ?? (addressCountry as any).cities ?? [];

  const flagBubble = (flag: string) => (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
      <UText v="subheading">{flag}</UText>
    </View>
  );

  // ── États de secours ───────────────────────────────────
  if (loading) {
    return (
      <Screen header={<NavBar title="Bénéficiaire" onBack={() => router.back()} />}>
        <SkeletonRows rows={3} />
      </Screen>
    );
  }
  if (!item && loadError) {
    return (
      <Screen header={<NavBar title="Bénéficiaire" onBack={() => router.back()} />}>
        <ErrorView title={loadError.title} message={loadError.message} onRetry={() => { setLoading(true); void load(); }} />
      </Screen>
    );
  }
  if (!item) {
    return (
      <Screen header={<NavBar title="Bénéficiaire" onBack={() => router.back()} />}>
        <EmptyView icon="person-outline" title="Bénéficiaire introuvable" message="Ce contact n'existe plus ou a été supprimé." />
        <View style={{ marginTop: 16 }}>
          <Button label="Retour" kind="outline" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={
        <NavBar
          title="Bénéficiaire"
          onBack={() => router.back()}
          right={
            <IconButton
              icon={editing ? "close" : "pencil"}
              label={editing ? "Annuler la modification" : "Modifier le bénéficiaire"}
              onPress={() => (editing ? onCancelEdit() : setEditing(true))}
            />
          }
        />
      }
      footer={editing ? <Button label="Enregistrer" icon="save-outline" onPress={onSave} loading={saving} disabled={!canSave || saving} /> : undefined}
    >
      {/* Identité */}
      <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 18 }}>
        <Avatar name={item.fullName} size={76} />
        <UText v="title" align="center" style={{ marginTop: 12 }} numberOfLines={2}>{item.fullName}</UText>
        {!!(item.city || item.country) && (
          <UText v="caption" tone="muted" align="center" style={{ marginTop: 2 }}>
            {item.city}{item.country ? `${item.city ? ", " : ""}${item.country}` : ""}
          </UText>
        )}
        {!!item.phone && <Pill label={item.phone} tone="neutral" icon="call-outline" style={{ marginTop: 10 }} />}
      </View>

      {!editing ? (
        <>
          <SectionHeader title="Envoyer de l'argent" />
          <ListRow icon="wallet-outline" title="Vers un wallet" subtitle="Transfert direct Mobile Money" onPress={goSendWallet} />
          <ListRow icon="cash-outline" title="Envoi d'argent" subtitle="Retrait en agence" onPress={goSendCash} last />
        </>
      ) : (
        <>
          <SectionHeader title="Modifier les informations" style={{ marginBottom: 14 }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" autoCapitalize="words" editable={!saving} style={{ flex: 1 }} />
            <Field label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diallo" autoCapitalize="words" editable={!saving} style={{ flex: 1 }} />
          </View>
          <SelectRow label="Pays de résidence" value={addressCountry.name} prefix={addressCountry.flag} placeholder="Sélectionner…" onPress={() => setShowCountryModal(true)} />
          <SelectRow label="Ville" value={city} placeholder="Sélectionner…" icon="location-outline" onPress={() => setShowCityModal(true)} />

          <UText v="overline" tone="muted" style={{ marginBottom: 8, marginTop: 2 }}>Téléphone (Mobile Money)</UText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => setShowPhoneCodeModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Indicatif ${phoneCountry.dialCode}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 56, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.field }}
            >
              <UText v="subheading">{phoneCountry.flag}</UText>
              <UText v="bodyStrong">{phoneCountry.dialCode}</UText>
              <Ionicons name="chevron-down" size={16} color={C.muted} />
            </Pressable>
            <Field
              value={phoneNumber}
              onChangeText={(t) => {
                const intl = parseInternational(t);
                if (intl) { setPhoneCountry(intl.country); setPhoneNumber(intl.national); } else setPhoneNumber(t);
              }}
              placeholder="620 000 000"
              keyboardType="phone-pad"
              editable={!saving}
              style={{ flex: 1, marginBottom: 0 }}
            />
          </View>
        </>
      )}

      {/* Zone dangereuse */}
      <SectionHeader title="Zone dangereuse" style={{ marginTop: 28 }} />
      <ListRow
        icon="trash-outline"
        title={deleting ? "Suppression…" : "Supprimer le bénéficiaire"}
        subtitle="Action irréversible"
        danger
        chevron={false}
        last
        onPress={deleting ? undefined : onDelete}
      />
      <View style={{ height: 8 }} />

      {/* Feuilles de sélection */}
      <ChoiceSheet<CountryData>
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        title="Pays de résidence"
        items={countriesList}
        getKey={(c) => c.code}
        getLabel={(c) => c.name}
        getLeft={(c) => flagBubble(c.flag)}
        isSelected={(c) => addressCountry.code === c.code}
        onPick={(c) => { setAddressCountry(c); setPhoneCountry(c); setCity(""); }}
      />
      <ChoiceSheet<string>
        visible={showCityModal}
        onClose={() => setShowCityModal(false)}
        title={`Villes · ${addressCountry.name}`}
        items={availableCities.length > 0 ? availableCities : ["Autre"]}
        getKey={(c) => c}
        getLabel={(c) => c}
        isSelected={(c) => city === c}
        onPick={(c) => setCity(c)}
      />
      <ChoiceSheet<CountryData>
        visible={showPhoneCodeModal}
        onClose={() => setShowPhoneCodeModal(false)}
        title="Indicatif téléphonique"
        items={countriesList}
        getKey={(c) => c.code}
        getLabel={(c) => c.name}
        getLeft={(c) => flagBubble(c.flag)}
        getRight={(c) => c.dialCode}
        isSelected={(c) => phoneCountry.code === c.code}
        onPick={(c) => setPhoneCountry(c)}
      />
    </Screen>
  );
}
