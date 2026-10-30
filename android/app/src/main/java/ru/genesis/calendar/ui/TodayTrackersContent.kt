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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.trackers.*

/** One account-scoped encrypted repository, shared with the sleep/mood screen and web workspace. */
@Composable
internal fun TodayTrackersContent(app: GenesisApplication, date: LocalDate, prefs: UiPreferences) {
    val repo = remember(app, app.workspaceScope) { TrackersRepository(app) }
    var data by remember(repo) { mutableStateOf<LocalTrackersWorkspace?>(null) }
    var error by remember(repo) { mutableStateOf<String?>(null) }
    var retry by remember(repo) { mutableIntStateOf(0) }
    var busy by remember(repo) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(repo, retry) {
        try { repo.workspace.collect { data = it; error = null } }
        catch (e: CancellationException) { throw e }
        catch (_: Exception) { data = null; error = "Защищённые записи недоступны. Сохранённые данные не будут заменены пустыми." }
    }
    suspend fun save(block: suspend () -> Unit, close: () -> Unit) {
        busy = true
        try { block(); error = null; close() }
        catch (e: CancellationException) { throw e }
        catch (e: IllegalArgumentException) { error = e.message ?: "Проверьте введённые данные." }
        catch (_: Exception) { error = "Не удалось сохранить запись. Введённые данные остаются в форме." }
        finally { busy = false }
    }
    var moodEditor by remember(date, repo) { mutableStateOf<List<MoodEntry>?>(null) }
    var sleepEditor by remember(date, repo) { mutableStateOf<Pair<SleepPlan, SleepEntry?>?>(null) }
    var abstinenceEditor by remember(date, repo) { mutableStateOf<Pair<AddictionTracker, AddictionEntry?>?>(null) }
    val canEdit = !busy && date == LocalDate.now()
    val current = data
    if (current == null) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Сон и настроение", style = MaterialTheme.typography.titleMedium)
        if (error == null) WorkspaceLoadingLine(Modifier.fillMaxWidth())
        else { Text(error!!, color = MaterialTheme.colorScheme.error); TextButton(onClick = { retry++ }) { Text("Повторить") } }
    } else {
        TodayTrackerCards(current, date, canEdit,
            onMood = { error = null; moodEditor = current.moodEntries },
            onSleep = { plan, entry -> error = null; sleepEditor = plan to entry },
            onAbstinence = { tracker, entry -> error = null; abstinenceEditor = tracker to entry },
            use24 = prefs.use24)
    }
    moodEditor?.let { snapshot ->
        val entry = snapshot.firstOrNull { it.date == date }
        MoodObservationEditor(snapshot, date, prefs.input, prefs.language, remember(app) { fullEmojiCatalog(app) }, busy, error,
            onDismiss = { if (!busy) moodEditor = null }, fixedDate = true) { savedDate, value, note, label, emoji ->
            if (canEdit && savedDate == date) scope.launch { save({
                repo.saveMood(date, value, note, entry?.tags.orEmpty(), entry?.entity?.version ?: 0, label, emoji)
            }, { moodEditor = null }) }
        }
    }
    sleepEditor?.let { (plan, entry) ->
        SleepObservationEditor(plan, entry, date, prefs.use24, busy, error, onDismiss = { if (!busy) sleepEditor = null }) { bed, wake, quality, note ->
            if (canEdit) scope.launch { save({ repo.saveSleep(plan.id, date, bed, wake, quality, note, entry?.entity?.version ?: 0) }, { sleepEditor = null }) }
        }
    }
    abstinenceEditor?.let { (tracker, entry) ->
        AbstinenceObservationEditor(tracker, entry, busy, error, { if (!busy) abstinenceEditor = null }) { clean, relapse, craving, trigger, note ->
            if (canEdit) scope.launch { save({ repo.saveAbstinence(tracker.id, date, clean, relapse, craving, trigger, note,
                entry?.entity?.version ?: 0) }, { abstinenceEditor = null }) }
        }
    }
}

@Composable
internal fun TodayTrackerCards(data: LocalTrackersWorkspace, date: LocalDate, enabled: Boolean,
    onMood: () -> Unit, onSleep: (SleepPlan, SleepEntry?) -> Unit,
    onAbstinence: (AddictionTracker, AddictionEntry?) -> Unit, use24: Boolean = true) {
    val mood = data.moodEntries.firstOrNull { it.date == date }
    val sleep = data.sleepPlans.filter { it.active && TrackerSchedules.isScheduled(it.schedule, date) }
    val abstinence = data.addictionTrackers.filter {
        it.status == "active" && it.trackedBehavior.isNotBlank() && TrackerSchedules.isScheduled(it.schedule, date)
    }
    Column(Modifier.fillMaxWidth().testTag("today-observations"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TodayObservationSummary("Настроение дня", "heart-pulse",
            if (mood == null) "Выбрать настроение" else "Изменить настроение",
            "today-mood-edit", enabled, onMood,
            actionText = if (mood == null) "Выбрать" else "Поменять") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (mood != null) UntranslatedText(
                    mood.customEmoji.ifBlank { MoodTracker.option(mood.moodValue.toDouble()).symbol },
                    style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                if (mood == null) Text("Не выбрано", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else if (mood.customLabel.isNotBlank()) UntranslatedText(mood.customLabel,
                    style = MaterialTheme.typography.titleMedium)
                else Text(moodOptionLabel(mood.moodValue), style = MaterialTheme.typography.titleMedium)
            }
        }
        sleep.forEach { plan ->
            val entry = data.sleepEntries.firstOrNull { it.planId == plan.id && it.date == date }
            Box(Modifier.testTag("today-sleep-${plan.id}")) {
            TodayObservationSummary("Сон", "moon", "Запись сна", "today-sleep-edit-${plan.id}", enabled,
                { onSleep(plan, entry) }) {
                    UntranslatedText(plan.title, style = MaterialTheme.typography.titleMedium)
                    Text("Засыпание" + ": " + (entry?.fellAsleepAt?.let { timeLabel(it.toString(), use24) } ?: "—") +
                        " · " + "Пробуждение" + ": " + (entry?.wokeAt?.let { timeLabel(it.toString(), use24) } ?: "—"),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    entry?.quality?.let { Text("Качество: $it из 10", style = MaterialTheme.typography.bodySmall) }
            }
            }
        }
        abstinence.forEach { tracker ->
            val entry = data.addictionEntries.firstOrNull { it.trackerId == tracker.id && it.date == date }
            Box(Modifier.testTag("today-abstinence-${tracker.id}")) {
            TodayObservationSummary("Воздержание", "shield-check", "Итог дня", "today-abstinence-edit-${tracker.id}",
                enabled, { onAbstinence(tracker, entry) }) {
                    UntranslatedText(tracker.trackedBehavior, style = MaterialTheme.typography.titleMedium)
                    Text(when { entry?.relapse == true -> "Срыв"; entry?.cleanDay == true -> "Чистый день"; else -> "Не выбрано" },
                        color = if (entry?.relapse == true) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                    if (entry != null) Text("Сила тяги" + ": ${entry.cravingIntensity}/10", style = MaterialTheme.typography.bodySmall)
            }
            }
        }
    }
}

/** The whole summary is a native touch target; no separate column of edit/setup buttons. */
@Composable
private fun TodayObservationSummary(title: String, icon: String, action: String, tag: String, enabled: Boolean,
    onClick: () -> Unit, actionText: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(onClick = onClick, enabled = enabled, shape = AffairsLayout.shape,
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        contentColor = MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp).testTag(tag).genesisDescription(action)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GenesisLucideIcon(icon, Modifier.size(24.dp), MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                content()
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                actionText?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary) }
                GenesisLucideIcon("chevron-right", Modifier.size(20.dp), MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
internal fun AbstinenceObservationEditor(tracker: AddictionTracker, entry: AddictionEntry?, busy: Boolean, error: String?,
    onDismiss: () -> Unit, onSave: (Boolean, Boolean, Int, String, String) -> Unit) {
    var clean by rememberSaveable(tracker.id) { mutableStateOf(entry?.cleanDay == true) }
    var relapse by rememberSaveable(tracker.id) { mutableStateOf(entry?.relapse == true) }
    var craving by rememberSaveable(tracker.id) { mutableIntStateOf(entry?.cravingIntensity ?: 0) }
    var trigger by rememberSaveable(tracker.id) { mutableStateOf(entry?.trigger ?: "") }
    var note by rememberSaveable(tracker.id) { mutableStateOf(entry?.note ?: "") }
    Dialog(onDismissRequest = onDismiss) { Surface(shape = MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EditorDialogHeader("Воздержание", "abstinence-close", onDismiss)
            UntranslatedText(tracker.trackedBehavior, style = MaterialTheme.typography.titleMedium)
            FilterChip(clean, { clean = true; relapse = false }, enabled = !busy, label = { Text("Чистый день") },
                modifier = Modifier.heightIn(min = 48.dp).testTag("abstinence-clean"))
            FilterChip(relapse, { relapse = true; clean = false }, enabled = !busy, label = { Text("Срыв") },
                modifier = Modifier.heightIn(min = 48.dp).testTag("abstinence-relapse"))
            Text("Сила тяги" + ": $craving/10")
            Slider(craving.toFloat(), { craving = it.toInt() }, valueRange = 0f..10f, steps = 9, enabled = !busy)
            OutlinedTextField(trigger, { trigger = it }, label = { Text("Триггер") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(note, { note = it }, label = { Text("Заметка") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(onClick = { onSave(clean, relapse, craving, trigger, note) }, enabled = !busy,
                modifier = Modifier.heightIn(min = 48.dp).testTag("abstinence-save")) { Text("Сохранить") }
        }
    } }
}
