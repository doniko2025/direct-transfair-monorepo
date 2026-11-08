// apps/direct-transfair-mobile/app/merchant/closing.tsx
// =========================================================
// CLÔTURE DE CAISSE & EXPORTS v1.0 — Lot 13
//  • Journée en direct (par devise) : paiements, commissions, remboursements, détail par moyen et par caissier.
//  • « Clôturer la journée » : photo figée des totaux, code secret exigé, une fois par jour et par devise.
//  • Exports d'une période : PDF (rapport complet) ou CSV (Excel), générés sur l'appareil.
//  • Historique des clôtures. Le jour est celui de l'appareil (fuseau horaire du marchand).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { shareCsv, shareDayPdf, shareReportPdf } from "../../services/merchantDocs";
import type { ClosingView, CurrencyTotalsView, DayView } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, Chip, Divider, EmptyView, ErrorView, IconButton, NavBar, Notice, Pill, Screen, SectionHeader, Sheet, SkeletonRows, UText, useUI } from "../../components/ui";
import { PinPrompt, Rise, apiProblem, money, shortDateTime } from "../../components/merchant/merchantUi";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (day: string, n: number) => { const [y, m, d] = day.split("-").map(Number); return ymd(new Date(y!, m! - 1, d! + n)); };
const dayLabel = (day: string, today: string) => {
  if (day === today) return "Aujourd'hui";
  if (day === addDays(today, -1)) return "Hier";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long" });
};

type Range = "today" | "7" | "30" | "month";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Aujourd'hui" }, { key: "7", label: "7 jours" }, { key: "30", label: "30 jours" }, { key: "month", label: "Ce mois" },
];
function rangeOf(r: Range, today: string): { from: string; to: string } {
  if (r === "today") return { from: today, to: today };
  if (r === "7") return { from: addDays(today, -6), to: today };
  if (r === "30") return { from: addDays(today, -29), to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "pos" | "danger" | "ink" }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 }}>
      <UText v="body" tone="muted" style={{ flexShrink: 1 }}>{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} tone={tone}>{value}</UText>
    </View>
  );
}

function TotalsCard({ t, closed }: { t: CurrencyTotalsView; closed: boolean }) {
  const { C } = useUI();
  const methods = [["Téléphone", t.byMethod.PHONE], ["QR code", t.byMethod.QR], ["QR de caisse", t.byMethod.STATIC_QR]] as const;
  return (
    <Card pad={18} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <UText v="caption" tone="muted">Variation du solde · {t.currency}</UText>
        <Pill label={closed ? "Clôturée" : "En cours"} tone={closed ? "pos" : "warn"} icon={closed ? "lock-closed-outline" : "time-outline"} />
      </View>
      <UText v="hero" style={{ marginVertical: 6 }}>{money(t.balanceChange, t.currency)}</UText>
      <Divider />
      <Line label="Paiements encaissés" value={String(t.count)} />
      <Line label="Payé par les clients" value={money(t.gross, t.currency)} />
      <Line label="Commissions" value={`− ${money(t.fees, t.currency)}`} />
      <Line label="Net encaissé" value={money(t.net, t.currency)} strong />
      <Line label={`Remboursements (${t.refundsCount})`} value={`− ${money(t.refundsTotal, t.currency)}`} tone={t.refundsTotal > 0 ? "danger" : undefined} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {methods.map(([l, n]) => (
          <View key={l} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: C.beige, justifyContent: "center" }}>
            <UText v="caption">{l} · {n}</UText>
          </View>
        ))}
      </View>
      {t.byCashierNamed.length > 0 && (t.byCashierNamed.length > 1 || !!t.byCashierNamed[0]?.userId) ? (
        <View style={{ marginTop: 10 }}>
          <UText v="caption" tone="muted" style={{ marginBottom: 2 }}>Par personne</UText>
          {t.byCashierNamed.map((c) => (
            <Line key={c.userId ?? "owner"} label={`${c.name} · ${c.count}`} value={money(c.gross, t.currency)} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function ClosingScreen() {
  const router = useRouter();
  const { C } = useUI();
  const today = useMemo(() => ymd(new Date()), []);
  const [day, setDay] = useState(today);
  const [range, setRange] = useState<Range>("today");
  const [busy, setBusy] = useState<"pdf" | "csv" | "day" | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [closing, setClosing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, h, me] = await Promise.all([api.getMerchantDay(day), api.listMerchantClosings(), api.getMerchantMe()]);
    return { d, h, me };
  }, [day]);
  const { data, status, error, reload } = useLoader(load);
  // useLoader ne suit pas les paramètres : on relance le chargement à chaque changement de jour (le 1er est fait au focus).
  const firstDay = useRef(true);
  useEffect(() => { if (firstDay.current) { firstDay.current = false; return; } reload(); }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  const logo = useMerchantLogo(data?.me.profile?.shopId, data?.me.profile?.logoVersion);

  const closedCur = new Set((data?.d.closings ?? []).map((c) => c.currency));
  const toClose = (data?.d.live ?? []).filter((t) => !closedCur.has(t.currency));
  const canClose = !!data && data.d.day === day && toClose.length > 0 && day <= today;

  const doClose = async (code: string) => {
    if (closing || code.length !== 6) return;
    setClosing(true);
    setProblem(null);
    try {
      await api.closeMerchantDay({ day, pin: code });
      setCloseOpen(false);
      setPin("");
      setNotice(`Journée du ${day} clôturée.`);
      reload();
    } catch (e) {
      setProblem(apiProblem(e).message);
      setPin("");
    } finally {
      setClosing(false);
    }
  };

  const exportPdf = async () => {
    setBusy("pdf");
    try { const { from, to } = rangeOf(range, today); await shareReportPdf(await api.getMerchantReport(from, to), logo); }
    catch (e) { setNotice(apiProblem(e).message); }
    finally { setBusy(null); }
  };
  const exportCsv = async () => {
    setBusy("csv");
    try { const { from, to } = rangeOf(range, today); await shareCsv(await api.getMerchantReportCsv(from, to)); }
    catch (e) { setNotice(apiProblem(e).message); }
    finally { setBusy(null); }
  };
  const dayPdf = async (d: DayView) => { setBusy("day"); try { await shareDayPdf(d, logo); } finally { setBusy(null); } };

  const header = <NavBar onBack={() => router.back()} title="Clôture & exports" subtitle={data?.me.profile?.businessName} />;
  if (status === "loading") return <Screen header={header}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  const { d, h } = data;
  const stale = d.day !== day; // le jour affiché n'est pas encore celui demandé

  return (
    <Screen header={header} footer={canClose ? <Button label="Clôturer la journée" icon="lock-closed-outline" onPress={() => { setProblem(null); setPin(""); setCloseOpen(true); }} /> : undefined}>
      {!!notice && <Notice tone="info" style={{ marginBottom: 12 }}>{notice}</Notice>}

      <Rise>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <IconButton icon="chevron-back" label="Jour précédent" onPress={() => { setNotice(null); setDay(addDays(day, -1)); }} />
          <UText v="subheading">{dayLabel(day, today)}</UText>
          {day < today ? <IconButton icon="chevron-forward" label="Jour suivant" onPress={() => { setNotice(null); setDay(addDays(day, 1)); }} /> : <View style={{ width: 44, height: 44 }} />}
        </View>
      </Rise>

      {d.drift && <Notice tone="warn" style={{ marginBottom: 12 }}>Des mouvements (paiement tardif ou remboursement) sont arrivés après la clôture de cette journée. Les chiffres ci-dessous sont à jour ; la clôture archivée reste inchangée.</Notice>}

      {stale ? <SkeletonRows rows={2} /> : d.live.length === 0 ? (
        <EmptyView icon="receipt-outline" title="Aucun encaissement" message="Aucun paiement ni remboursement ce jour-là." />
      ) : (
        d.live.map((t) => <TotalsCard key={t.currency} t={t} closed={closedCur.has(t.currency)} />)
      )}

      {d.live.length > 0 && !stale && <Button label="Relevé du jour (PDF)" icon="document-text-outline" kind="outline" loading={busy === "day"} onPress={() => dayPdf(d)} />}

      <SectionHeader title="Exporter une période" />
      <Card pad={16}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {RANGES.map((r) => <Chip key={r.key} label={r.label} active={range === r.key} onPress={() => setRange(r.key)} />)}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button label="PDF" icon="document-text-outline" small loading={busy === "pdf"} onPress={exportPdf} /></View>
          <View style={{ flex: 1 }}><Button label="CSV (Excel)" icon="download-outline" kind="outline" small loading={busy === "csv"} onPress={exportCsv} /></View>
        </View>
        <UText v="caption" tone="muted" style={{ marginTop: 10 }}>Paiements et remboursements, avec commissions et caissiers. Les montants remboursés sont en négatif.</UText>
      </Card>

      <SectionHeader title="Clôtures passées" />
      {h.length === 0 ? (
        <UText v="body" tone="muted">Aucune clôture pour le moment.</UText>
      ) : (
        <Card pad={4}>
          {h.slice(0, 30).map((c: ClosingView, i) => (
            <View key={c.id} style={{ paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: i === Math.min(h.length, 30) - 1 ? 0 : 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="lock-closed-outline" size={18} color={C.muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <UText v="bodyStrong" numberOfLines={1}>{c.day} · {c.currency}</UText>
                <UText v="caption" tone="muted" numberOfLines={1}>{c.count} paiement(s) · clôturée {shortDateTime(c.closedAt)}</UText>
              </View>
              <UText v="bodyStrong">{money(c.balanceChange, c.currency)}</UText>
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={closeOpen} onClose={() => setCloseOpen(false)} title={`Clôturer le ${day}`}>
        <UText v="body" tone="muted" style={{ marginBottom: 12 }}>
          Les totaux de {toClose.map((t) => t.currency).join(", ")} seront figés dans l'historique. Cette action ne peut pas être refaite pour cette journée.
        </UText>
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <PinPrompt value={pin} onChange={setPin} onComplete={doClose} autoFocus />
        <View style={{ height: 12 }} />
        <Button label="Clôturer" loading={closing} disabled={pin.length !== 6} onPress={() => doClose(pin)} />
      </Sheet>
    </Screen>
  );
}
