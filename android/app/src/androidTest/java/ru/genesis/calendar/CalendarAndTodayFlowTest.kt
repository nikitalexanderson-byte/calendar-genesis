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
import ru.genesis.calendar.data.HabitsRepository
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import java.time.LocalDate

class CalendarAndTodayFlowTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Test fun singleThemeTodayAndCalendarExposeWebDayDetails() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { prefs.values.first() }
        val originalHabits = runBlocking { app.database.dao().document(app.workspaceScope, "habits") }
        val habits = HabitsRepository(app)
        try {
            val date = LocalDate.now()
            runBlocking { habits.save(Habit(TrackerEntity.create("habit", id = "today-reading-validation"),
                "Чтение для проверки", date, HabitEngine(GenesisCalendar()).defaultSchedule(date, CalendarMode.PROFANE))) }
            runBlocking { prefs.set("display", "sacred") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Standart").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("СЕГОДНЯ").assertExists()
            compose.onNodeWithTag("today-hero-copy", useUnmergedTree = true).assertExists()
            compose.onNodeWithTag("today-hero-description", useUnmergedTree = true).assertExists()
            compose.onNodeWithTag("day-knowledge").assertDoesNotExist()
            compose.onNodeWithTag("today-day-details-toggle").assertTextContains("Подробнее о дне").performClick()
            compose.waitUntil(5_000) {
                compose.onAllNodesWithTag("today-day-details").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("today-day-details").performScrollTo()
            compose.onNodeWithTag("day-knowledge").assertExists()
            compose.onNodeWithTag("today-day-details-toggle").assertTextContains("Скрыть подробности")
            val todayImage = File(app.getExternalFilesDir(null), "today-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(todayImage))
            runBlocking { prefs.set("display", "profane") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("ГРИГОРИАНСКИЙ КАЛЕНДАРЬ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-profane-after.png")))
            compose.onNodeWithTag("today-gregorian-summary").assertDoesNotExist()
            compose.onNodeWithTag("today-gregorian-year-position", useUnmergedTree = true).assertExists()
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-day-rhythm"))
            compose.onNodeWithTag("today-day-rhythm").assertExists()
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-tasks-section"))
            compose.onNodeWithTag("today-habits-section").assertExists()
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-habit-check-today-reading-validation"))
            compose.onNodeWithTag("today-habit-check-today-reading-validation").performClick()
            compose.waitUntil(8_000) { runBlocking { habits.workspace.first().completions.any {
                it.habitId == "today-reading-validation" && it.completed && it.date == date } } }
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-activity-after.png")))
            compose.onNodeWithTag("today-list").performScrollToNode(hasTestTag("today-hero"))
            runBlocking { prefs.set("display", "lunar") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("ЛУННЫЙ КАЛЕНДАРЬ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("today-lunar-standard-image", useUnmergedTree = true).assertExists()
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null), "today-lunar-after.png")))
            runBlocking { prefs.set("display", "sacred") }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("МЕСЯЦ", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("day-rhythm-expand").performScrollTo()
            compose.onNodeWithTag("day-rhythm-expand").assertExists()
            compose.onNodeWithTag("today-day-details").performScrollTo()
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
            runBlocking {
                if (originalHabits == null) app.database.dao().deleteDocument(app.workspaceScope, "habits")
                else app.database.dao().putDocument(originalHabits)
                app.scheduler.restoreHabitNotifications()
            }
        }
    }
}
