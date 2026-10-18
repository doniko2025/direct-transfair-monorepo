// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-wallet.tsx
// =========================================================
// PERSONAL INFO — CLIENT (WALLET) v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — fini l'en-tête dégradé sombre : barre de navigation
//    claire avec crayon (modifier) / croix (annuler), avatar centré, puis trois sections
//    (Identité, État civil, Adresse de résidence) avec champs arrondis du design system ;
//    champs verrouillés (email) grisés avec cadenas ; sélecteurs de pays et de ville dans
//    des feuilles basses claires avec recherche ; bouton « Enregistrer » pilule collé en bas
//    pendant la modification. Plus de vert/bleu/rouge écrits en dur ni de police serif :
//    tout suit la marque du tenant. Les deux sélecteurs (pays / ville) sont factorisés en
//    un seul composant PickerSheet (avant : deux copies de ~90 lignes).
//    LOGIQUE INCHANGÉE (préremplissage depuis useAuth().user, formatDate, handleDateChange
//    JJ/MM/AAAA, cancelEdit, save → api.updateProfile + refreshUser, mêmes champs
//    obligatoires et messages, liste de villes citiesByCountry, reset de la ville si elle
//    n'appartient pas au nouveau pays).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.7 : WHITE-LABEL — couleurs vertes suivent la marque du tenant.
// ✅ v5.6 : HERO — dégradé sombre identique à ClientDashboard (remplacé en v6.0).
// ✅ v5.5 : Correction des erreurs TypeScript signalées (ts(2769)).
// ✅ v5.4 : reset du cadre de focus web.
// =========================================================

import React, { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { COUNTRIES } from "../../../utils/countries";
import { citiesByCountry } from "../../../data/cities";
import {
  Avatar, Button, EmptyView, Field, IconButton, ListRow, NavBar, Notice, Pill, Screen, SearchPill, SectionHeader, SelectRow, Sheet, UText, useUI,
} from "../../../components/ui";

// ─── Sélecteur en feuille basse (pays / ville) ───────────
function PickerSheet({
  label, value, onChange, items, editable, placeholder, searchPlaceholder, icon, emptyText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: string[];
  editable: boolean;
  placeholder: string;
  searchPlaceholder: string;
  icon?: string;
  emptyText: string;
}) {
  const { C } = useUI();
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((c) => c.toLowerCase().includes(needle)) : items;
  }, [q, items]);

  const close = () => { setVisible(false); setQ(""); };

  return (
    <>
      {editable ? (
        <SelectRow label={label} value={value} placeholder={placeholder} icon={icon} onPress={() => setVisible(true)} />
      ) : (
        <Field label={label} value={value} onChangeText={() => {}} editable={false} placeholder="—" icon="lock-closed-outline" />
      )}
      <Sheet visible={visible} onClose={close} title={label.replace(/\s*\*$/, "")}>
        <View style={{ paddingTop: 8, paddingBottom: 6 }}>
          <SearchPill value={q} onChangeText={setQ} placeholder={searchPlaceholder} autoFocus />
        </View>
        {filtered.length === 0 ? (
          <EmptyView icon="search-outline" title={emptyText} />
        ) : (
          filtered.map((item, i) => (
            <ListRow
              key={item}
              title={item}
              last={i === filtered.length - 1}
              chevron={false}
              right={value === item ? <UText v="bodyStrong" color={C.accentDeep}>✓</UText> : undefined}
              onPress={() => { onChange(item); close(); }}
            />
          ))
        )}
      </Sheet>
    </>
  );
}

// ─── Écran ───────────────────────────────────────────────
export default function PersonalInfoWallet() {
  const router = useRouter();
  const { C } = useUI();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const formatDate = (iso: string) => {
    if (!iso) return "";
    if (iso.includes("T") || iso.includes("-")) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
    return iso;
  };

  const handleDateChange = (text: string) => {
    let c = text.replace(/\D/g, "");
    if (c.length > 4) c = `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
    else if (c.length > 2) c = `${c.slice(0, 2)}/${c.slice(2, 4)}`;
    setBirthDate(c);
  };

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setEmail(user.email || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet || "");
    setPostalCode(user.postalCode || "");
    setCity(user.city || "");
    setCountry(user.country || "");
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet || "");
    setPostalCode(user.postalCode || "");
    setCity(user.city || "");
    setCountry(user.country || "");
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !city.trim() || !country.trim()) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    if (birthDate.length > 0 && birthDate.length !== 10) {
      Alert.alert("Format invalide", "La date doit être au format JJ/MM/AAAA.");
      return;
    }
    try {
      setLoading(true);
      const parsedDate = birthDate.length === 10
        ? (() => { const p = birthDate.split("/"); return `${p[2]}-${p[1]}-${p[0]}T00:00:00.000Z`; })()
        : undefined;
      await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        birthDate: parsedDate,
        birthPlace: birthPlace.trim(),
        nationality,
        addressStreet: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        country,
      });
      await refreshUser();
      setIsEditing(false);
      Alert.alert("Succès", "Informations mises à jour avec succès.");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible d'enregistrer.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  // Villes disponibles pour le pays de résidence
  const residenceCities: string[] = (citiesByCountry as any)[country] ?? [];
  const showCityPicker = isEditing && residenceCities.length > 0;
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <Screen
      keyboard
      header={
        <NavBar
          title="Mes informations"
          subtitle="Profil & KYC"
          onBack={() => router.back()}
          right={
            <IconButton
              icon={isEditing ? "close" : "pencil"}
              label={isEditing ? "Annuler la modification" : "Modifier mes informations"}
              onPress={() => (isEditing ? cancelEdit() : setIsEditing(true))}
            />
          }
        />
      }
      footer={isEditing ? <Button label="Enregistrer les modifications" icon="save-outline" onPress={save} loading={loading} disabled={loading} /> : undefined}
    >
      {/* Identité visuelle */}
      <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 18 }}>
        <Avatar name={fullName || "Client"} size={72} />
        <UText v="title" align="center" style={{ marginTop: 12 }} numberOfLines={1}>{fullName || "—"}</UText>
        {!!email && <UText v="caption" tone="muted" align="center" style={{ marginTop: 2 }} numberOfLines={1}>{email}</UText>}
        <Pill label="Client" tone="neutral" icon="wallet-outline" style={{ marginTop: 10 }} />
      </View>

      {!isEditing && (
        <Notice tone="info" icon="create-outline" style={{ marginBottom: 6 }}>
          Appuie sur le crayon en haut à droite pour modifier tes informations.
        </Notice>
      )}

      {/* Identité */}
      <SectionHeader title="Identité" style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Prénom *" value={firstName} onChangeText={setFirstName} editable={isEditing} autoCapitalize="words" placeholder="Prénom" style={{ flex: 1 }} />
        <Field label="Nom *" value={lastName} onChangeText={setLastName} editable={isEditing} autoCapitalize="words" placeholder="Nom" style={{ flex: 1 }} />
      </View>
      <Field label="Téléphone *" icon="call-outline" value={phone} onChangeText={setPhone} editable={isEditing} keyboardType="phone-pad" placeholder="+33 6 00 00 00 00" />
      <Field label="Adresse email" icon="lock-closed-outline" value={email} onChangeText={() => {}} editable={false} placeholder="—" hint={isEditing ? "L'email ne peut pas être modifié ici." : undefined} />

      {/* État civil */}
      <SectionHeader title="État civil" style={{ marginBottom: 14 }} />
      <Field
        label="Date de naissance (JJ/MM/AAAA)"
        icon="calendar-outline"
        value={birthDate}
        onChangeText={handleDateChange}
        editable={isEditing}
        keyboardType="numeric"
        maxLength={10}
        placeholder="15/06/1990"
      />
      <Field label="Lieu de naissance" icon="location-outline" value={birthPlace} onChangeText={setBirthPlace} editable={isEditing} autoCapitalize="words" placeholder="Paris, France" />
      <PickerSheet
        label="Nationalité"
        value={nationality}
        onChange={setNationality}
        items={COUNTRIES as string[]}
        editable={isEditing}
        placeholder="Sélectionner…"
        searchPlaceholder="Rechercher un pays"
        icon="flag-outline"
        emptyText="Aucun pays trouvé"
      />

      {/* Adresse de résidence */}
      <SectionHeader title="Adresse de résidence" style={{ marginBottom: 14 }} />
      <Field label="Adresse complète *" icon="home-outline" value={address} onChangeText={setAddress} editable={isEditing} autoCapitalize="sentences" placeholder="12 Rue des Lilas…" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Code postal" value={postalCode} onChangeText={setPostalCode} editable={isEditing} keyboardType="numeric" placeholder="75001" style={{ flex: 0.45 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {showCityPicker ? (
            <PickerSheet
              label="Ville *"
              value={city}
              onChange={setCity}
              items={residenceCities}
              editable={isEditing}
              placeholder="Sélectionner…"
              searchPlaceholder="Rechercher une ville"
              emptyText="Aucune ville disponible"
            />
          ) : (
            <Field label="Ville *" value={city} onChangeText={setCity} editable={isEditing} autoCapitalize="words" placeholder="Paris" />
          )}
        </View>
      </View>
      <PickerSheet
        label="Pays de résidence *"
        value={country}
        onChange={(newCountry: string) => {
          setCountry(newCountry);
          const cities: string[] = (citiesByCountry as any)[newCountry] ?? [];
          if (city && cities.length > 0 && !cities.includes(city)) setCity("");
        }}
        items={COUNTRIES as string[]}
        editable={isEditing}
        placeholder="Sélectionner…"
        searchPlaceholder="Rechercher un pays"
        icon="globe-outline"
        emptyText="Aucun pays trouvé"
      />
      <View style={{ height: 8 }} />
    </Screen>
  );
}
