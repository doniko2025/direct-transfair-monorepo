// apps/web-admin/src/pages/AccountPage.tsx
// v1.2 — 🔥 AJOUT : la carte « Votre session » (e-mail, téléphone, société, agence, contacts vérifiés) quitte le
//        tableau de bord pour vivre ici, avec la « Connexion technique ». « Identité » reste en tête.
// v1.1 — 🔥 AJOUT : carte « Mot de passe » (ChangePasswordCard). Avant, la page affichait
//        « la modification du mot de passe arrive avec les prochains modules » : un
//        utilisateur ne pouvait pas changer son mot de passe depuis le back-office
//        (ex. le super administrateur arrivé par la console Grand Chef). La route backend
//        PATCH /auth/change-password existait déjà ; seul l'écran manquait.
import type { ReactNode } from 'react';
import type { WebRole } from '@direct-transfair/shared';
import { API_URL } from '../config';
import { ChangePasswordCard } from '../components/ChangePasswordCard';
import { Button, Card, PageHeader, Pill } from '../components/ui';
import { ROLE_LABEL } from '../navigation';
import { useAuth, useCurrentUser } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';

function apiHost(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
}

/** `half` : la ligne se range à côté de sa voisine (deux champs par ligne). */
function Row({ label, children, half = false }: { label: string; children: ReactNode; half?: boolean }) {
  return (
    <div className={half ? 'kv__row kv__row--half' : 'kv__row'}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function AccountPage() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { branding, code, isPlatform } = useTenant();
  const role = user.role as WebRole;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const company = user.client?.name ?? branding.name;
  const agency = typeof user.agency?.name === 'string' ? user.agency.name : null;

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

        <Card>
          <h2 className="card-title">Votre session</h2>
          <dl className="kv kv--grid">
            <Row label="Adresse email">{user.email}</Row>
            {user.phone ? (
              <Row label="Téléphone" half>
                {user.phone}
              </Row>
            ) : null}
            {!isPlatform ? (
              <Row label="Société" half>
                {company}
              </Row>
            ) : null}
            {agency ? <Row label="Agence">{agency}</Row> : null}
            <Row label="Contacts vérifiés">
              <span className="kv__pills">
                <Pill tone={user.isEmailVerified === false ? 'warn' : 'ok'} icon="check">
                  Email
                </Pill>
                {user.phone ? (
                  <Pill tone={user.isPhoneVerified === false ? 'warn' : 'ok'} icon="check">
                    Téléphone
                  </Pill>
                ) : null}
              </span>
            </Row>
          </dl>
        </Card>

        <ChangePasswordCard email={user.email} />

        <Card tone="flat">
          <h2 className="card-title">Connexion technique</h2>
          <dl className="kv kv--compact">
            <Row label="Serveur">{apiHost()}</Row>
            <Row label="Portail">{code}</Row>
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
