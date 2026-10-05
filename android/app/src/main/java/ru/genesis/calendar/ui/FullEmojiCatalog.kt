package ru.genesis.calendar.ui

import android.content.Context
import org.json.JSONArray

internal data class FullEmojiCategory(val id: String, val label: String,
    val labelEn: String, val emojis: List<String>)

internal fun fullEmojiCatalog(context: Context): List<FullEmojiCategory> {
    val raw = context.assets.open("originals/i18n/emoji-full-catalog.json")
        .bufferedReader().use { it.readText() }
    val rows = JSONArray(raw)
    return (0 until rows.length()).map { index ->
        val row = rows.getJSONObject(index)
        val emojis = row.getJSONArray("emojis")
        FullEmojiCategory(row.getString("id"), row.getString("label"), row.getString("labelEn"),
            (0 until emojis.length()).map(emojis::getString))
    }
}
