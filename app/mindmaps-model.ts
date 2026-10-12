import type { GenesisProject, GenesisTask } from "./cloud-sync";
import { recurrenceDatesForTask } from "./task-recurrence";

export const MAP_LIMITS = { nodes: 1000, depth: 32, text: 2000, note: 12000, links: 2000, bytes: 2_000_000, paste: 200 };
export type MapNode = { id: string; parentId: string | null; kind: "idea" | "task" | "project";
  text?: string; refId?: string; occurrenceDate?: string; note: string };
export type MapLink = { id: string; from: string; to: string; label: string };
export type Mindmap = { schemaVersion: 1; id: string; title: string; projectId: string | null;
  pinned: boolean; archived: boolean; nodes: MapNode[]; links: MapLink[] };
export type MapView = { mode: "map" | "structure"; collapsed: string[]; focus: string | null; zoom: number; viewport?: {left:number;top:number} };
export const mapId = () => crypto.randomUUID();
const validId = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const string = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
function invalid(): never { throw new Error("Файл карты повреждён или превышает ограничения (1000 узлов, 32 уровня, 2 МБ)."); }

/** Construct a clean document: imported fields never become permissions, HTML or task data. */
export function validateMindmap(input: unknown): Mindmap {
  if (!input || typeof input !== "object") return invalid();
  const m = input as Mindmap;
  if (m.schemaVersion !== 1) throw new Error("Эта версия карты не поддерживается. Обновите приложение; файл не изменён.");
  if (!validId(m.id) || !string(m.title, MAP_LIMITS.text) || !m.title.trim()
    || !(m.projectId === null || validId(m.projectId)) || typeof m.pinned !== "boolean" || typeof m.archived !== "boolean"
    || !Array.isArray(m.nodes) || !m.nodes.length || m.nodes.length > MAP_LIMITS.nodes
    || !Array.isArray(m.links) || m.links.length > MAP_LIMITS.links) return invalid();
  const ids = new Set<string>();
  const nodes = m.nodes.map(n => {
    if (!n || !validId(n.id) || ids.has(n.id) || !(n.parentId === null || validId(n.parentId))
      || !["idea", "task", "project"].includes(n.kind) || !string(n.note, MAP_LIMITS.note)) return invalid();
    ids.add(n.id);
    if (n.kind === "idea" && !string(n.text, MAP_LIMITS.text)) return invalid();
    if (n.kind !== "idea" && !validId(n.refId)) return invalid();
    if (n.occurrenceDate !== undefined && (n.kind !== "task" || !/^\d{4}-\d{2}-\d{2}$/.test(n.occurrenceDate)
      || new Date(n.occurrenceDate).toISOString().slice(0, 10) !== n.occurrenceDate)) return invalid();
    return { id: n.id, parentId: n.parentId, kind: n.kind, note: n.note,
      ...(n.kind === "idea" ? { text: n.text! } : { refId: n.refId! }),
      ...(n.occurrenceDate ? { occurrenceDate: n.occurrenceDate } : {}) };
  });
  if (nodes.filter(n => n.parentId === null).length !== 1) return invalid();
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent !== null) {
      if (!byId.has(parent) || seen.has(parent) || seen.size >= MAP_LIMITS.depth) return invalid();
      seen.add(parent); parent = byId.get(parent)!.parentId;
    }
  }
  const linkIds = new Set<string>();
  const links = m.links.map(l => {
    if (!l || !validId(l.id) || linkIds.has(l.id) || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to || !string(l.label, 240)) return invalid();
    linkIds.add(l.id); return { id: l.id, from: l.from, to: l.to, label: l.label };
  });
  const result: Mindmap = { schemaVersion: 1, id: m.id, title: m.title, projectId: m.projectId, pinned: m.pinned, archived: m.archived, nodes, links };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAP_LIMITS.bytes) return invalid();
  return result;
}

export function newMindmap(title: string, projectId: string | null = null, template = "empty"): Mindmap {
  const root: MapNode = { id: mapId(), parentId: null, kind: "idea", text: title.trim(), note: "" };
  const templates: Record<string, string[]> = { idea: ["Замысел", "Что уже известно", "Вопросы", "Следующий шаг"],
    project: ["Результат", "Этапы", "Ресурсы", "Риски"], decision: ["Критерии", "Варианты", "За и против", "Решение"] };
  return validateMindmap({ schemaVersion: 1, id: mapId(), title: title.trim(), projectId, pinned: false, archived: false,
    nodes: [root, ...(templates[template] ?? []).map(text => ({ id: mapId(), parentId: root.id, kind: "idea", text, note: "" }))], links: [] });
}

export function descendants(map: Mindmap, id: string): Set<string> {
  const children = new Map<string | null, MapNode[]>();
  for (const n of map.nodes) { const list = children.get(n.parentId) ?? []; list.push(n); children.set(n.parentId, list); }
  const result = new Set<string>(); const pending = [id];
  while (pending.length) { const next = pending.pop()!; if (result.has(next)) continue; result.add(next); pending.push(...(children.get(next) ?? []).map(n => n.id)); }
  return result;
}
export function removeBranch(map: Mindmap, id: string): Mindmap {
  if (map.nodes.find(n => n.id === id)?.parentId === null) throw new Error("Корень нельзя убрать. Архивируйте карту из каталога.");
  const removed = descendants(map, id);
  return validateMindmap({ ...map, nodes: map.nodes.filter(n => !removed.has(n.id)), links: map.links.filter(l => !removed.has(l.from) && !removed.has(l.to)) });
}
export function moveNode(map: Mindmap, id: string, parentId: string, before?: string): Mindmap {
  const node = map.nodes.find(n => n.id === id);
  if (!node || node.parentId === null || descendants(map, id).has(parentId)) throw new Error("Нельзя перенести корень или создать цикл.");
  const nodes = map.nodes.filter(n => n.id !== id);
  const index = before ? nodes.findIndex(n => n.id === before) : -1;
  nodes.splice(index < 0 ? nodes.length : index, 0, { ...node, parentId });
  return validateMindmap({ ...map, nodes });
}
export function attachTask(map: Mindmap, nodeId: string, task: GenesisTask): Mindmap {
  return validateMindmap({ ...map, nodes: map.nodes.map(n => n.id === nodeId
    ? { id: n.id, parentId: n.parentId, kind: "task", refId: task.id, note: n.note,
      ...(task.recurrenceMode !== "none" && task.dueDate ? { occurrenceDate: task.dueDate } : {}) } : n) });
}
export function nodeTitle(node: MapNode, tasks: GenesisTask[], projects: GenesisProject[]) {
  return node.kind === "idea" ? node.text! : node.kind === "task"
    ? resolveMapTask(node, tasks)?.title ?? "Задача недоступна"
    : projects.find(p => p.id === node.refId)?.title ?? "Проект недоступен";
}
/** An exception replaces this occurrence, while the link keeps its original series identity. */
export function resolveMapTask(node: MapNode, tasks: GenesisTask[]) {
  if (node.kind !== "task") return undefined;
  const exception = node.occurrenceDate ? tasks.find(t => t.recurrenceSeriesId === node.refId && (t.recurrenceOriginalDate || t.dueDate) === node.occurrenceDate) : undefined;
  if (exception) return exception;
  const original = tasks.find(t => t.id === node.refId);
  if (original && original.recurrenceMode !== "none" && (!node.occurrenceDate || !recurrenceDatesForTask(original).includes(node.occurrenceDate))) return undefined;
  if (node.occurrenceDate && original?.recurrenceExcludedDates.includes(node.occurrenceDate)) return undefined;
  return original;
}
export function mapProgress(map: Mindmap, tasks: GenesisTask[]) {
  const linked = [...new Map(map.nodes.flatMap(n => {
    const task = resolveMapTask(n, tasks);
    return task ? [[task.recurrenceMode !== "none" ? `${task.id}@${n.occurrenceDate}` : task.id, task] as const] : [];
  })).values()];
  return { total: linked.length, done: linked.filter(t => t.done).length };
}
/** dueDate is the existing domain's start; endDate is its deadline. */
export function nodeDateLabel(node: MapNode, tasks: GenesisTask[]) {
  const task = resolveMapTask(node, tasks);
  if (!task) return "Без срока";
  const start = task.recurrenceMode !== "none" ? node.occurrenceDate : task.dueDate;
  let end = task.endDate;
  if (start && end && task.recurrenceMode !== "none") {
    const shifted = Date.parse(end + "T12:00:00Z") + Date.parse(start + "T12:00:00Z") - Date.parse(task.dueDate + "T12:00:00Z");
    end = Number.isFinite(shifted) ? new Date(shifted).toISOString().slice(0,10) : start;
  }
  return start ? end && end !== start ? `${start} — ${end}` : start : "Без срока";
}
export function visibleNodes(map: Mindmap, view: MapView) {
  const root = view.focus && map.nodes.some(n => n.id === view.focus) ? view.focus : map.nodes.find(n => n.parentId === null)!.id;
  const children = new Map<string | null, MapNode[]>();
  for (const n of map.nodes) { const list = children.get(n.parentId) ?? []; list.push(n); children.set(n.parentId, list); }
  const rows: { node: MapNode; depth: number; children: number }[] = [];
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  const collapsed = new Set(view.collapsed);
  const walk = (id: string, depth: number) => {
    const node = byId.get(id)!; const list = children.get(id) ?? [];
    rows.push({ node, depth, children: list.length });
    if (!collapsed.has(id)) list.forEach(n => walk(n.id, depth + 1));
  };
  walk(root, 0); return rows;
}
/** Stable preorder layout; cross-links never affect geometry or task hierarchy. */
export function layoutMap(map: Mindmap, view: MapView) {
  return visibleNodes(map, view).map((row, index) => ({ ...row, x: 24 + row.depth * 285, y: 24 + index * 116 }));
}
export function parseOutline(text: string, parentId: string): MapNode[] {
  if (new TextEncoder().encode(text).length > 100_000) throw new Error("Вставьте не более 100 КБ текста.");
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length > MAP_LIMITS.paste) throw new Error("За одну вставку — не более 200 мыслей.");
  const nodes: MapNode[] = []; const stack = [parentId];
  lines.forEach(line => {
    const indent = line.match(/^[ \t]*/)![0].replaceAll("\t", "  ");
    if (indent.length % 2) throw new Error("Используйте по два пробела или одну табуляцию на уровень.");
    const depth = indent.length / 2;
    if (depth >= stack.length || depth >= MAP_LIMITS.depth - 1) throw new Error("Отступ не может пропускать уровень. Первая строка — без отступа.");
    const node: MapNode = { id: mapId(), parentId: stack[depth], kind: "idea", text: line.trim(), note: "" };
    if (node.text!.length > MAP_LIMITS.text) throw new Error("Название мысли — не более 2000 символов.");
    nodes.push(node); stack.length = depth + 1; stack.push(node.id);
  }); return nodes;
}
export function importMindmap(text: string): Mindmap {
  if (new TextEncoder().encode(text).length > MAP_LIMITS.bytes) return invalid();
  const parsed = JSON.parse(text);
  if (parsed?.format !== "genesis-mindmap" || parsed?.version !== 1) throw new Error("Ожидается JSON GENESIS Mindmap версии 1.");
  return validateMindmap(parsed.document);
}
export function exportMindmap(map: Mindmap) { return JSON.stringify({ format: "genesis-mindmap", version: 1, document: validateMindmap(map) }, null, 2); }
export function mapMarkdown(map: Mindmap, title: (n: MapNode) => string) {
  return visibleNodes(map, { mode: "structure", collapsed: [], focus: null, zoom: 1 })
    .map(({ node, depth }) => `${"  ".repeat(depth)}- ${title(node).replaceAll("\n", " ")}${node.kind !== "idea" ? ` [${node.kind}: ${node.refId}]` : ""}${node.note ? `\n${"  ".repeat(depth + 1)}${node.note.replaceAll("\n", "\n" + "  ".repeat(depth + 1))}` : ""}`).join("\n");
}
export function mapSvg(map: Mindmap, title: (n: MapNode) => string) {
  const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
  const rows = layoutMap(map, { mode: "map", collapsed: [], focus: null, zoom: 1 });
  const byId = new Map(rows.map(n => [n.node.id, n]));
  const paths = rows.map(r => { const p = byId.get(r.node.parentId ?? ""); return p ? `<path d="M${p.x + 240} ${p.y + 44}L${r.x} ${r.y + 44}"/>` : ""; }).join("");
  const links = map.links.map(l => { const a = byId.get(l.from)!; const b = byId.get(l.to)!; return `<path stroke-dasharray="5 5" d="M${a.x + 120} ${a.y + 88}L${b.x + 120} ${b.y}"/><text x="${a.x + 120}" y="${a.y + 104}" fill="#132426">${esc(l.label)}</text>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(...rows.map(r => r.x)) + 280}" height="${rows.length * 116 + 48}" role="img"><title>${esc(map.title)}</title><rect width="100%" height="100%" fill="#eee9dc"/><g fill="none" stroke="#8c672b">${paths}${links}</g>${rows.map(r => `<g><title>${esc(title(r.node))}</title><rect x="${r.x}" y="${r.y}" width="240" height="88" rx="12" fill="#fffdf8" stroke="#255b59"/><text x="${r.x + 12}" y="${r.y + 26}" fill="#132426" font-family="sans-serif" font-size="14">${[...title(r.node)].slice(0, 28).join("") ? esc([...title(r.node)].slice(0, 28).join("")) : ""}</text><text x="${r.x + 12}" y="${r.y + 50}" fill="#132426" font-size="14">${esc([...title(r.node)].slice(28, 56).join(""))}</text></g>`).join("")}</svg>`;
}
