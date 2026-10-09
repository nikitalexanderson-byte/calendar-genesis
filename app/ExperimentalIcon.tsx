/** Reference uses Lucide's ISC-licensed 24px geometry. No new UI runtime. */
export function ExperimentalIcon({ name, className = "" }: { name: string; className?: string }) {
  return <svg className={`experimental-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "today" || name === "sun" ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></> : null}
    {name === "moon" ? <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/> : null}
    {name === "projects" ? <><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4m4-4v2m4-2v6"/></> : null}
    {name === "habits" ? <><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4M5 21h14"/></> : null}
    {name === "calendar" ? <><path d="M8 2v4m8-4v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></> : null}
    {name === "year" ? <><circle cx="12" cy="12" r="9"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M12 8v4l3 2"/></> : null}
    {name === "stoicheion" || name === "theokyklos" ? <><path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z"/><path d="M20 2v4m2-2h-4M3 18v4m2-2H1"/></> : null}
    {name === "admin" ? <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/></> : null}
    {name === "plus" ? <path d="M5 12h14M12 5v14"/> : null}
    {name === "edit" ? <path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16Z"/> : null}
    {name === "delete" ? <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/> : null}
    {name === "open" ? <path d="M7 7h10v10M7 17 17 7"/> : null}
    {name === "chevron" ? <path d="m9 18 6-6-6-6"/> : null}
    {name === "search" ? <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></> : null}
    {name === "close" ? <path d="m6 6 12 12M6 18 18 6"/> : null}
    {name === "flask" ? <path d="M9 3h6M10 3v6l-5.5 9a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3M8 15h8"/> : null}
  </svg>;
}
