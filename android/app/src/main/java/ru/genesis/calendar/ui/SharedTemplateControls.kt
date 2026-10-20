package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.CustomFieldDraft
import ru.genesis.calendar.auth.SharedTemplateManifest
import java.text.NumberFormat
import java.util.Locale

@Composable internal fun sharedTemplateCopy(): JSONObject {
    val context = LocalContext.current; val language = LocalGenesisLanguage.current
    val all = remember(context) { context.assets.open("originals/i18n/native-template-translations.json").bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) } }
    return remember(all, language) { all.optJSONObject(language) ?: all.getJSONObject("ru") }
}

@Composable internal fun templateLocalizedLabel(source: String): String {
    val context = LocalContext.current; val language = LocalGenesisLanguage.current
    val all = remember(context) { context.assets.open("originals/i18n/native-template-labels.json").bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) } }
    return (all.optJSONObject(language) ?: all.getJSONObject("ru")).getString(source)
}

internal fun templateIssueMessage(code: String, copy: JSONObject) = copy.getJSONObject("issues").optString(
    if (code in setOf("TEMPLATE_PERMISSION_CHANGED", "TEMPLATE_FORBIDDEN", "SHARED_PROJECT_FORBIDDEN", "SHARED_PROJECT_NOT_FOUND",
            "SHARED_SPACE_FORBIDDEN", "SHARED_SPACE_NOT_FOUND", "UNAUTHORIZED")) "TEMPLATE_PERMISSION_CHANGED" else code).takeIf { it.isNotBlank() }
    ?: customFieldMessage(code) ?: copy.getJSONObject("issues").getString("TEMPLATE_INVALID")

@Composable internal fun TemplateField(label: String, value: String, enabled: Boolean, tag: String,
    lines: Int = 1, number: Boolean = false, maxLength: Int = if (lines == 1) 160 else 20000,
    labelIsLocalized: Boolean = false, onChange: (String) -> Unit) {
    val description = if (labelIsLocalized) label else genesisTranslate(label)
    OutlinedTextField(value, { onChange(it.substring(0, it.offsetByCodePoints(0, minOf(maxLength, it.codePointCount(0, it.length))))) }, label = { androidx.compose.material3.Text(description) }, enabled = enabled, singleLine = lines == 1,
        minLines = lines, maxLines = if (lines == 1) 1 else 5, textStyle = MaterialTheme.typography.bodyMedium,
        keyboardOptions = KeyboardOptions(keyboardType = if (number) KeyboardType.Decimal else KeyboardType.Text),
        shape = AffairsLayout.shape, modifier = Modifier.fillMaxWidth().testTag(tag))
}

@Composable internal fun TemplateOutlinedButton(onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, shape: androidx.compose.ui.graphics.Shape = AffairsLayout.shape,
    content: @Composable RowScope.() -> Unit) {
    OutlinedButton(onClick, modifier.heightIn(min = 48.dp), enabled = enabled, shape = shape, content = content)
}

@Composable internal fun TemplateToggle(label: String, selected: Boolean, enabled: Boolean, tag: String,
    labelIsLocalized: Boolean = false, onChange: (Boolean) -> Unit) {
    val description = if (labelIsLocalized) label else genesisTranslate(label)
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag(tag)
        .toggleable(selected, enabled = enabled, role = Role.Switch, onValueChange = onChange)
        .semantics(mergeDescendants = true) { contentDescription = description }, verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        androidx.compose.material3.Text(description, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Switch(selected, null, enabled = enabled, modifier = Modifier.clearAndSetSemantics { })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun TemplateIconButton(label: String, action: AffairsAction, enabled: Boolean, modifier: Modifier = Modifier, selected: Boolean = false, onClick: () -> Unit) {
    val description = genesisTranslate(label)
    Box(modifier.semantics(mergeDescendants = true) { contentDescription = description; this.selected = selected }) {
      TooltipBox(positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(), tooltip = { PlainTooltip { Text(label) } }, state = rememberTooltipState()) {
        OutlinedIconButton(onClick, enabled = enabled, shape = AffairsLayout.shape,
            colors = IconButtonDefaults.outlinedIconButtonColors(containerColor = if (selected) MaterialTheme.colorScheme.secondaryContainer else androidx.compose.ui.graphics.Color.Transparent,
                contentColor = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant),
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics { contentDescription = description; this.selected = selected }) { AffairsActionIcon(action) }
      }
    }
}

@Composable internal fun TemplateIssues(issues: JSONArray, copy: JSONObject, title: String, tag: String) {
    if (issues.length() == 0) return
    val language = LocalGenesisLanguage.current
    val number = remember(language) { NumberFormat.getIntegerInstance(Locale.forLanguageTag(language)) }
    var limit by rememberSaveable(tag) { mutableIntStateOf(5) }
    AffairsDisclosure(title, Modifier.testTag(tag), initiallyExpanded = title == "Нужно исправить") {
        SharedTemplateManifest.rows(issues, Int.MAX_VALUE).take(limit).forEachIndexed { index, issue ->
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val code = issue.getString("code")
                val message = if (code == "OPTION_EXCLUDED" && issue.has("option")) copy.getJSONObject("options").optString(issue.getString("option")) + ": " + genesisTranslate("Не переносится")
                    else templateIssueMessage(code, copy)
                androidx.compose.material3.Text(message, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.testTag("$tag-$index"))
                if (issue.has("title")) androidx.compose.material3.Text(issue.getString("title"), style = MaterialTheme.typography.bodyMedium)
                if (issue.has("date")) androidx.compose.material3.Text(issue.getString("date"), style = MaterialTheme.typography.bodySmall)
                if (issue.has("count")) androidx.compose.material3.Text(number.format(issue.getInt("count")), style = MaterialTheme.typography.bodySmall)
            }
        }
        if (issues.length() > limit) TemplateOutlinedButton({ limit += 5 }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("$tag-more")) { Text("Показать ещё") }
    }
}

/** C1 reuses the seven existing typed controls; content and opaque mapping keys never become UI labels. */
@Composable internal fun TemplateCustomValues(manifest: JSONObject, task: JSONObject, calendar: SharedCustomCalendar,
    enabled: Boolean, onCalendar: (SharedCustomCalendar) -> Unit, onChange: (JSONObject) -> Unit) {
    val fields = SharedTemplateManifest.rows(manifest.getJSONArray("fields"), 200).filter { it.isNull("projectKey") || it.opt("projectKey") == task.getString("projectKey") }
    if (fields.isEmpty()) return
    val values = task.getJSONObject("customValues"); val mapped = JSONObject()
    fields.forEach { field -> if (values.has(field.getString("key"))) mapped.put(SharedTemplateManifest.inputId(field.getString("key")), SharedTemplateManifest.optionValue(field, values.get(field.getString("key")), true)) }
    val draft = CustomFieldDraft.fromTask(JSONObject().put("customFields", mapped))
    val errors = draft.errors(fields.map { SharedTemplateManifest.fieldAdapter(it).put("required", false) })
    var limit by rememberSaveable(task.getString("key")) { mutableIntStateOf(5) }
    AffairsDisclosure("Значения полей") {
        fields.take(limit).forEach { field -> key(field.getString("key")) {
            val adapter = SharedTemplateManifest.fieldAdapter(field)
            SharedCustomField(adapter, draft, errors[adapter.getString("id")], false, calendar, true, !enabled, Modifier.fillMaxWidth(),
                onValue = { _, value ->
                    val next = JSONObject(values.toString()).put(field.getString("key"), SharedTemplateManifest.optionValue(field, value, false))
                    onChange(next)
                }, onReset = { }, onCalendar = onCalendar)
        } }
        if (fields.size > limit) TemplateOutlinedButton({ limit += 5 }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("template-fields-more")) { Text("Показать ещё") }
    }
}
