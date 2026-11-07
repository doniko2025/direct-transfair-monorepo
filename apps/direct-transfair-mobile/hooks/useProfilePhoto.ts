// apps/direct-transfair-mobile/hooks/useProfilePhoto.ts
// =========================================================
// PHOTO DE PROFIL v2.0 — l'avatar affiche la VRAIE photo choisie par la personne (caméra ou galerie), partagée par tous les écrans.
// Source, par ordre de priorité :
//   1. sa photo de profil envoyée au serveur (GET /profile-photo), gardée sur l'appareil avec son ETag (If-None-Match → 304 : rien à retélécharger) ;
//   2. `profilePictureUrl` de la fiche (http(s) ou data-URI), si le serveur la renvoie ;
//   3. à défaut, son selfie de vérification d'identité VALIDÉ (réservé au rôle USER) ;
//   4. sinon `null` : l'avatar affiche les initiales — rien ne casse.
// Un seul état en mémoire : changer ou retirer la photo met à jour tous les avatars en même temps (profil, compte, QR…).
// La photo appartient à la personne (pas au compte actif) : même photo en « Compte client » et « Compte marchand ».
// =========================================================

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import { bytesToBase64, kycApi, type KycStatusView } from "../services/kyc";

type Own = { userId: string | null; uri: string | null; etag: string | null; checked: boolean };

let own: Own = { userId: null, uri: null, etag: null, checked: false };
let lastCheck = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const selfieCache = new Map<string, string>(); // id de la pièce → data-URI

const setOwn = (next: Partial<Own>) => { own = { ...own, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getOwn = () => own;

const CACHE_KEY = (userId: string) => `dt.profilePhoto.${userId}`;
const RECHECK_MS = 60_000;

const isUsableUri = (v: unknown): v is string => typeof v === "string" && /^(https?:\/\/|data:image\/|file:\/\/)/i.test(v.trim());

/** Lit la photo du serveur (304 → inchangée, 404 → aucune). Un échec réseau garde ce qui est déjà affiché. */
async function fetchOwn(userId: string, force = false): Promise<void> {
  if (inflight && !force) return inflight;
  if (!force && own.userId === userId && own.checked && Date.now() - lastCheck < RECHECK_MS) return;
  inflight = (async () => {
    if (own.userId !== userId) {
      setOwn({ userId, uri: null, etag: null, checked: false });
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY(userId));
        const c = raw ? JSON.parse(raw) : null;
        if (own.userId === userId && c?.uri && c?.etag) setOwn({ uri: c.uri, etag: c.etag });
      } catch { /* cache illisible : on repart du serveur */ }
    }
    try {
      const res = await api.http.get<ArrayBuffer>("/profile-photo", {
        responseType: "arraybuffer",
        timeout: 30_000,
        headers: own.etag && !force ? { "If-None-Match": own.etag } : undefined,
        validateStatus: (s: number) => s === 200 || s === 304 || s === 404,
      });
      if (own.userId !== userId) return;
      lastCheck = Date.now();
      if (res.status === 404) {
        setOwn({ uri: null, etag: null, checked: true });
        AsyncStorage.removeItem(CACHE_KEY(userId)).catch(() => { /* sans incidence */ });
      } else if (res.status === 200) {
        const mime = String(res.headers?.["content-type"] ?? "image/jpeg").split(";")[0].trim();
        const uri = `data:${mime};base64,${bytesToBase64(res.data)}`;
        const etag = String(res.headers?.["etag"] ?? "") || null;
        setOwn({ uri, etag, checked: true });
        if (etag) AsyncStorage.setItem(CACHE_KEY(userId), JSON.stringify({ uri, etag })).catch(() => { /* sans incidence */ });
      } else {
        setOwn({ checked: true }); // 304 : la photo gardée est la bonne
      }
    } catch {
      if (own.userId === userId) setOwn({ checked: true }); // réseau coupé : on garde l'affichage actuel
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Message clair pour une erreur d'envoi (réseau, taille, format refusé par le serveur). */
function explain(e: any): string {
  const status = e?.response?.status;
  const msg = e?.response?.data?.message;
  const text = Array.isArray(msg) ? msg[0] : msg;
  if (status === 413) return "Photo trop lourde. Choisissez une photo moins grande.";
  if (typeof text === "string" && text.trim()) return text;
  if (e?.code === "ECONNABORTED" || !e?.response) return "Envoi impossible : vérifiez votre connexion et réessayez.";
  return "Impossible d'enregistrer la photo pour le moment.";
}

/** Actions : enregistrer (base64 issu du sélecteur) / retirer la photo. */
export function useProfilePhotoActions() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useSyncExternalStore(subscribe, getOwn, getOwn);
  const userId = user?.id ?? null;

  const save = useCallback(async (base64: string, previewUri?: string): Promise<boolean> => {
    if (!userId) return false;
    setBusy(true); setError(null);
    try {
      await api.http.put("/profile-photo", { image: base64 }, { timeout: 60_000 });
      if (previewUri) setOwn({ userId, uri: previewUri, etag: null, checked: true }); // affichage immédiat
      await fetchOwn(userId, true); // relit la photo telle que le serveur l'a enregistrée
      return true;
    } catch (e) {
      setError(explain(e));
      return false;
    } finally { setBusy(false); }
  }, [userId]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setBusy(true); setError(null);
    try {
      await api.http.delete("/profile-photo", { timeout: 30_000 });
      setOwn({ userId, uri: null, etag: null, checked: true });
      AsyncStorage.removeItem(CACHE_KEY(userId)).catch(() => { /* sans incidence */ });
      return true;
    } catch (e) {
      setError(explain(e));
      return false;
    } finally { setBusy(false); }
  }, [userId]);

  return { save, remove, busy, error, clearError: () => setError(null), hasOwn: !!store.uri && store.userId === userId };
}

/**
 * @param kyc dossier déjà chargé par l'écran (évite un second appel) ; absent → le hook le charge lui-même pour le repli sur le selfie.
 */
export function useProfilePhoto(kyc?: KycStatusView | null): string | null {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getOwn, getOwn);
  const userId = user?.id ?? null;
  const fromProfile = (user as any)?.profilePictureUrl;
  const mine = store.userId === userId;
  const ownUri = mine ? store.uri : null;
  const ownChecked = mine && store.checked;

  const [selfie, setSelfie] = useState<string | null>(null);
  const isClient = user?.role === "USER";
  const selfieId = kyc?.documents.find((d) => d.type === "SELFIE" && d.status === "APPROVED")?.id ?? null;

  // Déconnexion : plus aucune photo en mémoire.
  useEffect(() => {
    if (!userId) { selfieCache.clear(); lastCheck = 0; if (own.userId) setOwn({ userId: null, uri: null, etag: null, checked: false }); }
  }, [userId]);

  // Photo de profil du serveur.
  useEffect(() => { if (userId) void fetchOwn(userId); }, [userId]);

  // Repli : selfie validé, seulement s'il n'y a aucune photo choisie.
  const needFallback = !!userId && isClient && ownChecked && !ownUri && !isUsableUri(fromProfile);
  useEffect(() => {
    if (!needFallback) { setSelfie(null); return; }
    let alive = true;
    (async () => {
      try {
        let docId = selfieId;
        if (kyc === undefined) {
          const me = await kycApi.me();
          docId = me.documents.find((d) => d.type === "SELFIE" && d.status === "APPROVED")?.id ?? null;
        }
        if (!docId) { if (alive) setSelfie(null); return; }
        const hit = selfieCache.get(docId);
        if (hit) { if (alive) setSelfie(hit); return; }
        const f = await kycApi.file(docId, "front");
        if (f.uri) selfieCache.set(docId, f.uri);
        if (alive) setSelfie(f.uri);
      } catch { /* silencieux : on garde les initiales */ }
    })();
    return () => { alive = false; };
  }, [needFallback, selfieId, kyc === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ownUri) return ownUri;
  if (isUsableUri(fromProfile)) return fromProfile.trim();
  return needFallback ? selfie : null;
}
