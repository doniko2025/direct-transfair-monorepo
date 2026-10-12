// src/pages/DashboardPage.tsx
// Tableau de bord de la phase 1 : accueil par rôle + état de la session.
// Les vrais indicateurs (volumes, trésorerie…) arrivent avec les modules.

import type { ReactNode } from 'react';
import type { WebRole } from '@direct-transfair/shared';
import { API_URL } from '../config';
import { Rosette } from '../components/Rosette';
import { Card, Pill } from '../components/ui';
import { useCurrentUser } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { ROLE_LABEL } from '../navigation';
import { CompaniesOverview } from './dashboard/CompaniesOverview';

function apiHost(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
}

function roleSentence(role: WebRole, company: string, agency: string | null): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Vous pilotez la plateforme : sociétés de transfert, taux de change, frais et supervision.';
    case 'COMPANY_ADMIN':
      return `Vous gérez ${company} : agences, agents, clients wallet et trésorerie.`;
    case 'AGENT':
      return `Vous opérez au guichet${agency ? ` de ${agency}` : ''} : dépôts, retraits et envois cash.`;
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const { branding, code, isPlatform } = useTenant();
  const role = user.role as WebRole;

  const company = user.client?.name ?? branding.name;
  const agency = typeof user.agency?.name === 'string' ? user.agency.name : null;

  return (
    <div className="dashboard">
      <Card className="hero">
        <Rosette className="hero__rosette" layers={24} />
        <h1>{user.firstName ? `Bonjour ${user.firstName}` : 'Bonjour'}</h1>
        <p className="hero__role">{roleSentence(role, company, agency)}</p>
        <p className="hero__note">
          Les écrans de gestion arrivent module par module. Les entrées grisées du menu ne sont pas
          encore disponibles.
        </p>
        <div className="hero__pills">
          <Pill tone="brand" icon="shield">
            {ROLE_LABEL[role]}
          </Pill>
          <Pill>{isPlatform ? 'Portail plateforme' : branding.name}</Pill>
        </div>
      </Card>

      <div className="dashboard__side">
        {role === 'SUPER_ADMIN' ? <CompaniesOverview /> : null}

        <Card>
          <h2 className="card-title">Votre session</h2>
          <dl className="kv">
            <Row label="Adresse email">{user.email}</Row>
            {user.phone ? <Row label="Téléphone">{user.phone}</Row> : null}
            {!isPlatform ? <Row label="Société">{company}</Row> : null}
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

        <Card tone="flat">
          <h2 className="card-title">Connexion technique</h2>
          <dl className="kv kv--compact">
            <Row label="Serveur">{apiHost()}</Row>
            <Row label="Portail">{code}</Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}
