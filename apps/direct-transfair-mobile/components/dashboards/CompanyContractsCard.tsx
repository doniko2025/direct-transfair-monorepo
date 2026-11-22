// apps/direct-transfair-mobile/components/dashboards/CompanyContractsCard.tsx
// =========================================================
// CONTRATS D'UNE SOCIÉTÉ — carte de la fiche société (SUPER_ADMIN uniquement : l'API est réservée à ce rôle)
// Même carte que le back-office web (CompanyContracts.tsx) :
//   • liste des contrats de la société (signés, en attente, expirés, annulés) ;
//   • émission d'un contrat de location ou d'achat → e-mail avec le lien de signature au patron de la société ;
//     le lien s'affiche aussi (copier / partager) au cas où l'e-mail n'arrive pas ;
//   • par contrat : PDF (signé s'il l'est, sinon aperçu), nouveau lien, annulation (motif facultatif), renvoi de la copie signée.
// Règles serveur reprises ici pour éviter un refus : numéro RCCM obligatoire (il figure dans le contrat), un seul contrat
// en attente à la fois (renvoyer le lien ou annuler avant d'en émettre un autre).
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { api } from "../../services/api";
import {
  CONTRACT_KIND_LABEL, CONTRACT_STATUS_LABEL, contractCurrencyOf, formatDay, initialTermsForm,
  termsHeadline, toTermsInput, validateTerms,
  type ContractKind, type ContractStatus, type ContractSummary, type ContractTermsForm,
} from "../../services/contractTypes";
import ContractTermsFields from "./ContractTermsFields";

const T = {
  surface: "#FFFFFF", pageBg: "#F2F4F8", border: "#E4E9F0", ink: "#0F172A", inkSub: "#64748B", inkMuted: "#94A3B8",
  blue: "#1956F0", blueLt: "#EEF2FF", blueMd: "#C7D5FF",
  green: "#16A34A", greenLt: "#DCFCE7", red: "#DC2626", redLt: "#FEE2E2",
  amber: "#D97706", amberLt: "#FEF3C7", purple: "#0F766E", purpleLt: "#CCFBF1", white: "#FFFFFF",
  radius: { sm: 8, md: 12 },
  font: {
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_COLOR: Record<ContractStatus, { fg: string; bg: string }> = {
  PENDING:   { fg: T.amber,    bg: T.amberLt },
  SIGNED:    { fg: T.green,    bg: T.greenLt },
  EXPIRED:   { fg: T.inkSub,   bg: "#F1F5F9" },
  CANCELLED: { fg: T.red,      bg: T.redLt },
};

const apiMessage = (e: any, fallback: string): string => {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return String(m[0] ?? fallback);
  return typeof m === "string" && m ? m : fallback;
};

interface LinkInfo { reference: string; signUrl: string | null; email: string; emailed: boolean | null }

export default function CompanyContractsCard({ clientId, defaultKind, defaultEmail, defaultCurrency, hasRccm, onEditRccm }: {
  clientId: number;
  defaultKind: ContractKind;
  defaultEmail?: string | null;
  defaultCurrency?: string | null;
  /** false → l'émission est bloquée tant que le numéro RCCM n'est pas renseigné (il figure dans le contrat). */
  hasRccm: boolean;
  onEditRccm: () => void;
}) {
  const [contracts, setContracts] = useState<ContractSummary[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [link, setLink]           = useState<LinkInfo | null>(null);
  const [copied, setCopied]       = useState(false);

  // Émission
  const [issuing, setIssuing] = useState(false);
  const [kind, setKind]       = useState<ContractKind>(defaultKind);
  const [terms, setTerms]     = useState<ContractTermsForm>(() => initialTermsForm(contractCurrencyOf(defaultCurrency)));
  const [errors, setErrors]   = useState<Record<string, string | undefined>>({});
  const [busy, setBusy]       = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Actions sur un contrat
  const [openId, setOpenId]         = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);   // `${id}:${action}`
  const [cancelId, setCancelId]     = useState<string | null>(null);
  const [reason, setReason]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContracts(await api.listContracts(clientId));
      setMsg((m) => (m?.tone === "err" ? null : m));
    } catch (e: any) {
      setContracts((c) => c ?? []);
      setMsg({ tone: "err", text: apiMessage(e, "Impossible de charger les contrats.") });
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const list = contracts ?? [];
  // Côté serveur, un contrat dont le lien a expiré reste « en attente » : il bloque aussi l'émission d'un nouveau.
  const blocking = list.find((c) => c.status === "PENDING" || c.status === "EXPIRED");

  const copyLink = async (url: string) => {
    try { await Clipboard.setStringAsync(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg({ tone: "err", text: "Copie impossible : utilisez « Partager »." }); }
  };
  const shareLink = async (url: string) => {
    try { await Share.share({ message: url }); } catch { /* fermé par l'utilisateur */ }
  };

  const issue = async () => {
    if (busy) return;
    const e = validateTerms(terms, kind);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true); setProblem(null); setMsg(null);
    try {
      const res = await api.issueContract({ clientId, kind, terms: toTermsInput(terms, kind) });
      setLink({ reference: res.reference, signUrl: res.signUrl, email: res.recipientEmail, emailed: null });
      setIssuing(false);
      setTerms(initialTermsForm(contractCurrencyOf(defaultCurrency)));
      await load();
    } catch (err: any) {
      setProblem(apiMessage(err, "Émission impossible. Vérifiez votre connexion et réessayez."));
    } finally { setBusy(false); }
  };

  const pdf = async (c: ContractSummary) => {
    if (Platform.OS === "web") {
      setMsg({ tone: "err", text: "Le PDF s'ouvre depuis l'application mobile ou le back-office web." });
      return;
    }
    setActionBusy(`${c.id}:pdf`); setMsg(null);
    try {
      const buf = await api.readContractPdf(c.id);
      const f = new File(Paths.cache, `contrat-${c.reference.replace(/[^A-Za-z0-9-]+/g, "-")}-${c.status === "SIGNED" ? "signe" : "apercu"}.pdf`);
      if (f.exists) f.delete();
      f.create();
      f.write(new Uint8Array(buf));
      if (!(await Sharing.isAvailableAsync())) {
        setMsg({ tone: "err", text: "Le partage de fichiers n'est pas disponible sur cet appareil." });
        return;
      }
      await Sharing.shareAsync(f.uri, { mimeType: "application/pdf", dialogTitle: `Contrat ${c.reference}`, UTI: "com.adobe.pdf" });
    } catch (e: any) {
      setMsg({ tone: "err", text: apiMessage(e, "Impossible d'ouvrir le PDF.") });
    } finally { setActionBusy(null); }
  };

  const resend = async (c: ContractSummary) => {
    setActionBusy(`${c.id}:resend`); setMsg(null);
    try {
      const res = await api.resendContractLink(c.id);
      setLink({ reference: c.reference, signUrl: res.signUrl, email: res.recipientEmail, emailed: res.emailed });
      await load();
    } catch (e: any) {
      setMsg({ tone: "err", text: apiMessage(e, "Impossible de renvoyer le lien.") });
    } finally { setActionBusy(null); }
  };

  const resendSigned = async (c: ContractSummary) => {
    setActionBusy(`${c.id}:signed`); setMsg(null);
    try {
      const res = await api.resendSignedContract(c.id);
      setMsg({ tone: "ok", text: `Contrat signé renvoyé à ${res.recipientEmail}.` });
    } catch (e: any) {
      setMsg({ tone: "err", text: apiMessage(e, "Impossible de renvoyer le contrat signé.") });
    } finally { setActionBusy(null); }
  };

  const cancel = async (c: ContractSummary) => {
    setActionBusy(`${c.id}:cancel`); setMsg(null);
    try {
      await api.cancelContract(c.id, reason);
      setCancelId(null); setReason(""); setOpenId(null);
      setLink((l) => (l?.reference === c.reference ? null : l));
      setMsg({ tone: "ok", text: `Contrat ${c.reference} annulé.` });
      await load();
    } catch (e: any) {
      setMsg({ tone: "err", text: apiMessage(e, "Annulation impossible.") });
    } finally { setActionBusy(null); }
  };

  const confirmResend = (c: ContractSummary) => {
    const text = `Un nouveau lien sera envoyé à ${c.recipientEmail}. L'ancien lien cessera de fonctionner.`;
    if (Platform.OS === "web") { if (window.confirm(text)) void resend(c); return; }
    Alert.alert("Renvoyer le lien ?", text, [
      { text: "Annuler", style: "cancel" },
      { text: "Renvoyer", onPress: () => { void resend(c); } },
    ]);
  };

  const Action = ({ icon, text, onPress, busyKey, tone = "blue", disabled }: {
    icon: string; text: string; onPress: () => void; busyKey: string; tone?: "blue" | "red"; disabled?: boolean;
  }) => {
    const isBusy = actionBusy === busyKey;
    const color = tone === "red" ? T.red : T.blue;
    return (
      <TouchableOpacity
        style={[s.action, { borderColor: color + "40", backgroundColor: tone === "red" ? T.redLt : T.blueLt }, (actionBusy !== null || disabled) && { opacity: 0.55 }]}
        onPress={onPress}
        disabled={actionBusy !== null || disabled}
        accessibilityRole="button"
        accessibilityLabel={text}
      >
        {isBusy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon as any} size={16} color={color} />}
        <Text style={[s.actionTxt, { fontFamily: T.font.sans, color }]}>{text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {msg && (
        <View style={[s.notice, msg.tone === "ok" ? s.noticeOk : s.noticeErr]}>
          <Ionicons name={msg.tone === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={msg.tone === "ok" ? T.green : T.red} />
          <Text style={[s.noticeTxt, { fontFamily: T.font.sans, color: msg.tone === "ok" ? T.green : T.red }]}>{msg.text}</Text>
        </View>
      )}

      {/* Lien de signature (après émission ou renvoi) */}
      {link && (
        <View style={s.linkBox}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="mail-outline" size={16} color={T.green} />
            <Text style={[s.linkTitle, { fontFamily: T.font.sans }]} numberOfLines={2}>
              {link.emailed === false
                ? `Contrat ${link.reference} : l'e-mail n'a pas pu partir`
                : `Contrat ${link.reference} : lien envoyé à ${link.email}`}
            </Text>
          </View>
          {link.signUrl ? (
            <>
              <Text style={[s.linkHint, { fontFamily: T.font.sans }]}>
                {link.emailed === false ? "Transmettez ce lien de signature au patron de la société :" : "Lien de signature (à copier si l'e-mail n'arrive pas) :"}
              </Text>
              <Text style={[s.linkUrl, { fontFamily: T.font.mono }]} selectable numberOfLines={3}>{link.signUrl}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={s.linkBtn} onPress={() => copyLink(link.signUrl!)} accessibilityRole="button">
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={T.blue} />
                  <Text style={[s.linkBtnTxt, { fontFamily: T.font.sans }]}>{copied ? "Copié" : "Copier"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkBtn} onPress={() => shareLink(link.signUrl!)} accessibilityRole="button">
                  <Ionicons name="share-outline" size={15} color={T.blue} />
                  <Text style={[s.linkBtnTxt, { fontFamily: T.font.sans }]}>Partager</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkBtn} onPress={() => setLink(null)} accessibilityRole="button">
                  <Ionicons name="close" size={15} color={T.inkSub} />
                  <Text style={[s.linkBtnTxt, { fontFamily: T.font.sans, color: T.inkSub }]}>Masquer</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      )}

      {/* Liste */}
      {loading && contracts === null ? (
        <ActivityIndicator color={T.blue} style={{ marginVertical: 16 }} />
      ) : list.length === 0 ? (
        !issuing && (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={26} color={T.inkMuted} />
            <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun contrat pour cette société</Text>
          </View>
        )
      ) : (
        list.map((c) => {
          const col = STATUS_COLOR[c.status] ?? STATUS_COLOR.EXPIRED;
          const open = openId === c.id;
          const canResend = c.status === "PENDING" || c.status === "EXPIRED";
          return (
            <View key={c.id} style={s.row}>
              <TouchableOpacity style={s.rowHead} onPress={() => { setOpenId(open ? null : c.id); setCancelId(null); setReason(""); }} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                <View style={[s.rowIcon, { backgroundColor: col.bg }]}>
                  <Ionicons name={(c.status === "SIGNED" ? "checkmark-done" : "document-text") as any} size={18} color={col.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowTitle, { fontFamily: T.font.sans }]} numberOfLines={2}>{c.reference} · {termsHeadline(c.type, c.terms)}</Text>
                  <Text style={[s.rowSub, { fontFamily: T.font.sans }]} numberOfLines={2}>
                    {c.status === "SIGNED" ? `Signé le ${formatDay(c.signedAt)} par ${c.signerName ?? ""}` : `Créé le ${formatDay(c.createdAt)}`}
                  </Text>
                </View>
                <View style={[s.pill, { backgroundColor: col.bg }]}>
                  <Text style={[s.pillTxt, { fontFamily: T.font.sans, color: col.fg }]}>{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={T.inkMuted} />
              </TouchableOpacity>

              {open && (
                <View style={s.rowBody}>
                  <Text style={[s.detail, { fontFamily: T.font.sans }]}>
                    {CONTRACT_KIND_LABEL[c.type]} · envoyé à {c.recipientEmail}
                    {c.sentAt ? ` le ${formatDay(c.sentAt)}` : ""}
                    {c.reminderCount > 0 ? ` · ${c.reminderCount} relance${c.reminderCount > 1 ? "s" : ""}` : ""}
                  </Text>
                  {c.status === "PENDING" && <Text style={[s.detail, { fontFamily: T.font.sans }]}>Lien valable jusqu'au {formatDay(c.tokenExpiresAt)}.</Text>}
                  {c.status === "EXPIRED" && <Text style={[s.detail, { fontFamily: T.font.sans, color: T.amber }]}>Le lien de signature a expiré : renvoyez-en un nouveau.</Text>}
                  {c.status === "CANCELLED" && <Text style={[s.detail, { fontFamily: T.font.sans, color: T.red }]}>Annulé le {formatDay(c.cancelledAt)}.</Text>}

                  <View style={s.actions}>
                    <Action icon="document-outline" text={c.status === "SIGNED" ? "PDF signé" : "Aperçu PDF"} busyKey={`${c.id}:pdf`} onPress={() => pdf(c)} />
                    {canResend && <Action icon="mail-outline" text="Renvoyer le lien" busyKey={`${c.id}:resend`} onPress={() => confirmResend(c)} />}
                    {c.status === "SIGNED" && <Action icon="paper-plane-outline" text="Renvoyer le signé" busyKey={`${c.id}:signed`} onPress={() => resendSigned(c)} />}
                    {canResend && <Action icon="close-circle-outline" text="Annuler" tone="red" busyKey={`${c.id}:cancel-open`} onPress={() => setCancelId(cancelId === c.id ? null : c.id)} />}
                  </View>

                  {cancelId === c.id && (
                    <View style={s.cancelBox}>
                      <Text style={[s.cancelLbl, { fontFamily: T.font.sans }]}>Motif (facultatif)</Text>
                      <TextInput
                        style={[s.input, { fontFamily: T.font.sans }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                        value={reason}
                        onChangeText={(v) => setReason(v.slice(0, 300))}
                        placeholder="Ex : erreur sur le montant"
                        placeholderTextColor={T.inkMuted}
                        maxLength={300}
                        editable={actionBusy === null}
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity style={[s.dangerBtn, actionBusy !== null && { opacity: 0.6 }]} onPress={() => cancel(c)} disabled={actionBusy !== null} accessibilityRole="button">
                        {actionBusy === `${c.id}:cancel`
                          ? <ActivityIndicator size="small" color={T.white} />
                          : <Text style={[s.dangerTxt, { fontFamily: T.font.sans }]}>Confirmer l'annulation</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Émission */}
      {!issuing ? (
        !hasRccm ? (
          <TouchableOpacity style={s.warn} onPress={onEditRccm} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Renseigner le numéro RCCM">
            <Ionicons name="alert-circle-outline" size={20} color={T.amber} />
            <View style={{ flex: 1 }}>
              <Text style={[s.warnTitle, { fontFamily: T.font.sans }]}>Numéro RCCM requis pour émettre un contrat</Text>
              <Text style={[s.warnTxt, { fontFamily: T.font.sans }]}>Il figure dans le contrat. Touchez pour le renseigner.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={T.amber} />
          </TouchableOpacity>
        ) : blocking ? (
          <Text style={[s.footnote, { fontFamily: T.font.sans }]}>
            Un contrat ({blocking.reference}) attend la signature : renvoyez son lien ou annulez-le avant d'en émettre un autre.
          </Text>
        ) : (
          <TouchableOpacity style={s.addBtn} onPress={() => { setMsg(null); setLink(null); setKind(defaultKind); setIssuing(true); }} accessibilityRole="button" accessibilityLabel="Émettre un contrat">
            <Ionicons name="add-circle-outline" size={18} color={T.blue} />
            <Text style={[s.addTxt, { fontFamily: T.font.sans }]}>Émettre un contrat</Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={s.panel}>
          <Text style={[s.panelLabel, { fontFamily: T.font.sans }]}>TYPE DE CONTRAT</Text>
          <View style={s.kinds}>
            {(["RENTAL", "PURCHASE"] as ContractKind[]).map((k) => {
              const on = kind === k;
              return (
                <TouchableOpacity key={k} style={[s.kind, on && s.kindOn]} onPress={() => { setKind(k); setErrors({}); }} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.kindTxt, { fontFamily: T.font.sans }, on && { color: T.blue }]}>{CONTRACT_KIND_LABEL[k]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {defaultEmail ? (
            <Text style={[s.footnote, { fontFamily: T.font.sans, textAlign: "left", marginTop: 0, marginBottom: 12 }]}>
              Le lien de signature sera envoyé à {defaultEmail}.
            </Text>
          ) : null}

          <ContractTermsFields kind={kind} value={terms} errors={errors} onChange={(patch) => setTerms((t) => ({ ...t, ...patch }))} disabled={busy} />

          {!!problem && (
            <View style={[s.notice, s.noticeErr, { marginBottom: 12 }]}>
              <Ionicons name="alert-circle" size={16} color={T.red} />
              <Text style={[s.noticeTxt, { fontFamily: T.font.sans, color: T.red }]}>{problem}</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setIssuing(false); setProblem(null); setErrors({}); }} disabled={busy}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.sendBtn, busy && { opacity: 0.6 }]} onPress={issue} disabled={busy} accessibilityRole="button">
              {busy
                ? <ActivityIndicator size="small" color={T.white} />
                : <><Ionicons name="mail-outline" size={17} color={T.white} /><Text style={[s.sendTxt, { fontFamily: T.font.sans }]}>Émettre et envoyer</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  notice:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 12 },
  noticeOk:  { backgroundColor: T.greenLt, borderColor: T.green + "40" },
  noticeErr: { backgroundColor: T.redLt, borderColor: T.red + "40" },
  noticeTxt: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 17 },

  linkBox:   { padding: 12, marginBottom: 12, borderRadius: T.radius.md, backgroundColor: T.greenLt + "90", borderWidth: 1, borderColor: T.green + "40" },
  linkTitle: { flex: 1, fontSize: 13, fontWeight: "800", color: T.ink },
  linkHint:  { fontSize: 11, fontWeight: "600", color: T.inkSub, marginBottom: 6 },
  linkUrl:   { fontSize: 11, color: T.ink, backgroundColor: T.surface, padding: 8, borderRadius: T.radius.sm, borderWidth: 1, borderColor: T.border },
  linkBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
  linkBtnTxt:{ fontSize: 12, fontWeight: "800", color: T.blue },

  empty:     { alignItems: "center", paddingVertical: 18, gap: 8 },
  emptyTxt:  { fontSize: 13, color: T.inkMuted, fontWeight: "600" },

  row:       { marginBottom: 8, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, overflow: "hidden" },
  rowHead:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  rowIcon:   { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rowTitle:  { fontSize: 13, fontWeight: "800", color: T.ink },
  rowSub:    { fontSize: 11, fontWeight: "600", color: T.inkSub, marginTop: 2 },
  pill:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, maxWidth: 96 },
  pillTxt:   { fontSize: 9, fontWeight: "900", textAlign: "center" },
  rowBody:   { padding: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.pageBg },
  detail:    { fontSize: 12, fontWeight: "600", color: T.inkSub, lineHeight: 17, marginTop: 6 },
  actions:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  action:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: T.radius.md, borderWidth: 1 },
  actionTxt: { fontSize: 12, fontWeight: "800" },
  cancelBox: { marginTop: 12 },
  cancelLbl: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  input:     { paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontWeight: "600", color: T.ink, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, marginBottom: 10 },
  dangerBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: T.radius.md, backgroundColor: T.red },
  dangerTxt: { fontSize: 13, fontWeight: "900", color: T.white },

  addBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, marginTop: 4, borderRadius: T.radius.md, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd },
  addTxt:    { fontSize: 13, fontWeight: "800", color: T.blue },
  warn:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 4, borderRadius: T.radius.md, backgroundColor: T.amberLt, borderWidth: 1, borderColor: T.amber + "40" },
  warnTitle: { fontSize: 13, fontWeight: "800", color: T.amber },
  warnTxt:   { fontSize: 11, fontWeight: "600", color: T.inkSub, marginTop: 2, lineHeight: 15 },
  footnote:  { fontSize: 11, fontWeight: "600", color: T.inkSub, textAlign: "center", marginTop: 8, lineHeight: 16 },

  panel:      { marginTop: 6, padding: 12, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border },
  panelLabel: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8 },
  kinds:      { flexDirection: "row", gap: 8, marginBottom: 12 },
  kind:       { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  kindOn:     { backgroundColor: T.blueLt, borderColor: T.blueMd },
  kindTxt:    { fontSize: 12, fontWeight: "800", color: T.inkSub, textAlign: "center" },
  cancelBtn:  { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  cancelTxt:  { fontSize: 13, fontWeight: "800", color: T.inkSub },
  sendBtn:    { flex: 1.6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: T.radius.md, backgroundColor: T.blue },
  sendTxt:    { fontSize: 13, fontWeight: "900", color: T.white },
});
