package ru.genesis.calendar.data

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map
import ru.genesis.calendar.domain.CalendarMode

private val Context.genesisPreferences by preferencesDataStore("genesis_preferences")
data class UiPreferences(val display: CalendarMode = CalendarMode.SACRED,
    val input: CalendarMode = CalendarMode.SACRED, val use24: Boolean = true,
    val divinationDisabled: Boolean = false, val language: String = "ru",
    val weekStartsOnSunday: Boolean = true, val wideNavigationOnLeft: Boolean = true,
    val navigationLabels: Boolean = false, val navigationAutoScroll: Boolean = false,
    val gregorianYearStartsInMarch: Boolean = false, val regionalSeasonArt: Boolean = false,
    val regionSource: String = "device", val manualRegionZone: String = "",
    val ipRegionZone: String = "")
class LocalPreferences(private val context: Context, private val scope: String) {
    private fun key(name: String) = stringPreferencesKey("$scope:$name")
    private fun pendingKey(name: String) = stringPreferencesKey("$scope:pending:$name")
    private val names = setOf("display", "input", "time", "weekStart", "gregorianYearStart",
        "language", "stoicheionDivinationDisabled")
    val pending = context.genesisPreferences.data.map { values -> names.mapNotNull { name ->
        values[pendingKey(name)]?.let { name to it }
    }.toMap() }
    val values = context.genesisPreferences.data.map {
        UiPreferences(CalendarMode.fromWire(it[key("display")] ?: "sacred"), CalendarMode.fromWire(it[key("input")] ?: "sacred"),
            it[key("time")] != "12h", it[key("stoicheionDivinationDisabled")] == "true",
            it[key("language")].takeIf { value -> value == "en" } ?: "ru",
            it[key("weekStart")] != "monday", it[key("wideNavigation")] != "top",
            it[key("navigationLabels")] == "text", it[key("navigationAutoScroll")] == "true",
            it[key("gregorianYearStart")] == "march", it[key("seasonArtMode")] == "regional",
            it[key("regionSource")].takeIf { value -> value in setOf("device", "ip", "manual") } ?: "device",
            it[key("manualRegionZone")] ?: "", it[key("ipRegionZone")] ?: "")
    }
    suspend fun set(name: String, value: String) { context.genesisPreferences.edit { it[key(name)] = value } }
    suspend fun setPending(name: String, value: String) {
        require(name in names)
        context.genesisPreferences.edit { it[key(name)] = value; it[pendingKey(name)] = value }
    }
    suspend fun setRemote(name: String, value: String) {
        context.genesisPreferences.edit { if (it[pendingKey(name)] == null) it[key(name)] = value }
    }
    suspend fun acknowledge(changes: Map<String, String>) {
        context.genesisPreferences.edit { prefs -> changes.forEach { (name, value) ->
            if (prefs[pendingKey(name)] == value) prefs.remove(pendingKey(name))
        } }
    }
}
