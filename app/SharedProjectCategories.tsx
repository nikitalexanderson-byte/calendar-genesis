"use client";
import { type CSSProperties, type FormEvent, useState } from "react";
import { deleteSharedProjectCategory, saveSharedProjectCategory, type SharedCategory, type SharedProject } from "./cloud-sync";
import { ExperimentalIcon } from "./ExperimentalIcon";

export function SharedProjectCategories({ spaceId, categories, projects, canManage, english, onChanged, onOpen }: {
  spaceId: string; categories: SharedCategory[]; projects: SharedProject[]; canManage: boolean; english: boolean;
  onChanged: () => Promise<void>; onOpen: (project: SharedProject) => void;
}) {
  const [editing, setEditing] = useState<SharedCategory | null>(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#2d6c68");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); await onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    void run(async () => {
      await saveSharedProjectCategory(spaceId, { title: title.trim(), color, expectedRevision: editing?.revision }, editing?.id);
      setEditing(null); setTitle("");
    });
  };
  const projectItems = projects.filter(project => !project.isInbox && project.kind !== "task-list");
  return <section className="shared-project-categories" aria-label={english ? "Project categories" : "Категории проектов"}>
    <h3>{english ? "Project categories" : "Категории проектов"}</h3>
    <div className="category-strip">
      {[...categories, { id: "", title: english ? "No category" : "Без категории", color: "#718077", position: 0, revision: 0 }].map(category => {
        const items = projectItems.filter(project => (project.categoryId ?? "") === category.id);
        return <article key={category.id} style={{ "--category-color": category.color } as CSSProperties}>
          <i aria-hidden="true" /><strong>{category.title}</strong><span>{items.length} {english ? "projects" : "проектов"}</span>
          {category.id && canManage ? <div className="category-actions">
            <button type="button" disabled={busy} aria-label={english ? `Edit category ${category.title}` : `Редактировать категорию «${category.title}»`}
              onClick={() => { setEditing(category); setTitle(category.title); setColor(category.color); }}><ExperimentalIcon name="edit" /></button>
            <button type="button" disabled={busy} aria-label={english ? `Delete category ${category.title}` : `Удалить категорию «${category.title}»`}
              onClick={() => { if (window.confirm(english ? "Delete this category? Projects and tasks will be kept." : "Удалить категорию? Проекты и задачи сохранятся.")) void run(async () => {
                await deleteSharedProjectCategory(spaceId, category.id, category.revision);
                if (editing?.id === category.id) { setEditing(null); setTitle(""); }
              }); }}><ExperimentalIcon name="delete" /></button>
          </div> : null}
          {items.length ? <div className="shared-category-projects">{items.map(project => <button type="button" key={project.id} onClick={() => onOpen(project)}>
            <ExperimentalIcon name="projects" /><span>{project.title}</span>
          </button>)}</div> : null}
        </article>;
      })}
    </div>
    {canManage ? <form className="shared-category-form" onSubmit={submit}>
      <label>{english ? "Category name" : "Название категории"}<input maxLength={80} required value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>{english ? "Color" : "Цвет"}<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
      <button type="submit" disabled={busy || !title.trim()}>{editing ? (english ? "Save" : "Сохранить") : (english ? "Create category" : "Создать категорию")}</button>
      {editing ? <button type="button" disabled={busy} onClick={() => { setEditing(null); setTitle(""); }}>{english ? "Cancel" : "Отмена"}</button> : null}
    </form> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
