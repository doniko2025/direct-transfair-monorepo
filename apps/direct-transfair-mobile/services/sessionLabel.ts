// apps/direct-transfair-mobile/services/sessionLabel.ts
// Libellé lisible d'une session (même logique que describeSession du package partagé, que le mobile n'importe pas).

export type SessionKind = "mobile" | "desktop" | "unknown";

export type UserSession = {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  createdAt: string;
  expiresAt: string;
  /** Vrai pour la session de cet appareil. */
  current: boolean;
};

export function describeSession(s: Pick<UserSession, "device" | "userAgent">): { title: string; kind: SessionKind } {
  const ua = (s.userAgent ?? "").trim();
  const device = (s.device ?? "").trim();

  const os =
    /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod|iOS/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Linux|X11/i.test(ua) ? "Linux"
    : null;

  if (/okhttp|CFNetwork|Expo|ReactNative|Darwin/i.test(ua) || (!ua && device)) {
    const platform = os ?? (/ios/i.test(device) ? "iOS" : /android/i.test(device) ? "Android" : null);
    return { title: platform ? `Application mobile (${platform})` : device || "Application mobile", kind: "mobile" };
  }

  const browser =
    /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Safari\//i.test(ua) ? "Safari"
    : null;

  if (browser) {
    return { title: os ? `${browser} sur ${os}` : browser, kind: os === "Android" || os === "iOS" ? "mobile" : "desktop" };
  }
  return { title: device || "Appareil inconnu", kind: "unknown" };
}
