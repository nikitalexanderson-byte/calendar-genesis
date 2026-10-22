package ru.genesis.calendar

import android.os.ParcelFileDescriptor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.auth.AuthPanelState
import ru.genesis.calendar.auth.ServerIdentity
import ru.genesis.calendar.ui.LocalEveningTheme
import ru.genesis.calendar.ui.LocalGenesisLanguage
import ru.genesis.calendar.ui.WelcomeScreen
import ru.genesis.calendar.ui.evening
import ru.genesis.calendar.ui.standart

/** No real account, session, or provider permissions are changed by these UI transitions. */
class WelcomeRecoveryUiTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun statusAndRetryRemainVisibleAcrossAuthTransitions() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val args = InstrumentationRegistry.getArguments()
        val captureOnly = args.getString("genesisWelcomeBefore") == "true"
        val dark = args.getString("genesisDark") == "true"
        val language = args.getString("genesisLanguage") ?: "en"
        val config = compose.activity.resources.configuration
        args.getString("genesisExpectedWidth")?.toInt()?.let {
            assertEquals("The system must apply the requested viewport", it, config.screenWidthDp)
        }
        args.getString("genesisExpectedFontScale")?.toFloat()?.let {
            assertEquals("The system must apply the requested font scale", it, config.fontScale, .01f)
        }
        val folder = File(app.getExternalFilesDir(null), "welcome-recovery").apply { mkdirs() }
        var state by mutableStateOf(AuthPanelState())
        compose.setContent {
            CompositionLocalProvider(LocalGenesisLanguage provides language, LocalEveningTheme provides dark) {
                MaterialTheme(colorScheme = if (dark) evening else standart) {
                    WelcomeScreen(state, AuthController.get(app), language) {}
                }
            }
        }
        val cases = listOf(
            Triple("waiting", AuthPanelState(busy = true, message = "Готовим защищённый вход…"),
                "Preparing secure sign-in…"),
            // A canceled or failed first sign-in still has checkedAt=null.
            Triple("canceled", AuthPanelState(message = "Вход отменён. Локальные записи не изменены."),
                "Sign-in was canceled. Local records were not changed."),
            Triple("network", AuthPanelState(message = "Нет подтверждения от сервера. Проверьте сеть и повторите."),
                "The server did not confirm the request. Check your connection and try again."),
            Triple("cloud-retry", AuthPanelState(user = ServerIdentity("welcome-qa", "QA", "qa@example.invalid"),
                checkedAt = 1, message = "Вход выполнен, но загрузка облачных данных пока не завершилась. Локальные записи сохранены."),
                "You are signed in, but cloud data has not finished loading. Local records are preserved."),
        )
        val metrics = JSONArray()
        for ((scene, next, english) in cases) {
            compose.runOnIdle { state = next }
            compose.waitForIdle()
            val expected = if (language == "en") english else next.message
            val status = compose.onNodeWithTag("welcome-status")
            val action = compose.onNodeWithTag("welcome-google-sign-in")
            val web = compose.onNodeWithTag("welcome-open-web")
            val painted = CountDownLatch(1)
            compose.activity.runOnUiThread { compose.activity.window.decorView.postOnAnimation {
                compose.activity.window.decorView.postOnAnimation { painted.countDown() }
            } }
            assertTrue(painted.await(5, TimeUnit.SECONDS))
            instrumentation.waitForIdleSync()
            val name = "${if (captureOnly) "before" else "after"}-${config.screenWidthDp}-$language-${if (dark) "dark" else "light"}-font${(config.fontScale * 100).toInt()}-$scene"
            val pixels = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("screencap -p"))
                .use { it.readBytes() }
            File(folder, "$name.png").writeBytes(pixels)
            if (!captureOnly) {
                status.assertTextEquals(expected).assertIsDisplayed()
                action.assertIsDisplayed()
                web.assertIsDisplayed()
                if (next.busy) action.assertIsNotEnabled() else action.assertIsEnabled()
                val root = compose.onNodeWithTag("genesis-welcome").fetchSemanticsNode().boundsInRoot
                val message = status.fetchSemanticsNode().boundsInRoot
                val button = action.fetchSemanticsNode().boundsInRoot
                val website = web.fetchSemanticsNode().boundsInRoot
                File(folder, "$name.bounds.txt").writeText("root=$root\nstatus=$message\nbutton=$button\nweb=$website")
                assertTrue("Status must be fully visible before the sign-in action: root=$root status=$message button=$button", message.top + 1 >= root.top && message.bottom <= button.top + 1)
                assertTrue("Retry and web actions must stay inside the first viewport: root=$root button=$button web=$website", button.bottom <= root.bottom + 1 && website.bottom <= root.bottom + 1)
                assertTrue("The sign-in control must keep its 48dp touch height", button.height + 1 >= 48 * action.fetchSemanticsNode().layoutInfo.density.density)
                metrics.put(JSONObject().put("scene", scene).put("status", message.toString())
                    .put("button", button.toString()).put("root", root.toString()))
            }
        }
        if (!captureOnly) {
            // The last trust line can still be reached with the measured action area present.
            val lastLine = compose.onNodeWithText(if (language == "en") "Private data opens only after sign-in"
                else "Личные данные открываются только после входа").performScrollTo().assertIsDisplayed()
            assertTrue("The actions must not cover the end of the scrollable content",
                lastLine.fetchSemanticsNode().boundsInRoot.bottom <= compose.onNodeWithTag("welcome-actions").fetchSemanticsNode().boundsInRoot.top + 1)
        }
        File(folder, "${if (captureOnly) "before" else "after"}-${config.screenWidthDp}-$language-${if (dark) "dark" else "light"}-font${(config.fontScale * 100).toInt()}.json")
            .writeText(JSONObject().put("widthDp", config.screenWidthDp).put("fontScale", config.fontScale)
                .put("language", language).put("dark", dark).put("checks", metrics)
                .put("actualDensity", compose.onNodeWithTag("genesis-welcome").fetchSemanticsNode().layoutInfo.density.density)
                .put("root", compose.onNodeWithTag("genesis-welcome").fetchSemanticsNode().boundsInWindow.toString()).toString())
    }
}
