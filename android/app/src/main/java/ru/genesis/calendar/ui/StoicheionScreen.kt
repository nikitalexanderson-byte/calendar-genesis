package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
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
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import androidx.compose.ui.graphics.Color

internal data class StoicheionLetter(val id: String, val order: Int, val name: String, val symbol: String,
    val lowercase: String, val value: Int, val pythmen: Int, val tagline: String, val content: String,
    val body: String, val bodyGreek: String, val invocation: String, val accent: Color)

/** All 24 author texts are copied without abridgement from app/stoicheion-data.ts. */
@Composable
fun StoicheionScreen() {
    val context = LocalContext.current
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
    var selected by remember { mutableStateOf<StoicheionLetter?>(null) }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Стойхейон", style = MaterialTheme.typography.headlineMedium)
            Text("Гно · Метэр · Басилея", style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary)
            Text("Двадцать четыре буквенных образа: метафизика, прямое и перевёрнутое положение, практика и числовое значение.",
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
                items(loaded, key = { it.id }) { letter ->
                    Card(onClick = { selected = letter }, modifier = Modifier.fillMaxWidth()
                        .testTag("stoicheion-letter-${letter.id}")) {
                        StoicheionCardFace(letter, Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
    selected?.let { letter ->
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
                        letter.content.split("\n\n").forEach { paragraph ->
                            Text(paragraph, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}
