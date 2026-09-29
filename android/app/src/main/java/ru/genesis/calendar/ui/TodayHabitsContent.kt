package ru.genesis.calendar.ui

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.HabitsRepository
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.domain.habits.HabitEngine

/** Uses each habit's saved schedule, independently of the display calendar. */
@Composable
internal fun TodayHabitsContent(app: GenesisApplication, date: LocalDate,
    workspace: LocalHabitWorkspace, onOpenHabits: () -> Unit) {
    val repository = remember(app) { HabitsRepository(app) }
    val engine = remember { HabitEngine(GenesisCalendar()) }
    val scheduled = remember(workspace.habits, date) { workspace.habits.filter { engine.isScheduled(it, date) } }
    val entries = workspace.completions.filter { it.date == date }.associateBy { it.habitId }
    val completed = scheduled.count { entries[it.id]?.completed == true }
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val english = LocalGenesisLanguage.current == "en"
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var ratingHabit by remember(date) { mutableStateOf<Habit?>(null) }
    fun complete(habit: Habit, checked: Boolean, quality: Double?) {
        if (busy || date != LocalDate.now()) return
        busy = true
        scope.launch {
            try {
                val result = repository.complete(habit.id, checked, quality, date)
                error = null
                if (checked) {
                    val feedback = workspace.settings.feedback
                    if (feedback.haptics) haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    if (feedback.sound) {
                        val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 35)
                        try { tone.startTone(ToneGenerator.TONE_PROP_ACK, 120); delay(140) }
                        finally { tone.release() }
                    }
                    if (feedback.achievementPopups && result.newlyUnlockedAchievements > 0)
                        app.scheduler.showAchievementNotification(result.newlyUnlockedAchievements, english)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: IllegalArgumentException) { error = e.message }
            catch (_: Exception) { error = "Не удалось сохранить отметку привычки. Повторите попытку." }
            finally { busy = false }
        }
    }
    Column(Modifier.fillMaxWidth().testTag("today-habits-section"),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically) {
            Surface(Modifier.size(44.dp),shape=RoundedCornerShape(14.dp),color=if(LocalEveningTheme.current)
                MaterialTheme.colorScheme.secondaryContainer else Color(0xff123b36)) {
                Box(contentAlignment=Alignment.Center) {
                    GenesisVectorIcon(GenesisPageIcon.HABITS,Modifier.size(28.dp),if(LocalEveningTheme.current)
                        MaterialTheme.colorScheme.onSecondaryContainer else Color(0xfff3d68f),animated=true)
                }
            }
            Column(Modifier.weight(1f)) {
                Text("Трекер привычек", style = MaterialTheme.typography.titleLarge)
                Text("$completed из ${scheduled.size} выполнено", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Button(onClick=onOpenHabits,modifier=Modifier.heightIn(min=48.dp).testTag("today-habits-open")) { Text("Открыть") }
        }
        if (scheduled.isNotEmpty()) LinearProgressIndicator(
            progress = { completed.toFloat() / scheduled.size }, modifier = Modifier.fillMaxWidth())
        Text("Привычки дня", style = MaterialTheme.typography.titleMedium)
        if (scheduled.isEmpty()) Text("На этот день привычек нет.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        scheduled.forEach { habit ->
            val entry = entries[habit.id]
            Surface(Modifier.fillMaxWidth().testTag("today-habit-${habit.id}"),
                shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceContainerLowest,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = entry?.completed == true, enabled = !busy && date == LocalDate.now(),
                        modifier = Modifier.testTag("today-habit-check-${habit.id}"),
                        onCheckedChange = { checked ->
                            if (checked && habit.scoringMode.startsWith("quality")) ratingHabit = habit
                            else complete(habit, checked, entry?.qualityValue)
                        })
                    Column(Modifier.weight(1f).padding(8.dp)) {
                        Text(habit.title, style = MaterialTheme.typography.titleMedium)
                        if (entry?.completed == true) Text("Выполнено · ${entry.score} баллов",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
        if(date != LocalDate.now()) Text("Отметки выполнения доступны в день практики.",
            style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
    ratingHabit?.let { habit ->
        var quality by remember(habit.id) { mutableFloatStateOf(
            (entries[habit.id]?.qualityValue ?: if (habit.scoringMode == "quality-ten") 5.0 else 0.0).toFloat()) }
        AlertDialog(onDismissRequest = { ratingHabit = null }, title = { Text(habit.title) },
            text = { Column {
                Text("Качество выполнения · ${quality.toInt()}")
                Slider(value = quality, onValueChange = { quality = it },
                    valueRange = if (habit.scoringMode == "quality-ten") 1f..10f else -5f..5f,
                    steps = if (habit.scoringMode == "quality-ten") 8 else 9)
            } }, confirmButton = { TextButton(onClick = {
                ratingHabit = null; complete(habit, true, quality.toDouble())
            }) { Text("Выполнено") } },
            dismissButton = { TextButton(onClick = { ratingHabit = null }) { Text("Отмена") } })
    }
}
