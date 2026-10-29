package ru.genesis.calendar.auth

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

internal val adviceCategories = listOf("aretology", "hermetica", "kourotrophy", "hestiology", "aphrodisia", "psychopompia")
internal val adviceTopics = listOf("nutrition", "training", "recovery", "discipline", "clothing", "attributes", "cleaning", "home_order")

data class AdvicePreferences(val enabled: Boolean = true, val smart: Boolean = true,
    val categories: List<String> = adviceCategories.filter { it != "aphrodisia" }, val aphrodisiaAdult: Boolean? = null) {
    fun toJson(): JSONObject = JSONObject().put("enabled", enabled).put("smart", smart).put("categories", JSONArray(categories))
        .put("aphrodisiaAdult", aphrodisiaAdult ?: JSONObject.NULL)
    companion object {
        fun fromJson(value: JSONObject?): AdvicePreferences {
            val selected = value?.optJSONArray("categories")
            val adult = value?.opt("aphrodisiaAdult") as? Boolean
            val categories = adviceCategories.filter { id -> (selected == null || (0 until selected.length()).any { selected.optString(it) == id }) &&
                (id != "aphrodisia" || adult != null) }
            return AdvicePreferences(value?.optBoolean("enabled", true) != false,
                value?.optBoolean("smart", true) != false, categories.ifEmpty { adviceCategories.filter { it != "aphrodisia" } }, adult)
        }
    }
}

internal interface DailyAdviceGateway {
    suspend fun today(context: JSONObject): JSONObject
    suspend fun next(context: JSONObject, id: String, day: String): JSONObject = throw UnsupportedOperationException("ADVICE_ROTATION_UNAVAILABLE")
    suspend fun record(id: String, day: String, dismiss: Boolean = false)
}

internal data class DailyAdviceSource(val kind: String, val author: String, val work: String, val reference: String)
internal data class DailyAdvice(val id: String, val day: String, val title: String, val body: String,
    val language: String, val categories: List<String>, val image: String?, val dismissed: Boolean,
    val sources: List<DailyAdviceSource>, val aphrodisiaTheme: String? = null, val requiresAdult: Boolean = false)
internal data class DailyAdviceResponse(val day: String, val state: String, val advice: DailyAdvice?,
    val sequence: Int = 1, val dailyLimit: Int = 1, val canNext: Boolean = false)

internal object DailyAdviceProtocol {
    private val idPattern = Regex("advice-[a-f0-9]{24}")
    private val artworkPattern = Regex("/advice-art/[a-z0-9-]+/advice-[a-f0-9]{24}\\.webp")
    private val languages = setOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja")
    fun record(id: String, day: String): JSONObject {
        require(idPattern.matches(id) && LocalDate.parse(day).toString() == day)
        return JSONObject().put("id", id).put("dayKey", day)
    }
    fun parse(value: JSONObject): DailyAdviceResponse {
        val day = value.getString("dayKey")
        require(LocalDate.parse(day).toString() == day)
        val state = value.getString("state")
        val sequence = value.optInt("sequence", 1)
        val limit = value.optInt("dailyLimit", 1)
        val canNext = value.optBoolean("canNext", false)
        require(limit in 1..6 && sequence in 0..limit && (!canNext || sequence < limit))
        require(state in setOf("disabled", "empty", "no-match", "ready"))
        if (value.isNull("advice")) {
            require(state != "ready")
            return DailyAdviceResponse(day, state, null, sequence, limit, canNext)
        }
        require(state == "ready")
        val row = value.getJSONObject("advice")
        val id = row.getString("id")
        record(id, row.getString("dayKey"))
        require(row.getString("dayKey") == day && row.getString("language") in languages)
        val categories = row.getJSONArray("categories").let { rows ->
            require(rows.length() in 1..adviceCategories.size)
            (0 until rows.length()).map { rows.getString(it).also { id -> require(id in adviceCategories) } }.distinct()
        }
        val title = row.optString("title").also { require(it.length <= 2000) }
        val body = row.getString("body").also { require(it.isNotBlank() && it.length <= 100_000) }
        require(row.get("dismissed") is Boolean)
        val sources = row.getJSONArray("sources").let { rows ->
            require(rows.length() <= 20)
            (0 until rows.length()).map { index ->
                val source = rows.getJSONObject(index)
                val kind = source.getString("kind").also { require(it in setOf("quote", "inspired")) }
                fun text(key: String) = source.optString(key).takeUnless { it == "null" }.orEmpty().also { require(it.length <= 2000) }
                DailyAdviceSource(kind, text("author"), text("work"), text("reference"))
            }
        }
        return DailyAdviceResponse(day, state, DailyAdvice(id, day, title, body, row.getString("language"),
            categories, row.optString("image").takeIf { artworkPattern.matches(it) }, row.getBoolean("dismissed"), sources,
            row.optString("aphrodisiaTheme").takeIf { it in setOf("love", "aesthetics", "consciousness") },
            row.optBoolean("requiresAdult", "aphrodisia" in categories)), sequence, limit, canNext)
    }
}
