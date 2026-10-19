package ru.genesis.calendar.auth

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import org.json.JSONArray
import ru.genesis.calendar.BuildConfig
import ru.genesis.calendar.data.LocalCipher
import java.io.ByteArrayOutputStream
import java.net.URL
import java.util.TimeZone
import java.util.UUID
import javax.net.ssl.HttpsURLConnection

internal open class AuthFailure(val kind: Kind, val httpStatus: Int? = null) : Exception("Authentication request failed") {
    enum class Kind { NOT_DEPLOYED, UNAUTHORIZED, RATE_LIMIT, NETWORK, PROTOCOL, STORAGE, CONFLICT, SERVER }
}
internal class AuthApiError(val code: String) : Exception(code)

internal fun allowedSharedRoute(method: String, path: String): Boolean {
    if (path in setOf("/shared/spaces", "/shared/invitations", "/shared/invitations/accept",
            "/shared/notifications", "/shared/notifications/read")) return method in setOf("GET", "POST")
    if (method == "GET" && path.matches(Regex("/shared/calendar/tasks\\?from=\\d{4}-\\d{2}-\\d{2}&to=\\d{4}-\\d{2}-\\d{2}"))) return true
    if (method == "GET" && path.matches(Regex("/shared/tasks\\?filter=[A-Za-z0-9%+_.~-]+(?:&cursor=[A-Za-z0-9%+_.~-]+)?(?:&sort=(?:position|createdAt|createdAtAsc|dueDate|updatedAt|title|priority))?"))) return true
    if (path == "/shared/notification-settings") return method in setOf("GET", "PUT")
    if (path == "/shared/notification-settings/retry") return method == "POST"
    if (path.matches(Regex("/shared/invitations/[a-f0-9-]{36}"))) return method == "POST"
    if (path == "/shared/task-lists") return method == "GET"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/planning"))) return method in setOf("GET", "PUT")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/workflow"))) return method in setOf("GET", "PUT")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/workflow/history(?:\\?before=[1-9][0-9]{0,9})?"))) return method == "GET"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/planning/sprints"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/planning/sprints/[a-f0-9-]{36}"))) return method == "PATCH"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/planning/sprints/[a-f0-9-]{36}/transition"))) return method == "POST"
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/ui"))) return method in setOf("GET", "PATCH")
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/invitations"))) return method == "POST"
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/projects"))) return method in setOf("GET", "POST")
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/import-project"))) return method == "POST"
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/archived-projects"))) return method == "GET"
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/trash"))) return method == "GET"
    if (path.matches(Regex("/shared/spaces/[a-f0-9-]{36}/members/[A-Za-z0-9_-]{1,100}"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}"))) return method in setOf("GET", "POST")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/google"))) return method in setOf("GET", "POST")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/google/sync"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/(archive|restore)"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/statuses"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/statuses/[a-f0-9-]{36}"))) return method in setOf("POST", "DELETE")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/categories"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/categories/[a-f0-9-]{36}"))) return method in setOf("POST", "DELETE")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/members/[A-Za-z0-9_-]{1,100}"))) return method in setOf("POST", "DELETE")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/(tasks|invitations)"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/tasks/[a-f0-9-]{36}"))) return method in setOf("GET", "POST")
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/tasks/[a-f0-9-]{36}/move"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/tasks/[a-f0-9-]{36}/read"))) return method == "POST"
    if (path.matches(Regex("/shared/projects/[a-f0-9-]{36}/tasks/[a-f0-9-]{36}/comments"))) return method in setOf("GET", "POST")
    return false
}

/** A dedicated, encrypted native cookie jar; never shared with Custom Tabs or the local drafts DB. */
internal class AuthSessionClient(context: Context) {
    private val preferences = context.getSharedPreferences("genesis.native.auth.v1", Context.MODE_PRIVATE)
    private val installationId: String by lazy {
        val install = context.getSharedPreferences("genesis.native.install.v1", Context.MODE_PRIVATE)
        install.getString("id", null) ?: UUID.randomUUID().toString().also {
            install.edit().putString("id", it).apply()
        }
    }
    private val cipher = LocalCipher()
    // The encryption context stays stable when the service moves to another domain.
    private val aad = "genesis.native.auth.v2"
    private val legacyAad = "genesis.native.auth.v1|https://genesiscalendar.ru"
    private val guard = Any()
    private var generation = 0L
    private var loaded = false
    private var session = SessionSecret("", 0, "")
    private val connections = mutableSetOf<HttpsURLConnection>()

    fun begin(): Long {
        val (next, obsolete) = synchronized(guard) { ++generation to connections.toList() }
        // Cancel the actual socket too: a superseded slow Google pull must not
        // hold the account's import lock until its read timeout expires.
        obsolete.forEach { runCatching { it.disconnect() } }
        return next
    }
    fun currentGeneration(): Long = synchronized(guard) { generation }
    fun isCurrent(expected: Long): Boolean = synchronized(guard) { generation == expected }

    private fun check(expected: Long) {
        if (generation != expected) throw CancellationException("Authentication operation superseded")
    }

    private fun load(expected: Long): SessionSecret = synchronized(guard) {
        check(expected)
        if (!loaded) {
            try {
                preferences.getString("session", null)?.let {
                    val plain = runCatching { cipher.decrypt(it, aad) }
                        .getOrElse { _ -> cipher.decrypt(it, legacyAad) }
                    val saved = JSONObject(plain)
                    val value = saved.getString("cookie")
                    require(value.matches(Regex("[A-Za-z0-9,-]{16,256}")))
                    session = SessionSecret(value, saved.getLong("expiresAt"), AuthProtocol.csrf(saved.getString("csrf")))
                }
                loaded = true
            } catch (_: Exception) {
                session = SessionSecret("", 0, "")
                loaded = true
                preferences.edit().remove("session").commit()
                throw AuthFailure(AuthFailure.Kind.STORAGE)
            }
        }
        if (session.expiresAt <= System.currentTimeMillis()) session = SessionSecret("", 0, "")
        session
    }

    private fun save(expected: Long, value: SessionSecret) = synchronized(guard) {
        check(expected)
        try {
            val editor = preferences.edit()
            if (value.cookie.isBlank() || value.csrf.isBlank()) editor.remove("session")
            else editor.putString("session", cipher.encrypt(JSONObject().put("cookie", value.cookie)
                .put("expiresAt", value.expiresAt).put("csrf", value.csrf).toString(), aad))
            if (!editor.commit()) throw AuthFailure(AuthFailure.Kind.STORAGE)
            session = value
            loaded = true
        } catch (error: Exception) {
            session = SessionSecret("", 0, "")
            preferences.edit().remove("session").commit()
            throw if (error is AuthFailure) error else AuthFailure(AuthFailure.Kind.STORAGE)
        }
    }

    fun clear(expected: Long) = save(expected, SessionSecret("", 0, ""))

    /** Returns the old secret only to revoke that same server session after local logout. */
    fun takeForLogout(expected: Long): SessionSecret {
        val old = load(expected)
        clear(expected)
        return old
    }

    fun session(expected: Long): JSONObject = request(expected, "/session", null)
    fun providers(expected: Long): JSONObject = request(expected, "/auth/providers", null)
    fun workspace(expected: Long): JSONObject = request(expected, "/workspace", null)
    fun habitReminderStatus(expected: Long): JSONObject = request(expected, "/habit-reminders/status", null)
    fun mindmaps(expected: Long, path:String, body:JSONObject?=null):JSONObject = request(expected,path,body,method=if(body==null)"GET" else "PUT")
    fun putWorkspace(expected: Long, envelope: JSONObject): JSONObject =
        request(expected, "/workspace", envelope, method = "PUT")
    fun bootstrap(expected: Long): JSONObject = request(expected, "/bootstrap", null)
    /** Account entry must not wait for Google task-list enumeration. */
    fun accountBootstrap(expected: Long, verifiedSession: JSONObject): JSONObject =
        JSONObject(verifiedSession.toString())
            .put("workspace", workspace(expected).getJSONObject("workspace"))
            .put("tasks", JSONArray()).put("tasksDeferred", true)
    fun stoicheionDraws(expected: Long): JSONObject = request(expected, "/stoicheion/draws", null)
    fun saveStoicheionDraw(expected: Long, kind: String, seed: Long): JSONObject {
        require(kind in setOf("daily", "spread"))
        require(seed in 0..0xffff_ffffL)
        return request(expected, "/stoicheion/draws", JSONObject().put("kind", kind).put("seed", seed))
    }
    fun putTask(expected: Long, id: String, task: JSONObject): JSONObject {
        val creation=if(task.optBoolean("mindmapCreateOnly")) task.optJSONObject("mindmapCreationPayload") ?: task else task
        val mutation = CloudTaskIdentity.mutation(id, creation)
        if(task.optBoolean("mindmapCreateOnly")) mutation.body.put("createOnly",true)
        return mutation.confirmed(request(expected, "/tasks/${mutation.remoteId}", mutation.body, method = "PUT"))
    }
    fun deleteTask(expected: Long, id: String, task: JSONObject): JSONObject {
        val mutation = CloudTaskIdentity.mutation(id, task)
        return request(expected, "/tasks/${mutation.remoteId}", mutation.body, method = "DELETE")
    }
    fun createTaskList(expected: Long, title: String, accountId: String): JSONObject {
        require(title.trim().length in 1..300 && accountId.matches(Regex("[A-Za-z0-9_-]{1,100}")))
        return request(expected, "/task-lists", JSONObject().put("title", title.trim()).put("accountId", accountId))
    }
    fun updateTaskList(expected: Long, id: String, title: String, accountId: String): JSONObject {
        require(id.isNotBlank() && id.length <= 500 && title.trim().length in 1..300)
        return request(expected, "/task-lists/${android.net.Uri.encode(id)}",
            JSONObject().put("title",title.trim()).put("accountId",accountId),method="PATCH")
    }
    fun deleteTaskList(expected: Long, id: String, accountId: String): JSONObject {
        require(id.isNotBlank() && id.length <= 500)
        return request(expected, "/task-lists/${android.net.Uri.encode(id)}",
            JSONObject().put("accountId",accountId),method="DELETE")
    }
    fun challenge(expected: Long): JSONObject = request(expected, "/auth/google/native/challenge", JSONObject())
    fun googleServicesConfig(expected: Long): JSONObject =
        request(expected, "/auth/google/native/services/config", JSONObject())
    fun authorizeGoogleServices(expected: Long, serverAuthCode: String): JSONObject {
        require(serverAuthCode.length in 1..8192)
        return request(expected, "/auth/google/native/services",
            JSONObject().put("serverAuthCode", serverAuthCode))
    }
    fun updateRouting(expected: Long, routing: SyncRouting): JSONObject =
        request(expected, "/account/preferences", JSONObject().put("syncRouting", routing.toJson()), method = "PUT")
    fun updatePreferences(expected: Long, changes: JSONObject): JSONObject =
        request(expected, "/account/preferences", changes, method = "PUT")
    fun sharedSpaceUi(expected: Long, spaceId: String): JSONObject =
        request(expected, "/shared/spaces/$spaceId/ui", null)
    fun saveSharedSpaceUi(expected: Long, spaceId: String, ids: List<String>): JSONObject =
        request(expected, "/shared/spaces/$spaceId/ui", JSONObject().put("expandedIds", JSONArray(ids)), method = "PATCH")
    fun inviteSharedSpaceMember(expected: Long, spaceId: String, email: String, role: String): JSONObject =
        request(expected, "/shared/spaces/$spaceId/invitations", JSONObject().put("email", email).put("role", role))
    fun sharedSpaces(expected: Long): JSONObject = request(expected, "/shared/spaces", null)
    fun sharedTaskLists(expected: Long): JSONObject = request(expected, "/shared/task-lists", null)
    fun sharedCalendarTasks(expected: Long, from: String, to: String): JSONObject =
        request(expected, "/shared/calendar/tasks?from=$from&to=$to", null)
    fun createSharedSpace(expected: Long, body: JSONObject): JSONObject =
        request(expected, "/shared/spaces", body)
    fun sharedProjects(expected: Long, spaceId: String): JSONObject =
        request(expected, "/shared/spaces/$spaceId/projects", null)
    fun archivedSharedProjects(expected: Long, spaceId: String): JSONObject =
        request(expected, "/shared/spaces/$spaceId/archived-projects", null)
    fun createSharedProject(expected: Long, spaceId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/spaces/$spaceId/projects", body)
    fun importSharedProject(expected: Long, spaceId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/spaces/$spaceId/import-project", body)
    fun querySharedTasks(expected: Long, filter: JSONObject, cursor: String?,sort:String="position"): JSONObject {
        val query = java.net.URLEncoder.encode(filter.toString(), "UTF-8")
        val continuation = cursor?.let { "&cursor=" + java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        return request(expected, "/shared/tasks?filter=$query$continuation&sort=${java.net.URLEncoder.encode(sort,"UTF-8")}", null)
    }
    fun readSharedTaskUpdates(expected:Long,projectId:String,taskId:String,commentIds:List<String>):JSONObject=
        request(expected,"/shared/projects/$projectId/tasks/$taskId/read",JSONObject().put("commentIds",org.json.JSONArray(commentIds)))
    fun notificationSettings(expected:Long):JSONObject=request(expected,"/shared/notification-settings",null)
    fun saveNotificationSettings(expected:Long,settings:JSONObject,revision:Int):JSONObject=
        request(expected,"/shared/notification-settings",JSONObject().put("settings",settings).put("expectedRevision",revision),method="PUT")
    fun sharedTask(expected: Long, projectId: String, taskId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks/$taskId", null)
    fun sharedProject(expected: Long, projectId: String): JSONObject =
        request(expected, "/shared/projects/$projectId", null)
    fun sharedPlanning(expected: Long, projectId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/planning", null)
    fun sharedWorkflow(expected: Long, projectId: String): JSONObject = request(expected, "/shared/projects/$projectId/workflow", null)
    fun sharedWorkflowRepairProjects(expected: Long, spaceId: String): JSONObject = request(expected, "/shared/spaces/$spaceId/trash", null)
    fun sharedWorkflowHistory(expected: Long, projectId: String, before: Long?): JSONObject =
        request(expected, "/shared/projects/$projectId/workflow/history" + (before?.let { "?before=$it" } ?: ""), null)
    fun saveSharedWorkflow(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/workflow", body, method = "PUT")
    fun sharedPlanningCommand(expected: Long, projectId: String, command: JSONObject): JSONObject {
        val path = "/shared/projects/$projectId/planning"
        val body = command.getJSONObject("body")
        return when (command.getString("kind")) {
            "settings" -> request(expected, path, body, method = "PUT")
            "sprint" -> if (command.isNull("sprintId")) request(expected, "$path/sprints", body)
                else request(expected, "$path/sprints/${command.getString("sprintId")}", body, method = "PATCH")
            "transition" -> request(expected, "$path/sprints/${command.getString("sprintId")}/transition", body)
            else -> throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        }
    }
    fun sharedGoogleSettings(expected: Long, projectId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/google", null)
    fun updateSharedGoogleSettings(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/google", body)
    fun syncSharedGoogle(expected: Long, projectId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/google/sync", JSONObject())
    fun updateSharedProject(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId", body)
    fun setSharedProjectArchived(expected: Long, projectId: String, archived: Boolean): JSONObject =
        request(expected, "/shared/projects/$projectId/${if (archived) "archive" else "restore"}", JSONObject())
    fun createSharedStatus(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/statuses", body)
    fun updateSharedStatus(expected: Long, projectId: String, statusId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/statuses/$statusId", body)
    fun deleteSharedStatus(expected: Long, projectId: String, statusId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/statuses/$statusId", body, method = "DELETE")
    fun createSharedCategory(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/categories", body)
    fun updateSharedCategory(expected: Long, projectId: String, categoryId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/categories/$categoryId", body)
    fun deleteSharedCategory(expected: Long, projectId: String, categoryId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/categories/$categoryId", body, method = "DELETE")
    fun changeSharedMemberRole(expected: Long, projectId: String, userId: String, role: String): JSONObject =
        request(expected, "/shared/projects/$projectId/members/$userId", JSONObject().put("role", role))
    fun changeSharedSpaceRole(expected: Long, spaceId: String, userId: String, role: String,
        canOrganizeTasks: Boolean? = null): JSONObject =
        request(expected, "/shared/spaces/$spaceId/members/$userId", JSONObject().put("role", role).apply {
            if (canOrganizeTasks != null) put("canOrganizeTasks", canOrganizeTasks)
        })
    fun removeSharedMember(expected: Long, projectId: String, userId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/members/$userId", JSONObject(), method = "DELETE")
    fun createSharedTask(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks", body)
    fun updateSharedTask(expected: Long, projectId: String, taskId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks/$taskId", body)
    fun moveSharedTask(expected: Long, projectId: String, taskId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks/$taskId/move", body)
    fun inviteSharedMember(expected: Long, projectId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/invitations", body)
    fun acceptSharedInvitation(expected: Long, body: JSONObject): JSONObject =
        request(expected, "/shared/invitations/accept", body)
    fun sharedInvitations(expected: Long): JSONObject = request(expected, "/shared/invitations", null)
    fun sharedNotifications(expected: Long): JSONObject = request(expected, "/shared/notifications", null)
    fun readSharedNotifications(expected: Long, eventIds: JSONArray): JSONObject =
        request(expected, "/shared/notifications/read", JSONObject().put("eventIds", eventIds))
    fun rejectSharedInvitation(expected: Long, id: String): JSONObject =
        request(expected, "/shared/invitations/$id", JSONObject())
    fun sharedComments(expected: Long, projectId: String, taskId: String): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks/$taskId/comments", null)
    fun addSharedComment(expected: Long, projectId: String, taskId: String, body: JSONObject): JSONObject =
        request(expected, "/shared/projects/$projectId/tasks/$taskId/comments", body)
    fun adminStats(expected: Long): JSONObject = request(expected, "/admin/stats", null)
    fun recordFeatureUsage(expected: Long, features: List<String>): JSONObject =
        request(expected, "/feature-usage", JSONObject().put("platform", "android")
            .put("features", JSONArray(features)))
    fun todayAds(expected: Long, language: String, country: String): JSONObject {
        require(language.matches(Regex("[a-z]{2}")) && country.matches(Regex("[A-Z]{0,2}")))
        return request(expected, "/ads/today?language=$language&country=$country&platform=android", null)
    }
    fun deleteAdminUser(expected: Long, userId: String, blacklist: Boolean): JSONObject {
        require(userId.matches(Regex("[A-Za-z0-9_-]{1,100}")))
        return request(expected, "/admin/users/$userId", JSONObject().put("blacklist", blacklist), method = "DELETE")
    }
    fun removeLinkedAccount(expected: Long, accountId: String): JSONObject {
        require(accountId.matches(Regex("[A-Za-z0-9_-]{1,100}")))
        return request(expected, "/account/google-accounts/$accountId", JSONObject(), method = "DELETE")
    }
    fun authenticate(expected: Long, idToken: String): JSONObject {
        require(idToken.length in 1..16384)
        return request(expected, "/auth/google/native", JSONObject().put("idToken", idToken))
    }
    fun authenticateYandex(expected: Long, accessToken: String): JSONObject {
        require(accessToken.length in 1..16384)
        return request(expected, "/auth/yandex/native", JSONObject().put("accessToken", accessToken))
    }
    fun connectYandexCalendar(expected: Long, accessToken: String, expiresIn: Long, accountId: String? = null): JSONObject =
        request(expected, "/account/yandex-calendar/connect",
            JSONObject().put("accessToken", accessToken).put("expiresIn", expiresIn).put("accountId", accountId))
    fun disconnectYandexCalendar(expected: Long, accountId: String? = null): JSONObject =
        request(expected, "/account/yandex-calendar/disconnect", JSONObject().put("accountId", accountId))

    fun revoke(expected: Long, old: SessionSecret) {
        if (old.cookie.isBlank() || old.csrf.isBlank()) return
        request(expected, "/auth/logout", JSONObject(), old, persist = false)
    }

    /** Blocking; the controller always calls on Dispatchers.IO. Default platform TLS verification. */
    private fun request(expected: Long, path: String, body: JSONObject?, secret: SessionSecret? = null,
        persist: Boolean = true, method: String = if (body == null) "GET" else "POST"): JSONObject {
        require(path in setOf("/session", "/auth/providers", "/workspace", "/bootstrap", "/stoicheion/draws", "/auth/google/native/challenge",
            "/auth/yandex/native",
            "/account/yandex-calendar/connect", "/account/yandex-calendar/disconnect",
            "/auth/google/native", "/auth/google/native/services/config", "/auth/google/native/services",
            "/auth/logout", "/account/preferences", "/admin/stats", "/feature-usage") ||
            (method == "GET" && path.matches(Regex("/ads/today\\?language=[a-z]{2}&country=[A-Z]{0,2}&platform=android"))) ||
            (path == "/task-lists" && method == "POST") ||
            (method in setOf("PATCH", "DELETE") && path.matches(Regex("/task-lists/[A-Za-z0-9_%.-]{1,1500}"))) ||
            (method in setOf("PUT", "DELETE") && path.matches(Regex("/tasks/[A-Za-z0-9_-]{1,100}"))) ||
            (method == "DELETE" && path.matches(Regex("/admin/users/[A-Za-z0-9_-]{1,100}"))) ||
            (method == "DELETE" && path.matches(Regex("/account/google-accounts/[A-Za-z0-9_-]{1,100}"))) ||
            (method in setOf("GET","PUT") && path.matches(Regex("/mindmaps(?:/[A-Za-z0-9_-]{1,100}(?:/history)?)?"))) || allowedSharedRoute(method, path))
        require(method in setOf("GET", "POST", "PUT", "PATCH", "DELETE") && (method == "GET") == (body == null))
        val current = secret ?: load(expected)
        if (body != null && (current.cookie.isBlank() || current.csrf.isBlank())) throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val connection = URL("$AUTH_ORIGIN/api$path").openConnection() as HttpsURLConnection
        synchronized(guard) { check(expected); connections += connection }
        var phase = "prepare"
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = if (path == "/bootstrap") 120_000 else 30_000
            connection.useCaches = false
            connection.requestMethod = method
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            connection.setRequestProperty("X-Genesis-Time-Zone", TimeZone.getDefault().id)
            connection.setRequestProperty("X-Genesis-App-Version", BuildConfig.VERSION_NAME)
            connection.setRequestProperty("X-Genesis-Installation-Id", installationId)
            if (current.cookie.isNotBlank()) connection.setRequestProperty("Cookie", "$SESSION_COOKIE=${current.cookie}")
            if (body != null) {
                connection.setRequestProperty("X-CSRF-Token", current.csrf)
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                connection.setFixedLengthStreamingMode(bytes.size)
                synchronized(guard) { check(expected) }
                phase = "write"
                connection.outputStream.use { it.write(bytes) }
            }
            synchronized(guard) { check(expected) }
            phase = "status"
            val status = connection.responseCode
            if (status !in 200..299) {
                if (path.startsWith("/shared/") && status in 400..499 && status !in setOf(401, 403, 404, 405, 429) && !path.contains("/planning") && !path.contains("/invitations")) {
                    val failure = runCatching {
                        val output = ByteArrayOutputStream()
                        connection.errorStream?.use { input ->
                            val buffer = ByteArray(1024)
                            while (output.size() < 8192) {
                                val count = input.read(buffer, 0, minOf(buffer.size, 8192 - output.size()))
                                if (count < 0) break
                                output.write(buffer, 0, count)
                            }
                        }
                        workflowFailure(status, JSONObject(output.toString(Charsets.UTF_8.name())))
                    }.getOrNull()
                    if (failure != null) throw failure
                }
                if (method != "GET" && path.contains("/planning") && status in 400..499 && status !in setOf(401, 403, 404, 405, 429)) {
                    val code = runCatching {
                        val output = ByteArrayOutputStream()
                        connection.errorStream?.use { input ->
                            val buffer = ByteArray(1024)
                            while (output.size() < 8192) {
                                val count = input.read(buffer, 0, minOf(buffer.size, 8192 - output.size()))
                                if (count < 0) break
                                output.write(buffer, 0, count)
                            }
                        }
                        JSONObject(output.toString(Charsets.UTF_8.name())).optString("error")
                    }.getOrDefault("")
                    if (code in PlanningJournal.DEFINITIVE_ERRORS) throw AuthApiError(code)
                }
                if (path.contains("/invitations")) {
                    val code = runCatching { JSONObject(connection.errorStream?.bufferedReader()?.use { it.readText() }
                        ?: "{}").optString("error") }.getOrDefault("")
                    if (code in setOf("INVITEE_ACCOUNT_UNSUPPORTED", "INVITEE_ACCOUNT_NOT_FOUND",
                            "ALREADY_PROJECT_MEMBER", "INVALID_INVITATION")) throw AuthApiError(code)
                }
                throw AuthFailure(when (status) {
                    404, 405 -> AuthFailure.Kind.NOT_DEPLOYED
                    401, 403 -> AuthFailure.Kind.UNAUTHORIZED
                    429 -> AuthFailure.Kind.RATE_LIMIT
                    409 -> AuthFailure.Kind.CONFLICT
                    in 300..399 -> AuthFailure.Kind.PROTOCOL
                    else -> AuthFailure.Kind.SERVER
                }, httpStatus = status)
            }
            if (!connection.contentType.orEmpty().substringBefore(';').trim().equals("application/json", true))
                throw AuthFailure(AuthFailure.Kind.PROTOCOL)
            val output = ByteArrayOutputStream()
            phase = "read"
            connection.inputStream.use { input ->
                val buffer = ByteArray(4096)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    val maximumBytes = when (path) {
                        "/workspace" -> 11_000_000
                        "/bootstrap" -> 24_000_000
                        "/admin/stats" -> 4_000_000
                        else -> if (path.startsWith("/shared/")) 32_000_000 else if (path.startsWith("/ads/today?")) 4_000_000 else 131_072
                    }
                    if (output.size() + read > maximumBytes) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
                    output.write(buffer, 0, read)
                }
            }
            val payload = JSONObject(output.toString(Charsets.UTF_8.name()))
            if (persist) {
                val headers = connection.headerFields.filterKeys { it?.equals("Set-Cookie", true) == true }.values.flatten()
                val update = AuthProtocol.cookie(headers, System.currentTimeMillis())
                if (update.present && update.value.isBlank()) {
                    clear(expected)
                    throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
                }
                val csrf = if (payload.has("csrf")) AuthProtocol.csrf(payload.getString("csrf")) else current.csrf
                val next = SessionSecret(if (update.present) update.value else current.cookie,
                    if (update.present) update.expiresAt else current.expiresAt, csrf)
                if (next.cookie.isBlank() || next.csrf.isBlank()) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
                save(expected, next)
            }
            synchronized(guard) { check(expected) }
            return payload
        } catch (error: CancellationException) {
            throw error
        } catch (error: AuthFailure) {
            throw error
        } catch (error: AuthApiError) {
            throw error
        } catch (error: java.io.IOException) {
            if (BuildConfig.DEBUG) Log.w("GenesisAuth", "HTTPS transport failed at $path/$phase: ${error.javaClass.simpleName}")
            throw AuthFailure(AuthFailure.Kind.NETWORK)
        } catch (_: Exception) {
            throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        } finally {
            synchronized(guard) { connections -= connection }
            connection.disconnect()
        }
    }
}
