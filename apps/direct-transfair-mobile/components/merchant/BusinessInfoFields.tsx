// apps/direct-transfair-mobile/components/merchant/BusinessInfoFields.tsx
// =========================================================
// COORDONNÉES DU COMMERCE — bloc de champs commun à l'activation et aux réglages du commerce.
//   Adresse* · Quartier / commune · Ville* · Code postal (facultatif) · Pays · Téléphone du commerce · NIF / IFU
//   (* obligatoire). Ces champs sont ceux du COMMERCE : jamais préremplis avec l'adresse ou le téléphone personnels du client.
// Mise en page adaptative : la ville et le code postal partagent une ligne et passent l'un sous l'autre sur petit écran.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Field } from "../ui";
import { OptionPicker } from "../ui/OptionPicker";
import { AUTH_COUNTRIES } from "../auth/authCountries";

export type BusinessInfoValue = {
  address: string;
  district: string;
  city: string;
  postalCode: string;
  /** Nom du pays (ex. « Guinée »), ou null. */
  country: string | null;
  /** Téléphone du commerce, avec indicatif. */
  phone: string;
  taxId: string;
};

export type BusinessInfoErrors = Partial<Record<keyof BusinessInfoValue, string | null>>;

export const EMPTY_BUSINESS_INFO: BusinessInfoValue = { address: "", district: "", city: "", postalCode: "", country: null, phone: "", taxId: "" };

const COUNTRY_OPTIONS = AUTH_COUNTRIES.map((c) => ({ key: c.name, label: `${c.flag}  ${c.name}` }));

export function BusinessInfoFields({ value, onChange, errors = {} }: {
  value: BusinessInfoValue;
  onChange: (patch: Partial<BusinessInfoValue>) => void;
  errors?: BusinessInfoErrors;
}) {
  const { width } = useWindowDimensions();
  // Sous ~380 px de large, deux champs côte à côte seraient trop étroits : ils s'empilent.
  const stacked = width < 380;
  return (
    <>
      <Field
        label="Adresse du commerce" icon="location-outline" value={value.address} onChangeText={(t) => onChange({ address: t })}
        autoCapitalize="sentences" autoComplete="street-address" maxLength={160} error={errors.address}
        hint="Rue, numéro, repère connu… tel que vos clients peuvent vous trouver."
      />
      <Field label="Quartier / commune (facultatif)" icon="map-outline" value={value.district} onChangeText={(t) => onChange({ district: t })} autoCapitalize="words" maxLength={80} error={errors.district} />
      <View style={{ flexDirection: stacked ? "column" : "row", gap: stacked ? 0 : 12 }}>
        <Field label="Ville" icon="business-outline" value={value.city} onChangeText={(t) => onChange({ city: t })} autoCapitalize="words" maxLength={80} error={errors.city} style={stacked ? undefined : { flex: 1 }} />
        <Field label="Code postal (facultatif)" icon="mail-outline" value={value.postalCode} onChangeText={(t) => onChange({ postalCode: t.toUpperCase() })} autoCapitalize="characters" autoComplete="postal-code" maxLength={10} error={errors.postalCode} style={stacked ? undefined : { flex: 1 }} />
      </View>
      <OptionPicker
        label="Pays du commerce (facultatif)" title="Pays du commerce" icon="globe-outline" value={value.country}
        options={COUNTRY_OPTIONS} onChange={(k) => onChange({ country: k })} placeholder="Choisir un pays" error={errors.country}
      />
      <Field
        label="Téléphone du commerce (facultatif)" icon="call-outline" value={value.phone} onChangeText={(t) => onChange({ phone: t.replace(/[^\d+\s.-]/g, "") })}
        keyboardType="phone-pad" maxLength={22} placeholder="+224 620 00 00 00" error={errors.phone}
        hint="Avec l'indicatif du pays. Numéro du commerce, distinct de votre téléphone personnel."
      />
      <Field
        label="NIF / IFU (facultatif)" icon="receipt-outline" value={value.taxId} onChangeText={(t) => onChange({ taxId: t.toUpperCase() })}
        autoCapitalize="characters" maxLength={30} error={errors.taxId} hint="Numéro d'identification fiscale de l'entreprise."
      />
    </>
  );
}

export default BusinessInfoFields;
