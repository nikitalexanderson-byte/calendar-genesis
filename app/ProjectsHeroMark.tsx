export function ProjectsHeroMark({ shared = false }: { shared?: boolean }) {
  return <span className={`projects-hero-mark${shared ? " projects-hero-mark-shared" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" focusable="false">
      {shared ? <>
        <path className="projects-mark-tree" d="M5 38V9h12l4 4h22v25H5Z" />
        <path className="projects-mark-tree projects-mark-tree-left" d="M11 20v12m0-12 7 4m-7 8 7-4m-7-2 12 1" />
        <path className="projects-mark-tree projects-mark-tree-right" d="M37 20v12m0-12-7 4m7 8-7-4m7-2-12 1" />
        <circle cx="11" cy="20" r="1.5" /><circle cx="11" cy="32" r="1.5" />
        <circle cx="37" cy="20" r="1.5" /><circle cx="37" cy="32" r="1.5" />
        <circle className="projects-mark-join" cx="24" cy="27" r="2.7" />
      </> : <>
        <path className="projects-mark-tree" d="M5 38V9h12l4 4h22v25H5Z" />
        <path className="projects-mark-tree" d="M24 18v8M12 26h24M12 26v7M24 26v7M36 26v7" />
        <circle cx="12" cy="33" r="2" /><circle cx="24" cy="33" r="2" /><circle cx="36" cy="33" r="2" />
      </>}
    </svg>
  </span>;
}
