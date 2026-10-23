package ru.genesis.calendar.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.*
import androidx.compose.material3.Text as NativeText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.*
import ru.genesis.calendar.domain.habits.AdviceAffinity
import ru.genesis.calendar.domain.habits.AdviceTaskSignal
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.data.LocalTask
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.math.max
import kotlin.math.min

@Composable private fun adviceCopy(language: String): JSONObject {
    val context = LocalContext.current
    return remember(context, language) {
        context.assets.open("originals/i18n/daily-advice-copy.json").bufferedReader(Charsets.UTF_8)
            .use { JSONObject(it.readText()).getJSONObject(language) }
    }
}

@Composable internal fun TodayAdvicePanel(gateway: DailyAdviceGateway, userId: String, day: String, language: String,
    preferences: AdvicePreferences, habits: List<Habit>, reloadToken: Long? = null, tasks: List<LocalTask> = emptyList()) {
    if (!preferences.enabled) return
    key(userId, day, language, preferences) {
        val context = LocalContext.current
        val copy = adviceCopy(language)
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        var resumed by remember(lifecycle) { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
        var attempt by remember { mutableIntStateOf(0) }
        DisposableEffect(lifecycle) {
            val observer = LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> { resumed = true; attempt++ }
                    Lifecycle.Event.ON_PAUSE -> resumed = false
                    else -> Unit
                }
            }
            lifecycle.addObserver(observer)
            onDispose { lifecycle.removeObserver(observer) }
        }
        var response by remember { mutableStateOf<DailyAdviceResponse?>(null) }
        var failed by remember { mutableStateOf(false) }
        var loading by remember { mutableStateOf(false) }
        var changing by remember { mutableStateOf(false) }
        var signals by remember { mutableStateOf(JSONObject()) }
        var serial by remember { mutableIntStateOf(0) }
        fun timeKey(): String {
            val now = LocalDateTime.now()
            val period = if (now.hour < 5 || now.hour >= 18) "evening" else if (now.hour < 12) "morning" else "day"
            return "${now.toLocalDate()}:$period:${java.time.ZoneId.systemDefault()}"
        }
        var clockBand by remember { mutableStateOf(timeKey()) }
        LaunchedEffect(resumed) {
            if (resumed) { clockBand = timeKey(); while (true) { delay(60_000); clockBand = timeKey() } }
        }
        LaunchedEffect(gateway, habits, tasks, attempt, resumed, reloadToken, clockBand, changing) {
            if (!resumed || changing) return@LaunchedEffect
            loading = true
            val request = ++serial
            try {
                val contextSignals = withContext(Dispatchers.Default) {
                    fun asset(name: String) = context.assets.open("originals/catalogs/" + name)
                        .bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
                    AdviceAffinity.context(habits, LocalDate.parse(day), preferences.smart,
                        if (preferences.smart) asset("daily-advice-affinity.json") else JSONObject(),
                        if (preferences.smart || tasks.isNotEmpty()) asset("daily-advice-topics.json") else JSONObject(),
                        tasks.map { task -> AdviceTaskSignal(task.title, task.description, task.done, task.date,
                            runCatching { JSONObject(task.sourceFieldsJson).optString("entryType", "task") }.getOrDefault("task")) })
                }
                signals = contextSignals
                val result = DailyAdviceProtocol.parse(gateway.today(contextSignals))
                // The service owns the daily publication boundary; it can differ from the device's date.
                check(result.advice == null || result.advice.language == language)
                if (request == serial) { response = result; failed = false }
            } catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { failed = true }
            finally { loading = false }
        }
        val card = response?.advice?.takeUnless { it.dismissed }
        if (failed) Row(Modifier.fillMaxWidth().testTag("daily-advice-load-error").semantics { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                NativeText(copy.getString("title"), style = MaterialTheme.typography.titleSmall)
                Text("Не удалось загрузить данные", style = MaterialTheme.typography.bodySmall)
            }
            AffairsIconButton("Обновить", AffairsAction.REFRESH, { attempt++ }, enabled = !loading)
        }
        if (card != null) {
            val view = LocalView.current
            var visible by remember(card.id) { mutableStateOf(false) }
            var recorded by remember(card.id) { mutableStateOf(false) }
            LaunchedEffect(card.id, visible, resumed, attempt) {
                if (!visible || !resumed || recorded) return@LaunchedEffect
                for (retry in 0..2) {
                    try { gateway.record(card.id, card.day); recorded = true; break }
                    catch (cancel: CancellationException) { throw cancel }
                    catch (_: Exception) { if (retry < 2) delay(1000L shl retry) }
                }
            }
            var dismissing by remember(card.id) { mutableStateOf(false) }
            var hideError by remember(card.id) { mutableStateOf(false) }
            var nextError by remember(card.id) { mutableStateOf(false) }
            val scope = rememberCoroutineScope()
            val bitmap by produceState<Bitmap?>(null, card.image, attempt) {
                try {
                    card.image?.let { path -> value = withContext(Dispatchers.IO) {
                        DailyAdviceArtwork.load(context, path)
                    } }
                } catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { value = null }
            }
            DailyAdviceCard(card, copy, bitmap, dismissing || loading || changing, hideError, Modifier.onGloballyPositioned { coordinates ->
                val bounds = coordinates.boundsInWindow()
                val width = min(bounds.right, view.width.toFloat()) - max(bounds.left, 0f)
                val height = min(bounds.bottom, view.height.toFloat()) - max(bounds.top, 0f)
                visible = width > 0 && height > 0 && height >= min(bounds.height, view.height.toFloat()) * .1f
            }, rotation = response, nextError = nextError, onNext = {
                if (!loading && !changing && !dismissing && response?.canNext == true) {
                    changing = true; nextError = false
                    val request = ++serial
                    scope.launch {
                        try {
                            val result = DailyAdviceProtocol.parse(gateway.next(signals, card.id, card.day))
                            check(result.advice == null || result.advice.language == language)
                            if (request == serial) response = result
                        } catch (cancel: CancellationException) { throw cancel }
                        catch (_: Exception) { if (request == serial) nextError = true }
                        finally { changing = false }
                    }
                }
            }) {
                if (!dismissing) {
                    dismissing = true; hideError = false
                    scope.launch {
                        try {
                            gateway.record(card.id, card.day, true)
                            response = response?.copy(advice = card.copy(dismissed = true))
                        } catch (cancel: CancellationException) { throw cancel }
                        catch (_: Exception) { hideError = true }
                        finally { dismissing = false }
                    }
                }
            }
        }
    }
}

@Composable internal fun DailyAdviceCard(card: DailyAdvice, copy: JSONObject, bitmap: Bitmap?, busy: Boolean,
    hideError: Boolean, modifier: Modifier = Modifier, rotation: DailyAdviceResponse? = null,
    nextError: Boolean = false, onNext: (() -> Unit)? = null, onDismiss: () -> Unit) {
    val surface = MaterialTheme.colorScheme.surface
    Surface(modifier.fillMaxWidth().testTag("today-daily-advice"), shape = AffairsLayout.shape) {
        Box {
            if (bitmap != null) Box(Modifier.matchParentSize()) {
                Image(bitmap.asImageBitmap(), null, Modifier.fillMaxWidth(.55f).fillMaxHeight().align(Alignment.CenterEnd).testTag("daily-advice-art"),
                    contentScale = ContentScale.Crop)
                Box(Modifier.matchParentSize().background(Brush.horizontalGradient(
                    0f to surface, .45f to surface, 1f to surface.copy(alpha = .1f))))
            }
            Column(Modifier.padding(12.dp).background(surface.copy(alpha = if (LocalEveningTheme.current) .72f else .60f),
                AffairsLayout.controlShape).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Top) {
                    NativeText(card.title.ifBlank { copy.getString("title") }, Modifier.weight(1f).testTag("daily-advice-title").semantics { heading() },
                        style = MaterialTheme.typography.titleMedium)
                    AffairsIconButton(copy.getString("hide"), AffairsAction.CLOSE, onDismiss,
                        enabled = !busy, modifier = Modifier.testTag("daily-advice-dismiss"))
                }
                NativeText(card.body, Modifier.testTag("daily-advice-body"), style = MaterialTheme.typography.bodyLarge)
                val names = copy.getJSONArray("categories")
                NativeText(copy.getString("title") + " · " + card.categories.joinToString(" · ") {
                    names.getString(adviceCategories.indexOf(it))
                }, style = MaterialTheme.typography.bodySmall)
                card.sources.forEach { source ->
                    NativeText(copy.getString(if (source.kind == "quote") "source" else "inspired") + ": " +
                        listOf(source.author, source.work, source.reference).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall)
                }
                if (rotation != null && rotation.dailyLimit > 1) {
                    OutlinedButton(onClick = { onNext?.invoke() }, enabled = !busy && rotation.canNext,
                        modifier = Modifier.heightIn(min = 48.dp).testTag("daily-advice-next")) {
                        NativeText(copy.getString("next"))
                    }
                    NativeText(copy.getString("position").replace("{current}", rotation.sequence.toString())
                        .replace("{limit}", rotation.dailyLimit.toString()) +
                        (if (!rotation.canNext) " · " + copy.getString("limitReached") else ""),
                        modifier = Modifier.testTag("daily-advice-position").semantics { liveRegion = LiveRegionMode.Polite },
                        style = MaterialTheme.typography.bodySmall)
                }
                if (nextError) NativeText(copy.getString("nextError"), color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                if (hideError) NativeText(copy.getString("hideError"), color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("daily-advice-hide-error").semantics { liveRegion = LiveRegionMode.Polite })
            }
        }
    }
}

@Composable internal fun DailyAdviceSettings(preferences: AdvicePreferences, available: List<String>, catalogAvailable: Boolean,
    language: String, enabled: Boolean, onSave: suspend (JSONObject) -> AdvicePreferences) {
    val copy = adviceCopy(language)
    var saved by remember(preferences) { mutableStateOf(preferences) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun change(patch: JSONObject) {
        if (busy || !enabled) return
        busy = true; error = false
        scope.launch {
            try { saved = onSave(patch) }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { error = true }
            finally { busy = false }
        }
    }
    Surface(Modifier.fillMaxWidth().testTag("daily-advice-settings"), shape = AffairsLayout.shape) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            NativeText(copy.getString("title"), style = MaterialTheme.typography.titleMedium)
            NativeText(copy.getString("tradition"), style = MaterialTheme.typography.bodyMedium)
            @Composable fun toggle(key: String, value: Boolean, label: String, hint: String, action: (Boolean) -> Unit) {
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag(key)
                    .toggleable(value, enabled = enabled && !busy, role = Role.Switch, onValueChange = action),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        NativeText(label, style = MaterialTheme.typography.titleSmall)
                        NativeText(hint, style = MaterialTheme.typography.bodyMedium)
                    }
                    Switch(value, null, enabled = enabled && !busy)
                }
            }
            toggle("advice-enabled", saved.enabled, copy.getString("enable"), copy.getString("enableHint")) {
                change(JSONObject().put("enabled", it))
            }
            if (saved.enabled) {
                val selected = available.filter { it in saved.categories }.ifEmpty { available.take(1) }
                toggle("advice-smart", saved.smart, copy.getString("smart"), copy.getString("smartHint")) {
                    change(JSONObject().put("smart", it).put("categories", JSONArray(selected)))
                }
                if (saved.smart) NativeText(copy.getString("fallback"), style = MaterialTheme.typography.bodyMedium)
                else {
                    NativeText(copy.getString("choose"), style = MaterialTheme.typography.titleSmall)
                    adviceCategories.forEachIndexed { index, category ->
                        val checked = category in selected
                        val canChange = enabled && !busy && category in available && (!checked || selected.size > 1)
                        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("advice-category-" + category)
                            .toggleable(checked, enabled = canChange, role = Role.Checkbox) { check ->
                                change(JSONObject().put("categories", JSONArray(available.filter {
                                    if (it == category) check else it in selected
                                })))
                            }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Checkbox(checked, null, enabled = canChange)
                            Column(Modifier.weight(1f)) {
                                NativeText(copy.getJSONArray("categories").getString(index), style = MaterialTheme.typography.titleSmall)
                                NativeText(copy.getJSONArray("categoryHints").getString(index) +
                                    if (category !in available) " · " + copy.getString("comingSoon") else "",
                                    style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                    NativeText(copy.getString("oneCategory"), style = MaterialTheme.typography.bodyMedium)
                }
                NativeText(copy.getString("scopeHint"), style = MaterialTheme.typography.bodyMedium)
                if (!catalogAvailable) NativeText(copy.getString("pending"), style = MaterialTheme.typography.bodyMedium)
            }
            if (error) NativeText(copy.getString("saveError"), color = MaterialTheme.colorScheme.error,
                modifier = Modifier.testTag("daily-advice-settings-error").semantics { liveRegion = LiveRegionMode.Polite })
            AffairsDisclosure(copy.getString("privacyTitle")) {
                NativeText(copy.getString("privacyNotice"), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
