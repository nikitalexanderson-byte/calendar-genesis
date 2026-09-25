package ru.genesis.calendar.auth

import androidx.room.withTransaction
import java.time.Instant
import org.json.JSONObject
import ru.genesis.calendar.data.CloudAccountImporter
import ru.genesis.calendar.data.DocumentRecord
import ru.genesis.calendar.data.GenesisDatabase
import ru.genesis.calendar.data.HabitDocument
import ru.genesis.calendar.data.LocalCipher
import ru.genesis.calendar.data.TrackersDocument
import ru.genesis.calendar.data.WorkspaceStructureCodec
import ru.genesis.calendar.security.WorkspaceCipher

internal interface CloudWorkspaceTransport {
    fun get(): JSONObject
    fun put(body: JSONObject): JSONObject
}

/** Encrypts a three-way merge with CAS; unrelated website sections are never replaced by native defaults. */
internal class CloudWorkspaceSync(private val db: GenesisDatabase, private val transport: CloudWorkspaceTransport) {
    private val documentKinds = setOf("workspace-structure", "habits", "trackers")

    suspend fun flush(scope: String,
        conflictPolicy: WorkspacePatch.ConflictPolicy = WorkspacePatch.ConflictPolicy.STOP): Int {
        require(scope.startsWith("account-") && scope.length == 40)
        val dao = db.dao()
        val cipher = LocalCipher()
        val pending = dao.outbox(scope).filter { it.entityId in documentKinds }
        if (pending.isEmpty()) return 0
        val baseRow = dao.document(scope, "cloud-base")
        val base = baseRow?.let { JSONObject(cipher.decrypt(it.encrypted, "$scope/cloud-base")) }
            ?: WorkspacePatch.emptyDocument()
        val structure = dao.document(scope, "structure")?.let { JSONObject(cipher.decrypt(it.encrypted, "$scope/structure")) }
        val habits = dao.document(scope, "habits")?.let { JSONObject(cipher.decrypt(it.encrypted, "$scope/habits")) }
        val trackers = dao.document(scope, "trackers")?.let { JSONObject(cipher.decrypt(it.encrypted, "$scope/trackers")) }
        val local = WorkspacePatch.localDocument(base, structure, habits, trackers)
        val timestamp = Instant.now().toString()
        val deviceId = "android-native"
        repeat(3) { attempt ->
            val remote = readRemote(transport.get())
            try {
                require(baseRow == null || remote.version >= baseRow.revision) {
                    "Remote workspace version moved backwards"
                }
                val patch = WorkspacePatch.apply(base, local, remote.document,
                    pending.map { it.entityId }.toSet(), remote.version, timestamp, deviceId, conflictPolicy)
                val version = if (!patch.changed) remote.version else {
                    val encrypted = WorkspaceCipher.encrypt(patch.document.toString().toByteArray(), remote.key)
                    val response = transport.put(JSONObject().put("ciphertext", encrypted.ciphertext)
                        .put("iv", encrypted.iv).put("expectedVersion", remote.version))
                    val saved = response.getJSONObject("workspace")
                    saved.getLong("version").also { require(it == remote.version + 1) }
                }
                return cacheConfirmed(scope, patch.document, version, pending, cipher)
            } catch (error: AuthFailure) {
                if (error.kind != AuthFailure.Kind.CONFLICT || attempt == 2) throw error
            } finally { remote.key.fill(0) }
        }
        error("Workspace CAS retry exhausted")
    }

    private data class Remote(val version: Long, val document: JSONObject, val key: ByteArray)

    private fun readRemote(response: JSONObject): Remote {
        val workspace = response.getJSONObject("workspace")
        if (workspace.getString("keyMode") != "account") throw CloudWorkspacePreview.RecoveryRequired()
        val key = WorkspaceCipher.decodeKey(workspace.getString("key"))
        try {
            if (workspace.isNull("envelope")) return Remote(0, WorkspacePatch.emptyDocument(), key)
            val envelope = workspace.getJSONObject("envelope")
            val version = envelope.getLong("version")
            require(version > 0)
            val plain = WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(envelope.getString("ciphertext"),
                envelope.getString("iv")), key)
            val document = try { JSONObject(plain.toString(Charsets.UTF_8)) } finally { plain.fill(0) }
            require(document.optInt("trackerSchemaVersion") == 16)
            return Remote(version, document, key)
        } catch (error: Exception) {
            key.fill(0)
            throw error
        }
    }

    private suspend fun cacheConfirmed(scope: String, document: JSONObject, version: Long,
        pending: List<ru.genesis.calendar.data.OutboxRecord>, cipher: LocalCipher): Int {
        val dao = db.dao()
        val fragments = mapOf(
            "workspace-structure" to ("structure" to CloudAccountImporter.structureDocument(document)),
            "habits" to ("habits" to CloudAccountImporter.habitsDocument(document)),
            "trackers" to ("trackers" to CloudAccountImporter.trackersDocument(document)),
        )
        WorkspaceStructureCodec.decode(fragments.getValue("workspace-structure").second)
        HabitDocument.decode(fragments.getValue("habits").second, version)
        TrackersDocument.decode(fragments.getValue("trackers").second, version)
        return db.withTransaction {
            var acknowledged = 0
            pending.forEach { entry ->
                acknowledged += dao.acknowledgeOutbox(scope, entry.entityId, entry.revision, entry.operationId)
            }
            dao.putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(document.toString(), "$scope/cloud-base"), version))
            val stillPending = dao.outbox(scope).map { it.entityId }.toSet()
            fragments.forEach { (outboxId, pair) ->
                if (outboxId !in stillPending) {
                    val (kind, raw) = pair
                    val previous = dao.document(scope, kind)
                    dao.putDocument(DocumentRecord(scope, kind, cipher.encrypt(raw, "$scope/$kind"),
                        maxOf(version, previous?.revision ?: 0)))
                }
            }
            acknowledged
        }
    }
}
