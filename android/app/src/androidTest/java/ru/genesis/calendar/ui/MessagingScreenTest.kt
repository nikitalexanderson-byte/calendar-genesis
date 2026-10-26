package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.captureNativeWindow
import ru.genesis.calendar.auth.MessagingGateway
import ru.genesis.calendar.data.*
import ru.genesis.calendar.security.*
import java.io.File

private class MessagingUiStore : MessagingStore {
    val rows = mutableMapOf<String, String>(); private val cipher = LocalCipher()
    override suspend fun read(key: String) = rows[key]?.let { cipher.decrypt(it, "messages-ui:$key") }
    override suspend fun write(key: String, value: String) { rows[key] = cipher.encrypt(value, "messages-ui:$key") }
    override suspend fun delete(key: String) { rows.remove(key) }
}
private class MessagingUiGateway : MessagingGateway {
    var registered: JSONObject? = null
    val peer = MessagingCrypto.createIdentity()
    val space = "10000000-0000-0000-0000-000000000001"; val conversation = "20000000-0000-0000-0000-000000000002"
    val messages = mutableListOf<JSONObject>()
    override fun check() = Unit
    override suspend fun request(method: String, path: String, body: JSONObject?): JSONObject {
        if (path == "/shared/messaging/key") {
            if (body != null) registered = body.getJSONObject("publicKey")
            return JSONObject().put("keyId", registered?.let(MessagingCrypto::fingerprint) ?: JSONObject.NULL).put("publicKey", registered ?: JSONObject.NULL)
        }
        if (path == "/shared/messaging/inbox") return JSONObject().put("conversations", JSONArray().put(JSONObject().put("id", conversation).put("spaceId", space).put("peerId", "peer").put("peerName", "Анна — длинное имя собеседника").put("spaceTitle", "Семейные планы"))).put("invitations", JSONArray())
        if (path.endsWith("/participants")) return JSONObject().put("members", JSONArray().put(JSONObject().put("userId", "peer").put("displayName", "Анна — длинное имя собеседника").put("viewing", true).put("keyId", peer.keyId).put("publicKey", JSONObject(peer.publicJson))))
        if (path.endsWith("/private-conversations")) return JSONObject().put("id", conversation).put("status", "accepted").put("initiatorId", "owner")
        if ("/messages?" in path) return JSONObject().put("messages", JSONArray(messages)).put("nextCursor", JSONObject.NULL)
        if (path.endsWith("/read")) return JSONObject().put("ok", true)
        if (method == "POST" && path.endsWith("/messages")) {
            val id = body!!.getString("id")
            if (messages.none { it.getString("id") == id }) messages += JSONObject().put("id", id).put("seq", messages.size + 1).put("senderId", "owner").put("revision", 1).put("deletedAt", JSONObject.NULL).put("payload", body.getJSONObject("payload"))
            return JSONObject().put("ok", true).put("id", id)
        }
        error("Unexpected fixture route")
    }
}

/** Synthetic account only. No production requests, account cookies or user data. */
class MessagingScreenTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()
    private val store = MessagingUiStore(); private val gateway = MessagingUiGateway()
    private val repository = MessagingRepository("owner", gateway, store)
    private val width get() = InstrumentationRegistry.getArguments().getString("genesisWidth")?.toIntOrNull() ?: 390
    private val dark get() = InstrumentationRegistry.getArguments().getString("genesisEvening") == "true"
    @Composable private fun Content() {
        val scale = InstrumentationRegistry.getArguments().getString("genesisFontScale")?.toFloatOrNull() ?: LocalDensity.current.fontScale
        val density = Density(compose.activity.resources.displayMetrics.widthPixels.toFloat() / width, scale)
        CompositionLocalProvider(LocalDensity provides density, LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
            MaterialTheme(colorScheme = if (dark) evening else standart, typography = GenesisTypography, shapes = GenesisShapes) {
                Surface(Modifier.fillMaxSize()) {
                    MobileWorkspaceShell("Сообщения", null, emptyList(), "Synthetic fixture", true,
                        onNavigate = {}, actions = {
                            CalendarModeSwitcher(ru.genesis.calendar.domain.CalendarMode.PROFANE, {}, size = 48.dp)
                            WorkspaceHeaderButton("Обновить аккаунт", "today-refresh", onClick = {}) { GenesisLucideIcon("refresh-cw") }
                        }) { MessagingScreen(repository, onClose = {}) }
                }
            }
        }
    }
    private fun capture(name: String) {
        compose.waitForIdle()
        captureNativeWindow(File(compose.activity.getExternalFilesDir(null),
            "messaging-$width-${if (dark) "dark" else "light"}-$name.png"))
    }
    @Test fun inboxChatEncryptedDraftSendAndSecurityCode() {
        compose.setContent { Content() }
        compose.waitUntil(20_000) { repository.state.value.conversations.isNotEmpty() }
        capture("inbox")
        compose.onNodeWithText("Анна — длинное имя собеседника").performClick()
        compose.waitUntil(20_000) { repository.state.value.accepted && compose.onAllNodesWithTag("messaging-composer").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("messaging-composer").performTextReplacement("Встречаемся завтра у библиотеки. Личная заметка 🔒")
        compose.waitUntil(20_000) { repository.state.value.draft?.text?.contains("библиотеки") == true }
        assertFalse(store.rows.values.any { it.contains("библиотеки") })
        compose.onNodeWithTag("messaging-send").performClick()
        compose.waitUntil(20_000) { repository.state.value.messages.size == 1 && !repository.state.value.pending }
        compose.onNodeWithText("Встречаемся завтра у библиотеки. Личная заметка 🔒").assertExists()
        capture("chat")
        compose.onNodeWithContentDescription("Действия").performClick(); compose.onNodeWithText("Код безопасности").performClick()
        compose.onNodeWithText(repository.state.value.securityCode!!).assertExists()
        assertFalse(gateway.messages.single().toString().contains("библиотеки"))
    }
    @Test fun missingLocalKeyShowsRestoreWithoutReplacingRegisteredKey() {
        gateway.registered = JSONObject(gateway.peer.publicJson)
        compose.setContent { Content() }
        compose.waitUntil(20_000) { repository.state.value.restoreRequired }
        compose.onNodeWithText("Восстановите ключ сообщений").assertExists()
        compose.onNodeWithText("Импортировать ключ").performClick()
        compose.onNodeWithText("Пароль: не менее 12 символов").assertExists()
        compose.onNodeWithText("Восстановить").assertIsNotEnabled()
        assertEquals(gateway.peer.keyId, MessagingCrypto.fingerprint(gateway.registered!!)); assertNull(store.rows["identity"])
        capture("restore")
    }
}
