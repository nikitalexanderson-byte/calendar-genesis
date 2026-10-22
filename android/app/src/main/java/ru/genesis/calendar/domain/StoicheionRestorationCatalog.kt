package ru.genesis.calendar.domain

import android.content.Context
import org.json.JSONObject

data class RestorationNeedContent(val risk: String, val quality: String, val intention: String,
    val action: String, val practice: String, val supportId: String, val practiceId: String)
data class RestorationMyth(val title: String, val body: String, val source: String, val url: String)
data class RestorationSectorContent(val id: String, val title: String, val field: String,
    val ambivalence: String, val myth: RestorationMyth, val needs: Map<String, RestorationNeedContent>)
data class RestorationAuxiliaryContent(val id: String, val word: String, val title: String,
    val purpose: String, val practiceId: String)
data class RestorationLetterNeed(val action: String, val practice: String)
data class RestorationLetterFocus(val risk: String, val quality: String, val needs: Map<String, RestorationLetterNeed>)
data class RestorationFramework(val title: String, val formula: String, val body: String)
data class StoicheionRestorationCatalog(val sectors: Map<String, RestorationSectorContent>,
    val auxiliaries: List<RestorationAuxiliaryContent>, val letterFoci: Map<String, RestorationLetterFocus>,
    val ui: Map<String, String>, val framework: RestorationFramework) {
    fun copy(key: String) = ui.getValue(key)
}

/** One shared authored catalog and UI dictionary are packaged from the website, without a fork. */
object StoicheionRestorationCatalogSource {
    fun load(context: Context, language: String): StoicheionRestorationCatalog {
        fun asset(name: String) = context.assets.open("originals/catalogs/$name.json")
            .bufferedReader(Charsets.UTF_8).use { it.readText() }
        return parse(asset("stoicheion-restoration-content"), asset("stoicheion-restoration-ui"), language)
    }
    fun parse(raw: String, uiRaw: String, language: String): StoicheionRestorationCatalog {
        val root = JSONObject(raw)
        val localizedLanguage = if (language == "ru") "ru" else "en"
        fun JSONObject.localized(key: String) = getJSONObject(key).getString(localizedLanguage)
        val auxiliaryArray = root.getJSONArray("auxiliaries")
        val auxiliaries = (0 until auxiliaryArray.length()).map { index ->
            val row = auxiliaryArray.getJSONObject(index)
            RestorationAuxiliaryContent(row.getString("id"), row.getString("word"), row.localized("title"),
                row.localized("purpose"), row.getString("practiceId"))
        }
        require(auxiliaries.map { it.id } == StoicheionRestoration.supports.map { it.id })
        auxiliaries.forEach { row ->
            require(StoicheionRestoration.isopsephy(row.word) == StoicheionRestoration.supports.first { it.id == row.id }.value.toLong())
            require(row.practiceId in StoicheionRestoration.practiceIds)
        }
        val sectorArray = root.getJSONArray("sectors")
        val sectors = (0 until sectorArray.length()).map { index ->
            val row = sectorArray.getJSONObject(index)
            val myth = row.getJSONObject("myth")
            val needs = StoicheionRestoration.needs.associateWith { need ->
                val text = row.getJSONObject("needs").getJSONObject(need)
                RestorationNeedContent(text.localized("risk"), text.localized("quality"), text.localized("intention"),
                    text.localized("action"), text.localized("practice"), text.getString("supportId"), text.getString("practiceId"))
            }
            require(needs.values.all { it.practiceId in StoicheionRestoration.practiceIds &&
                it.supportId in auxiliaries.map { auxiliary -> auxiliary.id } })
            RestorationSectorContent(row.getString("id"), row.localized("title"), row.localized("field"), row.localized("ambivalence"),
                RestorationMyth(myth.localized("title"), myth.localized("body"), myth.getString("source"), myth.getString("url")), needs)
        }.associateBy { it.id }
        require(sectors.keys == StoicheionRestoration.positions.toSet())
        val focusRoot = root.getJSONObject("letterFoci")
        val foci = StoicheionRestoration.letters.associate { letter ->
            val focus = focusRoot.getJSONObject(letter.id)
            letter.id to RestorationLetterFocus(focus.localized("risk"), focus.localized("quality"),
                StoicheionRestoration.needs.associateWith { need ->
                    val guidance = focus.getJSONObject("needs").getJSONObject(need)
                    RestorationLetterNeed(guidance.localized("action"), guidance.localized("practice"))
                })
        }
        val uiRoot = JSONObject(uiRaw)
        val ui = uiRoot.optJSONObject(language) ?: uiRoot.getJSONObject("en")
        val framework = root.getJSONObject("framework")
        return StoicheionRestorationCatalog(sectors, auxiliaries, foci,
            ui.keys().asSequence().associateWith { ui.getString(it) },
            RestorationFramework(framework.localized("title"), framework.getString("formula"), framework.localized("body")))
    }
}
