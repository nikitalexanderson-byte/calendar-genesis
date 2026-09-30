package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.Instant
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.data.isTaskOverdue

/** Only standalone unfinished tasks can be moved without changing a recurrence series. */
internal fun missedTasksForToday(tasks: List<LocalTask>, today: LocalDate,
    now: Instant = Instant.now()): List<LocalTask> =
    tasks.filter { task -> !task.done && !task.recurrence.enabled &&
        runCatching { LocalDate.parse(task.date) < today }.getOrDefault(false) &&
        isTaskOverdue(task, now) }

@Composable
internal fun TodayMissedTasksCard(tasks: List<LocalTask>, onComplete: (LocalTask) -> Unit,
    onMoveToToday: (LocalTask) -> Unit) {
    if (tasks.isEmpty()) return
    Surface(Modifier.fillMaxWidth().testTag("today-missed-tasks"),
        shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.errorContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = .5f))) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("Пропущенные задачи", style = MaterialTheme.typography.titleMedium)
                Text("· ${tasks.size}", style = MaterialTheme.typography.titleMedium)
            }
            Text("Их можно выполнить сейчас или перенести на сегодня.",
                style = MaterialTheme.typography.bodySmall)
            tasks.forEach { task ->
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                    Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(false, onCheckedChange = { if (it) onComplete(task) },
                            modifier = Modifier.testTag("complete-missed-${task.id}"))
                        Column(Modifier.weight(1f)) {
                            Text(task.title, style = MaterialTheme.typography.bodyMedium)
                            Text(task.date, style = MaterialTheme.typography.labelSmall)
                        }
                        OutlinedButton(onClick = { onMoveToToday(task) },
                            modifier = Modifier.testTag("move-missed-${task.id}")) {
                            Text("На сегодня")
                        }
                    }
                }
            }
        }
    }
}
