package ru.genesis.calendar.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.AuthFailure
import ru.genesis.calendar.auth.DiaryGateway
import ru.genesis.calendar.auth.DiaryProtocol
import java.io.IOException
import java.util.UUID

internal data class DiaryRecord(val note: DiaryNote, val revision: Long, val draftKey: String? = null,
    internal val pendingJson: String? = null, internal val pendingNote: DiaryNote? = null) {
    val draft: Boolean get() = draftKey != null
    override fun toString() = "DiaryRecord([redacted])"
}
internal data class DiaryState(val records: List<DiaryRecord> = emptyList(), val offline: Boolean = false,
    val ready: Boolean = false, val protected: Boolean = false)
internal class DiaryConflict : Exception("DIARY_REVISION_CONFLICT")

/** Serial account-scoped journal. Every write is encrypted on disk before any network request. */
internal class DiaryRepository(private val owner: String, private val gateway: DiaryGateway,
    private val store: DiaryStore, private val cacheCipher: DiaryCacheCipher) {
    private val mutex = Mutex()
    private val writer = UUID.randomUUID().toString()
    private var initialized = false
    private var hasCache = false
    private var protected = false
    private var committed = emptyList<DiaryRecord>()
    private var drafts = emptyList<DiaryRecord>()
    private val mutable = MutableStateFlow(DiaryState())
    val state = mutable.asStateFlow()
    private fun check() = gateway.check()
    fun sealEditorState(value: String): String { check(); return cacheCipher.encrypt(value) }
    fun openEditorState(value: String): String { check(); return cacheCipher.decrypt(value) }

    private fun json(committed: List<DiaryRecord>, drafts: List<DiaryRecord>, cache: Boolean): JSONObject = JSONObject()
        .put("version", 1).put("owner", owner).put("hasCache", cache)
        .put("records", JSONArray(committed.map { rowJson(it) })).put("drafts", JSONArray(drafts.map { rowJson(it) }))
    private fun rowJson(row: DiaryRecord): JSONObject = JSONObject().put("note", row.note.json()).put("revision", row.revision)
        .put("draftKey", row.draftKey ?: JSONObject.NULL).put("pending", row.pendingJson?.let(::JSONObject) ?: JSONObject.NULL)
        .put("pendingNote", row.pendingNote?.json() ?: JSONObject.NULL)
    private fun parseRow(row: JSONObject, draft: Boolean): DiaryRecord {
        val note = DiaryNote.parse(row.getJSONObject("note")); val revision = row.getLong("revision")
        require(revision >= if (draft) 0 else 1) { "DIARY_INVALID_CACHE" }
        val key = row.opt("draftKey") as? String
        require((key != null) == draft && (key == null || key.startsWith("draft:") && key.endsWith(":" + note.id))) { "DIARY_INVALID_CACHE" }
        val pending = row.optJSONObject("pending")?.let(DiaryProtocol::pending)
        val pendingNote = row.optJSONObject("pendingNote")?.let(DiaryNote::parse)
        require((pending == null) == (pendingNote == null) && (pendingNote == null || pendingNote.id == note.id) &&
            (pending == null || draft && pending.getLong("expectedRevision") == revision)) { "DIARY_INVALID_CACHE" }
        return DiaryRecord(note, revision, key, pending?.toString(), pendingNote)
    }
    private suspend fun loadLocked() {
        if (initialized) return
        check()
        val encrypted = store.read(); check()
        if (encrypted != null) {
            // Parse everything before assigning: unknown or corrupted cache is never replaced by empty data.
            val source = JSONObject(cacheCipher.decrypt(encrypted))
            require(source.opt("version") is Number && source.getDouble("version") == 1.0 && source.optString("owner") == owner && source.opt("hasCache") is Boolean) { "DIARY_INVALID_CACHE" }
            fun rows(name: String, draft: Boolean): List<DiaryRecord> = source.getJSONArray(name).let { values ->
                require(values.length() <= if (draft) 4000 else 2000) { "DIARY_INVALID_CACHE" }
                (0 until values.length()).map { parseRow(values.getJSONObject(it), draft) }
            }
            val saved = rows("records", false); val kept = rows("drafts", true)
            require(saved.map { it.note.id }.distinct().size == saved.size && kept.map { it.draftKey }.distinct().size == kept.size) { "DIARY_INVALID_CACHE" }
            check(); committed = saved; drafts = kept; hasCache = source.getBoolean("hasCache")
        }
        initialized = true; publish()
    }
    private fun publish(offline: Boolean = mutable.value.offline) {
        check(); mutable.value = DiaryState(committed + drafts, offline, initialized, protected)
    }
    private suspend fun persist(saved: List<DiaryRecord> = committed, kept: List<DiaryRecord> = drafts, cache: Boolean = hasCache,
        offline: Boolean = mutable.value.offline) {
        check(); require(initialized) { "DIARY_CACHE_NOT_READY" }
        val encrypted = cacheCipher.encrypt(json(saved, kept, cache).toString())
        check(); store.write(encrypted); check()
        committed = saved; drafts = kept; hasCache = cache; publish(offline)
    }
    suspend fun loadCached() = mutex.withLock { loadLocked() }
    private fun offline(error: Exception): Boolean = error is IOException || error is AuthFailure && error.kind == AuthFailure.Kind.NETWORK
    private suspend fun refreshLocked() {
        loadLocked(); check()
        val result = try {
            val key = DiaryProtocol.key(gateway.workspace()); check()
            try {
                val envelopes = DiaryProtocol.envelopes(gateway.request("/diary")); check()
                envelopes.map { DiaryRecord(DiaryProtocol.open(owner, it, key), it.revision) }
            } finally { key.fill(0) }
        } catch (error: CancellationException) { throw error }
        catch (error: Exception) {
            check()
            if (offline(error) && hasCache) { publish(offline = true); return }
            if (!offline(error) && error !is AuthFailure) { protected = true; publish() }
            throw error
        }
        // No permanent-delete operation exists: an older GET cannot remove a newer acknowledged note.
        val byId = result.associateBy { it.note.id }.toMutableMap()
        committed.forEach { if ((byId[it.note.id]?.revision ?: 0) < it.revision) byId[it.note.id] = it }
        protected = false
        persist(byId.values.toList(), cache = true, offline = false)
    }
    suspend fun refresh() = mutex.withLock { refreshLocked() }
    private fun ownKey(id: String): String = "draft:$writer:$id"
    private suspend fun keepLocked(note: DiaryNote, revision: Long, key: String?): DiaryRecord {
        require(revision >= 0); check()
        val draftKey = key ?: ownKey(note.id)
        require(draftKey.startsWith("draft:") && draftKey.endsWith(":" + note.id)) { "DIARY_INVALID_DRAFT" }
        val previous = drafts.firstOrNull { it.draftKey == draftKey }
        require(previous == null || previous.revision >= revision) { "DIARY_DRAFT_REVISION_CHANGED" }
        val draft = DiaryRecord(note, previous?.revision ?: revision, draftKey, previous?.pendingJson, previous?.pendingNote)
        persist(kept = drafts.filterNot { it.draftKey == draftKey } + draft)
        return draft
    }
    suspend fun keepDraft(note: DiaryNote, revision: Long = 0, draftKey: String? = null): DiaryRecord = mutex.withLock {
        loadLocked(); keepLocked(DiaryNote.parse(note.json()), revision, draftKey)
    }
    suspend fun discardDraft(draftKey: String) = mutex.withLock {
        loadLocked(); require(draftKey.startsWith("draft:")) { "DIARY_INVALID_DRAFT" }
        persist(kept = drafts.filterNot { it.draftKey == draftKey })
    }
    private suspend fun send(row: DiaryRecord): DiaryRecord {
        val pending = DiaryProtocol.pending(JSONObject(requireNotNull(row.pendingJson)))
        val note = requireNotNull(row.pendingNote)
        check()
        val response = try { gateway.request("/diary/${note.id}", pending) }
        catch (error: AuthFailure) { if (error.kind == AuthFailure.Kind.CONFLICT || error.httpStatus == 409) throw DiaryConflict(); throw error }
        check(); val revision = DiaryProtocol.receipt(response, pending.getLong("expectedRevision"))
        val acknowledged = DiaryRecord(note, revision)
        val unchanged = row.note.sameContent(note)
        val nextDraft = if (unchanged) null else DiaryRecord(row.note, revision, row.draftKey)
        persist(saved = committed.filterNot { it.note.id == note.id } + acknowledged,
            kept = drafts.filterNot { it.draftKey == row.draftKey } + listOfNotNull(nextDraft), cache = true, offline = false)
        return nextDraft ?: acknowledged
    }
    private suspend fun saveLocked(note: DiaryNote, revision: Long, key: String?): DiaryRecord {
        require(!protected) { "DIARY_PROTECTED_DATA" }
        var row = keepLocked(note, revision, key)
        // Recover a previously uncertain write using the exact original ciphertext before sending a newer edit.
        if (row.pendingJson != null) {
            row = send(row)
            if (!row.draft) return row
        }
        val workspaceKey = DiaryProtocol.key(gateway.workspace()); check()
        val pending = try { DiaryProtocol.seal(owner, row.note, row.revision, workspaceKey) } finally { workspaceKey.fill(0) }
        row = row.copy(pendingJson = pending.toString(), pendingNote = row.note)
        persist(kept = drafts.filterNot { it.draftKey == row.draftKey } + row)
        return send(row)
    }
    suspend fun save(note: DiaryNote, revision: Long = 0, draftKey: String? = null): DiaryRecord = mutex.withLock {
        loadLocked(); saveLocked(DiaryNote.parse(note.json()), revision, draftKey)
    }
    suspend fun saveCopy(note: DiaryNote, originalDraftKey: String?): DiaryRecord = mutex.withLock {
        loadLocked()
        val copyId = UUID.nameUUIDFromBytes("$owner:${originalDraftKey ?: ownKey(note.id)}:copy".toByteArray(Charsets.UTF_8)).toString()
        val prior = drafts.firstOrNull { it.note.id == copyId }
        val known = committed.firstOrNull { it.note.id == copyId }
        val original = prior ?: known
        val copy = note.asCopy(copyId).let { fresh -> if (original == null) fresh else DiaryNote.parse(fresh.json().put("createdAt", original.note.createdAt)) }
        val result = if (prior == null && known != null && known.note.sameContent(copy)) known
            else saveLocked(copy, original?.revision ?: 0, prior?.draftKey)
        if (originalDraftKey != null) persist(kept = drafts.filterNot { it.draftKey == originalDraftKey })
        result
    }
    suspend fun adviceId(adviceId: String): String = mutex.withLock {
        loadLocked(); val key = DiaryProtocol.key(gateway.workspace()); check()
        try { DiaryProtocol.privateAdviceId(key, owner, adviceId) } finally { key.fill(0) }
    }
    suspend fun react(advice: JSONObject, reaction: String): DiaryRecord = mutex.withLock {
        loadLocked(); refreshLocked(); require(!protected) { "DIARY_PROTECTED_DATA" }
        val key = DiaryProtocol.key(gateway.workspace()); check()
        val id = try { DiaryProtocol.privateAdviceId(key, owner, advice.getString("id")) } finally { key.fill(0) }
        val current = committed.firstOrNull { it.note.id == id }
        saveLocked(DiaryNote.reaction(advice, id, reaction, current?.note), current?.revision ?: 0, "draft:reaction:$writer:$id")
    }
    companion object {
        // One journal/mutex/StateFlow per Room account, including multiple navigation entry points.
        // Weak values release an inactive workspace; no key or plaintext is kept in a process singleton.
        private val roomInstances = java.util.WeakHashMap<GenesisDatabase, MutableMap<String, java.lang.ref.WeakReference<DiaryRepository>>>()
        fun room(database: GenesisDatabase, scope: String, owner: String, gateway: DiaryGateway): DiaryRepository = synchronized(roomInstances) {
            val account = "$scope\u0000$owner"
            val entries = roomInstances.getOrPut(database) { mutableMapOf() }
            entries[account]?.get() ?: DiaryRepository(owner, gateway, DiaryRoomStore(database, scope), DiaryKeystoreCipher(scope, owner))
                .also { entries[account] = java.lang.ref.WeakReference(it) }
        }
    }
}
