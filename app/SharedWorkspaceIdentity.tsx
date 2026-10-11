"use client";
import { useEffect, useId, useRef, useState } from "react";

export function SharedWorkspaceIdentity({ title, owner, members, description, english }: {
  title: string; owner: string; members: number | undefined; description?: string; english: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);
  return <div className="shared-space-identity" onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" className="shared-space-info-trigger" aria-expanded={open} aria-controls={id}
      aria-describedby={open ? id : undefined}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setOpen(true); }}
      onClick={() => setOpen(current => !current)} onKeyDown={event => {
        if (open && ["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
          event.preventDefault();
          const distance = event.key.startsWith("Page") ? 240 : 40;
          popupRef.current?.scrollBy(0, event.key.endsWith("Up") ? -distance : distance);
        }
      }}>
      {[[english ? "Workspace" : "Пространство", title], [english ? "Owner" : "Владелец", owner || "…"],
        [english ? "Participants" : "Участников", members ?? "…"]].map(([label, value]) => <span className="shared-space-info-row" key={label}>
        <span className="shared-space-info-label">{label}:</span><span className="shared-space-info-leader" aria-hidden="true" />
        <span className="shared-space-info-value" data-no-translate>{value}</span>
      </span>)}
    </button>
    {open ? <div ref={popupRef} id={id} className="shared-space-info-popup" role="tooltip"
      aria-label={english ? "Workspace description" : "Описание пространства"}>
      <span data-no-translate>{description || (english ? "No description yet." : "Описание пока не добавлено.")}</span>
    </div> : null}
  </div>;
}
