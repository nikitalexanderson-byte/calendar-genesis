package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.UUID

/** Existing guarded loopback actor; no remote origin or session file is accepted. */
class CustomFieldHttpIntegrationTest {
    private class Http(private val origin: String) {
        private val client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()
        private val cookie: String; private var csrf = ""
        init {
            require(origin == "http://127.0.0.1:4338")
            val signed = client.send(HttpRequest.newBuilder(URI("$origin/__fixture/sign-in?actor=editor")).GET().build(), HttpResponse.BodyHandlers.ofString())
            assertEquals(302, signed.statusCode()); cookie = signed.headers().firstValue("set-cookie").orElseThrow().substringBefore(';')
            require(cookie.matches(Regex("GENESISSESSID=[A-Za-z0-9,-]{16,256}")))
            val session = call("/session"); require(session.getJSONObject("user").getString("email") == "improvements-editor@example.invalid")
            csrf = AuthProtocol.csrf(session.getString("csrf"))
        }
        fun call(path: String, body: JSONObject? = null): JSONObject {
            require(path.startsWith('/') && !path.contains(".."))
            val builder = HttpRequest.newBuilder(URI("$origin/api$path")).timeout(Duration.ofSeconds(60)).header("Cookie", cookie).header("Accept", "application/json")
            if (body != null) builder.header("X-CSRF-Token", csrf).header("Content-Type", "application/json; charset=utf-8")
            val response = client.send(builder.method(if (body == null) "GET" else "POST", body?.let { HttpRequest.BodyPublishers.ofString(it.toString()) } ?: HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString())
            val value = JSONObject(response.body())
            if (response.statusCode() !in 200..299) throw AuthApiError(value.optString("error", "HTTP_${response.statusCode()}"))
            return value
        }
    }
    @Test fun realPhpTaskPatchReplayExplicitClearAndRebasePreserveZeroFalseAndUnchangedHistory() {
        val origin = System.getenv("GENESIS_CUSTOM_FIELDS_HTTP_TEST")
        assumeTrue("Local custom field integration fixture is opt-in", origin != null); require(origin == "http://127.0.0.1:4338")
        val file = File(requireNotNull(System.getenv("GENESIS_CUSTOM_FIELDS_HTTP_TARGET"))).canonicalFile
        require(file.name == "native-custom-fields-http-target.json" && file.parentFile?.name == "output")
        val target = JSONObject(file.readText()); val space = target.getString("spaceId"); val project = target.getString("projectId"); val id = target.getString("taskId")
        listOf(space, project, id).forEach(CustomFieldProtocol::id)
        val http = Http(origin); val route = "/shared/projects/$project/tasks/$id"
        val snapshot = http.call("/shared/projects/$project"); require(snapshot.getJSONObject("project").getString("title") == "Карточка с полями")
        val fields = CustomFieldProtocol.definitions(space, project, snapshot.getJSONArray("customFieldDefinitions"))
        val initial = http.call(route).getJSONObject("task"); val original = CustomFieldProtocol.fromTask(initial)
        require(initial.getString("title") == "Задача с семью типами полей")
        val keys = target.getJSONObject("fields")
        fun key(type: String) = keys.getString(type)
        fun body(task: JSONObject, patch: JSONObject) = JSONObject().put("requestId", UUID.randomUUID().toString()).put("expectedRevision", task.getInt("revision")).put("customFields", patch)
        try {
            val selected = CustomFieldDraft.fromTask(initial).change(key("number"), "0").change(key("checkbox"), true)
                .change(key("multi"), JSONArray().put("first").put("second").put("retired"))
            val command = body(initial, selected.patch(fields)); val frozen = command.toString()
            // The HTTP success is deliberately not acknowledged on the first attempt.
            val committed = http.call(route, command).getJSONObject("task")
            val replay = http.call(route, JSONObject(frozen)); confirmedSharedReceipt("update", project, id, JSONObject(frozen), replay)
            assertEquals(committed.getInt("revision"), replay.getJSONObject("task").getInt("revision")); assertEquals(frozen, command.toString())
            val cleared = CustomFieldDraft.fromTask(replay.getJSONObject("task")).change(key("checkbox"), false).change(key("text"), null)
            val clearBody = body(replay.getJSONObject("task"), cleared.patch(fields)); val changed = http.call(route, clearBody)
            confirmedSharedReceipt("update", project, id, clearBody, changed)
            val values = changed.getJSONObject("task").getJSONObject("customFields")
            assertEquals(0.0, values.getDouble(key("number")), 0.0); assertEquals(false, values.get(key("checkbox"))); assertFalse(values.has(key("text")))
            assertEquals(original.get(key("archived")), values.get(key("archived"))); assertEquals("retired", values.getString(key("select")))
            val own = CustomFieldDraft.fromTask(changed.getJSONObject("task")).change(key("text"), "Собственная правка")
            val pending = body(changed.getJSONObject("task"), own.patch(fields)); val kept = own.snapshot().toString()
            http.call(route, JSONObject().put("requestId", UUID.randomUUID().toString()).put("expectedRevision", changed.getJSONObject("task").getInt("revision")).put("priority", 2))
            assertEquals("SHARED_TASK_CONFLICT", assertThrows(AuthApiError::class.java) { http.call(route, pending) }.code); assertEquals(kept, own.snapshot().toString())
            val current = http.call(route).getJSONObject("task"); val rebased = own.rebase(current, fields); val rebasedBody = body(current, rebased.patch(fields))
            val accepted = http.call(route, rebasedBody); confirmedSharedReceipt("update", project, id, rebasedBody, accepted)
            assertEquals(2, accepted.getJSONObject("task").getInt("priority")); assertEquals("Собственная правка", accepted.getJSONObject("task").getJSONObject("customFields").getString(key("text")))
        } finally {
            val current = http.call(route).getJSONObject("task"); val restore = body(current, original).put("priority", initial.getInt("priority"))
            confirmedSharedReceipt("update", project, id, restore, http.call(route, restore))
        }
    }
}
