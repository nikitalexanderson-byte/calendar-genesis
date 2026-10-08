"use client";

import { useEffect, useState } from "react";
import { createSharedSpace, updateSharedSpace, deleteSharedSpace, loadSharedSpaceSettings,
  inviteSharedSpaceMember, revokeSharedSpaceInvitation, setSharedSpaceMemberPermissions,
  type SharedPermissions, type SharedSpace, type SharedSpaceSettings, type SharedSpaceInvitationInput } from "./cloud-sync";

const permissionKeys = ["createProjects", "editTasks", "organizeTasks", "comment", "manageProjects", "inviteMembers"] as const;
export function defaultSpacePermissions(role: string): SharedPermissions {
  const manager = role === "owner" || role === "admin";
  return { createProjects: role !== "guest", editTasks: role !== "guest", organizeTasks: manager,
    comment: role !== "guest", manageProjects: manager, inviteMembers: manager };
}
function PermissionChecks({ value, onChange, disabled, language }: { value: SharedPermissions;
  onChange: (next: SharedPermissions) => void; disabled?: boolean; language: string }) {
  const labels = language === "ru" ? ["Создавать проекты и списки", "Создавать и редактировать задачи", "Перемещать и удалять задачи", "Комментировать", "Управлять проектами и досками", "Приглашать участников"]
    : ["Create projects and lists", "Create and edit tasks", "Move and delete tasks", "Comment", "Manage projects and boards", "Invite members"];
  return <fieldset className="space-permission-checks" disabled={disabled}><legend>{language === "ru" ? "Права" : "Permissions"}</legend>
    {permissionKeys.map((key, index) => <label key={key}><input type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />{labels[index]}</label>)}
  </fieldset>;
}

export function SharedSpaceForm({ language, spaceId, onSaved, onDeleted }: { language: string; spaceId?: string;
  onSaved: (space: SharedSpace) => void; onDeleted: (id: string) => void }) {
  const ru = language === "ru";
  const [settings, setSettings] = useState<SharedSpaceSettings | null>(null);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [invitations, setInvitations] = useState<(SharedSpaceInvitationInput & { key: string })[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owner = !spaceId || settings?.space.role === "owner";
  const roleLabel = (role: string) => ({ owner: ru ? "Владелец" : "Owner", admin: ru ? "Администратор" : "Admin",
    member: ru ? "Участник" : "Member", guest: ru ? "Гость" : "Guest" })[role as SharedSpace["role"]];
  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    void loadSharedSpaceSettings(spaceId).then((value) => {
      if (live) { setSettings(value); setTitle(value.space.title); setDescription(value.space.description ?? ""); }
    }).catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { live = false; };
  }, [spaceId]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError("");
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const refresh = async () => { if (spaceId) setSettings(await loadSharedSpaceSettings(spaceId)); };
  const submit = () => void run(async () => {
    const space = spaceId && settings ? await updateSharedSpace(settings.space, title, description)
      : await createSharedSpace(title, description, invitations.map((invite) => ({ email: invite.email, role: invite.role, permissions: invite.permissions })));
    if (spaceId) {
      // Keep the saved revision if a later invitation fails, so the user can retry.
      setSettings((current) => current ? { ...current, space } : current);
      for (const invitation of invitations) {
        await inviteSharedSpaceMember(space.id, invitation.email, invitation.role, invitation.permissions);
        setInvitations((current) => current.filter((pending) => pending.key !== invitation.key));
      }
    }
    onSaved(space);
  });
  const roleSelect = (value: string, change: (role: SharedSpace["role"]) => void, includeOwner = false) => <select aria-label={ru ? "Роль" : "Role"}
    value={value} disabled={busy || !owner} onChange={(event) => change(event.target.value as SharedSpace["role"])}>
    {(includeOwner ? ["owner", "admin", "member", "guest"] : ["admin", "member", "guest"]).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
  </select>;
  if (spaceId && !settings) return <p role="status">{error || (ru ? "Загрузка…" : "Loading…")}</p>;
  return <div className="shared-space-settings-form">
    {error ? <p role="alert">{error}</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label>{ru ? "Название" : "Name"}<input required maxLength={160} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>{ru ? "Описание" : "Description"}<textarea maxLength={5000} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} /></label>
      <section className="space-invitation-fields"><h3>{ru ? "Пригласить участников" : "Invite members"}</h3>
        {invitations.map((invite) => <div className="space-member-settings" key={invite.key}>
          <label>Google email<input type="email" required maxLength={254} value={invite.email} disabled={busy} placeholder="name@gmail.com"
            onChange={(event) => setInvitations((current) => current.map((item) => item.key === invite.key ? { ...item, email: event.target.value } : item))} /></label>
          {roleSelect(invite.role, (role) => setInvitations((current) => current.map((item) => item.key === invite.key ? { ...item, role: role as SharedSpaceInvitationInput["role"], permissions: defaultSpacePermissions(role) } : item)))}
          <PermissionChecks language={language} value={invite.permissions} disabled={busy || !owner} onChange={(permissions) => setInvitations((current) => current.map((item) => item.key === invite.key ? { ...item, permissions } : item))} />
          <button type="button" className="text-button" disabled={busy} onClick={() => setInvitations((current) => current.filter((item) => item.key !== invite.key))}>{ru ? "Убрать приглашение" : "Remove invitation"}</button>
        </div>)}
        <button type="button" className="secondary-button" disabled={busy || !owner || invitations.length >= 20} onClick={() => setInvitations((current) => [...current,
          { key: crypto.randomUUID(), email: "", role: "member", permissions: defaultSpacePermissions("member") }])}>{ru ? "+ Участник" : "+ Member"}</button>
      </section>
      <button type="submit" disabled={busy}>{spaceId ? (ru ? "Сохранить" : "Save") : (ru ? "Создать пространство" : "Create workspace")}</button>
    </form>
    {settings ? <section className="space-members-settings"><h3>{ru ? "Участники и права" : "Members and permissions"}</h3>
      {settings.members.map((member) => <div className="space-member-settings" key={member.userId}>
        <strong data-no-translate>{member.displayName || member.email}</strong><small data-no-translate>{member.email}</small>
        {roleSelect(member.role, (role) => setSettings({ ...settings, members: settings.members.map((item) => item.userId === member.userId ? { ...item, role, permissions: defaultSpacePermissions(role) } : item) }), true)}
        <PermissionChecks language={language} value={member.permissions} disabled={busy || !owner || member.role === "owner"} onChange={(permissions) => setSettings({ ...settings, members: settings.members.map((item) => item.userId === member.userId ? { ...item, permissions } : item) })} />
        {owner ? <button type="button" disabled={busy} onClick={() => void run(async () => {
          await setSharedSpaceMemberPermissions(settings.space.id, member.userId, member.role, member.permissions); await refresh();
        })}>{ru ? "Сохранить права" : "Save permissions"}</button> : null}
      </div>)}
    </section> : null}
    {settings?.invitations.length ? <section><h3>{ru ? "Ожидают приглашения" : "Pending invitations"}</h3>
      {settings.invitations.map((invite) => <div className="space-member-settings" key={invite.id}>
        <strong data-no-translate>{invite.email}</strong><span>{roleLabel(invite.role)}</span>
        <PermissionChecks language={language} value={invite.permissions} disabled onChange={() => undefined} />
        {owner ? <button type="button" disabled={busy} onClick={() => void run(async () => { await revokeSharedSpaceInvitation(settings.space.id, invite.id); await refresh(); })}>{ru ? "Отозвать приглашение" : "Revoke invitation"}</button> : null}
      </div>)}
    </section> : null}
    {settings && owner ? <section className="space-delete-settings">
      {confirmDelete ? <><h3>{ru ? "Удалить это пространство?" : "Delete this workspace?"}</h3>
        <p>{ru ? "Все общие проекты и задачи этого пространства будут удалены для всех участников. Личные данные и созданные копии в Google останутся." : "All shared projects and tasks in this workspace will be deleted for every member. Personal data and existing Google copies remain."}</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await deleteSharedSpace(settings.space); onDeleted(settings.space.id); })}>{ru ? "Да, удалить" : "Yes, delete"}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>{ru ? "Нет" : "No"}</button></>
        : <button type="button" className="text-button" onClick={() => setConfirmDelete(true)}>{ru ? "Удалить пространство" : "Delete workspace"}</button>}
    </section> : null}
  </div>;
}
