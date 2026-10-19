package ru.genesis.calendar.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SharedOfflineStoreTest {
    @Test fun estimateCommandKeepsZeroNullOmittedAndIdentityAfterAnUncertainRetry() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val user = UUID.randomUUID().toString()
        val request = UUID.randomUUID().toString()
        val body = JSONObject().put("storyPoints", 0).put("estimateHours", JSONObject.NULL)
            .put("expectedRevision", 0).put("requestId", request)
        val store = SharedOfflineStore(context)
        try {
            store.enqueue(user, JSONObject().put("taskId", "estimate-test").put("requestId", request).put("body", body))
            store.markError(user, request, "FORBIDDEN")
            val retained = SharedOfflineStore(context).queued(user).single()
            assertEquals(request, retained.getString("requestId"))
            assertEquals(body.toString(), retained.getJSONObject("body").toString())
            assertEquals(0, retained.getJSONObject("body").getInt("storyPoints"))
            assertTrue(retained.getJSONObject("body").has("estimateHours"))
            assertTrue(retained.getJSONObject("body").isNull("estimateHours"))
            assertFalse(retained.getJSONObject("body").has("sprintId"))
            assertEquals("FORBIDDEN", retained.getString("error"))
        } finally { store.clear(user) }
    }

    @Test fun teamDraftsAreEncryptedScopedAndClearedOnLogout() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = SharedOfflineStore(context)
        val first = UUID.randomUUID().toString()
        val second = UUID.randomUUID().toString()
        val path = "project:${UUID.randomUUID()}"
        val title = "Private team draft ${UUID.randomUUID()}"
        try {
            store.saveSnapshot(first, path, JSONObject().put("title", title))
            store.saveSnapshot(second, path, JSONObject().put("title", "Other team"))
            store.enqueue(first, JSONObject().put("requestId", UUID.randomUUID().toString())
                .put("projectId", path).put("title", title))
            assertEquals(title, store.snapshot(first, path)?.getString("title"))
            assertEquals("Other team", store.snapshot(second, path)?.getString("title"))
            assertEquals(1, store.queued(first).size)
            assertTrue(store.queued(second).isEmpty())
            val raw = context.getSharedPreferences("genesis.shared.offline.v1", 0).all.values.joinToString()
            assertFalse(raw.contains(title))
            store.clearSnapshots(first)
            assertNull(store.snapshot(first, path))
            assertEquals(1, store.queued(first).size)
            store.clear(first)
            assertNull(store.snapshot(first, path))
            assertTrue(store.queued(first).isEmpty())
            assertEquals("Other team", store.snapshot(second, path)?.getString("title"))
        } finally {
            store.clear(first)
            store.clear(second)
        }
    }
}
