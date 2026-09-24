package ru.genesis.calendar.data

import androidx.room.withTransaction
import java.time.*
import java.util.UUID
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.RecurrenceConfig
import ru.genesis.calendar.domain.RecurrenceEngine
import ru.genesis.calendar.reminders.ReminderScheduler

data class LocalTask(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val description: String = "",
    val date: String = LocalDate.now().toString(),
    val time: String = "",
    val zoneId: String = ZoneId.systemDefault().id,
    val priority: Int = 5,
    val done: Boolean = false,
    val reminderAt: Long? = null,
    val revision: Long = 0,
    val projectId: String? = null,
    val categoryId: String? = null,
    val project: String = "",
    val recurrence: RecurrenceConfig = RecurrenceConfig(),
    val recurrenceExcludedDates: List<String> = emptyList(),
    /** Retains web fields that the native editor does not yet expose. Always encrypted at rest. */
    val sourceFieldsJson: String = "{}",
) {
    fun json() = JSONObject(sourceFieldsJson).put("id", id).put("done", done)
        .put("title", title).put("description", description)
        .put("dueDate", date).put("time", time).put("zoneId", zoneId).put("priority", priority)
        .put("reminderAt", reminderAt ?: JSONObject.NULL)
        .put("projectId", projectId ?: JSONObject.NULL).put("categoryId", categoryId ?: JSONObject.NULL)
        .put("project", project)
        .put("recurrence", "none")
        .put("recurrenceMode", if (recurrence.enabled) recurrence.mode else "none")
        .put("recurrencePattern", if (recurrence.enabled) recurrence.pattern else "none")
        .put("recurrenceDays", JSONArray(if (recurrence.enabled) recurrence.days else emptyList<Int>()))
        .put("recurrenceInterval", recurrence.interval)
        .put("recurrenceStartDate", recurrence.rangeStart.takeIf { recurrence.enabled && it.isNotBlank() } ?: JSONObject.NULL)
        .put("recurrenceEndDate", recurrence.rangeEnd.takeIf { recurrence.enabled && it.isNotBlank() } ?: JSONObject.NULL)
        .put("recurrenceMonths", JSONArray(if (recurrence.enabled) recurrence.months else emptyList<Int>()))
        .put("recurrencePyatas", JSONArray(if (recurrence.enabled) recurrence.pyatas else emptyList<Int>()))
        .put("recurrenceExcludedDates", JSONArray(if (recurrence.enabled) recurrenceExcludedDates else emptyList<String>())).toString()
    companion object {
        private fun ints(array: JSONArray?) = if (array == null) emptyList() else
            (0 until array.length()).mapNotNull { index -> array.optInt(index).takeIf { it > 0 } }
        private fun strings(array: JSONArray?) = if (array == null) emptyList() else
            (0 until array.length()).mapNotNull { index -> array.optString(index).takeIf { it.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) } }
        fun from(record: TaskRecord, json: String): LocalTask {
            val v = JSONObject(json)
            val mode = v.optString("recurrenceMode").takeIf { it in setOf("classic", "genesis", "lunar") }
                ?: if (v.optString("recurrence") in setOf("daily", "weekly", "monthly", "yearly")) "classic" else "genesis"
            val enabled = if (v.has("recurrenceMode")) v.optString("recurrenceMode") in setOf("classic", "genesis", "lunar")
                else v.optString("recurrence") in setOf("daily", "weekly", "monthly", "yearly")
            val recurrence = RecurrenceConfig(enabled, mode,
                v.optString("recurrencePattern").takeUnless { it.isBlank() || it == "none" } ?: when (mode) {
                    "classic" -> v.optString("recurrence").takeIf { it in setOf("daily", "monthly", "yearly") } ?: "weekdays"
                    "lunar" -> "lunar-days"
                    else -> "pyata-days"
                }, ints(v.optJSONArray("recurrenceDays")).ifEmpty { listOf(1) },
                v.optInt("recurrenceInterval", 1), v.optString("recurrenceStartDate").takeUnless { it == "null" } ?: "",
                v.optString("recurrenceEndDate").takeUnless { it == "null" } ?: "",
                ints(v.optJSONArray("recurrenceMonths")), ints(v.optJSONArray("recurrencePyatas")))
            return LocalTask(record.id, v.getString("title"), v.optString("description"),
                v.getString("dueDate"), v.optString("time"), v.getString("zoneId"),
                v.getInt("priority"), record.done,
                if (v.isNull("reminderAt")) null else v.getLong("reminderAt"), record.revision,
                if (v.isNull("projectId")) null else v.getString("projectId"),
                if (v.isNull("categoryId")) null else v.getString("categoryId"), v.optString("project"),
                recurrence, strings(v.optJSONArray("recurrenceExcludedDates")), json)
        }
    }
}

class TaskRepository(private val db: GenesisDatabase, private val cipher: LocalCipher,
    val scope: String, private val scheduler: ReminderScheduler) {
    private val dao get() = db.dao()
    val tasks = dao.observeTasks(scope).map { rows ->
        rows.map { LocalTask.from(it, cipher.decrypt(it.encrypted, "$scope/${it.id}")) }
            .sortedWith(compareBy<LocalTask> { it.done }.thenBy { it.date }.thenBy { it.time }.thenByDescending { it.priority })
    }
    suspend fun get(id: String): LocalTask? = dao.task(scope, id)?.takeUnless { it.deleted }?.let {
        LocalTask.from(it, cipher.decrypt(it.encrypted, "$scope/${it.id}"))
    }
    suspend fun save(task: LocalTask): LocalTask = scheduler.withMutation { saveLocked(task) }
    private suspend fun saveLocked(task: LocalTask): LocalTask {
        require(task.title.isNotBlank() && task.title.length <= 500)
        LocalDate.parse(task.date)
        if (task.time.isNotEmpty()) LocalTime.parse(task.time)
        ZoneId.of(task.zoneId)
        require(task.priority in 1..10)
        if (task.recurrence.enabled) {
            val dates = RecurrenceEngine(GenesisCalendar()).buildDates(task.date, task.recurrence)
            require(dates.isNotEmpty()) { "В выбранном периоде нет дат повторения." }
            require(dates.size <= 500) { "Серия может содержать не более 500 повторений." }
            require(task.recurrenceExcludedDates.all { runCatching { LocalDate.parse(it) }.isSuccess })
        }
        val previous = dao.taskReminders(scope, task.id)
        val saved = db.withTransaction {
            val existing = dao.task(scope, task.id)
            require(existing == null || existing.revision == task.revision) { "Запись изменилась. Откройте её заново." }
            val structure = dao.document(scope, "structure")?.let { WorkspaceStructureCodec.decode(
                cipher.decrypt(it.encrypted, "$scope/structure"), it.revision) } ?: WorkspaceStructure()
            val assigned = task.projectId?.takeUnless { it == "__genesis_inbox__" }?.let { id ->
                structure.projects.find { it.id == id } ?: throw IllegalArgumentException("Проект не найден. Выберите его заново.")
            }
            require(task.categoryId == null || task.categoryId in structure.categories.map { it.id }) { "Категория не найдена." }
            val next = task.copy(revision = (existing?.revision ?: 0) + 1,
                project = assigned?.title ?: "",
                categoryId = if (assigned != null) assigned.categoryId else
                    if (task.projectId == "__genesis_inbox__") null else task.categoryId)
            dao.putTask(TaskRecord(scope, task.id, cipher.encrypt(next.json(), "$scope/${task.id}"), next.revision, task.done))
            dao.putOutbox(OutboxRecord(scope, task.id, next.revision, UUID.randomUUID().toString()))
            dao.cancelReminders(scope, task.id)
            if (!task.done && task.reminderAt != null) {
                dao.putReminder(ReminderRecord(scope, task.id + ":0", task.id, task.date,
                    next.revision, task.reminderAt))
            }
            next
        }
        previous.forEach(scheduler::cancel)
        dao.taskReminders(scope, task.id).filter { it.state == "pending" }.forEach(scheduler::schedule)
        return saved
    }
    suspend fun complete(id: String) {
        val task = get(id) ?: return
        if (!task.done) save(task.copy(done = true))
    }
    suspend fun excludeOccurrence(id: String, expectedRevision: Long, date: String) {
        val current = get(id) ?: throw IllegalArgumentException("Задача больше недоступна.")
        require(current.revision == expectedRevision) { "Запись изменилась. Откройте её заново." }
        val remaining = TaskOccurrences.withoutDate(current, date)
        if (remaining == null) delete(id, expectedRevision) else save(remaining)
    }
    suspend fun delete(id: String, expectedRevision: Long? = null) = scheduler.withMutation {
        val reminders = dao.taskReminders(scope, id)
        db.withTransaction {
            val row = dao.task(scope, id) ?: return@withTransaction
            require(expectedRevision == null || row.revision == expectedRevision) {
                "Запись изменилась. Откройте её заново."
            }
            dao.putTask(row.copy(deleted = true, revision = row.revision + 1))
            dao.cancelReminders(scope, id)
            dao.putOutbox(OutboxRecord(scope, id, row.revision + 1, UUID.randomUUID().toString()))
        }
        reminders.forEach(scheduler::cancel)
    }
    suspend fun snooze(id: String, revision: Long, durationMillis: Long = 10 * 60_000L): Boolean =
        reminderAction(id,revision,"snooze",durationMillis)

    suspend fun reminderAction(id: String, revision: Long, action: String,
        durationMillis: Long = 10 * 60_000L): Boolean = scheduler.withMutation {
        val reminder = dao.reminder(scope,id) ?: return@withMutation false
        if(reminder.revision!=revision || reminder.state!="delivered") return@withMutation false
        val task=get(reminder.taskId)?.takeUnless { it.done } ?: return@withMutation false
        if(task.revision!=revision) return@withMutation false
        val next=when(action) {
            "complete" -> task.copy(done=true)
            "snooze" -> task.copy(reminderAt=System.currentTimeMillis()+durationMillis)
            "dismiss" -> task.copy(reminderAt=null)
            else -> return@withMutation false
        }
        saveLocked(next)
        true
    }
}
