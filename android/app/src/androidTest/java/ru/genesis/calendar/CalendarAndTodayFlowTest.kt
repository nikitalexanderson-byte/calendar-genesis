package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import androidx.test.uiautomator.UiDevice
import ru.genesis.calendar.data.LocalPreferences

class CalendarAndTodayFlowTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Test fun singleThemeTodayAndCalendarExposeWebDayDetails() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { prefs.values.first() }
        try {
            runBlocking { prefs.set("display", "sacred") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Standart").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("today-day-rhythm").assertExists()
            compose.onNodeWithText("СЕГОДНЯ").assertExists()
            compose.onNodeWithTag("today-hero-copy", useUnmergedTree = true).assertExists()
            compose.onNodeWithTag("today-hero-description", useUnmergedTree = true).assertExists()
            val todayImage = File(app.getExternalFilesDir(null), "today-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(todayImage))
            runBlocking { prefs.set("display", "profane") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("ГРИГОРИАНСКИЙ КАЛЕНДАРЬ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-profane-after.png")))
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-gregorian-summary"))
            compose.onNodeWithTag("today-gregorian-summary").assertIsDisplayed()
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-gregorian-summary-after.png")))
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-hero"))
            runBlocking { prefs.set("display", "lunar") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("ЛУННЫЙ КАЛЕНДАРЬ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-lunar-after.png")))
            runBlocking { prefs.set("display", "sacred") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("МЕСЯЦ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("day-rhythm-expand").performScrollTo().performClick()
            compose.onNodeWithText("Двенадцать двухчасовых периодов").assertExists()
            compose.onNodeWithTag("rhythm-period-12", useUnmergedTree = true).performScrollTo().performClick()
            compose.onNodeWithText("Время «Логоса» Гераклита").assertExists()
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-rhythm-expanded-after.png")))
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("day-knowledge"))
            compose.onNodeWithTag("day-knowledge").assertExists()
            compose.onNodeWithText("Календарь").performScrollTo().performClick()
            compose.onNodeWithTag("pyata-1").performScrollTo().performClick()
            compose.onNodeWithText("Явление идеи.", substring = true).assertExists()
            compose.onNodeWithTag("calendar-day-2026-09-23").performScrollTo().performClick()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Осеннее равноденствие", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("calendar-selected-day").assertExists()
            compose.onAllNodesWithText("Осеннее равноденствие", substring = true).onLast().assertExists()
            val image = File(app.getExternalFilesDir(null), "calendar-selected-day-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(image))
        } finally {
            runBlocking { prefs.set("display", original.display.wireValue) }
        }
    }
}
