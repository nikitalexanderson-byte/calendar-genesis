package ru.genesis.calendar.ui

import android.content.Context
import org.json.JSONObject

internal data class StoicheionReadingText(val upright: String,val reversed: String,val profile: String)
internal fun splitStoicheionReading(context: Context,id: String,content: String): StoicheionReadingText {
    val root=context.assets.open("originals/catalogs/stoicheion-reading-layout.json").bufferedReader().use{JSONObject(it.readText())}
    val spec=root.getJSONObject(id);val paragraphs=content.split(Regex("\\n\\s*\\n"))
    require(paragraphs.size==spec.getInt("paragraphs")){"STOICHEION_READING_LAYOUT_MISMATCH"}
    val upright=spec.getInt("upright");val reversed=spec.getInt("reversed")
    return StoicheionReadingText(paragraphs[upright],paragraphs[reversed],paragraphs.filterIndexed{i,_->i!=upright&&i!=reversed}.joinToString("\n\n"))
}
