// apps/web/src/ui/layout/AppShell.tsx
import type { ReactNode } from "react";
import "../../layout/layout.css";

import { TopBar } from "./TopBar";
import { BottomNav, type BottomNavItem } from "./BottomNav";

export function AppShell(props: { children: ReactNode; activeHref: string }) {
  const navItems: BottomNavItem[] = [
    { href: "/", label: "Accueil" },
    { href: "/send", label: "Envoyer" },
    { href: "/withdraw", label: "Retrait" },
    { href: "/history", label: "Historique" },
    { href: "/profile", label: "Profil" },
  ];

  return (
    <div className="appShell">
      <TopBar
        title="Direct Transf’air"
        right={<span className="chip">Bonjour Admin</span>}
      />
      <main className="mainArea">{props.children}</main>
      <BottomNav items={navItems} activeHref={props.activeHref} />
    </div>
  );
}
