package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject

/** Conservative three-way patch for the web's encrypted schema-16 workspace. */
internal object WorkspacePatch {
    class Conflict(val field: String) : Exception("Workspace changed concurrently: $field")
    enum class ConflictPolicy { STOP, KEEP_LOCAL, KEEP_REMOTE }
    data class Result(val document: JSONObject, val changed: Boolean)

    private val collectionIds = mapOf(
        "projects" to "id", "categories" to "id", "taskListLinks" to "taskListId",
        "habits" to "id", "habitCompletions" to "id", "sleepPlans" to "id",
        "sleepEntries" to "id", "moodEntries" to "id", "dailyGoalRecords" to "date",
        "quests" to "id", "achievementUnlocks" to "achievementId",
        "rewardTransactions" to "idempotencyKey", "streakFreezeTransactions" to "idempotencyKey",
    )
    private val kinds = mapOf(
        "workspace-structure" to listOf("projects", "categories", "taskListLinks"),
        "habits" to listOf("habits", "habitCompletions", "dailyGoalRecords", "quests",
            "achievementUnlocks", "rewardTransactions", "streakFreezeTransactions", "userProgress",
            "habitSettings", "hiddenDefaultTemplates"),
        "trackers" to listOf("sleepPlans", "sleepEntries", "moodEntries"),
    )

    fun emptyDocument(): JSONObject = JSONObject().put("trackerSchemaVersion", 16)
        .put("projects", JSONArray()).put("categories", JSONArray()).put("taskListLinks", JSONArray())
        .put("habits", JSONArray()).put("habitCompletions", JSONArray())
        .put("sleepPlans", JSONArray()).put("sleepEntries", JSONArray()).put("moodEntries", JSONArray())
        .put("addictionTrackers", JSONArray()).put("addictionEntries", JSONArray())
        .put("analyticsSnapshots", JSONArray()).put("dailyGoalRecords", JSONArray())
        .put("quests", JSONArray()).put("achievementUnlocks", JSONArray())
        .put("rewardTransactions", JSONArray()).put("streakFreezeTransactions", JSONArray())
        .put("hiddenDefaultTemplates", JSONArray()).put("habitSettings", JSONObject())
        .put("userProgress", JSONObject().put("lifetimeXp", 0).put("laurelsBalance", 0)
            .put("currentRankId", JSONObject.NULL).put("hiddenHeroicPathRevealedAt", JSONObject.NULL)
            .put("currentStreak", 0).put("longestStreak", 0).put("lastQualifiedDate", JSONObject.NULL)
            .put("streakGoalMode", "rhythm").put("streakFreezeCount", 0).put("rhythmScore", 0)
            .put("updatedAt", ""))

    fun apply(base: JSONObject, local: JSONObject, remote: JSONObject, dirtyKinds: Set<String>,
        remoteVersion: Long, timestamp: String, deviceId: String,
        conflictPolicy: ConflictPolicy = ConflictPolicy.STOP): Result {
        require(base.optInt("trackerSchemaVersion") == 16 && remote.optInt("trackerSchemaVersion") == 16)
        require(remoteVersion >= 0 && deviceId.isNotBlank())
        val output = JSONObject(remote.toString())
        val metadata = JSONObject(output.optJSONObject("syncMetadata")?.toString() ?: "{}")
        metadata.put("schemaVersion", 1)
        val entities = JSONObject(metadata.optJSONObject("entities")?.toString() ?: "{}")
        val fields = JSONObject(metadata.optJSONObject("fields")?.toString() ?: "{}")
        val tombstones = JSONArray(metadata.optJSONArray("tombstones")?.toString() ?: "[]")
        var changed = false
        for (key in dirtyKinds.flatMap { kinds[it] ?: error("Unknown workspace outbox kind: $it") }.distinct()) {
            if (key in collectionIds) {
                val idField = collectionIds.getValue(key)
                val baseRows = indexed(base.optJSONArray(key) ?: JSONArray(), idField, key)
                val localRows = indexed(local.getJSONArray(key), idField, key)
                val remoteRows = indexed(output.optJSONArray(key) ?: JSONArray(), idField, key)
                val result = LinkedHashMap(remoteRows)
                val revisions = JSONObject(entities.optJSONObject(key)?.toString() ?: "{}")
                for (id in (baseRows.keys + localRows.keys).distinct()) {
                    val old = baseRows[id]
                    val edited = localRows[id]
                    if (sameKnown(old, edited)) continue
                    val current = remoteRows[id]
                    val merged = when {
                        edited == null -> {
                            if (current != null && !same(current, old) && conflictPolicy == ConflictPolicy.STOP)
                                throw Conflict("$key/$id")
                            if (current != null && !same(current, old) && conflictPolicy == ConflictPolicy.KEEP_REMOTE)
                                current else null
                        }
                        old == null -> {
                            if (current != null && !same(current, edited) && conflictPolicy == ConflictPolicy.STOP)
                                throw Conflict("$key/$id")
                            if (current != null && !same(current, edited) && conflictPolicy == ConflictPolicy.KEEP_REMOTE)
                                current else JSONObject(edited.toString())
                        }
                        current == null -> if (conflictPolicy == ConflictPolicy.KEEP_LOCAL)
                            JSONObject(edited.toString()) else if (conflictPolicy == ConflictPolicy.KEEP_REMOTE)
                            null else throw Conflict("$key/$id")
                        else -> patchObject(old, edited, current, "$key/$id", conflictPolicy)
                    }
                    if (merged == null) result.remove(id) else result[id] = merged
                    if (!same(current, merged)) changed = true
                    if (same(current, merged)) continue
                    val revision = nextRevision(revisions.optJSONObject(id), remoteVersion, timestamp, deviceId)
                    if (merged == null) {
                        revisions.remove(id)
                        tombstones.put(JSONObject(revision.toString()).put("collection", key).put("id", id))
                    } else revisions.put(id, revision)
                }
                output.put(key, JSONArray(result.values.toList()))
                entities.put(key, revisions)
            } else {
                val old = base.opt(key)
                val edited = local.opt(key)
                if (sameKnown(old, edited)) continue
                val current = output.opt(key)
                val merged = if (old is JSONObject && edited is JSONObject && current is JSONObject)
                    patchObject(old, edited, current, key, conflictPolicy)
                else {
                    if (!same(old, current) && !same(edited, current) && conflictPolicy == ConflictPolicy.STOP)
                        throw Conflict(key)
                    if (!same(old, current) && !same(edited, current) && conflictPolicy == ConflictPolicy.KEEP_REMOTE)
                        current else edited
                }
                if (merged == null) output.remove(key) else output.put(key, merged)
                if (!same(current, merged)) changed = true
                if (!same(current, merged)) fields.put(key, nextRevision(fields.optJSONObject(key), remoteVersion, timestamp, deviceId))
            }
        }
        if (changed) output.put("syncMetadata", metadata.put("entities", entities)
            .put("fields", fields).put("tombstones", tombstones))
        return Result(output, changed)
    }

    fun localDocument(base: JSONObject, structure: JSONObject?, habits: JSONObject?, trackers: JSONObject?): JSONObject {
        val output = JSONObject(base.toString())
        structure?.let { part -> listOf("projects", "categories", "taskListLinks").forEach { output.put(it, part.getJSONArray(it)) } }
        habits?.let { part ->
            mapOf("habits" to "habits", "completions" to "habitCompletions", "goals" to "dailyGoalRecords",
                "rewards" to "rewardTransactions", "achievementUnlocks" to "achievementUnlocks",
                "streakFreezeTransactions" to "streakFreezeTransactions", "quests" to "quests",
                "progress" to "userProgress", "settings" to "habitSettings",
                "hiddenDefaultTemplates" to "hiddenDefaultTemplates").forEach { (source, target) -> output.put(target, part.get(source)) }
        }
        trackers?.let { part -> listOf("sleepPlans", "sleepEntries", "moodEntries").forEach { output.put(it, part.getJSONArray(it)) } }
        return output
    }

    private fun indexed(rows: JSONArray, idField: String, key: String): LinkedHashMap<String, JSONObject> {
        val result = linkedMapOf<String, JSONObject>()
        for (index in 0 until rows.length()) {
            val item = rows.getJSONObject(index)
            val id = item.optString(idField).ifBlank {
                if (idField == "idempotencyKey") item.optString("id") else ""
            }
            require(id.isNotBlank() && result.put(id, item) == null) { "Invalid $key identifier" }
        }
        return result
    }

    private fun patchObject(base: JSONObject, local: JSONObject, remote: JSONObject, path: String,
        conflictPolicy: ConflictPolicy): JSONObject {
        val output = JSONObject(remote.toString())
        // Native codecs intentionally omit web-only properties; omission is never a deletion.
        for (key in local.keys().asSequence().toList()) {
            val old = base.opt(key)
            val edited = local.opt(key)
            if (sameKnown(old, edited)) continue
            val current = remote.opt(key)
            val merged = if (old is JSONObject && edited is JSONObject && current is JSONObject)
                patchObject(old, edited, current, "$path/$key", conflictPolicy)
            else {
                if (!same(old, current) && !same(edited, current) && conflictPolicy == ConflictPolicy.STOP)
                    throw Conflict("$path/$key")
                if (!same(old, current) && !same(edited, current) && conflictPolicy == ConflictPolicy.KEEP_REMOTE)
                    current else edited
            }
            if (merged == null) output.remove(key) else output.put(key, merged)
        }
        return output
    }

    private fun nextRevision(previous: JSONObject?, remoteVersion: Long, timestamp: String, deviceId: String) =
        JSONObject().put("version", maxOf((previous?.optLong("version") ?: 0) + 1, remoteVersion + 1))
            .put("updatedAt", timestamp).put("deviceId", deviceId)

    private fun same(a: Any?, b: Any?): Boolean = canonical(a) == canonical(b)
    private fun sameKnown(old: Any?, edited: Any?): Boolean {
        if (old is JSONObject && edited is JSONObject)
            return edited.keys().asSequence().all { key -> sameKnown(old.opt(key), edited.opt(key)) }
        return same(old, edited)
    }
    private fun canonical(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> value.keys().asSequence().toList().filterNot { it == "syncState" || it == "syncMetadata" }
            .sorted().joinToString(prefix = "{", postfix = "}") { "$it:${canonical(value.opt(it))}" }
        is JSONArray -> (0 until value.length()).joinToString(prefix = "[", postfix = "]") { canonical(value.opt(it)) }
        is String -> JSONObject.quote(value)
        else -> value.toString()
    }
}
