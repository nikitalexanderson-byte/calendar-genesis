package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import java.util.Locale
import kotlin.math.roundToInt

internal fun validCategoryColor(value: String) = Regex("#[0-9a-fA-F]{6}").matches(value)

private fun hsvHex(hue: Float, saturation: Float, brightness: Float): String =
    String.format(Locale.ROOT, "#%06X", android.graphics.Color.HSVToColor(floatArrayOf(hue, saturation, brightness)) and 0xffffff)

private val categoryPalette = listOf("#FFFFFF", "#D6D5CF", "#9EAAA3", "#67736C", "#3B4640", "#171D19",
    "#2D6C68", "#A5543F", "#B18B48", "#665C88", "#54718A", "#B65472") +
    (0 until 12).flatMap { hue -> listOf(.88f to .82f, .68f to .70f, .48f to .94f, .26f to .98f)
        .map { (saturation, brightness) -> hsvHex(hue * 30f, saturation, brightness) } }

/** The preview and swatches keep the exact stored colour in both themes. */
@Composable internal fun CategoryColorPicker(value: String, onChange: (String) -> Unit) {
    val valid = validCategoryColor(value)
    var lastValid by remember { mutableStateOf(if (valid) value else "#2D6C68") }
    if (valid && lastValid != value) SideEffect { lastValid = value }
    val preview = Color((if (valid) value else lastValid).toColorInt())
    var custom by remember { mutableStateOf(false) }
    val hsv = remember { FloatArray(3).also { android.graphics.Color.colorToHSV(preview.toArgb(), it) } }
    var hue by remember { mutableFloatStateOf(hsv[0]) }
    var saturation by remember { mutableFloatStateOf(hsv[1]) }
    var brightness by remember { mutableFloatStateOf(hsv[2]) }
    val hueLabel = genesisTranslate("Оттенок")
    val saturationLabel = genesisTranslate("Насыщенность")
    val brightnessLabel = genesisTranslate("Яркость")
    val colorLabel = genesisTranslate("Цвет")
    fun pick(color: String) {
        android.graphics.Color.colorToHSV(color.toColorInt(), hsv)
        hue = hsv[0]; saturation = hsv[1]; brightness = hsv[2]
        onChange(color)
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            androidx.compose.material3.Surface(Modifier.size(48.dp).testTag("category-color-preview"),
                shape = CircleShape, color = preview, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {}
            OutlinedTextField(value.uppercase(Locale.ROOT), { input ->
                val next = "#" + input.removePrefix("#").take(6).uppercase(Locale.ROOT)
                if (validCategoryColor(next)) pick(next) else onChange(next)
            }, Modifier.weight(1f).testTag("category-color-hex"), label = { Text("Цвет HEX") },
                singleLine = true, isError = !valid, supportingText = { Text("Формат: #RRGGBB") })
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !custom, onClick = { custom = false }, label = { Text("Палитра") },
                modifier = Modifier.weight(1f).height(48.dp).testTag("category-palette-tab"))
            FilterChip(selected = custom, onClick = {
                if (valid) pick(value)
                custom = true
            }, label = { Text("Свой цвет") }, modifier = Modifier.weight(1f).height(48.dp).testTag("category-custom-color-tab"))
        }
        if (custom) {
            Text(hueLabel, style = MaterialTheme.typography.labelLarge)
            Slider(hue, { hue = it; onChange(hsvHex(hue, saturation, brightness)) },
                valueRange = 0f..360f, modifier = Modifier.testTag("category-color-hue")
                    .semantics { contentDescription = hueLabel })
            Text("$saturationLabel · ${(saturation * 100).roundToInt()}%", style = MaterialTheme.typography.labelLarge)
            Slider(saturation, { saturation = it; onChange(hsvHex(hue, saturation, brightness)) },
                modifier = Modifier.testTag("category-color-saturation")
                    .semantics { contentDescription = saturationLabel })
            Text("$brightnessLabel · ${(brightness * 100).roundToInt()}%", style = MaterialTheme.typography.labelLarge)
            Slider(brightness, { brightness = it; onChange(hsvHex(hue, saturation, brightness)) },
                modifier = Modifier.testTag("category-color-brightness")
                    .semantics { contentDescription = brightnessLabel })
        } else BoxWithConstraints {
            val columns = (maxWidth / 48.dp).toInt().coerceIn(4, 8)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                categoryPalette.chunked(columns).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        row.forEach { swatch ->
                            val picked = swatch.equals(lastValid, ignoreCase = true)
                            androidx.compose.material3.Surface(onClick = { pick(swatch) },
                                modifier = Modifier.weight(1f).height(48.dp).testTag("category-swatch-${swatch.drop(1)}")
                                    .semantics { selected = picked; contentDescription = "$colorLabel: $swatch" },
                                shape = CircleShape, color = Color.Transparent,
                                border = if (picked) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null) {
                                Box(contentAlignment = Alignment.Center) {
                                    androidx.compose.material3.Surface(Modifier.size(32.dp), shape = CircleShape,
                                        color = Color(swatch.toColorInt()),
                                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .35f))) {}
                                }
                            }
                        }
                        repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}
