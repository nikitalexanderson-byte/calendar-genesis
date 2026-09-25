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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.*
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import java.time.*
import java.time.format.DateTimeFormatter

internal val standart = lightColorScheme(primary=Color(0xff255b59),onPrimary=Color(0xfffffdf8),
    background=Color(0xffe1d9c8),onBackground=Color(0xff132426),surface=Color(0xfff8f5ed),
    onSurface=Color(0xff132426),onSurfaceVariant=Color(0xff526263),
    secondary=Color(0xffb28a4a),onSecondary=Color(0xff132426),secondaryContainer=Color(0xffd8bd80),
    onSecondaryContainer=Color(0xff132426),primaryContainer=Color(0xffcddfda),onPrimaryContainer=Color(0xff132426),
    surfaceVariant=Color(0xffe9e1d0),surfaceContainer=Color(0xfff8f5ed),surfaceContainerLow=Color(0xfff8f5ed),
    surfaceContainerLowest=Color(0xfffffdf8),surfaceContainerHigh=Color(0xffefe8d9),surfaceContainerHighest=Color(0xffe9e1d0),
    outline=Color(0xff9c927e),outlineVariant=Color(0xffd5cab4))
@Composable
fun GenesisApp(app: GenesisApplication, openedTask: String?, testWorkspace: Boolean = false) {
    require(!testWorkspace || BuildConfig.DEBUG)
    val activeScope by app.scopeFlow.collectAsStateWithLifecycle()
    key(activeScope) { GenesisWorkspaceContent(app, openedTask, activeScope, testWorkspace) }
}

@OptIn(FlowPreview::class)
@Composable
private fun GenesisWorkspaceContent(app: GenesisApplication, openedTask: String?, activeScope: String,
    testWorkspace: Boolean) {
    val model: GenesisViewModel = viewModel(key = "genesis-$activeScope")
    val tasks by model.tasks.collectAsStateWithLifecycle()
    val error by model.error.collectAsStateWithLifecycle()
    val structureRepo = remember(app, activeScope) { WorkspaceStructureRepository(app) }
    val structure by structureRepo.workspace.collectAsStateWithLifecycle(WorkspaceStructure())
    val prefsStore=remember(app, activeScope) { LocalPreferences(app,activeScope) }
    val prefs by prefsStore.values.collectAsStateWithLifecycle(UiPreferences())
    val welcomePrefsStore=remember(app) { LocalPreferences(app,"welcome") }
    val welcomePrefs by welcomePrefsStore.values.collectAsStateWithLifecycle(UiPreferences())
    val authController = remember(app) { ru.genesis.calendar.auth.AuthController.get(app) }
    val authState by authController.state.collectAsStateWithLifecycle()
    val scope=rememberCoroutineScope()
    var preferredWelcomeLanguage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(authController, activeScope, testWorkspace) { if (!testWorkspace) authController.checkSession() }
    LaunchedEffect(activeScope, authState.user, authState.busy) {
        if (!testWorkspace && activeScope.startsWith("account-") && authState.user != null && !authState.busy) {
            app.database.dao().observeOutbox(activeScope).debounce(800).collectLatest { pending ->
                if (pending.isNotEmpty()) authController.syncPending()
            }
        }
    }
    LaunchedEffect(authState.accountSettings) {
        authState.accountSettings?.let { remote ->
            if (remote.calendarMode in setOf("sacred", "lunar", "profane")) prefsStore.set("display", remote.calendarMode)
            if (remote.taskCalendarMode in setOf("sacred", "lunar", "profane")) prefsStore.set("input", remote.taskCalendarMode)
            if (remote.timeFormat in setOf("12h", "24h")) prefsStore.set("time", remote.timeFormat)
            if (remote.language in setOf("ru", "en")) prefsStore.set("language", remote.language)
            prefsStore.set("stoicheionDivinationDisabled", remote.divinationDisabled.toString())
        }
    }
    var tab by rememberSaveable { mutableStateOf("Сегодня") }
    var editId by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var newTaskProjectId by rememberSaveable { mutableStateOf<String?>(null) }
    var requestedTheokyklosSector by rememberSaveable { mutableStateOf<String?>(null) }
    var selected by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    LaunchedEffect(openedTask) { if(openedTask!=null) { editId=openedTask; creating=false; tab="Задачи" } }
    MaterialTheme(colorScheme=standart) {
      CompositionLocalProvider(LocalGenesisLanguage provides
          (if(testWorkspace || activeScope.startsWith("account-")) prefs.language else welcomePrefs.language)) {
        Surface(Modifier.fillMaxSize().testTag("app-theme-Standart"),color=MaterialTheme.colorScheme.background) {
            if (!testWorkspace && (!activeScope.startsWith("account-") || authState.user == null || !authState.ready)) {
                WelcomeScreen(authState,authController,welcomePrefs.language,preferredWelcomeLanguage) { language ->
                    preferredWelcomeLanguage = language
                    scope.launch { welcomePrefsStore.set("language",language) }
                }
            } else {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(12.dp),verticalAlignment=Alignment.CenterVertically) {
                    OriginalImage("icons/icon-192.png","GENESIS",Modifier.size(40.dp))
                    Text("GENESIS",Modifier.padding(start=10.dp).weight(1f),style=MaterialTheme.typography.titleLarge)
                    Text(if(BuildConfig.DEBUG) "Internal alpha" else BuildConfig.VERSION_NAME,
                        style=MaterialTheme.typography.labelSmall)
                }
                Text(if (activeScope.startsWith("account-")) "Аккаунт GENESIS · защищённая локальная копия"
                    else if(BuildConfig.DEBUG) "Изолированное тестовое пространство · только на этом устройстве"
                    else "Локальные черновики · аккаунт не подключён",Modifier.padding(horizontal=16.dp),
                    style=MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal=8.dp)) {
                    listOf("Сегодня","Задачи","Проекты","Календарь","Привычки","Стойхейон","Теокиклос","Настройки").forEach {
                        FilterChip(selected=tab==it,onClick={tab=it},label={Text(it)},modifier=Modifier.padding(3.dp))
                    }
                }
                error?.let { Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(12.dp)) }
                when(tab) {
                    "Привычки" -> HabitsScreen(app,true)
                    "Теокиклос" -> TheokyklosScreen(app,prefs.input,onOpenHabits={tab="Привычки"},
                        initialSectorId=requestedTheokyklosSector,
                        onInitialSectorConsumed={requestedTheokyklosSector=null})
                    "Стойхейон" -> StoicheionScreen(app,prefs.divinationDisabled, onOpenTheokyklosSector={ sectorId ->
                        requestedTheokyklosSector=sectorId; tab="Теокиклос"
                    })
                    "Проекты" -> ProjectsScreen(app,tasks,true,
                        onOpenTask={ taskId -> editId=taskId;creating=false;tab="Задачи" },
                        onCreateTask={ projectId -> newTaskProjectId=projectId;editId=null;creating=true })
                    "Настройки" -> SettingsScreen(app,prefs,authState.busy,authState.user != null,authState.message) { name,value ->
                        if (authState.user != null) authController.updateSharedPreference(name,value)
                        else scope.launch { prefsStore.set(name,value) }
                    }
                    "Календарь" -> CalendarScreen(LocalDate.parse(selected),prefs.display,
                        onSelect={selected=it.toString();tab="Сегодня"},
                        experimental=true, tasks=tasks)
                    else -> LazyColumn(Modifier.weight(1f).testTag("today-list"),contentPadding=PaddingValues(16.dp),
                        verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        if(tab=="Сегодня") item { DayHeader(LocalDate.parse(selected),prefs.display) }
                        if(tab=="Сегодня") item {
                            DayRhythmPanel(prefs.use24)
                        }
                        item {
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) {
                                Text(if(tab=="Сегодня") "Задачи дня" else "Все задачи",style=MaterialTheme.typography.titleLarge)
                                Button(onClick={creating=true;editId=null;newTaskProjectId=null},modifier=Modifier.testTag("create-task")) { Text("Создать") }
                            }
                        }
                        val shown=tasks.filter { tab!="Сегодня" || TaskOccurrences.occursOn(it,LocalDate.parse(selected)) }
                        if(shown.isEmpty()) item { Text("Задач пока нет. Создайте первую запись.") }
                        items(shown,key={it.id}) { task ->
                            Card(Modifier.fillMaxWidth().testTag("task-${task.id}")) {
                                Row(Modifier.padding(8.dp),verticalAlignment=Alignment.CenterVertically) {
                                    Checkbox(checked=task.done,onCheckedChange={model.complete(task)})
                                    Column(Modifier.weight(1f).clickable { editId=task.id;creating=false }.padding(8.dp)) {
                                        androidx.compose.material3.Text(task.title,style=MaterialTheme.typography.titleMedium)
                                        Text("${if(tab=="Сегодня") selected else task.date} ${timeLabel(task.time,prefs.use24)} · Приоритет ${task.priority}" +
                                            if (task.recurrence.enabled) " · Повторяется" else "",style=MaterialTheme.typography.bodySmall)
                                        if(task.projectId!=null) Text(structure.projects.firstOrNull { it.id==task.projectId }?.title
                                            ?: task.project.ifBlank { "Проект" },style=MaterialTheme.typography.labelSmall)
                                        Text("Сохранено на устройстве",style=MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                        if(tab=="Сегодня") item {
                            DayKnowledgePanel(LocalDate.parse(selected))
                        }
                    }
                }
            }
            val existing=tasks.find { it.id==editId }
            if(creating || existing!=null) TaskEditor(existing,selected,prefs,structure,newTaskProjectId,
                authState.accountSettings,
                onDismiss={creating=false;editId=null},
                onSave={draft -> model.save(draft){creating=false;editId=null}},
                onDelete=existing?.let{{model.delete(it);creating=false;editId=null}},
                onDeleteOccurrence=existing?.takeIf { it.recurrence.enabled }?.let { series ->
                    { date -> model.excludeOccurrence(series,date) { creating=false;editId=null } }
                },
                showSelectedOccurrence=tab=="Сегодня")
            }
        }
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
    val copy = remember(date,mode) { todayHeroCopy(date,mode,calendar) }
        Card(Modifier.fillMaxWidth().testTag("today-hero"), shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, Color(0x66dfc17e))) {
            Box(Modifier.fillMaxWidth().heightIn(min = if(mode==CalendarMode.PROFANE) 540.dp else 390.dp)) {
                OriginalImage(copy.imagePath, copy.title,
                    Modifier.matchParentSize())
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x22040e10),
                    .32f to Color(0x44040e10), .62f to Color(0xc6071d20),
                    1f to Color(0xfa071d20))))
                copy.badge?.let { badge ->
                    Surface(Modifier.align(Alignment.TopEnd).padding(14.dp),
                        color = Color(0xc2071d20), shape = RoundedCornerShape(100.dp),
                        border = BorderStroke(1.dp, Color(0x88dfc17e))) {
                        Text(badge, Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            color = Color(0xfff5dcaa), style = MaterialTheme.typography.labelSmall)
                    }
                }
                Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()
                    .padding(start = 18.dp, end = 18.dp, top = 148.dp, bottom = 20.dp)
                    .testTag("today-hero-copy"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.eyebrow,
                        color = Color(0xffdfc17e), style = MaterialTheme.typography.labelMedium)
                    Text(copy.month.uppercase(java.util.Locale.forLanguageTag("ru")),
                        color = Color(0xfff0d49b), style = MaterialTheme.typography.labelLarge)
                    Text(copy.title, color = Color(0xfff9f2e2), style = MaterialTheme.typography.headlineSmall)
                    copy.subtitle?.let { Text(it, color = Color(0xfff1e5cb),
                        style = MaterialTheme.typography.titleMedium) }
                    Text(copy.description, Modifier.testTag("today-hero-description"),
                        color = Color(0xffeee6d7), style = MaterialTheme.typography.bodyMedium)
                    copy.details.forEach { Text(it, color = Color(0xffeee6d7),
                        style = MaterialTheme.typography.bodySmall) }
                    Text(copy.footerDate,
                        color = Color(0xffdfc17e), style = MaterialTheme.typography.labelMedium)
                }
            }
        }
}

@Composable
private fun TaskEditor(task:LocalTask?,selected:String,prefs:UiPreferences,structure:WorkspaceStructure,initialProjectId:String?,
    accountSettings:ru.genesis.calendar.auth.AccountSettings?,onDismiss:()->Unit,
    onSave:(LocalTask)->Unit,onDelete:(()->Unit)?,onDeleteOccurrence:((String)->Unit)?,showSelectedOccurrence:Boolean) {
    var title by rememberSaveable(task?.id) { mutableStateOf(task?.title ?: "") }
    var description by rememberSaveable(task?.id) { mutableStateOf(task?.description ?: "") }
    var date by rememberSaveable(task?.id) { mutableStateOf(task?.date ?: selected) }
    var time by rememberSaveable(task?.id) { mutableStateOf(task?.time ?: "") }
    var priority by rememberSaveable(task?.id) { mutableIntStateOf(task?.priority ?: 5) }
    var recurrence by remember(task?.id) { mutableStateOf(task?.recurrence ?: defaultTaskRecurrence(task?.date ?: selected, prefs.input)) }
    var projectId by rememberSaveable(task?.id,initialProjectId) { mutableStateOf(task?.projectId ?: initialProjectId) }
    val routing=accountSettings?.routing
    val originalTargets=remember(task?.id,accountSettings) {
        task?.sourceFieldsJson?.let { raw -> runCatching { JSONObject(raw).optJSONArray("syncAccountIds") }.getOrNull() }
            ?.let { array -> (0 until array.length()).map { array.optString(it) } }
            ?.takeIf { it.isNotEmpty() } ?: routing?.defaultAccountIds.orEmpty()
    }
    var syncTargets by remember(task?.id,accountSettings) { mutableStateOf(originalTargets) }
    var reminders by remember(task?.id) { mutableStateOf(task?.reminders ?: task?.reminderAt?.let {
        listOf(TaskReminder.absolute(it)) } ?: emptyList()) }
    var customReminder by remember { mutableStateOf(false) }
    var customRelative by remember { mutableStateOf(true) }
    var customAmount by rememberSaveable { mutableStateOf("1") }
    var customUnit by remember { mutableIntStateOf(60) }
    var absoluteDate by rememberSaveable { mutableStateOf(date) }
    var absoluteTime by rememberSaveable { mutableStateOf(time.ifBlank { "09:00" }) }
    val googleTaskBacked = task?.sourceFieldsJson?.let { raw ->
        runCatching { JSONObject(raw).optString("googleTaskId") }.getOrNull()?.let {
            it.isNotBlank() && it != "null"
        } ?: false
    } ?: false
    var confirmDelete by remember { mutableStateOf(false) }
    var validation by remember { mutableStateOf<String?>(null) }
    val occurrenceDate = if (task?.recurrence?.enabled == true && showSelectedOccurrence &&
        runCatching { TaskOccurrences.occursOn(task,LocalDate.parse(selected)) }.getOrDefault(false)) selected
        else task?.date ?: selected
    Dialog(onDismissRequest=onDismiss,properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.fillMaxWidth().padding(12.dp),shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(16.dp).imePadding().verticalScroll(rememberScrollState())
                .testTag("task-editor-scroll"),
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
                if(accountSettings?.multiAccountEnabled==true && accountSettings.accounts.size>1 && routing?.mode=="choose") {
                    Text("Отправить в Google-аккаунты",style=MaterialTheme.typography.titleMedium)
                    Text("Выберите один или несколько аккаунтов для этой задачи.",
                        style=MaterialTheme.typography.bodySmall)
                    accountSettings.accounts.forEach { account ->
                        Row(Modifier.fillMaxWidth().heightIn(min=48.dp),verticalAlignment=Alignment.CenterVertically) {
                            Checkbox(checked=account.id in syncTargets,onCheckedChange={ checked ->
                                syncTargets=if(checked) (syncTargets+account.id).distinct()
                                    else syncTargets.filterNot { it==account.id }
                            })
                            Text(account.email,style=MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                Text("Дата задачи · ${prefs.input.wireValue}")
                AuthorDatePicker(date,prefs.input){date=it}
                AuthorTimePicker(time,prefs.use24){time=it}
                PriorityControl(priority){priority=it}
                if(task?.recurrence?.enabled==true) Text(
                    "Сохранение изменит всю серию. При удалении можно выбрать только $occurrenceDate.",
                    style=MaterialTheme.typography.bodySmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
                val occurrenceCount = TaskRecurrenceEditor(recurrence,date,prefs.input) { recurrence=it;validation=null }
                Text("Напомнить · ${reminders.size}/5",style=MaterialTheme.typography.titleMedium)
                if(googleTaskBacked) Text("Для задачи из списка Google Tasks напоминания здесь недоступны; они поддерживаются для событий Google Calendar.",
                    style=MaterialTheme.typography.bodySmall)
                if(reminders.isEmpty()) Text("Без напоминания",style=MaterialTheme.typography.bodySmall)
                reminders.forEach { reminder ->
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                        Text(if(reminder.kind=="relative") "За ${reminder.minutes} мин до задачи" else
                            Instant.ofEpochMilli(requireNotNull(reminder.at)).atZone(ZoneId.systemDefault())
                                .format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")),Modifier.weight(1f))
                        TextButton(enabled=!googleTaskBacked,onClick={reminders=reminders.filterNot { it.key==reminder.key }}) { Text("Убрать") }
                    }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                    listOf(10 to "10 мин",30 to "30 мин",60 to "1 час",1440 to "1 день").forEach { (minutes,label) ->
                        FilterChip(selected=reminders.any{it.kind=="relative" && it.minutes==minutes},
                            enabled=!googleTaskBacked && (reminders.size<5 || reminders.any{it.kind=="relative" && it.minutes==minutes}),
                            onClick={ val spec=TaskReminder.relative(minutes)
                                reminders=if(reminders.any{it.key==spec.key}) reminders.filterNot{it.key==spec.key}
                                    else reminders+spec },label={Text(label)})
                    }
                }
                OutlinedButton(enabled=!googleTaskBacked && reminders.size<5,onClick={customReminder=true}) { Text("+ Своё напоминание") }
                if(customReminder) {
                    Row { FilterChip(selected=customRelative,onClick={customRelative=true},label={Text("За время до задачи")})
                        FilterChip(selected=!customRelative,onClick={customRelative=false},label={Text("Точная дата и время")}) }
                    if(customRelative) {
                        OutlinedTextField(customAmount,{customAmount=it},label={Text("Целое число")},singleLine=true)
                        Row(Modifier.horizontalScroll(rememberScrollState())) {
                            listOf(1 to "Мин",60 to "Часы",1440 to "Дни",10080 to "Недели").forEach { (unit,label) ->
                                FilterChip(selected=customUnit==unit,onClick={customUnit=unit},label={Text(label)})
                            }
                        }
                    } else {
                        Text("Дата напоминания · ${prefs.input.wireValue}")
                        AuthorDatePicker(absoluteDate,prefs.input){absoluteDate=it}
                        AuthorTimePicker(absoluteTime,prefs.use24){absoluteTime=it}
                    }
                    Row {
                        TextButton(onClick={customReminder=false}) { Text("Отмена") }
                        Button(onClick={
                            val spec=if(customRelative) customAmount.toIntOrNull()?.let { count ->
                                (count.toLong()*customUnit).takeIf { it in 0..40_320 }?.let { TaskReminder.relative(it.toInt()) }
                            } else runCatching { TaskReminder.absolute(LocalDate.parse(absoluteDate)
                                .atTime(LocalTime.parse(absoluteTime)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()) }.getOrNull()
                            val start=runCatching { LocalDate.parse(date).atTime(LocalTime.parse(time.ifBlank { "00:00" }))
                                .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrNull()
                            validation=when {
                                spec==null || start==null -> "Введите корректную дату, время и интервал до четырёх недель."
                                spec.kind=="absolute" && (requireNotNull(spec.at)>start || start-requireNotNull(spec.at)>40_320L*60_000) ->
                                    "Точная дата должна быть не позже задачи и не раньше четырёх недель до неё."
                                reminders.any{it.key==spec.key} -> "Такое напоминание уже добавлено."
                                else -> null
                            }
                            if(validation==null && spec!=null) { reminders=reminders+spec;customReminder=false }
                        }) { Text("Добавить") }
                    }
                }
                validation?.let { Text(it,color=MaterialTheme.colorScheme.error) }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    TextButton(onClick=onDismiss){Text("Отмена")}
                    Button(enabled=title.isNotBlank() && (routing?.mode!="choose" ||
                        accountSettings?.multiAccountEnabled!=true || syncTargets.isNotEmpty()),onClick={
                        val start = runCatching { LocalDate.parse(date) }.getOrNull()
                        val end = runCatching { LocalDate.parse(recurrence.rangeEnd) }.getOrNull()
                        validation = when {
                            start == null -> "Выберите корректную дату задачи."
                            recurrence.enabled && (end == null || end < start || end > start.plusYears(5).minusDays(1)) ->
                                "Период повторения — от даты задачи до пяти лет."
                            recurrence.enabled && occurrenceCount !in 1..500 ->
                                "Серия должна содержать от 1 до 500 повторений."
                            else -> null
                        }
                        val source = JSONObject(task?.sourceFieldsJson ?: "{}")
                        if(routing?.mode=="choose" && accountSettings?.multiAccountEnabled==true && accountSettings.accounts.size>1)
                            source.put("syncAccountIds",JSONArray(syncTargets))
                        else if(task==null || task.categoryId!=structure.projects.firstOrNull{it.id==projectId}?.categoryId)
                            source.remove("syncAccountIds")
                        if (validation == null) onSave((task ?: LocalTask(title=title)).copy(title=title.trim(),description=description,date=date,time=time,priority=priority,
                            reminderAt=reminders.firstOrNull{it.kind=="absolute"}?.at,reminders=reminders,
                            projectId=projectId,categoryId=structure.projects.firstOrNull{it.id==projectId}?.categoryId,
                            recurrence=if (recurrence.enabled) RecurrenceEngine(GenesisCalendar()).resolve(date,recurrence.copy(rangeStart=date))
                                else recurrence.copy(enabled=false,rangeStart="",rangeEnd=""),
                            recurrenceExcludedDates=if(recurrence.enabled) task?.recurrenceExcludedDates ?: emptyList() else emptyList(),
                            sourceFieldsJson=source.toString()))
                    },modifier=Modifier.testTag("save-task")){Text("Сохранить")}
                }
                onDelete?.let { TextButton(onClick={confirmDelete=true}){Text("Удалить задачу")} }
            }
        }
    }
    if(confirmDelete) AlertDialog(onDismissRequest={confirmDelete=false},
        title={Text(if(onDeleteOccurrence!=null) "Удалить повторение?" else "Удалить задачу?")},
        text={Text(if(onDeleteOccurrence!=null) "Можно удалить только $occurrenceDate или всю серию."
            else "Напоминание этой задачи будет отменено.")},
        confirmButton={
            Column {
                if(onDeleteOccurrence!=null) TextButton(onClick={onDeleteOccurrence(occurrenceDate);confirmDelete=false},
                    modifier=Modifier.testTag("delete-occurrence")){Text("Только этот день")}
                TextButton(onClick={onDelete?.invoke();confirmDelete=false},
                    modifier=Modifier.testTag("delete-series")){Text(if(onDeleteOccurrence!=null) "Вся серия" else "Удалить")}
            }
        },
        dismissButton={TextButton(onClick={confirmDelete=false}){Text("Отмена")}})
}

@Composable
private fun SettingsScreen(app:GenesisApplication,prefs:UiPreferences,sharedBusy:Boolean,signedIn:Boolean,
    sharedStatus:String,
    onSet:(String,String)->Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){refresh++}
    val scope=rememberCoroutineScope()
    val rows by produceState(emptyList<ReminderRecord>(),refresh) { value=withContext(Dispatchers.IO){app.database.dao().reminders(app.workspaceScope)} }
    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Настройки",style=MaterialTheme.typography.titleLarge)
        Text("Язык интерфейса",style=MaterialTheme.typography.titleMedium)
        LanguageChips(prefs.language) { onSet("language",it) }
        Text(if(signedIn) "Календарь, время и гадания сохраняются в аккаунте GENESIS и зеркалируются на устройстве."
            else "До входа эти настройки сохраняются только на устройстве.",style=MaterialTheme.typography.bodySmall)
        if(signedIn) Text(sharedStatus,style=MaterialTheme.typography.labelSmall)
        listOf("display" to "Календарь отображения","input" to "Календарь ввода и повторений").forEach{(key,label)->
            Text(label)
            Row(Modifier.horizontalScroll(rememberScrollState())) { CalendarMode.entries.forEach { mode->
                FilterChip(selected=(if(key=="display") prefs.display else prefs.input)==mode,onClick={onSet(key,mode.wireValue)},
                    enabled=!sharedBusy,
                    label={Text(when(mode){CalendarMode.SACRED->"Сакральный";CalendarMode.LUNAR->"Лунный";else->"Григорианский"})})
            } }
        }
        Row { listOf("24h","12h").forEach { FilterChip(selected=prefs.use24==(it=="24h"),onClick={onSet("time",it)},
            enabled=!sharedBusy,label={Text(it)})} }
        HorizontalDivider()
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Гадания по картам",style=MaterialTheme.typography.titleMedium)
                Text("Если выключить, карты дня и расклад Стойхейона будут скрыты; алфавит останется доступным.",
                    style=MaterialTheme.typography.bodySmall)
            }
            Switch(checked=!prefs.divinationDisabled,
                onCheckedChange={onSet("stoicheionDivinationDisabled",(!it).toString())},
                enabled=!sharedBusy,
                modifier=Modifier.testTag("stoicheion-divination-setting"))
        }
        HorizontalDivider()
        Text("Системные напоминания",style=MaterialTheme.typography.titleMedium)
        Text("Уведомления: ${if(app.scheduler.notificationsAllowed()) "разрешены" else "выключены"}")
        Text("Канал задач: ${if(app.scheduler.channelAllowed()) "включён" else "выключен"}")
        Text("Время доставки: ${if(app.scheduler.exactAllowed()) "точное" else "приблизительное — Android может задержать"}")
        Button(onClick={
            if(Build.VERSION.SDK_INT>=33 && !app.scheduler.notificationsAllowed()) request.launch(Manifest.permission.POST_NOTIFICATIONS)
            else app.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,app.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }){Text("Разрешить уведомления")}
        if(Build.VERSION.SDK_INT in 31..32 && !app.scheduler.exactAllowed()) OutlinedButton(onClick={
            app.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${app.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }){Text("Точное время напоминаний")}
        if(Build.VERSION.SDK_INT>=33 && !app.scheduler.exactAllowed())
            Text("Система ограничила точные сигналы. Уведомления могут приходить с задержкой; проверьте разрешения GENESIS в настройках устройства.",
                style=MaterialTheme.typography.bodySmall)
        Text("На выключенном телефоне, после Force stop и при системном запрете уведомления недоступны. DND и отключённый звук сохраняются.")
        Text("После перезагрузки расписание восстанавливается после разблокировки. Просроченные сигналы не проигрываются повторно.")
        OutlinedButton(onClick={scope.launch{app.scheduler.restore();refresh++}}){Text("Проверить расписание")}
        rows.sortedBy{it.at}.takeLast(8).forEach{Text("Напоминание · ${it.state} · ${Instant.ofEpochMilli(it.at).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd.MM HH:mm"))}",style=MaterialTheme.typography.bodySmall)}
        HorizontalDivider()
        ru.genesis.calendar.auth.AuthPanel(app)
        Text("Версия ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",style=MaterialTheme.typography.labelSmall)
    }
}
