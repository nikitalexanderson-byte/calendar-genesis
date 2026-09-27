package ru.genesis.calendar.data

import androidx.room.withTransaction
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.CloudAccountSnapshot
import ru.genesis.calendar.reminders.ReminderScheduler

/** Pulls verified server data into an account-only encrypted cache; never touches isolated drafts. */
internal class CloudAccountImporter(private val db: GenesisDatabase, private val scheduler: ReminderScheduler? = null) {
    enum class Result { IMPORTED, IMPORTED_WITH_GOOGLE_WARNING, PENDING_LOCAL_CHANGES }

    companion object {
        fun structureDocument(document: JSONObject): String = JSONObject()
            .put("projects", document.getJSONArray("projects"))
            .put("categories", document.getJSONArray("categories"))
            .put("taskListLinks", document.getJSONArray("taskListLinks")).toString()

        fun habitsDocument(document: JSONObject): String = JSONObject().put("localSchema", 1)
            .put("habits", document.getJSONArray("habits"))
            .put("completions", document.getJSONArray("habitCompletions"))
            .put("goals", document.getJSONArray("dailyGoalRecords"))
            .put("rewards", document.getJSONArray("rewardTransactions"))
            .put("achievementUnlocks", document.optJSONArray("achievementUnlocks") ?: JSONArray())
            .put("streakFreezeTransactions", document.optJSONArray("streakFreezeTransactions") ?: JSONArray())
            .put("quests", document.optJSONArray("quests") ?: JSONArray())
            .put("settings", document.optJSONObject("habitSettings") ?: JSONObject())
            .put("hiddenDefaultTemplates", document.optJSONArray("hiddenDefaultTemplates") ?: JSONArray())
            .put("progress", document.getJSONObject("userProgress")).toString()

        fun trackersDocument(document: JSONObject): String = JSONObject().put("localSchema", 1)
            .put("sleepPlans", document.getJSONArray("sleepPlans"))
            .put("sleepEntries", document.getJSONArray("sleepEntries"))
            .put("moodEntries", document.getJSONArray("moodEntries")).toString()
    }

    suspend fun import(snapshot: CloudAccountSnapshot): Result {
        val scope = snapshot.scope
        require(scope.startsWith("account-") && scope.length == 40)
        val cipher = LocalCipher()
        val document = snapshot.document
        val structure = document?.let(::structureDocument) ?: WorkspaceStructureCodec.encode(WorkspaceStructure())
        WorkspaceStructureCodec.decode(structure)
        val habits = document?.let(::habitsDocument)
        if (habits != null) HabitDocument.decode(habits, snapshot.version)
        val trackers = document?.let(::trackersDocument)
        if (trackers != null) TrackersDocument.decode(trackers, snapshot.version)
        val tasks = snapshot.tasks.map { source ->
            val value = CloudAccountSnapshot.nativeTaskJson(source)
            val id = value.getString("id")
            require(id.isNotBlank() && id.length <= 100)
            val revision = value.optLong("updatedAt", 1).coerceAtLeast(1)
            val json = value.toString()
            val record = TaskRecord(scope, id, cipher.encrypt(json, "$scope/$id"), revision, value.optBoolean("done"))
            record to LocalTask.from(record, json)
        }
        require(tasks.distinctBy { it.first.id }.size == tasks.size)
        val dao = db.dao()
        val previousReminders = dao.reminders(scope)
        val update: suspend () -> Result = { db.withTransaction {
            if (dao.outbox(scope).isNotEmpty()) return@withTransaction Result.PENDING_LOCAL_CHANGES
            val cached = dao.document(scope, "cloud-base")
            if (cached != null && cached.revision > snapshot.version) return@withTransaction Result.PENDING_LOCAL_CHANGES
            if (!snapshot.googleSyncWarning) {
                dao.clearAccountTaskCache(scope)
                dao.clearReminders(scope)
                tasks.forEach { (record, task) ->
                    dao.putTask(record)
                    TaskReminderPlan.times(task).forEach { (occurrence, at) ->
                        dao.putReminder(ReminderRecord(scope, task.id + ":" + occurrence, task.id,
                            occurrence.substringBefore(':'), record.revision, at))
                    }
                }
            }
            dao.putDocument(DocumentRecord(scope, "structure", cipher.encrypt(structure, "$scope/structure"), snapshot.version))
            if (document != null) {
                dao.putDocument(DocumentRecord(scope, "cloud-base", cipher.encrypt(document.toString(), "$scope/cloud-base"), snapshot.version))
                dao.putDocument(DocumentRecord(scope, "habits", cipher.encrypt(requireNotNull(habits), "$scope/habits"), snapshot.version))
                dao.putDocument(DocumentRecord(scope, "trackers", cipher.encrypt(requireNotNull(trackers), "$scope/trackers"), snapshot.version))
            }
            if (snapshot.googleSyncWarning) Result.IMPORTED_WITH_GOOGLE_WARNING else Result.IMPORTED
        } }
        val result = if (scheduler == null) update() else scheduler.withMutation {
            update().also { if (it == Result.IMPORTED) previousReminders.forEach(scheduler::cancel) }
        }
        return result
    }
}
