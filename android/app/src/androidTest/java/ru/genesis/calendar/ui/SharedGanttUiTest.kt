package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.StoicheionGestureActivity
import ru.genesis.calendar.domain.CalendarMode

class SharedGanttUiTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()
    private val task = JSONObject().put("id", "qa-gantt").put("projectId", "qa-project").put("title", "Проверить сроки")
        .put("statusId", "todo").put("revision", 4)
    private val statuses = listOf(JSONObject().put("id", "todo").put("isDone", 0), JSONObject().put("id", "done").put("isDone", 1))

    @Test fun unscheduledTaskUsesTheExistingCalendarFormAndKeepsItsIdentity() {
        var savedTask: JSONObject? = null
        var savedPatch: JSONObject? = null
        compose.setContent { MaterialTheme(colorScheme = standart) {
            Surface { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                SharedGanttView(listOf(task), statuses, CalendarMode.PROFANE, CalendarMode.PROFANE, true, true, false,
                    onOpen = {}, onSchedule = { row, patch -> savedTask = row; savedPatch = patch })
            } }
        } }
        compose.onNodeWithTag("gantt-schedule-qa-gantt").performScrollTo().performClick()
        compose.onNodeWithTag("gantt-start-date").assertExists()
        compose.onNodeWithTag("gantt-end-date").assertExists()
        compose.onNodeWithTag("gantt-save-schedule").performClick()
        compose.waitUntil { savedPatch != null }
        assertSame(task, savedTask)
        assertEquals(savedPatch!!.getString("startDate"), savedPatch!!.getString("dueDate"))
        assertTrue(savedPatch!!.isNull("startTime"))
        compose.onNodeWithTag("gantt-save-schedule").assertDoesNotExist()
    }

    @Test fun viewerCanOpenTasksWithoutSchedulingAndCompletedRowsAreCollapsed() {
        var opened = ""
        val completed = JSONObject(task.toString()).put("id", "qa-done").put("title", "Выполненная работа").put("statusId", "done")
        compose.setContent { MaterialTheme(colorScheme = standart) {
            Surface { Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                SharedGanttView(listOf(task, completed), statuses, CalendarMode.PROFANE, CalendarMode.PROFANE, true, false, false,
                    onOpen = { opened = it.getString("id") }, onSchedule = { _, _ -> fail("Viewer must not change dates") })
            } }
        } }
        compose.onNodeWithTag("gantt-schedule-qa-gantt").assertDoesNotExist()
        compose.onNodeWithText(task.getString("title")).performScrollTo().performClick()
        assertEquals("qa-gantt", opened)
        compose.onNodeWithText("Выполненная работа").assertDoesNotExist()
        compose.onNodeWithText("Завершённые").performScrollTo().performClick()
        compose.onNodeWithText("Выполненная работа").assertExists()
    }
}
