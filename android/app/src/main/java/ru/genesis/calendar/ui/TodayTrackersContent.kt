package ru.genesis.calendar.ui

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
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.habits.TrackerEntity
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
    var createAbstinence by remember(date, repo) { mutableStateOf(false) }
    var chooseSleepPlan by remember(date, repo) { mutableStateOf(false) }
    var planEditor by remember(date, repo) { mutableStateOf<SleepPlan?>(null) }
    val newPlanTitle = genesisTranslate("Сон и пробуждение")
    val canEdit = !busy && date == LocalDate.now()
    val current = data
    if (current == null) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Сон и настроение", style = MaterialTheme.typography.titleMedium)
        if (error == null) LinearProgressIndicator(Modifier.fillMaxWidth())
        else { Text(error!!, color = MaterialTheme.colorScheme.error); TextButton(onClick = { retry++ }) { Text("Повторить") } }
    } else {
        TodayTrackerCards(current, date, canEdit,
            onMood = { error = null; moodEditor = current.moodEntries },
            onSleep = { plan, entry -> error = null; sleepEditor = plan to entry },
            onAbstinence = { tracker, entry -> error = null; abstinenceEditor = tracker to entry },
            onOpenSleep = { error = null; if (current.sleepPlans.isEmpty())
                planEditor = SleepPlan(TrackerEntity.create("sleep-plan"), dailySleepSchedule(date, prefs.input), title = newPlanTitle)
                else chooseSleepPlan = true },
            onCreateAbstinence = { error = null; createAbstinence = true },
            use24 = prefs.use24,
            canCreateAbstinence = current.addictionDataLoaded || !app.workspaceScope.startsWith("account-"))
    }
    if (chooseSleepPlan) AlertDialog(onDismissRequest = { chooseSleepPlan = false }, title = { Text("Выберите план сна") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            current?.sleepPlans.orEmpty().forEach { plan -> TextButton(onClick = { chooseSleepPlan = false; planEditor = plan }) {
                androidx.compose.material3.Text(plan.title)
            } }
            TextButton(onClick = { chooseSleepPlan = false; planEditor = SleepPlan(TrackerEntity.create("sleep-plan"),
                dailySleepSchedule(date, prefs.input), title = newPlanTitle) }) { Text("Создать план сна") }
        } }, confirmButton = {})
    planEditor?.let { plan -> SleepPlanEditor(plan, prefs.use24, busy, error, { if (!busy) planEditor = null }) { next ->
        if (canEdit) scope.launch { save({ repo.savePlan(next) }, { planEditor = null }) }
    } }
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
    if (createAbstinence) {
        var title by rememberSaveable { mutableStateOf("") }
        AlertDialog(onDismissRequest = { if (!busy) createAbstinence = false }, title = { Text("Добавить трекер воздержания") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { if (it.length <= 500) title = it }, label = { Text("Наблюдаемое поведение") }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth().testTag("abstinence-name"))
                Text("Каждый день", style = MaterialTheme.typography.bodySmall)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            } }, confirmButton = { TextButton(enabled = canEdit && title.isNotBlank(), onClick = {
                scope.launch { save({ repo.saveAddiction(AddictionTracker(TrackerEntity.create("addiction"),
                    dailySleepSchedule(date, prefs.input), trackedBehavior = title.trim())) }, { createAbstinence = false }) }
            }) { Text("Создать") } }, dismissButton = { TextButton(enabled = !busy, onClick = { createAbstinence = false }) { Text("Отмена") } })
    }
}

@Composable
internal fun TodayTrackerCards(data: LocalTrackersWorkspace, date: LocalDate, enabled: Boolean,
    onMood: () -> Unit, onSleep: (SleepPlan, SleepEntry?) -> Unit,
    onAbstinence: (AddictionTracker, AddictionEntry?) -> Unit, onOpenSleep: () -> Unit,
    onCreateAbstinence: () -> Unit, canCreateAbstinence: Boolean, use24: Boolean = true) {
    val mood = data.moodEntries.firstOrNull { it.date == date }
    val sleep = data.sleepPlans.filter { it.active && TrackerSchedules.isScheduled(it.schedule, date) }
    val abstinence = data.addictionTrackers.filter { it.status == "active" && TrackerSchedules.isScheduled(it.schedule, date) }
    Column(Modifier.fillMaxWidth().testTag("today-observations"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Настроение дня", style = MaterialTheme.typography.titleMedium)
                if (mood == null) Text("Не выбрано", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else androidx.compose.material3.Text(
                    (mood.customEmoji.ifBlank { moodEmoji(mood.moodValue) }) + " " +
                        (mood.customLabel.ifBlank { moodOptionLabel(mood.moodValue) }))
            }
            AffairsIconButton(if (mood == null) "Выбрать настроение" else "Изменить настроение", AffairsAction.EDIT, onMood,
                Modifier.testTag("today-mood-edit"), enabled)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Сон", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
            AffairsIconButton("Открыть планы сна", AffairsAction.SETTINGS, onOpenSleep, Modifier.testTag("today-sleep-plans"), enabled)
        }
        if (sleep.isEmpty()) Text("На этот день ничего не запланировано.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        sleep.forEach { plan ->
            val entry = data.sleepEntries.firstOrNull { it.planId == plan.id && it.date == date }
            Row(Modifier.fillMaxWidth().testTag("today-sleep-${plan.id}"), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    androidx.compose.material3.Text(plan.title, style = MaterialTheme.typography.titleSmall)
                    Text("Засыпание" + ": " + (entry?.fellAsleepAt?.let { timeLabel(it.toString(), use24) } ?: "—") +
                        " · " + "Пробуждение" + ": " + (entry?.wokeAt?.let { timeLabel(it.toString(), use24) } ?: "—"),
                        style = MaterialTheme.typography.bodySmall)
                    entry?.quality?.let { Text("Качество: $it из 10", style = MaterialTheme.typography.bodySmall) }
                }
                AffairsIconButton("Запись сна", AffairsAction.EDIT, { onSleep(plan, entry) },
                    Modifier.testTag("today-sleep-edit-${plan.id}"), enabled)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Воздержание", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
            AffairsIconButton("Добавить трекер воздержания", AffairsAction.ADD, onCreateAbstinence,
                Modifier.testTag("today-abstinence-add"), enabled && canCreateAbstinence)
        }
        if (!canCreateAbstinence) Text("Обновите данные аккаунта и повторите попытку.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        else if (abstinence.isEmpty()) Text("На этот день ничего не запланировано.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        abstinence.forEach { tracker ->
            val entry = data.addictionEntries.firstOrNull { it.trackerId == tracker.id && it.date == date }
            Row(Modifier.fillMaxWidth().testTag("today-abstinence-${tracker.id}"), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    androidx.compose.material3.Text(tracker.trackedBehavior, style = MaterialTheme.typography.titleSmall)
                    Text(when { entry?.relapse == true -> "Срыв"; entry?.cleanDay == true -> "Чистый день"; else -> "Не выбрано" })
                    if (entry != null) Text("Сила тяги" + ": ${entry.cravingIntensity}/10", style = MaterialTheme.typography.bodySmall)
                }
                AffairsIconButton("Итог дня", AffairsAction.EDIT, { onAbstinence(tracker, entry) },
                    Modifier.testTag("today-abstinence-edit-${tracker.id}"), enabled)
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
            androidx.compose.material3.Text(tracker.trackedBehavior, style = MaterialTheme.typography.titleMedium)
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
