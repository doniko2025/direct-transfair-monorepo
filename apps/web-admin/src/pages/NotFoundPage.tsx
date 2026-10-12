// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui';

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page introuvable" />
      <Card tone="flat">
        <p>
          Cette page n'existe pas, ou elle n'est pas encore disponible dans votre espace.{' '}
          <Link className="link" to="/">
            Retourner au tableau de bord
          </Link>
        </p>
      </Card>
    </>
  );
}
