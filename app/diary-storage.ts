import { personalDocumentAccess, GenesisApiError } from './cloud-sync';
import { validateDiaryNote, type DiaryNote } from './diary-model';

type Sealed = { iv: string; ciphertext: string };
type Envelope = Sealed & { id: string; revision: number; schemaVersion: number; updatedAt: string };
type Pending = Sealed & { expectedRevision: number; schemaVersion: 1 };
export type DiaryRecord = { note: DiaryNote; revision: number; draftKey?: string; pending?: Pending };
type Access = Pick<ReturnType<typeof personalDocumentAccess>, 'check' | 'request' | 'seal' | 'open' | 'privateId'>;
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const sameContent = (a: DiaryNote, b: DiaryNote) => JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

/** Each tab journals its own encrypted draft before any network write. No plaintext is cached. */
export class DiaryRepository {
  private access: Access;
  private prefix: string;
  private writer = crypto.randomUUID();
  private serial = Promise.resolve();
  private stopped = false;
  offline = false;
  constructor(userId: string, private storage: Storage, access?: Access) {
    this.access = access ?? personalDocumentAccess(userId);
    this.prefix = `genesis-diary-v1:${userId}:`;
  }
  dispose() { this.stopped = true; }
  private check() { if (this.stopped) throw new Error('DIARY_SESSION_CLOSED'); this.access.check(); }
  adviceId(id: string) { this.check(); return this.access.privateId(`diary-advice:${id}`); }
  private scope(id: string) { return `diary-note:v1:${id}`; }
  async keepDraft(input: DiaryNote, record?: DiaryRecord) {
    const note = validateDiaryNote(input); let draft!: DiaryRecord;
    const task = this.serial.catch(() => {}).then(async () => {
      this.check(); const draftKey = record?.draftKey ?? `${this.prefix}draft:${this.writer}:${note.id}`;
      const previous: Pending | null = JSON.parse(this.storage.getItem(draftKey) || 'null');
      const before = previous ? validateDiaryNote(await this.access.open(previous, this.scope(note.id))) : null;
      const reuse = previous?.expectedRevision === (record?.revision ?? 0) && before && sameContent(before, note);
      const pending: Pending = reuse ? previous! : { ...await this.access.seal(note, this.scope(note.id)), expectedRevision: record?.revision ?? 0, schemaVersion: 1 };
      this.check(); this.storage.setItem(draftKey, JSON.stringify(pending)); draft = { note: reuse ? before! : note, revision: pending.expectedRevision, pending, draftKey };
    });
    this.serial = task; await task; return draft;
  }
  async list(): Promise<DiaryRecord[]> {
    this.check(); let envelopes: Envelope[];
    try {
      const response = await this.access.request<{ notes: Envelope[] }>('/diary', { cache: 'no-store' });
      this.check(); if (!Array.isArray(response.notes)) throw new Error('DIARY_INVALID_RESPONSE');
      const byId = new Map(response.notes.map(row => [row.id, row]));
      // There is no permanent delete operation. A slow earlier GET must not erase
      // a newer acknowledged note from the device's encrypted offline cache.
      const cached: Envelope[] = JSON.parse(this.storage.getItem(`${this.prefix}cache`) || '[]');
      for (const row of cached) if ((byId.get(row.id)?.revision ?? 0) < row.revision) byId.set(row.id, row);
      envelopes = [...byId.values()]; this.offline = false;
      try { this.storage.setItem(`${this.prefix}cache`, JSON.stringify(envelopes)); } catch { /* Online reading remains available when device storage is full. */ }
    } catch (error) {
      if (error instanceof GenesisApiError || !this.storage.getItem(`${this.prefix}cache`)) throw error;
      this.check(); envelopes = JSON.parse(this.storage.getItem(`${this.prefix}cache`)!); this.offline = true;
    }
    const records: DiaryRecord[] = [];
    for (const envelope of envelopes) {
      if (envelope.schemaVersion !== 1 || !Number.isInteger(envelope.revision) || envelope.revision < 1) throw new Error('DIARY_INVALID_RESPONSE');
      const note = validateDiaryNote(await this.access.open(envelope, this.scope(envelope.id)));
      if (note.id !== envelope.id) throw new Error('DIARY_INVALID_RESPONSE');
      records.push({ note, revision: envelope.revision });
    }
    const keys = Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index)).filter((key): key is string => Boolean(key?.startsWith(`${this.prefix}draft:`)));
    for (const draftKey of keys) {
      const pending: Pending = JSON.parse(this.storage.getItem(draftKey)!); const id = draftKey.split(':').at(-1)!;
      const note = validateDiaryNote(await this.access.open(pending, this.scope(id)));
      if (note.id !== id) throw new Error('DIARY_INVALID_RESPONSE');
      records.push({ note, revision: pending.expectedRevision, pending, draftKey });
    }
    this.check(); return records;
  }
  async save(input: DiaryNote, record?: DiaryRecord): Promise<DiaryRecord & { clearedDraftKey: string }> {
    const note = validateDiaryNote(input);
    if (record && note.id !== record.note.id) throw new Error('DIARY_INVALID_NOTE');
    let saved!: DiaryRecord & { clearedDraftKey: string };
    const task = this.serial.catch(() => {}).then(async () => {
      this.check(); const expectedRevision = record?.revision ?? 0;
      const draftKey = record?.draftKey ?? `${this.prefix}draft:${this.writer}:${note.id}`;
      const previous: Pending | null = JSON.parse(this.storage.getItem(draftKey) || 'null');
      const before = previous ? validateDiaryNote(await this.access.open(previous, this.scope(note.id))) : null;
      const reuse = previous?.expectedRevision === expectedRevision && before && sameContent(before, note);
      const pending: Pending = reuse ? previous! : { ...await this.access.seal(note, this.scope(note.id)), expectedRevision, schemaVersion: 1 };
      this.check(); this.storage.setItem(draftKey, JSON.stringify(pending));
      const result = await this.access.request<{ revision: number; updatedAt: string }>(`/diary/${note.id}`, { method: 'PUT', body: JSON.stringify(pending) });
      this.check(); if (result.revision !== expectedRevision + 1 || !Number.isFinite(Date.parse(result.updatedAt))) throw new Error('DIARY_INVALID_RESPONSE');
      const cache: Envelope[] = JSON.parse(this.storage.getItem(`${this.prefix}cache`) || '[]');
      this.storage.setItem(`${this.prefix}cache`, JSON.stringify([...cache.filter(row => row.id !== note.id), { ...pending, id: note.id, revision: result.revision, updatedAt: result.updatedAt }]));
      this.storage.removeItem(draftKey); saved = { note: reuse ? before! : note, revision: result.revision, clearedDraftKey: draftKey };
    });
    this.serial = task; await task; return saved;
  }
  discardDraft(key: string) { this.check(); if (!key.startsWith(`${this.prefix}draft:`)) throw new Error('DIARY_INVALID_DRAFT'); this.storage.removeItem(key); }
  discardOwnDraft(id: string) { const key = `${this.prefix}draft:${this.writer}:${id}`; this.discardDraft(key); return key; }
}
