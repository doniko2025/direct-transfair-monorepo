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
import { useT } from "../../providers/I18nProvider";
import { localizeCountry } from "../../utils/countryNames";

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

/** La valeur choisie reste le nom français (envoyé au serveur) ; seul le libellé suit la langue. */
const countryOptions = () => AUTH_COUNTRIES.map((c) => ({ key: c.name, label: `${c.flag}  ${localizeCountry(c.name)}` }));

export function BusinessInfoFields({ value, onChange, errors = {} }: {
  value: BusinessInfoValue;
  onChange: (patch: Partial<BusinessInfoValue>) => void;
  errors?: BusinessInfoErrors;
}) {
  const { width } = useWindowDimensions();
  const t = useT();
  // Sous ~380 px de large, deux champs côte à côte seraient trop étroits : ils s'empilent.
  const stacked = width < 380;
  return (
    <>
      <Field
        label={t("binfo.address")} icon="location-outline" value={value.address} onChangeText={(v) => onChange({ address: v })}
        autoCapitalize="sentences" autoComplete="street-address" maxLength={160} error={errors.address}
        hint={t("binfo.addressHint")}
      />
      <Field label={t("binfo.district")} icon="map-outline" value={value.district} onChangeText={(v) => onChange({ district: v })} autoCapitalize="words" maxLength={80} error={errors.district} />
      <View style={{ flexDirection: stacked ? "column" : "row", gap: stacked ? 0 : 12 }}>
        <Field label={t("binfo.city")} icon="business-outline" value={value.city} onChangeText={(v) => onChange({ city: v })} autoCapitalize="words" maxLength={80} error={errors.city} style={stacked ? undefined : { flex: 1 }} />
        <Field label={t("binfo.postal")} icon="mail-outline" value={value.postalCode} onChangeText={(v) => onChange({ postalCode: v.toUpperCase() })} autoCapitalize="characters" autoComplete="postal-code" maxLength={10} error={errors.postalCode} style={stacked ? undefined : { flex: 1 }} />
      </View>
      <OptionPicker
        label={t("binfo.countryOpt")} title={t("binfo.country")} icon="globe-outline" value={value.country}
        options={countryOptions()} onChange={(k) => onChange({ country: k })} placeholder={t("binfo.countryPh")} error={errors.country}
      />
      <Field
        label={t("binfo.phone")} icon="call-outline" value={value.phone} onChangeText={(v) => onChange({ phone: v.replace(/[^\d+\s.-]/g, "") })}
        keyboardType="phone-pad" maxLength={22} placeholder="+224 620 00 00 00" error={errors.phone}
        hint={t("binfo.phoneHint")}
      />
      <Field
        label={t("binfo.tax")} icon="receipt-outline" value={value.taxId} onChangeText={(v) => onChange({ taxId: v.toUpperCase() })}
        autoCapitalize="characters" maxLength={30} error={errors.taxId} hint={t("binfo.taxHint")}
      />
    </>
  );
}

export default BusinessInfoFields;
