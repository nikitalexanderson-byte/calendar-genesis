package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.CalendarMode

internal fun calendarModeLabel(mode: CalendarMode): String = when(mode) {
    CalendarMode.PROFANE -> "Григорианский"
    CalendarMode.SACRED -> "Сакральный"
    CalendarMode.LUNAR -> "Лунный"
}

@Composable internal fun CalendarInlineTasks(date: LocalDate, tasks: List<LocalTask>, use24: Boolean,
    onComplete: (LocalTask) -> Unit, onEdit: (LocalTask) -> Unit, onDelete: (LocalTask) -> Unit) {
    Column(Modifier.fillMaxWidth().testTag("calendar-inline-tasks"), verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text("Задачи дня · ${tasks.size}",style=MaterialTheme.typography.titleMedium)
        if(tasks.isEmpty()) Text("На этот день задач нет.",style=MaterialTheme.typography.bodySmall)
        tasks.forEach { task ->
            Surface(Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp),
                color=if(task.done) completedTaskSurface else MaterialTheme.colorScheme.surfaceContainerLowest,
                border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.padding(8.dp)) {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Checkbox(task.done,{onComplete(task)},modifier=Modifier.testTag("calendar-inline-complete-${task.id}"))
                        Column(Modifier.weight(1f)) {
                            TaskTitle(task,style=MaterialTheme.typography.titleSmall,occurrenceDate=date)
                            if(task.time.isNotEmpty()) Text(timeLabel(task.time,use24),style=MaterialTheme.typography.bodySmall)
                        }
                    }
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        TextButton({onEdit(task)},Modifier.weight(1f).heightIn(min=48.dp).testTag("calendar-inline-edit-${task.id}")) {
                            Text("Редактировать") }
                        TextButton({onDelete(task)},Modifier.weight(1f).heightIn(min=48.dp).testTag("calendar-inline-delete-${task.id}"),
                            colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error)) { Text("Удалить") }
                    }
                }
            }
        }
    }
}
