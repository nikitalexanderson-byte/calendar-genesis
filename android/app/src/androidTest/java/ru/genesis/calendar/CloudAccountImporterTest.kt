package ru.genesis.calendar

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Base64
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.genesis.calendar.auth.CloudAccountSnapshot
import ru.genesis.calendar.data.*
import ru.genesis.calendar.security.WorkspaceCipher

@RunWith(AndroidJUnit4::class)
class CloudAccountImporterTest {
    private val key = ByteArray(32) { (it + 9).toByte() }

    private fun response(taskTitle: String, projectTitle: String, warning: Boolean = false): JSONObject {
        val habits = JSONObject(HabitDocument.encode(LocalHabitWorkspace()))
        val trackers = JSONObject(TrackersDocument.encode(LocalTrackersWorkspace()))
        val structure = JSONObject(WorkspaceStructureCodec.encode(WorkspaceStructure(projects = listOf(
            GenesisProject("project-1", null, "work", projectTitle, "", emptyList(), "active", 0)))))
        val doc = JSONObject().put("trackerSchemaVersion", 16)
            .put("projects", structure.getJSONArray("projects"))
            .put("categories", structure.getJSONArray("categories"))
            .put("taskListLinks", structure.getJSONArray("taskListLinks"))
            .put("habits", habits.getJSONArray("habits"))
            .put("habitCompletions", habits.getJSONArray("completions"))
            .put("dailyGoalRecords", habits.getJSONArray("goals"))
            .put("rewardTransactions", habits.getJSONArray("rewards"))
            .put("achievementUnlocks", habits.getJSONArray("achievementUnlocks"))
            .put("streakFreezeTransactions", habits.getJSONArray("streakFreezeTransactions"))
            .put("quests", habits.getJSONArray("quests"))
            .put("userProgress", habits.getJSONObject("progress"))
            .put("sleepPlans", trackers.getJSONArray("sleepPlans"))
            .put("sleepEntries", trackers.getJSONArray("sleepEntries"))
            .put("moodEntries", trackers.getJSONArray("moodEntries"))
            .put("unknownWebSection", JSONObject().put("preserved", true))
        val encrypted = WorkspaceCipher.encrypt(doc.toString().toByteArray(), key)
        return JSONObject().put("user", JSONObject().put("uid", "synthetic-account")
            .put("email", "fixture@example.test").put("displayName", "Fixture"))
            .put("workspace", JSONObject().put("keyMode", "account")
                .put("key", Base64.getEncoder().encodeToString(key))
                .put("envelope", JSONObject().put("ciphertext", encrypted.ciphertext)
                    .put("iv", encrypted.iv).put("version", 5)))
            .put("tasks", JSONArray().put(JSONObject().put("id", "google-1")
                .put("title", taskTitle).put("dueDate", "2026-09-25")
                .put("projectId", "project-1").put("done", false)
                .put("webOnly", "preserved")))
            .put("syncWarning", if (warning) "Google unavailable" else JSONObject.NULL)
    }

    @Test fun importsOnlyAccountScopeAndRetainsPendingLocalChanges() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val db = Room.inMemoryDatabaseBuilder(context, GenesisDatabase::class.java).build()
        try {
            val snapshot = CloudAccountSnapshot.fromBootstrap(response("Existing task", "Existing project"))
            assertEquals(CloudAccountImporter.Result.IMPORTED, CloudAccountImporter(db).import(snapshot))
            val dao = db.dao()
            assertNull(dao.task("internal-validation-v1", "google-1"))
            val record = requireNotNull(dao.task(snapshot.scope, "google-1"))
            val task = LocalTask.from(record, LocalCipher().decrypt(record.encrypted, "${snapshot.scope}/google-1"))
            assertEquals("Existing task", task.title)
            assertEquals("preserved", JSONObject(task.sourceFieldsJson).getString("webOnly"))
            val structure = requireNotNull(dao.document(snapshot.scope, "structure"))
            assertTrue(LocalCipher().decrypt(structure.encrypted, "${snapshot.scope}/structure").contains("Existing project"))
            val base = requireNotNull(dao.document(snapshot.scope, "cloud-base"))
            assertTrue(LocalCipher().decrypt(base.encrypted, "${snapshot.scope}/cloud-base").contains("unknownWebSection"))
            dao.putOutbox(OutboxRecord(snapshot.scope, "google-1", 6, "pending"))
            val changed = CloudAccountSnapshot.fromBootstrap(response("Remote changed", "Remote project"))
            assertEquals(CloudAccountImporter.Result.PENDING_LOCAL_CHANGES, CloudAccountImporter(db).import(changed))
            assertEquals(record, dao.task(snapshot.scope, "google-1"))
        } finally { db.close() }
    }

    @Test fun googleWarningDoesNotEraseCachedTasks() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val db = Room.inMemoryDatabaseBuilder(context, GenesisDatabase::class.java).build()
        try {
            val first = CloudAccountSnapshot.fromBootstrap(response("Existing task", "First project"))
            CloudAccountImporter(db).import(first)
            val warning = CloudAccountSnapshot.fromBootstrap(response("Incomplete task list", "Updated project", true))
            assertEquals(CloudAccountImporter.Result.IMPORTED_WITH_GOOGLE_WARNING, CloudAccountImporter(db).import(warning))
            val record = requireNotNull(db.dao().task(first.scope, "google-1"))
            assertEquals("Existing task", LocalTask.from(record,
                LocalCipher().decrypt(record.encrypted, "${first.scope}/google-1")).title)
        } finally { db.close() }
    }

    @Test fun importedWebRemindersAreScheduledAndRefreshedWithoutLocalOutbox() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val db = Room.inMemoryDatabaseBuilder(context, GenesisDatabase::class.java).build()
        try {
            val first = response("Reminder task", "Project")
            first.getJSONArray("tasks").getJSONObject(0).put("time", "12:00")
                .put("zoneId", "UTC").put("reminders", JSONArray()
                    .put(JSONObject().put("kind", "relative").put("minutes", 10))
                    .put(JSONObject().put("kind", "relative").put("minutes", 60)))
            val snapshot = CloudAccountSnapshot.fromBootstrap(first)
            assertEquals(CloudAccountImporter.Result.IMPORTED, CloudAccountImporter(db).import(snapshot))
            val reminders = db.dao().taskReminders(snapshot.scope, "google-1")
            assertEquals(2, reminders.size)
            assertEquals(0, db.dao().outbox(snapshot.scope).size)
            val changed = response("Reminder task", "Project")
            assertEquals(CloudAccountImporter.Result.IMPORTED,
                CloudAccountImporter(db).import(CloudAccountSnapshot.fromBootstrap(changed)))
            assertTrue(db.dao().taskReminders(snapshot.scope, "google-1").isEmpty())
        } finally { db.close() }
    }
}
