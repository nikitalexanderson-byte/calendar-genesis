"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const CENTER = 100;
const HOUR_RADIUS = 82;
const MINUTE_RADIUS = 50;

function angleFromPoint(clientX: number, clientY: number, rect: DOMRect) {
  const x = clientX - (rect.left + rect.width / 2);
  const y = clientY - (rect.top + rect.height / 2);
  const radians = Math.atan2(x, -y);
  return (radians + Math.PI * 2) % (Math.PI * 2);
}

function pointOnCircle(radius: number, index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

export function TimeClockPicker({ id, value, onChange, disabled = false }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState<"hour" | "minute">("hour");
  const faceRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<"hour" | "minute" | null>(null);

  const [hourValue, minuteValue] = value ? value.split(":") : ["", "00"];
  const hour = hourValue === "" ? null : Number(hourValue);
  const minute = Number(minuteValue || "0");

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const applyFromAngle = (kind: "hour" | "minute", clientX: number, clientY: number) => {
    if (!faceRef.current) return;
    const rect = faceRef.current.getBoundingClientRect();
    const angle = angleFromPoint(clientX, clientY, rect);
    if (kind === "hour") {
      const nextHour = Math.round((angle / (Math.PI * 2)) * 24) % 24;
      onChange(`${String(nextHour).padStart(2, "0")}:${minuteValue || "00"}`);
    } else {
      const nextMinute = Math.round((angle / (Math.PI * 2)) * 60) % 60;
      onChange(`${hourValue || "00"}:${String(nextMinute).padStart(2, "0")}`);
    }
  };

  const handlePointerDown = (kind: "hour" | "minute") => (event: ReactPointerEvent<SVGGElement>) => {
    if (disabled) return;
    event.preventDefault();
    draggingRef.current = kind;
    setRing(kind);
    applyFromAngle(kind, event.clientX, event.clientY);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    applyFromAngle(draggingRef.current, event.clientX, event.clientY);
  };

  const handlePointerUp = () => {
    if (draggingRef.current === "hour") setRing("minute");
    draggingRef.current = null;
  };

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setOpen(false);
  };

  const displayValue = value || "—:—";

  return (
    <div className="time-clock-picker">
      <button
        type="button"
        id={id}
        className="time-clock-picker-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setRing("hour"); setOpen(true); }}
      >
        {displayValue}
      </button>
      {open ? (
        <div className="modal-backdrop time-clock-picker-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
          <div className="time-clock-picker-panel" role="dialog" aria-modal="true" aria-label="Выбор времени">
            <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
            <div className="time-clock-picker-tabs">
              <button type="button" className={ring === "hour" ? "active" : ""} onClick={() => setRing("hour")}>Часы</button>
              <button type="button" className={ring === "minute" ? "active" : ""} onClick={() => setRing("minute")}>Минуты</button>
            </div>
            <svg
              ref={faceRef}
              className="time-clock-face"
              viewBox="0 0 200 200"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <circle cx={CENTER} cy={CENTER} r={92} className="time-clock-dial" />
              <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="time-clock-readout">
                {hourValue || "--"}:{minuteValue || "00"}
              </text>
              <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="time-clock-readout-label">
                {ring === "hour" ? "выберите час" : "выберите минуту"}
              </text>
              {ring === "hour" ? (
                <g onPointerDown={handlePointerDown("hour")} className="time-clock-ring">
                  {Array.from({ length: 24 }, (_, index) => {
                    const point = pointOnCircle(HOUR_RADIUS, index, 24);
                    const active = hour === index;
                    return (
                      <g key={index}>
                        <circle cx={point.x} cy={point.y} r={active ? 12 : 8} className={active ? "time-clock-tick active" : "time-clock-tick"} />
                        {index % 2 === 0 ? (
                          <text x={point.x} y={point.y + 3.5} textAnchor="middle" className={active ? "time-clock-tick-label active" : "time-clock-tick-label"}>
                            {index}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              ) : (
                <g onPointerDown={handlePointerDown("minute")} className="time-clock-ring">
                  {Array.from({ length: 12 }, (_, index) => {
                    const minuteMark = index * 5;
                    const point = pointOnCircle(MINUTE_RADIUS, index, 12);
                    const active = minute >= minuteMark && minute < minuteMark + 5 && (minuteMark !== 55 || minute >= 55);
                    return (
                      <g key={index}>
                        <circle cx={point.x} cy={point.y} r={active ? 12 : 8} className={active ? "time-clock-tick active" : "time-clock-tick"} />
                        <text x={point.x} y={point.y + 3.5} textAnchor="middle" className={active ? "time-clock-tick-label active" : "time-clock-tick-label"}>
                          {String(minuteMark).padStart(2, "0")}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
            <div className="time-clock-picker-actions">
              <button type="button" className="text-button" onClick={() => { onChange(""); setOpen(false); }}>Очистить</button>
              <button type="button" className="primary-button" onClick={() => setOpen(false)}>Готово</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
