// src/pages/fees/FeesPage.tsx
// Frais d'envoi. Admin de société : modifie le tarif de sa société. Super admin : consulte celui de chacune.

import { useCurrentUser } from '../../providers/AuthProvider';
import CompanyFees from './CompanyFees';
import PlatformFees from './PlatformFees';

export default function FeesPage() {
  const me = useCurrentUser();
  return me.role === 'SUPER_ADMIN' ? <PlatformFees /> : <CompanyFees />;
}
