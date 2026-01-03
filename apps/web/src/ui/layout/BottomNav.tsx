// apps/web/src/ui/layout/BottomNav.tsx
import "../../layout/layout.css";

export type BottomNavItem = { href: string; label: string };

export function BottomNav(props: {
  items: BottomNavItem[];
  activeHref?: string;
}) {
  const current =
    props.activeHref ??
    (typeof window !== "undefined" ? window.location.pathname : "");

  return (
    <nav className="bottomNav">
      <div className="bottomNavInner">
        {props.items.map((it) => {
          const active = current === it.href;

          return (
            <a
              key={it.href}
              href={it.href}
              className={`navItem ${active ? "navItemActive" : ""}`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
