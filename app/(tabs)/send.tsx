// apps/direct-transfair-mobile/app/(tabs)/send.tsx
// =========================================================
// SEND MONEY v7.0 — Direct Transf'air
// ✅ v7.0 : ENVOI ÉTAPE PAR ÉTAPE (esprit « Taptap Send ») — au lieu d'une seule page avec onglets Wallet / Cash, on avance page après page :
//  1) Wallet ou Cash Pickup (ignoré quand l'écran est ouvert avec ?mode=… : on part directement au destinataire) ;
//  2) Destinataire (Wallet : numéro / nom avec suggestions ; Cash Pickup : liste des bénéficiaires enregistrés + recherche) ;
//  3) Montant (saisie bidirectionnelle, taux, frais du serveur, montants rapides, solde insuffisant signalé tout de suite) ;
//  4) Motif (facultatif) ; 5) Vérification et confirmation ; puis une page de succès animée avec le code de retrait.
//  Transitions : la page sort en glissant et en fondu, la suivante arrive depuis la droite (depuis la gauche au retour) ; barre de
//  progression en segments et puces récapitulatives (type, destinataire, montant) qui apparaissent au fil des étapes. Retour : flèche
//  de l'en-tête ou bouton retour d'Android ; les animations sont coupées si l'option système « réduire les animations » est active.
//  COULEURS : 100 % dynamiques (useUI) — couleur principale / accent choisis par le super admin, thème clair / sombre.
//  LOGIQUE MÉTIER INCHANGÉE : détection du bénéficiaire, taux, saisie bidirectionnelle, frais (useFeeQuote), idempotence (runOnce),
//  solde, KYC, création des transactions Wallet / Cash Pickup, texte du reçu partagé. Le motif et le reçu ne sont plus des feuilles :
//  ce sont des pages du parcours.
// ✅ v6.0 : REFONTE VISUELLE « même allure que les autres pages » (UI kit : Screen, NavBar, Tabs, Card, Button, Sheet).
//  1) PASTILLE DE DEVISE : un rond portant le drapeau du pays remplace le texte « EUR » / « XOF » devant les montants
//     (components/ui/CurrencyBadge.tsx). Le code de devise reste lu par les lecteurs d'écran et affiché dans le récapitulatif.
//  2) PLUS DE LISTE « RÉCENTS » : à la place, UN bouton « Choisir un destinataire » qui ouvre une feuille à trois entrées :
//     « Mes bénéficiaires » (liste avec recherche), « Importer depuis mes contacts » (répertoire du téléphone) et
//     « Nouveau bénéficiaire ». La saisie directe du numéro / du nom reste possible, avec suggestions pendant la frappe.
//  3) ÉCRAN ALLÉGÉ : suppression de « Transfert sécurisé · Crypté de bout en bout » et des aides « Choisissez un bénéficiaire » /
//     « Saisissez le numéro du destinataire ». Seuls restent les avertissements utiles (aucun compte, taux indisponible).
//  4) BAS DE PAGE : le bouton d'action n'est plus collé à la barre de navigation du téléphone (marge de sécurité ajoutée).
//  5) Motif, pays/indicatif, solde insuffisant et reçu passent en feuilles basses du design system.
//  LOGIQUE MÉTIER INCHANGÉE : modes Wallet / Cash, saisie bidirectionnelle, détection du bénéficiaire, frais du serveur,
//  idempotence, reçu, solde insuffisant, KYC. Historique détaillé des versions précédentes : voir le dépôt git.
// ✅ v6.1 : FR / EN / PT — tous les textes passent par i18n/messages/transfer.ts. Le motif envoyé au serveur reste le texte français
//   (utils/motifs.ts) : seul son affichage est traduit. Montants et dates suivent la langue choisie.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, Pressable, ActivityIndicator, Platform, Alert, Share, LayoutAnimation, UIManager, Animated, Easing, Keyboard, BackHandler,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Contacts from "expo-contacts/legacy";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { handleKycRequired } from "../../utils/kycGate";
import { Ionicons } from "../../components/ui/Icon";
import { api } from "../../services/api";
import { runOnce } from "../../services/idempotency";
import { useFeeQuote } from "../../hooks/useFeeQuote";
import { useAuth } from "../../providers/AuthProvider";
import type { Beneficiary, ExchangeRate } from "../../services/types";
import { countriesList, CountryData } from "../../data/countries";
import { useTenant } from "../../providers/TenantProvider";
import {
  Avatar, Button, Card, Chip, IconButton, ListRow, NavBar, Notice, Pill, Screen, SearchPill, Sheet, UText, useUI,
} from "../../components/ui";
import Reveal from "../../components/flow/Reveal";
import { useReduceMotion } from "../../components/auth/AuthBackdrop";
import { ChoiceCard, RecapChips, StepProgress, type RecapChip } from "../../components/send/FlowParts";
import { ChoiceSheet } from "../../components/ui/ChoiceSheet";
import { CurrencyFlag } from "../../components/home/HomeParts";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../components/wallet/useLoader";
import {
  MIN_FULL_NUMBER, countryOfPhone, formatPhone, isNumericLike, nationalOf, onlyDigits, parseInternational, stripDial, toE164, toLegacyDoubled,
} from "../../utils/phone";
import {
  ceilTo, decimalsFor, fmtMoney, fmtRate, parseAmount, roundTo, sanitizeAmountInput, toInputText,
} from "../../utils/amount";
import { lookupRate } from "../../utils/rateLookup";
import { Text, TextInput } from "../../components/ui/Text";
import { SANS } from "../../components/ui/fonts";
import { useT } from "../../providers/I18nProvider";
import { tr, fmtDateTime } from "../../i18n/runtime";
import { MOTIFS, motifLabel } from "../../utils/motifs";

// Animation de l'échange des deux champs (Android : à activer explicitement ; sans effet si déjà géré par le système).
if (Platform.OS === "android") {
  try { UIManager.setLayoutAnimationEnabledExperimental?.(true); } catch { /* ignoré */ }
}

// Motifs du transfert : voir utils/motifs.ts (valeur française envoyée au serveur + libellé traduit).

const MAX_LIST_ROWS = 120;

// ─── Helpers ──────────────────────────────────────────────
// Match EXACT en priorité (« Guinée » ne doit pas retomber sur « Guinée-Bissau »), repli tolérant ensuite.
const getCountryData = (countryName: string): CountryData => {
  const normalized = (countryName || "").toLowerCase().trim();
  if (!normalized) return countriesList.find((c) => c.code === "SN")!;
  const exact = countriesList.find((c) => c.name.toLowerCase() === normalized);
  if (exact) return exact;
  return (
    countriesList.find((c) => c.name.toLowerCase().includes(normalized)) ||
    countriesList.find((c) => c.code === "SN")!
  );
};

// Taille des chiffres d'un montant : réduite quand le nombre s'allonge, pour qu'il reste lisible.
const amountFontSize = (text: string, base: number): number => {
  const n = text.length;
  if (n <= 9) return base;
  if (n <= 12) return Math.round(base * 0.8);
  return Math.round(base * 0.62);
};

// Formatage des montants centralisé (utils/amount.ts) : 2 décimales pour EUR/USD…, entiers pour XOF/GNF.
const fmt = (val: number, currency?: string): string => fmtMoney(val, currency);

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

// ─── Ligne de récapitulatif ───────────────────────────────
function Line({ label, value, tone, strong }: { label: string; value: string; tone?: "pos" | "info" | "danger"; strong?: boolean }) {
  const { C } = useUI();
  const color = tone === "pos" ? C.pos : tone === "info" ? C.info : tone === "danger" ? C.danger : undefined;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 }}>
      <UText v={strong ? "bodyStrong" : "caption"} tone={strong ? undefined : "muted"} style={{ flexShrink: 1 }}>{label}</UText>
      <UText v={strong ? "heading" : "bodyStrong"} color={color} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

function Divider() {
  const { C } = useUI();
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}

// ─── Reçu ─────────────────────────────────────────────────
type ReceiptData = {
  mode: "WALLET" | "CASH";
  sentAmount: number;
  sentCurrency: string;
  fees: number;
  total: number;
  receivedAmount: number;
  receivedCurrency: string;
  beneficiaryName: string;
  reference: string;
  code?: string;       // code de retrait (Cash Pickup ET Wallet non réclamé)
  motif?: string | null;
  date: Date;
};

function buildReceiptText(r: ReceiptData, brandName: string): string {
  const money = (v: number, c: string) => `${fmt(v, c)} ${c}`;
  const lines = [
    tr("send.rcpt.title", { brand: brandName }),
    "",
    tr("send.rcpt.type", { type: r.mode === "WALLET" ? tr("send.typeWallet") : tr("send.cash") }),
    tr("send.rcpt.beneficiary", { name: r.beneficiaryName }),
    tr("send.rcpt.sent", { amount: money(r.sentAmount, r.sentCurrency) }),
  ];
  if (r.fees > 0) lines.push(tr("send.rcpt.fees", { amount: money(r.fees, r.sentCurrency) }));
  lines.push(tr("send.rcpt.total", { amount: money(r.total, r.sentCurrency) }));
  lines.push(tr("send.rcpt.receives", { name: r.beneficiaryName.split(" ")[0], amount: money(r.receivedAmount, r.receivedCurrency) }));
  if (r.code) lines.push("", tr("send.rcpt.code", { code: r.code }), tr("send.rcpt.codeHelp"));
  if (r.motif) lines.push("", tr("send.rcpt.motif", { motif: motifLabel(r.motif) }));
  lines.push("", tr("send.rcpt.ref", { ref: r.reference }), tr("send.rcpt.date", { date: fmtDateTime(r.date) }));
  return lines.join("\n");
}

// ─── Page de succès (dernière étape) ──────────────────────
function SuccessStep({ data, onDone }: { data: ReceiptData; onDone: () => void }) {
  const { C, R } = useUI();
  const t = useT();
  const { branding } = useTenant();
  const [copied, setCopied] = useState(false);
  const first = data.beneficiaryName.split(" ")[0];
  const received = `${fmt(data.receivedAmount, data.receivedCurrency)} ${data.receivedCurrency}`;

  const handleShare = async () => {
    try { await Share.share({ message: buildReceiptText(data, branding.name) }); } catch {}
  };
  const handleCopyCode = async () => {
    if (!data.code) return;
    try {
      await Clipboard.setStringAsync(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <View>
      <View style={{ alignItems: "center", paddingTop: 10 }}>
        <Reveal pop>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: C.posBg, borderWidth: 1, borderColor: C.posLine, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={48} color={C.pos} />
          </View>
        </Reveal>
        <Reveal delay={160}>
          <UText v="title" align="center" style={{ marginTop: 18 }}>{data.mode === "WALLET" && !data.code ? t("send.doneWallet") : t("send.doneCash")}</UText>
        </Reveal>
        <Reveal delay={240}>
          <UText v="body" tone="muted" align="center" style={{ marginTop: 6 }}>
            {data.mode === "WALLET" && !data.code
              ? t("send.successWallet", { name: first, amount: received })
              : t("send.successCash", { name: first })}
          </UText>
        </Reveal>
      </View>

      {!!data.code && (
        <Reveal delay={320} style={{ marginTop: 20 }}>
          <Card tone="accent" style={{ alignItems: "center" }}>
            <UText v="overline" tone="accent">{t("send.codeLabel")}</UText>
            <UText v="display" style={{ fontSize: 34, lineHeight: 42, letterSpacing: 4, marginVertical: 8 }}>{data.code}</UText>
            <Button
              label={copied ? t("send.copied") : t("send.copyCode")}
              icon={copied ? "checkmark" : "copy-outline"}
              kind="outline" small full={false}
              onPress={handleCopyCode}
            />
          </Card>
        </Reveal>
      )}

      <Reveal delay={400} style={{ marginTop: 16 }}>
        <View style={{ backgroundColor: C.field, borderRadius: R.lg, paddingHorizontal: 16, paddingVertical: 6 }}>
          <Line label={t("send.l.beneficiary")} value={data.beneficiaryName} />
          <Divider />
          <Line label={t("send.l.sent")} value={`${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`} />
          {data.fees > 0 && (<><Divider /><Line label={t("send.l.fees")} value={`${fmt(data.fees, data.sentCurrency)} ${data.sentCurrency}`} /></>)}
          <Divider />
          <Line label={t("send.l.receives", { name: first })} value={received} tone="info" />
          <Divider />
          <Line label={t("send.l.reference")} value={data.reference} />
        </View>
      </Reveal>

      <Reveal delay={480} style={{ marginTop: 20, gap: 4 }}>
        <Button label={t("send.share")} icon="share-social-outline" onPress={handleShare} />
        <Button label={t("send.finished")} kind="ghost" onPress={onDone} />
      </Reveal>
    </View>
  );
}

// ─── Solde insuffisant ────────────────────────────────────
function FallbackSheet({ visible, missing, currency, onClose, onOrangeMoney, onCard }: {
  visible: boolean; missing: number; currency: string;
  onClose: () => void; onOrangeMoney: () => void; onCard: () => void;
}) {
  const { C } = useUI();
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t("send.insufTitle")}>
      <Notice tone="warn" icon="wallet-outline" style={{ marginTop: 6, marginBottom: 10 }}>
        {t("send.insufMsg", { amount: `${fmt(missing, currency)} ${currency}` })}
      </Notice>
      <ListRow
        title="Orange Money"
        subtitle={t("send.orangeSub")}
        left={<View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}><UText v="subheading">🟠</UText></View>}
        onPress={onOrangeMoney}
      />
      <ListRow title={t("send.card")} subtitle={t("send.cardSub")} icon="card-outline" onPress={onCard} last />
    </Sheet>
  );
}

// ─── Choisir un destinataire ──────────────────────────────
// Une seule feuille, trois entrées : bénéficiaires enregistrés · répertoire du téléphone · nouveau bénéficiaire.
type PhoneContactRow = { key: string; name: string; number: string };

function RecipientSheet({
  visible, onClose, beneficiaries, selectedId, onPickSaved, onPickPhone, onAddNew,
}: {
  visible: boolean;
  onClose: () => void;
  beneficiaries: Beneficiary[];
  selectedId: string | null;
  onPickSaved: (b: Beneficiary) => void;
  onPickPhone: (number: string, name: string) => void;
  onAddNew: () => void;
}) {
  const { C } = useUI();
  const t = useT();
  const [view, setView] = useState<"menu" | "saved" | "phone">("menu");
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<PhoneContactRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!visible) { setView("menu"); setQ(""); } }, [visible]);

  const openContacts = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("send.permDenied"), t("send.permMsg"));
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const rows: PhoneContactRow[] = [];
      const seen = new Set<string>();
      for (const c of data as any[]) {
        const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.name || t("send.noName");
        for (const p of (c.phoneNumbers ?? []).slice(0, 3)) {
          const number = String(p?.number ?? "").trim();
          const digits = onlyDigits(number);
          if (!digits) continue;
          const key = `${name}|${digits}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({ key, name, number });
        }
      }
      setContacts(rows);
      setQ("");
      setView("phone");
    } catch (e: any) {
      Alert.alert(t("common.error"), `${t("send.contactsErr")}${e?.message ? `\n\n${e.message}` : ""}`);
    } finally { setLoading(false); }
  };

  const needle = q.trim().toLowerCase();
  const savedList = needle
    ? beneficiaries.filter((b) => (b.fullName ?? "").toLowerCase().includes(needle) || onlyDigits(b.phone).includes(onlyDigits(needle) || "§"))
    : beneficiaries;
  const phoneList = needle
    ? contacts.filter((c) => c.name.toLowerCase().includes(needle) || onlyDigits(c.number).includes(onlyDigits(needle) || "§"))
    : contacts;

  const title = view === "menu" ? t("send.pickRecipient") : view === "saved" ? t("send.myBenef") : t("send.myContacts");

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {view === "menu" ? (
        <>
          <ListRow
            icon="people-outline"
            title={t("send.myBenef")}
            subtitle={beneficiaries.length > 0 ? t("send.savedCount", { count: beneficiaries.length }) : t("send.noneYet")}
            onPress={() => { setQ(""); setView("saved"); }}
          />
          <ListRow
            icon="download-outline"
            title={t("send.importContacts")}
            subtitle={loading ? t("send.opening") : t("send.useNumber")}
            right={loading ? <ActivityIndicator size="small" color={C.ink} /> : undefined}
            onPress={loading ? undefined : openContacts}
          />
          <ListRow
            icon="person-add-outline"
            title={t("send.newBenef")}
            subtitle={t("send.newBenefSub")}
            onPress={onAddNew}
            last
          />
        </>
      ) : (
        <>
          <Pressable
            onPress={() => { setQ(""); setView("menu"); }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 }}
          >
            <Ionicons name="chevron-back" size={18} color={C.accentDeep} />
            <UText v="label" tone="accent">{t("common.back")}</UText>
          </Pressable>
          <View style={{ paddingTop: 6, paddingBottom: 6 }}>
            <SearchPill value={q} onChangeText={setQ} placeholder={view === "saved" ? t("send.searchBenef") : t("send.searchContact")} />
          </View>

          {view === "saved" ? (
            savedList.length === 0 ? (
              <UText v="caption" tone="muted" align="center" style={{ paddingVertical: 24 }}>
                {beneficiaries.length === 0 ? t("send.noBenefSaved") : t("send.noResult")}
              </UText>
            ) : savedList.slice(0, MAX_LIST_ROWS).map((b, i, arr) => (
              <ListRow
                key={String(b.id)}
                left={<Avatar name={b.fullName} size={44} />}
                title={b.fullName}
                subtitle={b.phone ? formatPhone(b.phone) : b.country}
                chevron={false}
                right={String(b.id) === selectedId ? <Ionicons name="checkmark" size={20} color={C.accentDeep} /> : <UText>{getCountryData(b.country).flag}</UText>}
                last={i === arr.length - 1}
                onPress={() => onPickSaved(b)}
              />
            ))
          ) : (
            phoneList.length === 0 ? (
              <UText v="caption" tone="muted" align="center" style={{ paddingVertical: 24 }}>
                {contacts.length === 0 ? t("send.noContactNum") : t("send.noResult")}
              </UText>
            ) : phoneList.slice(0, MAX_LIST_ROWS).map((c, i, arr) => (
              <ListRow
                key={c.key}
                left={<Avatar name={c.name} size={44} />}
                title={c.name}
                subtitle={c.number}
                chevron={false}
                right={<Ionicons name="add-circle-outline" size={22} color={C.ink} />}
                last={i === arr.length - 1}
                onPress={() => onPickPhone(c.number, c.name)}
              />
            ))
          )}
          {(view === "saved" ? savedList.length : phoneList.length) > MAX_LIST_ROWS && (
            <UText v="caption" tone="muted" align="center" style={{ marginTop: 12 }}>
              {t("send.refine")}
            </UText>
          )}
        </>
      )}
    </Sheet>
  );
}

// ─── Écran ────────────────────────────────────────────────
export default function SendMoneyScreen() {
  const { C, R } = useUI();
  const t = useT();
  const { branding } = useTenant();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  // ✅ v3.0 — chargement non bloquant : l'écran est utilisable tout de suite
  const [loadState,  setLoadState]  = useState<"loading" | "ready" | "error">("loading");
  const [loadError,  setLoadError]  = useState<LoadError | null>(null);
  const [slowLoad,   setSlowLoad]   = useState(false);
  const [beneficiaries,    setBeneficiaries]    = useState<Beneficiary[]>([]);
  const [allRates,         setAllRates]         = useState<ExchangeRate[]>([]);
  const [sending,          setSending]          = useState(false);
  const [showBalance,      setShowBalance]      = useState(true);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showFallback,     setShowFallback]     = useState(false);
  const [walletBalance,    setWalletBalance]    = useState(0);
  const [loadingWallet,    setLoadingWallet]    = useState(true);

  const [motif,          setMotif]          = useState<string | null>(null);

  // ✅ v2.8 — Reçu transférable (Wallet & Cash Pickup) ; v7.0 : affiché sur la dernière page du parcours
  const [receiptData,  setReceiptData]  = useState<ReceiptData | null>(null);

  const userCurrency = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";

  const [mode,         setMode]        = useState<"WALLET" | "CASH">("WALLET");
  const [chosenMode,   setChosenMode]  = useState<"WALLET" | "CASH" | null>(null);   // v7.0 : choix fait sur la 1re page
  const [cashQ,        setCashQ]       = useState("");                              // v7.0 : recherche dans la liste Cash Pickup
  // ✅ v5.3 — `walletInput` ne contient QUE le numéro national (sans indicatif ni 0 de tête) : l'indicatif est
  //   dans le bouton pays. Un nom ou un e-mail collé reste tel quel.
  const [walletInput,         setWalletInput]        = useState("");
  const [detectedBeneficiary, setDetectedBeneficiary]= useState<Beneficiary | null>(null);
  const [pickedId,            setPickedId]           = useState<string | null>(null);
  const [lookingUp,           setLookingUp]          = useState(false);
  const [dialNonce,           setDialNonce]          = useState(0);
  const [selectedCashId,      setSelectedCashId]     = useState<string | null>(null);
  const [targetCurrency,    setTargetCurrency]   = useState("XOF");
  const [targetCountryData, setTargetCountryData]= useState<CountryData>(getCountryData("Sénégal"));
  const [rate,              setRate]             = useState<number | null>(1);
  const [rawAmount,         setRawAmount]        = useState("");
  // ✅ v2.15 — saisie bidirectionnelle du montant : `amountSource` retient le champ que l'utilisateur est en train de
  // saisir. ✅ v5.3 — le champ INACTIF n'est plus synchronisé par des effets : il est CALCULÉ à l'affichage
  // (sendText / receivedText), donc plus de boucle entre les deux champs, plus de curseur qui saute.
  const [rawReceivedAmount, setRawReceivedAmount] = useState("");
  const [amountSource,      setAmountSource]      = useState<"SEND" | "RECEIVED">("SEND");
  // ✅ v5.3 — flèche d'inversion : `swapped` place le champ « reçoit » en haut (c'est celui qu'on saisit).
  const [swapped,           setSwapped]           = useState(false);
  const [focusedField,      setFocusedField]      = useState<"SEND" | "RECEIVED" | null>(null);
  const sendRef = useRef<TextInput>(null);
  const recvRef = useRef<TextInput>(null);

  // Estimation affichée uniquement le temps que le serveur calcule les frais exacts (useFeeQuote). Les taux viennent du
  // serveur (GET /commissions/fees : tarif de la société + modes gratuits) : aucun taux n'est écrit dans l'application.
  const [cashFeeRate,  setCashFeeRate]  = useState(0);
  const [cashFeeLabel, setCashFeeLabel] = useState("…");
  const [walletFeeRate, setWalletFeeRate] = useState(0);


  const dS = decimalsFor(userCurrency);
  const dR = decimalsFor(targetCurrency);

  // ✅ v3.2 — FIX : impossible de choisir un autre bénéficiaire que celui reçu dans l'URL.
  //   CAUSE : cet effet dépendait de l'objet `params`, que expo-router renvoie sous une NOUVELLE
  //   référence à chaque rendu. Dès qu'on touchait Alghassimou ou Djamilatou, le rendu relançait
  //   l'effet, qui remettait aussitôt `beneficiaryId` (Omar) dans selectedCashId (idem pour le
  //   téléphone et le montant). CORRECTIF : on ne dépend plus que des VALEURS des paramètres
  //   (texte), donc les paramètres de route ne sont appliqués qu'une fois, ou quand ils changent
  //   vraiment (nouvelle navigation vers l'écran).
  const firstParam = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const pMode          = firstParam(params.mode);
  const pPhone         = firstParam(params.phone);
  const pBeneficiaryId = firstParam(params.beneficiaryId);
  const pAmount        = firstParam(params.amount);

  // ── v7.0 — Parcours étape par étape ──────────────────────────────────────────────────────────────────────────────
  // 0 type · 1 destinataire · 2 montant · 3 motif · 4 confirmation · 5 succès. Ouvert avec ?mode=… : la 1re page est ignorée.
  const stepsList = pMode ? [1, 2, 3, 4] : [0, 1, 2, 3, 4];
  const firstStep = stepsList[0];
  const [step, setStep] = useState<number>(firstStep);
  const stepRef = useRef(step);
  stepRef.current = step;
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;   // glissement horizontal de la page
  const fade  = useRef(new Animated.Value(1)).current;   // fondu de la page
  const navBusy = useRef(false);

  // Sortie de la page courante (fondu + glissement), changement d'étape, puis arrivée de la suivante depuis le côté opposé.
  const go = useCallback((next: number) => {
    const from = stepRef.current;
    if (next === from || navBusy.current) return;
    Keyboard.dismiss();
    if (reduceMotion) { setStep(next); return; }
    const dir = next > from ? 1 : -1;
    navBusy.current = true;
    Animated.parallel([
      Animated.timing(fade,  { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(slide, { toValue: -dir * 36, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      slide.setValue(dir * 36);
      setStep(next);
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => { navBusy.current = false; });
    });
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un choix explicite (liste, suggestion) fait avancer tout seul, après un court instant pour voir la sélection.
  const advanceSoon = useCallback((to: number) => { setTimeout(() => go(to), 300); }, [go]);

  useEffect(() => {
    if (pMode) {
      const m = pMode as "WALLET" | "CASH";
      setMode(m);
      if (m === "WALLET" && pPhone) {
        // ✅ v5.3 — le numéro reçu peut être international (« +221… ») : on garde le national et on règle le pays.
        const intl = parseInternational(pPhone.trim().startsWith("+") || pPhone.trim().startsWith("00") ? pPhone : `+${onlyDigits(pPhone)}`);
        if (intl) { setTargetCountryData(intl.country); setWalletInput(intl.national); }
        else setWalletInput(pPhone);
      }
      if (m === "CASH" && pBeneficiaryId) setSelectedCashId(pBeneficiaryId);
    }
    // ✅ v3.1 — montant pré-rempli depuis l'accueil « Corridor » (champ « Tu envoies »)
    if (pAmount) {
      const a = sanitizeAmountInput(String(pAmount), dS);
      if (parseAmount(a) > 0) { setRawAmount(a); setAmountSource("SEND"); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pMode, pPhone, pBeneficiaryId, pAmount]);

  useEffect(() => {
    (api.http as any).get("/commissions/fees")
      .then((res: any) => {
        const list: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const r = list.find((c: any) => c.payoutMethod === "CASH_PICKUP");
        if (r) {
          const raw = Number(r.feeRate ?? 0);
          setCashFeeRate(raw / 100);
          setCashFeeLabel(raw.toFixed(1).replace(".", ","));
        }
        const w = list.find((c: any) => c.payoutMethod === "WALLET");
        if (w) setWalletFeeRate(w.charged === false ? 0 : Number(w.feeRate ?? 0) / 100);
      })
      .catch(() => {});
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    setLoadingWallet(true);
    const fromProfile = () => {
      const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
      setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
    };
    try {
      // ✅ v3.0 — borné : si le serveur ne répond pas, on retombe sur le
      // solde du profil au lieu d'attendre indéfiniment.
      const wallets = await withTimeout(api.getMyWallets(), defaultTimeoutMs());
      const w = wallets.find((w) => w.currency === userCurrency) ?? wallets.find((w) => (w as any).isDefault) ?? wallets[0];
      if (w) setWalletBalance(toNum(w.balance) - toNum((w as any).reservedBalance ?? 0));
      else fromProfile();
    } catch {
      fromProfile();
    } finally { setLoadingWallet(false); }
  }, [userCurrency, user]);

  // ✅ v3.0 — taux + contacts : en parallèle, chacun borné, sans jamais
  // masquer l'écran. Un échec partiel garde ce qui a répondu.
  const initSeq = useRef(0);
  const loadData = useCallback(async () => {
    const id = ++initSeq.current;
    setLoadState((prev) => (prev === "ready" ? prev : "loading"));
    const ms = defaultTimeoutMs();
    const [r, b] = await Promise.allSettled([
      withTimeout(api.getExchangeRates(), ms),
      withTimeout(api.getBeneficiaries(), ms),
    ]);
    if (id !== initSeq.current) return;
    if (r.status === "fulfilled") setAllRates(r.value);
    if (b.status === "fulfilled") setBeneficiaries(b.value);
    if (r.status === "rejected" || b.status === "rejected") {
      setLoadError(explainLoadError(b.status === "rejected" ? b.reason : (r as PromiseRejectedResult).reason));
      setLoadState("error");
    } else {
      setLoadError(null);
      setLoadState("ready");
    }
  }, []);

  // Message rassurant si le chargement dépasse 4 s
  useEffect(() => {
    if (loadState !== "loading") { setSlowLoad(false); return; }
    const timer = setTimeout(() => setSlowLoad(true), 4000);
    return () => clearTimeout(timer);
  }, [loadState]);

  useFocusEffect(useCallback(() => {
    void loadData();
    void fetchWalletBalance();
  }, [loadData, fetchWalletBalance]));

  // ✅ v2.14 — FIX 3 (voir changelog en tête de fichier) : getR()
  // vérifie maintenant le format underscore ET le format slash — voir
  // RatesService.getAll() (backend), qui renvoie explicitement ses
  // paires au format slash ("EUR/XOF"). Avant ce fix, la recherche par
  // égalité stricte sur le format underscore ne matchait JAMAIS une
  // paire réelle, et retombait systématiquement sur le fallback fb.
  // Fallback de toEurUser étendu à GNF (symétrique à toEurTarget,
  // qui gérait déjà ce cas) — un expéditeur en GNF tombait sur fb=1
  // (faux) au lieu de ≈8600.
  const updateCurrencyContext = useCallback((countryName: string) => {
    const cd = getCountryData(countryName);
    setTargetCountryData(cd);
    const tCurr = cd.currency || "XOF";
    setTargetCurrency(tCurr);
    // Aucun taux en dur : uniquement les taux publiés par la plateforme. Absent → null (pas d'estimation, envoi bloqué).
    setRate(lookupRate(allRates, userCurrency, tCurr));
  }, [allRates, userCurrency]);

  // ✅ v5.3 — le taux est calculé dès l'ouverture avec le pays par défaut (indicatif affiché). Avant, tant qu'aucun
  //   destinataire n'était choisi, le taux restait à 1 : le champ « reçoit » affichait le même nombre que
  //   « vous envoyez », avec la devise du pays (ex. 8 EUR → « 8 XOF »).
  useEffect(() => {
    if (detectedBeneficiary || selectedCashId) return;
    updateCurrencyContext(targetCountryData.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateCurrencyContext]);

  // ✅ v5.3 — numéro national saisi (chiffres seuls, sans indicatif) ; vide pour un nom / un e-mail.
  const isTextQuery = walletInput.trim() !== "" && !isNumericLike(walletInput);
  const walletInputDigits = isTextQuery ? "" : nationalOf(walletInput, targetCountryData.dialCode);
  const dialRef = useRef(targetCountryData.dialCode);
  dialRef.current = targetCountryData.dialCode;

  // ✅ v2.10 — Détection bénéficiaire par téléphone/email/nom
  //   1) Recherche dans les bénéficiaires SAUVEGARDÉS (comparaison par SUFFIXE, robuste à l'indicatif).
  //   2) Si rien trouvé ET numéro complet → fallback debouncé (450ms) vers GET /users/by-phone pour détecter un
  //      utilisateur déjà inscrit mais non sauvegardé comme contact (badge différencié via isFavorite: false).
  // ✅ v5.3 — durcissements :
  //   • un contact n'est confirmé automatiquement que sur un numéro COMPLET (≥ 7 chiffres) ou un nom / e-mail EXACT :
  //     avant, taper les 3 derniers chiffres d'un contact (ou 3 lettres de son nom) le sélectionnait tout seul, avec
  //     le risque d'envoyer à la mauvaise personne. Les saisies partielles passent par la liste de suggestions ;
  //   • la recherche plateforme envoie le numéro COMPLET « +<indicatif><national> » (le serveur compare en E.164 exact),
  //     puis, à défaut, la variante historique à indicatif doublé ;
  //   • réponse tardive ignorée si la saisie a changé entre-temps.
  useEffect(() => {
    if (mode !== "WALLET" || walletInput.trim().length < 3) {
      setDetectedBeneficiary(null);
      setLookingUp(false);
      return;
    }

    const q = walletInput.toLowerCase().trim();

    // ── Étape 1 : Recherche dans les bénéficiaires sauvegardés ──
    const found = beneficiaries.find((b) => {
      if (isTextQuery) {
        return (b.email ? b.email.toLowerCase() === q : false) ||
               (b.fullName ? b.fullName.toLowerCase().trim() === q : false);
      }
      const storedDigits = onlyDigits(b.phone);
      if (!storedDigits || !walletInputDigits) return false;
      if (!storedDigits.endsWith(walletInputDigits)) return false;
      return walletInputDigits.length >= MIN_FULL_NUMBER || (pickedId !== null && String(b.id) === pickedId);
    });

    if (found) {
      setDetectedBeneficiary(found);
      setLookingUp(false);
      updateCurrencyContext(found.country);
      return;
    }

    // Aucun bénéficiaire sauvegardé trouvé → reset
    setDetectedBeneficiary(null);

    // ── Étape 2 : Fallback plateforme (debounce 450ms) ──────────
    if (isTextQuery || walletInputDigits.length < MIN_FULL_NUMBER) {
      setLookingUp(false);
      return;
    }

    let cancelled = false;
    setLookingUp(true);
    const timer = setTimeout(async () => {
      const dial = dialRef.current;
      const candidates = [toE164(dial, walletInputDigits), toLegacyDoubled(dial, walletInputDigits)];
      for (const candidate of candidates) {
        try {
          const res = await (api.http as any).get(`/users/by-phone?q=${encodeURIComponent(candidate)}`);
          if (cancelled) return;
          const platformUser = res.data;
          if (platformUser?.id) {
            // ── Pseudo-bénéficiaire pour réutiliser l'UI existante ──
            // isFavorite: false = signal "utilisateur plateforme non
            // sauvegardé" → testé dans le JSX pour le badge différencié.
            setDetectedBeneficiary({
              id:         platformUser.id,
              fullName:   [platformUser.firstName, platformUser.lastName]
                            .filter(Boolean).join(" ") || tr("send.userFallback"),
              phone:      platformUser.phone ?? candidate,
              email:      undefined as any,
              country:    platformUser.country ?? "Sénégal",
              city:       undefined as any,
              isFavorite: false,
            } as any);

            if (platformUser.country) {
              updateCurrencyContext(platformUser.country);
            }
            setLookingUp(false);
            return;
          }
        } catch {
          // Endpoint non dispo ou erreur réseau → on tente la variante suivante, sinon silence
          // (l'UI retombe sur le message « Aucun membre trouvé »)
        }
      }
      if (!cancelled) setLookingUp(false);
    }, 450);

    return () => { cancelled = true; clearTimeout(timer); };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletInput, beneficiaries, mode, updateCurrencyContext, dialNonce, pickedId]);

  useEffect(() => {
    if (mode === "CASH" && selectedCashId) {
      const found = beneficiaries.find((b) => String(b.id) === selectedCashId);
      if (found) updateCurrencyContext(found.country);
    }
  }, [selectedCashId, mode, beneficiaries, updateCurrencyContext]);

  // ✅ v2.14 — autocomplétion. ✅ v5.3 : couvre aussi le nom / l'e-mail, et ne propose que si le contact n'est pas
  // déjà confirmé. Les numéros qui COMMENCENT par la saisie remontent en premier.
  const suggestions = useMemo(() => {
    if (mode !== "WALLET" || detectedBeneficiary) return [];
    const q = walletInput.toLowerCase().trim();
    if (isTextQuery) {
      if (q.length < 2) return [];
      return beneficiaries
        .filter((b) => (b.fullName ?? "").toLowerCase().includes(q) || (b.email ?? "").toLowerCase().includes(q))
        .slice(0, 5);
    }
    if (walletInputDigits.length < 2) return [];
    return beneficiaries
      .filter((b) => onlyDigits(b.phone).includes(walletInputDigits))
      .sort((a, b) => {
        const aStarts = onlyDigits(a.phone).startsWith(walletInputDigits) ? 0 : 1;
        const bStarts = onlyDigits(b.phone).startsWith(walletInputDigits) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 5);
  }, [beneficiaries, walletInput, walletInputDigits, isTextQuery, mode, detectedBeneficiary]);

  // ✅ v2.14 — Sélection d'une suggestion : complète le numéro (national, sans indicatif), règle le pays et
  // confirme immédiatement le bénéficiaire, sans attendre le debounce.
  const handleSelectSuggestion = useCallback((b: Beneficiary) => {
    const digits = onlyDigits(b.phone);
    if (digits) {
      const intl = parseInternational(`+${digits}`);
      setWalletInput(intl ? intl.national : digits);
    } else {
      setWalletInput(b.fullName);
    }
    setPickedId(String(b.id));
    setDetectedBeneficiary(b);
    updateCurrencyContext(b.country);
    advanceSoon(2);
  }, [updateCurrencyContext, advanceSoon]);

  // ✅ v5.3 — saisie du champ destinataire : jamais d'indicatif dans le champ (déjà dans le bouton pays).
  const handlePhoneChange = (v: string) => {
    setPickedId(null);
    if (!isNumericLike(v)) { setWalletInput(v); return; }              // nom / e-mail
    const intl = parseInternational(v);
    if (intl) {                                                         // « +224 6… » ou « 00224… » collé / tapé
      if (intl.country.code !== targetCountryData.code) updateCurrencyContext(intl.country.name);
      setWalletInput(intl.national);
      return;
    }
    const trimmed = v.trim();
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) { setWalletInput(v); return; } // indicatif en cours de frappe
    setWalletInput(stripDial(onlyDigits(v), targetCountryData.dialCode));
  };

  // ✅ v5.3 — montants (voir utils/amount.ts) :
  //   SEND     → vous envoyez = ce qui est tapé ; reçu = envoi × taux, arrondi comme le serveur (XOF/GNF entiers, sinon 2 décimales) ;
  //   RECEIVED → reçu = ce qui est tapé ; envoi = reçu ÷ taux, arrondi au centime SUPÉRIEUR (le bénéficiaire reçoit au moins ce montant).
  //   `sendAmount` reste le SEUL point d'entrée vers le reste de l'écran (frais, total, solde, création de transaction).
  const parsedSendRaw     = parseAmount(rawAmount);
  const parsedReceivedRaw = parseAmount(rawReceivedAmount);

  // Aucun taux publié pour ce couple de devises : pas d'estimation, envoi bloqué (jamais de taux inventé).
  const rateMissing = rate === null && targetCurrency !== userCurrency;

  const sendAmount = amountSource === "RECEIVED"
    ? (rate !== null && rate > 0 ? ceilTo(parsedReceivedRaw / rate, dS) : 0)
    : roundTo(parsedSendRaw, dS);
  const receivedAmt = rate !== null ? roundTo(sendAmount * rate, dR) : 0;

  const sendText     = amountSource === "SEND"     ? rawAmount         : toInputText(sendAmount, dS);
  const receivedText = amountSource === "RECEIVED" ? rawReceivedAmount : toInputText(receivedAmt, dR);

  const onSendChange = (v: string) => { setAmountSource("SEND");     setRawAmount(sanitizeAmountInput(v, dS)); };
  const onRecvChange = (v: string) => { setAmountSource("RECEIVED"); setRawReceivedAmount(sanitizeAmountInput(v, dR)); };

  // ✅ v5.3 — flèche d'inversion (auparavant décorative) : le champ « reçoit » passe en haut et devient celui qu'on
  // saisit (clavier ouvert dessus) ; un second appui revient à « vous envoyez ». Les valeurs déjà saisies sont conservées.
  const handleSwap = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !swapped;
    setSwapped(next);
    if (next) {
      setRawReceivedAmount(receivedText);
      setAmountSource("RECEIVED");
    } else {
      setRawAmount(sendText);
      setAmountSource("SEND");
    }
    setTimeout(() => (next ? recvRef : sendRef).current?.focus(), 60);
  };

  const beneficiaryLabel = useMemo(() => {
    if (mode === "WALLET") {
      return detectedBeneficiary?.fullName?.split(" ")[0] ?? t("send.theBenef");
    }
    const sel = beneficiaries.find(b => String(b.id) === selectedCashId);
    return sel?.fullName?.split(" ")[0] ?? t("send.theBenef");
  }, [mode, detectedBeneficiary, beneficiaries, selectedCashId, t]);

  // ✅ audit : frais EXACTS du serveur (barème de la société, GET /fees-admin/quote) — plus le tarif plat historique, qui
  // donnait un montant différent du débit réel. L'estimation à taux plat ne sert que tant que la réponse n'est pas arrivée.
  const quoteCountryName = mode === "WALLET"
    ? (detectedBeneficiary as any)?.country
    : beneficiaries.find((b) => String(b.id) === selectedCashId)?.country;
  const feeQuote = useFeeQuote({
    amount:         sendAmount,
    currency:       userCurrency,
    payoutMethod:   mode === "WALLET" ? "WALLET" : "CASH_PICKUP",
    receiveCountry: quoteCountryName ? getCountryData(String(quoteCountryName)).code : null,
    enabled:        sendAmount > 0,
  });
  const feesRate    = mode === "WALLET" ? walletFeeRate : cashFeeRate;
  const feesAmt     = feeQuote.fees !== null ? roundTo(feeQuote.fees, dS) : roundTo(sendAmount * feesRate, dS);
  const totalAmt    = roundTo(sendAmount + feesAmt, dS);
  const insufficient   = totalAmt > roundTo(walletBalance, dS) && sendAmount > 0;
  const missingAmount  = Math.max(0, roundTo(totalAmt - walletBalance, dS));
  // ✅ v2.14 — FIX 1 : même condition EXACTE que le contrôle équivalent dans handleAction, pour que le bouton ne
  // soit jamais actif sur une saisie que handleAction rejetterait ensuite.
  // ✅ audit : en mode Wallet, le destinataire doit être un compte EXISTANT. Un numéro saisi mais introuvable ne permet plus
  // d'envoyer (avant : l'envoi partait sans destinataire et l'expéditeur était débité pour rien).
  const recipientReady = mode === "WALLET" ? !!detectedBeneficiary : !!selectedCashId;
  const canSend = sendAmount > 0 && !insufficient && recipientReady && !rateMissing;


  // ── Choix du destinataire (feuille) ──
  const [showRecipientSheet, setShowRecipientSheet] = useState(false);
  const selectedCash = beneficiaries.find((b) => String(b.id) === selectedCashId) ?? null;

  const goCreateBeneficiary = (name?: string, phone?: string) => {
    setShowRecipientSheet(false);
    router.push({
      pathname: "/(tabs)/beneficiaries/create",
      params: { ...(name ? { name } : {}), ...(phone ? { phone } : {}) },
    } as any);
  };

  const handlePickSaved = (b: Beneficiary) => {
    setShowRecipientSheet(false);
    if (mode === "CASH") { setSelectedCashId(String(b.id)); advanceSoon(2); return; }
    handleSelectSuggestion(b);
  };

  // Numéro importé du répertoire : en Wallet il remplit le champ ; en Cash Pickup il doit correspondre à un bénéficiaire
  // enregistré (sinon on propose de l'enregistrer, nom et numéro déjà remplis).
  const handlePickPhone = (number: string, name: string) => {
    setShowRecipientSheet(false);
    if (mode === "WALLET") { handlePhoneChange(number); return; }
    const d = onlyDigits(number);
    const match = d.length >= 8
      ? beneficiaries.find((b) => { const bd = onlyDigits(b.phone); return bd.length >= 8 && bd.slice(-8) === d.slice(-8); })
      : undefined;
    if (match) { setSelectedCashId(String(match.id)); advanceSoon(2); }
    else goCreateBeneficiary(name, number);
  };

  const clearWalletRecipient = () => {
    setWalletInput(""); setPickedId(null); setDetectedBeneficiary(null);
  };

  const handleAction = async () => {
    if (insufficient) { setShowFallback(true); return; }
    if (rateMissing) return Alert.alert(t("send.rateUnavailTitle"), t("send.rateUnavailMsg", { from: userCurrency, to: targetCurrency }));
    if (sendAmount <= 0) return Alert.alert(t("send.invalidAmount"), t("send.invalidAmountMsg"));
    setSending(true);
    try {
      if (mode === "WALLET") {
        // ✅ v2.14 — FIX 1/2 : chiffres uniquement, même condition que canSend ci-dessus.
        if (!detectedBeneficiary) {
          setSending(false);
          return Alert.alert(
            t("send.notFound"),
            walletInputDigits.length >= MIN_FULL_NUMBER ? t("send.noAccountMsg") : t("send.shortNumberMsg"),
          );
        }
        const walletPayload = {
          amount:          sendAmount,
          currency:        userCurrency,
          beneficiaryId:   String(detectedBeneficiary.id),
          payoutMethod:    "MOBILE_MONEY" as const,
          note:            motif ?? undefined,
        };
        const tx: any = await runOnce(JSON.stringify(walletPayload), (idempotencyKey) =>
          api.createTransaction({ ...walletPayload, idempotencyKey }));
        // ✅ "id" confirmé comme champ de référence (utilisé par cancelTransaction/getTransaction dans api.ts)
        const reference = tx?.reference ?? tx?.id ?? `TX-${Date.now()}`;
        // ✅ v2.13 — FIX : si le backend n'a pas pu créditer immédiatement un wallet (aucun recipientId résolu —
        // numéro non reconnu par la plateforme), la transaction reste « en attente » avec un code de retrait
        // généré côté backend (même mécanisme que Cash Pickup) : on l'extrait pour l'afficher sur le reçu.
        const walletClaimed = !!tx?.recipientId;
        let walletCode: string | undefined;
        if (!walletClaimed) {
          walletCode = String(tx?.providerRef ?? tx?.reference ?? "—");
          if (walletCode.includes("|")) walletCode = walletCode.split("|")[0];
        }
        setReceiptData({
          mode: "WALLET",
          sentAmount: sendAmount,
          sentCurrency: userCurrency,
          // ✅ audit : montants du reçu = ceux du SERVEUR (frais du barème, montant reçu arrondi), pas un recalcul local
          fees: Number.isFinite(Number(tx?.fees)) ? Number(tx.fees) : feesAmt,
          total: Number.isFinite(Number(tx?.total)) ? Number(tx.total) : totalAmt,
          receivedAmount: Number(tx?.receivedAmount) > 0 ? Number(tx.receivedAmount) : receivedAmt,
          receivedCurrency: tx?.targetCurrency ?? targetCurrency,
          beneficiaryName: detectedBeneficiary?.fullName ?? `${formatPhone(toE164(targetCountryData.dialCode, walletInputDigits))}`,
          reference: String(reference),
          code: walletCode, // ✅ v2.13 — undefined si déjà crédité (comportement inchangé)
          motif,
          date: new Date(),
        });
      } else {
        if (!selectedCashId) {
          setSending(false);
          return Alert.alert(t("common.error"), t("send.selectBenef"));
        }
        const cashPayload = {
          amount:        sendAmount,
          currency:      userCurrency,
          beneficiaryId: selectedCashId,
          payoutMethod:  "CASH_PICKUP" as const,
          note:          motif ?? undefined,
        };
        const tx: any = await runOnce(JSON.stringify(cashPayload), (idempotencyKey) =>
          api.createTransaction({ ...cashPayload, idempotencyKey }));
        const reference = tx?.reference ?? tx?.id ?? `TX-${Date.now()}`;
        // ✅ Confirmé via transactions.service.ts : storedRef (providerRef)
        // == transactionRef (reference) tant que senderFirstName n'est pas
        // envoyé (jamais le cas ici) → providerRef contient le même code
        // 9 chiffres que reference. Découpe "code|prénom" conservée par
        // robustesse si ce comportement évolue côté backend.
        let code = String(tx?.providerRef ?? tx?.reference ?? tx?.code ?? "—");
        if (code.includes("|")) code = code.split("|")[0];
        const sel = beneficiaries.find((b) => String(b.id) === selectedCashId);
        setReceiptData({
          mode: "CASH",
          sentAmount: sendAmount,
          sentCurrency: userCurrency,
          fees: Number.isFinite(Number(tx?.fees)) ? Number(tx.fees) : feesAmt,
          total: Number.isFinite(Number(tx?.total)) ? Number(tx.total) : totalAmt,
          receivedAmount: Number(tx?.receivedAmount) > 0 ? Number(tx.receivedAmount) : receivedAmt,
          receivedCurrency: tx?.targetCurrency ?? targetCurrency,
          beneficiaryName: sel?.fullName ?? t("send.benefFallback"),
          reference: String(reference),
          code,
          motif,
          date: new Date(),
        });
      }
      void fetchWalletBalance();
      go(5);
    } catch (e: any) {
      // Identité non vérifiée : on oriente vers l'écran de vérification au lieu d'une erreur sèche.
      if (handleKycRequired(e, router)) return;
      const msg = e.response?.data?.message || t("send.genericError");
      Alert.alert(t("common.error"), Array.isArray(msg) ? msg[0] : msg);
    } finally { setSending(false); }
  };


  const selectedMotif = MOTIFS.find((m) => m.value === motif);
  // ✅ v2.10 — true si le bénéficiaire détecté est un utilisateur
  // plateforme (non sauvegardé), false/undefined sinon
  const isPlatformOnly = (detectedBeneficiary as any)?.isFavorite === false;
  const detectedCountry = detectedBeneficiary ? (countryOfPhone(detectedBeneficiary.phone) ?? getCountryData(detectedBeneficiary.country)) : null;

  const ctaLabel = insufficient
    ? t("send.anotherPay")
    : mode === "WALLET" ? t("send.confirm") : t("send.genCode");
  const rateVisible = rate !== null && rate !== 1 && targetCurrency !== userCurrency;

  // Bénéficiaire affiché (Wallet : détecté ; Cash Pickup : choisi dans la liste)
  const recipient: Beneficiary | null = mode === "WALLET" ? detectedBeneficiary : selectedCash;
  const recipientFlag = mode === "WALLET"
    ? detectedCountry?.flag
    : (selectedCash ? getCountryData(selectedCash.country).flag : undefined);

  const showNoAccount = mode === "WALLET" && !detectedBeneficiary && suggestions.length === 0 && !lookingUp &&
    (isTextQuery ? walletInput.trim().length >= 3 : walletInputDigits.length >= MIN_FULL_NUMBER);
  const userCountry = String((user as any)?.country ?? "");

  // ── Une ligne de montant (envoi / réception) : le montant, puis le drapeau + le code de la devise À DROITE (comme le solde de l'accueil) ──
  const renderAmountRow = (kind: "SEND" | "RECEIVED") => {
    const isSend  = kind === "SEND";
    const text    = isSend ? sendText : receivedText;
    const cur     = isSend ? userCurrency : targetCurrency;
    const dec     = isSend ? dS : dR;
    const derived = amountSource !== kind;
    const focused = focusedField === kind;
    return (
      <View
        key={kind}
        style={{
          paddingHorizontal: 14, paddingVertical: 10,
          borderRadius: R.lg, borderWidth: 1.5, borderColor: focused ? C.accent : "transparent",
          backgroundColor: focused ? C.surface : "transparent",
        }}
      >
        <UText v="label" tone="muted" numberOfLines={1}>{isSend ? t("send.youSend") : t("send.receivesLabel", { name: beneficiaryLabel })}</UText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, marginTop: 2 }}>
          <TextInput
            ref={isSend ? sendRef : recvRef}
            style={{
              flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: SANS, fontWeight: "800", letterSpacing: -0.6,
              fontSize: amountFontSize(text, 30), color: derived ? C.muted : C.ink,
            }}
            value={text}
            onChangeText={isSend ? onSendChange : onRecvChange}
            onFocus={() => setFocusedField(kind)}
            onBlur={() => setFocusedField((f) => (f === kind ? null : f))}
            keyboardType={dec > 0 ? "decimal-pad" : "number-pad"}
            placeholder={dec > 0 ? "0,00" : "0"}
            placeholderTextColor={C.faint}
            underlineColorAndroid="transparent"
            selectTextOnFocus
            accessibilityLabel={isSend ? t("send.a11ySendAmt", { cur }) : t("send.a11yRecvAmt", { cur })}
          />
          {/* Pastille de devise : drapeau + code en gris très foncé (toujours lisible, même quand le montant est calculé) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }} accessible accessibilityLabel={t("send.a11yCur", { cur })}>
            <CurrencyFlag currency={cur} countryName={isSend ? userCountry : targetCountryData.name} size={26} />
            <Text allowFontScaling={false} style={{ fontFamily: SANS, fontSize: 20, fontWeight: "700", color: C.text }}>{cur}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ── v7.0 — Éléments du parcours ──────────────────────────────────────────────────────────────────────────────────
  const stepIdx = Math.max(0, stepsList.indexOf(step));
  const finish = () => router.push("/(tabs)/transactions");
  const onBack = () => {
    if (step === 5) { finish(); return; }
    if (step <= firstStep) { router.back(); return; }
    go(step - 1);
  };
  // Bouton retour d'Android : recule d'une étape (ou termine sur la page de succès) au lieu de quitter l'écran.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stepRef.current > firstStep) { onBackRef.current(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [firstStep]);

  const pickMode = (m: "WALLET" | "CASH") => {
    setMode(m); setChosenMode(m);
    advanceSoon(1);
  };

  const modeActive = pMode ? mode : chosenMode;
  const chips: RecapChip[] = [];
  if (step >= 1 && step < 5 && modeActive) chips.push({ key: "mode", icon: modeActive === "WALLET" ? "phone-portrait-outline" : "cash-outline", label: modeActive === "WALLET" ? t("send.wallet") : t("send.cash") });
  if (step >= 2 && step < 5 && recipient) chips.push({ key: "recipient", icon: "person-outline", label: recipient.fullName.split(" ").slice(0, 2).join(" ") });
  if (step >= 3 && step < 5 && sendAmount > 0) chips.push({ key: "amount", icon: "cash-outline", label: `${fmt(sendAmount, userCurrency)} ${userCurrency}` });

  // Cash Pickup : liste des bénéficiaires enregistrés, filtrée par la recherche.
  const cashNeedle = cashQ.trim().toLowerCase();
  const cashList = cashNeedle
    ? beneficiaries.filter((b) => (b.fullName ?? "").toLowerCase().includes(cashNeedle) || onlyDigits(b.phone).includes(onlyDigits(cashNeedle) || "§"))
    : beneficiaries;

  // Montants rapides (s'ajoutent au montant saisi) : paliers adaptés aux devises sans décimales (XOF, GNF…) ou à décimales (EUR…).
  const quickSteps = dS === 0 ? [10000, 50000, 100000] : [20, 50, 100];
  const addQuick = (v: number) => {
    setSwapped(false);
    setAmountSource("SEND");
    setRawAmount(toInputText(roundTo(sendAmount + v, dS), dS));
  };

  const canContinueAmount = sendAmount > 0 && !rateMissing && !insufficient;

  const title = (key: "send.step.type" | "send.step.recipient" | "send.step.amount" | "send.step.motif" | "send.step.confirm") => (
    <Reveal distance={10}><UText v="title" style={{ marginBottom: 16 }}>{t(key)}</UText></Reveal>
  );

  // Bloc « destinataire choisi » (Wallet détecté ou Cash Pickup sélectionné)
  const recipientCard = recipient ? (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={recipient.fullName} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" numberOfLines={1}>{recipient.fullName}</UText>
          {!!recipient.phone && <UText v="caption" tone="muted" numberOfLines={1}>{formatPhone(recipient.phone)}</UText>}
        </View>
        {!!recipientFlag && <UText v="title">{recipientFlag}</UText>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {mode === "WALLET" && isPlatformOnly && <Pill tone="info" icon="person-outline" label={t("send.memberOf", { brand: branding.name })} />}
        <Button
          label={t("send.change")}
          kind="soft" small full={false}
          onPress={mode === "WALLET" ? clearWalletRecipient : () => setSelectedCashId(null)}
        />
        {mode === "WALLET" && isPlatformOnly && (
          <Button
            label={t("common.save")}
            icon="person-add-outline"
            kind="outline" small full={false}
            onPress={() => goCreateBeneficiary(detectedBeneficiary?.fullName, detectedBeneficiary?.phone ?? toE164(targetCountryData.dialCode, walletInputDigits))}
          />
        )}
      </View>
    </Card>
  ) : null;

  // Pied de page selon l'étape (la page 0 et la page de succès n'en ont pas : le choix avance tout seul / les boutons sont dans la page).
  const footer =
    step === 1 ? (
      <View>
        <Button label={t("send.continue")} iconRight="arrow-forward" onPress={() => go(2)} disabled={!recipientReady} />
        <View style={{ height: 14 }} />
      </View>
    ) : step === 2 ? (
      <View>
        {sendAmount > 0 && !insufficient && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <UText v="caption" tone="muted">{t("send.totalToPay")}</UText>
            <UText v="bodyStrong">{fmt(totalAmt, userCurrency)} {userCurrency}</UText>
          </View>
        )}
        {insufficient ? (
          <Button label={t("send.topUp")} icon="options-outline" kind="dark" onPress={() => setShowFallback(true)} />
        ) : (
          <Button label={t("send.continue")} iconRight="arrow-forward" onPress={() => go(3)} disabled={!canContinueAmount} />
        )}
        <View style={{ height: 14 }} />
      </View>
    ) : step === 3 ? (
      <View>
        <Button label={t("send.continue")} iconRight="arrow-forward" onPress={() => go(4)} />
        <Button label={t("send.skip")} kind="ghost" onPress={() => { setMotif(null); go(4); }} />
        <View style={{ height: 10 }} />
      </View>
    ) : step === 4 ? (
      <View>
        <Button
          label={ctaLabel}
          icon={insufficient ? "options-outline" : mode === "WALLET" ? "phone-portrait-outline" : "cash-outline"}
          kind={insufficient ? "dark" : "primary"}
          onPress={handleAction}
          loading={sending}
          disabled={sending || (!canSend && !insufficient)}
        />
        {/* marge de sécurité : le bouton ne touche jamais la barre de navigation du téléphone */}
        <View style={{ height: 14 }} />
      </View>
    ) : undefined;

  return (
    <Screen
      keyboard
      contentStyle={{ paddingTop: 4 }}
      header={
        <View>
          <NavBar
            title={step === 0 || mode === "CASH" ? t("send.titleCash") : t("send.titleWallet")}
            subtitle={step === 5 ? t("send.stepDone") : t("send.stepOf", { n: stepIdx + 1, total: stepsList.length })}
            onBack={onBack}
          />
          {step < 5 && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 6, gap: 12 }}>
              <StepProgress count={stepsList.length} index={stepIdx} />
              {chips.length > 0 && <RecapChips chips={chips} />}
            </View>
          )}
        </View>
      }
      footer={footer}
    >
      {/* Chargement lent / en échec : bandeaux discrets, jamais bloquants */}
      {loadState === "loading" && slowLoad && (
        <Notice tone="info" icon="cloud-outline" style={{ marginBottom: 12 }}>{t("send.wake")}</Notice>
      )}
      {loadState === "error" && !!loadError && (
        <Notice tone="warn" icon="cloud-offline-outline" title={loadError.title} action={t("common.retry")} onAction={() => void loadData()} style={{ marginBottom: 12 }}>
          {loadError.message}
        </Notice>
      )}

      <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }] }}>
        {/* ───────── 0 · Comment envoyer ? ───────── */}
        {step === 0 && (
          <View>
            {title("send.step.type")}
            <View style={{ gap: 12 }}>
              <ChoiceCard delay={80} icon="phone-portrait-outline" title={t("send.wallet")} subtitle={t("send.walletDesc")} selected={chosenMode === "WALLET"} onPress={() => pickMode("WALLET")} />
              <ChoiceCard delay={160} icon="cash-outline" title={t("send.cash")} subtitle={t("send.cashDesc")} selected={chosenMode === "CASH"} onPress={() => pickMode("CASH")} />
            </View>
          </View>
        )}

        {/* ───────── 1 · Qui reçoit ? ───────── */}
        {step === 1 && (
          <View>
            {title("send.step.recipient")}
            {recipient ? recipientCard : mode === "WALLET" ? (
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", height: 56, borderRadius: R.md, backgroundColor: C.field, overflow: "hidden" }}>
                  <Pressable
                    onPress={() => setShowCountryModal(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("send.dialA11y", { dial: targetCountryData.dialCode })}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 56, borderRightWidth: 1, borderRightColor: C.line }}
                  >
                    <UText v="subheading">{targetCountryData.flag}</UText>
                    <UText v="bodyStrong">+{targetCountryData.dialCode}</UText>
                    <Ionicons name="chevron-down" size={16} color={C.muted} />
                  </Pressable>
                  <TextInput
                    style={{ flex: 1, minWidth: 0, height: 56, paddingHorizontal: 14, paddingVertical: 0, fontFamily: SANS, fontSize: 16, fontWeight: "600", color: C.ink }}
                    value={walletInput}
                    onChangeText={handlePhoneChange}
                    placeholder={t("send.inputPh")}
                    placeholderTextColor={C.faint}
                    keyboardType={walletInput.trim() === "" || isNumericLike(walletInput) ? "phone-pad" : "default"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                    accessibilityLabel={t("send.inputA11y")}
                  />
                  {lookingUp ? (
                    <ActivityIndicator size="small" color={C.ink} style={{ marginRight: 14 }} />
                  ) : walletInput.length > 0 ? (
                    <Pressable onPress={() => { setWalletInput(""); setPickedId(null); }} hitSlop={10} accessibilityLabel={t("send.clear")} style={{ paddingHorizontal: 14, height: 56, justifyContent: "center" }}>
                      <Ionicons name="remove-circle" size={18} color={C.muted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Suggestions pendant la frappe : un tap confirme le contact et passe à la suite */}
                {suggestions.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    {suggestions.map((b, i) => (
                      <ListRow
                        key={String(b.id)}
                        left={<Avatar name={b.fullName} size={40} />}
                        title={b.fullName}
                        subtitle={b.phone ? formatPhone(b.phone) : undefined}
                        chevron={false}
                        right={<UText>{getCountryData(b.country).flag}</UText>}
                        last={i === suggestions.length - 1}
                        onPress={() => handleSelectSuggestion(b)}
                      />
                    ))}
                  </View>
                )}

                {showNoAccount && (
                  <Notice
                    tone="warn"
                    icon="person-add-outline"
                    action={t("send.addAsBenef")}
                    onAction={() => goCreateBeneficiary(isTextQuery ? walletInput.trim() : undefined, isTextQuery ? undefined : toE164(targetCountryData.dialCode, walletInputDigits))}
                    style={{ marginTop: 10 }}
                  >
                    {t("send.noAccountFor", { who: isTextQuery ? `« ${walletInput.trim()} »` : formatPhone(toE164(targetCountryData.dialCode, walletInputDigits)) })}
                  </Notice>
                )}

                <Button
                  label={t("send.pickRecipient")}
                  icon="people-outline"
                  kind="soft"
                  onPress={() => setShowRecipientSheet(true)}
                  style={{ marginTop: 12 }}
                />
              </Card>
            ) : (
              <View style={{ gap: 12 }}>
                <SearchPill value={cashQ} onChangeText={setCashQ} placeholder={t("send.searchPh")} />
                <ListRow icon="person-add-outline" title={t("send.addRecipient")} onPress={() => goCreateBeneficiary()} />
                <UText v="overline" tone="muted">{t("send.savedRecipients")}</UText>
                {cashList.length === 0 ? (
                  <UText v="caption" tone="muted" align="center" style={{ paddingVertical: 16 }}>
                    {beneficiaries.length === 0 ? t("send.noBenefSaved") : t("send.noResult")}
                  </UText>
                ) : (
                  <View>
                    {cashList.slice(0, MAX_LIST_ROWS).map((b, i, arr) => (
                      <Reveal key={String(b.id)} delay={Math.min(i, 8) * 45} distance={10}>
                        <ListRow
                          left={<Avatar name={b.fullName} size={44} />}
                          title={b.fullName}
                          subtitle={b.phone ? formatPhone(b.phone) : b.country}
                          chevron={false}
                          right={<UText>{getCountryData(b.country).flag}</UText>}
                          last={i === arr.length - 1}
                          onPress={() => { setSelectedCashId(String(b.id)); advanceSoon(2); }}
                        />
                      </Reveal>
                    ))}
                  </View>
                )}
                <Button label={t("send.importContacts")} icon="download-outline" kind="soft" onPress={() => setShowRecipientSheet(true)} />
              </View>
            )}
          </View>
        )}

        {/* ───────── 2 · Combien ? ───────── */}
        {step === 2 && (
          <View>
            {title("send.step.amount")}
            <Reveal delay={60} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <UText v="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                  {loadingWallet ? t("send.balanceLoading") : showBalance ? t("send.balanceLine", { amount: `${fmt(walletBalance, userCurrency)} ${userCurrency}` }) : t("home.balanceHidden")}
                </UText>
                <IconButton
                  icon={showBalance ? "eye-outline" : "eye-off-outline"}
                  onPress={() => setShowBalance(!showBalance)}
                  label={showBalance ? t("home.hideBalance") : t("home.showBalance")}
                />
              </View>
            </Reveal>

            <Reveal delay={120}>
              <Card>
                <View style={{ backgroundColor: C.field, borderRadius: R.lg }}>
                  {renderAmountRow(swapped ? "RECEIVED" : "SEND")}
                  <View style={{ height: 1, marginHorizontal: 14, backgroundColor: C.line }} />
                  {renderAmountRow(swapped ? "SEND" : "RECEIVED")}
                  <Pressable
                    onPress={handleSwap}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={swapped ? t("send.swapBack") : t("send.swapToRecv")}
                    style={({ pressed }) => ({
                      position: "absolute", right: 16, top: "50%", marginTop: -18, width: 36, height: 36, borderRadius: 18,
                      backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Ionicons name="swap-vertical" size={18} color={C.ink} />
                  </Pressable>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                  {rateVisible ? (
                    <UText v="label" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                      1 {userCurrency} = {fmtRate(rate ?? 0)} {targetCurrency}
                    </UText>
                  ) : <View style={{ flex: 1 }} />}
                  {feesAmt > 0 ? (
                    <UText v="label" tone="warn" numberOfLines={1}>
                      {t("send.feesLine", { amount: `${fmt(feesAmt, userCurrency)} ${userCurrency}`, approx: feeQuote.fees === null ? ` (~${cashFeeLabel} %)` : "" })}
                    </UText>
                  ) : (
                    <UText v="label" tone="pos">{t("send.noFees")}</UText>
                  )}
                </View>

                {rateMissing && (
                  <Notice tone="warn" style={{ marginTop: 10 }}>
                    {t("send.rateDown", { from: userCurrency, to: targetCurrency })}
                  </Notice>
                )}
              </Card>
            </Reveal>

            <Reveal delay={180} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {quickSteps.map((v) => (
                  <Chip key={v} label={`+${fmt(v, userCurrency)}`} onPress={() => addQuick(v)} />
                ))}
              </View>
            </Reveal>

            {insufficient && (
              <Notice tone="warn" icon="wallet-outline" action={t("send.topUp")} onAction={() => setShowFallback(true)} style={{ marginTop: 12 }}>
                {t("send.missing", { amount: `${fmt(missingAmount, userCurrency)} ${userCurrency}` })}
              </Notice>
            )}
          </View>
        )}

        {/* ───────── 3 · Motif ───────── */}
        {step === 3 && (
          <View>
            {title("send.step.motif")}
            <Reveal delay={60} style={{ marginBottom: 14 }}>
              <UText v="caption" tone="muted">{t("send.optional")} · {t("send.motifConf")}</UText>
            </Reveal>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {MOTIFS.map((m, i) => (
                <Reveal key={m.value} delay={90 + i * 40} distance={10}>
                  <Chip label={`${m.icon} ${t(m.key)}`} active={motif === m.value} onPress={() => setMotif(motif === m.value ? null : m.value)} />
                </Reveal>
              ))}
            </View>
          </View>
        )}

        {/* ───────── 4 · Vérifiez et confirmez ───────── */}
        {step === 4 && (
          <View>
            {title("send.step.confirm")}
            <Reveal delay={80}>
              <Card>
                {!!recipient && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 12 }}>
                      <Avatar name={recipient.fullName} size={48} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <UText v="bodyStrong" numberOfLines={1}>{recipient.fullName}</UText>
                        {!!recipient.phone && <UText v="caption" tone="muted" numberOfLines={1}>{formatPhone(recipient.phone)}</UText>}
                      </View>
                      {!!recipientFlag && <UText v="title">{recipientFlag}</UText>}
                    </View>
                    <Divider />
                  </>
                )}
                <Line label={t("send.typeLabel")} value={mode === "WALLET" ? t("send.typeWallet") : t("send.cash")} />
                <Divider />
                <Line label={t("send.l.sent")} value={`${fmt(sendAmount, userCurrency)} ${userCurrency}`} />
                <Divider />
                <Line label={t("send.transferFees")} value={feesAmt === 0 ? t("send.offered") : `${fmt(feesAmt, userCurrency)} ${userCurrency}`} tone={feesAmt === 0 ? "pos" : undefined} />
                <Divider />
                <Line label={t("send.receivesLabel", { name: beneficiaryLabel })} value={`${fmt(receivedAmt, targetCurrency)} ${targetCurrency}`} tone="info" />
                {!!motif && (<><Divider /><Line label={t("send.motif")} value={`${selectedMotif?.icon ?? ""} ${motifLabel(motif)}`.trim()} /></>)}
                <Divider />
                <Line label={t("send.totalToPay")} value={`${fmt(totalAmt, userCurrency)} ${userCurrency}`} tone={insufficient ? "danger" : undefined} strong />
              </Card>
            </Reveal>
            {insufficient && (
              <Notice tone="warn" icon="wallet-outline" style={{ marginTop: 12 }}>
                {t("send.missing", { amount: `${fmt(missingAmount, userCurrency)} ${userCurrency}` })}
              </Notice>
            )}
          </View>
        )}

        {/* ───────── 5 · Succès ───────── */}
        {step === 5 && !!receiptData && <SuccessStep data={receiptData} onDone={finish} />}
      </Animated.View>

      {/* ── Feuilles ── */}
      <RecipientSheet
        visible={showRecipientSheet}
        onClose={() => setShowRecipientSheet(false)}
        beneficiaries={beneficiaries}
        selectedId={mode === "CASH" ? selectedCashId : (detectedBeneficiary ? String(detectedBeneficiary.id) : null)}
        onPickSaved={handlePickSaved}
        onPickPhone={handlePickPhone}
        onAddNew={() => goCreateBeneficiary()}
      />

      <ChoiceSheet<CountryData>
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        title={t("send.dialTitle")}
        searchPlaceholder={t("send.dialSearch")}
        items={countriesList}
        getKey={(c) => c.code}
        getLabel={(c) => `${c.name} (+${c.dialCode})`}
        getLeft={(c) => (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
            <UText v="subheading">{c.flag}</UText>
          </View>
        )}
        isSelected={(c) => c.code === targetCountryData.code}
        onPick={(c) => {
          setTargetCountryData(c);
          updateCurrencyContext(c.name);
          setDialNonce((n) => n + 1);   // relance la recherche du destinataire avec le nouvel indicatif
          setPickedId(null);
        }}
      />

      <FallbackSheet
        visible={showFallback} missing={missingAmount} currency={userCurrency}
        onClose={() => setShowFallback(false)}
        onOrangeMoney={() => { setShowFallback(false); router.push("/topup?method=orange" as any); }}
        onCard={() => { setShowFallback(false); router.push("/topup?method=card" as any); }}
      />
    </Screen>
  );
}
