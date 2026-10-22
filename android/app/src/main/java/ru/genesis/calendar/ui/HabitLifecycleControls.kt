package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.data.HABIT_LAUREL_RETENTION_COMPLETIONS
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.data.habitCompletionCount
import ru.genesis.calendar.data.LocalPreferences
import ru.genesis.calendar.data.UiPreferences
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.domain.habits.*
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

internal val habitLifecycleLabels = linkedMapOf("active" to "Активные", "paused" to "Пауза", "archived" to "Архив", "deleted" to "Удалённые")
internal fun habitLifecycleFailure(code: String?) = when (code) {
    "HABIT_LIFECYCLE_CLOCK_CONFLICT" -> "Не удалось сохранить. Проверьте дату и время устройства и повторите."
    "HABIT_LIFECYCLE_EDIT_CONFLICT", "HABIT_LIFECYCLE_TRANSITION_UNAVAILABLE", "HABIT_LIFECYCLE_ID_CONFLICT" -> "Есть изменения с другого устройства. Выберите состояние."
    else -> code
}

@Composable internal fun HabitLifecycleFilters(workspace: LocalHabitWorkspace, selected: String, onSelect: (String) -> Unit) {
    val number = NumberFormat.getIntegerInstance(Locale.forLanguageTag(LocalGenesisLanguage.current))
    Column(Modifier.fillMaxWidth().testTag("habit-lifecycle-filters"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Пауза выключает расписание и напоминания. Архив сохраняет историю и награды.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((status, label) in habitLifecycleLabels) {
                val count = workspace.habits.count { HabitLifecycle.state(it).status == status }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(shape = AffairsLayout.shape, color = if (selected == status) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface) {
                        AffairsIconButton(genesisTranslate(label) + ": " + number.format(count), when (status) {
                            "active" -> AffairsAction.RESUME; "paused" -> AffairsAction.PAUSE; "archived" -> AffairsAction.ARCHIVE; else -> AffairsAction.DELETE
                        }, { onSelect(status) }, Modifier.testTag("habit-state-$status").semantics { this.selected = selected == status })
                    }
                    Text(number.format(count), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        Text(habitLifecycleLabels.getValue(selected), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
    }
}

@Composable internal fun HabitCardActions(habit: Habit, enabled: Boolean, scheduled: Boolean,
    onEdit: () -> Unit, onToggle: () -> Unit, onArchive: () -> Unit, onTimer: () -> Unit, onDelete: () -> Unit) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        AffairsIconButton("Изменить", AffairsAction.EDIT, onEdit, Modifier.testTag("edit-habit-${habit.id}"), enabled)
        AffairsIconButton(if (habit.active) "Пауза" else "Включить", if (habit.active) AffairsAction.PAUSE else AffairsAction.RESUME,
            onToggle, Modifier.testTag("toggle-habit-${habit.id}"), enabled)
        AffairsIconButton("В архив", AffairsAction.ARCHIVE, onArchive, Modifier.testTag("archive-habit-${habit.id}"), enabled)
        AffairsIconButton("Таймер", AffairsAction.TIMER, onTimer, Modifier.testTag("habit-timer-open-${habit.id}"), enabled && scheduled)
        CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.error) {
            AffairsIconButton("Удалить", AffairsAction.DELETE, onDelete, Modifier.testTag("delete-habit-${habit.id}"), enabled)
        }
    }
}

@Composable internal fun HabitLifecycleResolution(habit: Habit, enabled: Boolean, onResolve: (String) -> Unit) {
    val state = HabitLifecycle.state(habit)
    if (!state.conflict) return
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val app = LocalContext.current.applicationContext as GenesisApplication
    val preferences = remember(app, app.workspaceScope) { LocalPreferences(app, app.workspaceScope) }
    val prefs by preferences.values.collectAsState(initial = UiPreferences())
    Column(Modifier.fillMaxWidth().testTag("habit-state-conflict-${habit.id}"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Есть изменения с другого устройства. Выберите состояние.", color = MaterialTheme.colorScheme.error)
        for (head in state.heads) {
            val at = Instant.parse(head.at).atZone(ZoneId.of(habit.schedule.timezone))
            val timestamp = at.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale)) + " · " +
                at.format(DateTimeFormatter.ofPattern(if (prefs.use24) "HH:mm" else "h:mm a", locale))
            OutlinedButton({ onResolve(head.id) }, enabled = enabled, shape = AffairsLayout.controlShape,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("resolve-habit-${habit.id}-${head.id}")) {
                Text(genesisTranslate(habitLifecycleLabels.getValue(head.status)) + " · " + timestamp)
            }
        }
    }
}

@Composable internal fun HabitRetiredRows(workspace: LocalHabitWorkspace, habits: List<Habit>, enabled: Boolean,
    onRestore: (Habit) -> Unit, onDelete: (Habit) -> Unit, onResolve: (Habit, String) -> Unit) {
    val number = NumberFormat.getIntegerInstance(Locale.forLanguageTag(LocalGenesisLanguage.current))
    val economy = HabitHistory.economy(workspace)
    Text("Восстановление вернёт привычку на паузу. Награды и прежний штраф не изменятся.", style = MaterialTheme.typography.bodySmall)
    for (habit in habits) {
        val state = HabitLifecycle.state(habit)
        Column(Modifier.fillMaxWidth().testTag("retired-habit-${habit.id}").padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            androidx.compose.material3.Text(habit.emoji + " " + habitDisplayTitle(habit), style = MaterialTheme.typography.titleMedium)
            Text(genesisTranslate("Выполнено дней") + ": " + number.format(habitCompletionCount(economy.completions, habit.id)) + "/" +
                number.format(HABIT_LAUREL_RETENTION_COMPLETIONS), style = MaterialTheme.typography.bodySmall)
            HabitLifecycleResolution(habit, enabled) { onResolve(habit, it) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AffairsIconButton("Восстановить", AffairsAction.RESTORE, { onRestore(habit) }, Modifier.testTag("restore-habit-${habit.id}"), enabled && !state.conflict)
                if (state.status != "deleted") CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.error) {
                    AffairsIconButton("Удалить", AffairsAction.DELETE, { onDelete(habit) }, Modifier.testTag("delete-habit-${habit.id}"), enabled && !state.conflict)
                }
            }
            HorizontalDivider()
        }
    }
}
