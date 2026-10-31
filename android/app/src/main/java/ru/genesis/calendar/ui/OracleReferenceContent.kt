package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.domain.StoicheionReading

@Composable private fun oracleReference(name: String): JSONObject {
    val context = LocalContext.current
    return remember(context, name) {
        JSONObject(context.assets.open("originals/catalogs/$name.json").bufferedReader().use { it.readText() })
    }
}

private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map(::getJSONObject)
private fun JSONObject.localized(language: String): String = optString(language).ifBlank { getString("en") }

@Composable private fun OlympianSymbol(deity: JSONObject, modifier: Modifier = Modifier) {
    OriginalImage("originals/theokyklos-symbols/olympian-${deity.getString("id")}-v313.png", null,
        modifier, dimInDarkTheme = false)
}

@Composable internal fun OlympianIsopsephy(onOpenStoicheion: () -> Unit) {
    val content = oracleReference("olympian-isopsephy")
    val language = LocalGenesisLanguage.current
    val copy = content.getJSONObject("locales").let { it.optJSONObject(language) ?: it.getJSONObject("en") }
    val deities = remember(content) { content.getJSONArray("deities").objects() }
    var expanded by rememberSaveable { mutableStateOf(false) }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    val catalogScroll = rememberScrollState()
    Column(Modifier.fillMaxWidth().testTag("olympian-isopsephy"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SacredYearDetailsButton(copy.getString("title"), copy.getString("subtitle"), "olympian-isopsephy-toggle",
            GenesisPageIcon.THEOKYKLOS, expanded = false) { expanded = true }
        if (expanded) {
            Dialog(onDismissRequest = { expanded = false; selected = null },
                properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Surface(Modifier.padding(16.dp).widthIn(max = 720.dp).fillMaxWidth(), shape = AffairsLayout.shape) {
            Column(Modifier.verticalScroll(catalogScroll).padding(16.dp).testTag("olympian-catalog-dialog"),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
            EditorDialogHeader(copy.getString("title"), "olympian-catalog-close") { expanded = false; selected = null }
            UntranslatedText(copy.getString("intro"), style = MaterialTheme.typography.bodyMedium)
            TextButton({ expanded = false; onOpenStoicheion() }, Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("olympian-stoicheion-link")) {
                UntranslatedText(copy.getString("link"), Modifier.weight(1f))
                GenesisLucideIcon("chevron-right")
            }
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val columns = if (maxWidth >= 600.dp) 3 else 2
                val rows = deities.filterNot { it.getString("id") == "dionysus" }.chunked(columns) +
                    listOf(deities.filter { it.getString("id") == "dionysus" })
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    rows.forEach { row ->
                        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { deity ->
                                Surface(onClick = { selected = deity.getString("id") },
                                    modifier = Modifier.weight(1f).fillMaxHeight().heightIn(min = 140.dp)
                                        .testTag("olympian-${deity.getString("id")}"), shape = AffairsLayout.shape,
                                    color = MaterialTheme.colorScheme.surfaceContainerLow,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        OlympianSymbol(deity, Modifier.size(48.dp))
                                        UntranslatedText("${deity.getJSONObject("name").localized(language)} · ${deity.getInt("number")}",
                                            style = MaterialTheme.typography.titleSmall, maxLines = 1)
                                        UntranslatedText(deity.getJSONObject("summary").localized(language), style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            }
            }
            }
        }
    }
    deities.firstOrNull { it.getString("id") == selected }?.let { deity ->
        Dialog(onDismissRequest = { selected = null }) {
            Surface(Modifier.widthIn(max = 480.dp).fillMaxWidth(), shape = AffairsLayout.shape) {
                Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()).testTag("olympian-dialog"),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    EditorDialogHeader(deity.getJSONObject("name").localized(language), "olympian-dialog-close") { selected = null }
                    OlympianSymbol(deity, Modifier.size(64.dp))
                    UntranslatedText("${deity.getString("greek")} · ${deity.getInt("number")}",
                        style = MaterialTheme.typography.titleLarge)
                    val summands = deity.getJSONArray("summands")
                    val calculatedNumber = deity.optInt("calculatedNumber", deity.getInt("number"))
                    UntranslatedText((0 until summands.length()).joinToString(" + ") { summands.getInt(it).toString() } +
                        " = $calculatedNumber", style = MaterialTheme.typography.bodySmall)
                    deity.optJSONObject("calculationNote")?.let {
                        UntranslatedText(it.localized(language), style = MaterialTheme.typography.bodySmall)
                    }
                    UntranslatedText(deity.getJSONObject("detail").localized(language), style = MaterialTheme.typography.bodyMedium)
                    UntranslatedText(copy.getString("root"), style = MaterialTheme.typography.labelMedium)
                    UntranslatedText(StoicheionReading.trace(calculatedNumber).joinToString(" → "),
                        Modifier.testTag("olympian-digital-root"), style = MaterialTheme.typography.labelLarge)
                    TextButton(onClick = { selected = null; expanded = false; onOpenStoicheion() }, Modifier.fillMaxWidth()) {
                        UntranslatedText(copy.getString("link"))
                    }
                }
            }
        }
    }
}

@Composable internal fun FutureModelingGuide() {
    val content = oracleReference("future-modeling")
    val olympians = oracleReference("olympian-isopsephy")
    val language = LocalGenesisLanguage.current
    val context = LocalContext.current
    val extraLocale = remember(context, language) {
        if (language in setOf("ru", "en")) null else runCatching {
            JSONObject(context.assets.open("originals/catalogs/future-modeling-locales/$language.json")
                .bufferedReader().use { it.readText() })
        }.getOrNull()
    }
    val copy = extraLocale ?: content.getJSONObject("locales").let { it.optJSONObject(language) ?: it.getJSONObject("en") }
    val sectorCopy = remember(extraLocale) { extraLocale?.getJSONArray("sectors")?.objects()?.associateBy { it.getString("id") } }
    val goalCopy = remember(extraLocale) { extraLocale?.getJSONArray("goals")?.objects()?.associateBy { it.getString("deityId") } }
    var open by rememberSaveable { mutableStateOf(false) }
    SacredYearDetailsButton(copy.getString("title"), copy.optString("subtitle"), "future-modeling-open",
        GenesisPageIcon.STOICHEION) { open = true }
    if (open) {
        val deities = remember(olympians) {
            (olympians.getJSONArray("deities").objects() + olympians.getJSONArray("references").objects()).associateBy { it.getString("id") }
        }
        fun deityName(id: String): String = deities.getValue(id).let {
            "${it.getJSONObject("name").localized(language)} (${it.getInt("number")})"
        }
        fun deityNote(id: String): String? = deities.getValue(id).optJSONObject("calculationNote")?.localized(language)
        Dialog(onDismissRequest = { open = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Surface(Modifier.widthIn(max = 760.dp).fillMaxWidth().fillMaxHeight(.92f).padding(horizontal = 12.dp), shape = AffairsLayout.shape) {
                Column(Modifier.padding(16.dp).testTag("future-modeling-dialog")) {
                    EditorDialogHeader(copy.getString("title"), "future-modeling-close") { open = false }
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        UntranslatedText(copy.getString("intro"), style = MaterialTheme.typography.bodyMedium)
                        copy.getJSONArray("sections").objects().forEachIndexed { index, section ->
                            val tone = listOf(OracleTone.GOLD, OracleTone.BLUE, OracleTone.MAUVE, OracleTone.SAGE, OracleTone.CLAY)[index]
                            Surface(Modifier.fillMaxWidth().testTag("future-modeling-step-${index + 1}"),
                                shape = AffairsLayout.shape, color = oracleSectionColor(tone),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    UntranslatedText(section.getString("title"), style = MaterialTheme.typography.titleMedium)
                                    val paragraphs = section.getJSONArray("paragraphs")
                                    for (paragraph in 0 until paragraphs.length()) UntranslatedText(paragraphs.getString(paragraph), style = MaterialTheme.typography.bodyMedium)
                                    if (index == 0) content.getJSONArray("sectors").objects().forEach { sector ->
                                        val ids = sector.getJSONArray("deities")
                                        val translated = sectorCopy?.get(sector.getString("id"))
                                        UntranslatedText((translated?.getString("title") ?: sector.getJSONObject("title").localized(language)) + " · " +
                                            (0 until ids.length()).joinToString(" / ") { deityName(ids.getString(it)) },
                                            Modifier.testTag("future-sector-${sector.getString("id")}"), style = MaterialTheme.typography.titleSmall)
                                        UntranslatedText(translated?.getString("meaning") ?: sector.getJSONObject("meaning").localized(language), style = MaterialTheme.typography.bodyMedium)
                                        (0 until ids.length()).mapNotNull { deityNote(ids.getString(it)) }.distinct().forEach {
                                            UntranslatedText(it, style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    if (index == 1) content.getJSONArray("goals").objects().forEach { goal ->
                                        UntranslatedText(deityName(goal.getString("deityId")),
                                            Modifier.testTag("future-goal-${goal.getString("deityId")}"), style = MaterialTheme.typography.titleSmall)
                                        UntranslatedText(goalCopy?.get(goal.getString("deityId"))?.getString("goal")
                                            ?: goal.getJSONObject("goal").localized(language), style = MaterialTheme.typography.bodyMedium)
                                        deityNote(goal.getString("deityId"))?.let { UntranslatedText(it, style = MaterialTheme.typography.bodySmall) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
