package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.TaskOccurrences

class TaskRecurrenceFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun taskEditorStoresOneClassicSeriesAndProjectsTomorrow() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val title = "UI серия ${UUID.randomUUID()}"
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("task-title").performTextInput(title)
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        compose.onNodeWithTag("recurrence-enabled").performScrollTo().performClick()
        compose.onNodeWithTag("recurrence-enabled").assertIsOn()
        compose.onNodeWithText("По какое").performScrollTo()
        compose.onNodeWithTag("recurrence-mode-classic").performClick()
        compose.onNodeWithTag("recurrence-mode-classic").assertIsSelected()
        compose.onNodeWithText("Интервал · 1").performScrollTo()
        compose.onNodeWithTag("recurrence-pattern-daily").performClick()
        compose.onNodeWithTag("recurrence-count").assertExists()
        compose.onNodeWithTag("save-task").performScrollTo().performClick()
        compose.waitUntil(10_000) { runBlocking {
            app.repository.tasks.first().any { it.title == title && it.recurrence.enabled }
        } }
        val stored = runBlocking { app.repository.tasks.first().single { it.title == title } }
        assertEquals("classic", stored.recurrence.mode)
        assertEquals("daily", stored.recurrence.pattern)
        assertTrue(TaskOccurrences.occursOn(stored, LocalDate.parse(stored.date).plusDays(1)))
        assertEquals(1, runBlocking { app.repository.tasks.first().count { it.title == title } })
        compose.onNodeWithTag("today-list").performScrollToNode(hasText(title))
        compose.onNodeWithText(title).performClick()
        compose.onNodeWithText("Удалить задачу").performScrollTo().performClick()
        compose.onNodeWithTag("delete-occurrence").assertExists().performClick()
        compose.waitUntil(10_000) { runBlocking {
            app.repository.get(stored.id)?.recurrenceExcludedDates?.contains(stored.date) == true
        } }
        val after = runBlocking { app.repository.get(stored.id) }!!
        assertFalse(TaskOccurrences.occursOn(after, LocalDate.parse(stored.date)))
        assertTrue(TaskOccurrences.occursOn(after, LocalDate.parse(stored.date).plusDays(1)))
        assertEquals(1, runBlocking { app.repository.tasks.first().count { it.title == title } })
    }
}
