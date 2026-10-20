import { IconActionButton } from "./IconActionButton";
import { translateText, type Language } from "./i18n";
import "./habit-library-actions.css";

export function HabitLibraryActions({ isKeyHabit, active, language, onKey, onEdit, onToggleActive, onDelete }: {
  isKeyHabit: boolean; active: boolean; language: Language;
  onKey: () => void; onEdit: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const t = (ru: string, en: string) => language === "en" ? en : translateText(ru, language);
  return <div className="habit-library-actions">
    <IconActionButton icon="star" label={isKeyHabit ? t("Убрать фокус", "Remove focus") : t("Сделать главной", "Make key")} aria-pressed={isKeyHabit} onClick={onKey}/>
    <IconActionButton icon="edit" label={t("Изменить", "Edit")} onClick={onEdit}/>
    <IconActionButton icon={active ? "pause" : "play"} label={active ? t("Пауза", "Pause") : t("Включить", "Resume")} onClick={onToggleActive}/>
    <IconActionButton icon="delete" label={t("Удалить", "Delete")} className="danger" onClick={onDelete}/>
  </div>;
}
