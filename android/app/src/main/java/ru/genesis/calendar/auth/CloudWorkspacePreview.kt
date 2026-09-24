package ru.genesis.calendar.auth

import org.json.JSONObject
import org.json.JSONException
import ru.genesis.calendar.security.WorkspaceCipher
import java.security.GeneralSecurityException

/** Read-only inspection. A failed decrypt must never become an empty workspace or a new key. */
object CloudWorkspacePreview {
    data class Summary(
        val version: Long,
        val updatedAt: String?,
        val projects: Int,
        val categories: Int,
        val habits: Int,
        val completions: Int,
        val sleepEntries: Int,
        val moodEntries: Int,
        val rewards: Int,
        val quests: Int,
        val tasks: Int?,
        val taskLists: Int?,
        val hasGoogleSyncWarning: Boolean,
        val isEmpty: Boolean,
    )

    class RecoveryRequired : Exception("Workspace recovery code is required")
    class Unreadable : Exception("Cloud workspace could not be verified")

    fun inspect(response: JSONObject): Summary = try {
        inspectVerified(response)
    } catch (error: RecoveryRequired) {
        throw error
    } catch (_: JSONException) {
        throw Unreadable()
    } catch (_: IllegalArgumentException) {
        throw Unreadable()
    } catch (_: GeneralSecurityException) {
        throw Unreadable()
    }

    private fun inspectVerified(response: JSONObject): Summary {
        val workspace = response.getJSONObject("workspace")
        val mode = workspace.getString("keyMode")
        require(mode in setOf("account", "client", "new")) { "Unknown workspace key mode" }
        val tasks = response.optJSONArray("tasks")?.length()
        val taskLists = response.optJSONArray("taskLists")?.length()
        val warning = response.optString("syncWarning").let { it.isNotBlank() && it != "null" }
        if (workspace.isNull("envelope")) {
            // No cloud blob exists. This does not authorize overwriting any local draft.
            return Summary(0, null, 0, 0, 0, 0, 0, 0, 0, 0, tasks, taskLists, warning, true)
        }
        if (mode != "account") throw RecoveryRequired()
        val key = WorkspaceCipher.decodeKey(workspace.getString("key"))
        try {
            val envelope = workspace.getJSONObject("envelope")
            val version = envelope.getLong("version")
            require(version > 0) { "Invalid cloud workspace version" }
            val encrypted = WorkspaceCipher.Envelope(envelope.getString("ciphertext"), envelope.getString("iv"))
            val plain = WorkspaceCipher.decrypt(encrypted, key)
            try {
                val document = JSONObject(plain.toString(Charsets.UTF_8))
                val schema = document.optInt("trackerSchemaVersion", 0)
                require(schema in 1..16) { "Unsupported cloud workspace schema" }
                fun count(name: String): Int = document.getJSONArray(name).length()
                return Summary(version, envelope.optString("updatedAt").takeIf { it.isNotBlank() },
                    count("projects"), count("categories"), count("habits"), count("habitCompletions"),
                    count("sleepEntries"), count("moodEntries"), count("rewardTransactions"),
                    count("quests"), tasks, taskLists, warning, false)
            } finally {
                plain.fill(0)
            }
        } finally {
            key.fill(0)
        }
    }
}
