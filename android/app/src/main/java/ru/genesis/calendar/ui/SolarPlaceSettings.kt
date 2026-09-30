package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun SolarPlaceSettings() {
    val context = LocalContext.current
    val preferences = remember(context) { SolarPlaceStore.preferences(context) }
    var selected by remember { mutableStateOf(SolarPlaceStore.readSelected(preferences)) }
    var automatic by remember { mutableStateOf(SolarPlaceStore.readAutomatic(preferences)) }
    DisposableEffect(preferences) {
        val listener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            automatic = SolarPlaceStore.readAutomatic(preferences)
        }
        preferences.registerOnSharedPreferenceChangeListener(listener)
        onDispose { preferences.unregisterOnSharedPreferenceChangeListener(listener) }
    }
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<SolarPlace>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    SettingsSection("☀", "Место для восхода и заката", "Страна и город определяют координаты и местное время",
        MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.testTag("solar-place-settings")) {
        Text(selected?.placeName?.let { "Выбрано: $it" }
            ?: automatic?.placeName?.let { "≈ $it · ${automatic?.timeZoneId.orEmpty()}" }
            ?: "Город не выбран: время с символом ≈ приблизительно.",
            style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(value = query, onValueChange = { query = it },
            label = { Text("Город, страна") }, singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("solar-place-query"))
        Button(onClick = {
            scope.launch {
                loading = true
                error = null
                try {
                    results = withContext(Dispatchers.IO) { SolarPlaceStore.search(query) }
                    if (results.isEmpty()) error = "Город не найден. Уточните название и страну."
                } catch (_: Exception) { error = "Не удалось найти город. Проверьте подключение." }
                finally { loading = false }
            }
        }, enabled = query.trim().length >= 2 && !loading,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("solar-place-search")) {
            Text(if (loading) "Ищем…" else "Найти город")
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        results.forEach { place ->
            OutlinedButton(onClick = {
                SolarPlaceStore.save(preferences, place)
                selected = place.location()
                results = emptyList()
                query = place.displayName
            }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text("${place.displayName} · ${place.timeZoneId}")
            }
        }
        if (selected != null) TextButton(onClick = {
            SolarPlaceStore.clear(preferences)
            selected = null
            if (SolarPlaceStore.needsAutomaticRefresh(preferences)) scope.launch {
                withContext(Dispatchers.IO) { SolarPlaceStore.refreshAutomatic(preferences) }
            }
        }) { Text("Сбросить выбор города") }
    }
}
