package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import androidx.compose.ui.graphics.Color
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.StoicheionDrawRepository
import ru.genesis.calendar.data.StoicheionDraws
import ru.genesis.calendar.domain.StoicheionReading
import ru.genesis.calendar.domain.TheokyklosCatalogSource
import java.time.LocalDate

internal data class StoicheionLetter(val id: String, val order: Int, val name: String, val symbol: String,
    val lowercase: String, val value: Int, val pythmen: Int, val tagline: String, val content: String,
    val body: String, val bodyGreek: String, val invocation: String, val accent: Color)

/** All 24 author texts are copied without abridgement from app/stoicheion-data.ts. */
@Composable
fun StoicheionScreen(app: GenesisApplication, divinationDisabled: Boolean,
    onOpenTheokyklosSector: (String) -> Unit = {}) {
    val context = LocalContext.current
    val repository = remember(app) { StoicheionDrawRepository(app) }
    val scope = rememberCoroutineScope()
    val today by produceState(LocalDate.now()) {
        while (true) { delay(60_000L); value = LocalDate.now() }
    }
    val draws by produceState<StoicheionDraws?>(null, repository, today) {
        repository.today.collect { value = it }
    }
    val now by produceState(System.currentTimeMillis()) {
        while (true) { delay(1_000L); value = System.currentTimeMillis() }
    }
    val theokyklos = remember(context) { runCatching { TheokyklosCatalogSource.load(context) }.getOrNull() }
    val letters by produceState<List<StoicheionLetter>?>(null, context) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val raw = context.assets.open("stoicheion.json").bufferedReader().use { it.readText() }
                val art = JSONObject(context.assets.open("stoicheion-art.json").bufferedReader().use { it.readText() })
                JSONArray(raw).let { array -> (0 until array.length()).map { index ->
                    array.getJSONObject(index).let { item ->
                        val image = art.getJSONObject(item.getString("id"))
                        StoicheionLetter(item.getString("id"), item.getInt("order"), item.getString("name"),
                            item.getString("symbol"), item.getString("lowercase"), item.getInt("value"), item.getInt("pythmen"),
                            item.getString("tagline"), item.getString("content"), image.getString("body"),
                            image.getString("bodyGreek"), image.getString("invocation"),
                            Color(android.graphics.Color.parseColor(image.getString("accent"))))
                    }
                } }
            }.getOrDefault(emptyList())
        }
    }
    var selected by remember { mutableStateOf<StoicheionSelection?>(null) }
    var motionMode by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var drawError by remember { mutableStateOf<String?>(null) }
    val beginMotion: (String) -> Unit = { mode ->
        if (!saving && !divinationDisabled) { drawError = null; motionMode = mode }
    }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Стойхейон", style = MaterialTheme.typography.headlineMedium)
            Text("Гно · Метэр · Басилея", style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary)
            Text(if (divinationDisabled) "Двадцать четыре буквенных образа и их метафизические значения."
                else "Двадцать четыре буквенных образа, карта дня и «Космический круг» — расклад девяти ликов силы.",
                style = MaterialTheme.typography.bodyMedium)
        }
        val loaded = letters
        when {
            loaded == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            loaded.size != 24 -> Text("Не удалось открыть авторские карты. Данные не заменены.",
                Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error)
            else -> LazyVerticalGrid(columns = GridCells.Fixed(2), modifier = Modifier.fillMaxSize().testTag("stoicheion-grid"),
                contentPadding = PaddingValues(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (divinationDisabled) Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text("Гадания по картам выключены", style = MaterialTheme.typography.titleMedium)
                                Text("Карта дня и расклад скрыты настройкой. Буквы и значения остаются доступными.",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                        } else StoicheionDrawPanel(loaded, draws, now, saving, drawError,
                            onBegin = beginMotion, onSelect = { selected = it })
                        Text("Основной греческий ряд · 24", style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary)
                        Text("Выберите букву", style = MaterialTheme.typography.titleLarge)
                        Text("Откройте метафизический профиль, прямое и перевёрнутое положение, практику и число.",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
                items(loaded, key = { it.id }) { letter ->
                    Card(onClick = { selected = StoicheionSelection(letter) }, modifier = Modifier.fillMaxWidth()
                        .testTag("stoicheion-letter-${letter.id}")) {
                        StoicheionCardFace(letter, Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
    selected?.let { reading ->
        val letter = reading.letter
        Dialog(onDismissRequest = { selected = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Surface(Modifier.fillMaxWidth().fillMaxHeight(.94f).padding(horizontal = 12.dp),
                shape = MaterialTheme.shapes.large) {
                Column(Modifier.fillMaxSize()) {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("${letter.symbol} · ${letter.name}", Modifier.weight(1f),
                            style = MaterialTheme.typography.titleLarge)
                        TextButton(onClick = { selected = null }) { Text("Закрыть") }
                    }
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            StoicheionCardFace(letter, Modifier.width(220.dp))
                        }
                        Text(letter.tagline, style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary)
                        Text("Числовое значение ${letter.value} · пифмен ${letter.pythmen}",
                            style = MaterialTheme.typography.labelLarge)
                        reading.reversed?.let { Text(if (it) "Перевёрнутое положение" else "Парадное положение",
                            color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleSmall) }
                        letter.content.split("\n\n").forEach { paragraph ->
                            Text(paragraph, style = MaterialTheme.typography.bodyMedium)
                        }
                        reading.position?.let { position ->
                            HorizontalDivider()
                            Text("${position.direction} · сектор расклада", style = MaterialTheme.typography.titleMedium)
                            Text(position.meaning, style = MaterialTheme.typography.bodyMedium)
                            theokyklos?.byId?.get(position.id)?.let { sector ->
                                Text("${sector.patrons.ru} · ${sector.essence.ru}",
                                    style = MaterialTheme.typography.titleSmall)
                                theokyklos.guidanceById[position.id]?.let { guidance ->
                                    Text((if (reading.reversed == true) guidance.reversed else guidance.upright).ru,
                                        style = MaterialTheme.typography.bodyMedium)
                                }
                                sector.words.forEach { word ->
                                    Text("${word.greek} · ${word.pronunciation.ru} · ${word.meaning.ru}",
                                        style = MaterialTheme.typography.bodySmall)
                                }
                                theokyklos.practicesFor(position.id).forEach { practice ->
                                    Text("${practice.emoji} ${practice.title.ru} — ${practice.description.ru}",
                                        style = MaterialTheme.typography.bodySmall)
                                }
                                TextButton(onClick = { selected = null; onOpenTheokyklosSector(position.id) }) {
                                    Text("Открыть сектор Теокиклоса →")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (motionMode != null && !divinationDisabled) StoicheionMotionDialog(motionMode!!, saving,
        onCancel = { if (!saving) motionMode = null }, onFinish = { seed ->
            val mode = motionMode ?: return@StoicheionMotionDialog
            if (!saving) scope.launch {
                saving = true
                try {
                    val prior = if (mode == "daily") draws?.daily else draws?.spread
                    var chosen = seed
                    if (mode == "daily" && prior != null && letters != null &&
                        StoicheionReading.cardOfDay(letters!!, chosen) == StoicheionReading.cardOfDay(letters!!, prior.seed))
                        chosen = (chosen + 1L) and 0xffff_ffffL
                    if (mode == "spread" && prior?.seed == chosen) chosen = (chosen + 1L) and 0xffff_ffffL
                    repository.save(mode, chosen)
                    drawError = null
                    selected = null
                    motionMode = null
                } catch (error: CancellationException) { throw error }
                catch (error: Exception) { drawError = error.message ?: "Не удалось сохранить расклад."; motionMode = null }
                finally { saving = false }
            }
        })
}
