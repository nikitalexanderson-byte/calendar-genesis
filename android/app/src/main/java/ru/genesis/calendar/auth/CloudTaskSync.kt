package ru.genesis.calendar.auth

import androidx.room.withTransaction
import org.json.JSONObject
import ru.genesis.calendar.data.GenesisDatabase
import ru.genesis.calendar.data.LocalCipher
import ru.genesis.calendar.data.TaskRecord

internal interface CloudTaskTransport {
    fun put(id: String, task: JSONObject): JSONObject
    fun delete(id: String, task: JSONObject): JSONObject
}

/** Outbox upload uses the same Google-task routes as the website; account drafts never cross scopes. */
internal class CloudTaskSync(private val db: GenesisDatabase, private val transport: CloudTaskTransport) {
    suspend fun flush(scope: String): Int {
        require(scope.startsWith("account-") && scope.length == 40)
        val dao = db.dao()
        val cipher = LocalCipher()
        var sent = 0
        for (entry in dao.outbox(scope).filterNot { it.entityId in setOf("workspace-structure", "habits", "trackers") }) {
            val row = dao.task(scope, entry.entityId) ?: continue
            if (row.revision != entry.revision) continue
            val local = JSONObject(cipher.decrypt(row.encrypted, "$scope/${row.id}"))
            if (row.deleted) {
                transport.delete(row.id, local)
                db.withTransaction {
                    if (dao.task(scope, row.id)?.revision == entry.revision)
                        sent += dao.acknowledgeOutbox(scope, row.id, entry.revision, entry.operationId)
                }
                continue
            }
            val response = transport.put(row.id, local)
            val saved = response.getJSONObject("task")
            require(saved.getString("id") == row.id) { "Google returned another task" }
            val merged = JSONObject(local.toString())
            saved.keys().forEach { key -> merged.put(key, saved.get(key)) }
            val valid = CloudAccountSnapshot.nativeTaskJson(merged)
            db.withTransaction {
                val latest = dao.task(scope, row.id)
                if (latest?.revision == entry.revision && !latest.deleted) {
                    dao.putTask(TaskRecord(scope, row.id, cipher.encrypt(valid.toString(), "$scope/${row.id}"),
                        latest.revision, valid.optBoolean("done")))
                    sent += dao.acknowledgeOutbox(scope, row.id, entry.revision, entry.operationId)
                }
            }
        }
        return sent
    }
}
