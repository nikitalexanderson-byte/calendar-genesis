package ru.genesis.calendar.auth

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AuthProtocolTest {
    private val sessionId = "abcdefghijklmnopqrstuvwx12"
    private val now = 1_800_000_000_000L
    private fun header(extra: String = "") = "$SESSION_COOKIE=$sessionId; Path=/; Secure; HttpOnly$extra"

    @Test fun nativeCookieAcceptsSecureSameOriginAndHonorsBoundedExpiry() {
        val cookie = AuthProtocol.cookie(listOf(header("; Max-Age=120")), now)
        assertTrue(cookie.present)
        assertEquals(sessionId, cookie.value)
        assertEquals(now + 120_000, cookie.expiresAt)
        assertEquals(now + 30L * 86400 * 1000, AuthProtocol.cookie(listOf(header("; Max-Age=99999999")), now).expiresAt)
    }

    @Test fun nativeCookieRejectsForeignInsecureAndAmbiguousCookies() {
        for (value in listOf(header("; Domain=attacker.example"),
            "$SESSION_COOKIE=$sessionId; Path=/; HttpOnly",
            "$SESSION_COOKIE=$sessionId; Path=/; Secure",
            "$SESSION_COOKIE=$sessionId; Path=/api; Secure; HttpOnly")) {
            assertThrows(IllegalArgumentException::class.java) { AuthProtocol.cookie(listOf(value), now) }
        }
        assertThrows(IllegalArgumentException::class.java) { AuthProtocol.cookie(listOf(header(), header()), now) }
        assertFalse(AuthProtocol.cookie(listOf("unrelated=123; Secure; HttpOnly; Path=/"), now).present)
    }

    @Test fun nativeCookieDeletionDoesNotRetainCredential() {
        val cookie = AuthProtocol.cookie(listOf(header("; Max-Age=0")), now)
        assertTrue(cookie.present)
        assertEquals("", cookie.value)
    }

    @Test fun nullableIdentityIsNotInventedFromGoogleCredentialOrEmail() {
        assertNull(AuthProtocol.identity(JSONObject("""{"user":null}""")))
        val identity = AuthProtocol.identity(JSONObject("""{"user":{"uid":"workspace-fixture","email":"fixture@example.invalid","displayName":"Fixture"}}"""))!!
        assertEquals("workspace-fixture", identity.uid)
        assertThrows(Exception::class.java) { AuthProtocol.identity(JSONObject("""{"email":"fixture@example.invalid"}""")) }
        assertFalse(identity.toString().contains("fixture@example.invalid"))
    }

    @Test fun challengeAndCsrfAreStrictlyValidated() {
        val input = JSONObject().put("nonce", "a".repeat(43)).put("serverClientId", "fixture.apps.googleusercontent.com").put("expiresIn", 300)
        assertEquals("fixture.apps.googleusercontent.com", AuthProtocol.challenge(input).serverClientId)
        input.put("serverClientId", "https://attacker.example")
        assertThrows(IllegalArgumentException::class.java) { AuthProtocol.challenge(input) }
        assertEquals("a".repeat(48), AuthProtocol.csrf("a".repeat(48)))
        assertThrows(IllegalArgumentException::class.java) { AuthProtocol.csrf("bad\r\nheader") }
    }

    @Test fun serviceConfigAndLinkActionAcceptOnlyExpectedValues() {
        val clientId = "fixture.apps.googleusercontent.com"
        assertEquals(clientId, AuthProtocol.serverClientId(JSONObject().put("serverClientId", clientId)))
        assertThrows(IllegalArgumentException::class.java) {
            AuthProtocol.serverClientId(JSONObject().put("serverClientId", "https://attacker.example"))
        }
        assertEquals("found", AuthProtocol.googleLinkAction(JSONObject().put("googleLinkAction", "found")))
        assertEquals("created", AuthProtocol.googleLinkAction(JSONObject().put("googleLinkAction", "created")))
        assertNull(AuthProtocol.googleLinkAction(JSONObject().put("googleLinkAction", "reassigned")))
    }
}
