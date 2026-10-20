package ru.genesis.calendar.ui

import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.SharedBulkProtocol
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

internal fun bulkHistoryTimestamp(value: String, language: String, zone: ZoneId): String {
    val at = Instant.parse(value).atZone(zone)
    val date = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
        .withLocale(Locale.forLanguageTag(language)).format(at)
    val offset = if (at.offset.id == "Z") "UTC" else "UTC${at.offset.id}"
    return "$date · ${zone.id} ($offset)"
}

/** Saveable, title-free input. Calendar metadata stays outside every bulk action sent to PHP. */
internal class SharedBulkForm private constructor(private val value: JSONObject) {
    val kind get() = value.getString("kind")
    val all get() = value.getBoolean("all")
    val items: List<JSONObject> get() = importRows(value.getJSONArray("items"))
    val selectionCount get() = items.size
    fun text(key: String) = value.getString(key)
    fun int(key: String) = value.getInt(key)
    fun ids(key: String) = (0 until value.getJSONArray(key).length()).map(value.getJSONArray(key)::getString)
    fun saved() = value.toString()
    fun change(key: String, data: Any) = SharedBulkForm(JSONObject(saved()).put(key, data))
    fun selected(task: JSONObject): Boolean = all || items.any { it.getString("id") == task.getString("id") }
    fun toggle(task: JSONObject): SharedBulkForm {
        val reference = SharedBulkProtocol.reference(task); val exists = items.any { it.getString("id") == reference.getString("id") }
        require(exists || items.size < 1000) { "BULK_SELECTION_LIMIT" }
        return change("all", false).change("items", JSONArray(if (exists) items.filterNot { it.getString("id") == reference.getString("id") } else items + reference))
    }
    fun selectPage(tasks: List<JSONObject>) = change("all", false).change("items", JSONArray(tasks.take(1000).map(SharedBulkProtocol::reference)))
    fun selection(filter: JSONObject, sort: String): JSONObject = SharedBulkProtocol.selection(if (all) JSONObject().put("mode", "all")
        .put("filter", JSONObject(filter.toString())).put("sort", sort).put("queryVersion", text("queryVersion"))
        else JSONObject().put("mode", "page").put("items", JSONArray(items)))
    fun action(project: String): JSONObject = SharedBulkProtocol.action(JSONObject().put("kind", kind).apply {
        when (kind) {
            "priority" -> put("priority", int("priority"))
            "assignee" -> put("assigneeId", text("assigneeId").ifEmpty { null } ?: JSONObject.NULL)
            "status" -> put("statusIds", JSONObject().put(project, text("statusId")))
            "due" -> { put("mode", text("dueMode")); when (text("dueMode")) {
                "set" -> put("date", text("date")); "shift" -> put("days", text("days").toIntOrNull() ?: error("BULK_INVALID"))
            } }
            "labels" -> put("mode", text("labelMode")).put("labelIds", JSONArray(ids("labelIds")))
            "move" -> put("projectId", text("destinationId")).put("statusId", text("destinationStatusId"))
            "trash" -> put("retentionDays", int("retentionDays"))
        }
    })
    fun edit(project: String, filter: JSONObject, sort: String) = SharedBulkProtocol.edit(JSONObject().put("projectId", project)
        .put("selection", selection(filter, sort)).put("action", action(project)))
    companion object {
        fun initial() = SharedBulkForm(JSONObject().put("kind", "priority").put("priority", 0).put("assigneeId", "").put("statusId", "")
            .put("dueMode", "set").put("date", "").put("days", "1").put("labelMode", "add").put("labelIds", JSONArray())
            .put("destinationId", "").put("destinationStatusId", "").put("retentionDays", 30).put("all", false).put("items", JSONArray()).put("queryVersion", ""))
        fun restore(raw: String): SharedBulkForm {
            require(raw.toByteArray(Charsets.UTF_8).size <= 200_000) { "BULK_PROTOCOL" }; val source = JSONObject(raw); val template = initial().value
            require(source.keys().asSequence().toSet() == template.keys().asSequence().toSet()) { "BULK_PROTOCOL" }
            template.keys().asSequence().forEach { key ->
                val value = source.get(key); require(when (template.get(key)) { is String -> value is String && value.length <= 1000
                    is Boolean -> value is Boolean; is Int -> value is Int; is JSONArray -> value is JSONArray && value.length() <= 1000; else -> false }) { "BULK_PROTOCOL" }
            }
            val form = SharedBulkForm(source); require(form.kind in SharedBulkProtocol.kinds && form.int("priority") in 0..3 && form.int("retentionDays") in 1..30) { "BULK_PROTOCOL" }
            if (form.items.isNotEmpty()) SharedBulkProtocol.selection(JSONObject().put("mode", "page").put("items", source.getJSONArray("items")))
            for (index in 0 until source.getJSONArray("labelIds").length()) require(source.getJSONArray("labelIds").get(index) is String) { "BULK_PROTOCOL" }
            form.ids("labelIds").forEach(SharedBulkProtocol::id); return form
        }
        fun fromEdit(edit: JSONObject): SharedBulkForm {
            val safe = SharedBulkProtocol.edit(edit); val selected = safe.getJSONObject("selection"); val action = safe.getJSONObject("action")
            var form = initial().change("kind", action.getString("kind")).change("all", selected.getString("mode") == "all")
            form = if (form.all) form.change("queryVersion", selected.getString("queryVersion")) else form.change("items", selected.getJSONArray("items"))
            when (form.kind) {
                "priority" -> form = form.change("priority", action.getInt("priority"))
                "assignee" -> form = form.change("assigneeId", action.optString("assigneeId").takeUnless { it == "null" }.orEmpty())
                "status" -> form = form.change("statusId", action.getJSONObject("statusIds").getString(safe.getString("projectId")))
                "due" -> { form = form.change("dueMode", action.getString("mode")); if (action.has("date")) form = form.change("date", action.getString("date")); if (action.has("days")) form = form.change("days", action.getInt("days").toString()) }
                "labels" -> form = form.change("labelMode", action.getString("mode")).change("labelIds", action.getJSONArray("labelIds"))
                "move" -> form = form.change("destinationId", action.getString("projectId")).change("destinationStatusId", action.getString("statusId"))
                "trash" -> form = form.change("retentionDays", action.getInt("retentionDays"))
            }
            return form
        }
    }
}
