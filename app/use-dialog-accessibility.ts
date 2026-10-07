"use client";

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const activeDialogStack: HTMLElement[] = [];

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export function useDialogAccessibility<T extends HTMLElement>(onClose: () => void, active = true) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const setDialogRef = useCallback((element: T | null) => {
    dialogRef.current = element;
  }, []);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    activeDialogStack.push(dialog);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ?? focusableElements(dialog)[0];
      (initial ?? dialog).focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeDialogStack.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (!dialog.contains(document.activeElement)) return;
      if (event.key !== "Tab") return;
      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const stackIndex = activeDialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) activeDialogStack.splice(stackIndex, 1);
      const trigger = returnFocusRef.current;
      if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    };
  }, [active]);
  return setDialogRef;
}
