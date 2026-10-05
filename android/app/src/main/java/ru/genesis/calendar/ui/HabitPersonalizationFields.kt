package ru.genesis.calendar.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

internal val habitColors = listOf(
    "#bb8f4a", "#2d7771", "#5271a8", "#8b5f83", "#9b5d4a", "#668b55", "#b06779",
    "#c7a84b", "#348c83", "#3d8fb0", "#3f5e98", "#7258a3", "#a65372", "#c8534f",
    "#cf713d", "#7e6a55", "#5f6f77", "#687271", "#294b4a", "#1f3c5a", "#2a2524",
)
private val habitEmojis = listOf("✨", "🎯", "💪", "🧠", "📚", "🧘", "🏃", "🌿", "💧", "🌙", "☀️", "🔥")
internal val habitRituals = listOf(
    "none" to "Без ритуала", "morning" to "Утро", "day" to "День",
    "evening" to "Вечер", "custom" to "Своя группа",
)

internal fun normalizedHabitColor(value: String): String? = value.trim().lowercase().takeIf {
    it.matches(Regex("#[0-9a-f]{6}"))
}
internal fun normalizedHabitEmoji(value: String): String? {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return null
    val segments = java.text.BreakIterator.getCharacterInstance(java.util.Locale.ROOT)
    segments.setText(trimmed)
    val end = segments.next()
    if (end == java.text.BreakIterator.DONE) return null
    val first = trimmed.substring(0,end)
    return first.takeIf { it.codePoints().anyMatch { codePoint ->
        Character.getType(codePoint) == Character.OTHER_SYMBOL.toInt()
    } }
}

@Composable
internal fun HabitPersonalizationFields(emoji: String, color: String, isKeyHabit: Boolean,
    ritualId: String, ritualName: String, enabled: Boolean,
    onEmoji: (String) -> Unit, onColor: (String) -> Unit, onKeyHabit: (Boolean) -> Unit,
    onRitual: (String) -> Unit, onRitualName: (String) -> Unit) {
    Text("Эмодзи привычки", style = MaterialTheme.typography.titleSmall)
    Row(Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        habitEmojis.forEach { option ->
            FilterChip(selected = emoji == option, onClick = { onEmoji(option) }, enabled = enabled,
                label = { Text(option) })
        }
    }
    OutlinedTextField(emoji, onEmoji, enabled = enabled, singleLine = true,
        isError = normalizedHabitEmoji(emoji) == null,
        label = { Text("Свой эмодзи") }, modifier = Modifier.fillMaxWidth().testTag("habit-emoji"))
    Text("Цвет привычки", style = MaterialTheme.typography.titleSmall)
    Row(Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        habitColors.forEach { option ->
            val selected = color.equals(option, ignoreCase = true)
            Surface(Modifier.size(if (selected) 38.dp else 32.dp)
                .clickable(enabled = enabled) { onColor(option) }
                .semantics { contentDescription = "Цвет $option"; this.selected = selected }
                .testTag("habit-color-$option"), shape = CircleShape,
                color = Color(android.graphics.Color.parseColor(option)),
                border = if (selected) androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.onSurface)
                    else null) {}
        }
    }
    OutlinedTextField(color, onColor, enabled = enabled, singleLine = true,
        label = { Text("Свой цвет · #RRGGBB") }, isError = normalizedHabitColor(color) == null,
        modifier = Modifier.fillMaxWidth().testTag("habit-custom-color"))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Switch(isKeyHabit, onKeyHabit, enabled = enabled, modifier = Modifier.testTag("habit-key-role"))
        Text("Главная привычка", Modifier.padding(start = 8.dp))
    }
    Text("В фокусе может быть только одна привычка. Дополнительный XP не начисляется.",
        style = MaterialTheme.typography.bodySmall)
    Text("Ритуал", style = MaterialTheme.typography.titleSmall)
    Row(Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        habitRituals.forEach { (id, title) ->
            FilterChip(selected = ritualId == id, onClick = { onRitual(id) }, enabled = enabled,
                label = { Text(title) }, modifier = Modifier.testTag("habit-ritual-$id"))
        }
    }
    if (ritualId == "custom") OutlinedTextField(ritualName, onRitualName, enabled = enabled,
        singleLine = true, label = { Text("Название группы") },
        modifier = Modifier.fillMaxWidth().testTag("habit-ritual-name"))
}
