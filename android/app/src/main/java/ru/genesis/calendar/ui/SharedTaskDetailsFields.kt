package ru.genesis.calendar.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.data.UiPreferences

private fun sharedTaskDetailCore(task: JSONObject): JSONObject = JSONObject()
    .put("priority", task.optInt("priority"))
    .put("parentTaskId", task.opt("parentTaskId") ?: JSONObject.NULL)
    .put("checklists", JSONArray((task.optJSONArray("checklists") ?: JSONArray()).toString()))

internal fun sharedTaskDetailDraft(task: JSONObject, prefs: UiPreferences = UiPreferences()): JSONObject = initialSharedTaskCustom(task,
    sharedTaskWithEstimates(sharedTaskDetailCore(task), SharedTaskEstimateDraft.fromTask(task)), prefs)

internal fun sharedTaskDetailChanges(task: JSONObject, details: JSONObject, includeEstimates: Boolean,
    customFields: List<JSONObject> = emptyList()): JSONObject =
    sharedTaskDetailCore(details).apply {
        if (includeEstimates) sharedTaskEstimates(task, details).patch().let { estimates ->
            estimates.keys().forEach { key -> put(key, estimates.get(key)) }
        }
        sharedTaskCustomDraft(task, details).patch(customFields).let { patch ->
            if (patch.length() > 0) put("customFields", patch)
        }
    }

internal fun sharedTaskDetailsChanged(task: JSONObject, details: JSONObject, customFields: List<JSONObject> = emptyList()): Boolean =
    sharedTaskDetailCore(task).toString() != sharedTaskDetailCore(details).toString() || sharedTaskEstimates(task, details).dirty ||
        runCatching { sharedTaskCustomDraft(task, details).changedIds(customFields).isNotEmpty() }.getOrDefault(true)

internal fun rebaseSharedTaskDetailDraft(task: JSONObject, details: JSONObject, customFields: List<JSONObject> = emptyList()): JSONObject {
    val result = sharedTaskWithEstimates(sharedTaskDetailCore(task), sharedTaskEstimates(task, details).rebase(task))
    // Keep malformed local input recoverable rather than replacing it during a refresh.
    if (details.has(SHARED_CUSTOM_CALENDAR_KEY)) result.put(SHARED_CUSTOM_CALENDAR_KEY, details.get(SHARED_CUSTOM_CALENDAR_KEY))
    return runCatching { sharedTaskWithCustomFields(task, result, sharedTaskCustomDraft(task, details).rebase(task, customFields)) }
        .getOrElse { if (details.has(SHARED_CUSTOM_DRAFT_KEY)) result.put(SHARED_CUSTOM_DRAFT_KEY, details.get(SHARED_CUSTOM_DRAFT_KEY)) else result }
}

/** Preserve loaded pages only while the server's membership/data generation is unchanged. */
internal fun mergeSharedTaskPage(previous: JSONObject?, next: JSONObject, append: Boolean): JSONObject {
    if (previous == null) return next
    val same = previous.optString("queryVersion").isNotBlank() && previous.optString("queryVersion") == next.optString("queryVersion")
    if (append && !same) throw IllegalStateException("SHARED_QUERY_CHANGED")
    if (!same) return next
    if (!append) return JSONObject(next.toString()).put("tasks", previous.getJSONArray("tasks"))
        .put("nextCursor", previous.opt("nextCursor") ?: JSONObject.NULL).put("hasMore", previous.optBoolean("hasMore"))
    val tasks = linkedMapOf<String, JSONObject>()
    listOf(previous, next).forEach { page ->
        val rows = page.getJSONArray("tasks")
        for (index in 0 until rows.length()) rows.getJSONObject(index).let { tasks[it.getString("id")] = it }
    }
    return JSONObject(next.toString()).put("tasks", JSONArray(tasks.values.toList()))
}

@Composable
internal fun SharedTaskDetailsFields(task: JSONObject, draft: JSONObject, onChange: (JSONObject) -> Unit, disabled: Boolean) {
    Text("Приоритет", style = MaterialTheme.typography.titleSmall)
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("Без приоритета", "Низкий приоритет", "Средний приоритет", "Высокий приоритет").forEachIndexed { priority, label ->
            FilterChip(selected = draft.optInt("priority") == priority, enabled = !disabled,
                onClick = { onChange(JSONObject(draft.toString()).put("priority", priority)) }, label = { Text(label) })
        }
    }
    if (task.optInt("childCount") > 0) Text(genesisTranslate("Выполнено: {done} из {total}")
        .replace("{done}", task.optInt("completedChildCount").toString()).replace("{total}", task.optInt("childCount").toString()))
    val checklists = draft.optJSONArray("checklists") ?: JSONArray()
    for (listIndex in 0 until checklists.length()) {
        val checklist = checklists.getJSONObject(listIndex)
        Text(checklist.optString("title"), style = MaterialTheme.typography.titleSmall)
        val items = checklist.optJSONArray("items") ?: JSONArray()
        for (itemIndex in 0 until items.length()) {
            val item = items.getJSONObject(itemIndex)
            Row(Modifier.fillMaxWidth()) {
                Checkbox(checked = item.optBoolean("done"), enabled = !disabled && item.isNull("linkedTaskId") && !item.optBoolean("linkUnavailable"),
                    onCheckedChange = { done ->
                        val updated = JSONObject(draft.toString())
                        updated.getJSONArray("checklists").getJSONObject(listIndex).getJSONArray("items").getJSONObject(itemIndex).put("done", done)
                        onChange(updated)
                    })
                Column(Modifier.weight(1f)) {
                    Text(item.optString("title"))
                    if (!item.isNull("dueDate")) Text(item.optString("dueDate"), style = MaterialTheme.typography.bodySmall)
                    if (item.optBoolean("linkUnavailable")) Text("Связанная задача недоступна", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
