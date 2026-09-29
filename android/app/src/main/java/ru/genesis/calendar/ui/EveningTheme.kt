package ru.genesis.calendar.ui

import android.app.TimePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalTime
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.HabitsRepository
import ru.genesis.calendar.data.LocalHabitWorkspace

internal val LocalEveningTheme = staticCompositionLocalOf { false }
internal val LocalPreserveCalendarColors = staticCompositionLocalOf { false }

internal data class AppearanceSettings(val mode: String = "light", val lightAt: String = "07:00",
    val darkAt: String = "21:00") {
    fun isEvening(time: LocalTime, systemDark: Boolean): Boolean = when (mode) {
        "evening" -> true
        "system" -> systemDark
        "scheduled" -> {
            val light = LocalTime.parse(lightAt)
            val dark = LocalTime.parse(darkAt)
            if (dark < light) time >= dark && time < light else time >= dark || time < light
        }
        else -> false
    }
    fun json() = JSONObject().put("mode", mode).put("lightAt", lightAt).put("darkAt", darkAt)
    companion object {
        fun read(raw: String): AppearanceSettings {
            val value = runCatching { JSONObject(raw).optJSONObject("nativeAppearance") }.getOrNull()
            fun time(key: String, fallback: String) = value?.optString(key)?.takeIf {
                it.matches(Regex("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) } ?: fallback
            val light = time("lightAt", "07:00")
            val dark = time("darkAt", "21:00").takeUnless { it == light } ?: if (light == "21:00") "22:00" else "21:00"
            return AppearanceSettings(value?.optString("mode")?.takeIf {
                it in setOf("light", "evening", "system", "scheduled") } ?: "light", light, dark)
        }
    }
}

internal val evening = darkColorScheme(
    primary = Color(0xff9cb9ad), onPrimary = Color(0xff172b25),
    primaryContainer = Color(0xff2a4037), onPrimaryContainer = Color(0xffc5d4c7),
    secondary = Color(0xffb6a07a), onSecondary = Color(0xff29251e),
    secondaryContainer = Color(0xff413a2d), onSecondaryContainer = Color(0xffd0c3a9),
    background = Color(0xff141a19), onBackground = Color(0xffd3d2c7),
    surface = Color(0xff202825), onSurface = Color(0xffd3d2c7), onSurfaceVariant = Color(0xffaab2a8),
    surfaceVariant = Color(0xff303932), surfaceContainerLowest = Color(0xff19201d),
    surfaceContainerLow = Color(0xff202825), surfaceContainer = Color(0xff252e29),
    surfaceContainerHigh = Color(0xff2c352e), surfaceContainerHighest = Color(0xff333d35),
    outline = Color(0xff798175), outlineVariant = Color(0xff454f44),
    error = Color(0xffcf9c93), onError = Color(0xff33201d),
    errorContainer = Color(0xff4c3430), onErrorContainer = Color(0xffddbbb3))

@Composable internal fun rememberEveningTheme(settings: AppearanceSettings): Boolean {
    val deviceDark = isSystemInDarkTheme()
    val time by produceState(LocalTime.now()) {
        while (true) { value = LocalTime.now(); delay(15_000) }
    }
    return settings.isEvening(time, deviceDark)
}

/** Retain the meaning of the existing warm/green surfaces with a low evening luminance. */
internal fun eveningSurfaceTone(color: Color): Color {
    if (color == Color.Unspecified || color.alpha < .4f) return color
    val base = Color(0xff202825)
    val luminance = color.luminance()
    if (luminance < .035f) return color
    val amount = if (luminance > .5f) .10f else .20f
    return Color(base.red * (1 - amount) + color.red * amount,
        base.green * (1 - amount) + color.green * amount,
        base.blue * (1 - amount) + color.blue * amount, color.alpha)
}

@Composable internal fun eveningSurface(color: Color): Color =
    if (LocalEveningTheme.current && !LocalPreserveCalendarColors.current && color !in setOf(evening.background, evening.surface,
        evening.surfaceContainerLowest, evening.surfaceContainerLow, evening.surfaceContainer,
        evening.surfaceContainerHigh, evening.surfaceContainerHighest, evening.primaryContainer,
        evening.secondaryContainer, evening.errorContainer, evening.primary, evening.secondary)) eveningSurfaceTone(color) else color

@Composable internal fun eveningInk(color: Color): Color {
    if (!LocalEveningTheme.current || LocalPreserveCalendarColors.current || color == Color.Unspecified) return color
    if (color in setOf(evening.onPrimary, evening.onSecondary, evening.onSurface, evening.onBackground,
        evening.onSurfaceVariant, evening.onPrimaryContainer, evening.onSecondaryContainer,
        evening.primary, evening.secondary, evening.error, evening.onError, evening.onErrorContainer)) return color
    if (color.luminance() > .45f) return Color(color.red * .80f, color.green * .80f, color.blue * .80f, color.alpha)
    val tint = Color(0xffc9cdc1)
    return Color(tint.red * .8f + color.red * .2f, tint.green * .8f + color.green * .2f,
        tint.blue * .8f + color.blue * .2f, color.alpha)
}

@Composable internal fun AppearancePanel(app: GenesisApplication, workspace: LocalHabitWorkspace, use24: Boolean) {
    val appearance = AppearanceSettings.read(workspace.settings.rawJson)
    val scope = rememberCoroutineScope()
    val repository = remember(app, app.workspaceScope) { HabitsRepository(app) }
    val context = LocalContext.current
    val timeDialogTheme = if(LocalEveningTheme.current) android.R.style.Theme_DeviceDefault_Dialog else
        android.R.style.Theme_DeviceDefault_Light_Dialog
    var error by remember { mutableStateOf<String?>(null) }
    fun save(next: AppearanceSettings) {
        scope.launch {
            runCatching { repository.updateAppearance(next.json()) }
                .onSuccess { error = null }.onFailure { error = "Не удалось сохранить тему. Повторите попытку." }
        }
    }
    fun chooseTime(light: Boolean) {
        val current = LocalTime.parse(if (light) appearance.lightAt else appearance.darkAt)
        TimePickerDialog(context, timeDialogTheme, { _, hour, minute ->
            val value = "%02d:%02d".format(hour, minute)
            val next = if (light) appearance.copy(lightAt = value) else appearance.copy(darkAt = value)
            if (next.lightAt == next.darkAt) error = "Выберите разное время для светлой и вечерней темы."
            else save(next)
        }, current.hour, current.minute, use24).show()
    }
    Card(Modifier.fillMaxWidth().testTag("appearance-settings"), shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Оформление", style = MaterialTheme.typography.titleLarge)
            Text("Вечерняя тема использует мягкие оттенки и приглушённые акценты.", style = MaterialTheme.typography.bodySmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("light" to "Светлая", "evening" to "Вечерняя", "system" to "Как на устройстве").forEach { (mode, label) ->
                    FilterChip(appearance.mode == mode, { save(appearance.copy(mode = mode)) }, label = { Text(label) },
                        modifier = Modifier.testTag("appearance-$mode").heightIn(min = 48.dp))
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Менять по времени устройства", Modifier.weight(1f).padding(top = 12.dp))
                Switch(appearance.mode == "scheduled", { save(appearance.copy(mode = if (it) "scheduled" else "light")) },
                    modifier = Modifier.testTag("appearance-scheduled"))
            }
            if (appearance.mode == "scheduled") {
                OutlinedButton({ chooseTime(true) }, Modifier.fillMaxWidth().testTag("appearance-light-time")) {
                    Text("Светлая тема с ${timeLabel(appearance.lightAt, use24)}") }
                OutlinedButton({ chooseTime(false) }, Modifier.fillMaxWidth().testTag("appearance-dark-time")) {
                    Text("Вечерняя тема с ${timeLabel(appearance.darkAt, use24)}") }
                Text("Используются часы и часовой пояс смартфона.", style = MaterialTheme.typography.bodySmall)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}
