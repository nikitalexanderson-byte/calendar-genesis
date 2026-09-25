package ru.genesis.calendar

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.genesis.calendar.auth.CloudAccountSnapshot
import ru.genesis.calendar.auth.CloudTaskSync
import ru.genesis.calendar.auth.CloudTaskTransport
import ru.genesis.calendar.data.*

@RunWith(AndroidJUnit4::class)
class CloudTaskSyncTest {
    private val scope = CloudAccountSnapshot.scopeFor("synthetic-task-account")

    @Test fun sendsOnlyAccountTasksAndAcknowledgesOnlyConfirmedRevision() = runBlocking {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val cipher = LocalCipher()
            val task = JSONObject().put("id", "task-1").put("title", "Actual edit")
                .put("dueDate", "2026-09-25").put("zoneId", "UTC")
                .put("priority", 5).put("reminderAt", JSONObject.NULL)
                .put("done", false).put("webOnly", "keep")
            db.dao().putTask(TaskRecord(scope, "task-1", cipher.encrypt(task.toString(), "$scope/task-1"), 2, false))
            db.dao().putOutbox(OutboxRecord(scope, "task-1", 2, "op-1"))
            val transmitted = mutableListOf<String>()
            val transport = object : CloudTaskTransport {
                override fun put(id: String, task: JSONObject): JSONObject {
                    transmitted += id
                    assertEquals("keep", task.getString("webOnly"))
                    return JSONObject().put("task", JSONObject().put("id", id).put("title", "Confirmed edit")
                        .put("googleEventId", "event-1"))
                }
                override fun delete(id: String, task: JSONObject): JSONObject = error("Unexpected delete")
            }
            assertEquals(1, CloudTaskSync(db, transport).flush(scope))
            assertEquals(listOf("task-1"), transmitted)
            assertTrue(db.dao().outbox(scope).isEmpty())
            val row = requireNotNull(db.dao().task(scope, "task-1"))
            val saved = JSONObject(cipher.decrypt(row.encrypted, "$scope/task-1"))
            assertEquals("Confirmed edit", saved.getString("title"))
            assertEquals("event-1", saved.getString("googleEventId"))
            assertEquals("keep", saved.getString("webOnly"))
            assertEquals(2, row.revision)
        } finally { db.close() }
    }

    @Test fun transportFailureKeepsPendingOperationAndLocalData() = runBlocking {
        val db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), GenesisDatabase::class.java).build()
        try {
            val cipher = LocalCipher()
            val value = JSONObject().put("id", "task-2").put("title", "Not yet sent")
                .put("dueDate", "2026-09-25").put("zoneId", "UTC")
                .put("priority", 5).put("reminderAt", JSONObject.NULL).put("done", false)
            val encrypted = cipher.encrypt(value.toString(), "$scope/task-2")
            db.dao().putTask(TaskRecord(scope, "task-2", encrypted, 1, false))
            db.dao().putOutbox(OutboxRecord(scope, "task-2", 1, "op-2"))
            val failing = object : CloudTaskTransport {
                override fun put(id: String, task: JSONObject): JSONObject = throw java.io.IOException("offline")
                override fun delete(id: String, task: JSONObject): JSONObject = error("Unexpected delete")
            }
            assertThrows(java.io.IOException::class.java) { runBlocking { CloudTaskSync(db, failing).flush(scope) } }
            assertEquals(1, db.dao().outbox(scope).size)
            assertEquals(encrypted, db.dao().task(scope, "task-2")?.encrypted)
        } finally { db.close() }
    }
}
