package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        GenesisPageHeader(if (LocalGenesisLanguage.current == "en") "Sleep & mood" else "Сон и настроение",
            if (LocalGenesisLanguage.current == "en") "Sleep, recovery and emotional rhythm without pressure"
            else "Сон, восстановление и эмоциональный ритм без давления", "☾")
        AuthorDatePicker(dateValue,prefs.input) { if(!busy)dateValue=it }
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        val current=workspace
        if(current==null) { if(!storageError)CircularProgressIndicator() }
        else {
            val mood=current.moodEntries.firstOrNull { it.date==date }
            val selectedSleepEntries = current.sleepEntries.filter { it.date == date }
            val averageMinutes = selectedSleepEntries.mapNotNull { it.durationMinutes }.takeIf { it.isNotEmpty() }
                ?.average()?.toInt()
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = Color(0xff0b2b2d),
                border = BorderStroke(1.dp, Color(0x88dfc17e)), shadowElevation = 8.dp) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Surface(Modifier.size(54.dp), shape = CircleShape, color = Color(0xffdfc17e)) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("☾", color = Color(0xff0b2b2d), style = MaterialTheme.typography.headlineSmall)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text("Ритм восстановления", color = Color(0xfffff5df),
                                style = MaterialTheme.typography.titleLarge)
                            Text(date.toString(), color = Color(0xffc8d9d4),
                                style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TrackerMetric("☾", "Сон", averageMinutes?.let { "${it/60} ч ${it%60} мин" } ?: "Нет записи",
                            Modifier.weight(1f))
                        TrackerMetric("♥", "Настроение", mood?.let {
                            MoodTracker.option(it.moodValue.toDouble()).label
                        } ?: "Не выбрано", Modifier.weight(1f))
                    }
                }
            }
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xfff4e7e0)),
                border = BorderStroke(1.dp, Color(0x778e5b62))) {
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        val moodColor = mood?.let { Color(android.graphics.Color.parseColor(
                            MoodTracker.option(it.moodValue.toDouble()).color)) } ?: Color(0xff8e5b62)
                        Surface(Modifier.size(48.dp), shape = CircleShape, color = moodColor.copy(alpha = .16f),
                            border = BorderStroke(1.dp, moodColor.copy(alpha = .55f))) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(mood?.let { MoodTracker.option(it.moodValue.toDouble()).symbol } ?: "♡",
                                    color = moodColor, style = MaterialTheme.typography.headlineSmall)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text("Настроение дня",style=MaterialTheme.typography.titleLarge,
                                color = Color(0xff553238))
                            if(mood==null) Text("Пока не выбрано", color = Color(0xff765b60)) else {
                                val option=MoodTracker.option(mood.moodValue.toDouble())
                                Text(option.label,color=Color(android.graphics.Color.parseColor(option.color)),
                                    style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                    if(mood?.note?.isNotEmpty()==true)Text(mood.note)
                    Text("Отметка помогает увидеть закономерности и не влияет на XP или Лавры.",
                        style=MaterialTheme.typography.bodySmall,color=Color(0xff6c5559))
                    Button(enabled=!busy&&!storageError,onClick={moodEditor=true},
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xff8e5b62))) {
                        Text(if(mood==null)"Выбрать настроение" else "Изменить настроение")
                    }
                }
            }
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Сон",style=MaterialTheme.typography.titleLarge)
                    Text("Планы и фактическое восстановление", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                FilledTonalButton(enabled=!busy&&!storageError,onClick={
                    val schedule=HabitEngine(GenesisCalendar()).defaultSchedule(date,prefs.input)
                    planEditor=SleepPlan(TrackerEntity.create("sleep-plan"),schedule)
                }) { Text("＋ План") }
            }
            if(current.sleepPlans.isEmpty()) Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp),
                color = Color(0xffe5efed), border = BorderStroke(1.dp, Color(0x66255b59))) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("☾", color = Color(0xff255b59), style = MaterialTheme.typography.headlineMedium)
                    Text("Пока нет плана сна. Создайте ориентир, затем отмечайте фактическое время.",
                        Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                }
            }
            AdaptiveCardGrid(current.sleepPlans, { it.id }) { plan ->
                val entry=current.sleepEntries.firstOrNull { it.planId==plan.id&&it.date==date }
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xffe4efed)),
                    border = BorderStroke(1.dp, Color(0x77255b59))) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Surface(Modifier.size(48.dp), shape = RoundedCornerShape(14.dp), color = Color(0xff255b59)) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("☾", color = Color(0xffffe4a6), style = MaterialTheme.typography.headlineSmall)
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text(plan.title,style=MaterialTheme.typography.titleMedium,color = Color(0xff123b36))
                            Text(if(plan.active) "Активный план" else "На паузе",
                                style = MaterialTheme.typography.labelMedium,
                                color = if(plan.active) Color(0xff255b59) else Color(0xff74685b))
                        }
                    }
                    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), color = Color(0xfff8f4e9)) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("◷ План · ${timeLabel(plan.targetBedtime.toString(),prefs.use24)} → ${timeLabel(plan.targetWakeTime.toString(),prefs.use24)}",
                                style=MaterialTheme.typography.titleSmall,color = Color(0xff314f4d))
                            Text(plan.schedule.timezone,style=MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if(entry==null)Text("Нет записи на выбранную дату", color = Color(0xff5c6d6a)) else {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TrackerLightMetric("Засыпание", entry.fellAsleepAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "—",
                                Modifier.weight(1f))
                            TrackerLightMetric("Пробуждение", entry.wokeAt?.let { timeLabel(it.toString(),prefs.use24) } ?: "—",
                                Modifier.weight(1f))
                        }
                        Text(entry.durationMinutes?.let { "☾ Длительность · ${it/60} ч ${it%60} мин" } ?: "Длительность пока не рассчитана",
                            style = MaterialTheme.typography.titleSmall, color = Color(0xff255b59))
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
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = Color(0xfffff3d8)) {
                Text("ⓘ Сон и настроение — личные наблюдения без XP и Лавров. Это не медицинская оценка.",
                    Modifier.padding(14.dp), style=MaterialTheme.typography.bodySmall,
                    color = Color(0xff5f4c28))
            }
            if(current.sleepEntries.isNotEmpty()||current.moodEntries.isNotEmpty()) {
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xfffffbf2)),
                    border = BorderStroke(1.dp, Color(0x55b28a4a))) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("История наблюдений",style=MaterialTheme.typography.titleMedium)
                    (current.sleepEntries.map { it.date }+current.moodEntries.map { it.date }).distinct().sortedDescending().take(90).forEach { historyDate ->
                        TextButton(onClick={dateValue=historyDate.toString()},enabled=!busy,
                            modifier = Modifier.fillMaxWidth()) {
                            Text("$historyDate · ☾ ${current.sleepEntries.count { it.date==historyDate }} · ♥ ${if(current.moodEntries.any { it.date==historyDate })"есть" else "—"}",
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
        MoodObservationEditor(existing,date,busy,error,onDismiss={if(!busy)moodEditor=false}) { value,note ->
            scope.launch { action { repository.saveMood(date,value,note,existing?.tags ?: emptyList(),existing?.entity?.version ?: 0);moodEditor=false } }
        }
    }
}

@Composable
private fun TrackerMetric(symbol: String, label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(14.dp), color = Color(0xff143b39)) {
        Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(symbol, color = Color(0xffdfc17e), style = MaterialTheme.typography.titleMedium)
            Text(label, color = Color(0xffb8ccc5), style = MaterialTheme.typography.labelSmall)
            Text(value, color = Color(0xfffff5df), style = MaterialTheme.typography.titleSmall,
                maxLines = 2)
        }
    }
}

@Composable
private fun TrackerLightMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(12.dp), color = Color(0xfff8f4e9)) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xff60706e))
            Text(value, style = MaterialTheme.typography.titleSmall, color = Color(0xff123b36))
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
