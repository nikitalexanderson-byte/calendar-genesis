package ru.genesis.calendar.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.time.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*

@Composable
fun HabitsScreen(app: GenesisApplication, experimental: Boolean) {
    var section by rememberSaveable { mutableStateOf("Привычки") }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Привычки", "Сон и настроение").forEach { title ->
                FilterChip(selected = section == title, onClick = { section = title }, label = { Text(title) })
            }
        }
        Box(Modifier.weight(1f)) {
            if (section == "Привычки") HabitWorkspaceContent(app, experimental) else TrackersScreen(app)
        }
    }
}

@Composable
private fun HabitWorkspaceContent(app: GenesisApplication, experimental: Boolean) {
    val repository=remember(app) { HabitsRepository(app) }
    val scope=rememberCoroutineScope()
    var workspace by remember { mutableStateOf<LocalHabitWorkspace?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var storageError by remember { mutableStateOf(false) }
    var edit by remember { mutableStateOf<Habit?>(null) }
    var editorOpen by remember { mutableStateOf(false) }
    var catalogueOpen by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var today by remember { mutableStateOf(LocalDate.now()) }
    val engine=HabitEngine(GenesisCalendar())
    suspend fun runAction(action: suspend () -> Unit) {
        busy=true
        try { action(); error=null }
        catch(e: CancellationException) { throw e }
        catch(e: IllegalArgumentException) { error=e.message ?: "Проверьте введённые данные." }
        catch(_: Exception) { error="Не удалось сохранить привычки. Данные формы сохранены на экране." }
        finally { busy=false }
    }
    LaunchedEffect(repository) {
        try { repository.workspace.collect { workspace=it; storageError=false } }
        catch(e: CancellationException) { throw e }
        catch(_: Exception) { storageError=true; error="Защищённые привычки недоступны. Новые записи не заменят сохранённые данные." }
    }
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle,repository) {
        val observer=LifecycleEventObserver { _,event -> if(event==Lifecycle.Event.ON_RESUME) {
            today=LocalDate.now(); scope.launch { runAction { repository.refresh() } }
        } }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(repository) { runAction { repository.refresh() } }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Привычки",style=MaterialTheme.typography.headlineMedium)
        Text("Сохранено на этом устройстве · с аккаунтом сайта пока не синхронизируется.",style=MaterialTheme.typography.bodySmall)
        Text("Внутренняя сборка: доступны отметки, XP и базовые Лавры. Испытания, достижения, защита серии и напоминания привычек ещё не подключены.",style=MaterialTheme.typography.bodySmall)
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        val current=workspace
        if(current==null) {
            if(!storageError) CircularProgressIndicator()
        } else {
            val rank=HeroProgress.rankForProgress(current.progress)
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                OriginalImage("habit-ranks/heroic-ranks.webp", "Путь героических рангов",
                    Modifier.fillMaxWidth().height(82.dp))
                Text("${current.progress.lifetimeXp} XP · ${current.progress.laurelsBalance} Лавров",style=MaterialTheme.typography.titleLarge)
                Text(rank.title)
                Text("Серия: ${current.progress.currentStreak} · Ритм: ${current.progress.rhythmScore}%")
                current.goals.firstOrNull { it.date==today }?.let { Text("Сегодня: ${it.completedCount}/${it.scheduledCount} · цель ${it.targetCount}") }
            } }
            if (experimental) HabitArtGallery(current)
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Button(enabled=!busy&&!storageError,onClick={edit=null;editorOpen=true}) { Text("Новая привычка") }
                OutlinedButton(enabled=!busy&&!storageError,onClick={catalogueOpen=!catalogueOpen}) { Text("Библиотека") }
            }
            if(catalogueOpen) HabitTemplateCatalog.templates.forEach { template ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
                    Text("${template.icon} ${template.title}",style=MaterialTheme.typography.titleMedium)
                    Text(template.description)
                    TextButton(enabled=!busy&&!storageError,onClick={
                        val schedule=engine.defaultSchedule(today,CalendarMode.SACRED)
                        edit=Habit(TrackerEntity.create("habit"),template.title,today,
                            schedule.copy(recurrence=schedule.recurrence.copy(days=listOf(1,2,3,4,5))),description=template.description,
                            emoji=template.icon,color=template.color,sourceTemplateId=template.id,preferredTime=template.suggestedTime,
                            ritualId=when(template.suggestedTime.take(2).toIntOrNull() ?: -1) { in 0..11 -> "morning"; in 18..23 -> "evening"; else -> "day" },
                            reminder=HabitReminder(time=template.suggestedTime))
                        editorOpen=true; catalogueOpen=false
                    }) { Text("Добавить из библиотеки") }
                } }
            }
            if(current.habits.isEmpty()) Text("Добавьте привычку или выберите оригинальный шаблон из библиотеки.")
            current.habits.sortedByDescending { it.priority }.forEach { habit ->
                val entry=current.completions.firstOrNull { it.habitId==habit.id && it.date==today }
                val scheduled=runCatching { engine.isScheduled(habit,today) }.getOrDefault(false)
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text("${habit.emoji} ${habit.title}",style=MaterialTheme.typography.titleMedium)
                    if(habit.description.isNotEmpty()) Text(habit.description)
                    Text(if(!habit.active) "На паузе" else if(scheduled) "Запланировано сегодня" else "Сегодня не запланировано",style=MaterialTheme.typography.bodySmall)
                    if(habit.scoringMode.startsWith("quality") && scheduled) {
                        var quality by remember(habit.id,entry?.qualityValue) { mutableFloatStateOf((entry?.qualityValue ?: if(habit.scoringMode=="quality-ten") 5.0 else 0.0).toFloat()) }
                        Text("Качество: ${quality.toInt()}")
                        Slider(value=quality,onValueChange={quality=it},enabled=!busy&&!storageError,valueRange=if(habit.scoringMode=="quality-ten") 1f..10f else -5f..5f,
                            steps=if(habit.scoringMode=="quality-ten") 8 else 9)
                        Button(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.complete(habit.id,true,quality.toDouble()) } }}) { Text(if(entry?.completed==true) "Обновить оценку" else "Выполнено") }
                        if(entry?.completed==true) TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.complete(habit.id,false,entry.qualityValue) } }}) { Text("Снять отметку") }
                    } else Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Checkbox(checked=entry?.completed==true,enabled=scheduled&&!busy&&!storageError,
                            onCheckedChange={ checked -> scope.launch { runAction { repository.complete(habit.id,checked) } } })
                        Text(if(entry?.completed==true) "Выполнено · ${entry.score} баллов" else "Отметить выполнение",Modifier.padding(top=12.dp))
                    }
                    Row {
                        TextButton(enabled=!busy&&!storageError,onClick={edit=habit;editorOpen=true}) { Text("Изменить") }
                        TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } }}) { Text(if(habit.active) "Пауза" else "Продолжить") }
                    }
                } }
            }
            if(current.completions.isNotEmpty()) {
                Text("История отметок",style=MaterialTheme.typography.titleMedium)
                current.completions.sortedByDescending { it.date }.take(30).forEach { c ->
                    val title=current.habits.firstOrNull { it.id==c.habitId }?.title ?: "Привычка"
                    Text("${c.date} · $title · ${if(c.completed) "выполнено" else "отметка снята"} · XP ${c.xpAwarded}",style=MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
    if(editorOpen) HabitEditor(edit,busy,error,onDismiss={if(!busy) editorOpen=false},onSave={ habit ->
        scope.launch { runAction { repository.save(habit); editorOpen=false } }
    })
}

@Composable
private fun HabitEditor(existing: Habit?, busy: Boolean, error: String?, onDismiss: () -> Unit, onSave: (Habit) -> Unit) {
    val engine=remember { HabitEngine(GenesisCalendar()) }
    val initial=remember(existing) { existing ?: Habit(TrackerEntity.create("habit"),"",LocalDate.now(),engine.defaultSchedule(LocalDate.now(),CalendarMode.SACRED)) }
    var title by rememberSaveable(initial.id) { mutableStateOf(initial.title) }
    var description by rememberSaveable(initial.id) { mutableStateOf(initial.description) }
    var priority by rememberSaveable(initial.id) { mutableIntStateOf(initial.priority) }
    var scoring by rememberSaveable(initial.id) { mutableStateOf(initial.scoringMode) }
    var start by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.startDate.toString()) }
    var end by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.endDate?.toString() ?: "") }
    var config by remember(initial.id) { mutableStateOf(initial.schedule.recurrence) }
    val mode=when(config.mode) { "classic"->CalendarMode.PROFANE;"lunar"->CalendarMode.LUNAR;else->CalendarMode.SACRED }
    Dialog(onDismissRequest=onDismiss) { Surface(shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(if(existing==null) "Новая привычка" else "Изменить привычку",style=MaterialTheme.typography.titleLarge)
            OutlinedTextField(title,{title=it},label={Text("Название")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            OutlinedTextField(description,{description=it},label={Text("Описание")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            PriorityControl(priority) { if(!busy) priority=it }
            Text("Календарь расписания")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf(CalendarMode.SACRED to "Сакральный",CalendarMode.PROFANE to "Григорианский",CalendarMode.LUNAR to "Лунный").forEach { (option,label) ->
                    FilterChip(selected=mode==option,enabled=!busy,onClick={config=engine.defaultSchedule(LocalDate.parse(start),option).recurrence},label={Text(label)})
                }
            }
            Text("Начало"); AuthorDatePicker(start,mode) { if(!busy) start=it }
            Row { Checkbox(checked=end.isNotEmpty(),enabled=!busy,onCheckedChange={end=if(it) start else ""}); Text("Ограничить срок",Modifier.padding(top=12.dp)) }
            if(end.isNotEmpty()) AuthorDatePicker(end,mode) { if(!busy) end=it }
            if(mode==CalendarMode.PROFANE) Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf("daily" to "Ежедневно","weekdays" to "Дни недели","monthly" to "Ежемесячно","yearly" to "Ежегодно").forEach { (pattern,label) ->
                    FilterChip(config.pattern==pattern,{config=config.copy(pattern=pattern)},enabled=!busy,label={Text(label)})
                }
            }
            val limit=when { mode==CalendarMode.SACRED -> if(config.pattern=="month-days") 30 else 5; mode==CalendarMode.LUNAR -> 30;config.pattern=="weekdays" -> 7;else -> 0 }
            if(mode==CalendarMode.SACRED) Row {
                FilterChip(config.pattern=="pyata-days",{config=config.copy(pattern="pyata-days",days=listOf(1))},enabled=!busy,label={Text("Дни пяты")})
                FilterChip(config.pattern=="month-days",{config=config.copy(pattern="month-days",days=listOf(1))},enabled=!busy,label={Text("Дни месяца")})
            }
            if(limit>0) {
                Text("Дни расписания")
                (1..limit).chunked(5).forEach { row -> Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) { row.forEach { day ->
                    FilterChip(day in config.days,{config=config.copy(days=if(day in config.days) config.days.filterNot { it==day } else config.days+day)},enabled=!busy,
                        label={Text(if(mode==CalendarMode.SACRED&&config.pattern=="pyata-days") listOf("I","II","III","IIII","V")[day-1] else day.toString())})
                } } }
            }
            Text("Начисление XP")
            listOf("none" to "Без баллов","binary" to "Выполнение · 10","quality-ten" to "Качество · 1–10","quality-bipolar" to "Качество · −5…+5").forEach { (value,label) ->
                FilterChip(scoring==value,{scoring=value},enabled=!busy,label={Text(label)})
            }
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                TextButton(enabled=!busy,onClick=onDismiss) { Text("Отмена") }
                Button(enabled=!busy&&title.isNotBlank()&&(limit==0||config.days.isNotEmpty())&&(end.isEmpty()||end>=start),onClick={
                    onSave(initial.copy(title=title.trim(),description=description,priority=priority,scoringMode=scoring,
                        qualityScale=when(scoring){"quality-ten"->"ten";"quality-bipolar"->"bipolar";else->"none"},
                        schedule=initial.schedule.copy(startDate=LocalDate.parse(start),endDate=end.takeIf(String::isNotEmpty)?.let(LocalDate::parse),recurrence=config)))
                }) { Text(if(busy) "Сохранение…" else "Сохранить") }
            }
        }
    } }
}
