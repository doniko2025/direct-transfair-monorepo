// apps/web/src/pages/admin/AdminTransactionsPage.tsx
import { useEffect, useState } from "react";
import { AppShell } from "../../ui/layout/AppShell";
import { Container } from "../../ui/layout/Container";

type AdminTransaction = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export default function AdminTransactionsPage() {
  const [items, setItems] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // ✅ On récupère le token standard (celui utilisé par le mobile si partagé, ou login web)
        const token = localStorage.getItem("dt_token") || localStorage.getItem("token") || "";

        const res = await fetch("http://localhost:3000/transactions/admin/all", {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-tenant-id": "DONIKO",
          },
        });

        if (!res.ok) throw new Error("Erreur API");

        const data = await res.json();
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <AppShell activeHref="/">
      <Container>
        <h1>Transactions du tenant</h1>

        {loading && <p>Chargement…</p>}

        {!loading && items.length === 0 && <p>Aucune transaction.</p>}

        {!loading && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 8 }}>Référence</th>
                <th style={{ padding: 8, textAlign: "right" }}>Montant</th>
                <th style={{ padding: 8 }}>Devise</th>
                <th style={{ padding: 8 }}>Statut</th>
                <th style={{ padding: 8 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{t.reference}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{t.amount}</td>
                  <td style={{ padding: 8 }}>{t.currency}</td>
                  <td style={{ padding: 8 }}>{t.status}</td>
                  <td style={{ padding: 8 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Container>
    </AppShell>
  );
}