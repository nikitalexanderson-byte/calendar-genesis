package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** A separate query for the actual Today date; calendar selection never changes this list. */
@Composable
internal fun TodaySharedTasks(reader: SharedTaskListReader, date: String,
    onOpen: (SharedCalendarEntry) -> Unit) {
    val scope = rememberCoroutineScope()
    val page = reader.pageState.value
    val rows = page?.optJSONArray("tasks")
    val en = LocalGenesisLanguage.current == "en"
    fun refresh(more: Boolean = false) { scope.launch {
        try { if (more) reader.more() else reader.refresh() }
        catch (cancelled: CancellationException) { throw cancelled }
    } }
    if ((page?.optInt("total") ?: 0) > 0) {
        Column(Modifier.fillMaxWidth().testTag("today-shared-tasks"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${if (en) "Shared" else "Общие"} · ${page!!.optInt("total")}",
                style = MaterialTheme.typography.titleMedium)
            for (index in 0 until (rows?.length() ?: 0)) {
                val row = rows!!.getJSONObject(index)
                if (row.optString("dueDate") != date) continue
                val task = SharedCalendarEntry(row.getString("id"), row.getString("title"), date,
                    row.optString("projectTitle"), !row.isNull("completedAt"), row.getString("projectId"), row.getString("spaceId"))
                key(task.id) {
                    AffairsTaskRow(task.title, task.completed, { onOpen(task) },
                        modifier = Modifier.testTag("today-shared-task-${task.id}"),
                        metadata = listOf(task.projectTitle).filter(String::isNotBlank))
                }
            }
            if (page.optBoolean("hasMore")) TextButton(onClick = { refresh(true) }, enabled = !reader.busy) {
                Text(if (en) "Show more" else "Показать ещё")
            }
        }
    }
    if (reader.error.isNotBlank()) {
        Text("Не удалось загрузить данные",
            color = MaterialTheme.colorScheme.error)
        TextButton(onClick = { refresh() }, enabled = !reader.busy) { Text(if (en) "Retry" else "Повторить") }
    }
}
