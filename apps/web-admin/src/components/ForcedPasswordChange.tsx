// apps/web-admin/src/components/ForcedPasswordChange.tsx
// Écran plein page affiché tant que le mot de passe est celui qui a été envoyé par e-mail (création du compte ou
// réinitialisation par un administrateur). Aucune autre page n'est accessible avant le changement.

import { useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { BrandMark } from './BrandMark';
import { ChangePasswordCard } from './ChangePasswordCard';
import { Button, Notice } from './ui';

export function ForcedPasswordChange() {
  const { user, logout, markPasswordChanged } = useAuth();
  const { branding } = useTenant();

  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return (
    <main className="forced-pw">
      <div className="forced-pw__inner">
        <header className="forced-pw__brand">
          <BrandMark name={branding.name} logoUrl={branding.logoUrl} size={48} />
          <strong>{branding.name}</strong>
        </header>

        <div className="forced-pw__intro">
          <h1>{name ? `Bienvenue, ${name}` : 'Bienvenue'}</h1>
          <p>
            Pour protéger votre compte, remplacez le mot de passe temporaire reçu par e-mail par un mot de passe que
            vous seul connaissez. Vous pourrez ensuite accéder à votre espace.
          </p>
        </div>

        <Notice tone="info" title="Une seule fois">
          Cette étape n&apos;est demandée qu&apos;à votre première connexion (ou après une réinitialisation).
        </Notice>

        <ChangePasswordCard email={user.email} forced onChanged={markPasswordChanged} />

        <div className="forced-pw__actions">
          <Button variant="ghost" icon="logout" onClick={() => void logout()}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </main>
  );
}
