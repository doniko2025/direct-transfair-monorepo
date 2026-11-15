// apps/direct-transfair-mobile/components/dashboards/CompanyDocumentsCard.tsx
// =========================================================
// DOCUMENTS D'UNE SOCIÉTÉ — carte de la fiche société (SUPER_ADMIN uniquement : l'API est réservée à ce rôle)
// • Liste des pièces (RCCM, identité du gérant, NIF, statuts, agrément, autre) avec type, taille et date ;
// • Consulter : image affichée dans l'app, PDF ouvert via la feuille de partage du téléphone ;
// • Ajouter : photo, galerie ou fichier PDF (mêmes contrôles que la création de société) ;
// • Supprimer : avec confirmation ; chaque ajout / suppression est journalisé côté serveur.
// Même carte que le back-office web (CompanyDocuments.tsx) : mêmes types, mêmes limites (20 pièces, 6 Mo).
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, Image, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api, type ClientDocumentView } from "../../services/api";
import {
  DOC_SLOTS, DOC_KIND_LABEL, MAX_COMPANY_DOCS, pickCompanyDoc, fmtBytes,
  type DocKind, type DocPick, type DocSource,
} from "./companyDocs";

const T = {
  surface: "#FFFFFF", pageBg: "#F2F4F8", border: "#E4E9F0", ink: "#0F172A", inkSub: "#64748B", inkMuted: "#94A3B8",
  blue: "#1956F0", blueLt: "#EEF2FF", blueMd: "#C7D5FF",
  green: "#16A34A", greenLt: "#DCFCE7", red: "#DC2626", redLt: "#FEE2E2",
  teal: "#0F766E", tealLt: "#CCFBF1", tealMd: "#5EEAD4", amber: "#D97706", amberLt: "#FEF3C7", white: "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16 },
  font: {
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

const shortDate = (iso: string): string => {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
};

const apiMessage = (e: any, fallback: string): string => {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return String(m[0] ?? fallback);
  return typeof m === "string" && m ? m : fallback;
};

export default function CompanyDocumentsCard({ clientId }: { clientId: number }) {
  const [docs, setDocs]       = useState<ClientDocumentView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [msg, setMsg]         = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [viewer, setViewer]   = useState<{ uri: string; doc: ClientDocumentView } | null>(null);

  // Ajout
  const [adding, setAdding]       = useState(false);
  const [kind, setKind]           = useState<DocKind>("RCCM");
  const [label, setLabel]         = useState("");
  const [pending, setPending]     = useState<DocPick | null>(null);
  const [picking, setPicking]     = useState<DocSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await api.listClientDocuments(clientId));
      setMsg((m) => (m?.tone === "err" ? null : m));
    } catch (e: any) {
      setDocs((d) => d ?? []);
      setMsg({ tone: "err", text: apiMessage(e, "Impossible de charger les documents.") });
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const count = docs?.length ?? 0;
  const full  = count >= MAX_COMPANY_DOCS;

  const resetAdd = () => { setAdding(false); setPending(null); setLabel(""); setProblem(null); setKind("RCCM"); };

  const pick = async (source: DocSource) => {
    setProblem(null); setPicking(source);
    const out = await pickCompanyDoc(source);
    setPicking(null);
    if (out.status === "error") return setProblem(out.message);
    if (out.status === "ok") setPending(out.pick);
  };

  const upload = async () => {
    if (!pending || uploading) return;
    if (kind === "OTHER" && !label.trim()) { setProblem("Précisez le nom du document."); return; }
    setUploading(true); setProblem(null);
    try {
      await api.addClientDocument(clientId, { kind, file: pending.dataUrl, label: kind === "OTHER" ? label.trim() : undefined });
      resetAdd();
      setMsg({ tone: "ok", text: "Document ajouté à la fiche société." });
      await load();
    } catch (e: any) {
      setProblem(apiMessage(e, "Envoi impossible. Vérifiez votre connexion et réessayez."));
    } finally { setUploading(false); }
  };

  const share = async (uri: string, doc: ClientDocumentView) => {
    if (!(await Sharing.isAvailableAsync())) {
      setMsg({ tone: "err", text: "Le partage de fichiers n'est pas disponible sur cet appareil." });
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: doc.mimeType,
      dialogTitle: doc.label || DOC_KIND_LABEL[doc.kind] || "Document",
      UTI: doc.mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
    });
  };

  const open = async (doc: ClientDocumentView) => {
    if (Platform.OS === "web") {
      setMsg({ tone: "err", text: "Consultation disponible dans l'application mobile ou le back-office web." });
      return;
    }
    setBusyId(doc.id); setMsg(null);
    try {
      const buf = await api.readClientDocument(clientId, doc.id);
      const f = new File(Paths.cache, `company-doc-${doc.id}.${EXT[doc.mimeType] ?? "bin"}`);
      if (f.exists) f.delete();
      f.create();
      f.write(new Uint8Array(buf));
      if (doc.mimeType.startsWith("image/")) setViewer({ uri: f.uri, doc });
      else await share(f.uri, doc);
    } catch (e: any) {
      setMsg({ tone: "err", text: apiMessage(e, "Impossible d'ouvrir ce document.") });
    } finally { setBusyId(null); }
  };

  const remove = (doc: ClientDocumentView) => {
    const name = doc.label || DOC_KIND_LABEL[doc.kind];
    const run = async () => {
      setBusyId(doc.id); setMsg(null);
      try {
        await api.removeClientDocument(clientId, doc.id);
        setMsg({ tone: "ok", text: "Document supprimé." });
        await load();
      } catch (e: any) {
        setMsg({ tone: "err", text: apiMessage(e, "Suppression impossible.") });
      } finally { setBusyId(null); }
    };
    if (Platform.OS === "web") { if (window.confirm(`Supprimer « ${name} » ?`)) void run(); return; }
    Alert.alert("Supprimer ce document ?", `${name}\n\nCette action est définitive.`, [
      { text: "Annuler", style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: () => { void run(); } },
    ]);
  };

  const SourceBtn = ({ source, icon, text }: { source: DocSource; icon: string; text: string }) => (
    <TouchableOpacity
      style={[s.sourceBtn, (picking !== null || uploading) && { opacity: 0.5 }]}
      onPress={() => pick(source)}
      disabled={picking !== null || uploading}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      {picking === source ? <ActivityIndicator size="small" color={T.teal} /> : <Ionicons name={icon as any} size={18} color={T.teal} />}
      <Text style={[s.sourceTxt, { fontFamily: T.font.sans }]}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      {msg && (
        <View style={[s.notice, msg.tone === "ok" ? s.noticeOk : s.noticeErr]}>
          <Ionicons name={msg.tone === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={msg.tone === "ok" ? T.green : T.red} />
          <Text style={[s.noticeTxt, { fontFamily: T.font.sans, color: msg.tone === "ok" ? T.green : T.red }]}>{msg.text}</Text>
        </View>
      )}

      {loading && docs === null ? (
        <ActivityIndicator color={T.teal} style={{ marginVertical: 16 }} />
      ) : count === 0 ? (
        <View style={s.empty}>
          <Ionicons name="documents-outline" size={26} color={T.inkMuted} />
          <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun document pour cette société</Text>
        </View>
      ) : (
        docs!.map((d) => {
          const busy = busyId === d.id;
          const isPdf = d.mimeType === "application/pdf";
          return (
            <View key={d.id} style={s.row}>
              <TouchableOpacity style={s.rowMain} onPress={() => open(d)} disabled={busy} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Consulter : ${d.label || d.kindLabel}`}>
                <View style={[s.fileIcon, { backgroundColor: isPdf ? T.redLt : T.tealLt }]}>
                  {busy
                    ? <ActivityIndicator size="small" color={T.teal} />
                    : <Ionicons name={(isPdf ? "document-text" : "image") as any} size={20} color={isPdf ? T.red : T.teal} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowTitle, { fontFamily: T.font.sans }]} numberOfLines={2}>{d.label || d.kindLabel}</Text>
                  <Text style={[s.rowSub, { fontFamily: T.font.sans }]} numberOfLines={2}>
                    {[d.label ? d.kindLabel : null, isPdf ? "PDF" : "Image", fmtBytes(d.sizeBytes), shortDate(d.createdAt)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.delBtn, busy && { opacity: 0.5 }]} onPress={() => remove(d)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Supprimer : ${d.label || d.kindLabel}`}>
                <Ionicons name="trash-outline" size={17} color={T.red} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* ── Ajout ── */}
      {!adding ? (
        <TouchableOpacity
          style={[s.addBtn, full && { opacity: 0.5 }]}
          onPress={() => { setMsg(null); setAdding(true); }}
          disabled={full}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un document"
        >
          <Ionicons name="add-circle-outline" size={18} color={T.teal} />
          <Text style={[s.addTxt, { fontFamily: T.font.sans }]}>
            {full ? `Limite atteinte (${MAX_COMPANY_DOCS} documents)` : "Ajouter un document"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={s.panel}>
          <Text style={[s.panelLabel, { fontFamily: T.font.sans }]}>TYPE DE DOCUMENT</Text>
          <View style={s.chips}>
            {DOC_SLOTS.map((d) => {
              const on = kind === d.kind;
              return (
                <TouchableOpacity
                  key={d.kind}
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => { setKind(d.kind); setProblem(null); }}
                  disabled={uploading}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.chipTxt, { fontFamily: T.font.sans }, on && { color: T.teal }]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {kind === "OTHER" && (
            <TextInput
              style={[s.input, { fontFamily: T.font.sans }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              value={label}
              onChangeText={(v) => setLabel(v.slice(0, 120))}
              placeholder="Nom du document (obligatoire)"
              placeholderTextColor={T.inkMuted}
              editable={!uploading}
              maxLength={120}
              underlineColorAndroid="transparent"
            />
          )}

          {pending ? (
            <View style={s.pendingBox}>
              <View style={[s.fileIcon, { backgroundColor: pending.isPdf ? T.redLt : T.tealLt, overflow: "hidden" }]}>
                {pending.isPdf
                  ? <Ionicons name="document-text" size={20} color={T.red} />
                  : <Image source={{ uri: pending.uri }} style={{ width: 44, height: 44 }} resizeMode="cover" />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.rowTitle, { fontFamily: T.font.sans }]} numberOfLines={1}>{pending.name || (pending.isPdf ? "Document PDF" : "Image")}</Text>
                <Text style={[s.rowSub, { fontFamily: T.font.sans, color: T.green }]}>
                  {pending.isPdf ? "PDF" : "Image"} · {fmtBytes(pending.sizeBytes)} · prêt à l'envoi
                </Text>
              </View>
              <TouchableOpacity style={s.delBtn} onPress={() => setPending(null)} disabled={uploading} accessibilityRole="button" accessibilityLabel="Retirer le fichier choisi">
                <Ionicons name="close" size={17} color={T.red} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.sources}>
              {Platform.OS !== "web" && <SourceBtn source="camera" icon="camera-outline" text="Photo" />}
              <SourceBtn source="gallery" icon="images-outline" text="Galerie" />
              {Platform.OS !== "web" && <SourceBtn source="file" icon="document-attach-outline" text="Fichier PDF" />}
            </View>
          )}

          {!!problem && (
            <View style={[s.notice, s.noticeErr, { marginTop: 10, marginBottom: 0 }]}>
              <Ionicons name="alert-circle" size={16} color={T.red} />
              <Text style={[s.noticeTxt, { fontFamily: T.font.sans, color: T.red }]}>{problem}</Text>
            </View>
          )}

          <View style={s.panelActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={resetAdd} disabled={uploading}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sendBtn, (!pending || uploading) && { opacity: 0.5 }]}
              onPress={upload}
              disabled={!pending || uploading}
              accessibilityRole="button"
            >
              {uploading
                ? <ActivityIndicator size="small" color={T.white} />
                : <><Ionicons name="cloud-upload-outline" size={17} color={T.white} /><Text style={[s.sendTxt, { fontFamily: T.font.sans }]}>Envoyer</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={[s.footnote, { fontFamily: T.font.sans }]}>
        {count} / {MAX_COMPANY_DOCS} documents · images ou PDF, 6 Mo maximum · accès réservé au Super Admin
      </Text>

      {/* ── Visionneuse d'image ── */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={s.viewer}>
          <View style={s.viewerBar}>
            <Text style={[s.viewerTitle, { fontFamily: T.font.sans }]} numberOfLines={1}>
              {viewer ? (viewer.doc.label || DOC_KIND_LABEL[viewer.doc.kind]) : ""}
            </Text>
            <TouchableOpacity style={s.viewerBtn} onPress={() => viewer && share(viewer.uri, viewer.doc)} accessibilityRole="button" accessibilityLabel="Partager ou enregistrer">
              <Ionicons name="share-outline" size={20} color={T.white} />
            </TouchableOpacity>
            <TouchableOpacity style={s.viewerBtn} onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={22} color={T.white} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
          >
            {viewer && <Image source={{ uri: viewer.uri }} style={s.viewerImg} resizeMode="contain" />}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  notice:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 12 },
  noticeOk:  { backgroundColor: T.greenLt, borderColor: T.green + "40" },
  noticeErr: { backgroundColor: T.redLt, borderColor: T.red + "40" },
  noticeTxt: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 17 },

  empty:     { alignItems: "center", paddingVertical: 18, gap: 8 },
  emptyTxt:  { fontSize: 13, color: T.inkMuted, fontWeight: "600" },

  row:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, padding: 10, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface },
  rowMain:   { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  fileIcon:  { width: 44, height: 44, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  rowTitle:  { fontSize: 13, fontWeight: "800", color: T.ink },
  rowSub:    { fontSize: 11, fontWeight: "600", color: T.inkSub, marginTop: 2 },
  delBtn:    { width: 38, height: 38, borderRadius: T.radius.md, backgroundColor: T.redLt, borderWidth: 1, borderColor: T.red + "30", justifyContent: "center", alignItems: "center" },

  addBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, marginTop: 4, borderRadius: T.radius.md, backgroundColor: T.tealLt, borderWidth: 1.5, borderColor: T.tealMd },
  addTxt:    { fontSize: 13, fontWeight: "800", color: T.teal },

  panel:       { marginTop: 6, padding: 12, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border },
  panelLabel:  { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8 },
  chips:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip:        { paddingHorizontal: 12, paddingVertical: 9, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  chipOn:      { backgroundColor: T.tealLt, borderColor: T.teal + "60" },
  chipTxt:     { fontSize: 12, fontWeight: "700", color: T.inkSub },
  input:       { marginBottom: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontWeight: "600", color: T.ink, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md },
  sources:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sourceBtn:   { flex: 1, minWidth: 96, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.tealMd },
  sourceTxt:   { fontSize: 12, fontWeight: "800", color: T.teal },
  pendingBox:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: T.radius.md, backgroundColor: T.greenLt + "80", borderWidth: 1.5, borderColor: T.green + "40" },
  panelActions:{ flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn:   { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  cancelTxt:   { fontSize: 13, fontWeight: "800", color: T.inkSub },
  sendBtn:     { flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: T.radius.md, backgroundColor: T.teal },
  sendTxt:     { fontSize: 13, fontWeight: "900", color: T.white },

  footnote:    { fontSize: 10, fontWeight: "600", color: T.inkMuted, textAlign: "center", marginTop: 12 },

  viewer:      { flex: 1, backgroundColor: "rgba(9,18,48,0.96)" },
  viewerBar:   { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 54, paddingBottom: 12 },
  viewerTitle: { flex: 1, color: T.white, fontSize: 15, fontWeight: "800" },
  viewerBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", justifyContent: "center", alignItems: "center" },
  viewerImg:   { width: "100%", height: 520 },
});
