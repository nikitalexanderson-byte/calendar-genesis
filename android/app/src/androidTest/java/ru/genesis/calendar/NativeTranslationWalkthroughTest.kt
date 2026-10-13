package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.LocalPreferences

/** Visible navigation paths in a separate debug package; no real accounts or remote writes. */
class NativeTranslationWalkthroughTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Test fun visitMainScreensInEverySupportedLanguage() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val app = instrumentation.targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".notificationqa.debug"))
        check(!app.workspaceScope.startsWith("account-"))
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { prefs.values.first() }
        val languages = listOf("ru","en","el","de","fr","es","it","pt","pl","sr","uk","zh","tr","ja")
        val nativeNames = setOf("Русский", "Српски", "Українська")
        val findings = mutableListOf<String>()
        fun copy(node: SemanticsNode): List<String> =
            node.config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } +
                node.config.getOrNull(SemanticsProperties.ContentDescription).orEmpty() + node.children.flatMap(::copy)
        try {
            runBlocking { prefs.set("display", "sacred") }
            for (language in languages) {
                runBlocking { prefs.set("language", language) }
                compose.waitForIdle()
                Thread.sleep(250)
                fun scan(state: String) {
                    compose.mainClock.advanceTimeBy(1500)
                    compose.waitForIdle()
                    val text = compose.onAllNodes(isRoot(),useUnmergedTree=true).fetchSemanticsNodes().flatMap(::copy).distinct()
                    if (language !in setOf("ru", "sr", "uk")) text.filter {
                        it !in nativeNames && Regex("[А-Яа-яЁё]").containsMatchIn(it)
                    }.forEach { findings.add("$language/$state: $it") }
                }
                for (screen in listOf("Сегодня", "Проекты", "Календарь", "Привычки", "Сакральное", "Настройки")) {
                    compose.onNodeWithTag("navigation-$screen").performClick()
                    compose.waitForIdle()
                    scan(screen)
                    if (screen in setOf("Проекты", "Сакральное")) assertTrue(UiDevice.getInstance(instrumentation).takeScreenshot(
                        File(app.getExternalFilesDir(null), "translation-$language-${if(screen=="Проекты")"projects" else "sacred"}.png")))
                }
                for (section in listOf("appearance","habits","reminders","shared","region","account","links")) {
                    compose.onNodeWithTag("settings-submenu-$section").performClick()
                    scan("settings/$section")
                }
                compose.onNodeWithTag("settings-submenu-appearance").performClick()
                compose.onNodeWithTag("calendar-reference-sacred").performScrollTo().performClick()
                scan("calendar/reference-sacred")
                compose.onNodeWithTag("calendar-reference-close").performClick()
                compose.onNodeWithTag("navigation-Сакральное").performClick()
                compose.onNodeWithTag("submenu-theokyklos").performClick()
                scan("theokyklos")
                println("GENESIS_NATIVE_LOCALE_CHECKED=$language")
            }
            assertTrue(findings.distinct().joinToString("\n"), findings.isEmpty())
        } finally { runBlocking { prefs.set("language", original.language); prefs.set("display", original.display.wireValue) } }
    }
}
