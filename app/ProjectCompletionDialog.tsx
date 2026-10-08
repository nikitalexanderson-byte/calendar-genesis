"use client";

import { translateText } from "./i18n";
import { useDialogAccessibility } from "./use-dialog-accessibility";

export function ProjectCompletionDialog({ title, onConfirm, onCancel }: {
  title: string; onConfirm: () => void; onCancel: () => void;
}) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(onCancel);
  return <div className="modal-backdrop project-completion-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onCancel();
  }}>
    <div ref={dialogRef} className="project-completion-dialog" role="alertdialog" aria-modal="true"
      aria-labelledby="project-completion-title" aria-describedby="project-completion-name" tabIndex={-1}>
      <h2 id="project-completion-title">{translateText("Завершить этот проект?")}</h2>
      <p id="project-completion-name" data-no-translate>{title}</p>
      <div>
        <button type="button" onClick={onConfirm}>{translateText("Да")}</button>
        <button type="button" className="text-button" data-dialog-initial-focus onClick={onCancel}>{translateText("Нет")}</button>
      </div>
    </div>
  </div>;
}
