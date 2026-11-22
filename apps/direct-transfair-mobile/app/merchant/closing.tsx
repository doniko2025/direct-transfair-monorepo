// apps/direct-transfair-mobile/app/merchant/closing.tsx
// =========================================================
// CLÔTURE DE CAISSE & EXPORTS v1.0 — Lot 13
//  • Journée en direct (par devise) : paiements, commissions, remboursements, détail par moyen et par caissier.
//  • « Clôturer la journée » : photo figée des totaux, code secret exigé, une fois par jour et par devise.
//  • Exports d'une période : PDF (rapport complet) ou CSV (Excel), générés sur l'appareil.
//  • Historique des clôtures. Le jour est celui de l'appareil (fuseau horaire du marchand).
// v1.1 : REDESIGN — bandeau de la journée (navigation + chiffres clés), période choisie dans une LISTE (aujourd'hui, hier, 7 j, 30 j,
//        ce mois, mois dernier, dates libres), format PDF / CSV en deux tuiles + un seul bouton d'export, clôtures passées en cartes
//        compactes avec accès direct au PDF du jour. Données, calculs et exports INCHANGÉS.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { shareCsv, shareDayPdf, shareReportPdf } from "../../services/merchantDocs";
import type { ClosingView, CurrencyTotalsView, DayView } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";
import { Ionicons } from "../../components/ui/Icon";
import { Button, Card, ErrorView, NavBar, Notice, Pill, Screen, SectionHeader, Sheet, SkeletonRows, UText, useUI } from "../../components/ui";
import { Text } from "../../components/ui/Text";
import { alpha, shade } from "../../components/ui/Tint";
import { PinPrompt, Rise, apiProblem, money, shortDateTime } from "../../components/merchant/merchantUi";
import { useT } from "../../providers/I18nProvider";
import { getLocale, tr } from "../../i18n/runtime";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (day: string, n: number) => { const [y, m, d] = day.split("-").map(Number); return ymd(new Date(y!, m! - 1, d! + n)); };

type Range = "today" | "yesterday" | "7" | "30" | "month" | "lastMonth" | "custom";
const RANGES: Range[] = ["today", "yesterday", "7", "30", "month", "lastMonth", "custom"];
const rangeTitle = (r: Range): string => ({
  today: tr("mcl.today"), yesterday: tr("mcl.yesterday"), "7": tr("mcl.r7"), "30": tr("mcl.r30"), month: tr("mcl.rMonth"), lastMonth: tr("mcl.rLastMonth"), custom: tr("mcl.rCustom"),
}[r]);
function rangeOf(r: Range, today: string, custom: { from: string; to: string }): { from: string; to: string } {
  if (r === "today") return { from: today, to: today };
  if (r === "yesterday") { const y = addDays(today, -1); return { from: y, to: y }; }
  if (r === "7") return { from: addDays(today, -6), to: today };
  if (r === "30") return { from: addDays(today, -29), to: today };
  if (r === "lastMonth") {
    const [y, m] = today.split("-").map(Number);
    return { from: ymd(new Date(y!, m! - 2, 1)), to: ymd(new Date(y!, m! - 1, 0)) };
  }
  if (r === "custom") return custom;
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
const parseDay = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(y!, m! - 1, d!); };
const fmtShort = (day: string) => parseDay(day).toLocaleDateString(getLocale(), { day: "numeric", month: "short" });
const fmtFull = (day: string) => parseDay(day).toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
/** « 20 nov. 2026 » pour un jour, « 14 – 20 nov. » pour une plage. */
const rangeSub = ({ from, to }: { from: string; to: string }) => (from === to ? fmtFull(from) : `${fmtShort(from)} – ${fmtShort(to)}`);

/** Case « libellé au-dessus, valeur dessous ». */
function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "accent" }) {
  const { C } = useUI();
  return (
    <View style={{ width: "48%", flexGrow: 1, minWidth: 0 }}>
      <UText v="caption" tone="muted" numberOfLines={1}>{label}</UText>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14.5, fontWeight: "800", marginTop: 1, color: tone === "danger" ? C.danger : tone === "accent" ? C.accentDeep : C.text }}>{value.replace(/\s/g, "\u00A0")}</Text>
    </View>
  );
}

function TotalsCard({ tot, closed }: { tot: CurrencyTotalsView; closed: boolean }) {
  const t = useT();
  const { C } = useUI();
  const methods = [[t("mcl.mPhone"), tot.byMethod.PHONE, "call-outline"], [t("mcl.mQr"), tot.byMethod.QR, "qr-code-outline"], [t("mcl.mStatic"), tot.byMethod.STATIC_QR, "storefront-outline"]] as const;
  return (
    <Card pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: C.accentSoft, justifyContent: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: C.accentDeep }}>{tot.currency}</Text>
          </View>
          <UText v="caption" tone="muted">{t("mcl.balanceChange", { currency: "" }).replace(/\s*·\s*$/, "")}</UText>
        </View>
        <Pill label={closed ? t("mcl.closed") : t("mcl.open")} tone={closed ? "pos" : "warn"} icon={closed ? "lock-closed-outline" : "time-outline"} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 6, color: C.text }}>{money(tot.balanceChange, tot.currency).replace(/\s/g, "\u00A0")}</Text>
      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 12 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 10 }}>
        <Stat label={t("mcl.count")} value={String(tot.count)} />
        <Stat label={t("mcl.gross")} value={money(tot.gross, tot.currency)} />
        <Stat label={t("mcl.fees")} value={`− ${money(tot.fees, tot.currency)}`} />
        <Stat label={t("mcl.net")} value={money(tot.net, tot.currency)} tone="accent" />
        <Stat label={t("mcl.refunds", { n: tot.refundsCount })} value={`− ${money(tot.refundsTotal, tot.currency)}`} tone={tot.refundsTotal > 0 ? "danger" : undefined} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {methods.map(([l, n, ic]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.sunken }}>
            <Ionicons name={ic as any} size={13} color={C.muted} />
            <UText v="caption">{l} · {n}</UText>
          </View>
        ))}
      </View>
      {tot.byCashierNamed.length > 0 && (tot.byCashierNamed.length > 1 || !!tot.byCashierNamed[0]?.userId) ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <UText v="caption" tone="muted">{t("mcl.byPerson")}</UText>
          {tot.byCashierNamed.map((c) => (
            <View key={c.userId ?? "owner"} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11.5, fontWeight: "800", color: C.accentDeep }}>{c.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <UText v="body" numberOfLines={1} style={{ flex: 1 }}>{c.name} · {c.count}</UText>
              <UText v="bodyStrong">{money(c.gross, tot.currency)}</UText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** Bouton rond (flèches du jour) posé sur le bandeau. */
function RoundBtn({ icon, label, onPress, hidden, ink }: { icon: string; label: string; onPress: () => void; hidden?: boolean; ink: string }) {
  if (hidden) return <View style={{ width: 38, height: 38 }} />;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: alpha(ink, pressed ? 0.3 : 0.18), alignItems: "center", justifyContent: "center" })}>
      <Ionicons name={icon as any} size={19} color={ink} />
    </Pressable>
  );
}

/** Tuile de format (PDF / CSV) : la tuile choisie est colorée. */
function FormatTile({ icon, label, on, onPress }: { icon: string; label: string; on: boolean; onPress: () => void }) {
  const { C } = useUI();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.accent : C.lineStrong, backgroundColor: on ? C.accentSoft : C.surface, paddingVertical: 10, alignItems: "center", gap: 3 }}>
        <Ionicons name={icon as any} size={21} color={on ? C.accentDeep : C.muted} />
        <Text style={{ fontSize: 12.5, fontWeight: "800", color: on ? C.accentDeep : C.text }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Sélecteur de dates libres : deux lignes « Du / Au » avec flèches, sans bibliothèque de calendrier. */
function DayStepper({ label, value, onChange, min, max }: { label: string; value: string; onChange: (d: string) => void; min?: string; max: string }) {
  const { C } = useUI();
  const canPrev = !min || value > min;
  const canNext = value < max;
  const btn = (icon: string, ok: boolean, onPress: () => void) => (
    <Pressable disabled={!ok} onPress={onPress} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center", opacity: ok ? 1 : 0.35 }}>
      <Ionicons name={icon as any} size={18} color={C.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <UText v="body" tone="muted" style={{ width: 36 }}>{label}</UText>
      {btn("chevron-back", canPrev, () => onChange(addDays(value, -1)))}
      <UText v="bodyStrong" align="center" style={{ flex: 1 }}>{fmtFull(value)}</UText>
      {btn("chevron-forward", canNext, () => onChange(addDays(value, 1)))}
    </View>
  );
}

export default function ClosingScreen() {
  const t = useT();
  const router = useRouter();
  const { C } = useUI();
  const today = useMemo(() => ymd(new Date()), []);
  const [day, setDay] = useState(today);
  const [range, setRange] = useState<Range>("today");
  const [custom, setCustom] = useState({ from: addDays(ymd(new Date()), -6), to: ymd(new Date()) });
  const [periodOpen, setPeriodOpen] = useState(false);
  const [fmt, setFmt] = useState<"pdf" | "csv">("pdf");
  const [rowPdf, setRowPdf] = useState<string | null>(null);
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
  const toClose = (data?.d.live ?? []).filter((x) => !closedCur.has(x.currency));
  const canClose = !!data && data.d.day === day && toClose.length > 0 && day <= today;

  const doClose = async (code: string) => {
    if (closing || code.length !== 6) return;
    setClosing(true);
    setProblem(null);
    try {
      await api.closeMerchantDay({ day, pin: code });
      setCloseOpen(false);
      setPin("");
      setNotice(t("mcl.dayClosed", { day }));
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
    try { const { from, to } = rangeOf(range, today, custom); await shareReportPdf(await api.getMerchantReport(from, to), logo); }
    catch (e) { setNotice(apiProblem(e).message); }
    finally { setBusy(null); }
  };
  const exportCsv = async () => {
    setBusy("csv");
    try { const { from, to } = rangeOf(range, today, custom); await shareCsv(await api.getMerchantReportCsv(from, to)); }
    catch (e) { setNotice(apiProblem(e).message); }
    finally { setBusy(null); }
  };
  const dayPdf = async (d: DayView) => { setBusy("day"); try { await shareDayPdf(d, logo); } finally { setBusy(null); } };
  /** PDF d'une journée déjà clôturée (depuis la liste des clôtures). */
  const closingPdf = async (c: ClosingView) => {
    setRowPdf(c.id);
    try { await shareDayPdf(await api.getMerchantDay(c.day), logo); }
    catch (e) { setNotice(apiProblem(e).message); }
    finally { setRowPdf(null); }
  };

  const header = <NavBar onBack={() => router.back()} title={t("mcl.title")} subtitle={data?.me.profile?.businessName} />;
  if (status === "loading") return <Screen header={header}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? t("mx.error")} message={error?.message ?? t("mx.loadFail")} onRetry={reload} /></Screen>;
  }
  const { d, h } = data;
  const stale = d.day !== day; // le jour affiché n'est pas encore celui demandé

  const sel = rangeOf(range, today, custom);
  const ink = C.accentInk;
  const one = d.live.length === 1 ? d.live[0]! : null;
  const dayFull = parseDay(day).toLocaleDateString(getLocale(), { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const dayKicker = day === today ? t("mcl.today") : day === addDays(today, -1) ? t("mcl.yesterday") : t("mcl.dayOf");

  return (
    <Screen header={header} footer={canClose ? <Button label={t("mcl.closeDay")} icon="lock-closed-outline" onPress={() => { setProblem(null); setPin(""); setCloseOpen(true); }} /> : undefined}>
      {!!notice && <Notice tone="info" style={{ marginBottom: 12 }}>{notice}</Notice>}

      {/* ── Bandeau de la journée ── */}
      <Rise>
        <View style={{ borderRadius: 22, overflow: "hidden" }}>
          <LinearGradient colors={[C.accent, shade(C.accent, 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ position: "absolute", right: -30, top: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: alpha(ink, 0.08) }} />
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <RoundBtn ink={ink} icon="chevron-back" label={t("mcl.prevDay")} onPress={() => { setNotice(null); setDay(addDays(day, -1)); }} />
              <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 6 }}>
                <Text style={{ color: ink, opacity: 0.8, fontSize: 11.5, fontWeight: "700" }}>{dayKicker}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: ink, fontSize: 16.5, fontWeight: "800", textTransform: "capitalize" }}>{dayFull}</Text>
              </View>
              <RoundBtn ink={ink} icon="chevron-forward" label={t("mcl.nextDay")} hidden={day >= today} onPress={() => { setNotice(null); setDay(addDays(day, 1)); }} />
            </View>
            {stale ? (
              <View style={{ height: 58 }} />
            ) : one ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {([[t("mcl.kCollected"), money(one.net, one.currency), 0.14], [t("mcl.kRefunded"), money(one.refundsTotal, one.currency), 0.14], [t("mcl.kChange"), money(one.balanceChange, one.currency), 0.24]] as const).map(([l, v, a]) => (
                  <View key={l} style={{ flex: 1, minWidth: 0, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: alpha(ink, a) }}>
                    <Text numberOfLines={1} style={{ color: ink, opacity: 0.8, fontSize: 11 }}>{l}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: ink, fontSize: 14.5, fontWeight: "800", marginTop: 2 }}>{v.replace(/\s/g, "\u00A0")}</Text>
                  </View>
                ))}
              </View>
            ) : d.live.length === 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <Ionicons name={"receipt-outline" as any} size={16} color={ink} />
                <Text style={{ color: ink, opacity: 0.9, fontSize: 12.5, flex: 1 }}>{t("mcl.emptyMsg")}</Text>
              </View>
            ) : (
              <View style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: alpha(ink, 0.16), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: ink, fontSize: 12.5, fontWeight: "700" }}>{d.live.map((x) => x.currency).join(" · ")}</Text>
              </View>
            )}
          </View>
        </View>
      </Rise>

      {d.drift && <Notice tone="warn" style={{ marginTop: 10 }}>{t("mcl.drift")}</Notice>}

      {!stale && d.live.map((x) => <TotalsCard key={x.currency} tot={x} closed={closedCur.has(x.currency)} />)}
      {d.live.length > 0 && !stale && <Button label={t("mcl.dayPdf")} icon="document-text-outline" kind="outline" small loading={busy === "day"} onPress={() => dayPdf(d)} style={{ marginTop: 10 }} />}

      {/* ── Exporter une période : liste de périodes + format + un seul bouton ── */}
      <SectionHeader title={t("mcl.exportTitle")} />
      <Card pad={14}>
        <UText v="caption" tone="muted" style={{ marginBottom: 6 }}>{t("mcl.period")}</UText>
        <Pressable onPress={() => setPeriodOpen(true)} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.accentSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Ionicons name={"calendar-outline" as any} size={19} color={C.accentDeep} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <UText v="bodyStrong" numberOfLines={1}>{rangeTitle(range)}</UText>
              <UText v="caption" tone="muted" numberOfLines={1}>{rangeSub(sel)}</UText>
            </View>
            <Ionicons name={"chevron-down" as any} size={18} color={C.muted} />
          </View>
        </Pressable>

        <UText v="caption" tone="muted" style={{ marginTop: 14, marginBottom: 6 }}>{t("mcl.format")}</UText>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
          <FormatTile icon="document-text-outline" label="PDF" on={fmt === "pdf"} onPress={() => setFmt("pdf")} />
          <FormatTile icon="grid-outline" label={t("mcl.csv")} on={fmt === "csv"} onPress={() => setFmt("csv")} />
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
          <Ionicons name={"information-circle-outline" as any} size={15} color={C.muted} />
          <UText v="caption" tone="muted" style={{ flex: 1 }}>{t("mcl.exportInfo")}</UText>
        </View>
        <Button
          label={t("mcl.exportAs", { fmt: fmt === "pdf" ? "PDF" : "CSV" })}
          icon="download-outline"
          loading={busy === fmt}
          disabled={!!busy}
          onPress={fmt === "pdf" ? exportPdf : exportCsv}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* ── Clôtures passées ── */}
      <SectionHeader title={t("mcl.pastTitle")} />
      {h.length === 0 ? (
        <View style={{ borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.lineStrong, padding: 18, alignItems: "center", gap: 6 }}>
          <Ionicons name={"lock-closed-outline" as any} size={22} color={C.muted} />
          <UText v="body" tone="muted" align="center">{t("mcl.pastNone")}</UText>
        </View>
      ) : (
        h.slice(0, 30).map((c: ClosingView, i) => (
          <Rise key={c.id} delay={Math.min(i, 6) * 40}>
            <Card pad={12} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={"lock-closed-outline" as any} size={18} color={C.accentDeep} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <UText v="bodyStrong" numberOfLines={1}>{fmtFull(c.day)} · {c.currency}</UText>
                  <UText v="caption" tone="muted" numberOfLines={1}>{t("mcl.pastRow", { n: c.count, date: shortDateTime(c.closedAt) })}</UText>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <UText v="bodyStrong">{money(c.balanceChange, c.currency)}</UText>
                  <Pressable onPress={() => closingPdf(c)} disabled={rowPdf === c.id} hitSlop={8} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: rowPdf === c.id ? 0.5 : 1 }}>
                    <Ionicons name={"download-outline" as any} size={13} color={C.accentDeep} />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: C.accentDeep }}>{rowPdf === c.id ? "…" : "PDF"}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          </Rise>
        ))
      )}

      {/* ── Liste des périodes ── */}
      <Sheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title={t("mcl.pickPeriod")}>
        {RANGES.map((r) => {
          const on = range === r;
          const sub = r === "custom" ? null : rangeSub(rangeOf(r, today, custom));
          return (
            <Pressable key={r} onPress={() => { setRange(r); if (r !== "custom") setPeriodOpen(false); }} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: on ? C.accentSoft : "transparent" }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.accent : C.lineStrong, alignItems: "center", justifyContent: "center" }}>
                  {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />}
                </View>
                <UText v={on ? "bodyStrong" : "body"} style={{ flex: 1 }}>{rangeTitle(r)}</UText>
                {sub ? <UText v="caption" tone="muted">{sub}</UText> : <Ionicons name={"calendar-outline" as any} size={18} color={C.muted} />}
              </View>
            </Pressable>
          );
        })}
        {range === "custom" && (
          <View style={{ marginTop: 8 }}>
            <DayStepper label={t("mcl.from")} value={custom.from} max={custom.to} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
            <DayStepper label={t("mcl.to")} value={custom.to} min={custom.from} max={today} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
            <Button label={t("mcl.apply")} onPress={() => setPeriodOpen(false)} style={{ marginTop: 10 }} />
          </View>
        )}
      </Sheet>

      <Sheet visible={closeOpen} onClose={() => setCloseOpen(false)} title={t("mcl.sheetTitle", { day })}>
        <UText v="body" tone="muted" style={{ marginBottom: 12 }}>
          {t("mcl.sheetMsg", { currencies: toClose.map((x) => x.currency).join(", ") })}
        </UText>
        {!!problem && <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice>}
        <PinPrompt value={pin} onChange={setPin} onComplete={doClose} autoFocus />
        <View style={{ height: 12 }} />
        <Button label={t("mcl.closeBtn")} loading={closing} disabled={pin.length !== 6} onPress={() => doClose(pin)} />
      </Sheet>
    </Screen>
  );
}
