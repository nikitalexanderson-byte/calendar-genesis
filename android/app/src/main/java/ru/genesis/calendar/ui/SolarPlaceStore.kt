package ru.genesis.calendar.ui

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import ru.genesis.calendar.domain.SolarLocation
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.io.ByteArrayOutputStream
import java.time.ZoneId

internal data class SolarPlace(val name: String, val country: String, val region: String,
    val latitude: Double, val longitude: Double, val timeZoneId: String) {
    val displayName: String get() = listOf(name, region, country).filter(String::isNotBlank).distinct().joinToString(", ")
    fun location() = SolarLocation(latitude, longitude, timeZoneId, displayName, approximate = false)
}

internal object SolarPlaceStore {
    private const val PREFS = "genesis.solar.place.v1"
    private const val KEY = "selected"
    private const val AUTO_KEY = "automatic"
    private const val AUTO_TIME_KEY = "automaticAt"
    private const val AUTOMATIC_REFRESH_MS = 30 * 60 * 1000L

    fun preferences(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun read(prefs: SharedPreferences): SolarLocation? = readSelected(prefs) ?: readAutomatic(prefs)

    fun readSelected(prefs: SharedPreferences): SolarLocation? = parse(prefs.getString(KEY, null), false)

    fun readAutomatic(prefs: SharedPreferences): SolarLocation? = parse(prefs.getString(AUTO_KEY, null), true)

    private fun parse(raw: String?, approximate: Boolean): SolarLocation? = runCatching {
        if (raw == null) return null
        val data = JSONObject(raw)
        val latitude = data.getDouble("latitude")
        val longitude = data.getDouble("longitude")
        if (!latitude.isFinite() || latitude !in -90.0..90.0 ||
            !longitude.isFinite() || longitude !in -180.0..180.0) return null
        val zone = ZoneId.of(data.getString("timeZoneId")).id
        SolarLocation(latitude, longitude, zone, data.getString("name"), approximate)
    }.getOrNull()

    fun save(prefs: SharedPreferences, place: SolarPlace) {
        prefs.edit().putString(KEY, JSONObject()
            .put("latitude", place.latitude).put("longitude", place.longitude)
            .put("timeZoneId", place.timeZoneId).put("name", place.displayName).toString()).apply()
    }

    fun clear(prefs: SharedPreferences) { prefs.edit().remove(KEY).apply() }

    fun needsAutomaticRefresh(prefs: SharedPreferences): Boolean =
        System.currentTimeMillis() - prefs.getLong(AUTO_TIME_KEY, 0L) >= AUTOMATIC_REFRESH_MS

    /** IP coordinates are approximate; a manually selected city always overrides them. */
    fun refreshAutomatic(prefs: SharedPreferences) {
        try {
            val connection = URL("https://get.geojs.io/v1/ip/geo.json").openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 4_000
                connection.readTimeout = 4_000
                connection.setRequestProperty("Accept", "application/json")
                if (connection.responseCode != 200) return
                val bytes = connection.inputStream.use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(4096)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (output.size() + count > 20_000) return
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                val data = JSONObject(String(bytes, Charsets.UTF_8))
                val latitude = data.optString("latitude").toDoubleOrNull() ?: return
                val longitude = data.optString("longitude").toDoubleOrNull() ?: return
                val zone = data.optString("timezone")
                if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0 ||
                    runCatching { ZoneId.of(zone) }.isFailure) return
                val name = listOf(data.optString("city"), data.optString("region"),
                    data.optString("country")).filter(String::isNotBlank).distinct().joinToString(", ")
                prefs.edit().putString(AUTO_KEY, JSONObject()
                    .put("latitude", latitude).put("longitude", longitude)
                    .put("timeZoneId", zone).put("name", name).toString())
                    .putLong(AUTO_TIME_KEY, System.currentTimeMillis()).apply()
            } finally { connection.disconnect() }
        } catch (_: Exception) { /* Keep the previous region or the marked time-zone fallback. */ }
    }

    /** City coordinates and IANA zone are public geocoding data; no account or position is sent. */
    fun search(query: String): List<SolarPlace> {
        val term = query.trim().take(120)
        if (term.length < 2) return emptyList()
        val encoded = URLEncoder.encode(term, "UTF-8")
        val connection = URL("https://geocoding-api.open-meteo.com/v1/search?name=$encoded&count=10&format=json")
            .openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode != 200) return emptyList()
            val bytes = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > 200_000) return emptyList()
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
            if (bytes.size > 200_000) return emptyList()
            val rows = JSONObject(String(bytes, Charsets.UTF_8)).optJSONArray("results") ?: return emptyList()
            return (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val latitude = row.optDouble("latitude", Double.NaN)
                val longitude = row.optDouble("longitude", Double.NaN)
                val zone = row.optString("timezone")
                if (!latitude.isFinite() || latitude !in -90.0..90.0 ||
                    !longitude.isFinite() || longitude !in -180.0..180.0 ||
                    runCatching { ZoneId.of(zone) }.isFailure) return@mapNotNull null
                SolarPlace(row.optString("name"), row.optString("country"),
                    row.optString("admin1"), latitude, longitude, zone)
            }
        } finally { connection.disconnect() }
    }
}
