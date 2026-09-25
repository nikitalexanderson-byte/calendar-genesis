package ru.genesis.calendar.auth

import java.security.MessageDigest
import java.time.LocalDate
import java.time.ZoneId
import org.json.JSONObject
import ru.genesis.calendar.security.WorkspaceCipher

/** Verified bootstrap data for one account. No local draft scope is ever part of this snapshot. */
internal class CloudAccountSnapshot private constructor(
    val scope: String,
    val version: Long,
    val document: JSONObject?,
    val tasks: List<JSONObject>,
    val googleSyncWarning: Boolean,
) {
    companion object {
        fun scopeFor(uid: String): String {
            require(uid.isNotBlank() && uid.length <= 256)
            val digest = MessageDigest.getInstance("SHA-256").digest(uid.toByteArray(Charsets.UTF_8))
            return "account-" + digest.joinToString("") { "%02x".format(it) }.take(32)
        }

        fun fromBootstrap(payload: JSONObject): CloudAccountSnapshot {
            val uid = AuthProtocol.identity(payload)?.uid ?: throw CloudWorkspacePreview.Unreadable()
            val workspace = payload.getJSONObject("workspace")
            val mode = workspace.getString("keyMode")
            require(mode in setOf("account", "client", "new"))
            val warning = payload.optString("syncWarning").let { it.isNotBlank() && it != "null" }
            val rows = payload.getJSONArray("tasks")
            val tasks = (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                require(item.getString("id").isNotBlank() && item.getString("title").isNotBlank())
                JSONObject(item.toString())
            }
            if (workspace.isNull("envelope")) return CloudAccountSnapshot(scopeFor(uid), 0, null, tasks, warning)
            if (mode != "account") throw CloudWorkspacePreview.RecoveryRequired()
            val envelope = workspace.getJSONObject("envelope")
            val version = envelope.getLong("version")
            require(version > 0)
            val key = WorkspaceCipher.decodeKey(workspace.getString("key"))
            val plain = try {
                WorkspaceCipher.decrypt(WorkspaceCipher.Envelope(envelope.getString("ciphertext"),
                    envelope.getString("iv")), key)
            } finally { key.fill(0) }
            val document = try { JSONObject(plain.toString(Charsets.UTF_8)) } finally { plain.fill(0) }
            require(document.optInt("trackerSchemaVersion", 0) == 16)
            listOf("projects", "categories", "taskListLinks", "habits", "habitCompletions",
                "sleepPlans", "sleepEntries", "moodEntries", "dailyGoalRecords", "rewardTransactions").forEach {
                document.getJSONArray(it)
            }
            document.getJSONObject("userProgress")
            return CloudAccountSnapshot(scopeFor(uid), version, document, tasks, warning)
        }

        /** Keep unknown Google/web fields; native-only defaults are never written to the cloud snapshot. */
        fun nativeTaskJson(source: JSONObject): JSONObject {
            val row = JSONObject(source.toString())
            val date = row.optString("dueDate")
            require(date.isBlank() || runCatching { LocalDate.parse(date) }.isSuccess)
            row.put("dueDate", date)
                .put("zoneId", row.optString("zoneId").takeIf { it.isNotBlank() } ?: ZoneId.systemDefault().id)
                .put("priority", row.optInt("priority", 5).coerceIn(1, 10))
            if (!row.has("reminderAt")) row.put("reminderAt", JSONObject.NULL)
            return row
        }
    }
}
