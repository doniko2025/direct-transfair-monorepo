// src/pages/AccountPage.tsx
import type { WebRole } from '@direct-transfair/shared';
import { Button, Card, PageHeader } from '../components/ui';
import { ROLE_LABEL } from '../navigation';
import { useAuth, useCurrentUser } from '../providers/AuthProvider';

export default function AccountPage() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const role = user.role as WebRole;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';

  return (
    <>
      <PageHeader
        title="Mon compte"
        description="Les informations de votre profil. La modification du profil et du mot de passe arrive avec les prochains modules."
      />

      <div className="stack">
        <Card>
          <h2 className="card-title">Identité</h2>
          <dl className="kv">
            <div className="kv__row">
              <dt>Nom</dt>
              <dd>{fullName}</dd>
            </div>
            <div className="kv__row">
              <dt>Adresse email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="kv__row">
              <dt>Téléphone</dt>
              <dd>{user.phone || '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Rôle</dt>
              <dd>{ROLE_LABEL[role]}</dd>
            </div>
          </dl>
        </Card>

        <Card tone="flat">
          <h2 className="card-title">Fin de session</h2>
          <p className="muted">Déconnectez-vous si vous utilisez un ordinateur partagé.</p>
          <div className="card-actions">
            <Button variant="secondary" icon="logout" onClick={() => void logout()}>
              Se déconnecter
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
