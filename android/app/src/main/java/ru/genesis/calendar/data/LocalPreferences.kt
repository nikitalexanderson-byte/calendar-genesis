package ru.genesis.calendar.data

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map
import ru.genesis.calendar.domain.CalendarMode

private val Context.genesisPreferences by preferencesDataStore("genesis_preferences")
data class UiPreferences(val display: CalendarMode = CalendarMode.SACRED,
    val input: CalendarMode = CalendarMode.SACRED, val use24: Boolean = true,
    val divinationDisabled: Boolean = false, val language: String = "ru")
class LocalPreferences(private val context: Context, private val scope: String) {
    private fun key(name: String) = stringPreferencesKey("$scope:$name")
    val values = context.genesisPreferences.data.map {
        UiPreferences(CalendarMode.fromWire(it[key("display")] ?: "sacred"), CalendarMode.fromWire(it[key("input")] ?: "sacred"),
            it[key("time")] != "12h", it[key("stoicheionDivinationDisabled")] == "true",
            it[key("language")].takeIf { value -> value == "en" } ?: "ru")
    }
    suspend fun set(name: String, value: String) { context.genesisPreferences.edit { it[key(name)] = value } }
}
