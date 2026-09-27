package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SolarLocation
import ru.genesis.calendar.domain.SolarTimes
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
internal fun rememberAutomaticSolarLocation(zoneId: ZoneId): State<SolarLocation> =
    // IP geolocation is deliberately avoided: VPNs and mobile carrier gateways can
    // place the device on another continent. The IANA time zone is stable, private,
    // available offline, and maps to the same regional reference used by the web UI.
    remember(zoneId) { mutableStateOf(SolarTimes.fallbackLocation(zoneId)) }

internal fun solarTimeLabels(date: LocalDate, location: SolarLocation, calendar: GenesisCalendar): Pair<String, String>? {
    val times = SolarTimes.sunriseSunset(date, location, calendar.zoneId) ?: return null
    val formatter = DateTimeFormatter.ofPattern("HH:mm")
    return formatter.format(times.sunrise.atZone(calendar.zoneId)) to formatter.format(times.sunset.atZone(calendar.zoneId))
}

@Composable
internal fun SunriseSunsetLine(date: LocalDate, location: SolarLocation, calendar: GenesisCalendar,
    accent: Color = MaterialTheme.colorScheme.primary,
    textColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier: Modifier = Modifier) {
    val labels = solarTimeLabels(date, location, calendar)
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        if (labels == null) Text("☀ Полярный день или ночь", style = MaterialTheme.typography.labelMedium,
            color = textColor)
        else {
            Text("↗ Восход ${labels.first}", style = MaterialTheme.typography.labelMedium, color = accent)
            Text("↘ Закат ${labels.second}", style = MaterialTheme.typography.labelMedium, color = textColor)
        }
    }
}
