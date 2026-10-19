package ru.genesis.calendar.auth

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class SharedMutationReceiptTest {
    private fun reply(id: String = "task-a", project: String = "project-a", revision: Any = 1) =
        JSONObject().put("task", JSONObject().put("id", id).put("projectId", project).put("revision", revision))

    @Test fun aDefiniteFirstFourHundredRejectionDiffersFromAnUnknownServerResult() {
        assertTrue(definiteSharedRejection(AuthFailure(AuthFailure.Kind.SERVER, 400)))
        assertTrue(definiteSharedRejection(AuthFailure(AuthFailure.Kind.UNAUTHORIZED, 403)))
        assertTrue(definiteSharedRejection(AuthFailure(AuthFailure.Kind.SERVER, 422)))
        assertFalse(definiteSharedRejection(AuthFailure(AuthFailure.Kind.SERVER, 500)))
        assertFalse(definiteSharedRejection(AuthFailure(AuthFailure.Kind.NETWORK)))
        assertFalse(definiteSharedRejection(AuthFailure(AuthFailure.Kind.PROTOCOL)))
        assertFalse(definiteSharedRejection(AuthFailure(AuthFailure.Kind.STORAGE)))
    }

    @Test fun updateIdentityAndRevisionMustMatchBeforeReleasingTheCommand() {
        val body = JSONObject().put("expectedRevision", 0).put("requestId", "stable").put("storyPoints", 0)
        val response = reply()
        assertSame(response, confirmedSharedReceipt("update", "project-a", "task-a", body, response))
        for (bad in listOf(reply(id = "other"), reply(project = "other"), reply(revision = -1), reply(revision = 0.5), JSONObject())) {
            assertEquals(AuthFailure.Kind.PROTOCOL, assertThrows(AuthFailure::class.java) {
                confirmedSharedReceipt("update", "project-a", "task-a", body, bad)
            }.kind)
        }
        assertEquals("stable", body.getString("requestId"))
        assertEquals(0, body.getInt("storyPoints"))
    }

    @Test fun aMoveCanAcknowledgeItsRequestedDestinationButNotAnotherProject() {
        val body = JSONObject().put("expectedRevision", 0).put("destinationProjectId", "project-b")
        val response = reply(project = "project-b")
        assertSame(response, confirmedSharedReceipt("move", "project-a", "task-a", body, response))
        assertThrows(AuthFailure::class.java) { confirmedSharedReceipt("move", "project-a", "task-a", body, reply()) }
        val within = JSONObject().put("expectedRevision", 0).put("statusId", "done")
        confirmedSharedReceipt("move", "project-a", "task-a", within, reply())
    }

    @Test fun queuedPlaceholdersCannotMasqueradeAsConfirmedServerTasks() {
        val pending = reply().apply { getJSONObject("task").put("pending", true) }
        assertThrows(AuthFailure::class.java) { confirmedSharedReceipt("create", "project-a", null, JSONObject(), pending) }
        assertThrows(AuthFailure::class.java) { confirmedSharedReceipt("create", "project-a", null, JSONObject(), reply(id = "pending:stable")) }
        val created = reply(id = "new-server-id", revision = 0)
        assertSame(created, confirmedSharedReceipt("create", "project-a", null, JSONObject(), created))
    }
}
