package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.LocalPreferences
import ru.genesis.calendar.data.UiPreferences
import ru.genesis.calendar.domain.habits.HabitReminder

@Composable
internal fun HabitReminderFields(preferredTime: String, reminder: HabitReminder, enabled: Boolean,
    onTime: (String) -> Unit, onReminder: (HabitReminder) -> Unit) {
    val app = LocalContext.current.applicationContext as GenesisApplication
    val preferences = remember(app) { LocalPreferences(app, app.workspaceScope) }
    val prefs by preferences.values.collectAsStateWithLifecycle(UiPreferences())
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Точное время привычки", style = MaterialTheme.typography.titleMedium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(preferredTime.isNotEmpty(), { onTime(if (it) reminder.time else "") }, enabled = enabled)
            Text("Выполнять в определённое время")
        }
        if (preferredTime.isNotEmpty()) AuthorTimePicker(preferredTime, prefs.use24) { if (enabled) onTime(it) }
        HorizontalDivider()
        Text("Персональное напоминание", style = MaterialTheme.typography.titleMedium)
        Text("Действует отдельно от напоминания о дневной цели.", style = MaterialTheme.typography.bodySmall)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(reminder.enabled, { onReminder(reminder.copy(enabled = it)) }, enabled = enabled,
                modifier = Modifier.testTag("habit-personal-reminder-enabled"))
            Text("Добавить напоминание", Modifier.padding(start = 8.dp))
        }
        if (reminder.enabled) {
            listOf("habit" to "В точное время привычки", "custom" to "В отдельное время").forEach { (value, label) ->
                FilterChip(selected = reminder.timing == value, enabled = enabled,
                    onClick = { onReminder(reminder.copy(timing = value)) }, label = { Text(label) },
                    modifier = Modifier.testTag("habit-reminder-timing-$value"))
            }
            if (reminder.timing == "custom" || preferredTime.isEmpty()) {
                Text("Время напоминания")
                AuthorTimePicker(reminder.time, prefs.use24) { if (enabled) onReminder(reminder.copy(time = it)) }
            }
            var minutesText by remember(reminder.minutesBefore) { mutableStateOf(reminder.minutesBefore.toString()) }
            OutlinedTextField(value = minutesText, enabled = enabled,
                onValueChange = { value ->
                    if (value.isEmpty()) { minutesText = value; onReminder(reminder.copy(minutesBefore = 0)) }
                    else value.toIntOrNull()?.takeIf { it in 0..1440 }?.let { minutesText = value; onReminder(reminder.copy(minutesBefore = it)) }
                },
                label = { Text("За сколько минут") }, modifier = Modifier.fillMaxWidth().testTag("habit-reminder-minutes-before"),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(reminder.allowDuringQuietHours, { onReminder(reminder.copy(allowDuringQuietHours = it)) }, enabled = enabled)
                Text("Разрешить это напоминание в тихие часы", Modifier.weight(1f))
            }
        }
    }
}
