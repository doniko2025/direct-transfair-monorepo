// packages/shared/src/sessions.ts
// Sessions actives de l'utilisateur connecté (écran « Appareils connectés »).
//   GET    /auth/sessions                 → liste (l'appareil courant porte `current: true`)
//   DELETE /auth/sessions/:id             → ferme une session
//   POST   /auth/sessions/revoke-others   → ferme toutes les sessions sauf l'appareil courant
import type { HttpClient } from './http';

export interface UserSession {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  createdAt: string;
  expiresAt: string;
  /** Vrai pour la session de l'appareil qui interroge. */
  current: boolean;
}

export function createSessionsApi(http: HttpClient) {
  return {
    list: () => http.get<UserSession[]>('/auth/sessions'),
    revoke: (id: string) =>
      http.delete<{ success: true; wasCurrent: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`),
    revokeOthers: () => http.post<{ success: true; revoked: number }>('/auth/sessions/revoke-others'),
  };
}

export interface SessionLabel {
  /** Ex. « Chrome sur Windows », « Application mobile (Android) ». */
  title: string;
  kind: 'mobile' | 'desktop' | 'unknown';
}

/** Libellé lisible d'une session à partir de l'appareil déclaré et du User-Agent (sans dépendance externe). */
export function describeSession(s: Pick<UserSession, 'device' | 'userAgent'>): SessionLabel {
  const ua = (s.userAgent ?? '').trim();
  const device = (s.device ?? '').trim();

  const os =
    /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iPod|iOS/i.test(ua) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux|X11/i.test(ua) ? 'Linux'
    : null;

  // Application mobile (Expo / React Native / okhttp) : pas de navigateur.
  if (/okhttp|CFNetwork|Expo|ReactNative|Darwin/i.test(ua) || (!ua && device)) {
    const platform = os ?? (/ios/i.test(device) ? 'iOS' : /android/i.test(device) ? 'Android' : null);
    return { title: platform ? `Application mobile (${platform})` : device || 'Application mobile', kind: 'mobile' };
  }

  const browser =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari'
    : null;

  if (browser) {
    return {
      title: os ? `${browser} sur ${os}` : browser,
      kind: os === 'Android' || os === 'iOS' ? 'mobile' : 'desktop',
    };
  }
  return { title: device || 'Appareil inconnu', kind: 'unknown' };
}
