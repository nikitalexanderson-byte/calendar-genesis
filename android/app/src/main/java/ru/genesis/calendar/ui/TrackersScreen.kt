package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import ru.genesis.calendar.ui.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.util.UUID
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import ru.genesis.calendar.domain.trackers.*

@Composable
fun TrackersScreen(app: GenesisApplication, experimental: Boolean = false) {
    val repository=remember(app) { TrackersRepository(app) }
    val preferences=remember(app) { LocalPreferences(app,app.workspaceScope) }
    val prefs by preferences.values.collectAsStateWithLifecycle(initialValue=UiPreferences())
    val scope=rememberCoroutineScope()
    val emojiCategories=remember(app) { fullEmojiCatalog(app) }
    var workspace by remember { mutableStateOf<LocalTrackersWorkspace?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var storageError by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var dateValue by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var selectedViewMode by rememberSaveable { mutableStateOf<CalendarMode?>(null) }
    var planEditor by remember { mutableStateOf<SleepPlan?>(null) }
    var sleepEditor by remember { mutableStateOf<Pair<SleepPlan,SleepEntry?>?>(null) }
    var moodEditor by remember { mutableStateOf(false) }
    val date=LocalDate.parse(dateValue)
    val enabledCalendars = LocalEnabledCalendars.current
    val viewMode = (selectedViewMode ?: prefs.display).takeIf { it in enabledCalendars }
        ?: enabledCalendars.firstOrNull() ?: prefs.display
    val current=workspace
    val mood=current?.moodEntries?.firstOrNull { it.date==date }
    val averageMinutes=current?.sleepEntries?.filter { it.date==date }
        ?.mapNotNull { it.durationMinutes }?.takeIf { it.isNotEmpty() }?.average()?.toInt()
    suspend fun action(block: suspend () -> Unit) {
        busy=true
        try { block();error=null }
        catch(e: CancellationException) { throw e }
        catch(e: IllegalArgumentException) { error=e.message ?: "Проверьте введённые данные." }
        catch(_: Exception) { error="Не удалось сохранить запись. Введённые данные остаются в форме." }
        finally { busy=false }
    }
    LaunchedEffect(repository) {
        try { repository.workspace.collect { workspace=it;storageError=false } }
        catch(e: CancellationException) { throw e }
        catch(_: Exception) { storageError=true;error="Защищённые записи недоступны. Сохранённые данные не будут заменены пустыми." }
    }
    LaunchedEffect(current?.revision) {
        if (current != null) runCatching { ru.genesis.calendar.reminders.SleepReminderScheduler.restore(app) }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        GenesisPageHeader(if (LocalGenesisLanguage.current == "en") "Sleep & mood" else "Сон и настроение",
            if (LocalGenesisLanguage.current == "en") "Sleep, recovery and emotional rhythm without pressure"
            else "Сон, восстановление и эмоциональный ритм без давления", "☾",
            footer = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (experimental) Text(
                        "ⓘ Сон и настроение — личные наблюдения без XP и Лавров. Это не медицинская оценка.",
                        color=MaterialTheme.colorScheme.onSurfaceVariant, style=MaterialTheme.typography.bodySmall,
                        modifier=Modifier.testTag("trackers-observation-note"))
                    HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
                    Text("Выберите день для просмотра записей", color=MaterialTheme.colorScheme.primary,
                        style=MaterialTheme.typography.labelMedium)
                    Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) {
                            AuthorDatePicker(dateValue,viewMode) { if(!busy)dateValue=it }
                        }
                        TextButton(onClick={dateValue=LocalDate.now().toString()}, enabled=!busy) {
                            Text("Сегодня", color=MaterialTheme.colorScheme.primary)
                        }
                    }
                    Row(verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        CalendarModeSwitcher(viewMode, { selectedViewMode=nextAvailableCalendarMode(viewMode, enabledCalendars) },
                            size=48.dp)
                        Column {
                            Text("Календарь просмотра", color=MaterialTheme.colorScheme.onSurfaceVariant,
                                style=MaterialTheme.typography.labelSmall)
                            Text(mobileCalendarCopy(LocalGenesisLanguage.current).calendarName(viewMode),
                                color=MaterialTheme.colorScheme.onSurface,style=MaterialTheme.typography.bodyMedium)
                        }
                    }
                    HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
                    Text("Ритм восстановления", color=MaterialTheme.colorScheme.onSurface,
                        style=MaterialTheme.typography.titleLarge)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        TrackerMetric("☾", "Сон", averageMinutes?.let { "${it/60} ч ${it%60} мин" } ?: "Нет записи",
                            Modifier.weight(1f))
                        TrackerMetric("♥", "Настроение", mood?.let {
                            it.customLabel.ifBlank { MoodTracker.option(it.moodValue.toDouble()).label }
                        } ?: "Не выбрано", Modifier.weight(1f))
                    }
                }
            }, compact = LocalFixedSubmenu.current)
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        if(current==null) { if(!storageError)CircularProgressIndicator() }
        else {
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        val moodColor = mood?.let { Color(android.graphics.Color.parseColor(
                            MoodTracker.option(it.moodValue.toDouble()).color)) } ?: MaterialTheme.colorScheme.primary
                        Surface(Modifier.size(48.dp), shape = CircleShape, color = moodColor.copy(alpha = .16f),
                            border = BorderStroke(1.dp, moodColor.copy(alpha = .55f))) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(mood?.let { it.customEmoji.ifBlank { moodEmoji(it.moodValue) } } ?: "😊",
                                    color = moodColor, style = MaterialTheme.typography.headlineSmall)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text("Настроение дня",style=MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.onSurface)
                            if(mood==null) Text("Пока не выбрано", color = MaterialTheme.colorScheme.onSurfaceVariant) else {
                                val option=MoodTracker.option(mood.moodValue.toDouble())
                                Text(mood.customLabel.ifBlank { option.label },color=MaterialTheme.colorScheme.onSurface,
                                    style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                    if(mood?.note?.isNotEmpty()==true)Text(mood.note)
                    Text("Отметка помогает увидеть закономерности и не влияет на XP или Лавры.",
                        style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    if (experimental) HabitsFeatureActionButton(
                        label=if(mood==null) "Выбрать настроение" else "Изменить настроение",
                        onClick={moodEditor=true}, enabled=!busy&&!storageError,
                        containerColor=MaterialTheme.colorScheme.primary, contentColor=MaterialTheme.colorScheme.onPrimary,
                        borderColor=MaterialTheme.colorScheme.outlineVariant)
                    else Button(enabled=!busy&&!storageError,onClick={moodEditor=true},
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) {
                        Text(if(mood==null)"Выбрать настроение" else "Изменить настроение")
                    }
                }
            }
            val createSleepPlan = {
                val schedule=dailySleepSchedule(date,prefs.input)
                planEditor=SleepPlan(TrackerEntity.create("sleep-plan"),schedule)
            }
            SleepTrackerGroup(experimental) {
            if (experimental) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                    Surface(Modifier.size(48.dp), shape=CircleShape,
                        color=MaterialTheme.colorScheme.primary.copy(alpha=.16f),
                        border=BorderStroke(1.dp,MaterialTheme.colorScheme.primary.copy(alpha=.55f))) {
                        Box(contentAlignment=Alignment.Center) {
                            Text("☾", color=MaterialTheme.colorScheme.primary,
                                style=MaterialTheme.typography.headlineSmall)
                        }
                    }
                    Column(Modifier.weight(1f)) {
                        Text("Сон",style=MaterialTheme.typography.titleLarge,
                            color=MaterialTheme.colorScheme.onSurface)
                        Text("Планы и фактическое восстановление", style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                HabitsFeatureActionButton(label="＋ Создать план сна", onClick=createSleepPlan,
                    enabled=!busy&&!storageError,
                    containerColor=MaterialTheme.colorScheme.primary, contentColor=MaterialTheme.colorScheme.onPrimary,
                    borderColor=MaterialTheme.colorScheme.outlineVariant)
            } else {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
                    verticalAlignment=Alignment.CenterVertically) {
                    Column {
                        Text("Сон",style=MaterialTheme.typography.titleLarge)
                        Text("Планы и фактическое восстановление", style=MaterialTheme.typography.bodySmall,
                            color=MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FilledTonalButton(enabled=!busy&&!storageError,onClick=createSleepPlan) { Text("＋ План") }
                }
            }
            if(current.sleepPlans.isEmpty()) Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.surfaceContainerLow, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("☾", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium)
                    Text("Пока нет плана сна. Создайте ориентир, затем отмечайте фактическое время.",
                        Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                }
            }
            AdaptiveCardGrid(current.sleepPlans, { it.id }) { plan ->
                val entry=current.sleepEntries.firstOrNull { it.planId==plan.id&&it.date==date }
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Surface(Modifier.size(48.dp), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primary) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("☾", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.headlineSmall)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text(plan.title,style=MaterialTheme.typography.titleMedium,color = MaterialTheme.colorScheme.onSurface)
                            Text(if(plan.active) "Активный план" else "На паузе",
                                style = MaterialTheme.typography.labelMedium,
                                color = if(plan.active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceContainer) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("◷ План · ${timeLabel(plan.targetBedtime.toString(),prefs.use24)} → ${timeLabel(plan.targetWakeTime.toString(),prefs.use24)}",
                                style=MaterialTheme.typography.titleSmall,color = MaterialTheme.colorScheme.onSurface)
                            Text(plan.schedule.timezone,style=MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if(entry==null)Text("Нет записи на выбранную дату", color = MaterialTheme.colorScheme.onSurfaceVariant) else {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TrackerLightMetric("Засыпание", entry.fellAsleepAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "—",
                                Modifier.weight(1f))
                            TrackerLightMetric("Пробуждение", entry.wokeAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "—",
                                Modifier.weight(1f))
                        }
                        Text(entry.durationMinutes?.let { "☾ Длительность · ${it/60} ч ${it%60} мин" } ?: "Длительность пока не рассчитана",
                            style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                        Text(entry.quality?.let { "✦ Качество · $it из 10" } ?: "Качество не оценено",
                            style = MaterialTheme.typography.bodyMedium)
                        entry.deviationMinutes?.let { Text("Отклонение от плана · $it мин",style=MaterialTheme.typography.bodySmall) }
                        if(entry.note.isNotEmpty())Text(entry.note)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(enabled=plan.active&&!busy&&!storageError,onClick={sleepEditor=plan to entry},
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                            Text(if(entry==null)"Добавить запись" else "Изменить запись")
                        }
                        OutlinedButton(enabled=!busy&&!storageError,onClick={planEditor=plan},
                            modifier = Modifier.heightIn(min = 48.dp)) { Text("План") }
                    }
                } }
            }
            }
            if (!experimental) Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                Text("ⓘ Сон и настроение — личные наблюдения без XP и Лавров. Это не медицинская оценка.",
                    Modifier.padding(14.dp), style=MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
            if(current.sleepEntries.isNotEmpty()||current.moodEntries.isNotEmpty()) {
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("История наблюдений",style=MaterialTheme.typography.titleMedium)
                    (current.sleepEntries.map { it.date }+current.moodEntries.map { it.date }).distinct().sortedDescending().take(90).forEach { historyDate ->
                        val historyMood=current.moodEntries.firstOrNull { it.date==historyDate }
                        val moodLabel=historyMood?.let { it.customLabel.ifBlank { moodOptionLabel(it.moodValue) } } ?: "—"
                        TextButton(onClick={dateValue=historyDate.toString()},enabled=!busy,
                            modifier = Modifier.fillMaxWidth()) {
                            Text("$historyDate · ☾ ${current.sleepEntries.count { it.date==historyDate }} · ${historyMood?.let { it.customEmoji.ifBlank { moodEmoji(it.moodValue) } } ?: "—"} $moodLabel",
                                Modifier.fillMaxWidth())
                        }
                    }
                    }
                }
            }
        }
    }
    planEditor?.let { plan -> SleepPlanEditor(plan,prefs.use24,busy,error,onDismiss={if(!busy)planEditor=null}) { next ->
        scope.launch { action { repository.savePlan(next);planEditor=null } }
    } }
    sleepEditor?.let { (plan,entry) -> SleepObservationEditor(plan,entry,date,prefs.use24,busy,error,onDismiss={if(!busy)sleepEditor=null}) { bed,wake,quality,note ->
        scope.launch { action { repository.saveSleep(plan.id,date,bed,wake,quality,note,entry?.entity?.version ?: 0);sleepEditor=null } }
    } }
    if(moodEditor) {
        val existing=workspace?.moodEntries?.firstOrNull { it.date==date }
        MoodObservationEditor(workspace?.moodEntries.orEmpty(),if(existing!=null)date else LocalDate.now(),viewMode,
            prefs.language,emojiCategories,busy,error,
            onDismiss={if(!busy)moodEditor=false}) { chosenDate,value,note,customLabel,customEmoji ->
            val target=workspace?.moodEntries?.firstOrNull { it.date==chosenDate }
            scope.launch { action {
                repository.saveMood(chosenDate,value,note,target?.tags ?: emptyList(),target?.entity?.version ?: 0,
                    customLabel,customEmoji)
                dateValue=chosenDate.toString();moodEditor=false
            } }
        }
    }
}

@Composable
private fun SleepTrackerGroup(experimental: Boolean, content: @Composable ColumnScope.() -> Unit) {
    if (experimental) Card(Modifier.fillMaxWidth().testTag("sleep-tracker-group"),
        shape=RoundedCornerShape(10.dp),
        colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surfaceContainerLow),
        border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp),content=content)
    } else Column(verticalArrangement=Arrangement.spacedBy(14.dp),content=content)
}

private fun moodEmoji(value: Int) =
    listOf("😣", "😔", "😢", "😰", "😴", "😐", "😌", "🧠", "🙂", "😊", "🤩", "🥳")[value.coerceIn(-5,6)+5]

@Composable
private fun moodOptionLabel(value: Int): String {
    val option=MoodTracker.option(value.toDouble())
    return if(LocalGenesisLanguage.current=="en") option.labelEn else option.label
}

@Composable
private fun TrackerMetric(symbol: String, label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primaryContainer) {
        Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(symbol, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
            Text(value, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleSmall,
                maxLines = 2)
        }
    }
}

@Composable
private fun TrackerLightMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceContainer) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun SleepPlanEditor(plan: SleepPlan,use24: Boolean,busy: Boolean,error: String?,onDismiss: () -> Unit,onSave: (SleepPlan) -> Unit) {
    var title by rememberSaveable(plan.id) { mutableStateOf(plan.title) }
    var bed by rememberSaveable(plan.id) { mutableStateOf(plan.targetBedtime.toString()) }
    var wake by rememberSaveable(plan.id) { mutableStateOf(plan.targetWakeTime.toString()) }
    var zone by rememberSaveable(plan.id) { mutableStateOf(plan.schedule.timezone) }
    var active by rememberSaveable(plan.id) { mutableStateOf(plan.active) }
    var qualityEnabled by rememberSaveable(plan.id) { mutableStateOf(plan.qualityEnabled) }
    var scoringEnabled by rememberSaveable(plan.id) { mutableStateOf(plan.scoringEnabled) }
    var reminderEnabled by rememberSaveable(plan.id) { mutableStateOf(plan.reminderEnabled) }
    var reminderMinutesBefore by rememberSaveable(plan.id) { mutableIntStateOf(plan.reminderMinutesBefore) }
    var rules by remember(plan.id) { mutableStateOf(plan.rules) }
    var schedule by remember(plan.id) { mutableStateOf(plan.schedule) }
    val mode=when(schedule.recurrence.mode) { "classic" -> CalendarMode.PROFANE; "lunar" -> CalendarMode.LUNAR; else -> CalendarMode.SACRED }
    val english=LocalGenesisLanguage.current=="en"
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically) {
                Text("План сна",Modifier.weight(1f),style=MaterialTheme.typography.titleLarge)
                AffairsIconButton("Закрыть", AffairsAction.CLOSE, onDismiss,
                    Modifier.testTag("sleep-plan-close"), enabled = !busy)
            }
            OutlinedTextField(title,{title=it},label={Text("Название")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            if (LocalSacredFeaturesEnabled.current) {
            Text(if(english) "Plan calendar" else "Календарь плана",style=MaterialTheme.typography.titleSmall)
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                listOf(CalendarMode.SACRED,CalendarMode.PROFANE,CalendarMode.LUNAR).forEach { option ->
                    FilterChip(selected=mode==option,enabled=!busy,onClick={
                        val next=dailySleepSchedule(schedule.startDate,option)
                        schedule=schedule.copy(recurrence=next.recurrence.copy(rangeEnd=schedule.endDate?.toString() ?: ""))
                    },label={Text(when(option) {CalendarMode.SACRED->"Сакральный";CalendarMode.PROFANE->"Григорианский";CalendarMode.LUNAR->"Лунный"})})
                }
            }
            }
            Text("Начало")
            AuthorDatePicker(schedule.startDate.toString(),mode) { value -> if(!busy) {
                val start=LocalDate.parse(value)
                val end=schedule.endDate?.let { maxOf(it,start) }
                schedule=schedule.copy(startDate=start,endDate=end,recurrence=schedule.recurrence.copy(rangeStart=value,rangeEnd=end?.toString() ?: ""))
            } }
            Text("Планируемое засыпание");AuthorTimePicker(bed,use24) { if(!busy)bed=it }
            Text("Планируемое пробуждение");AuthorTimePicker(wake,use24) { if(!busy)wake=it }
            OutlinedTextField(zone,{zone=it},label={Text("Часовой пояс · Europe/Moscow")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            Row { Checkbox(active,{active=it},enabled=!busy);Text("План активен",Modifier.padding(top=12.dp)) }
            Row { Checkbox(qualityEnabled,{qualityEnabled=it},enabled=!busy);Text("Оценивать качество",Modifier.padding(top=12.dp)) }
            HorizontalDivider()
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Text("Напоминать о времени сна",Modifier.weight(1f))
                Switch(reminderEnabled,{reminderEnabled=it},enabled=!busy)
            }
            if(reminderEnabled) {
                Text("Когда уведомить",style=MaterialTheme.typography.labelLarge)
                listOf(0,15,30,60).chunked(2).forEach { options ->
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { options.forEach { minutes ->
                        FilterChip(reminderMinutesBefore==minutes,{reminderMinutesBefore=minutes},enabled=!busy,
                            label={Text(if(minutes==0)"В момент сна" else "За $minutes мин")})
                    } }
                }
                Text("Уведомления приходят по расписанию плана, если они разрешены в Android.",
                    style=MaterialTheme.typography.bodySmall)
            }
            HorizontalDivider()
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Text("Баллы за сон",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
                Switch(scoringEnabled,{scoringEnabled=it},enabled=!busy)
            }
            if(scoringEnabled) {
                Text("Баллы начисляются за выполненные условия. Это аналитика сна, без XP и Лавров.",
                    style=MaterialTheme.typography.bodySmall)
                rules.forEach { rule ->
                    Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(10.dp)) {
                        Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                                Text("Правило",Modifier.weight(1f),style=MaterialTheme.typography.labelLarge)
                                AffairsIconButton("Удалить правило", AffairsAction.DELETE, { rules=rules.filterNot { it.id==rule.id } }, enabled=!busy)
                            }
                            Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                FilterChip(rule.field=="bedtime",{rules=rules.map { if(it.id==rule.id)it.copy(field="bedtime") else it }},
                                    enabled=!busy,label={Text("Засыпание")})
                                FilterChip(rule.field=="wake",{rules=rules.map { if(it.id==rule.id)it.copy(field="wake") else it }},
                                    enabled=!busy,label={Text("Пробуждение")})
                            }
                            Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                FilterChip(rule.operator=="on-or-before",{rules=rules.map { if(it.id==rule.id)it.copy(operator="on-or-before") else it }},
                                    enabled=!busy,label={Text("Не позже")})
                                FilterChip(rule.operator=="after",{rules=rules.map { if(it.id==rule.id)it.copy(operator="after") else it }},
                                    enabled=!busy,label={Text("Позже")})
                            }
                            AuthorTimePicker(rule.threshold.toString(),use24) { time ->
                                if(!busy) rules=rules.map { if(it.id==rule.id)it.copy(threshold=LocalTime.parse(time)) else it }
                            }
                            OutlinedTextField(rule.points.toInt().toString(),{ input ->
                                val amount=input.toIntOrNull()
                                if(amount!=null && amount in -100..100) rules=rules.map { if(it.id==rule.id)it.copy(points=amount.toDouble()) else it }
                            },label={Text("Баллы от −100 до 100")},enabled=!busy,modifier=Modifier.fillMaxWidth())
                        }
                    }
                }
                OutlinedButton(onClick={rules=rules+SleepRule(UUID.randomUUID().toString(),"bedtime","on-or-before",
                    runCatching { LocalTime.parse(bed) }.getOrDefault(LocalTime.of(23,0)),10.0)},
                    enabled=!busy&&rules.size<20) { Text("＋ Добавить правило") }
            }
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row {
                TextButton(onClick=onDismiss,enabled=!busy) { Text("Отмена") }
                Button(enabled=!busy&&title.isNotBlank()&&bed.isNotBlank()&&wake.isNotBlank()&&runCatching { ZoneId.of(zone) }.isSuccess,onClick={
                    onSave(plan.copy(title=title.trim(),targetBedtime=LocalTime.parse(bed),targetWakeTime=LocalTime.parse(wake),
                        schedule=schedule.copy(timezone=zone),active=active,qualityEnabled=qualityEnabled,
                        scoringEnabled=scoringEnabled,rules=rules,reminderEnabled=reminderEnabled,
                        reminderMinutesBefore=reminderMinutesBefore))
                }) { Text("Сохранить план") }
            }
        }
    } }
}

private fun dailySleepSchedule(date: LocalDate,mode: CalendarMode): TrackerSchedule {
    val base=HabitEngine(GenesisCalendar()).defaultSchedule(date,mode)
    val days=when(mode) { CalendarMode.PROFANE -> listOf(1); CalendarMode.SACRED -> (1..5).toList(); CalendarMode.LUNAR -> (1..30).toList() }
    return base.copy(recurrence=base.recurrence.copy(days=days))
}

@Composable
private fun SleepObservationEditor(plan: SleepPlan,entry: SleepEntry?,date: LocalDate,use24: Boolean,busy: Boolean,error: String?,onDismiss: () -> Unit,
    onSave: (LocalTime?,LocalTime?,Double?,String) -> Unit) {
    val key="${plan.id}:$date"
    var bed by rememberSaveable(key) { mutableStateOf(entry?.fellAsleepAt?.toString() ?: "") }
    var wake by rememberSaveable(key) { mutableStateOf(entry?.wokeAt?.toString() ?: "") }
    var quality by rememberSaveable(key) { mutableStateOf(entry?.quality) }
    var note by rememberSaveable(key) { mutableStateOf(entry?.note ?: "") }
    val bedtime=bed.takeIf { it.isNotEmpty() }?.let(LocalTime::parse)
    val wakeTime=wake.takeIf { it.isNotEmpty() }?.let(LocalTime::parse)
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text("Запись сна · $date",style=MaterialTheme.typography.titleLarge)
            Text("Дата относится к засыпанию. Если пробуждение не позже засыпания по часам, используется следующий день.",style=MaterialTheme.typography.bodySmall)
            Text("Засыпание");AuthorTimePicker(bed,use24) { if(!busy)bed=it }
            Text("Пробуждение");AuthorTimePicker(wake,use24) { if(!busy)wake=it }
            if(bedtime!=null&&wakeTime!=null) {
                val duration=SleepTracker.durationMinutes(date,bedtime,wakeTime,plan.schedule.timezone)
                Text(if (LocalGenesisLanguage.current == "en")
                    "Duration: ${duration / 60} hr ${duration % 60} min"
                else "Длительность: ${duration / 60} ч ${duration % 60} мин")
                if(SleepTracker.hasAmbiguousLocalTime(date,bedtime,wakeTime,ZoneId.of(plan.schedule.timezone)))
                    Text("В этот день часы переводятся: время неоднозначно или отсутствует. Используется совместимый с сайтом расчёт; проверьте запись.",color=MaterialTheme.colorScheme.error)
            } else Text("Укажите оба времени для расчёта длительности.")
            if(plan.qualityEnabled) {
                Text(quality?.let { "Качество: $it из 10" } ?: "Качество не выбрано")
                (1..10).chunked(5).forEach { row -> Row { row.forEach { number ->
                    FilterChip(quality==number,{quality=number},enabled=!busy,label={Text(number.toString())})
                } } }
                if(quality!=null)TextButton(onClick={quality=null},enabled=!busy) { Text("Не оценивать качество") }
            }
            OutlinedTextField(note,{note=it},label={Text("Заметка")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row {
                TextButton(onClick=onDismiss,enabled=!busy) { Text("Отмена") }
                Button(enabled=!busy&&(bedtime!=null||wakeTime!=null||quality!=null||note.isNotBlank()),
                    onClick={onSave(bedtime,wakeTime,quality?.toDouble(),note)}) { Text("Сохранить запись") }
            }
        }
    } }
}

@Composable
private fun MoodObservationEditor(entries: List<MoodEntry>,initialDate: LocalDate,mode: CalendarMode,
    language: String,emojiCategories: List<FullEmojiCategory>,busy: Boolean,error: String?,
    onDismiss: () -> Unit,onSave: (LocalDate,Int,String,String,String) -> Unit) {
    var dateValue by rememberSaveable(initialDate.toString()) { mutableStateOf(initialDate.toString()) }
    val date=LocalDate.parse(dateValue)
    val entry=entries.firstOrNull { it.date==date }
    var selected by rememberSaveable(dateValue) { mutableStateOf(entry?.moodValue) }
    var note by rememberSaveable(dateValue) { mutableStateOf(entry?.note ?: "") }
    var custom by rememberSaveable(dateValue) { mutableStateOf(entry?.customLabel?.isNotBlank() == true) }
    var customLabel by rememberSaveable(dateValue) { mutableStateOf(entry?.customLabel ?: "") }
    var customEmoji by rememberSaveable(dateValue) { mutableStateOf(entry?.customEmoji ?: "") }
    var emojiCategory by rememberSaveable(dateValue) { mutableStateOf("smileys-emotion") }
    var visibleEmojiCount by rememberSaveable(dateValue) { mutableIntStateOf(120) }
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Text("Настроение дня",Modifier.weight(1f),style=MaterialTheme.typography.titleLarge)
                AffairsIconButton("Закрыть", AffairsAction.CLOSE, onDismiss,
                    Modifier.testTag("mood-editor-close"), enabled = !busy)
            }
            Text("Дата настроения",style=MaterialTheme.typography.labelLarge)
            AuthorDatePicker(dateValue,mode) { if(!busy) dateValue=it }
            TextButton(onClick={dateValue=LocalDate.now().toString()},enabled=!busy) { Text("Сегодня") }
            MoodCatalog.options.forEach { option -> FilterChip(!custom&&selected==option.value,{
                selected=option.value;custom=false
            },enabled=!busy,
                label={Text("${moodEmoji(option.value)} ${moodOptionLabel(option.value)}")},modifier=Modifier.fillMaxWidth()) }
            FilterChip(custom,onClick={custom=true;if(selected==null)selected=0},enabled=!busy,
                label={Text("✨ Своё настроение")},modifier=Modifier.fillMaxWidth().testTag("custom-mood-choice"))
            if(custom) {
                OutlinedTextField(customLabel,{if(it.length<=40)customLabel=it},label={Text("Название настроения")},
                    enabled=!busy,modifier=Modifier.fillMaxWidth().testTag("custom-mood-label"))
                Text(if(language=="en") "Choose an emoji" else "Выберите эмодзи",
                    style=MaterialTheme.typography.titleSmall)
                Text(customEmoji.ifBlank { "✨" },style=MaterialTheme.typography.headlineMedium,
                    modifier=Modifier.testTag("custom-mood-emoji"))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    emojiCategories.forEach { category ->
                        FilterChip(emojiCategory==category.id,onClick={emojiCategory=category.id;visibleEmojiCount=120},enabled=!busy,
                            label={Text(if(language=="en") category.labelEn else category.label)})
                    }
                }
                emojiCategories.firstOrNull { it.id==emojiCategory }?.let { category ->
                    FlowRow(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(4.dp),
                        verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        category.emojis.take(visibleEmojiCount).forEach { emoji ->
                            FilterChip(customEmoji==emoji,onClick={customEmoji=emoji},enabled=!busy,
                                label={Text(emoji)},modifier=Modifier.testTag("mood-emoji-$emoji"))
                        }
                    }
                    if(visibleEmojiCount<category.emojis.size) TextButton(
                        onClick={visibleEmojiCount+=120},enabled=!busy,
                        modifier=Modifier.testTag("mood-emoji-more")) {
                        Text(if(language=="en") "Show more emoji" else "Показать ещё эмодзи")
                    }
                }
                Text("Для аналитики используется выбранная оценка настроения; по умолчанию — нейтральная.",
                    style=MaterialTheme.typography.bodySmall)
                entries.filter { it.customLabel.isNotBlank() && it.customEmoji.isNotBlank() }
                    .distinctBy { it.customLabel to it.customEmoji }.takeLast(6).forEach { saved ->
                        TextButton(onClick={customLabel=saved.customLabel;customEmoji=saved.customEmoji;selected=saved.moodValue},
                            enabled=!busy) { Text("${saved.customEmoji} ${saved.customLabel}") }
                    }
            }
            OutlinedTextField(note,{if(it.length<=200)note=it},label={Text("Заметка и контекст")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            Text("Не влияет на баллы. Без выбора запись не создаётся.",style=MaterialTheme.typography.bodySmall)
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row {
                TextButton(onClick=onDismiss,enabled=!busy) { Text("Отмена") }
                Button(enabled=!busy&&selected!=null&&(!custom||(customLabel.isNotBlank()&&customEmoji.isNotBlank())),
                    onClick={selected?.let { onSave(date,it,note,if(custom)customLabel else "",if(custom)customEmoji else "") }}) {
                    Text("Сохранить")
                }
            }
        }
    } }
}
