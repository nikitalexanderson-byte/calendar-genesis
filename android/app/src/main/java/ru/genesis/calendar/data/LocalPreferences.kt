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
    val ipRegionZone: String = "", val ipRegionLabel: String = "",
    val fullMoonLeadDays: Set<Int> = emptySet(), val newMoonLeadDays: Set<Int> = emptySet(),
    val showMissedTasksToday: Boolean = true,
    val menuSwipeEnabled: Boolean = true, val menuSwipeSubmenus: Boolean = true,
    val settingsMenuLabels: Boolean = true, val updateRemindersEnabled: Boolean = true,
    val menuThreadsEnabled: Boolean = true)
class LocalPreferences(private val context: Context, private val scope: String) {
    private fun moonLeadDays(value: String?): Set<Int> = value.orEmpty().split(',')
        .mapNotNull { it.trim().toIntOrNull()?.takeIf { day -> day in 1..3 } }.toSet()
    private fun key(name: String) = stringPreferencesKey("$scope:$name")
    private fun pendingKey(name: String) = stringPreferencesKey("$scope:pending:$name")
    private val names = setOf("display", "input", "time", "weekStart", "gregorianYearStart",
        "language", "stoicheionDivinationDisabled", "sharedProjectsEnabled")
    val pending = context.genesisPreferences.data.map { values -> names.mapNotNull { name ->
        values[pendingKey(name)]?.let { name to it }
    }.toMap() }
    val values = context.genesisPreferences.data.map {
        UiPreferences(CalendarMode.fromWire(it[key("display")] ?: "sacred"), CalendarMode.fromWire(it[key("input")] ?: "sacred"),
            it[key("time")] != "12h", it[key("stoicheionDivinationDisabled")] == "true",
            it[key("language")].takeIf { value -> value in setOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja") }
                ?: if (scope == "welcome") regionalLanguageForDevice() else "ru",
            it[key("weekStart")] != "monday", it[key("wideNavigation")] != "top",
            it[key("navigationLabels")] == "text", it[key("navigationAutoScroll")] == "true",
            it[key("gregorianYearStart")] == "march", it[key("seasonArtMode")] == "regional",
            it[key("regionSource")].takeIf { value -> value in setOf("device", "ip", "manual") } ?: "device",
            it[key("manualRegionZone")] ?: "", it[key("ipRegionZone")] ?: "",
            it[key("ipRegionLabel")] ?: "",
            moonLeadDays(it[key("fullMoonLeadDays")]), moonLeadDays(it[key("newMoonLeadDays")]),
            it[key("showMissedTasksToday")] != "false",
            it[key("menuSwipeEnabled")] != "false", it[key("menuSwipeSubmenus")] != "false",
            it[key("settingsMenuLabels")] != "icons",
            it[key("updateRemindersEnabled")] != "false",
            it[key("menuThreadsEnabled")] != "false")
    }
    suspend fun set(name: String, value: String) { context.genesisPreferences.edit { it[key(name)] = value } }
    suspend fun initializeNewAccount() {
        context.genesisPreferences.edit { prefs ->
            mapOf("display" to "profane", "input" to "profane", "weekStart" to "monday",
                "navigationLabels" to "icons", "menuSwipeEnabled" to "true",
                "menuSwipeSubmenus" to "true", "regionSource" to "device").forEach { (name, value) ->
                if (prefs[key(name)] == null) prefs[key(name)] = value
            }
        }
    }
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
