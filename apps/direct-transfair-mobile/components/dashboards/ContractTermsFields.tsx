// apps/direct-transfair-mobile/components/dashboards/ContractTermsFields.tsx
// =========================================================
// CONDITIONS COMMERCIALES D'UN CONTRAT — champs partagés par la création de société (section « Contrat »)
// et la carte « Contrats » de la fiche société. Même contenu que le web (ContractTermsFields.tsx) :
//   • location : redevance + devise + facturation + engagement initial ; achat : prix + devise + maintenance annuelle (facultative) ;
//   • délai de paiement (jours) et date d'effet (AAAA-MM-JJ, « Aujourd'hui » en un toucher).
// Règles de saisie : services/contractTypes.ts (validateTerms) — le serveur les revérifie.
// =========================================================

import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import {
  BILLING_PERIODS, CONTRACT_CURRENCIES, todayLocal,
  type ContractKind, type ContractTermsForm,
} from "../../services/contractTypes";

const T = {
  surface: "#FFFFFF", border: "#E2E8F0", ink: "#0F172A", inkSub: "#6B7280", inkMuted: "#9CA3AF",
  blue: "#1956F0", blueLt: "#EEF2FF", red: "#DC2626", white: "#FFFFFF",
  radius: { md: 12 },
  font: { sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }) },
};

function Label({ children }: { children: string }) {
  return <Text style={[s.label, { fontFamily: T.font.sans }]}>{children}</Text>;
}

function Err({ msg }: { msg?: string }) {
  return msg ? <Text style={[s.err, { fontFamily: T.font.sans }]}>{msg}</Text> : null;
}

function Input({ label, value, onChangeText, placeholder, keyboardType, editable, error, hint, accent, maxLength }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad" | "numbers-and-punctuation";
  editable?: boolean; error?: string; hint?: string; accent: string; maxLength?: number;
}) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        style={[
          s.input, { fontFamily: T.font.sans },
          !!error && { borderColor: T.red },
          editable === false && { opacity: 0.6 },
          Platform.OS === "web" && ({ outlineStyle: "none" } as any),
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.inkMuted}
        keyboardType={keyboardType}
        editable={editable !== false}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect={false}
        underlineColorAndroid="transparent"
        selectionColor={accent}
      />
      {error ? <Err msg={error} /> : hint ? <Text style={[s.hint, { fontFamily: T.font.sans }]}>{hint}</Text> : null}
    </View>
  );
}

function Chips<V extends string>({ label, value, options, onChange, disabled, accent }: {
  label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; disabled?: boolean; accent: string;
}) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <View style={s.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[s.chip, on && { backgroundColor: accent + "14", borderColor: accent + "70" }, disabled && { opacity: 0.6 }]}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipTxt, { fontFamily: T.font.sans }, on && { color: accent }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function ContractTermsFields({ kind, value, errors, onChange, disabled, accent = T.blue }: {
  kind: ContractKind;
  value: ContractTermsForm;
  errors: Record<string, string | undefined>;
  onChange: (patch: Partial<ContractTermsForm>) => void;
  disabled?: boolean;
  accent?: string;
}) {
  const rental = kind === "RENTAL";
  const digits = (v: string) => v.replace(/[^\d]/g, "");
  return (
    <View>
      <Input
        label={rental ? "Redevance (hors taxes)" : "Prix d'achat (hors taxes)"}
        value={value.amount}
        onChangeText={(v) => onChange({ amount: v })}
        placeholder={rental ? "ex. 149" : "ex. 4900"}
        keyboardType="decimal-pad"
        editable={!disabled}
        error={errors.amount}
        accent={accent}
      />
      <Chips label="Devise" value={value.currency} options={CONTRACT_CURRENCIES} onChange={(v) => onChange({ currency: v })} disabled={disabled} accent={accent} />

      {rental ? (
        <>
          <Chips label="Facturation" value={value.billingPeriod} options={BILLING_PERIODS} onChange={(v) => onChange({ billingPeriod: v })} disabled={disabled} accent={accent} />
          <Input
            label="Engagement initial (mois)"
            value={value.commitmentMonths}
            onChangeText={(v) => onChange({ commitmentMonths: digits(v) })}
            keyboardType="number-pad"
            editable={!disabled}
            error={errors.commitmentMonths}
            hint="Renouvelé tacitement ensuite, préavis d'un mois."
            accent={accent}
            maxLength={3}
          />
        </>
      ) : (
        <Input
          label="Maintenance et hébergement par an (facultatif)"
          value={value.maintenanceFeeYearly}
          onChangeText={(v) => onChange({ maintenanceFeeYearly: v })}
          keyboardType="decimal-pad"
          editable={!disabled}
          error={errors.maintenanceFeeYearly}
          hint="Laissez vide si non inclus : le contrat indiquera « sur devis »."
          accent={accent}
        />
      )}

      <Input
        label="Délai de paiement (jours)"
        value={value.paymentDays}
        onChangeText={(v) => onChange({ paymentDays: digits(v) })}
        keyboardType="number-pad"
        editable={!disabled}
        error={errors.paymentDays}
        accent={accent}
        maxLength={2}
      />

      <View style={s.field}>
        <View style={s.dateHead}>
          <Label>Date d'effet</Label>
          <TouchableOpacity onPress={() => onChange({ effectiveDate: todayLocal() })} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel="Utiliser la date du jour">
            <Text style={[s.today, { fontFamily: T.font.sans, color: accent }]}>Aujourd'hui</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[
            s.input, { fontFamily: T.font.sans },
            !!errors.effectiveDate && { borderColor: T.red },
            disabled && { opacity: 0.6 },
            Platform.OS === "web" && ({ outlineStyle: "none" } as any),
          ]}
          value={value.effectiveDate}
          onChangeText={(v) => onChange({ effectiveDate: v.replace(/[^\d-]/g, "").slice(0, 10) })}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={T.inkMuted}
          keyboardType="numbers-and-punctuation"
          editable={!disabled}
          maxLength={10}
          underlineColorAndroid="transparent"
          selectionColor={accent}
        />
        <Err msg={errors.effectiveDate} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  field:    { marginBottom: 13 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  input:    { paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: T.ink, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md },
  hint:     { fontSize: 11, fontWeight: "500", color: T.inkSub, marginTop: 5, lineHeight: 15 },
  err:      { fontSize: 11, fontWeight: "700", color: T.red, marginTop: 5 },
  chips:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:     { paddingHorizontal: 14, paddingVertical: 10, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  chipTxt:  { fontSize: 13, fontWeight: "800", color: T.inkSub },
  dateHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  today:    { fontSize: 11, fontWeight: "900", marginBottom: 6 },
});
