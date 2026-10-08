type ExpandableProject = { id: string; parentId?: string | null; isInbox?: boolean | number };

/** Restore a selected project only when its entire path is visible in the saved tree. */
export function restoredSharedProject(projects: ExpandableProject[], expandedIds: string[]): string {
  const expanded = new Set(expandedIds);
  const byId = new Map(projects.map((project) => [project.id, project]));
  for (const id of [...expandedIds].reverse()) {
    const item = byId.get(id);
    if (!item || item.isInbox) continue;
    let parentId = item.parentId;
    const visited = new Set([id]);
    let visible = true;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent || !expanded.has(parentId) || visited.has(parentId)) { visible = false; break; }
      visited.add(parentId);
      parentId = parent.parentId;
    }
    if (visible) return id;
  }
  return "";
}
