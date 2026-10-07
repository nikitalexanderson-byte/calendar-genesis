import type { ReactNode } from "react";

/** Shared presentation contract for personal and team workspaces. */
export function WorkspaceHeader({ title, description, mark, children }: {
  title: string; description: string; mark: ReactNode; children?: ReactNode;
}) {
  return <header className="workspace-header" data-exp-ui="panel">
    <div className="workspace-header-main">{mark}
      <div className="workspace-header-copy"><h1>{title}</h1><p>{description}</p></div>
    </div>
    {children ? <div className="workspace-header-summary">{children}</div> : null}
  </header>;
}

export function TasksHeroMark() {
  return <span className="projects-hero-mark tasks-hero-mark" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" focusable="false">
      <path d="M16 8H8v32h32V8h-8M18 6h12v8H18V6Z" />
      <path d="m14 23 3 3 5-6m4 4h9m-21 9 3 3 5-6m4 4h9" />
    </svg>
  </span>;
}
