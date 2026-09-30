package ru.genesis.calendar.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.UiPreferences
import ru.genesis.calendar.reminders.MoonReminderScheduler

@Composable
internal fun MoonReminderSettings(app: GenesisApplication, prefs: UiPreferences,
    onSetLocal: (String, String) -> Unit) {
    LaunchedEffect(app.workspaceScope, prefs.fullMoonLeadDays, prefs.newMoonLeadDays) {
        MoonReminderScheduler.restore(app)
    }
    SettingsSection("☾", "Лунные напоминания", "Отдельное напоминание о каждой фазе",
        Color(0xffe7e9f3)) {
        Text("Полнолуние", style = MaterialTheme.typography.titleSmall)
        MoonLeadChoices("full", prefs.fullMoonLeadDays) { onSetLocal("fullMoonLeadDays", it.toString()) }
        Text("Новолуние", style = MaterialTheme.typography.titleSmall)
        MoonLeadChoices("new", prefs.newMoonLeadDays) { onSetLocal("newMoonLeadDays", it.toString()) }
        Text("Уведомление приходит в 09:00 по времени устройства за выбранное число суток до фазы.",
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun MoonLeadChoices(kind: String, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        (0..3).forEach { days ->
            FilterChip(selected = selected == days, onClick = { onSelect(days) },
                label = { Text(if (days == 0) "Выключено" else "За $days ${if (days == 1) "сутки" else "суток"}") },
                modifier = Modifier.heightIn(min = 48.dp).testTag("moon-$kind-lead-$days"))
        }
    }
}
