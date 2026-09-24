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
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun experimentalTodayAndCalendarExposeWebDayDetails() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { prefs.values.first() }
        try {
            runBlocking { prefs.set("theme", "Experimental"); prefs.set("display", "sacred") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Experimental").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("today-day-rhythm").assertExists()
            val todayImage = File(app.getExternalFilesDir(null), "today-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(todayImage))
            compose.onNodeWithTag("day-rhythm-expand").performScrollTo().performClick()
            compose.onNodeWithText("Двенадцать двухчасовых периодов").assertExists()
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("day-knowledge"))
            compose.onNodeWithTag("day-knowledge").assertExists()
            compose.onNodeWithText("Календарь").performScrollTo().performClick()
            compose.onNodeWithTag("pyata-1").performScrollTo().performClick()
            compose.onNodeWithText("Явление идеи.", substring = true).assertExists()
            compose.onNodeWithTag("calendar-day-2026-09-23").performScrollTo().performClick()
            compose.onNodeWithTag("calendar-selected-day").assertExists()
            compose.onAllNodesWithText("Осеннее равноденствие", substring = true).onLast().assertExists()
            val image = File(app.getExternalFilesDir(null), "calendar-selected-day-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(image))
        } finally {
            runBlocking { prefs.set("theme", original.theme); prefs.set("display", original.display.wireValue) }
        }
    }
}
