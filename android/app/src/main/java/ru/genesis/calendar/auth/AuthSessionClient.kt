package ru.genesis.calendar.auth

import android.content.Context
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import ru.genesis.calendar.data.LocalCipher
import java.io.ByteArrayOutputStream
import java.net.URL
import javax.net.ssl.HttpsURLConnection

internal class AuthFailure(val kind: Kind) : Exception("Authentication request failed") {
    enum class Kind { NOT_DEPLOYED, UNAUTHORIZED, RATE_LIMIT, NETWORK, PROTOCOL, STORAGE, SERVER }
}

/** A dedicated, encrypted native cookie jar; never shared with Custom Tabs or the local drafts DB. */
internal class AuthSessionClient(context: Context) {
    private val preferences = context.getSharedPreferences("genesis.native.auth.v1", Context.MODE_PRIVATE)
    private val cipher = LocalCipher()
    private val aad = "genesis.native.auth.v1|$AUTH_ORIGIN"
    private val guard = Any()
    private var generation = 0L
    private var loaded = false
    private var session = SessionSecret("", 0, "")

    fun begin(): Long = synchronized(guard) { ++generation }
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
    fun challenge(expected: Long): JSONObject = request(expected, "/auth/google/native/challenge", JSONObject())
    fun authenticate(expected: Long, idToken: String): JSONObject {
        require(idToken.length in 1..16384)
        return request(expected, "/auth/google/native", JSONObject().put("idToken", idToken))
    }

    fun revoke(expected: Long, old: SessionSecret) {
        if (old.cookie.isBlank() || old.csrf.isBlank()) return
        request(expected, "/auth/logout", JSONObject(), old, persist = false)
    }

    /** Blocking; the controller always calls on Dispatchers.IO. Default platform TLS verification. */
    private fun request(expected: Long, path: String, body: JSONObject?, secret: SessionSecret? = null, persist: Boolean = true): JSONObject {
        require(path in setOf("/session", "/auth/google/native/challenge", "/auth/google/native", "/auth/logout"))
        val current = secret ?: load(expected)
        if (body != null && (current.cookie.isBlank() || current.csrf.isBlank())) throw AuthFailure(AuthFailure.Kind.UNAUTHORIZED)
        val connection = URL("$AUTH_ORIGIN/api$path").openConnection() as HttpsURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.useCaches = false
            connection.requestMethod = if (body == null) "GET" else "POST"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            if (current.cookie.isNotBlank()) connection.setRequestProperty("Cookie", "$SESSION_COOKIE=${current.cookie}")
            if (body != null) {
                connection.setRequestProperty("X-CSRF-Token", current.csrf)
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                connection.setFixedLengthStreamingMode(bytes.size)
                synchronized(guard) { check(expected) }
                connection.outputStream.use { it.write(bytes) }
            }
            synchronized(guard) { check(expected) }
            val status = connection.responseCode
            if (status !in 200..299) {
                throw AuthFailure(when (status) {
                    404, 405 -> AuthFailure.Kind.NOT_DEPLOYED
                    401, 403 -> AuthFailure.Kind.UNAUTHORIZED
                    429 -> AuthFailure.Kind.RATE_LIMIT
                    in 300..399 -> AuthFailure.Kind.PROTOCOL
                    else -> AuthFailure.Kind.SERVER
                })
            }
            if (!connection.contentType.orEmpty().substringBefore(';').trim().equals("application/json", true))
                throw AuthFailure(AuthFailure.Kind.PROTOCOL)
            val output = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(4096)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (output.size() + read > 131072) throw AuthFailure(AuthFailure.Kind.PROTOCOL)
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
        } catch (_: java.io.IOException) {
            throw AuthFailure(AuthFailure.Kind.NETWORK)
        } catch (_: Exception) {
            throw AuthFailure(AuthFailure.Kind.PROTOCOL)
        } finally {
            connection.disconnect()
        }
    }
}
