// apps/web/src/ui/layout/Container.tsx
import type { ReactNode } from "react";
import "../../layout/layout.css";

export function Container(props: { children: ReactNode }) {
  return <div className="container">{props.children}</div>;
}
