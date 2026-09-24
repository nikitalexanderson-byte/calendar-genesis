package ru.genesis.calendar.domain

import android.content.Context
import org.json.JSONObject

data class TheokyklosText(val ru: String, val en: String)
data class TheokyklosWord(val greek: String, val pronunciation: TheokyklosText, val meaning: TheokyklosText)
data class TheokyklosSector(
    val id: String,
    val group: String,
    val angle: Int?,
    val symbol: String,
    val short: TheokyklosText,
    val title: TheokyklosText,
    val patrons: TheokyklosText,
    val essence: TheokyklosText,
    val description: TheokyklosText,
    val words: List<TheokyklosWord>,
    val art: String,
    val symbolArt: String,
    val color: String,
)
data class TheokyklosPractice(
    val id: String,
    val sectorId: String,
    val emoji: String,
    val title: TheokyklosText,
    val description: TheokyklosText,
    val myth: TheokyklosText,
    val suggestedTime: String,
    val priority: Int,
    val color: String,
)
data class TheokyklosCatalog(val sectors: List<TheokyklosSector>, val practices: List<TheokyklosPractice>) {
    val byId: Map<String, TheokyklosSector> = sectors.associateBy { it.id }
    fun practicesFor(sectorId: String) = practices.filter { it.sectorId == sectorId }
}

/** Exported from the website's theokyklos-data.ts, assets.ts and sacred-practices.ts. */
object TheokyklosCatalogSource {
    val ids = listOf("north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest",
        "zenith", "nadir", "hearth", "center", "entrance", "exit")

    fun load(context: Context): TheokyklosCatalog = context.assets.open("catalogs/theokyklos.json")
        .bufferedReader(Charsets.UTF_8).use { parse(it.readText()) }

    fun parse(raw: String): TheokyklosCatalog {
        val document = JSONObject(raw)
        require(document.getInt("schemaVersion") == 1) { "Unsupported Theokyklos catalog" }
        fun text(value: JSONObject) = TheokyklosText(value.getString("ru"), value.getString("en"))
        val segments = document.getJSONArray("segments")
        val sectors = (0 until segments.length()).map { index ->
            val value = segments.getJSONObject(index)
            val words = value.getJSONArray("words")
            TheokyklosSector(
                id = value.getString("id"), group = value.getString("group"),
                angle = if(value.has("angle")) value.getInt("angle") else null,
                symbol = value.getString("symbol"), short = text(value.getJSONObject("short")),
                title = text(value.getJSONObject("title")), patrons = text(value.getJSONObject("patrons")),
                essence = text(value.getJSONObject("essence")), description = text(value.getJSONObject("description")),
                words = (0 until words.length()).map { wordIndex ->
                    val word = words.getJSONObject(wordIndex)
                    TheokyklosWord(word.getString("greek"), text(word.getJSONObject("pronunciation")),
                        text(word.getJSONObject("meaning")))
                },
                art = value.getString("art"), symbolArt = value.getString("symbolArt"),
                color = value.getString("color"),
            )
        }
        require(sectors.map { it.id } == ids && sectors.all { it.words.size == 4 }) {
            "Theokyklos must include all 14 sectors and their sacred words"
        }
        val practicesArray = document.getJSONArray("practices")
        val practices = (0 until practicesArray.length()).map { index ->
            val value = practicesArray.getJSONObject(index)
            TheokyklosPractice(
                id = value.getString("id"), sectorId = value.getString("sectorId"),
                emoji = value.getString("emoji"), title = text(value.getJSONObject("title")),
                description = text(value.getJSONObject("description")), myth = text(value.getJSONObject("myth")),
                suggestedTime = value.getString("suggestedTime"), priority = value.getInt("priority"),
                color = value.getString("color"),
            )
        }
        require(practices.map { it.id }.toSet().size == practices.size &&
            practices.all { it.sectorId in ids }) { "Invalid Theokyklos practices" }
        return TheokyklosCatalog(sectors, practices)
    }
}
