package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SolarLocation
import ru.genesis.calendar.domain.SolarTimes
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.ConcurrentHashMap

private object AutomaticSolarLocation {
    private val cache = ConcurrentHashMap<String, SolarLocation>()
    private val locks = ConcurrentHashMap<String, Mutex>()

    suspend fun get(zoneId: ZoneId): SolarLocation = cache[zoneId.id] ?: locks.getOrPut(zoneId.id) { Mutex() }
        .withLock {
            cache[zoneId.id] ?: runCatching { networkLocation() }
                .getOrElse { SolarTimes.fallbackLocation(zoneId) }
                .also { cache[zoneId.id] = it }
        }

    private suspend fun networkLocation(): SolarLocation = withContext(Dispatchers.IO) {
        val connection = URL("https://get.geojs.io/v1/ip/geo.json").openConnection() as HttpURLConnection
        connection.connectTimeout = 2_500
        connection.readTimeout = 2_500
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/json")
        try {
            require(connection.responseCode in 200..299)
            val json = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val latitude = json.get("latitude").toString().toDouble()
            val longitude = json.get("longitude").toString().toDouble()
            require(latitude in -90.0..90.0 && longitude in -180.0..180.0)
            SolarLocation(latitude, longitude)
        } finally {
            connection.disconnect()
        }
    }
}

@Composable
internal fun rememberAutomaticSolarLocation(zoneId: ZoneId): State<SolarLocation> =
    produceState(initialValue = SolarTimes.fallbackLocation(zoneId), zoneId) {
        value = AutomaticSolarLocation.get(zoneId)
    }

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
