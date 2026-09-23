package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*
import ru.genesis.calendar.domain.trackers.*

@Composable
fun TrackersScreen(app: GenesisApplication) {
    val repository=remember(app) { TrackersRepository(app) }
    val preferences=remember(app) { LocalPreferences(app,app.workspaceScope) }
    val prefs by preferences.values.collectAsStateWithLifecycle(initialValue=UiPreferences())
    val scope=rememberCoroutineScope()
    var workspace by remember { mutableStateOf<LocalTrackersWorkspace?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var storageError by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var dateValue by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var planEditor by remember { mutableStateOf<SleepPlan?>(null) }
    var sleepEditor by remember { mutableStateOf<Pair<SleepPlan,SleepEntry?>?>(null) }
    var moodEditor by remember { mutableStateOf(false) }
    val date=LocalDate.parse(dateValue)
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
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Сон и настроение",style=MaterialTheme.typography.headlineMedium)
        Text("Локальные записи на этом устройстве. Синхронизация с аккаунтом сайта пока не подключена.",style=MaterialTheme.typography.bodySmall)
        AuthorDatePicker(dateValue,prefs.input) { if(!busy)dateValue=it }
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        val current=workspace
        if(current==null) { if(!storageError)CircularProgressIndicator() }
        else {
            val mood=current.moodEntries.firstOrNull { it.date==date }
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text("Настроение дня",style=MaterialTheme.typography.titleLarge)
                if(mood==null) Text("Не выбрано") else {
                    val option=MoodTracker.option(mood.moodValue.toDouble())
                    Text("${option.symbol} ${option.label}",color=Color(android.graphics.Color.parseColor(option.color)))
                    if(mood.note.isNotEmpty())Text(mood.note)
                }
                Text("Настроение используется для аналитики и не влияет на баллы.",style=MaterialTheme.typography.bodySmall)
                OutlinedButton(enabled=!busy&&!storageError,onClick={moodEditor=true}) { Text(if(mood==null)"Выбрать настроение" else "Изменить настроение") }
            } }
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                Text("Сон",style=MaterialTheme.typography.titleLarge)
                TextButton(enabled=!busy&&!storageError,onClick={
                    val schedule=HabitEngine(GenesisCalendar()).defaultSchedule(date,prefs.input)
                    planEditor=SleepPlan(TrackerEntity.create("sleep-plan"),schedule)
                }) { Text("Добавить план") }
            }
            if(current.sleepPlans.isEmpty())Text("Пока нет плана сна. Создайте план, затем добавьте время засыпания и пробуждения.")
            current.sleepPlans.forEach { plan ->
                val entry=current.sleepEntries.firstOrNull { it.planId==plan.id&&it.date==date }
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text(plan.title,style=MaterialTheme.typography.titleMedium)
                    Text("План: ${timeLabel(plan.targetBedtime.toString(),prefs.use24)} → ${timeLabel(plan.targetWakeTime.toString(),prefs.use24)} · ${plan.schedule.timezone}",style=MaterialTheme.typography.bodySmall)
                    if(!plan.active)Text("На паузе")
                    if(entry==null)Text("Нет записи на выбранную дату") else {
                        Text("Засыпание: ${entry.fellAsleepAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "не указано"}")
                        Text("Пробуждение: ${entry.wokeAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "не указано"}")
                        Text(entry.durationMinutes?.let { "Длительность: ${it/60} ч ${it%60} мин" } ?: "Длительность пока не рассчитана")
                        Text(entry.quality?.let { "Качество: $it из 10" } ?: "Качество не оценено")
                        entry.deviationMinutes?.let { Text("Среднее отклонение от плана: $it мин",style=MaterialTheme.typography.bodySmall) }
                        if(entry.note.isNotEmpty())Text(entry.note)
                    }
                    Row {
                        TextButton(enabled=plan.active&&!busy&&!storageError,onClick={sleepEditor=plan to entry}) { Text(if(entry==null)"Добавить запись" else "Изменить запись") }
                        TextButton(enabled=!busy&&!storageError,onClick={planEditor=plan}) { Text("План") }
                    }
                } }
            }
            Text("Сон и настроение — отдельные записи, без начисления XP или Лавров. Расчёты сна сохраняют правила сайта; это не медицинская оценка.",style=MaterialTheme.typography.bodySmall)
            if(current.sleepEntries.isNotEmpty()||current.moodEntries.isNotEmpty()) {
                Text("История",style=MaterialTheme.typography.titleMedium)
                (current.sleepEntries.map { it.date }+current.moodEntries.map { it.date }).distinct().sortedDescending().take(90).forEach { historyDate ->
                    TextButton(onClick={dateValue=historyDate.toString()},enabled=!busy) {
                        Text("$historyDate · сон: ${current.sleepEntries.count { it.date==historyDate }} · настроение: ${if(current.moodEntries.any { it.date==historyDate })"записано" else "нет записи"}")
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
        MoodObservationEditor(existing,date,busy,error,onDismiss={if(!busy)moodEditor=false}) { value,note ->
            scope.launch { action { repository.saveMood(date,value,note,existing?.tags ?: emptyList(),existing?.entity?.version ?: 0);moodEditor=false } }
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
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text("План сна",style=MaterialTheme.typography.titleLarge)
            OutlinedTextField(title,{title=it},label={Text("Название")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            Text("Планируемое засыпание");AuthorTimePicker(bed,use24) { if(!busy)bed=it }
            Text("Планируемое пробуждение");AuthorTimePicker(wake,use24) { if(!busy)wake=it }
            OutlinedTextField(zone,{zone=it},label={Text("Часовой пояс · Europe/Moscow")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            Row { Checkbox(active,{active=it},enabled=!busy);Text("План активен",Modifier.padding(top=12.dp)) }
            Row { Checkbox(qualityEnabled,{qualityEnabled=it},enabled=!busy);Text("Оценивать качество",Modifier.padding(top=12.dp)) }
            Text("Уведомления и редактор правил баллов для сна пока не подключены.",style=MaterialTheme.typography.bodySmall)
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row {
                TextButton(onClick=onDismiss,enabled=!busy) { Text("Отмена") }
                Button(enabled=!busy&&title.isNotBlank()&&bed.isNotBlank()&&wake.isNotBlank()&&runCatching { ZoneId.of(zone) }.isSuccess,onClick={
                    onSave(plan.copy(title=title.trim(),targetBedtime=LocalTime.parse(bed),targetWakeTime=LocalTime.parse(wake),
                        schedule=plan.schedule.copy(timezone=zone),active=active,qualityEnabled=qualityEnabled))
                }) { Text("Сохранить план") }
            }
        }
    } }
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
                Text("Длительность: ${duration/60} ч ${duration%60} мин")
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
private fun MoodObservationEditor(entry: MoodEntry?,date: LocalDate,busy: Boolean,error: String?,onDismiss: () -> Unit,onSave: (Int,String) -> Unit) {
    var selected by rememberSaveable(date.toString()) { mutableStateOf(entry?.moodValue) }
    var note by rememberSaveable(date.toString()) { mutableStateOf(entry?.note ?: "") }
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text("Настроение · $date",style=MaterialTheme.typography.titleLarge)
            MoodCatalog.options.forEach { option -> FilterChip(selected==option.value,{selected=option.value},enabled=!busy,
                label={Text("${option.symbol} ${option.label} · ${if(option.value>0)"+" else ""}${option.value}")},modifier=Modifier.fillMaxWidth()) }
            OutlinedTextField(note,{if(it.length<=200)note=it},label={Text("Заметка и контекст")},enabled=!busy,modifier=Modifier.fillMaxWidth())
            Text("Не влияет на баллы. Без выбора запись не создаётся.",style=MaterialTheme.typography.bodySmall)
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row {
                TextButton(onClick=onDismiss,enabled=!busy) { Text("Отмена") }
                Button(enabled=!busy&&selected!=null,onClick={selected?.let { onSave(it,note) }}) { Text("Сохранить") }
            }
        }
    } }
}
