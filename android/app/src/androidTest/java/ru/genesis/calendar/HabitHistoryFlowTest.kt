package ru.genesis.calendar

import androidx.compose.foundation.layout.*
import androidx.room.withTransaction
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.*
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

class HabitHistoryFlowTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()
    @Test fun explicitHistoricalPreviewSavesItsOriginalDayWithoutRewardAndMeasuredInputIsDurable() {
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug") && app.workspaceScope == "internal-validation-v1")
        val repository = HabitsRepository(app)
        fun saved() = runBlocking { repository.workspace.first() }
        val today = LocalDate.now(); val day = today.minusDays(1)
        fun habit(title: String, measured: Boolean = false) = Habit(TrackerEntity.create("habit", id = "e3-${UUID.randomUUID()}"),title,
            today.minusDays(3),HabitEngine(GenesisCalendar()).defaultSchedule(today.minusDays(3),CalendarMode.PROFANE),
            measurement = if(measured) HabitMeasurement("quantity","pages",1000,1000) else null)
        val binary = habit("E3 · Прошлая практика");val quantity = habit("E3 · Страницы в прошлом",true)
        val ids = setOf(binary.id,quantity.id)
        // Seed an older imported practice only in the guarded synthetic debug workspace.
        // Production creation correctly refuses a start date in the past.
        runBlocking { app.database.withTransaction {
            val record=app.database.dao().document(app.workspaceScope,"habits")
            val existing=if(record==null) LocalHabitWorkspace() else HabitDocument.decode(LocalCipher().decrypt(record.encrypted,"${app.workspaceScope}/habits"),record.revision)
            val next=existing.copy(habits=existing.habits+listOf(binary,quantity),revision=existing.revision+1)
            app.database.dao().putDocument(DocumentRecord(app.workspaceScope,"habits",
                LocalCipher().encrypt(HabitDocument.encode(next),"${app.workspaceScope}/habits"),next.revision))
        } }
        val before = saved()
        var dark by mutableStateOf(false)
        try {
            compose.setContent {
                val all by repository.workspace.collectAsState(initial = LocalHabitWorkspace())
                MaterialTheme(colorScheme = if(dark) evening else standart) {
                    CompositionLocalProvider(LocalGenesisLanguage provides "ru",LocalEveningTheme provides dark) {
                        Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
                                HabitHistoryPanel(all.copy(habits=all.habits.filter { it.id in ids }),repository,CalendarMode.PROFANE)
                            }
                        }
                    }
                }
            }
            compose.onNodeWithTag("habit-history-content").assertDoesNotExist()
            compose.onNodeWithText("Исправить историю").assertDoesNotExist()
            compose.onNodeWithTag("habit-history-disclosure").performClick()
            compose.onNodeWithText("Исправить историю").performClick()
            compose.onAllNodes(isToggleable()).onFirst().performScrollTo().performClick()
            compose.onNodeWithText("Заметка").performScrollTo().performTextReplacement("Синтетическая историческая запись")
            compose.onNodeWithText("Предпросмотр изменений").performScrollTo().performClick()
            assertTrue(saved().history.none { it.habitId in ids })
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            compose.onNodeWithText("Сохранить").performScrollTo();compose.waitForIdle()
            assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null),"e3-history-preview-light.png")))
            compose.runOnIdle { dark=true };compose.waitForIdle()
            assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null),"e3-history-preview-dark.png")))
            compose.onNodeWithText("Сохранить").performClick()
            compose.waitUntil(15_000) { saved().history.any { it.habitId == binary.id } }
            val first = saved().history.single { it.habitId == binary.id }
            assertEquals(day,first.date);assertTrue(saved().completions.single { it.habitId == binary.id && it.date == day }.completed)
            assertEquals(before.progress.lifetimeXp,saved().progress.lifetimeXp)
            assertEquals(before.rewards,saved().rewards);assertEquals(before.streakFreezeTransactions,saved().streakFreezeTransactions)
            val replay = HabitHistoryCommand(first.entity.id,first.entity.createdAt,first.habitId,first.date,first.ruleId,first.replaces,first.value)
            runBlocking { repository.correctHistory(replay) }
            assertEquals(1,saved().history.count { it.habitId == binary.id })
            compose.onNode(hasText(binary.title) and hasClickAction()).performScrollTo().performClick()
            compose.onNodeWithText(quantity.title).performClick()
            assertTrue(saved().measurements.none { it.habitId == quantity.id })
            compose.onNodeWithText("Значение").performScrollTo().performTextReplacement("1")
            compose.onNodeWithText("Предпросмотр изменений").performScrollTo().performClick()
            compose.onNodeWithText("Сохранить").performScrollTo().performClick()
            compose.waitUntil(15_000) { saved().measurements.any { it.habitId == quantity.id } }
            val value = saved().measurements.single { it.habitId == quantity.id }
            assertEquals(day,value.date);assertEquals(1000L,value.value);assertTrue(value.historical)
            assertEquals(before.progress.lifetimeXp,saved().progress.lifetimeXp);assertEquals(before.rewards,saved().rewards)
            val reloaded = HabitDocument.decode(HabitDocument.encode(saved()),saved().revision)
            assertEquals(saved().history,reloaded.history);assertEquals(saved().measurements,reloaded.measurements)
        } finally {
            runBlocking { for(id in ids) saved().habits.firstOrNull { it.id==id }?.let { repository.save(it.copy(active=false)) } }
        }
    }
}
