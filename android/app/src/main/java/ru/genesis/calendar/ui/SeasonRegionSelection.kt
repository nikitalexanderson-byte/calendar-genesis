package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.genesis.calendar.data.UiPreferences
import java.net.HttpURLConnection
import java.net.URL
import java.time.ZoneId
import org.json.JSONObject

internal data class SeasonRegionChoice(val label: String, val zoneId: String)

/** Representative climate regions. A city selects its hemisphere and landscape palette. */
internal val seasonRegionChoices = listOf(
    SeasonRegionChoice("Центральная и Восточная Европа · Москва", "Europe/Moscow"),
    SeasonRegionChoice("Северная Европа · Хельсинки", "Europe/Helsinki"),
    SeasonRegionChoice("Средиземноморье · Рим", "Europe/Rome"),
    SeasonRegionChoice("Ближний Восток · Эр-Рияд", "Asia/Riyadh"),
    SeasonRegionChoice("Юго-Восточная Азия · Сингапур", "Asia/Singapore"),
    SeasonRegionChoice("Восточная Азия · Токио", "Asia/Tokyo"),
    SeasonRegionChoice("Северная Америка · Нью-Йорк", "America/New_York"),
    SeasonRegionChoice("Тихоокеанское побережье · Лос-Анджелес", "America/Los_Angeles"),
    SeasonRegionChoice("Пустынный юго-запад · Финикс", "America/Phoenix"),
    SeasonRegionChoice("Тропическая Южная Америка · Сан-Паулу", "America/Sao_Paulo"),
    SeasonRegionChoice("Аргентина · Буэнос-Айрес", "America/Argentina/Buenos_Aires"),
    SeasonRegionChoice("Чили · Сантьяго", "America/Santiago"),
    SeasonRegionChoice("Южная Африка · Кейптаун", "Africa/Johannesburg"),
    SeasonRegionChoice("Австралия · Сидней", "Australia/Sydney"),
    SeasonRegionChoice("Австралия · Перт", "Australia/Perth"),
    SeasonRegionChoice("Север Австралии · Дарвин", "Australia/Darwin"),
    SeasonRegionChoice("Новая Зеландия · Окленд", "Pacific/Auckland"),
)

internal fun selectedSeasonZone(prefs: UiPreferences): ZoneId = when (prefs.regionSource) {
    "manual" -> runCatching { ZoneId.of(prefs.manualRegionZone) }.getOrDefault(ZoneId.systemDefault())
    "ip" -> runCatching { ZoneId.of(prefs.ipRegionZone) }.getOrDefault(ZoneId.systemDefault())
    else -> ZoneId.systemDefault()
}

/** Called only after the user selects IP detection or explicitly refreshes it. */
internal fun resolveSeasonZoneByIp(): ZoneId {
    val connection = URL("https://ipapi.co/json/").openConnection() as HttpURLConnection
    connection.connectTimeout = 5_000
    connection.readTimeout = 5_000
    connection.setRequestProperty("Accept", "application/json")
    try {
        require(connection.responseCode == HttpURLConnection.HTTP_OK) { "IP service unavailable" }
        val body = connection.inputStream.bufferedReader().use { it.readText() }
        require(body.length < 32_768) { "Unexpected IP response" }
        val response = JSONObject(body)
        require(!response.optBoolean("error")) { "IP lookup failed" }
        return ZoneId.of(response.getString("timezone"))
    } finally {
        connection.disconnect()
    }
}

@Composable
internal fun SeasonRegionSettings(prefs: UiPreferences, onSetLocal: (String, String) -> Unit) {
    var showManual by remember { mutableStateOf(false) }
    var resolvingIp by remember { mutableStateOf(false) }
    var ipError by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun refreshIp() {
        if (resolvingIp) return
        scope.launch {
            resolvingIp = true
            ipError = false
            val result = runCatching { withContext(Dispatchers.IO) { resolveSeasonZoneByIp() } }
            result.onSuccess { onSetLocal("ipRegionZone", it.id) }
                .onFailure { ipError = true }
            resolvingIp = false
        }
    }
    SettingsSection("◉", "Регион", "Для изображений и времён года григорианского календаря",
        Color(0xffe2eee6)) {
        Text("Определять регион", style = MaterialTheme.typography.titleSmall)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("device" to "Устройство", "ip" to "IP-адрес", "manual" to "Вручную")
                .forEach { (source, title) ->
                    FilterChip(selected = prefs.regionSource == source,
                        onClick = {
                            if (source == "manual") showManual = true else {
                                onSetLocal("regionSource", source)
                                if (source == "ip") refreshIp()
                            }
                        }, modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                            .testTag("region-source-$source"), label = { Text(title, maxLines = 1) })
                }
        }
        Text("Выбран: ${seasonRegionChoices.firstOrNull { it.zoneId == selectedSeasonZone(prefs).id }?.label ?: selectedSeasonZone(prefs).id}",
            style = MaterialTheme.typography.bodySmall)
        if (prefs.regionSource == "manual") {
            OutlinedButton(onClick = { showManual = true },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("region-manual-choose")) {
                Text("Выбрать регион из списка")
            }
        }
        if (prefs.regionSource == "ip") {
            Text("При определении по IP запрос отправляется сервису ipapi.co. Местоположение может быть неточным, особенно с VPN. Если сохранённого результата нет, используется регион устройства.",
                style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = ::refreshIp, enabled = !resolvingIp,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("region-ip-refresh")) {
                Text(if (resolvingIp) "Определяем…" else "Обновить регион по IP")
            }
            if (ipError) Text("Не удалось определить регион по IP. Проверьте интернет или выберите регион вручную.",
                color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
    if (showManual) Dialog(onDismissRequest = { showManual = false }) {
        Surface(shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Выберите регион", style = MaterialTheme.typography.titleLarge)
                LazyColumn(Modifier.heightIn(max = 500.dp).testTag("region-manual-list"),
                    verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(seasonRegionChoices) { choice ->
                        TextButton(onClick = {
                            onSetLocal("manualRegionZone", choice.zoneId)
                            onSetLocal("regionSource", "manual")
                            showManual = false
                        }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                            .testTag("region-choice-${choice.zoneId.replace('/', '-')}")
                            .semantics { selected = prefs.regionSource == "manual" &&
                                prefs.manualRegionZone == choice.zoneId }) {
                            RadioButton(selected = prefs.regionSource == "manual" &&
                                prefs.manualRegionZone == choice.zoneId, onClick = null)
                            Text(choice.label, modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
                TextButton(onClick = { showManual = false }) { Text("Закрыть") }
            }
        }
    }
}
