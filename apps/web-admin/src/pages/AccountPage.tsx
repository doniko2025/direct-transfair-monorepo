// apps/web-admin/src/pages/AccountPage.tsx
// v1.1 — 🔥 AJOUT : carte « Mot de passe » (ChangePasswordCard). Avant, la page affichait
//        « la modification du mot de passe arrive avec les prochains modules » : un
//        utilisateur ne pouvait pas changer son mot de passe depuis le back-office
//        (ex. le super administrateur arrivé par la console Grand Chef). La route backend
//        PATCH /auth/change-password existait déjà ; seul l'écran manquait.
import type { WebRole } from '@direct-transfair/shared';
import { ChangePasswordCard } from '../components/ChangePasswordCard';
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
        description="Les informations de votre profil et la sécurité de votre accès."
      />

      <div className="stack">
        <Card>
          <h2 className="card-title">Identité</h2>
          <dl className="kv kv--grid">
            <div className="kv__row kv__row--half">
              <dt>Nom</dt>
              <dd>{fullName}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Rôle</dt>
              <dd>{ROLE_LABEL[role]}</dd>
            </div>
            <div className="kv__row">
              <dt>Adresse email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="kv__row">
              <dt>Téléphone</dt>
              <dd>{user.phone || '—'}</dd>
            </div>
          </dl>
        </Card>

        <ChangePasswordCard email={user.email} />

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
