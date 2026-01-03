// apps/web/src/App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Home } from "./pages/Home";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";

import { AppShell } from "./ui/layout/AppShell";
import { Container } from "./ui/layout/Container";

function Placeholder(props: { title: string; activeHref: string }) {
  return (
    <AppShell activeHref={props.activeHref}>
      <Container>
        <h1 style={{ margin: "8px 0 4px" }}>{props.title}</h1>
        <p>Page en cours de construction.</p>
      </Container>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* User routes */}
        <Route
          path="/send"
          element={<Placeholder title="Envoyer de l’argent" activeHref="/send" />}
        />
        <Route
          path="/beneficiaries"
          element={<Placeholder title="Bénéficiaires" activeHref="/beneficiaries" />}
        />
        <Route
          path="/transactions"
          element={<Placeholder title="Transactions" activeHref="/transactions" />}
        />
        <Route
          path="/withdraw"
          element={<Placeholder title="Retrait" activeHref="/withdraw" />}
        />
        <Route
          path="/history"
          element={<Placeholder title="Historique" activeHref="/history" />}
        />
        <Route
          path="/profile"
          element={<Placeholder title="Profil" activeHref="/profile" />}
        />

        {/* Admin routes */}
        <Route
          path="/admin/transactions"
          element={<AdminTransactionsPage />}
        />

        {/* Fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}