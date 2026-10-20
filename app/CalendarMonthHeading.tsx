import type { ReactNode } from "react";
import { ExperimentalIcon } from "./ExperimentalIcon";

export function CalendarMonthHeading({ title, icon, previousLabel, nextLabel, onPrevious, onNext }: {
  title: string; icon: ReactNode; previousLabel: string; nextLabel: string;
  onPrevious: () => void; onNext: () => void;
}) {
  return <div className="calendar-month-title-row">
    <button type="button" className="calendar-inline-arrow calendar-inline-previous" aria-label={previousLabel} onClick={onPrevious}><ExperimentalIcon name="chevron"/></button>
    <div className="calendar-month-title"><span className="calendar-inline-symbol" aria-hidden="true">{icon}</span><h1>{title}</h1></div>
    <button type="button" className="calendar-inline-arrow" aria-label={nextLabel} onClick={onNext}><ExperimentalIcon name="chevron"/></button>
  </div>;
}
