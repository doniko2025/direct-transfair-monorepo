// apps/direct-transfair-mobile/hooks/useProtectedRoute.ts
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

export function useProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace("/"); // page d'accueil (avant toute connexion)
    }
  }, [loading, isAuthenticated, router]);
}
