package ru.genesis.calendar.ui

import android.Manifest
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.genesis.calendar.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import java.time.*
import java.time.format.DateTimeFormatter

private val standart = lightColorScheme(primary=Color(0xff255b59),onPrimary=Color(0xfffffdf8),
    background=Color(0xffe1d9c8),onBackground=Color(0xff132426),surface=Color(0xfff8f5ed),
    onSurface=Color(0xff132426),onSurfaceVariant=Color(0xff526263),
    secondary=Color(0xffb28a4a),onSecondary=Color(0xff132426),secondaryContainer=Color(0xffd8bd80),
    onSecondaryContainer=Color(0xff132426),primaryContainer=Color(0xffcddfda),onPrimaryContainer=Color(0xff132426),
    surfaceVariant=Color(0xffe9e1d0),surfaceContainer=Color(0xfff8f5ed),surfaceContainerLow=Color(0xfff8f5ed),
    surfaceContainerLowest=Color(0xfffffdf8),surfaceContainerHigh=Color(0xffefe8d9),surfaceContainerHighest=Color(0xffe9e1d0),
    outline=Color(0xff9c927e),outlineVariant=Color(0xffd5cab4))
private val experimental = standart.copy(primary=Color(0xff245d59),background=Color(0xfff3efe6),
    onBackground=Color(0xff182c2d),surface=Color(0xfffffcf6),onSurface=Color(0xff182c2d),
    onSurfaceVariant=Color(0xff586966),secondary=Color(0xff795b2b),secondaryContainer=Color(0xfff3e8cc),
    primaryContainer=Color(0xffe4eeea),surfaceVariant=Color(0xffece7dc),
    surfaceContainer=Color(0xfffffcf6),surfaceContainerLow=Color(0xfffffcf6),
    surfaceContainerHighest=Color(0xffece7dc),outline=Color(0xff819089),outlineVariant=Color(0xffd9d7cc),
    error=Color(0xffa13f35),errorContainer=Color(0xfff6e8e3))

@Composable
fun GenesisApp(app: GenesisApplication, openedTask: String?) {
    val model: GenesisViewModel = viewModel()
    val tasks by model.tasks.collectAsStateWithLifecycle()
    val error by model.error.collectAsStateWithLifecycle()
    val structureRepo = remember(app) { WorkspaceStructureRepository(app) }
    val structure by structureRepo.workspace.collectAsStateWithLifecycle(WorkspaceStructure())
    val prefsStore=remember { LocalPreferences(app,app.workspaceScope) }
    val prefs by prefsStore.values.collectAsStateWithLifecycle(UiPreferences())
    val scope=rememberCoroutineScope()
    var tab by rememberSaveable { mutableStateOf("Сегодня") }
    var editId by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var newTaskProjectId by rememberSaveable { mutableStateOf<String?>(null) }
    var selected by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    LaunchedEffect(openedTask) { if(openedTask!=null) { editId=openedTask; creating=false; tab="Задачи" } }
    MaterialTheme(colorScheme=if(prefs.theme=="Experimental") experimental else standart) {
        Surface(Modifier.fillMaxSize().testTag("app-theme-${prefs.theme}"),color=MaterialTheme.colorScheme.background) {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(12.dp),verticalAlignment=Alignment.CenterVertically) {
                    OriginalImage("icons/icon-192.png","GENESIS",Modifier.size(40.dp))
                    Text("GENESIS",Modifier.padding(start=10.dp).weight(1f),style=MaterialTheme.typography.titleLarge)
                    Text(if(BuildConfig.DEBUG) "Internal alpha" else "2.0",style=MaterialTheme.typography.labelSmall)
                }
                Text(if(BuildConfig.DEBUG) "Изолированное тестовое пространство · только на этом устройстве"
                    else "Локальные черновики · аккаунт не подключён",Modifier.padding(horizontal=16.dp),
                    style=MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal=8.dp)) {
                    listOf("Сегодня","Задачи","Проекты","Календарь","Привычки","Трекеры","Настройки").forEach {
                        FilterChip(selected=tab==it,onClick={tab=it},label={Text(it)},modifier=Modifier.padding(3.dp))
                    }
                }
                error?.let { Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(12.dp)) }
                when(tab) {
                    "Привычки" -> HabitsScreen(app)
                    "Трекеры" -> TrackersScreen(app)
                    "Проекты" -> ProjectsScreen(app,tasks,prefs.theme=="Experimental",
                        onOpenTask={ taskId -> editId=taskId;creating=false;tab="Задачи" },
                        onCreateTask={ projectId -> newTaskProjectId=projectId;editId=null;creating=true })
                    "Настройки" -> SettingsScreen(app,prefs) { name,value -> scope.launch { prefsStore.set(name,value) } }
                    "Календарь" -> CalendarScreen(LocalDate.parse(selected),prefs.display,
                        onSelect={selected=it.toString();tab="Сегодня"})
                    else -> LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(16.dp),
                        verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        if(tab=="Сегодня") item { DayHeader(LocalDate.parse(selected),prefs.display) }
                        item {
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) {
                                Text(if(tab=="Сегодня") "Задачи дня" else "Все задачи",style=MaterialTheme.typography.titleLarge)
                                Button(onClick={creating=true;editId=null;newTaskProjectId=null},modifier=Modifier.testTag("create-task")) { Text("Создать") }
                            }
                        }
                        val shown=tasks.filter { tab!="Сегодня" || it.date==selected }
                        if(shown.isEmpty()) item { Text("Задач пока нет. Создайте первую запись.") }
                        items(shown,key={it.id}) { task ->
                            Card(Modifier.fillMaxWidth().testTag("task-${task.id}")) {
                                Row(Modifier.padding(8.dp),verticalAlignment=Alignment.CenterVertically) {
                                    Checkbox(checked=task.done,onCheckedChange={model.complete(task)})
                                    Column(Modifier.weight(1f).clickable { editId=task.id;creating=false }.padding(8.dp)) {
                                        Text(task.title,style=MaterialTheme.typography.titleMedium)
                                        Text("${task.date} ${timeLabel(task.time,prefs.use24)} · Приоритет ${task.priority}",style=MaterialTheme.typography.bodySmall)
                                        if(task.projectId!=null) Text(structure.projects.firstOrNull { it.id==task.projectId }?.title
                                            ?: task.project.ifBlank { "Проект" },style=MaterialTheme.typography.labelSmall)
                                        Text("Сохранено на устройстве",style=MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            val existing=tasks.find { it.id==editId }
            if(creating || existing!=null) TaskEditor(existing,selected,prefs,structure,newTaskProjectId,
                onDismiss={creating=false;editId=null},
                onSave={draft -> model.save(draft){creating=false;editId=null}},
                onDelete=existing?.let{{model.delete(it);creating=false;editId=null}})
        }
    }
}

@Composable
fun OriginalImage(path: String, description: String?, modifier: Modifier=Modifier) {
    val context=LocalContext.current
    val bitmap by produceState<android.graphics.Bitmap?>(null,path) {
        value=withContext(Dispatchers.IO) {
            runCatching { context.assets.open("originals/$path").use { BitmapFactory.decodeStream(it) } }.getOrNull()
        }
    }
    bitmap?.let { Image(it.asImageBitmap(),description,modifier,contentScale=ContentScale.Crop) }
}

@Composable
private fun DayHeader(date: LocalDate,mode: CalendarMode) {
    val calendar=remember { GenesisCalendar() }
    val sacred=calendar.sacredDate(date)
    val month=SacredCatalog.months[sacred.monthIndex]
    val day=month.days.first { it.day==sacred.day }
    val weekFiles=listOf("weekday-0-sunday-apollo.webp","weekday-1-monday-lunar-goddesses.webp",
        "weekday-2-tuesday-ares.webp","weekday-3-wednesday-hermes.webp","weekday-4-thursday-zeus-hera.webp",
        "weekday-5-friday-aphrodite-hestia-dionysus.webp","weekday-6-saturday-cronus.webp")
    Card(Modifier.fillMaxWidth()) {
        OriginalImage(if(mode==CalendarMode.PROFANE) "weekday-art/${weekFiles[date.dayOfWeek.value%7]}"
            else "day-art-v1/month-${(sacred.monthIndex+1).toString().padStart(2,'0')}/day-${sacred.day.toString().padStart(2,'0')}.webp",
            if(mode==CalendarMode.PROFANE) date.dayOfWeek.toString() else day.name,
            Modifier.fillMaxWidth().height(190.dp))
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(calendar.formatDate(date,mode),style=MaterialTheme.typography.titleLarge)
            Text(date.format(DateTimeFormatter.ofPattern("d MMMM yyyy",java.util.Locale.forLanguageTag("ru"))))
            if(mode==CalendarMode.SACRED) { Text(day.name,style=MaterialTheme.typography.titleMedium);Text(day.description) }
        }
    }
}

@Composable
private fun CalendarScreen(date: LocalDate,mode: CalendarMode,onSelect:(LocalDate)->Unit) {
    var shown by remember { mutableStateOf(date) }
    val calendar=remember{GenesisCalendar()}
    val range=calendar.monthRange(shown,mode)
    LazyColumn(contentPadding=PaddingValues(16.dp)) {
        item {
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                TextButton(onClick={shown=range.start.minusDays(1)}){Text("←")}
                Text(calendar.formatDate(shown,mode),Modifier.weight(1f).padding(top=12.dp))
                TextButton(onClick={shown=range.end.plusDays(1)}){Text("→")}
            }
        }
        items(range.dates()) { day ->
            TextButton(onClick={onSelect(day)},modifier=Modifier.fillMaxWidth()) {
                Text(calendar.formatDate(day,mode),Modifier.weight(1f))
                Text(day.toString(),style=MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun TaskEditor(task:LocalTask?,selected:String,prefs:UiPreferences,structure:WorkspaceStructure,initialProjectId:String?,onDismiss:()->Unit,
    onSave:(LocalTask)->Unit,onDelete:(()->Unit)?) {
    var title by rememberSaveable(task?.id) { mutableStateOf(task?.title ?: "") }
    var description by rememberSaveable(task?.id) { mutableStateOf(task?.description ?: "") }
    var date by rememberSaveable(task?.id) { mutableStateOf(task?.date ?: selected) }
    var time by rememberSaveable(task?.id) { mutableStateOf(task?.time ?: "") }
    var priority by rememberSaveable(task?.id) { mutableIntStateOf(task?.priority ?: 5) }
    var projectId by rememberSaveable(task?.id,initialProjectId) { mutableStateOf(task?.projectId ?: initialProjectId) }
    var remind by rememberSaveable(task?.id) { mutableStateOf(task?.reminderAt) }
    var confirmDelete by remember { mutableStateOf(false) }
    var validation by remember { mutableStateOf<String?>(null) }
    Dialog(onDismissRequest=onDismiss,properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.fillMaxWidth().padding(12.dp),shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState()),
                verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text(if(task==null) "Новая задача" else "Изменить задачу",style=MaterialTheme.typography.titleLarge)
                OutlinedTextField(title,{title=it},label={Text("Название")},modifier=Modifier.fillMaxWidth().testTag("task-title"))
                OutlinedTextField(description,{description=it},label={Text("Описание")},modifier=Modifier.fillMaxWidth())
                Text("Проект",style=MaterialTheme.typography.titleMedium)
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected=projectId==null || projectId=="__genesis_inbox__",
                        onClick={projectId=null},label={Text("Хаос-бокс")})
                    WorkspaceStructureCodec.ordered(structure).forEach { (project,depth) ->
                        FilterChip(selected=projectId==project.id,onClick={projectId=project.id},
                            label={Text("  ".repeat(depth)+project.title)})
                    }
                }
                Text("Дата задачи · ${prefs.input.wireValue}")
                AuthorDatePicker(date,prefs.input){date=it}
                AuthorTimePicker(time,prefs.use24){time=it}
                PriorityControl(priority){priority=it}
                Text("Напоминание",style=MaterialTheme.typography.titleMedium)
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    TextButton(onClick={remind=null}){Text("Нет")}
                    TextButton(onClick={remind=System.currentTimeMillis()+60_000}){Text("Через 1 мин")}
                    TextButton(onClick={remind=System.currentTimeMillis()+120_000}){Text("Через 2 мин")}
                    TextButton(onClick={
                        if(time.isBlank()) validation="Сначала выберите время."
                        else {
                            val local=LocalDateTime.of(LocalDate.parse(date),LocalTime.parse(time))
                            val zone=ZoneId.systemDefault()
                            val offsets=zone.rules.getValidOffsets(local)
                            if(offsets.size!=1) validation="Это время неоднозначно или отсутствует из-за перевода часов. Выберите другое."
                            else { remind=local.toInstant(offsets.first()).toEpochMilli();validation=null }
                        }
                    }){Text("Во время задачи")}
                }
                remind?.let { Text(Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"))) }
                validation?.let { Text(it,color=MaterialTheme.colorScheme.error) }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    TextButton(onClick=onDismiss){Text("Отмена")}
                    Button(enabled=title.isNotBlank(),onClick={
                        onSave((task ?: LocalTask(title=title)).copy(title=title.trim(),description=description,date=date,time=time,priority=priority,
                            reminderAt=remind,projectId=projectId,categoryId=structure.projects.firstOrNull{it.id==projectId}?.categoryId))
                    },modifier=Modifier.testTag("save-task")){Text("Сохранить")}
                }
                onDelete?.let { TextButton(onClick={confirmDelete=true}){Text("Удалить задачу")} }
            }
        }
    }
    if(confirmDelete) AlertDialog(onDismissRequest={confirmDelete=false},title={Text("Удалить задачу?")},
        text={Text("Напоминание этой задачи будет отменено.")},
        confirmButton={TextButton(onClick={onDelete?.invoke()}){Text("Удалить")}},
        dismissButton={TextButton(onClick={confirmDelete=false}){Text("Отмена")}})
}

@Composable
private fun SettingsScreen(app:GenesisApplication,prefs:UiPreferences,onSet:(String,String)->Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){refresh++}
    val scope=rememberCoroutineScope()
    val rows by produceState(emptyList<ReminderRecord>(),refresh) { value=withContext(Dispatchers.IO){app.database.dao().reminders(app.workspaceScope)} }
    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Настройки",style=MaterialTheme.typography.titleLarge)
        Text("Тема")
        Row { listOf("Standart","Experimental").forEach{FilterChip(selected=prefs.theme==it,onClick={onSet("theme",it)},label={Text(it)})} }
        listOf("display" to "Календарь отображения","input" to "Календарь ввода и повторений").forEach{(key,label)->
            Text(label)
            Row(Modifier.horizontalScroll(rememberScrollState())) { CalendarMode.entries.forEach { mode->
                FilterChip(selected=(if(key=="display") prefs.display else prefs.input)==mode,onClick={onSet(key,mode.wireValue)},
                    label={Text(when(mode){CalendarMode.SACRED->"Сакральный";CalendarMode.LUNAR->"Лунный";else->"Григорианский"})})
            } }
        }
        Row { listOf("24h","12h").forEach { FilterChip(selected=prefs.use24==(it=="24h"),onClick={onSet("time",it)},label={Text(it)})} }
        HorizontalDivider()
        Text("Системные напоминания",style=MaterialTheme.typography.titleMedium)
        Text("Уведомления: ${if(app.scheduler.notificationsAllowed()) "разрешены" else "выключены"}")
        Text("Канал задач: ${if(app.scheduler.channelAllowed()) "включён" else "выключен"}")
        Text("Время доставки: ${if(app.scheduler.exactAllowed()) "точное" else "приблизительное — Android может задержать"}")
        Button(onClick={
            if(Build.VERSION.SDK_INT>=33 && !app.scheduler.notificationsAllowed()) request.launch(Manifest.permission.POST_NOTIFICATIONS)
            else app.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,app.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }){Text("Разрешить уведомления")}
        if(Build.VERSION.SDK_INT>=31) OutlinedButton(onClick={
            app.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${app.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }){Text("Точное время напоминаний")}
        Text("На выключенном телефоне, после Force stop и при системном запрете уведомления недоступны. DND и отключённый звук сохраняются.")
        Text("После перезагрузки расписание восстанавливается после разблокировки. Просроченные сигналы не проигрываются повторно.")
        OutlinedButton(onClick={scope.launch{app.scheduler.restore();refresh++}}){Text("Проверить расписание")}
        rows.sortedBy{it.at}.takeLast(8).forEach{Text("Напоминание · ${it.state} · ${Instant.ofEpochMilli(it.at).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd.MM HH:mm"))}",style=MaterialTheme.typography.bodySmall)}
        HorizontalDivider()
        ru.genesis.calendar.auth.AuthPanel(app)
        Text("Версия ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",style=MaterialTheme.typography.labelSmall)
    }
}
