import type { SharedTask } from "./cloud-sync";

export type GanttScale = "day" | "days" | "weeks" | "months";
export function dateSerial(key: string) { return Date.parse(`${key}T00:00:00Z`) / 86400000; }
export function serialDate(value: number) { return new Date(value * 86400000).toISOString().slice(0, 10); }
export function timeFraction(value?: string | null) { const [h, m] = (value ?? "00:00").split(":").map(Number); return (h * 60 + m) / 1440; }
export function taskSpan(task: SharedTask): { start: number; end: number; timed: boolean } | null {
  const first = task.startDate || task.dueDate; const last = task.dueDate || task.startDate;
  if (!first || !last) return null;
  const timed = Boolean(task.startTime && task.endTime);
  return { start: dateSerial(first) + (timed ? timeFraction(task.startTime) : 0),
    end: dateSerial(last) + (timed ? timeFraction(task.endTime) : 1), timed };
}
export function ganttRange(anchor: string, scale: GanttScale, tasks: SharedTask[], fit = false) {
  const day = dateSerial(anchor);
  if (scale === "day") return { start: day, end: day + 1 };
  if (fit) {
    const spans = tasks.map(taskSpan).filter((span): span is NonNullable<typeof span> => Boolean(span));
    if (spans.length) { const start = Math.floor(Math.min(...spans.map(span => span.start))) - 1;
      return { start, end: Math.min(start + 366, Math.ceil(Math.max(...spans.map(span => span.end))) + 1) }; }
  }
  const weekday = (new Date(day * 86400000).getUTCDay() + 6) % 7;
  if (scale === "days") return { start: day - weekday, end: day - weekday + 14 };
  if (scale === "weeks") return { start: day - weekday, end: day - weekday + 56 };
  const date = new Date(day * 86400000);
  return { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 86400000,
    end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 6, 1) / 86400000 };
}

export type GanttSchedule = {startDate: string; dueDate: string; startTime: string | null; endTime: string | null};
/** Snaps in UTC date arithmetic; browser time zone and DST cannot change the duration. */
export function ganttSchedule(task: SharedTask, point: number, scale: GanttScale): GanttSchedule {
  const span=taskSpan(task);
  const minuteTime=(value:number)=>`${String(Math.floor(value/60)%24).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
  if(scale==="day") {
    const start=Math.round(point*96)*15;
    const duration=span?.timed ? Math.max(1,Math.round((span.end-span.start)*1440)) : 60;
    return {startDate:serialDate(Math.floor(start/1440)),dueDate:serialDate(Math.floor((start+duration)/1440)),startTime:minuteTime(start),endTime:minuteTime(start+duration)};
  }
  const first=Math.floor(point+1e-7);
  const days=span ? Math.floor(span.end-(span.timed ? 0 : 1)+1e-7)-Math.floor(span.start) : 0;
  return {startDate:serialDate(first),dueDate:serialDate(first+days),startTime:span?.timed ? task.startTime! : null,endTime:span?.timed ? task.endTime! : null};
}
