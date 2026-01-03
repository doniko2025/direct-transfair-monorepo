// apps/web/src/ui/layout/TopBar.tsx
import type { ReactNode } from "react";
import "../../layout/layout.css";

export function TopBar(props: { title?: string; right?: ReactNode }) {
  return (
    <header className="topBar">
      <div className="topBarInner">
        <div className="brand">{props.title ?? "Direct Transf’air"}</div>
        <div>{props.right}</div>
      </div>
    </header>
  );
}
