// apps/direct-transfair-mobile/providers/TenantProvider.tsx
// =========================================================
// ✅ v1.4 (phase 7) : DEFAULT_BRANDING, code plateforme (« DONIKO »), hôtes de la plateforme et domaine des portails (buildCompanyPortalUrl)
//   viennent de services/platformConfig.ts ; mentions légales fictives supprimées (voir DEFAULT_BRANDING).
// TENANT PROVIDER v1.4 — Direct Transf'air
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
import {
  getPlatformCode, isPlatformCode, getPlatformName, getPlatformTagline, getPlatformColors,
  getFallbackSupportEmail, getFallbackSupportPhone, getLegalFallbacks, getPlatformHosts, getPortalBaseDomain,
} from "../services/platformConfig";

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
  subdomain:      string | null;  // « flash » → flash.<domaine de base configuré>
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

// ✅ v1.4 (phase 7) : plus aucune valeur de société écrite en dur. Identité, couleurs et mentions légales de la
//   plateforme viennent de services/platformConfig.ts (variables EXPO_PUBLIC_*). Les mentions légales fictives
//   (agrément « N° 12345 », capital, téléphone +33123456789…) sont supprimées : les vraies valeurs viennent de l'API
//   (fiche de la société) et les écrans masquent déjà un champ vide.
const PF_COLORS = getPlatformColors();
const PF_LEGAL  = getLegalFallbacks();

export const DEFAULT_BRANDING: TenantBranding = {
  code:           getPlatformCode(),
  name:           getPlatformName(),
  logoUrl:        null,
  primaryColor:   PF_COLORS.primary,
  secondaryColor: PF_COLORS.secondary,
  tagline:        getPlatformTagline(),
  fontFamily:     null,
  splashBgColor:  PF_COLORS.splash,
  welcomeMessage: null,
  subdomain:      null,
  customDomain:   null,
  contactEmail:             getFallbackSupportEmail(),
  contactPhone:             getFallbackSupportPhone(),
  address:                  PF_LEGAL.address,
  legalCompanyName:         PF_LEGAL.legalCompanyName,
  regulatorName:            PF_LEGAL.regulatorName,
  regulatorAcronym:         PF_LEGAL.regulatorAcronym,
  regulatoryFrameworkLabel: PF_LEGAL.regulatoryFrameworkLabel,
  regulatorLicenseNumber:   PF_LEGAL.regulatorLicenseNumber,
  regulatorLicenseType:     PF_LEGAL.regulatorLicenseType,
  capitalSocial:            PF_LEGAL.capitalSocial,
  supportEmail:             getFallbackSupportEmail(),
  whatsappNumber:           getFallbackSupportPhone(),
  mediatorName:             PF_LEGAL.mediatorName,
  mediatorUrl:              PF_LEGAL.mediatorUrl,
  termsVersion:             PF_LEGAL.termsVersion,
  termsEffectiveDate:       PF_LEGAL.termsEffectiveDate,
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

  // ✅ v1.4 : hôtes de la plateforme lus dans la configuration (EXPO_PUBLIC_PORTAL_BASE_DOMAIN / _PLATFORM_HOSTS)
  if (getPlatformHosts().includes(lower)) return true;

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
  // ✅ v1.4 : domaine de base configurable (EXPO_PUBLIC_PORTAL_BASE_DOMAIN) — sans lui, pas de lien par sous-domaine.
  const baseDomain = getPortalBaseDomain();
  if ((branding as any).subdomain && baseDomain) {
    return `https://${(branding as any).subdomain}.${baseDomain}`;
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

              if (data?.code && !isPlatformCode(data.code)) {
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
        if (parsed?.code && !isPlatformCode(parsed.code)) {
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
    if (!upper || isPlatformCode(upper)) {
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
    void api.setTenant(getPlatformCode());
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