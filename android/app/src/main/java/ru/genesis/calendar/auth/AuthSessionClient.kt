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

internal class AuthFailure(val kind: Kind) : Exception("Authentication request failed") {
    enum class Kind { NOT_DEPLOYED, UNAUTHORIZED, RATE_LIMIT, NETWORK, PROTOCOL, STORAGE, CONFLICT, SERVER }
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
    private val aad = "genesis.native.auth.v1|$AUTH_ORIGIN"
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
                    val saved = JSONObject(cipher.decrypt(it, aad))
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
    fun workspace(expected: Long): JSONObject = request(expected, "/workspace", null)
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
        val mutation = CloudTaskIdentity.mutation(id, task)
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
    fun adminStats(expected: Long): JSONObject = request(expected, "/admin/stats", null)
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

    fun revoke(expected: Long, old: SessionSecret) {
        if (old.cookie.isBlank() || old.csrf.isBlank()) return
        request(expected, "/auth/logout", JSONObject(), old, persist = false)
    }

    /** Blocking; the controller always calls on Dispatchers.IO. Default platform TLS verification. */
    private fun request(expected: Long, path: String, body: JSONObject?, secret: SessionSecret? = null,
        persist: Boolean = true, method: String = if (body == null) "GET" else "POST"): JSONObject {
        require(path in setOf("/session", "/workspace", "/bootstrap", "/stoicheion/draws", "/auth/google/native/challenge",
            "/auth/google/native", "/auth/google/native/services/config", "/auth/google/native/services",
            "/auth/logout", "/account/preferences", "/admin/stats") || (path == "/task-lists" && method == "POST") ||
            (method in setOf("PUT", "DELETE") && path.matches(Regex("/tasks/[A-Za-z0-9_-]{1,100}"))) ||
            (method == "DELETE" && path.matches(Regex("/admin/users/[A-Za-z0-9_-]{1,100}"))) ||
            (method == "DELETE" && path.matches(Regex("/account/google-accounts/[A-Za-z0-9_-]{1,100}"))))
        require(method in setOf("GET", "POST", "PUT", "DELETE") && (method == "GET") == (body == null))
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
                throw AuthFailure(when (status) {
                    404, 405 -> AuthFailure.Kind.NOT_DEPLOYED
                    401, 403 -> AuthFailure.Kind.UNAUTHORIZED
                    429 -> AuthFailure.Kind.RATE_LIMIT
                    409 -> AuthFailure.Kind.CONFLICT
                    in 300..399 -> AuthFailure.Kind.PROTOCOL
                    else -> AuthFailure.Kind.SERVER
                })
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
                        else -> 131_072
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
