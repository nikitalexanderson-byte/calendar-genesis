package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import ru.genesis.calendar.data.StoicheionDraw
import ru.genesis.calendar.domain.StoicheionReading

internal data class StoicheionTimePosition(val id: String, val title: String, val meaning: String)

/** Both clients read the same authored explanation and temporal order. */
@Composable internal fun stoicheionTimelineCopy(): JSONObject {
    val context = LocalContext.current
    val language = LocalGenesisLanguage.current
    return remember(context, language) {
        JSONObject(context.assets.open("originals/catalogs/stoicheion-timeline.json").bufferedReader().use { it.readText() })
            .let { it.optJSONObject(language) ?: it.getJSONObject("en") }
    }
}

@Composable internal fun StoicheionTimelinePanel(letters: List<StoicheionLetter>, draw: StoicheionDraw?,
    ready: Boolean, now: Long, busy: Boolean, onBegin: () -> Unit, onSelect: (StoicheionSelection) -> Unit) {
    val copy = stoicheionTimelineCopy()
    val cards = remember(letters, draw?.seed) { draw?.let { StoicheionReading.spread(letters, it.seed, 3) } }
    StoicheionSection(OracleTone.SAGE, "stoicheion-timeline-block") {
        UntranslatedText(copy.getString("title"), style = MaterialTheme.typography.titleLarge)
        UntranslatedText(copy.getString("subtitle"), style = MaterialTheme.typography.bodyMedium)
        AffairsDisclosure(copy.getString("method"), titleIsUserContent = true) {
            val paragraphs = copy.getJSONArray("paragraphs")
            for (index in 0 until paragraphs.length()) UntranslatedText(paragraphs.getString(index), style = MaterialTheme.typography.bodySmall)
        }
        if (cards == null) Button(onBegin, enabled = ready && !busy,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("stoicheion-draw-timeline")) {
            UntranslatedText(copy.getString("begin"), maxLines = 1)
        } else {
            Row(Modifier.fillMaxWidth().testTag("stoicheion-timeline-cards"), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                cards.forEachIndexed { index, (letter, reversed) ->
                    val data = copy.getJSONArray("positions").getJSONObject(index)
                    val position = StoicheionTimePosition(data.getString("id"), data.getString("title"), data.getString("meaning"))
                    Card(onClick = { onSelect(StoicheionSelection(letter, reversed, timePosition = position)) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                        modifier = Modifier.weight(1f).testTag("stoicheion-timeline-${position.id}")) {
                        Column(Modifier.padding(5.dp), horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            UntranslatedText(position.title, maxLines = 1, style = MaterialTheme.typography.labelMedium)
                            StoicheionCardFace(letter, Modifier.fillMaxWidth().graphicsLayer { rotationZ = if (reversed) 180f else 0f })
                            UntranslatedText(letter.name, maxLines = 1, style = MaterialTheme.typography.labelSmall)
                            UntranslatedText(copy.getString(if (reversed) "reversed" else "upright"),
                                style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
            if (draw != null) RerollAction(draw, now, busy, copy.getString("reroll"), tone = OracleTone.MAUVE, onClick = onBegin)
        }
    }
}
