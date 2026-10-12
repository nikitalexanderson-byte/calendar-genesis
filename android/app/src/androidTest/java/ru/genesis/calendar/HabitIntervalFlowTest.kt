package ru.genesis.calendar

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.HabitsRepository
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.ui.HabitsScreen
import ru.genesis.calendar.ui.standart

class HabitIntervalFlowTest {
    @get:Rule val compose=createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun createMarkReloadAndChangeCompletionMode() {
        val app=compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.workspaceScope=="internal-validation-v1")
        val repository=HabitsRepository(app)
        val title="UX: Повторять каждые полчаса в выбранном промежутке"
        fun saved()=runBlocking { repository.workspace.first() }
        runBlocking { saved().habits.filter { it.title==title }.forEach { repository.delete(it.id) } }
        fun screenshot(name: String) {
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
                File(app.getExternalFilesDir(null),"habit-interval-$name.png")))
        }
        compose.setContent {
            MaterialTheme(colorScheme=standart) {
                Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    HabitsScreen(app,true,inputCalendarMode=CalendarMode.PROFANE)
                }
            }
        }
        compose.waitUntil(15_000) { compose.onAllNodesWithText("Мои привычки").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Новая привычка").performScrollTo().performClick()
        compose.onNodeWithText("Название").performTextInput(title)
        compose.onNodeWithTag("habit-interval-enabled").performScrollTo().performClick()
        compose.onNodeWithTag("habit-interval-minutes").performScrollTo().performTextReplacement("0")
        compose.onNodeWithText("Сохранить").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("habit-interval-minutes").performScrollTo().performTextReplacement("30")
        compose.onNode(hasAnyAncestor(hasTestTag("habit-interval-end")) and hasClickAction())
            .performScrollTo().performClick()
        repeat(8) { compose.onNodeWithText("Час −").performScrollTo().performClick() }
        compose.onNodeWithText("Готово").performScrollTo().performClick()
        compose.onNodeWithTag("habit-interval-mode-each").performScrollTo().assertIsSelected()
        screenshot("editor")
        compose.onNodeWithText("Сохранить").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(15_000) { saved().habits.any { it.title==title } }
        val habit=saved().habits.single { it.title==title }
        assertEquals(listOf("09:00","09:30","10:00"),habit.intervalSchedule!!.times())
        compose.onNodeWithTag("habit-interval-marks-toggle").performScrollTo().performClick()
        for(time in listOf("09:00","09:30","10:00")) {
            compose.onNodeWithTag("habit-interval-mark-$time").performScrollTo().performClick()
            compose.waitUntil(15_000) { saved().completions.firstOrNull { it.habitId==habit.id }?.completedTimes?.contains(time)==true }
        }
        val entry=saved().completions.single { it.habitId==habit.id && it.date==LocalDate.now() }
        assertTrue(entry.completed)
        assertEquals(10,entry.xpAwarded)
        compose.waitUntil(15_000) { compose.onAllNodesWithText("3 / 3",substring=true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("habit-interval-marks-toggle").performScrollTo()
        compose.waitForIdle()
        screenshot("marked")
        // A fresh repository reads the encrypted persisted document.
        assertTrue(runBlocking { HabitsRepository(app).workspace.first() }.completions.single { it.habitId==habit.id }.completed)
        compose.onNodeWithTag("habit-interval-mark-09:30").performScrollTo().performClick()
        compose.waitUntil(15_000) { saved().completions.single { it.habitId==habit.id }.completed.not() }
        val editButton=hasText("Изменить") and hasAnyAncestor(hasTestTag("habit-card-${habit.id}"))
        compose.waitUntil(15_000) { compose.onAllNodes(editButton and isEnabled()).fetchSemanticsNodes().isNotEmpty() }
        compose.mainClock.advanceTimeBy(1000)
        compose.onNode(editButton).performScrollTo().assertIsEnabled()
        val device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        repeat(6) {
            if(!compose.onNode(editButton).isDisplayed()) {
                device.swipe(device.displayWidth/2,device.displayHeight*4/5,
                    device.displayWidth/2,device.displayHeight/3,30)
                compose.waitForIdle()
            }
        }
        compose.onNode(editButton).assertIsDisplayed()
        screenshot("before-edit")
        compose.onNode(editButton).performClick()
        compose.waitUntil(15_000) { compose.onAllNodesWithTag("habit-editor-close").fetchSemanticsNodes().isNotEmpty() }
        screenshot("edit-reopened")
        compose.onNodeWithTag("habit-interval-mode-day").performScrollTo().performClick().assertIsSelected()
        compose.onNodeWithText("Сохранить").performScrollTo().performClick()
        compose.waitUntil(15_000) { saved().habits.single { it.id==habit.id }.intervalSchedule?.completionMode=="day" }
        compose.onNodeWithTag("habit-interval-marks-toggle").assertDoesNotExist()
        compose.onNode(hasAnyAncestor(hasTestTag("habit-card-${habit.id}")) and isToggleable())
            .performScrollTo().performClick()
        compose.waitUntil(15_000) { saved().completions.single { it.habitId==habit.id }.completed }
        screenshot("daily")
        runBlocking { repository.delete(habit.id) }
    }
}
