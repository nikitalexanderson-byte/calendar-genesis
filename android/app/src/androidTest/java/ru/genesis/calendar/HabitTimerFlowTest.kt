package ru.genesis.calendar

import android.app.ActivityManager
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import ru.genesis.calendar.ui.*

class HabitTimerFlowTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun launchPauseBackgroundRecoverFinishFailedSaveAndRetryKeepOneReceipt() {
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug") && app.workspaceScope == "internal-validation-v1")
        val repository = HabitsRepository(app)
        fun saved() = runBlocking { repository.workspace.first() }
        runBlocking {
            HabitTimers.sessions(saved().timers).filter { it.root.owner == repository.timerOwner && it.state?.status !in setOf("saved", "discarded") }
                .forEach { repository.applyTimer(HabitTimerCommand("discard", repository.timerOwner, Instant.now().toString(), UUID.randomUUID().toString(), it.id)) }
        }
        val date = LocalDate.now()
        val habit = Habit(TrackerEntity.create("habit", id = "e1-timer-${UUID.randomUUID()}"), "E1 · Чтение", date,
            HabitEngine(GenesisCalendar()).defaultSchedule(date, CalendarMode.PROFANE),
            measurement = HabitMeasurement("duration", "min", 1000, 1000))
        runBlocking { repository.save(habit) }
        var dark by mutableStateOf(false)
        var failSave = true
        var requested by mutableStateOf<String?>(habit.id)
        var mount by mutableIntStateOf(0)
        compose.setContent {
            val workspace by repository.workspace.collectAsState(initial = LocalHabitWorkspace())
            MaterialTheme(colorScheme = if (dark) evening else standart) {
                CompositionLocalProvider(LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
                    Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                            key(mount) {
                                HabitTimerShelf(workspace, repository.timerOwner, requested, { requested = null }) { command ->
                                    if (command.action == "save" && failSave) { failSave = false; error("Synthetic durable storage failure") }
                                    repository.applyTimer(command); Unit
                                }
                            }
                        }
                    }
                }
            }
        }
        val startButton = compose.onNodeWithTag("habit-timer-start", useUnmergedTree = true)
            .performScrollTo().assertIsEnabled().assertHeightIsAtLeast(48.dp)
        val startBounds = startButton.fetchSemanticsNode().boundsInRoot
        for (kind in listOf("stopwatch", "pomodoro")) {
            val modeBounds = compose.onNodeWithTag("habit-timer-mode-$kind", useUnmergedTree = true)
                .assertIsEnabled().fetchSemanticsNode().boundsInRoot
            assertEquals(startBounds.width, modeBounds.width, 1f)
            assertEquals(startBounds.height, modeBounds.height, 1f)
            assertEquals(startBounds.center.y, modeBounds.center.y, 1f)
        }
        startButton.performTouchInput { click(center) }
        compose.waitUntil(15_000) { HabitTimers.sessions(saved().timers).any { it.root.habitId == habit.id } }
        val sessionId = HabitTimers.sessions(saved().timers).single { it.root.habitId == habit.id }.id
        compose.onNodeWithTag("habit-timer-pause").performScrollTo().performClick()
        compose.waitUntil(15_000) { HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state?.status == "paused" }
        val paused = HabitTimers.reading(HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state!!).workMs
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val taskId = compose.activity.taskId
        device.pressHome()
        // Bring back this exact host; API28 may resolve a fresh instance for a reordered Intent.
        app.getSystemService(ActivityManager::class.java).appTasks.single { it.taskInfo?.id == taskId }.moveToFront()
        compose.waitUntil(15_000) { runCatching {
            compose.onAllNodesWithTag("habit-timer-resume").fetchSemanticsNodes().isNotEmpty()
        }.getOrDefault(false) }
        compose.runOnIdle { mount++; dark = true }
        compose.onNodeWithTag("habit-timer-resume").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(15_000) { HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state?.status == "running" }
        val recovered = runBlocking { HabitsRepository(app).workspace.first() }
        assertTrue(HabitTimers.reading(HabitTimers.sessions(recovered.timers).single { it.id == sessionId }.state!!).workMs >= paused)
        compose.onNodeWithTag("habit-timer-finish").performScrollTo().performClick()
        compose.waitUntil(15_000) { HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state?.status == "finished" }
        compose.onNodeWithTag("habit-timer-review").performScrollTo().assertExists()
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "e1-timer-review-dark.png")))
        compose.runOnIdle { dark = false }
        compose.onNodeWithTag("habit-timer-save").performScrollTo()
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "e1-timer-review-light.png")))
        compose.onNodeWithTag("habit-timer-save").performClick()
        compose.onNodeWithTag("habit-timer-retry").performScrollTo().assertIsEnabled()
        assertEquals("finished", HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state!!.status)
        compose.onNodeWithTag("habit-timer-retry").performClick()
        compose.waitUntil(15_000) { HabitTimers.sessions(saved().timers).single { it.id == sessionId }.state?.status == "saved" }
        val result = saved()
        assertEquals(1, result.measurements.count { it.habitId == habit.id })
        runBlocking { repository.applyTimer(HabitTimerCommand("save", repository.timerOwner, Instant.now().toString(), "retry-save", sessionId)) }
        assertEquals(result.measurements, saved().measurements)
        assertEquals(result.completions.sumOf { it.xpAwarded }, saved().completions.sumOf { it.xpAwarded })
    }
}
