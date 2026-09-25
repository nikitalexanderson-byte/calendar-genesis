package ru.genesis.calendar.auth

import java.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.security.WorkspaceCipher

class CloudAccountSnapshotTest {
    private val key = ByteArray(32) { (it + 7).toByte() }

    private fun payload(document: JSONObject?, warning: Boolean = false): JSONObject {
        val workspace = JSONObject().put("keyMode", if (document == null) "new" else "account")
            .put("key", if (document == null) JSONObject.NULL else Base64.getEncoder().encodeToString(key))
        workspace.put("envelope", if (document == null) JSONObject.NULL else {
            val encrypted = WorkspaceCipher.encrypt(document.toString().toByteArray(), key)
            JSONObject().put("ciphertext", encrypted.ciphertext).put("iv", encrypted.iv).put("version", 3)
        })
        return JSONObject().put("user", JSONObject().put("uid", "user-1")
            .put("email", "account@example.test").put("displayName", "Test"))
            .put("workspace", workspace).put("tasks", JSONArray().put(JSONObject()
                .put("id", "google-1").put("title", "Existing task").put("dueDate", "2026-09-25")
                .put("webOnly", "retained")))
            .put("syncWarning", if (warning) "Google temporarily unavailable" else JSONObject.NULL)
    }

    private fun document(): JSONObject = JSONObject().put("trackerSchemaVersion", 16)
        .put("projects", JSONArray()).put("categories", JSONArray()).put("taskListLinks", JSONArray())
        .put("habits", JSONArray()).put("habitCompletions", JSONArray())
        .put("sleepPlans", JSONArray()).put("sleepEntries", JSONArray()).put("moodEntries", JSONArray())
        .put("dailyGoalRecords", JSONArray()).put("rewardTransactions", JSONArray())
        .put("userProgress", JSONObject()).put("unknownWebSection", JSONObject().put("keep", true))

    @Test fun decryptsAccountDocumentAndKeepsUnknownFields() {
        val snapshot = CloudAccountSnapshot.fromBootstrap(payload(document()))
        assertEquals(3, snapshot.version)
        assertEquals(40, snapshot.scope.length)
        assertTrue(snapshot.scope.startsWith("account-"))
        assertTrue(snapshot.document!!.getJSONObject("unknownWebSection").getBoolean("keep"))
        assertEquals("retained", snapshot.tasks.single().getString("webOnly"))
        val native = CloudAccountSnapshot.nativeTaskJson(snapshot.tasks.single())
        assertEquals("retained", native.getString("webOnly"))
        assertEquals(5, native.getInt("priority"))
        assertFalse(snapshot.googleSyncWarning)
    }

    @Test fun scopeIsStableButDistinctFromLocalAndOtherAccounts() {
        val first = CloudAccountSnapshot.scopeFor("user-1")
        assertEquals(first, CloudAccountSnapshot.scopeFor("user-1"))
        assertNotEquals(first, CloudAccountSnapshot.scopeFor("user-2"))
        assertNotEquals("internal-validation-v1", first)
    }

    @Test fun warningAndMissingEnvelopeNeverInventRemoteDocument() {
        val snapshot = CloudAccountSnapshot.fromBootstrap(payload(null, warning = true))
        assertNull(snapshot.document)
        assertEquals(0, snapshot.version)
        assertTrue(snapshot.googleSyncWarning)
        val bad = payload(document())
        bad.getJSONObject("workspace").put("key", Base64.getEncoder().encodeToString(ByteArray(32)))
        assertThrows(Exception::class.java) { CloudAccountSnapshot.fromBootstrap(bad) }
    }
}
