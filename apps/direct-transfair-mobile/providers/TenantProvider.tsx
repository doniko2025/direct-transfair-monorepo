// apps/direct-transfair-mobile/providers/TenantProvider.tsx
// =========================================================
// TENANT PROVIDER v1.3 — Direct Transf'air
// ✅ v1.3 : Mentions légales publiques dans TenantBranding
//   PROBLÈME RÉSOLU : terms.tsx / assistance.tsx avaient "Direct
//   Transf'air SAS", l'agrément ACPR, le capital social, le contact
//   support écrits en dur — identiques pour tous les tenants.
//   CORRECTIF : TenantBranding enrichi avec les nouveaux champs
//   exposés par clients.service.ts v4.11 (legalCompanyName,
//   regulatorName/Acronym, regulatoryFrameworkLabel,
//   regulatorLicenseNumber/Type, capitalSocial, contactEmail,
//   contactPhone, address, supportEmail, whatsappNumber, mediatorName/
//   Url, termsVersion, termsEffectiveDate). DEFAULT_BRANDING reprend
//   EXACTEMENT les valeurs jusqu'ici en dur dans terms.tsx/assistance.tsx
//   comme valeurs par défaut du tenant plateforme (DONIKO) —
//   comportement inchangé pour ce tenant précis. Les deux sites de
//   construction de branding (restore() et loadBranding()) sont mis à
//   jour pour mapper ces nouveaux champs depuis l'API.
// ✅ v1.2 conservé intégralement
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
  subdomain:      string | null;  // "flash" → flash.direct-transfer.com
  customDomain:   string | null;  // "www.flash-transfer.com"
  // ✅ v1.3 — Mentions légales publiques (écrans CGU / Assistance)
  contactEmail:             string | null;
  contactPhone:             string | null;
  address:                  string | null;
  legalCompanyName:         string | null;
  regulatorName:            string | null;
  regulatorAcronym:         string | null;
  regulatoryFrameworkLabel: string | null;
  regulatorLicenseNumber:   string | null;
  regulatorLicenseType:     string | null;
  capitalSocial:            string | null;
  supportEmail:             string | null;
  whatsappNumber:           string | null;
  mediatorName:             string | null;
  mediatorUrl:              string | null;
  termsVersion:             string | null;
  termsEffectiveDate:       string | null; // ISO — formaté à l'affichage
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
  subdomain:      null,
  customDomain:   null,
  // ✅ v1.3 (nouveau) — reprend exactement les valeurs jusqu'ici en dur
  // dans terms.tsx / assistance.tsx : comportement inchangé pour DONIKO.
  contactEmail:             "contact@directtransfair.com",
  contactPhone:             "+33123456789",
  address:                  "Paris, France",
  legalCompanyName:         "Direct Transf'air SAS",
  regulatorName:            "Autorité de Contrôle Prudentiel et de Résolution (ACPR)",
  regulatorAcronym:         "ACPR",
  regulatoryFrameworkLabel: "DSP2",
  regulatorLicenseNumber:   "N° 12345",
  regulatorLicenseType:     "Établissement de paiement",
  capitalSocial:            "100 000 € entièrement libéré",
  supportEmail:             "support@directtransfair.com",
  whatsappNumber:           "+33123456789",
  mediatorName:             "Médiateur de l'ACPR",
  mediatorUrl:              "https://www.acpr.banque-france.fr",
  termsVersion:             "1.0",
  termsEffectiveDate:       "2025-06-01",
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
// HELPERS
// =========================================================

function isDefaultHost(host: string): boolean {
  if (!host) return true;
  const lower = host.toLowerCase();

  if (lower === "localhost") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower)) return true;

  if (lower.includes("vercel.app"))   return true;
  if (lower.includes("railway.app"))  return true;
  if (lower.includes("netlify.app"))  return true;
  if (lower.includes("onrender.com")) return true;
  if (lower.includes("fly.dev"))      return true;

  if (lower === "direct-transfer.com")     return true;
  if (lower === "www.direct-transfer.com") return true;

  return false;
}

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

  useEffect(() => {
    const restore = async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const host = window.location.hostname;

          if (!isDefaultHost(host)) {
            try {
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
                  subdomain:      data.subdomain      ?? null,
                  customDomain:   data.customDomain   ?? null,
                  // ✅ v1.3 (nouveau)
                  contactEmail:             data.contactEmail             ?? null,
                  contactPhone:             data.contactPhone             ?? null,
                  address:                  data.address                  ?? null,
                  legalCompanyName:         data.legalCompanyName         ?? null,
                  regulatorName:            data.regulatorName            ?? null,
                  regulatorAcronym:         data.regulatorAcronym         ?? null,
                  regulatoryFrameworkLabel: data.regulatoryFrameworkLabel ?? null,
                  regulatorLicenseNumber:   data.regulatorLicenseNumber   ?? null,
                  regulatorLicenseType:     data.regulatorLicenseType     ?? null,
                  capitalSocial:            data.capitalSocial            ?? null,
                  supportEmail:             data.supportEmail             ?? null,
                  whatsappNumber:           data.whatsappNumber           ?? null,
                  mediatorName:             data.mediatorName             ?? null,
                  mediatorUrl:              data.mediatorUrl              ?? null,
                  termsVersion:             data.termsVersion             ?? null,
                  termsEffectiveDate:       data.termsEffectiveDate       ?? null,
                };

                setBranding(next);
                setIsCustomBranding(true);
                await api.setTenant(next.code);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

                return;
              }
            } catch {
              console.warn(`[TenantProvider] hostname "${host}" non reconnu → fallback`);
            }
          }
        }

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as TenantBranding;
        if (parsed?.code && parsed.code !== "DONIKO") {
          // ✅ v1.3 — enrichit avec les nouveaux champs si absents
          // (migration v1.2 → v1.3, cache persistant plus ancien)
          const enriched: TenantBranding = {
            ...DEFAULT_BRANDING,
            ...parsed,
            subdomain:    parsed.subdomain    ?? null,
            customDomain: parsed.customDomain ?? null,
          };
          setBranding(enriched);
          setIsCustomBranding(true);
          await api.setTenant(enriched.code);
        }
      } catch {
        // Silencieux — reste sur DEFAULT_BRANDING
      } finally {
        setIsLoadingBranding(false);
      }
    };

    void restore();
  }, []);

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
        subdomain:      data.subdomain      ?? null,
        customDomain:   data.customDomain   ?? null,
        // ✅ v1.3 (nouveau)
        contactEmail:             data.contactEmail             ?? null,
        contactPhone:             data.contactPhone             ?? null,
        address:                  data.address                  ?? null,
        legalCompanyName:         data.legalCompanyName         ?? null,
        regulatorName:            data.regulatorName            ?? null,
        regulatorAcronym:         data.regulatorAcronym         ?? null,
        regulatoryFrameworkLabel: data.regulatoryFrameworkLabel ?? null,
        regulatorLicenseNumber:   data.regulatorLicenseNumber   ?? null,
        regulatorLicenseType:     data.regulatorLicenseType     ?? null,
        capitalSocial:            data.capitalSocial            ?? null,
        supportEmail:             data.supportEmail             ?? null,
        whatsappNumber:           data.whatsappNumber           ?? null,
        mediatorName:             data.mediatorName             ?? null,
        mediatorUrl:              data.mediatorUrl              ?? null,
        termsVersion:             data.termsVersion             ?? null,
        termsEffectiveDate:       data.termsEffectiveDate       ?? null,
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