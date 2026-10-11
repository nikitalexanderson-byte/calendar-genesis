"use client";
import { useId, useState } from "react";
import { ExperimentalIcon } from "./ExperimentalIcon";

export function SharedWorkspaceIdentity({ title, owner, members, projectTitle, description, english }: {
  title: string; owner: string; members: number | undefined; projectTitle?: string; description?: string; english: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="shared-space-identity" onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}>
    <button type="button" className="shared-space-info-trigger" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <span>{english ? "Workspace" : "Пространство"}: {title}</span>
      <span>{english ? "Owner" : "Владелец"}: {owner || "…"}</span>
      <span>{english ? "Participants" : "Участников"}: {members ?? "…"}</span>
      <ExperimentalIcon name="chevron" />
    </button>
    {open ? <button type="button" id={id} className="shared-space-info-popup" onClick={() => setOpen(false)}
      aria-label={english ? "Close project description" : "Закрыть описание проекта"} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      {projectTitle ? <strong>{projectTitle}</strong> : null}
      <span>{description || (english ? "No description yet." : "Описание пока не добавлено.")}</span>
    </button> : null}
  </div>;
}
