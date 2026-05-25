// apps/direct-transfair-mobile/providers/TenantProvider.tsx
// =========================================================
// TENANT PROVIDER v1.0 — Direct Transf'air
// ✅ Charge et persiste le branding de la société active
// ✅ Utilisé par login, register, et [tenant]/index
// ✅ Fallback → branding Direct Transf'air par défaut
// =========================================================

import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
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
};

const STORAGE_KEY = "dt_tenant_branding_v1";

type TenantContextValue = {
  branding:         TenantBranding;
  isLoadingBranding: boolean;
  isCustomBranding:  boolean;
  loadBranding:     (code: string) => Promise<void>;
  clearBranding:    () => void;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [branding,          setBranding]          = useState<TenantBranding>(DEFAULT_BRANDING);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isCustomBranding,  setIsCustomBranding]  = useState(false);

  // ── Restaurer depuis AsyncStorage au démarrage ────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as TenantBranding;
          if (parsed?.code && parsed.code !== "DONIKO") {
            setBranding(parsed);
            setIsCustomBranding(true);
            void api.setTenant(parsed.code);
          }
        } catch {}
      })
      .finally(() => setIsLoadingBranding(false));
  }, []);

  // ── Charger branding depuis l'API ─────────────────────
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
      };
      setBranding(next);
      setIsCustomBranding(true);
      await api.setTenant(upper);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Propager l'erreur pour que [tenant]/index.tsx puisse l'afficher
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