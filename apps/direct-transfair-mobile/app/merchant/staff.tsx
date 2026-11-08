// apps/direct-transfair-mobile/app/merchant/staff.tsx
// =========================================================
// ÉQUIPE DE CAISSE v1.0 — Lot 13 (propriétaire du commerce)
// Ajouter des caissiers (par numéro de téléphone, comptes de la même société), fixer leurs droits :
//  • encaisser (toujours) — leurs encaissements arrivent sur le solde du commerce, jamais sur leur portefeuille ;
//  • rembourser (désactivé par défaut, code secret exigé pour l'accorder) ;
//  • plafond par paiement (facultatif).
// Suspendre ou retirer un caissier ferme aussitôt ses demandes de paiement encore ouvertes. Il ne voit ni solde, ni retraits.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { StaffMember } from "../../services/merchantTypes";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Avatar, Button, Card, EmptyView, ErrorView, Field, NavBar, Notice, Pill, Screen, Sheet, SkeletonRows, Toggle, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { PinPrompt, Rise, apiProblem, money } from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";

function Setting({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <UText v="bodyStrong">{label}</UText>
        {!!hint && <UText v="caption" tone="muted">{hint}</UText>}
      </View>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}

export default function StaffScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { C } = useUI();
  const currency = user?.primaryCurrency ?? "XOF";
  const { data, status, error, reload } = useLoader(() => api.listStaff());

  // ── ajout ──
  const [addOpen, setAddOpen] = useState(false);
  const [country, setCountry] = useState<AuthCountry>(findCountry(user?.country ?? "Guinée") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [addRefund, setAddRefund] = useState(false);
  const [addMaxText, setAddMaxText] = useState("");
  const [addPin, setAddPin] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const phoneRef = useRef<any>(null);

  // ── édition ──
  const [edit, setEdit] = useState<StaffMember | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [editRefund, setEditRefund] = useState(false);
  const [editMaxText, setEditMaxText] = useState("");
  const [editPin, setEditPin] = useState("");

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const parseMax = (t: string) => { const n = roundTo(parseAmount(t), decimalsFor(currency)); return n > 0 ? n : null; };
  const members = data?.data ?? [];
  const activeCount = useMemo(() => members.filter((m) => m.active).length, [members]);
  const full = !!data && activeCount >= data.max;

  const openAdd = () => { setProblem(null); setShowErrors(false); setPhone(""); setAddRefund(false); setAddMaxText(""); setAddPin(""); setAddOpen(true); };
  const submitAdd = async () => {
    setShowErrors(true);
    if (validatePhone(phone) || addPin.length !== 6) return;
    setBusy(true); setProblem(null);
    try {
      const m = await api.addStaff({ pin: addPin, phone: `${country.dial}${normalizeNationalNumber(phone)}`, canRefund: addRefund, maxAmount: parseMax(addMaxText) });
      setAddOpen(false); setNotice(`${m.name} peut maintenant encaisser pour votre commerce.`); reload();
    } catch (e) { setProblem(apiProblem(e).message); setAddPin(""); }
    finally { setBusy(false); }
  };

  const openEdit = (m: StaffMember) => {
    setProblem(null); setEdit(m); setEditActive(m.active); setEditRefund(m.canRefund);
    setEditMaxText(m.maxAmount ? String(m.maxAmount) : ""); setEditPin("");
  };
  const grantsRefund = !!edit && editRefund && !edit.canRefund;
  const submitEdit = async () => {
    if (!edit) return;
    if (grantsRefund && editPin.length !== 6) { setProblem("Saisissez votre code secret pour autoriser les remboursements."); return; }
    setBusy(true); setProblem(null);
    try {
      const max = parseMax(editMaxText);
      await api.updateStaff(edit.id, {
        ...(editActive !== edit.active ? { active: editActive } : {}),
        ...(editRefund !== edit.canRefund ? { canRefund: editRefund } : {}),
        ...(max !== edit.maxAmount ? { maxAmount: max } : {}),
        ...(grantsRefund ? { pin: editPin } : {}),
      });
      setEdit(null); setNotice("Droits mis à jour."); reload();
    } catch (e) { setProblem(apiProblem(e).message); setEditPin(""); }
    finally { setBusy(false); }
  };

  const remove = (m: StaffMember) => {
    Alert.alert("Retirer ce caissier ?", `${m.name} ne pourra plus encaisser pour votre commerce. Ses demandes de paiement ouvertes seront fermées.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer", style: "destructive",
        onPress: async () => {
          try { await api.removeStaff(m.id); setEdit(null); setNotice(`${m.name} a été retiré.`); reload(); }
          catch (e) { setNotice(apiProblem(e).message); }
        },
      },
    ]);
  };

  const header = <NavBar onBack={() => router.back()} title="Équipe de caisse" subtitle={data ? `${activeCount} / ${data.max} caissier(s) actif(s)` : undefined} />;
  if (status === "loading") return <Screen header={header}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }

  return (
    <Screen header={header} footer={<Button label="Ajouter un caissier" icon="add" disabled={full} onPress={openAdd} />}>
      {!!notice && <Notice tone="info" style={{ marginBottom: 12 }}>{notice}</Notice>}
      {full && <Notice tone="warn" style={{ marginBottom: 12 }}>Nombre maximum de caissiers atteint. Retirez-en un pour en ajouter.</Notice>}

      <Notice tone="info" icon="information-circle-outline" style={{ marginBottom: 14 }}>
        Un caissier encaisse au nom de votre commerce depuis son propre téléphone (menu « Caisse »). L'argent arrive sur le solde du commerce ; il ne voit ni ce solde ni les retraits.
      </Notice>

      {members.length === 0 ? (
        <EmptyView icon="people-outline" title="Pas encore de caissier" message="Ajoutez une personne de confiance par son numéro de téléphone : elle doit déjà avoir un compte Direct Transf'air." />
      ) : (
        members.map((m, i) => (
          <Rise key={m.id} delay={i * 50}>
            <Card onPress={() => openEdit(m)} pad={16} style={{ marginBottom: 10, opacity: m.active ? 1 : 0.6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Avatar name={m.name} size={46} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <UText v="bodyStrong" numberOfLines={1}>{m.name}</UText>
                  <UText v="caption" tone="muted" numberOfLines={1}>{m.phoneMasked}</UText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    <Pill label={m.active ? "Actif" : "Suspendu"} tone={m.active ? "pos" : "neutral"} />
                    {m.canRefund && <Pill label="Rembourse" tone="info" />}
                    {m.maxAmount ? <Pill label={`≤ ${money(m.maxAmount, currency)}`} tone="neutral" /> : null}
                  </View>
                </View>
              </View>
            </Card>
          </Rise>
        ))
      )}

      {/* Ajout */}
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Nouveau caissier">
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <PhoneField
          country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone}
          error={showErrors ? validatePhone(phone) : null} hint="Numéro du compte de la personne, sans le 0 de tête." accent={C.accent} inputRef={phoneRef}
        />
        <Setting label="Peut rembourser" hint="Remboursement intégral d'un paiement de moins de 30 jours." value={addRefund} onChange={setAddRefund} />
        <Field label={`Plafond par paiement en ${currency} (facultatif)`} value={addMaxText} onChangeText={(t) => setAddMaxText(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" icon="cash-outline" />
        <View style={{ height: 14 }} />
        <PinPrompt value={addPin} onChange={setAddPin} label="Votre code secret" error={showErrors && addPin.length !== 6 ? "Code à 6 chiffres" : null} />
        <View style={{ height: 14 }} />
        <Button label="Ajouter" loading={busy} onPress={submitAdd} />
      </Sheet>

      {/* Droits */}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""}>
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <Setting label="Actif" hint="Suspendu, il ne peut plus encaisser." value={editActive} onChange={setEditActive} />
        <Setting label="Peut rembourser" value={editRefund} onChange={setEditRefund} />
        <Field label={`Plafond par paiement en ${currency} (vide = aucun)`} value={editMaxText} onChangeText={(t) => setEditMaxText(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" icon="cash-outline" />
        {grantsRefund && (
          <View style={{ marginTop: 14 }}>
            <PinPrompt value={editPin} onChange={setEditPin} label="Votre code secret (pour autoriser les remboursements)" />
          </View>
        )}
        <View style={{ height: 14 }} />
        <Button label="Enregistrer" loading={busy} onPress={submitEdit} />
        <View style={{ height: 8 }} />
        {edit && <Button label="Retirer ce caissier" kind="danger" onPress={() => remove(edit)} />}
      </Sheet>
    </Screen>
  );
}
