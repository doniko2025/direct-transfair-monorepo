// apps/direct-transfair-mobile/hooks/useAdminRoute.ts
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

export function useAdminRoute() {
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/"); // page d'accueil (avant toute connexion)
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace("/(tabs)/home");
    }
  }, [loading, user, router]);
}
