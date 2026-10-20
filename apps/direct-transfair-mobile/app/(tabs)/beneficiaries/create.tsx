// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/create.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// BENEFICIARY CREATE v7.1 — Direct Transf'air
// ✅ v7.1 : FIX « Impossible d'accéder aux contacts — Method getContactsAsync … is deprecated » : expo-contacts 56 a une nouvelle API par classes ;
//    on garde l'API historique (mêmes fonctions) via « expo-contacts/legacy ». Aucune autre modification.
// ✅ v7.0 : REFONTE THÈME CLAIR — fini le hero dégradé sombre : barre de navigation claire
//    (« Nouveau contact », « X/3 étapes »), trois segments de progression aux couleurs de la
//    société, bouton « Importer depuis mes contacts » en carte, trois sections (Identité,
//    Localisation, Téléphone) avec champs arrondis du design system, aperçu du contact avec
//    avatar beige, sélecteurs pays / ville / indicatif et liste des contacts du téléphone
//    dans des feuilles basses claires avec recherche, bouton « Ajouter le contact » pilule
//    collé en bas. Plus de vert/bleu écrits en dur ni de police serif / mono : tout suit la
//    marque du tenant. Les trois sélecteurs partagent le composant components/ui/ChoiceSheet.
//    Liste des contacts du téléphone plafonnée à 120 lignes affichées (invitation à
//    affiner la recherche) pour rester fluide avec un grand répertoire.
//    LOGIQUE INCHANGÉE (openPhoneContacts avec message d'erreur détaillé, handleSelectContact
//    avec détection de l'indicatif, validation nom / prénom / ville ≥ 2 caractères,
//    anti-doublon nom ou téléphone via api.getBeneficiaries, api.createBeneficiary,
//    nettoyage du 0 initial du numéro, pays d'adresse → indicatif et ville réinitialisée).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.5 : WHITE-LABEL — couleurs vertes suivent la marque du tenant.
// ✅ v6.4 : HERO sombre (remplacé en v6.0 → v7.0).
// ✅ v6.3 : Diagnostic de l'erreur « Impossible d'accéder aux contacts » — le message réel
//   (e?.message) est affiché dans l'Alert + loggé en console.
//   ⚠️ À vérifier dans app.json : plugin "expo-contacts" présent, et reconstruction du build
//   natif (eas build / expo prebuild --clean) après son ajout.
// ✅ v6.2 : anti-doublon, fix cadre bleu focus web.
// =========================================================

import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import * as Contacts from "expo-contacts/legacy";
import { api } from "../../../services/api";
import { showAlert } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";
import { citiesByCountry } from "../../../data/cities";
import {
  Avatar, Button, Card, EmptyView, Field, ListRow, NavBar, Screen, SearchPill, SectionHeader, SelectRow, Sheet, UText, useUI,
} from "../../../components/ui";
import { ChoiceSheet } from "../../../components/ui/ChoiceSheet";

const MAX_CONTACT_ROWS = 120;

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").toLowerCase();
}

// ─── Écran ───────────────────────────────────────────────
export default function BeneficiaryCreateScreen() {
  const { C, R } = useUI();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2 && city.trim().length >= 2;
  const availableCities: string[] = (citiesByCountry as any)[addressCountry.name] ?? [];
  const progress = [
    firstName.trim().length >= 2 && lastName.trim().length >= 2,
    city.trim().length >= 2,
    phoneNumber.trim().length > 0,
  ];
  const doneCount = progress.filter(Boolean).length;

  // ✅ v6.3 : le message d'erreur réel est exposé (console + Alert) pour le diagnostic.
  const openPhoneContacts = async () => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez l'accès aux contacts dans les paramètres.", [{ text: "OK" }]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      setPhoneContacts(data.filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0));
      setShowContactsModal(true);
    } catch (e: any) {
      console.error("[openPhoneContacts] erreur détaillée :", e);
      const detail = e?.message ? `\n\nDétail technique : ${e.message}` : "";
      Alert.alert("Erreur", `Impossible d'accéder aux contacts.${detail}`);
    } finally { setLoadingContacts(false); }
  };

  const handleSelectContact = (contact: any) => {
    setFirstName(contact.firstName || "");
    setLastName(contact.lastName || "");
    const rawPhone = contact.phoneNumbers?.[0]?.number ?? "";
    const cleaned = rawPhone.replace(/[\s\-\(\)]/g, "");
    const sorted = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const match = sorted.find((c) => cleaned.startsWith(c.dialCode));
    if (match) { setPhoneCountry(match); setPhoneNumber(cleaned.replace(match.dialCode, "")); }
    else setPhoneNumber(cleaned);
    setShowContactsModal(false); setContactSearch("");
  };

  const filteredContacts = phoneContacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const s = contactSearch.toLowerCase();
    return `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(s) || (c.phoneNumbers?.[0]?.number ?? "").includes(s);
  });

  const handleCreate = async () => {
    if (!canSubmit) { showAlert("Validation", "Veuillez remplir le nom, le prénom et la ville."); return; }
    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      let fullPhone: string | null = null;
      if (phoneNumber.trim().length > 0) {
        const dial = phoneCountry.dialCode.replace("+", "");
        const num = phoneNumber.trim().replace(/^0+/, "");
        fullPhone = `+${dial}${num}`;
      }
      const existing = await api.getBeneficiaries();
      const duplicate = existing.find((b) => {
        const sameName = (b.fullName ?? "").trim().toLowerCase() === fullName.toLowerCase();
        const samePhone = fullPhone && b.phone && normalizePhone(b.phone) === normalizePhone(fullPhone);
        return sameName || !!samePhone;
      });
      if (duplicate) {
        showAlert("Contact déjà existant", `"${duplicate.fullName}" est déjà dans vos contacts${duplicate.phone ? ` (${duplicate.phone})` : ""}.`);
        setSubmitting(false); return;
      }
      await api.createBeneficiary({ fullName, country: addressCountry.name, city: city.trim(), phone: fullPhone });
      showAlert("✅ Ajouté", "Contact ajouté avec succès.", () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de la création.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setSubmitting(false); }
  };

  const flagBubble = (flag: string) => (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
      <UText v="subheading">{flag}</UText>
    </View>
  );

  return (
    <Screen
      keyboard
      header={<NavBar title="Nouveau contact" subtitle={`${doneCount}/3 étapes complétées`} onBack={() => router.back()} />}
      footer={
        <Button
          label="Ajouter le contact"
          icon="person-add-outline"
          onPress={handleCreate}
          loading={submitting}
          disabled={!canSubmit || submitting}
        />
      }
    >
      {/* Progression */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
        {progress.map((done, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: done ? C.accent : C.line }} />
        ))}
      </View>

      {/* Import depuis le répertoire */}
      <Card onPress={openPhoneContacts} style={{ marginBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={loadingContacts ? "hourglass-outline" : "people-outline"} size={21} color={C.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong">{loadingContacts ? "Ouverture du répertoire…" : "Importer depuis mes contacts"}</UText>
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>Accéder au répertoire téléphonique</UText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </View>
      </Card>

      <UText v="overline" tone="muted" align="center" style={{ marginTop: 14 }}>Ou saisir manuellement</UText>

      {/* Identité */}
      <SectionHeader title="Identité" style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Prénom *" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" autoCapitalize="words" editable={!submitting} style={{ flex: 1 }} />
        <Field label="Nom *" value={lastName} onChangeText={setLastName} placeholder="Diallo" autoCapitalize="words" editable={!submitting} style={{ flex: 1 }} />
      </View>
      {firstName.trim().length >= 1 && lastName.trim().length >= 1 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: R.md, backgroundColor: C.sunken, marginBottom: 6 }}>
          <Avatar name={`${firstName} ${lastName}`} size={36} />
          <UText v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{firstName.trim()} {lastName.trim()}</UText>
          <Ionicons name="checkmark-circle" size={20} color={C.pos} />
        </View>
      )}

      {/* Localisation */}
      <SectionHeader title="Localisation" style={{ marginBottom: 14 }} />
      <SelectRow label="Pays de résidence *" value={addressCountry.name} prefix={addressCountry.flag} placeholder="Sélectionner…" onPress={() => setShowCountryModal(true)} />
      <SelectRow label="Ville *" value={city} placeholder="Sélectionner…" icon="location-outline" onPress={() => setShowCityModal(true)} />

      {/* Téléphone */}
      <SectionHeader title="Téléphone (optionnel)" style={{ marginBottom: 14 }} />
      <UText v="overline" tone="muted" style={{ marginBottom: 8 }}>Mobile Money</UText>
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
          onChangeText={setPhoneNumber}
          placeholder="620 000 000"
          keyboardType="phone-pad"
          editable={!submitting}
          style={{ flex: 1, marginBottom: 0 }}
        />
      </View>
      <UText v="caption" tone="muted" style={{ marginTop: 8 }}>Utilisé pour les transferts Mobile Money directs.</UText>

      <View style={{ height: 8 }} />

      {/* Feuille : contacts du téléphone */}
      <Sheet
        visible={showContactsModal}
        onClose={() => { setShowContactsModal(false); setContactSearch(""); }}
        title="Mes contacts"
      >
        <View style={{ paddingTop: 8, paddingBottom: 6 }}>
          <UText v="caption" tone="muted" style={{ marginBottom: 10 }}>
            {filteredContacts.length} contact{filteredContacts.length > 1 ? "s" : ""} avec numéro
          </UText>
          <SearchPill value={contactSearch} onChangeText={setContactSearch} placeholder="Rechercher un contact" />
        </View>
        {filteredContacts.length === 0 ? (
          <EmptyView icon="people-outline" title={contactSearch ? "Aucun contact trouvé" : "Aucun contact avec numéro"} />
        ) : (
          <>
            {filteredContacts.slice(0, MAX_CONTACT_ROWS).map((c, i, arr) => (
              <ListRow
                key={String(c.id ?? `${c.firstName}-${i}`)}
                left={<Avatar name={c.firstName || "?"} size={44} />}
                title={`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Sans nom"}
                subtitle={c.phoneNumbers?.[0]?.number}
                last={i === arr.length - 1}
                chevron={false}
                right={<Ionicons name="add-circle-outline" size={22} color={C.ink} />}
                onPress={() => handleSelectContact(c)}
              />
            ))}
            {filteredContacts.length > MAX_CONTACT_ROWS && (
              <UText v="caption" tone="muted" align="center" style={{ marginTop: 12 }}>
                {filteredContacts.length - MAX_CONTACT_ROWS} autres contacts — affine ta recherche pour les voir.
              </UText>
            )}
          </>
        )}
      </Sheet>

      {/* Feuille : pays de résidence */}
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

      {/* Feuille : ville */}
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

      {/* Feuille : indicatif téléphonique */}
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