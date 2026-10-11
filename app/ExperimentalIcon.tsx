/** Reference uses Lucide's ISC-licensed 24px geometry. No new UI runtime. */
export function ExperimentalIcon({ name, className = "" }: { name: string; className?: string }) {
  return <svg className={`experimental-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "today" || name === "sun" ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></> : null}
    {name === "moon" ? <path d="M19.79 15.5A8 8 0 0 1 8.5 4.21 8 8 0 1 0 19.79 15.5Z"/> : null}
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
    {name === "lock" ? <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></> : null}
    {name === "team" ? <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></> : null}
    {name === "settings" ? <><path d="M3 6h7m4 0h7M3 18h13m4 0h1"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="18" r="2"/></> : null}
    {name === "gear" ? <><path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-1.5v-3L20 9l-2-3-2 .5-2-1-.5-2Z"/><circle cx="11.25" cy="12" r="3"/></> : null}
    {name === "tag" ? <><path d="M20 13 11 22 2 13V2h11l9 9Z"/><circle cx="7" cy="7" r="1"/></> : null}
    {name === "spaces" ? <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></> : null}
    {name === "space-plus" ? <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/></> : null}
    {name === "project-plus" ? <><path d="M20 10V7a2 2 0 0 0-2-2h-6l-2-2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7M17 13v8m-4-4h8"/></> : null}
    {name === "image" ? <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></> : null}
    {name === "attach" ? <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L12 3a4 4 0 0 1 5.7 5.7l-8 8a2 2 0 0 1-2.8-2.8l7.5-7.5"/> : null}
    {name === "file" ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h6"/></> : null}
    {name === "mail" ? <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7L22 6"/></> : null}
    {name === "comment" ? <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/> : null}
    {name === "check" ? <path d="m5 12 4 4L19 6"/> : null}
  </svg>;
}
