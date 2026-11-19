// src/pages/pilotage/ReconciliationPage.tsx
// Réconciliation (administrateur de société) : soldes des portefeuilles de la société comparés au journal, jour après jour.

import { PageHeader } from '../../components/ui';
import ReconciliationSection from '../supervision/ReconciliationSection';

export default function ReconciliationPage() {
  return (
    <div className="pil-page">
      <PageHeader title="Réconciliation" description="Contrôle quotidien : l’argent affiché dans les portefeuilles correspond-il à l’historique des mouvements ?" />
      <ReconciliationSection />
    </div>
  );
}
