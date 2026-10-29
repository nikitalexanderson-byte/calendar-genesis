package ru.genesis.calendar.ui

import androidx.lifecycle.compose.collectAsStateWithLifecycle

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
import androidx.compose.ui.semantics.contentDescription
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
import ru.genesis.calendar.data.DiaryRepository
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
    preferences: AdvicePreferences, habits: List<Habit>, reloadToken: Long? = null, tasks: List<LocalTask> = emptyList(),
    diary: DiaryRepository? = null, onOpenDiary: (() -> Unit)? = null) {
    if (!preferences.enabled) return
    key(userId, day, language, preferences) {
        val context = LocalContext.current
        val copy = adviceCopy(language)
        val diaryState = diary?.state?.collectAsStateWithLifecycle()?.value
        LaunchedEffect(diary) { if (diary != null) {
            try { diary.loadCached(); diary.refresh() }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { /* Advice still works; a failed reaction retains its own draft. */ }
        } }
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
        val card = response?.advice?.takeUnless { it.dismissed || (it.requiresAdult && preferences.aphrodisiaAdult != true) ||
            ("aphrodisia" in it.categories && ("aphrodisia" !in preferences.categories || preferences.aphrodisiaAdult == null)) }
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
            var reactionBusy by remember(card.id) { mutableStateOf(false) }
            var reactionError by remember(card.id) { mutableStateOf(false) }
            val selectedReaction = diaryState?.records?.firstOrNull { it.note.adviceId == card.id && !it.draft }?.note?.reaction
            val react: ((String) -> Unit)? = if (diary == null) null else { kind ->
                if (!reactionBusy) {
                    reactionBusy = true; reactionError = false
                    scope.launch {
                        try {
                            val snapshot = JSONObject().put("id", card.id).put("dayKey", card.day)
                                .put("title", card.title).put("body", card.body).put("language", card.language)
                                .put("categories", JSONArray(card.categories)).put("image", card.image ?: JSONObject.NULL)
                                .put("sources", JSONArray(card.sources.map { source -> JSONObject()
                                    .put("kind", source.kind).put("author", source.author)
                                    .put("work", source.work).put("reference", source.reference) }))
                            diary.react(snapshot, kind)
                        } catch (cancel: CancellationException) { throw cancel }
                        catch (_: Exception) { reactionError = true }
                        finally { reactionBusy = false }
                    }
                }
            }
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
            }, rotation = response, nextError = nextError,
                reaction = selectedReaction, reactionBusy = reactionBusy, reactionError = reactionError,
                onReaction = react, onOpenDiary = onOpenDiary, onNext = {
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
    nextError: Boolean = false, onNext: (() -> Unit)? = null,
    reaction: String? = null, reactionBusy: Boolean = false, reactionError: Boolean = false,
    onReaction: ((String) -> Unit)? = null, onOpenDiary: (() -> Unit)? = null, onDismiss: () -> Unit) {
    val surface = MaterialTheme.colorScheme.surface
    var shareFailed by remember(card.id) { mutableStateOf(false) }
    Surface(modifier.fillMaxWidth().testTag("today-daily-advice"), shape = AffairsLayout.shape) {
        Box {
            if (bitmap != null) Box(Modifier.matchParentSize()) {
                Image(bitmap.asImageBitmap(), null, Modifier.fillMaxSize().testTag("daily-advice-art"),
                    contentScale = ContentScale.Crop)
                Box(Modifier.matchParentSize().background(Brush.horizontalGradient(
                    0f to surface.copy(alpha = if (LocalEveningTheme.current) .84f else .90f),
                    .40f to surface.copy(alpha = .86f),
                    .70f to surface.copy(alpha = .76f),
                    1f to surface.copy(alpha = if (LocalEveningTheme.current) .58f else .76f))))
            }
            Column(Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    NativeText(card.title.ifBlank { copy.getString("title") }, Modifier.weight(1f).testTag("daily-advice-title").semantics { heading() },
                        style = MaterialTheme.typography.titleMedium)
                    IconButton(onClick = onDismiss, enabled = !busy,
                        modifier = Modifier.size(48.dp).testTag("daily-advice-dismiss")
                            .semantics { contentDescription = copy.getString("hide") }) {
                        GenesisLucideIcon("x", Modifier.size(18.dp))
                    }
                }
                NativeText(card.body, Modifier.testTag("daily-advice-body"), style = MaterialTheme.typography.bodyLarge)
                val names = copy.getJSONArray("categories")
                NativeText(copy.getString("title") + " · " + card.categories.joinToString(" · ") {
                    if (it == "aphrodisia" && card.aphrodisiaTheme != null) copy.getString(when(card.aphrodisiaTheme) {
                        "love" -> "themeLove"; "aesthetics" -> "themeAesthetics"; else -> "themeConsciousness"
                    }) else names.getString(adviceCategories.indexOf(it))
                }, style = MaterialTheme.typography.bodySmall)
                if (rotation != null && rotation.dailyLimit > 1) NativeText(
                    copy.getString("position").replace("{current}", rotation.sequence.toString())
                        .replace("{limit}", rotation.dailyLimit.toString()) +
                        (if (!rotation.canNext) " · " + copy.getString("limitReached") else ""),
                    modifier = Modifier.testTag("daily-advice-position").semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodySmall)
                card.sources.forEach { source ->
                    NativeText(copy.getString(if (source.kind == "quote") "source" else "inspired") + ": " +
                        listOf(source.author, source.work, source.reference).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall)
                }
                Row(Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    val favoriteLabel = genesisTranslate("Избранное")
                    val dislikeLabel = genesisTranslate("Не нравится")
                    IconToggleButton(checked = reaction == "favorite", onCheckedChange = { onReaction?.invoke("favorite") },
                        enabled = onReaction != null && !busy && !reactionBusy, modifier = Modifier.size(48.dp)
                            .testTag("daily-advice-favorite").semantics { contentDescription = favoriteLabel }) {
                        GenesisLucideIcon("thumbs-up")
                    }
                    IconToggleButton(checked = reaction == "dislike", onCheckedChange = { onReaction?.invoke("dislike") },
                        enabled = onReaction != null && !busy && !reactionBusy, modifier = Modifier.size(48.dp)
                            .testTag("daily-advice-dislike").semantics { contentDescription = dislikeLabel }) {
                        GenesisLucideIcon("thumbs-down")
                    }
                    if (rotation != null && rotation.dailyLimit > 1) {
                        val nextLabel = copy.getString("next")
                        IconButton(onClick = { onNext?.invoke() }, enabled = !busy && rotation.canNext,
                            modifier = Modifier.size(48.dp).testTag("daily-advice-next")
                                .semantics { contentDescription = nextLabel }) {
                            GenesisLucideIcon("refresh-cw")
                        }
                    }
                    if (onOpenDiary != null) IconButton(onClick = onOpenDiary,
                        modifier = Modifier.size(48.dp).testTag("daily-advice-diary")
                            .semantics { contentDescription = "Дневник" }) {
                        GenesisLucideIcon("book-open", Modifier.size(24.dp))
                    }
                    AdviceShareButton(card, bitmap, copy) { shareFailed = it }
                }
                if (shareFailed) NativeText(copy.getString("shareError"), color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("daily-advice-share-error").semantics { liveRegion = LiveRegionMode.Polite })
                if (reactionBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (reactionError) Text("Не удалось сохранить. Черновик остаётся в дневнике.",
                    color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
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
    var ageCategories by remember { mutableStateOf<List<String>?>(null) }
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
    SettingsPreferenceCard(copy.getString("title"), Modifier.testTag("daily-advice-settings"),
        description = copy.getString("tradition")) {
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
                                val categories = available.filter {
                                    if (it == category) check else it in selected
                                }
                                if (category == "aphrodisia" && check) ageCategories = categories
                                else change(JSONObject().put("categories", JSONArray(categories)))
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
                if (saved.smart && "aphrodisia" in available) {
                    val checked = "aphrodisia" in selected
                    Row(Modifier.fillMaxWidth().heightIn(min=48.dp).testTag("advice-category-aphrodisia")
                        .toggleable(checked, enabled=enabled && !busy, role=Role.Checkbox) { check ->
                            val categories=available.filter { if(it=="aphrodisia") check else it in selected }
                            if(check) ageCategories=categories else change(JSONObject().put("categories",JSONArray(categories)))
                        }, verticalAlignment=Alignment.CenterVertically) {
                        Checkbox(checked,null,enabled=enabled && !busy)
                        NativeText(copy.getJSONArray("categories").getString(4),Modifier.weight(1f))
                    }
                }
                if ("aphrodisia" in available && "aphrodisia" in selected) {
                    TextButton(onClick = { ageCategories = saved.categories }, enabled = enabled && !busy,
                        modifier = Modifier.heightIn(min = 48.dp).testTag("advice-age-manage")) { NativeText(copy.getString("ageManage")) }
                    NativeText(copy.getString(if(saved.aphrodisiaAdult == true) "ageAllowed" else "ageRestricted"), style = MaterialTheme.typography.bodyMedium)
                }
                NativeText(copy.getString("scopeHint"), style = MaterialTheme.typography.bodyMedium)
                if (!catalogAvailable) NativeText(copy.getString("pending"), style = MaterialTheme.typography.bodyMedium)
            }
            if (error) NativeText(copy.getString("saveError"), color = MaterialTheme.colorScheme.error,
                modifier = Modifier.testTag("daily-advice-settings-error").semantics { liveRegion = LiveRegionMode.Polite })
            AffairsDisclosure(copy.getString("privacyTitle")) {
                NativeText(copy.getString("privacyNotice"), style = MaterialTheme.typography.bodyMedium)
                NativeText(copy.getString("ageLegal"), style = MaterialTheme.typography.bodyMedium)
            }
    }
    ageCategories?.let { categories -> AlertDialog(onDismissRequest = { ageCategories = null },
        title = { NativeText(copy.getString("ageQuestion")) }, text = { NativeText(copy.getString("ageHint")) },
        confirmButton = { TextButton(onClick = { ageCategories = null; change(JSONObject().put("categories", JSONArray(categories)).put("aphrodisiaAdult", true)) },
            modifier = Modifier.heightIn(min = 48.dp).testTag("advice-age-yes")) { NativeText(copy.getString("ageYes")) } },
        dismissButton = { TextButton(onClick = { ageCategories = null; change(JSONObject().put("categories", JSONArray(categories)).put("aphrodisiaAdult", false)) },
            modifier = Modifier.heightIn(min = 48.dp).testTag("advice-age-no")) { NativeText(copy.getString("ageNo")) } }) }
}
