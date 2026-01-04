//apps/direct-transfair-mobile/app/components/layout/useBreakpoint.ts
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export type Breakpoint = "mobile" | "desktop";

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return useMemo(() => (width >= 900 ? "desktop" : "mobile"), [width]);
}
