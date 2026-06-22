// apps/direct-transfair-mobile/providers/TenantProvider.tsx
// =========================================================
// TENANT PROVIDER v1.2 — Direct Transf'air
// ✅ v1.1 conservé intégralement
// ✅ v1.2 — Portail web dédié par société :
//   1. TenantBranding enrichi : subdomain + customDomain
//      → frontend peut construire l'URL de redirection
//   2. isDefaultHost() : helper pour détecter si l'app tourne
//      sur le domaine principal (SA) ou sur un sous-domaine société
//   3. restore() mis à jour :
//      — Sur web : détecte le hostname au démarrage
//      — Si hostname = sous-domaine ou domaine custom d'une société
//        → appelle /branding/by-host pour charger le bon thème
//        → locke le tenant AVANT que l'utilisateur ne saisisse quoi que ce soit
//      — Si hostname = domaine par défaut → comportement v1.1 inchangé
//   4. getBrandingByHost() ajouté dans api (appelé ici)
// =========================================================

import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

// ─── Types ───────────────────────────────────────────────
export type TenantBranding = {
  code:           string;
  name:           string;
  logoUrl:        string | null;
  primaryColor:   string;
  secondaryColor: string;
  tagline:        string | null;
  fontFamily:     string | null;
  splashBgColor:  string | null;
  welcomeMessage: string | null;
  // ✅ v1.2 : portail web dédié
  subdomain:      string | null;  // "flash" → flash.direct-transfer.com
  customDomain:   string | null;  // "www.flash-transfer.com"
};

export const DEFAULT_BRANDING: TenantBranding = {
  code:           "DONIKO",
  name:           "Direct Transf'air",
  logoUrl:        null,
  primaryColor:   "#059669",
  secondaryColor: "#10B981",
  tagline:        "Transferts internationaux sécurisés",
  fontFamily:     null,
  splashBgColor:  "#064E3B",
  welcomeMessage: null,
  subdomain:      null,  // ✅ v1.2
  customDomain:   null,  // ✅ v1.2
};

const STORAGE_KEY = "dt_tenant_branding_v1";

type TenantContextValue = {
  branding:          TenantBranding;
  isLoadingBranding: boolean;
  isCustomBranding:  boolean;
  loadBranding:      (code: string) => Promise<void>;
  clearBranding:     () => void;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

// =========================================================
// HELPERS ✅ v1.2
// =========================================================

/**
 * Retourne true si l'app tourne sur le domaine principal (SA)
 * ou sur un environnement de dev/déploiement technique.
 * Retourne false pour les sous-domaines société et les domaines custom.
 *
 * Exemples :
 *   "localhost"                    → true  (dev local)
 *   "direct-tr.vercel.app"        → true  (déploiement Vercel SA)
 *   "direct-transfer.com"         → true  (domaine principal SA)
 *   "flash.direct-transfer.com"   → false (portail Flash)
 *   "www.flash-transfer.com"      → false (domaine custom Flash)
 */
function isDefaultHost(host: string): boolean {
  if (!host) return true;
  const lower = host.toLowerCase();

  // Dev / IP
  if (lower === "localhost") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) return true;

  // Plateformes cloud techniques (toujours domaine SA)
  if (lower.includes("vercel.app"))   return true;
  if (lower.includes("railway.app"))  return true;
  if (lower.includes("netlify.app"))  return true;
  if (lower.includes("onrender.com")) return true;
  if (lower.includes("fly.dev"))      return true;

  // Domaine principal Direct Transf'air (avec ou sans www)
  if (lower === "direct-transfer.com")     return true;
  if (lower === "www.direct-transfer.com") return true;

  // Tout le reste = sous-domaine société ou domaine custom → NON par défaut
  return false;
}

/**
 * Construit l'URL du portail d'une société depuis son branding.
 * Retourne null si aucune URL dédiée n'est disponible.
 */
export function buildCompanyPortalUrl(branding: TenantBranding | {
  customDomain?: string | null;
  subdomain?: string | null;
  clientCode?: string | null;
  code?: string | null;
}): string | null {
  if ((branding as any).customDomain) {
    return `https://${(branding as any).customDomain}`;
  }
  if ((branding as any).subdomain) {
    return `https://${(branding as any).subdomain}.direct-transfer.com`;
  }
  return null;
}

// =========================================================
// PROVIDER
// =========================================================

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [branding,          setBranding]          = useState<TenantBranding>(DEFAULT_BRANDING);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isCustomBranding,  setIsCustomBranding]  = useState(false);

  // ── Restaurer branding au démarrage ──────────────────────
  // ✅ v1.2 : Détection hostname prioritaire sur web
  useEffect(() => {
    const restore = async () => {
      try {
        // ─── ÉTAPE 1 : Détection hostname (web uniquement) ✅ v1.2 ───
        // Si l'app tourne sur un sous-domaine ou domaine custom,
        // charger le branding depuis le backend SANS que l'utilisateur
        // n'ait rien à faire. Le tenant est locké dès le démarrage.
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const host = window.location.hostname;

          if (!isDefaultHost(host)) {
            try {
              // Appel /branding/by-host?host=flash.direct-transfer.com
              const data = await (api as any).getBrandingByHost(host);

              if (data?.code && data.code !== "DONIKO") {
                const next: TenantBranding = {
                  code:           data.code,
                  name:           data.name,
                  logoUrl:        data.logoUrl        ?? null,
                  primaryColor:   data.primaryColor   ?? DEFAULT_BRANDING.primaryColor,
                  secondaryColor: data.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
                  tagline:        data.tagline        ?? null,
                  fontFamily:     data.fontFamily     ?? null,
                  splashBgColor:  data.splashBgColor  ?? null,
                  welcomeMessage: data.welcomeMessage ?? null,
                  subdomain:      data.subdomain      ?? null,   // ✅ v1.2
                  customDomain:   data.customDomain   ?? null,   // ✅ v1.2
                };

                setBranding(next);
                setIsCustomBranding(true);
                await api.setTenant(next.code);
                // Persiste pour les rechargements (cache)
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

                // Tenant locké depuis l'hostname → on ne lit pas AsyncStorage
                return;
              }
            } catch {
              // Hostname non reconnu → fall-through vers AsyncStorage
              // (société peut-être suspendue ou DNS mal configuré)
              console.warn(`[TenantProvider] hostname "${host}" non reconnu → fallback`);
            }
          }
        }

        // ─── ÉTAPE 2 : Restauration depuis AsyncStorage ──────────────
        // (comportement v1.1 inchangé pour mobile et web SA)
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as TenantBranding;
        if (parsed?.code && parsed.code !== "DONIKO") {
          // Enrichir avec subdomain/customDomain si absent (migration v1.1 → v1.2)
          const enriched: TenantBranding = {
            ...DEFAULT_BRANDING,
            ...parsed,
            subdomain:    parsed.subdomain    ?? null,
            customDomain: parsed.customDomain ?? null,
          };
          setBranding(enriched);
          setIsCustomBranding(true);
          await api.setTenant(enriched.code);  // ✅ v1.1 : était void, maintenant await
        }
      } catch {
        // Silencieux — reste sur DEFAULT_BRANDING
      } finally {
        setIsLoadingBranding(false);
      }
    };

    void restore();
  }, []);

  // ── Charger branding depuis l'API par code ───────────────
  const loadBranding = useCallback(async (code: string) => {
    const upper = code.trim().toUpperCase();
    if (!upper || upper === "DONIKO") {
      clearBranding();
      return;
    }

    setIsLoadingBranding(true);
    try {
      const data = await api.getClientPublicBranding(upper);

      const next: TenantBranding = {
        code:           data.code           ?? upper,
        name:           data.name           ?? upper,
        logoUrl:        data.logoUrl        ?? null,
        primaryColor:   data.primaryColor   ?? DEFAULT_BRANDING.primaryColor,
        secondaryColor: data.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
        tagline:        data.tagline        ?? null,
        fontFamily:     data.fontFamily     ?? null,
        splashBgColor:  data.splashBgColor  ?? null,
        welcomeMessage: data.welcomeMessage ?? null,
        subdomain:      data.subdomain      ?? null,   // ✅ v1.2
        customDomain:   data.customDomain   ?? null,   // ✅ v1.2
      };

      setBranding(next);
      setIsCustomBranding(true);
      await api.setTenant(upper);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error(`Société "${upper}" introuvable.`);
    } finally {
      setIsLoadingBranding(false);
    }
  }, []);

  const clearBranding = useCallback(() => {
    setBranding(DEFAULT_BRANDING);
    setIsCustomBranding(false);
    void AsyncStorage.removeItem(STORAGE_KEY);
    void api.setTenant("DONIKO");
  }, []);

  return (
    <TenantContext.Provider value={{
      branding, isLoadingBranding, isCustomBranding,
      loadBranding, clearBranding,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}