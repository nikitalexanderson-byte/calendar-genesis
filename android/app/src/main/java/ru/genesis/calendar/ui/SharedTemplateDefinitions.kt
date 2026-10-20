package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Portable definitions belong to this template; these controls do not change workspace-wide definitions. */
@Composable internal fun SharedTemplateDefinitionEditor(state: SharedTemplateState) {
    val manifest = state.edit?.getJSONObject("request")?.optJSONObject("manifest") ?: return
    val fields = SharedTemplateEdits.rows(manifest.getJSONArray("fields")); val projects = SharedTemplateEdits.rows(manifest.getJSONArray("projects")); val enabled = state.editable
    var chosen by rememberSaveable { mutableStateOf("") }; var deleting by remember { mutableStateOf<String?>(null) }
    val selected = fields.firstOrNull { it.getString("key") == chosen } ?: fields.firstOrNull()
    Column(Modifier.fillMaxWidth().testTag("template-definition-editor"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Пользовательские поля", style = MaterialTheme.typography.titleLarge)
        if (selected != null) ImportChoice("Поле", selected.getString("key"), fields.map { it.getString("key") to it.getString("title").ifBlank { genesisTranslate("Без названия") } }, !state.busy, "template-field-choice") { chosen = it }
        listOfNotNull(selected).forEach { field -> key(field.getString("key")) {
            val id = field.getString("key")
            fun change(action: (JSONObject) -> Unit) = state.changeManifest(SharedTemplateEdits.update(manifest, "fields", id, action))
            AffairsDisclosure(field.getString("title").ifBlank { genesisTranslate("Поле") }, titleIsUserContent = true, initiallyExpanded = true) {
                TemplateField("Название", field.getString("title"), enabled, "template-field-title") { value -> change { it.put("title", value) } }
                ImportChoice("Тип", field.getString("type"), listOf("text" to "Текст", "number" to "Число", "date" to "Дата", "checkbox" to "Флажок", "url" to "Ссылка", "select" to "Один вариант", "multi" to "Несколько вариантов").map { it.first to genesisTranslate(it.second) }, enabled, "template-field-type") { value -> change {
                    it.put("type", value); if (value !in setOf("select", "multi")) it.put("options", JSONArray())
                } }
                ImportChoice("Проект шаблона", field.optString("projectKey").takeUnless { it == "null" }.orEmpty().ifBlank { "@all" }, listOf("@all" to genesisTranslate("Все проекты")) + projects.map { it.getString("key") to it.getString("title").ifBlank { genesisTranslate("Без названия") } }, enabled, "template-field-project") { value -> change { it.put("projectKey", value.takeUnless { it == "@all" } ?: JSONObject.NULL) } }
                for ((flag, title) in listOf("required" to "Обязательное", "showCard" to "В карточке", "showList" to "В списке")) TemplateToggle(title, field.getBoolean(flag), enabled, "template-field-$flag") { value -> change { it.put(flag, value) } }
                val index = fields.indexOfFirst { it.getString("key") == id }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TemplateIconButton("Выше", AffairsAction.COLLAPSE, enabled && index > 0, Modifier.weight(1f)) {
                        val next = SharedTemplateEdits.copy(manifest); val sorted = SharedTemplateEdits.rows(next.getJSONArray("fields")).toMutableList()
                        val previous = sorted[index - 1]; sorted[index - 1] = sorted[index]; sorted[index] = previous
                        sorted.forEachIndexed { position, row -> row.put("position", position) }; next.put("fields", JSONArray(sorted)); state.changeManifest(next)
                    }
                    TemplateIconButton("Ниже", AffairsAction.EXPAND, enabled && index < fields.lastIndex, Modifier.weight(1f)) {
                        val next = SharedTemplateEdits.copy(manifest); val sorted = SharedTemplateEdits.rows(next.getJSONArray("fields")).toMutableList()
                        val following = sorted[index + 1]; sorted[index + 1] = sorted[index]; sorted[index] = following
                        sorted.forEachIndexed { position, row -> row.put("position", position) }; next.put("fields", JSONArray(sorted)); state.changeManifest(next)
                    }
                    TemplateIconButton("Убрать", AffairsAction.DELETE, enabled, Modifier.weight(1f)) { deleting = id }
                }
                if (field.getString("type") in setOf("select", "multi")) {
                    val options = SharedTemplateEdits.rows(field.getJSONArray("options")); var optionLimit by rememberSaveable(id) { mutableIntStateOf(5) }
                    options.take(optionLimit).forEach { option -> key(option.getString("id")) {
                        fun changeOption(action: (JSONObject) -> Unit) = change { action(SharedTemplateEdits.rows(it.getJSONArray("options")).single { row -> row.getString("id") == option.getString("id") }) }
                        TemplateField("Вариант", option.getString("title"), enabled, "template-option-title") { value -> changeOption { it.put("title", value) } }
                        TemplateToggle("Архив", option.getBoolean("archived"), enabled, "template-option-archived") { value -> changeOption { it.put("archived", value) } }
                    } }
                    if (options.size > optionLimit) OutlinedButton({ optionLimit += 5 }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Показать ещё") }
                    OutlinedButton({ change { it.getJSONArray("options").put(JSONObject().put("id", UUID.randomUUID().toString()).put("title", "").put("archived", false)) } }, enabled = enabled && options.size < 200, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Добавить вариант") }
                }
            }
        } }
        OutlinedButton({ val next = SharedTemplateEdits.copy(manifest); val id = UUID.randomUUID().toString(); next.getJSONArray("fields").put(JSONObject().put("key", id).put("projectKey", JSONObject.NULL).put("title", "").put("type", "text").put("options", JSONArray()).put("required", false).put("showCard", true).put("showList", true).put("position", fields.size)); chosen = id; state.changeManifest(next) },
            enabled = enabled && fields.size < 200, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("template-field-add")) { Text("Добавить поле") }
    }
    if (deleting != null) AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Убрать") }, text = { Text("Изменения шаблона не меняют ранее созданные задачи.") },
        confirmButton = { TextButton({ state.changeManifest(SharedTemplateEdits.removeField(manifest, requireNotNull(deleting))); deleting = null }) { Text("Убрать") } }, dismissButton = { TextButton({ deleting = null }) { Text("Отмена") } })
}
