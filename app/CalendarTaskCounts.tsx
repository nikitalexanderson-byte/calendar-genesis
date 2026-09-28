type TaskState = { done: boolean };

function taskCounts(tasks: readonly TaskState[]) {
  const completed = tasks.filter((task) => task.done).length;
  return [
    { status: "pending", count: tasks.length - completed },
    { status: "completed", count: completed },
  ].filter((item) => item.count > 0);
}

export function CalendarDayTaskCounts({ tasks, dateLabel, language, onOpen, expanded, controls }: {
  tasks: readonly TaskState[]; dateLabel: string; language: string; onOpen: () => void;
  expanded: boolean; controls: string;
}) {
  return taskCounts(tasks).map(({ status, count }) => {
    const stateLabel = language === "en"
      ? status === "completed" ? "Completed" : "Incomplete"
      : status === "completed" ? "Выполнено" : "Не выполнено";
    const label = `${stateLabel}: ${count}. ${language === "en" ? "Show tasks for" : "Показать задачи на"} ${dateLabel}`;
    return <button key={status} type="button" className="calendar-day-task-count"
      data-task-status={status} onClick={onOpen} title={label} aria-label={label}
      aria-expanded={expanded} aria-controls={controls} aria-haspopup="dialog">{count}</button>;
  });
}

export function CalendarYearTaskCounts({ tasks }: { tasks: readonly TaskState[] }) {
  const counts = taskCounts(tasks);
  return counts.map(({ status, count }) => <span key={status} className="mini-day-task-count"
    data-task-status={status} data-mixed={counts.length > 1 || undefined} aria-hidden="true">{count}</span>);
}
