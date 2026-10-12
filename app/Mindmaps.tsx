"use client";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GenesisProject, GenesisTask } from "./cloud-sync";
import { LOCAL_SESSION_ENDED_EVENT } from "./cloud-sync";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { attachTask, descendants, exportMindmap, importMindmap, mapId, mapMarkdown, mapProgress, mapSvg,
  moveNode, newMindmap, nodeTitle, nodeDateLabel, parseOutline, removeBranch, resolveMapTask, validateMindmap, visibleNodes, type MapNode, type Mindmap, type MapView } from "./mindmaps-model";
import { MindmapRepository, type Conversion, type MapRecord, type SaveState } from "./mindmaps-storage";
import "./mindmaps.css";
import { recurrenceDatesForTask } from "./task-recurrence";

const Canvas = lazy(() => import("./MindmapCanvas"));
const mobileQuery = () => window.matchMedia("(max-width: 760px)");
const subscribeMobile = (fn: () => void) => { const q = mobileQuery(); q.addEventListener("change", fn); return () => q.removeEventListener("change", fn); };
const mobileSnapshot = () => mobileQuery().matches;
const serverSnapshot = () => false;
export type MindmapTaskRequest = Conversion & { title: string; projectId: string | null; repository: MindmapRepository };
type Props = { userId: string; tasks: GenesisTask[]; projects: GenesisProject[]; projectId: string | null;
  projectForTask: (task: GenesisTask) => string | null;
  onClose: () => void; onCreateTask: (request: MindmapTaskRequest) => void; onEditTask: (task: GenesisTask, date?: string) => void;
  onToggleTask: (task: GenesisTask, date?: string) => void; onCalendar: (task: GenesisTask, date?: string) => void; onProject: (id: string) => void };

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogAccessibility<HTMLDivElement>(onClose);
  return <div className="modal-backdrop mindmap-dialog-backdrop"><div className="editor-modal mindmap-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
    <header><h2>{title}</h2><button type="button" aria-label="Закрыть окно карты" onClick={onClose}><ExperimentalIcon name="close" /></button></header>{children}
  </div></div>;
}
const statuses: Record<SaveState, string> = { saving: "Сохраняем защищённый черновик…", device: "Сохранено на устройстве", pending: "Ожидает синхронизации", synced: "Синхронизировано с сервером", conflict: "Конфликт: оба варианта сохранены", error: "Сохранение требует внимания" };
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Mindmaps(props: Props) {
  const [repository] = useState(() => new MindmapRepository(props.userId));
  const [records, setRecords] = useState<MapRecord[]>([]);
  const [record, setRecord] = useState<MapRecord | null>(null);
  const [map, setMap] = useState<Mindmap | null>(null);
  const current = useRef<Mindmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SaveState>("synced");
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<MapView>({ mode: "structure", collapsed: [], focus: null, zoom: 1 });
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [context, setContext] = useState(props.projectId ?? "");
  const [dialog, setDialog] = useState<"create" | "node" | "add" | "paste" | "import" | "export" | "history" | "delete" | null>(null);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("empty");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Mindmap | null>(null);
  const [versions, setVersions] = useState<MapRecord[]>([]);
  const [undo, setUndo] = useState<Mindmap[]>([]);
  const [redo, setRedo] = useState<Mindmap[]>([]);
  const [parent, setParent] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [chaosOnly, setChaosOnly] = useState(false);
  const [pickerTask, setPickerTask] = useState<GenesisTask | null>(null);
  const [pickerDate, setPickerDate] = useState("");
  const [importAsIdeas, setImportAsIdeas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [journal, setJournal] = useState<Conversion[]>([]);
  const alive = useRef(true);
  const panelHistory = useRef(false);
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
  const onStatus = (state: SaveState, message?: string) => { if (alive.current) { setStatus(state); if (message) setError(message === "MAP_REVISION_CONFLICT" ? "Другая вкладка изменила карту. Ваш текст сохранён отдельно. Откройте историю или сохраните этот вариант отдельной картой." : message); } };
  const fail = (e: unknown) => { if (alive.current) setError(e instanceof Error ? e.message : "Не удалось выполнить действие."); };
  const refresh = async () => { setLoading(true); try { const list = await repository.list(); if (alive.current) setRecords(list); } catch (e) { fail(e); } finally { if (alive.current) setLoading(false); } };
  const open = async (r: MapRecord) => {
    repository.adopt(r); current.current = r.document; setRecord(r); setMap(r.document); setSearch(""); setUndo([]); setRedo([]); setError("");
    setSelected(r.document.nodes.find(n => n.parentId === null)!.id); setStatus(r.pending ? "device" : "synced");
    const url = new URL(location.href); url.searchParams.set("mindmap", r.document.id);
    if (panelHistory.current) { panelHistory.current=false; history.replaceState({}, "", url); } else history.pushState({}, "", url);
    try {
      const savedView = await repository.view(r.document.id);
      if (!alive.current || current.current?.id !== r.document.id) return;
      setView(savedView ?? { mode: isMobile ? "structure" : "map", collapsed: r.document.nodes.length > 200 ? r.document.nodes.filter(n => n.parentId !== null).map(n => n.id) : [], focus: null, zoom: 1 });
      setJournal(await repository.conversions(r.document));
    } catch (e) { fail(e); }
  };
  useEffect(() => {
    alive.current = true;
    void repository.list().then(list => {
      if (!alive.current) return;
      setRecords(list); setLoading(false);
      const id = new URL(location.href).searchParams.get("mindmap");
      const item = list.find(r => r.document.id === id); if (item) void open(item);
    }).catch(e => { fail(e); setLoading(false); });
    const exit = () => { alive.current = false; repository.dispose(); current.current = null; setMap(null); setRecords([]); };
    const back = () => {
      if (panelHistory.current) { panelHistory.current=false; setDialog(null); return; }
      if (document.querySelector('.task-composer-modal') || new URL(location.href).searchParams.get('mindmap') === current.current?.id) return;
      current.current = null; setMap(null); setRecord(null); setSearch(""); void refresh();
    };
    window.addEventListener(LOCAL_SESSION_ENDED_EVENT, exit); window.addEventListener("popstate", back);
    return () => { alive.current = false; window.removeEventListener(LOCAL_SESSION_ENDED_EVENT, exit); window.removeEventListener("popstate", back); };
    // One repository is scoped to the keyed account component, never reused by another login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);
  useEffect(() => {
    if (dialog && !panelHistory.current) { history.pushState({ ...history.state, mindmapPanel:true },"",location.href); panelHistory.current=true; }
    if (!dialog && panelHistory.current && history.state?.mindmapPanel) history.back();
  }, [dialog]);
  useEffect(() => {
    if (status !== "saving") return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [status]);
  // Task creation can finish with the map request still offline. Recover only the reference.
  useEffect(() => {
    if (!map) return;
    let recovered = map;
    for (const op of journal) {
      const task = props.tasks.find(t => t.id === op.taskId);
      if (task && !op.applied && recovered.nodes.some(n => n.id === op.nodeId && n.kind === "idea")) recovered = attachTask(recovered, op.nodeId, task);
    }
    if (recovered !== map) queueMicrotask(() => {
      if (!alive.current || current.current !== map) return;
      current.current = recovered; setMap(recovered);
      void repository.save(recovered, onStatus).then(async () => {
        for (const op of journal) if (recovered.nodes.some(n => n.id === op.nodeId && n.refId === op.taskId)) await repository.journal({ ...op, applied: true });
        if (alive.current) setJournal(ops => ops.map(op => recovered.nodes.some(n => n.id === op.nodeId && n.refId === op.taskId) ? { ...op, applied: true } : op));
      }).catch(fail);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tasks, journal, repository]);
  const change = (next: Mindmap, history = true) => {
    try {
      const checked = validateMindmap(next);
      const previous = current.current;
      if (history && previous) { setUndo(u => [...u.slice(-19), previous]); setRedo([]); }
      current.current = checked; setMap(checked); setError(""); setStatus("pending");
      void repository.save(checked, onStatus).catch(fail);
    } catch (e) { fail(e); }
  };
  const changeView = (next: MapView) => { setView(next); if (map) void repository.saveView(map.id, next).catch(fail); };
  const titleFor = (n: MapNode) => nodeTitle(n, props.tasks, props.projects);
  const node = map?.nodes.find(n => n.id === selected) ?? map?.nodes[0];
  const task = node ? resolveMapTask(node,props.tasks) : undefined;
  const branchIds = useMemo(() => map && node ? descendants(map, node.id) : new Set<string>(), [map, node]);
  const taskDate = task?.recurrenceMode === "none" ? task.dueDate : node?.occurrenceDate;
  const rows = useMemo(() => map ? visibleNodes(map, view) : [], [map, view]);
  const progress = map ? mapProgress(map, props.tasks) : null;
  const saveDialog = () => setDialog(null);
  const addIdea = (sibling = false) => {
    if (!map || !node) return;
    const added: MapNode = { id: mapId(), parentId: sibling ? node.parentId ?? node.id : node.id, kind: "idea", text: "Новая мысль", note: "" };
    change({ ...map, nodes: [...map.nodes, added] }); setSelected(added.id); changeView({ ...view, collapsed: view.collapsed.filter(id => id !== added.parentId) }); setDialog("node");
  };
  const goCatalog = () => { const url = new URL(location.href); url.searchParams.delete("mindmap"); history.pushState({}, "", url); current.current = null; setMap(null); setRecord(null); setSearch(""); setError(""); void refresh(); };
  const handOffTaskPanel = () => {
    if (panelHistory.current) {
      panelHistory.current = false;
      history.replaceState({ genesisMindmapTaskPanel: true }, "", location.href);
    }
    setDialog(null);
  };
  const createTask = async () => {
    if (!map || !node || node.kind !== "idea" || busy) return;
    setBusy(true);
    try {
      const old = journal.find(j => j.nodeId === node.id);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${map.id}:${node.id}`));
      const taskId = `maptask-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
      const request: Conversion = old ?? { mapId: map.id, nodeId: node.id, taskId };
      await repository.journal(request); if (!alive.current) return; setJournal(j => [...j.filter(i => i.nodeId !== node.id), request]);
      handOffTaskPanel(); props.onCreateTask({ ...request, title: node.text!, projectId: map.projectId, repository });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const addTaskReference = (linked: GenesisTask, occurrenceDate?: string) => {
    if (!map || !node) return;
    const ref: MapNode = { id: mapId(), parentId: node.id, kind: "task", refId: linked.id, note: "", ...(occurrenceDate ? { occurrenceDate } : {}) };
    change({ ...map, nodes: [...map.nodes, ref] }); setSelected(ref.id); setPickerTask(null); setDialog(null);
  };
  const inspector = map && node ? <div className="mindmap-inspector-content">
    <h3>{node.kind === "idea" ? "Мысль" : node.kind === "task" ? "Задача GENESIS" : "Проект GENESIS"}</h3>
    {node.kind === "idea" ? <label>Название мысли<textarea rows={3} maxLength={2000} value={node.text} onChange={e => change({ ...map, title: node.parentId === null ? e.target.value || "Без названия" : map.title, nodes: map.nodes.map(n => n.id === node.id ? { ...n, text: e.target.value } : n) })} /></label>
      : <h4 data-no-translate>{titleFor(node)}</h4>}
    <label>Пояснение · только в карте<textarea rows={3} value={node.note} maxLength={12000} onChange={e => change({ ...map, nodes: map.nodes.map(n => n.id === node.id ? { ...n, note: e.target.value } : n) })} /></label>
    {node.kind === "idea" ? <><p>Мысль не имеет срока. Создание откроет обычную форму одной задачи; пояснение останется в карте.</p><button type="button" className="primary-button" disabled={busy || !node.text?.trim()} onClick={() => void createTask()}>Создать задачу из мысли</button></> : null}
    {task ? <><p>{task.done ? "Выполнено" : "В работе"} · {nodeDateLabel(node,props.tasks)}</p><p>Проект: {props.projects.find(p => p.id === props.projectForTask(task))?.title || "Хаос"}</p>
      {task.googleReadOnly ? <p>Источник Google разрешает только просмотр.</p> : <><button type="button" onClick={() => { handOffTaskPanel(); props.onEditTask(task, taskDate); }}>Открыть карточку задачи</button><button type="button" onClick={() => props.onToggleTask(task, taskDate)}>{task.done ? "Вернуть в работу" : "Выполнить задачу"}</button></>}
      <button type="button" disabled={!task.dueDate && !node.occurrenceDate} onClick={() => props.onCalendar(task, taskDate)}>Открыть в календаре</button>
      {node.occurrenceDate ? <p>Ссылка на экземпляр {node.occurrenceDate}. Действия не применяются ко всей серии.</p> : null}</> : null}
    {node.kind === "task" && !task ? <p>Задача удалена или недоступна. Старое название не хранится в карте.</p> : null}
    {node.kind === "project" ? <button type="button" disabled={!props.projects.some(p => p.id === node.refId)} onClick={() => props.onProject(node.refId!)}>Открыть личный проект</button> : null}
    <div className="mindmap-actions"><button type="button" onClick={() => addIdea()}>Добавить дочернюю мысль</button><button type="button" onClick={() => addIdea(true)}>Добавить соседнюю мысль</button>
      <button type="button" onClick={() => { setPickerQuery(""); setPickerTask(null); setDialog("add"); }}>Добавить из дел</button>
      <button type="button" onClick={() => { changeView({ ...view, focus: node.id }); setDialog(null); }}>Фокус на ветке</button>
      <button type="button" onClick={() => changeView({ ...view, collapsed: view.collapsed.includes(node.id) ? view.collapsed.filter(id => id !== node.id) : [...view.collapsed, node.id] })}>{view.collapsed.includes(node.id) ? "Развернуть ветку" : "Свернуть ветку"}</button></div>
    {node.parentId ? <><label>Переместить в ветку<select value={parent} onChange={e => setParent(e.target.value)}><option value="">Выберите родителя</option>{map.nodes.filter(n => !branchIds.has(n.id)).map(n => <option key={n.id} value={n.id}>{titleFor(n)}</option>)}</select></label>
      <button type="button" disabled={!parent} onClick={() => { try { change(moveNode(map, node.id, parent)); setParent(""); } catch(e) { fail(e); } }}>Переместить узел</button>
      <div className="mindmap-actions">{[-1,1].map(direction => <button key={direction} type="button" onClick={() => { const siblings = map.nodes.filter(n => n.parentId === node.parentId); const i = siblings.findIndex(n => n.id === node.id); const target = direction < 0 ? siblings[i-1] : siblings[i+2]; if ((direction < 0 && i > 0) || (direction > 0 && i < siblings.length-1)) change(moveNode(map,node.id,node.parentId!,target?.id)); }}>{direction < 0 ? "Выше" : "Ниже"}</button>)}</div>
      <button type="button" className="danger-button" onClick={() => setDialog("delete")}>Убрать ветку с карты</button></> : null}
    <details><summary>Смысловые связи</summary><p>«Связано с» не меняет зависимости задач.</p>
      <label>Связать с<select value={linkTo} onChange={e => setLinkTo(e.target.value)}><option value="">Выберите узел</option>{map.nodes.filter(n => n.id !== node.id).map(n => <option key={n.id} value={n.id}>{titleFor(n)}</option>)}</select></label>
      <label>Подпись связи<input value={linkLabel} maxLength={240} onChange={e => setLinkLabel(e.target.value)} /></label>
      <button type="button" disabled={!linkTo} onClick={() => { change({ ...map, links: [...map.links, { id: mapId(), from: node.id, to: linkTo, label: linkLabel }] }); setLinkTo(""); setLinkLabel(""); }}>Добавить связь</button>
      {map.links.filter(l => l.from === node.id || l.to === node.id).map(l => <div key={l.id}><span>{l.label || "Связано с"}: {titleFor(map.nodes.find(n => n.id === (l.from === node.id ? l.to : l.from))!)}</span><button type="button" aria-label="Убрать смысловую связь" onClick={() => change({ ...map, links: map.links.filter(x => x.id !== l.id) })}>Убрать связь</button></div>)}
    </details>
  </div> : null;

  return <section className="mindmaps" aria-label="Личные майндмепы">
    <header className="mindmap-header"><div><button type="button" className="text-button" onClick={map ? goCatalog : props.onClose}>{map ? "Все майндмепы" : "К личным делам"}</button><h2 data-no-translate>{map?.title || "Майндмепы"}</h2><p>{map ? progress!.total ? `Связанные задачи: ${progress!.done} из ${progress!.total}` : "Пока только идеи" : "Связывайте идеи, проекты и задачи."}</p></div>
      {map ? <span role="status" className="mindmap-save-state">{statuses[status]}</span> : <button type="button" className="primary-button" onClick={() => { setTitle(""); setDialog("create"); }}>Создать карту</button>}
    </header>
    {error && !dialog ? <div role="alert" className="mindmap-error"><p>{error}</p>{map ? <div className="mindmap-actions"><button type="button" onClick={() => { setError(""); void (record?.pending && record.draftKey ? repository.retry(record, onStatus) : repository.save(map, onStatus)).catch(fail); }}>Повторить сохранение</button><button type="button" onClick={() => { void repository.forkDraft(map, onStatus).then(copy => { setError(""); return open({ document: copy, revision: 1, updatedAt: "" }); }).catch(fail); }}>Сохранить отдельный вариант</button><button type="button" onClick={goCatalog}>Показать серверную версию</button></div> : <button type="button" onClick={() => void refresh()}>Повторить загрузку</button>}</div> : null}
    {map && record?.pending && !error ? <div className="mindmap-recovery"><p>Открыт защищённый черновик с устройства.</p><button type="button" onClick={() => { void repository.retry(record, onStatus).then(() => setRecord(r => r ? { ...r, pending: false } : r)).catch(fail); }}>Отправить сохранённый черновик</button></div> : null}
    {!map ? <>
      <div className="mindmap-toolbar"><label className="mindmap-search">Поиск карт<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название карты" /><ExperimentalIcon name="search" /></label>
        <label>Контекст проекта<select value={context} onChange={e => setContext(e.target.value)}><option value="">Все личные карты</option>{props.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <button type="button" aria-pressed={archived} onClick={() => setArchived(!archived)}>{archived ? "Показать текущие" : "Архив"}</button><button type="button" onClick={() => { setPreview(null); setImportAsIdeas(false); setDialog("import"); }}>Импорт JSON</button><button type="button" onClick={() => void refresh()}>Обновить</button>
      </div>
      {loading ? <p role="status">Открываем зашифрованные карты…</p> : null}
      <div className="mindmap-catalog">{records.filter(r => r.document.archived === archived && (!context || r.document.projectId === context) && r.document.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b) => Number(b.document.pinned)-Number(a.document.pinned)).map(r => <article key={r.draftKey || r.document.id}>
        <button type="button" className="mindmap-catalog-open" onClick={() => void open(r)}><strong data-no-translate>{r.document.title}</strong><span>{r.pending ? "Черновик на устройстве" : `Версия ${r.revision}`} · {r.document.nodes.length} узлов{r.document.pinned ? " · Закреплена" : ""}</span><span>{props.projects.find(p => p.id === r.document.projectId)?.title || "Без проекта"}</span></button>
        <div className="mindmap-actions"><button type="button" onClick={() => { repository.adopt(r); void repository.save({ ...r.document, pinned: !r.document.pinned }, onStatus).then(refresh).catch(fail); }}>{r.document.pinned ? "Открепить" : "Закрепить"}</button><button type="button" onClick={() => { repository.adopt(r); void repository.save({ ...r.document, archived: !r.document.archived }, onStatus).then(refresh).catch(fail); }}>{archived ? "Восстановить" : "Архивировать"}</button></div>
      </article>)}</div>
      {!loading && search && !records.some(r => r.document.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ? <p>Ничего не найдено. Измените запрос.</p> : null}
      {!loading && !records.some(r => r.document.archived === archived && (!context || r.document.projectId === context)) ? <div className="mindmap-empty"><h3>{archived ? "Архив пуст" : "Начните с одной мысли"}</h3><p>Карта помогает разобрать замысел. Задачи появятся в делах только после вашего подтверждения.</p></div> : null}
    </> : <>
      <div className="mindmap-toolbar"><div role="group" aria-label="Представление карты"><button type="button" aria-pressed={view.mode === "map"} onClick={() => changeView({ ...view, mode: "map" })}>Карта</button><button type="button" aria-pressed={view.mode === "structure"} onClick={() => changeView({ ...view, mode: "structure" })}>Структура</button></div>
        <button type="button" className="primary-button" onClick={() => addIdea()}>Добавить мысль</button><button type="button" onClick={() => { setPickerQuery(""); setPickerTask(null); setDialog("add"); }}>Добавить из дел</button>
        <details className="mindmap-more"><summary>Карта и файлы</summary><div className="mindmap-actions"><button type="button" disabled={!undo.length} onClick={() => { const previous = undo.at(-1)!; setUndo(u => u.slice(0,-1)); setRedo(r => [...r,map]); change(previous,false); }}>Отменить изменение карты</button>
        <button type="button" disabled={!redo.length} onClick={() => { const next = redo.at(-1)!; setRedo(r => r.slice(0,-1)); setUndo(u => [...u,map]); change(next,false); }}>Повторить изменение карты</button><button type="button" onClick={() => { setText(""); setPreview(null); setDialog("paste"); }}>Вставить текст</button><button type="button" onClick={() => setDialog("export")}>Экспорт</button><button type="button" onClick={() => { setVersions([]); setDialog("history"); void repository.history(map.id).then(setVersions).catch(fail); }}>История</button></div>
          <label>Название карты<input value={map.title} maxLength={2000} onChange={e => change({ ...map, title: e.target.value || "Без названия", nodes: map.nodes.map(n => n.parentId === null && n.kind === "idea" ? { ...n, text: e.target.value } : n) })} /></label>
          <label>Контекстный проект<select value={map.projectId || ""} onChange={e => change({ ...map, projectId: e.target.value || null })}><option value="">Без проекта</option>{props.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        </details>
      </div>
      <div className="mindmap-toolbar"><label className="mindmap-search">Найти узел<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Мысль или связанное дело" /><ExperimentalIcon name="search" /></label>{view.focus ? <button type="button" onClick={() => changeView({ ...view, focus: null })}>Вся карта</button> : null}</div>
      {search ? <div className="mindmap-search-results" aria-label="Найденные узлы">{!map.nodes.some(n => `${titleFor(n)} ${n.note}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ? <p>Ничего не найдено. Измените запрос.</p> : null}{map.nodes.filter(n => `${titleFor(n)} ${n.note}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(n => <button type="button" key={n.id} onClick={() => { setSelected(n.id); changeView({ ...view, focus: n.id, collapsed: view.collapsed.filter(id => id !== n.id) }); setSearch(""); }}>{titleFor(n)} · Показать ветку</button>)}</div> : null}
      <div className="mindmap-workspace"><div className="mindmap-editor">
        {view.mode === "map" ? <Suspense fallback={<p>Открываем полотно…</p>}><Canvas map={map} view={view} selected={selected} title={titleFor} onSelect={setSelected} onZoom={zoom => changeView({ ...view, zoom })} onViewport={viewport => changeView({ ...view, viewport })} /></Suspense>
          : <ol className="mindmap-structure" aria-label="Структура карты">{rows.map(r => <li key={r.node.id} style={{ paddingInlineStart: Math.min(r.depth,3)*16 }}>
            <button type="button" className="mindmap-collapse" aria-expanded={r.children ? !view.collapsed.includes(r.node.id) : undefined} aria-label={`${view.collapsed.includes(r.node.id) ? "Развернуть" : "Свернуть"}: ${titleFor(r.node)}`} disabled={!r.children} onClick={() => changeView({ ...view, collapsed: view.collapsed.includes(r.node.id) ? view.collapsed.filter(id => id !== r.node.id) : [...view.collapsed,r.node.id] })}><ExperimentalIcon name="chevron" /></button>
            <button type="button" className="mindmap-row" aria-pressed={selected === r.node.id} onClick={() => setSelected(r.node.id)}><strong data-no-translate>{titleFor(r.node)}</strong><span>{r.node.kind === "idea" ? "Мысль" : r.node.kind === "project" ? "Проект" : `${resolveMapTask(r.node, props.tasks)?.done ? "Выполнено" : "Задача"} · ${nodeDateLabel(r.node, props.tasks)}`}{r.depth > 3 ? ` · уровень ${r.depth+1}` : ""}</span></button>
            <button type="button" aria-label={`Изменить узел: ${titleFor(r.node)}`} onClick={() => { setSelected(r.node.id); setDialog("node"); }}><ExperimentalIcon name="edit" /></button>
          </li>)}</ol>}
        {isMobile && node ? <button type="button" className="mindmap-mobile-inspector primary-button" onClick={() => setDialog("node")}>Действия с выбранным узлом</button> : null}
      </div>{!isMobile ? <aside className="mindmap-inspector" aria-label="Выбранный узел">{inspector}</aside> : null}</div>
    </>}
    {dialog ? <Dialog title={({ create:"Новая карта", node:"Редактор узла", add:"Добавить из личных дел", paste:"Мысли из текста", import:"Импорт карты GENESIS", export:"Экспорт карты", history:"История карты", delete:"Убрать ветку" })[dialog]} onClose={saveDialog}>
      {error ? <p role="alert">{error}</p> : null}
      {dialog === "create" ? <form onSubmit={e => { e.preventDefault(); try { const created = newMindmap(title,context || null,template); setDialog(null); void open({document:created,revision:0,updatedAt:""}); change(created,false); } catch(e) { fail(e); } }}><label>Название карты<input required value={title} maxLength={2000} onChange={e => setTitle(e.target.value)} data-dialog-initial-focus /></label><label>Начать с<select value={template} onChange={e => setTemplate(e.target.value)}><option value="empty">Одна мысль</option><option value="idea">Разобрать идею</option><option value="project">План проекта</option><option value="decision">Выбрать решение</option></select></label><p>Шаблон создаёт только мысли.</p><button type="submit" className="primary-button">Создать карту</button></form> : null}
      {dialog === "node" ? inspector : null}
      {dialog === "delete" && map && node ? <><p>Убрать {descendants(map,node.id).size} узлов? Настоящие задачи и проекты останутся. Изменение карты можно отменить.</p><button type="button" className="danger-button" onClick={() => { change(removeBranch(map,node.id)); setSelected(map.nodes.find(n => n.parentId === null)!.id); setDialog(null); }}>Убрать только с карты</button></> : null}
      {dialog === "add" && map && node ? <><label>Поиск личных дел<input value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} /></label><label><input type="checkbox" checked={chaosOnly} onChange={e => setChaosOnly(e.target.checked)} />Только «Хаос»</label><p>Добавляется ссылка. Проект задачи и её зависимости сохраняются. Для повторяющейся задачи выберите конкретный день перед привязкой.</p>
        {pickerTask ? <div className="mindmap-occurrence-picker"><h3>{pickerTask.title}</h3><label>День повторения<select value={pickerDate} onChange={e => setPickerDate(e.target.value)}>{recurrenceDatesForTask(pickerTask).map(date => <option key={date} value={date}>{date}</option>)}</select></label><p>На карте будет только выбранный экземпляр.</p><button type="button" className="primary-button" disabled={!pickerDate} onClick={() => addTaskReference(pickerTask, pickerDate)}>Привязать этот день</button></div> : null}
        <div className="mindmap-picker">{props.tasks.filter(t => (!chaosOnly || !props.projectForTask(t)) && t.title.toLowerCase().includes(pickerQuery.toLowerCase())).map(t => <button type="button" key={t.id} onClick={() => { if (t.recurrenceMode !== "none") { setPickerTask(t); setPickerDate(recurrenceDatesForTask(t)[0] || ""); } else addTaskReference(t); }}><strong>{t.title}</strong><span>{t.done ? "Выполнено" : "В работе"} · {t.dueDate || "Без срока"} · {props.projects.find(p=>p.id===props.projectForTask(t))?.title || "Хаос"}</span></button>)}
        {!chaosOnly ? props.projects.filter(p=>p.title.toLowerCase().includes(pickerQuery.toLowerCase())).map(p=><button type="button" key={p.id} onClick={()=>{const ref:MapNode={id:mapId(),parentId:node.id,kind:"project",refId:p.id,note:""};change({...map,nodes:[...map.nodes,ref]});setSelected(ref.id);setDialog(null);}}><strong>{p.title}</strong><span>Личный проект</span></button>) : null}</div>{!props.tasks.length && !props.projects.length ? <p>Пока нечего добавить. Создайте мысль, а затем задачу.</p> : null}</> : null}
      {dialog === "paste" && map && node ? <><p>Одна строка — одна мысль; два пробела или табуляция — один уровень. Пустые строки пропускаются. До 200 мыслей за вставку.</p><textarea aria-label="Текст для вставки" rows={8} value={text} maxLength={100000} onChange={e=>{setText(e.target.value);setPreview(null);}} /><button type="button" onClick={()=>{try {const nodes=parseOutline(text,node.id);setPreview(validateMindmap({...map,nodes:[...map.nodes,...nodes]}));}catch(e){fail(e);}}}>Предпросмотр вставки</button>{preview?.id===map.id ? <><pre>{mapMarkdown(preview,titleFor)}</pre><button type="button" className="primary-button" onClick={()=>{change(preview);setPreview(null);setDialog(null);}}>Добавить мысли</button></> : null}</> : null}
      {dialog === "import" ? <><p>Собственный JSON GENESIS v1, до 2 МБ. Импорт не создаёт задач и не предоставляет доступ.</p><input type="file" accept=".json,application/json" aria-label="Выберите JSON карты" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setPreview(null);try{if(file.size>2_000_000)throw new Error("Файл больше 2 МБ.");setPreview(importMindmap(await file.text()));}catch(e){fail(e);}}}/>{preview ? <><h3>{preview.title}</h3><p>{preview.nodes.length} узлов · {preview.links.length} связей. Недоступные ссылки останутся помеченными; прав они не дают.</p><pre>{mapMarkdown(preview,titleFor)}</pre><label><input type="checkbox" checked={importAsIdeas} onChange={e=>setImportAsIdeas(e.target.checked)}/>Превратить недоступные ссылки в мысли</label><button type="button" className="primary-button" onClick={()=>{const copy=validateMindmap({...preview,id:mapId(),nodes:preview.nodes.map(n=>importAsIdeas && ((n.kind==="task" && !resolveMapTask(n,props.tasks)) || (n.kind==="project" && !props.projects.some(p=>p.id===n.refId))) ? {id:n.id,parentId:n.parentId,kind:"idea",text:"Недоступная ссылка",note:n.note}:n),projectId:props.projects.some(p=>p.id===preview.projectId)?preview.projectId:null});setDialog(null);void open({document:copy,revision:0,updatedAt:""});change(copy,false);}}>Импортировать отдельную карту</button></> : null}</> : null}
      {dialog === "export" && map ? <><p>Файл будет незашифрованным. JSON содержит мысли, пояснения и ID ссылок; Markdown и SVG также содержат доступные названия задач и проектов. Храните файл в безопасном месте.</p><div className="mindmap-actions">{["JSON","Markdown","SVG"].map(format=><button type="button" key={format} onClick={()=>download(`GENESIS-map.${format==='JSON'?'json':format==='SVG'?'svg':'md'}`,format==='JSON'?exportMindmap(map):format==='SVG'?mapSvg(map,titleFor):mapMarkdown(map,titleFor),format==='SVG'?'image/svg+xml':'text/plain;charset=utf-8')}>Экспортировать {format}</button>)}</div></> : null}
      {dialog === "history" && map ? <><p>Последние 20 подтверждённых версий. Восстановление меняет только карту; задачи не откатываются.</p>{versions.map(v=><article key={v.revision}><h3>Версия {v.revision}</h3><p>{v.updatedAt} · {v.document.title} · {v.document.nodes.length} узлов</p><details><summary>Посмотреть содержимое</summary><pre>{mapMarkdown(v.document,titleFor)}</pre></details><button type="button" onClick={()=>{change(v.document);setDialog(null);}}>Восстановить эту версию карты</button></article>)}</> : null}
    </Dialog> : null}
  </section>;
}
