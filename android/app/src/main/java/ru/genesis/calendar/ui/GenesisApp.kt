package ru.genesis.calendar.ui

import android.Manifest
import android.content.res.Configuration
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.stateDescription
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.ui.unit.dp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.*
import ru.genesis.calendar.auth.GoogleServicesFirstRunModal
import ru.genesis.calendar.auth.activity
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale

internal val standart = lightColorScheme(primary=Color(0xff255b59),onPrimary=Color(0xfffffdf8),
    background=Color(0xffe1d9c8),onBackground=Color(0xff132426),surface=Color(0xfff8f5ed),
    onSurface=Color(0xff132426),onSurfaceVariant=Color(0xff526263),
    secondary=Color(0xffb28a4a),onSecondary=Color(0xff132426),secondaryContainer=Color(0xffd8bd80),
    onSecondaryContainer=Color(0xff132426),primaryContainer=Color(0xffcddfda),onPrimaryContainer=Color(0xff132426),
    surfaceVariant=Color(0xffe9e1d0),surfaceContainer=Color(0xfff8f5ed),surfaceContainerLow=Color(0xfff8f5ed),
    surfaceContainerLowest=Color(0xfffffdf8),surfaceContainerHigh=Color(0xffefe8d9),surfaceContainerHighest=Color(0xffe9e1d0),
    outline=Color(0xff9c927e),outlineVariant=Color(0xffd5cab4))
@Composable
fun GenesisApp(app: GenesisApplication, openedTask: String?, openedSection: String? = null,
    testWorkspace: Boolean = false) {
    require(!testWorkspace || BuildConfig.DEBUG)
    val activeScope by app.scopeFlow.collectAsStateWithLifecycle()
    key(activeScope) { GenesisWorkspaceContent(app, openedTask, openedSection, activeScope, testWorkspace) }
}

@OptIn(FlowPreview::class)
@Composable
private fun GenesisWorkspaceContent(app: GenesisApplication, openedTask: String?, openedSection: String?,
    activeScope: String, testWorkspace: Boolean) {
    val model: GenesisViewModel = viewModel(key = "genesis-$activeScope")
    val tasks by model.tasks.collectAsStateWithLifecycle()
    val error by model.error.collectAsStateWithLifecycle()
    val structureRepo = remember(app, activeScope) { WorkspaceStructureRepository(app) }
    val structure by structureRepo.workspace.collectAsStateWithLifecycle(WorkspaceStructure())
    val taskListsRepo = remember(app, activeScope) { TaskListsRepository(app) }
    val cachedTaskLists by taskListsRepo.lists.collectAsStateWithLifecycle(emptyList())
    val taskLists = remember(cachedTaskLists,tasks) { taskListsForTasks(cachedTaskLists,tasks) }
    val prefsStore=remember(app, activeScope) { LocalPreferences(app,activeScope) }
    val prefs by prefsStore.values.collectAsStateWithLifecycle(UiPreferences())
    val menuSwipeState = remember(activeScope) { MenuSwipeState() }
    val habitSettingsRepository = remember(app, activeScope) { HabitsRepository(app) }
    val habitWorkspace by habitSettingsRepository.workspace.collectAsStateWithLifecycle(LocalHabitWorkspace())
    val habitTrackingEnabled = habitWorkspace.settings.enabled
    val welcomePrefsStore=remember(app) { LocalPreferences(app,"welcome") }
    val welcomePrefs by welcomePrefsStore.values.collectAsStateWithLifecycle(
        UiPreferences(language = regionalLanguageForDevice()))
    val authController = remember(app) { ru.genesis.calendar.auth.AuthController.get(app) }
    val authState by authController.state.collectAsStateWithLifecycle()
    val taskSync by authController.taskSync.collectAsStateWithLifecycle()
    val accountTaskSync = taskSync.takeIf { it.scope == activeScope }
    val scope=rememberCoroutineScope()
    LaunchedEffect(activeScope) { ru.genesis.calendar.reminders.MoonReminderScheduler.restore(app) }
    var preferredWelcomeLanguage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(authController, testWorkspace) { if (!testWorkspace) authController.ensureSession() }
    LaunchedEffect(activeScope, authState.user, authState.busy) {
        if (!testWorkspace && activeScope.startsWith("account-") && authState.user != null && !authState.busy) {
            app.database.dao().observeOutbox(activeScope).debounce(800).collectLatest { pending ->
                if (pending.isNotEmpty()) authController.syncPending()
            }
        }
    }
    LaunchedEffect(authState.accountSettings) {
        authState.accountSettings?.let { remote ->
            if (remote.calendarMode in setOf("sacred", "lunar", "profane")) prefsStore.setRemote("display", remote.calendarMode)
            if (remote.taskCalendarMode in setOf("sacred", "lunar", "profane")) prefsStore.setRemote("input", remote.taskCalendarMode)
            if (remote.timeFormat in setOf("12h", "24h")) prefsStore.setRemote("time", remote.timeFormat)
            if (remote.weekStart in setOf("sunday", "monday")) prefsStore.setRemote("weekStart", remote.weekStart)
            if (remote.gregorianYearStart in setOf("january", "march"))
                prefsStore.setRemote("gregorianYearStart", remote.gregorianYearStart)
            if (remote.language in setOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja")) prefsStore.setRemote("language", remote.language)
            prefsStore.setRemote("stoicheionDivinationDisabled", remote.divinationDisabled.toString())
        }
    }
    LaunchedEffect(activeScope, authState.user, authState.ready) {
        if (!testWorkspace && activeScope.startsWith("account-") && authState.ready) {
            prefsStore.pending.debounce(800).collectLatest { if (it.isNotEmpty()) authController.syncPending() }
        }
    }
    var tab by rememberSaveable { mutableStateOf("Сегодня") }
    var editId by rememberSaveable { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var newTaskProjectId by rememberSaveable { mutableStateOf<String?>(null) }
    var newTaskListId by rememberSaveable { mutableStateOf<String?>(null) }
    var creatingTaskList by rememberSaveable { mutableStateOf(false) }
    var requestedTheokyklosSector by rememberSaveable { mutableStateOf<String?>(null) }
    var selected by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var dayDetailsExpanded by rememberSaveable(selected) { mutableStateOf(false) }
    LaunchedEffect(habitTrackingEnabled, tab) {
        if (!habitTrackingEnabled && tab == "Привычки") tab = "Сегодня"
    }
    LaunchedEffect(openedTask) { if(openedTask!=null) { editId=openedTask; creating=false; tab="Задачи" } }
    LaunchedEffect(openedSection) {
        if (openedSection?.substringBefore('#') == "habits" && habitTrackingEnabled) tab = "Привычки"
    }
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    val shortWindow = compactWindowHeight()
    val compactHeader = isLandscape || configuration.screenWidthDp >= 600
    val navigationOnLeft = shouldUseNavigationRail(configuration.screenWidthDp,
        isLandscape, prefs.wideNavigationOnLeft)
    val portraitAutoScroll = !isLandscape && prefs.navigationLabels && prefs.navigationAutoScroll
    val portraitMenuSwipe = !isLandscape && prefs.menuSwipeEnabled
    val swipeSequence = menuSwipeSequence(prefs.menuSwipeSubmenus, habitTrackingEnabled)
    val currentSwipeDestination = SwipeDestination(tab,
        if (prefs.menuSwipeSubmenus) menuSwipeState.section(tab) else null)
    val eveningTheme = rememberEveningTheme(AppearanceSettings.read(habitWorkspace.settings.rawJson))
    val accountGate = !testWorkspace && (!activeScope.startsWith("account-") || authState.user == null || !authState.ready)
    val welcomeVisible = accountGate && !(authState.busy && authState.user != null)
    val window = LocalContext.current.activity()?.window
    SideEffect { window?.let { WindowInsetsControllerCompat(it,it.decorView).apply {
        isAppearanceLightStatusBars = !eveningTheme && !welcomeVisible
        isAppearanceLightNavigationBars = !eveningTheme && !welcomeVisible
    } } }
    MaterialTheme(colorScheme=if (eveningTheme) evening else standart) {
      CompositionLocalProvider(LocalEveningTheme provides eveningTheme) {
      CompositionLocalProvider(LocalGenesisLanguage provides
          (if(testWorkspace || activeScope.startsWith("account-")) prefs.language else welcomePrefs.language)) {
        Surface(Modifier.fillMaxSize().testTag(if (eveningTheme) "app-theme-Evening" else "app-theme-Standart"),color=MaterialTheme.colorScheme.background) {
            if (accountGate) {
                if (authState.busy && authState.user != null) AuthTransitionScreen(authState.message)
                else WelcomeScreen(authState,authController,welcomePrefs.language,preferredWelcomeLanguage) { language ->
                        preferredWelcomeLanguage = language
                        scope.launch { welcomePrefsStore.set("language",language) }
                    }
            } else {
            NavigationConnectionScope(tab,
                showConnections = prefs.navigationLabels && tab != "Проекты" && !portraitAutoScroll,
                iconGlow = !prefs.navigationLabels) {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                val accountStatus = if (activeScope.startsWith("account-"))
                    "Аккаунт GENESIS · защищённая локальная копия"
                else if(BuildConfig.DEBUG) "Изолированное тестовое пространство · только на этом устройстве"
                else "Локальные черновики · аккаунт не подключён"
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = if (compactHeader) 4.dp else 10.dp)
                    .testTag("app-header"),
                    verticalAlignment=Alignment.CenterVertically) {
                    Box(Modifier.size(if (compactHeader) 30.dp else 42.dp).shadow(3.dp, CircleShape).clip(CircleShape)
                        .background(Color(0xff172624)).testTag("genesis-round-logo")) {
                        OriginalImage("icons/icon-192.png","GENESIS",Modifier.fillMaxSize()
                            .graphicsLayer { scaleX = 1.20f; scaleY = 1.20f })
                    }
                    if (compactHeader) {
                        Text("GENESIS", Modifier.padding(start = 8.dp), style = MaterialTheme.typography.titleMedium)
                        Text(accountStatus, Modifier.padding(start = 10.dp).weight(1f).testTag("app-account-status"),
                            style = MaterialTheme.typography.labelSmall, maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                    } else {
                        Text("GENESIS",Modifier.padding(start=10.dp).weight(1f),style=MaterialTheme.typography.titleLarge)
                    }
                    Text(if(BuildConfig.DEBUG) "Internal alpha" else BuildConfig.VERSION_NAME,
                        modifier = Modifier.padding(horizontal = 6.dp), style=MaterialTheme.typography.labelSmall,
                        maxLines = 1)
                    if (!testWorkspace) {
                        val refreshBusy = authState.busy || accountTaskSync?.loading == true
                        val refreshDescription = genesisTranslate(if (refreshBusy)
                            "Получаем изменения с сервера…" else "Обновить аккаунт")
                        IconButton(onClick = authController::refresh, enabled = !refreshBusy,
                            modifier = Modifier.size(if (compactHeader) 34.dp else 40.dp).testTag("today-refresh")
                                .semantics { contentDescription = refreshDescription }) {
                            Text(if (refreshBusy) "…" else "↻",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                if (!compactHeader) Text(accountStatus,Modifier.padding(horizontal=16.dp).testTag("app-account-status"),
                    style=MaterialTheme.typography.bodySmall)
                if(!testWorkspace && authState.requiresSignIn) {
                    Text("Для синхронизации повторите вход. Данные и напоминания доступны на устройстве.",
                        Modifier.padding(horizontal=16.dp),style=MaterialTheme.typography.bodySmall)
                    TextButton(onClick={authController.checkSession();tab="Настройки"},
                        modifier=Modifier.padding(horizontal=8.dp)) { Text("Открыть вход через Google") }
                }
                HabitNotificationAccessNotice(app,habitTrackingEnabled &&
                    habitWorkspace.habits.any { it.reminder.enabled })
                if (!testWorkspace && accountTaskSync != null) {
                    ru.genesis.calendar.auth.AccountTaskSyncNotice(accountTaskSync,
                        Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                val pageContent: @Composable (String, MenuSwipeState) -> Unit = { visibleTab, visibleSwipeState ->
                  Column(Modifier.fillMaxSize()) {
                  error?.let { Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(12.dp)) }
                  when(visibleTab) {
                    "Привычки" -> HabitsScreen(app,true,prefs.input,prefs.display,visibleSwipeState)
                    "Теокиклос" -> TheokyklosScreen(app,prefs.input,onOpenHabits={tab="Привычки"},
                        initialSectorId=requestedTheokyklosSector,
                        onInitialSectorConsumed={requestedTheokyklosSector=null})
                    "Стойхейон" -> StoicheionScreen(app,prefs.divinationDisabled, onOpenTheokyklosSector={ sectorId ->
                        requestedTheokyklosSector=sectorId; tab="Теокиклос"
                    })
                    "Проекты" -> ProjectsScreen(app,tasks,true,
                        onOpenTask={ taskId -> editId=taskId;creating=false;tab="Задачи" },
                        onCreateTask={ projectId -> newTaskProjectId=projectId;newTaskListId=null;editId=null;creating=true },
                        menuSwipeState=visibleSwipeState)
                    "Задачи" -> TasksScreen(tasks,taskLists,structure,prefs.use24,
                        confirmed = testWorkspace || accountTaskSync?.confirmed != false,
                        onCreateTask = { list -> newTaskListId=list?.id; newTaskProjectId=list?.let {
                            structure.taskListLinks.firstOrNull { link -> link.taskListId == it.id }?.projectId
                        }; editId=null; creating=true }, onCreateList={creatingTaskList=true},
                        onComplete=model::complete,onOpen={editId=it;creating=false},
                        menuSwipeState=visibleSwipeState)
                    "Настройки" -> SettingsScreen(app, prefs, authState.busy && !testWorkspace,
                        canOpenAdmin = !testWorkspace && authState.ready && !authState.requiresSignIn &&
                            authState.user != null && authState.accountSettings?.isAdmin == true,
                        adminLoad = authController::adminStats,
                        adminDelete = authController::deleteAdminUser,
                        onSet = { name, value ->
                            if (!testWorkspace && authState.user != null) authController.updateSharedPreference(name, value)
                            else scope.launch { prefsStore.set(name, value) }
                        }, onSetLocal = { name, value -> scope.launch { prefsStore.set(name, value) } })
                    "Календарь" -> CalendarScreen(LocalDate.parse(selected),prefs.display,
                        onSelect={selected=it.toString();tab="Сегодня"},
                        onModeChange={ next ->
                            if (!testWorkspace && authState.user != null) authController.updateSharedPreference("display", next.wireValue)
                            else scope.launch { prefsStore.set("display", next.wireValue) }
                        },
                        experimental=true, tasks=tasks, use24=prefs.use24,
                        weekStartsOnSunday=prefs.weekStartsOnSunday,
                        gregorianYearStartsInMarch=prefs.gregorianYearStartsInMarch,
                        onStartGregorianYearInMarch={
                            if (!testWorkspace && authState.user != null)
                                authController.updateSharedPreference("gregorianYearStart", "march")
                            else scope.launch { prefsStore.set("gregorianYearStart", "march") }
                        },
                        regionalSeasonArt=prefs.regionalSeasonArt,
                        seasonRegionZone=selectedSeasonZone(prefs),
                        onCompleteTask=model::complete,
                        onEditTask={ task, date -> selected=date.toString();editId=task.id;creating=false },
                        onDeleteTask=model::delete,
                        onDeleteOccurrence={ task, date -> model.excludeOccurrence(task,date.toString()) {} },
                        dayHabits={ date -> if(habitTrackingEnabled) TodayHabitsContent(app,date,habitWorkspace,
                            onOpenHabits={tab="Привычки"}) },
                        menuSwipeState=visibleSwipeState,
                        periodSwipeEnabled=!portraitMenuSwipe)
                    else -> TodayWorkspace(header = {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                DayHeader(LocalDate.parse(selected), prefs.display, dayDetailsExpanded,
                                    onToggleDetails = { dayDetailsExpanded = !dayDetailsExpanded },
                                    onModeChange = { next ->
                                        if (!testWorkspace && authState.user != null) authController.updateSharedPreference("display", next.wireValue)
                                        else scope.launch { prefsStore.set("display", next.wireValue) }
                                    })
                                if (!testWorkspace && authState.ready)
                                    TodayAdPanel(authController, authState.user?.uid, prefs.language)
                                AnimatedVisibility(visible = dayDetailsExpanded,
                                    modifier = Modifier.testTag("today-day-details"),
                                    enter = expandVertically(tween(320, easing = CubicBezierEasing(.16f, 1f, .3f, 1f)),
                                        expandFrom = Alignment.Top) + fadeIn(tween(190)),
                                    exit = shrinkVertically(tween(220, easing = CubicBezierEasing(.4f, 0f, 1f, 1f)),
                                        shrinkTowards = Alignment.Top) + fadeOut(tween(140))) {
                                    DayKnowledgePanel(LocalDate.parse(selected), prefs.display)
                                }
                            }
                    }, rhythm = { DayRhythmPanel(prefs.use24) }, tasks = {
                        val shown = tasks.filter { TaskOccurrences.occursOn(it, LocalDate.parse(selected)) }
                            val todayDate=LocalDate.now()
                            val missed=if (prefs.showMissedTasksToday && selected == todayDate.toString())
                                missedTasksForToday(tasks,todayDate) else emptyList()
                            TodayTasksPanel(shown, missed, selected, prefs.use24, structure,
                                onCreate = { creating=true;editId=null;newTaskProjectId=null;newTaskListId=null },
                                onComplete = model::complete,
                                onMoveToToday = { task -> model.save(task.copy(date=todayDate.toString())) {} },
                                onOpen = { taskId -> editId=taskId;creating=false }) {
                                if (habitTrackingEnabled) TodayHabitsContent(app, LocalDate.parse(selected),
                                    habitWorkspace, onOpenHabits = { tab = "Привычки" })
                            }
                    })
                  }
                  }
                }
                val workspacePager: @Composable (Modifier) -> Unit = { pagerModifier ->
                    MenuSwipePager(currentSwipeDestination, swipeSequence, portraitMenuSwipe,
                        onNavigate = { destination ->
                            destination.section?.let { menuSwipeState.select(destination.page, it) }
                            tab = destination.page
                        }, modifier = pagerModifier) { destination ->
                        val visibleSwipeState = if (destination == currentSwipeDestination) menuSwipeState
                            else remember(destination, menuSwipeState.tasks, menuSwipeState.projects,
                                menuSwipeState.calendar, menuSwipeState.habits) {
                                MenuSwipeState().also { preview ->
                                    preview.tasks = menuSwipeState.tasks
                                    preview.projects = menuSwipeState.projects
                                    preview.calendar = menuSwipeState.calendar
                                    preview.habits = menuSwipeState.habits
                                    destination.section?.let { preview.select(destination.page, it) }
                                }
                            }
                        CompositionLocalProvider(LocalCompactSubmenus provides (navigationOnLeft || isLandscape)) {
                            pageContent(destination.page, visibleSwipeState)
                        }
                    }
                }
                if (navigationOnLeft) {
                    Row(Modifier.fillMaxWidth().weight(1f).testTag("wide-navigation-layout")) {
                        PrimaryNavigation(tab, habitTrackingEnabled, vertical = true,
                            showLabels = prefs.navigationLabels && !shortWindow, autoScroll = false,
                            onSelect = { tab = it }, modifier = Modifier
                                .width(if (prefs.navigationLabels && !shortWindow) 132.dp else 64.dp).fillMaxHeight())
                        workspacePager(Modifier.weight(1f).fillMaxHeight().testTag("main-content"))
                    }
                } else {
                    PrimaryNavigation(tab, habitTrackingEnabled, vertical = false,
                        showLabels = prefs.navigationLabels, autoScroll = portraitAutoScroll,
                        onSelect = { tab = it })
                    workspacePager(Modifier.fillMaxWidth().weight(1f).testTag("main-content"))
                }
            }
            val existing=tasks.find { it.id==editId }
            if(creating || existing!=null) TaskEditor(existing,selected,prefs,structure,newTaskProjectId,
                authState.accountSettings,taskLists,newTaskListId,
                onDismiss={creating=false;editId=null},
                onSave={draft -> model.save(draft){creating=false;editId=null}},
                onDelete=existing?.let{{model.delete(it);creating=false;editId=null}},
                onDeleteOccurrence=existing?.takeIf { it.recurrence.enabled }?.let { series ->
                    { date -> model.excludeOccurrence(series,date) { creating=false;editId=null } }
                },
                showSelectedOccurrence=tab=="Сегодня" || tab=="Календарь")
            if(creatingTaskList) TaskListEditor(structure,authState.accountSettings,prefs,
                canCreate=authState.ready && !authState.requiresSignIn && authState.user!=null &&
                    (authState.accountSettings?.authProvider != "yandex" || authState.accountSettings?.calendarConnected == true),
                onDismiss={creatingTaskList=false},onCreate=authController::createTaskList,
                onSaveTasks={list,projectId,date,rows ->
                    require(app.workspaceScope==activeScope) { "Аккаунт изменился. Откройте форму заново." }
                    saveListDraftTasks(app,list,projectId,date,prefs.input,rows);authController.syncPending()
                })
            }
        }
        }
        if (!testWorkspace) GoogleServicesFirstRunModal(authState, authController)
        ReleaseNotesAutoDialog(!testWorkspace && !accountGate && !authState.offerGoogleServices)
        AndroidUpdatePrompt(app, authState.checkedAt,
            !testWorkspace && authState.ready && authState.user != null)
      }
      }
    }
    LaunchedEffect(prefs.language) { app.scheduler.createChannels(prefs.language) }
}

internal fun shouldUseNavigationRail(screenWidthDp: Int, landscape: Boolean,
    wideNavigationOnLeft: Boolean): Boolean = wideNavigationOnLeft && (landscape || screenWidthDp >= 600)

@Composable
private fun PrimaryNavigation(selectedPage: String, habitTrackingEnabled: Boolean, vertical: Boolean,
    showLabels: Boolean, autoScroll: Boolean, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    val compact = compactWindowHeight()
    val pages = listOf("Сегодня","Задачи","Проекты","Календарь","Привычки","Стойхейон","Теокиклос","Настройки")
        .filter { habitTrackingEnabled || it != "Привычки" }
    if (vertical) {
        Surface(modifier.then(navigationViewportAnchor()).testTag("main-navigation-rail"),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(4.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)) {
                pages.forEach { page -> PrimaryNavigationItem(page, selectedPage == page, true,
                    showLabels = showLabels, compact = true) { onSelect(page) } }
            }
        }
    } else if (!showLabels) {
        Row(modifier.fillMaxWidth().then(navigationViewportAnchor()).testTag("main-navigation-icons")
            .padding(horizontal = 2.dp)) {
            pages.forEach { page ->
                Box(Modifier.weight(1f)) {
                    PrimaryNavigationItem(page, selectedPage == page, true, showLabels = false,
                        compact = true) { onSelect(page) }
                }
            }
        }
    } else {
        val scrollState = rememberScrollState()
        var cycleWidth by remember { mutableIntStateOf(0) }
        var touching by remember { mutableStateOf(false) }
        LaunchedEffect(autoScroll, touching, cycleWidth) {
            if (!autoScroll || touching || cycleWidth <= 0) return@LaunchedEffect
            while (isActive) {
                delay(20)
                scrollState.scrollBy(.55f)
                if (scrollState.value >= cycleWidth) scrollState.scrollTo(scrollState.value - cycleWidth)
            }
        }
        Row(modifier.fillMaxWidth().then(navigationViewportAnchor()).testTag("main-navigation-scroll")
            .horizontalScroll(scrollState)
            .pointerInput(autoScroll) {
                awaitPointerEventScope {
                    while (true) touching = awaitPointerEvent().changes.any { it.pressed }
                }
            }.padding(horizontal=4.dp)) {
            Row(Modifier.onSizeChanged { cycleWidth = it.width }) {
                pages.forEach { page -> PrimaryNavigationItem(page, selectedPage == page, false,
                    showLabels = true, compact = compact) { onSelect(page) } }
            }
            if (autoScroll) Row {
                pages.forEach { page -> PrimaryNavigationItem(page, selectedPage == page, false,
                    showLabels = true, compact = compact, loopCopy = true) { onSelect(page) } }
            }
        }
    }
}

@Composable
private fun PrimaryNavigationItem(page: String, selectedPage: Boolean, fillWidth: Boolean,
    showLabels: Boolean, compact: Boolean, loopCopy: Boolean = false, onSelect: () -> Unit) {
    val accessiblePage = genesisTranslate(page)
    val glowPhase = LocalNavigationGlowPhase.current
    val glow = if (!showLabels && selectedPage && glowPhase >= 0f)
        navigationGlowColor(glowPhase, LocalEveningTheme.current) else null
    Surface(onClick=onSelect, shape=RoundedCornerShape(16.dp),
        color=if(selectedPage) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        contentColor=if(selectedPage) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
        border=if (glow != null) BorderStroke(1.5.dp, Brush.horizontalGradient(listOf(
            glow.copy(alpha = .55f), navigationGlowColor((glowPhase + .16f) % 1f,
                LocalEveningTheme.current).copy(alpha = .83f), glow.copy(alpha = .55f))))
        else BorderStroke(if(selectedPage) 1.5.dp else 1.dp,
            if(selectedPage) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
        shadowElevation=if(selectedPage) 3.dp else 1.dp,
        modifier=(if (fillWidth) Modifier.fillMaxWidth() else Modifier).padding(if (compact) 2.dp else 3.dp)
            .heightIn(min=if (compact) 44.dp else 48.dp)
            .testTag(if (loopCopy) "navigation-loop-$page" else "navigation-$page")
            .semantics {
                selected=selectedPage; role=Role.Tab
                if (!showLabels) contentDescription = accessiblePage
            }.then(if (loopCopy) Modifier else navigationParentAnchor(page))) {
        Row(Modifier.fillMaxWidth().padding(horizontal=if(showLabels) 10.dp else 0.dp,
            vertical=if(compact) 6.dp else 8.dp),verticalAlignment=Alignment.CenterVertically,
            horizontalArrangement=Arrangement.Center) {
            GenesisVectorIcon(genesisPageIcon(page), Modifier.size(if(compact) 22.dp else 24.dp))
            if (showLabels) {
                Spacer(Modifier.width(7.dp))
                Text(page,style=if(compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.labelLarge,
                    maxLines = 1)
            }
        }
    }
}

@Composable
private fun AuthTransitionScreen(message: String) {
    Box(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            CircularProgressIndicator()
            Text("Открываем защищённое пространство", style = MaterialTheme.typography.titleMedium)
            Text(message, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun TodayTasksPanel(tasks: List<LocalTask>, missedTasks: List<LocalTask>, selected: String, use24: Boolean,
    structure: WorkspaceStructure, onCreate: () -> Unit, onComplete: (LocalTask) -> Unit,
    onMoveToToday: (LocalTask) -> Unit, onOpen: (String) -> Unit,
    habits: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth().testTag("today-tasks-section"), shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = if(LocalEveningTheme.current)
            MaterialTheme.colorScheme.primaryContainer else Color(0xfffffbf2)),
        border = BorderStroke(1.dp, if(LocalEveningTheme.current) MaterialTheme.colorScheme.primary.copy(alpha=.6f)
            else Color(0x55b28a4a))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(Modifier.size(44.dp), shape = RoundedCornerShape(14.dp), color = if(LocalEveningTheme.current)
                    MaterialTheme.colorScheme.secondaryContainer else Color(0xff123b36)) {
                    Box(contentAlignment = Alignment.Center) {
                        GenesisVectorIcon(GenesisPageIcon.TASKS, Modifier.size(28.dp), if(LocalEveningTheme.current)
                            MaterialTheme.colorScheme.onSecondaryContainer else Color(0xfff3d68f), animated = true)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("Задачи дня", style = MaterialTheme.typography.titleLarge)
                    Text(if (tasks.isEmpty()) "День свободен для нового замысла" else
                        "${tasks.count { it.done }} из ${tasks.size} выполнено",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Button(onClick = onCreate, modifier = Modifier.heightIn(min = 48.dp).testTag("create-task")) {
                    Text("Создать")
                }
            }
            if (tasks.isEmpty()) {
                Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), color = Color(0xfff2ead9)) {
                    Text("На сегодня задач нет. Можно оставить день свободным или создать задачу.",
                        Modifier.padding(14.dp), style = MaterialTheme.typography.bodyMedium)
                }
            } else tasks.forEach { task ->
                Surface(Modifier.fillMaxWidth().testTag("task-${task.id}"), shape = RoundedCornerShape(14.dp),
                    color = if (task.done) completedTaskSurface else if(LocalEveningTheme.current)
                        MaterialTheme.colorScheme.surfaceContainerLowest else Color(0xfff7f1e5),
                    contentColor = if (task.done) completedTaskInk else MaterialTheme.colorScheme.onSurface,
                    border = BorderStroke(1.dp, if (task.done) Color(0xffc8ccc6) else Color(0x44b28a4a))) {
                    Row(Modifier.fillMaxWidth().padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = task.done, onCheckedChange = { onComplete(task) },
                            colors = CheckboxDefaults.colors(checkedColor = completedTaskInk))
                        Column(Modifier.weight(1f).clickable { onOpen(task.id) }.padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            TaskTitle(task, Modifier.testTag("task-title-${task.id}"),
                                style = MaterialTheme.typography.titleMedium,occurrenceDate=LocalDate.parse(selected))
                            Text("$selected ${timeLabel(task.time, use24)} · Приоритет ${task.priority}" +
                                if (task.recurrence.enabled) " · Повторяется" else "",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                            task.projectId?.let { projectId ->
                                Text(structure.projects.firstOrNull { it.id == projectId }?.title
                                    ?: task.project.ifBlank { "Проект" },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (task.done) completedTaskInk else MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
            TodayMissedTasksCard(missedTasks, onComplete, onMoveToToday)
            habits()
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
    val localizedDescription = description?.let { genesisTranslate(it) }
    bitmap?.let { Image(it.asImageBitmap(),localizedDescription,
        if(LocalEveningTheme.current) modifier.alpha(.86f) else modifier,contentScale=ContentScale.Crop) }
}

@Composable
private fun DayHeader(date: LocalDate, mode: CalendarMode, detailsExpanded: Boolean,
    onToggleDetails: () -> Unit, onModeChange: (CalendarMode) -> Unit) {
    val calendar=remember { GenesisCalendar() }
    val solarLocation by rememberAutomaticSolarLocation(calendar.zoneId)
    val language = LocalGenesisLanguage.current
    val copy = remember(date,mode,language) { todayHeroCopy(date,mode,calendar,language) }
    val todayLabel = genesisTranslate("Сегодня").uppercase(Locale.forLanguageTag(language))
    val calendarSwitchHint = mobileCalendarCopy(language).switchHint
    var switchCount by remember { mutableIntStateOf(0) }
    val detailsArrowRotation by animateFloatAsState(if (detailsExpanded) 180f else 0f,
        tween(220, easing = CubicBezierEasing(.16f, 1f, .3f, 1f)), label = "day-details-arrow")
    Card(Modifier.fillMaxWidth().testTag("today-hero"), shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color(0x66dfc17e))) {
        Box(Modifier.fillMaxWidth().heightIn(min = if(mode==CalendarMode.PROFANE) 540.dp else 390.dp)) {
            OriginalImage(if (mode == CalendarMode.LUNAR) "genesis-hero.png" else copy.imagePath,
                copy.title, Modifier.matchParentSize().testTag(
                    if (mode == CalendarMode.LUNAR) "today-lunar-standard-image" else "today-calendar-image"))
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x22040e10),
                .32f to Color(0x44040e10), .62f to Color(0xc6071d20),
                1f to Color(0xfa071d20))))
            Surface(onClick = {
                switchCount++
                onModeChange(nextCalendarMode(mode))
            }, modifier = Modifier.align(Alignment.TopStart).padding(14.dp)
                .testTag("today-calendar-plaque")
                .semantics { contentDescription = "$todayLabel. $calendarSwitchHint" },
                color = Color(0xd0071d20), shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0x88dfc17e))) {
                Box {
                CalendarPlaqueWave(switchCount)
                Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CalendarModeSwitcher(mode, {}, size = 42.dp,
                        interactive = false, animationTrigger = switchCount)
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        androidx.compose.material3.Text(todayLabel,
                            color = Color(0xfffff5df), style = MaterialTheme.typography.headlineSmall)
                        Text(calendarSwitchHint,
                            color = Color(0xffdfc17e), style = MaterialTheme.typography.labelSmall)
                    }
                }
                }
            }
            copy.badge?.takeIf { mode != CalendarMode.LUNAR }?.let { badge ->
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
                Text(copy.month.uppercase(java.util.Locale.forLanguageTag(LocalGenesisLanguage.current)),
                    color = Color(0xfff0d49b), style = MaterialTheme.typography.labelLarge)
                Text(copy.title, color = Color(0xfff9f2e2), style = MaterialTheme.typography.headlineSmall)
                copy.subtitle?.let { Text(it, color = Color(0xfff1e5cb),
                    style = MaterialTheme.typography.titleMedium) }
                if (mode == CalendarMode.PROFANE) {
                    Text(gregorianYearPosition(date, language), Modifier.testTag("today-gregorian-year-position"),
                        color = Color(0xfff4deb0), style = MaterialTheme.typography.bodySmall)
                }
                Text(copy.description, Modifier.testTag("today-hero-description"),
                    color = Color(0xffeee6d7), style = MaterialTheme.typography.bodyMedium)
                copy.details.forEach { Text(it, color = Color(0xffeee6d7),
                    style = MaterialTheme.typography.bodySmall) }
                SunriseSunsetLine(date, solarLocation, calendar,
                    accent = Color(0xfff4deb0), textColor = Color(0xffd7dfd8))
                Text(copy.footerDate,
                    color = Color(0xffdfc17e), style = MaterialTheme.typography.labelMedium)
                copy.badge?.takeIf { mode == CalendarMode.LUNAR }?.let { badge ->
                    Surface(shape = RoundedCornerShape(100.dp), color = Color(0xc2071d20),
                        border = BorderStroke(1.dp, Color(0x88dfc17e))) {
                        Text(badge, Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            color = Color(0xfff5dcaa), style = MaterialTheme.typography.labelSmall)
                    }
                }
                Button(onClick = onToggleDetails,
                    modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp)
                        .testTag("today-day-details-toggle"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xe0193937),
                        contentColor = Color(0xffffe2a7)),
                    border = BorderStroke(1.dp, Color(0x99dfc17e)),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)) {
                    Text(genesisTranslate(if (detailsExpanded) "Скрыть подробности" else "Подробнее о дне"),
                        style = MaterialTheme.typography.labelLarge)
                    Spacer(Modifier.width(9.dp))
                    Canvas(Modifier.size(18.dp).graphicsLayer { rotationZ = detailsArrowRotation }) {
                        val stroke = 1.8.dp.toPx()
                        drawLine(Color(0xffffe2a7), Offset(size.width * .22f, size.height * .38f),
                            Offset(size.width * .5f, size.height * .66f), stroke, StrokeCap.Round)
                        drawLine(Color(0xffffe2a7), Offset(size.width * .5f, size.height * .66f),
                            Offset(size.width * .78f, size.height * .38f), stroke, StrokeCap.Round)
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskEditor(task:LocalTask?,selected:String,prefs:UiPreferences,structure:WorkspaceStructure,initialProjectId:String?,
    accountSettings:ru.genesis.calendar.auth.AccountSettings?, taskLists:List<GoogleTaskList>, initialTaskListId:String?, onDismiss:()->Unit,
    onSave:(LocalTask)->Unit,onDelete:(()->Unit)?,onDeleteOccurrence:((String)->Unit)?,showSelectedOccurrence:Boolean) {
    var title by rememberSaveable(task?.id) { mutableStateOf(task?.title ?: "") }
    var description by rememberSaveable(task?.id) { mutableStateOf(task?.description ?: "") }
    var date by rememberSaveable(task?.id) { mutableStateOf(task?.date ?: selected) }
    var formCalendarMode by rememberSaveable(task?.id) { mutableStateOf(prefs.input) }
    var time by rememberSaveable(task?.id) { mutableStateOf(task?.time ?: "") }
    var priority by rememberSaveable(task?.id) { mutableIntStateOf(task?.priority ?: 5) }
    var recurrence by remember(task?.id) { mutableStateOf(task?.recurrence ?: defaultTaskRecurrence(task?.date ?: selected, prefs.input)) }
    var projectId by rememberSaveable(task?.id,initialProjectId) { mutableStateOf(task?.projectId ?: initialProjectId) }
    var listId by rememberSaveable(task?.id,initialTaskListId) { mutableStateOf(task?.taskListId() ?: initialTaskListId) }
    val selectedList = taskLists.firstOrNull { it.id==listId }
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
    var absoluteCalendarMode by rememberSaveable(task?.id) { mutableStateOf(prefs.input) }
    val yandex = accountSettings?.authProvider == "yandex"
    val yandexFields = remember(task?.id) { JSONObject(task?.sourceFieldsJson ?: "{}") }
    var yandexEntryType by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("yandexEntryType", "task")) }
    var yandexEndDate by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("endDate").takeIf { it.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) } ?: date) }
    var yandexEndTime by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("yandexEndTime")) }
    var yandexLocation by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("yandexLocation")) }
    var yandexTelemost by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("yandexTelemostUrl")) }
    var yandexAttendees by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optJSONArray("yandexAttendees")?.let { rows ->
        (0 until rows.length()).joinToString(", ") { rows.optString(it) } } ?: "") }
    var yandexOptionalAttendees by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optJSONArray("yandexOptionalAttendees")?.let { rows ->
        (0 until rows.length()).joinToString(", ") { rows.optString(it) } } ?: "") }
    var yandexBusy by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optBoolean("yandexBusy", true)) }
    var yandexVisibility by rememberSaveable(task?.id) { mutableStateOf(yandexFields.optString("yandexVisibility", "private")) }
    var yandexReminders by remember(task?.id) { mutableStateOf<List<Int>>(yandexFields.optJSONArray("yandexReminders")?.let { rows ->
        (0 until rows.length()).map { rows.optInt(it) } } ?: emptyList()) }
    val googleTaskBacked = accountSettings?.authProvider != "yandex" && (listId!=null || task?.sourceFieldsJson?.let { raw ->
        runCatching { JSONObject(raw).optString("googleTaskId") }.getOrNull()?.let {
            it.isNotBlank() && it != "null"
        } ?: false
    } ?: false)
    var confirmDelete by remember { mutableStateOf(false) }
    var validation by remember { mutableStateOf<String?>(null) }
    val occurrenceDate = if (task?.recurrence?.enabled == true && showSelectedOccurrence &&
        runCatching { TaskOccurrences.occursOn(task,LocalDate.parse(selected)) }.getOrDefault(false)) selected
        else task?.date ?: selected
    Dialog(onDismissRequest=onDismiss,properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.widthIn(max = 840.dp).fillMaxWidth().padding(12.dp),shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(16.dp).imePadding()) {
                EditorDialogHeader(if (yandex) (if(task==null) "Новая запись Яндекс.Календаря" else "Изменить запись Яндекс.Календаря")
                    else if(task==null) "Новая задача" else "Изменить задачу",
                    "close-task-editor", onDismiss)
              Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())
                .testTag("task-editor-scroll"),
                verticalArrangement=Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title,{title=it},label={Text("Название")},modifier=Modifier.fillMaxWidth().testTag("task-title"))
                OutlinedTextField(description,{description=it},label={Text("Описание")},modifier=Modifier.fillMaxWidth())
                if (yandex) {
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        FilterChip(yandexEntryType=="task", { yandexEntryType="task" }, label={Text("Задача")})
                        FilterChip(yandexEntryType=="meeting", { yandexEntryType="meeting" }, label={Text("Встреча")})
                    }
                }
                ProjectHierarchyPicker(structure.projects, projectId) { projectId = it }
                if(taskLists.isNotEmpty() && task==null) {
                    var choosingList by remember { mutableStateOf(false) }
                    Box {
                        OutlinedButton({choosingList=true},Modifier.fillMaxWidth().testTag("task-list-picker")) {
                            Text(selectedList?.title ?: if (accountSettings?.authProvider == "yandex") "Без списка GENESIS" else "Без списка Google Tasks")
                        }
                        DropdownMenu(choosingList,{choosingList=false}) {
                            DropdownMenuItem(text={Text(if (accountSettings?.authProvider == "yandex") "Без списка GENESIS" else "Без списка Google Tasks")},onClick={listId=null;choosingList=false})
                            taskLists.forEach { list -> DropdownMenuItem(text={Text(list.title)},onClick={
                                listId=list.id
                                if (accountSettings?.authProvider != "yandex") { reminders=emptyList();customReminder=false }
                                if (accountSettings?.authProvider != "yandex") recurrence=recurrence.copy(enabled=false)
                                choosingList=false
                                projectId=structure.taskListLinks.firstOrNull{it.taskListId==list.id}?.projectId
                            }) }
                        }
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
                EditorCalendarModePicker(formCalendarMode, { formCalendarMode=it }, tag="task-form-calendar")
                Text("Дата задачи · ${calendarModeLabel(formCalendarMode)}")
                AuthorDatePicker(date,formCalendarMode){date=it}
                if (yandex) Row(verticalAlignment=Alignment.CenterVertically) {
                    Checkbox(checked=time.isBlank(),onCheckedChange={ allDay ->
                        time=if(allDay) "" else "09:00"
                        yandexEndTime=if(allDay) "" else "09:30"
                    })
                    Text("Весь день")
                }
                if (!yandex || time.isNotBlank()) AuthorTimePicker(time,prefs.use24){time=it}
                if (yandex) {
                    if (yandexEntryType == "meeting") {
                        Text("Окончание встречи")
                        AuthorDatePicker(yandexEndDate, formCalendarMode) { yandexEndDate=it }
                        if (time.isNotBlank()) AuthorTimePicker(yandexEndTime, prefs.use24) { yandexEndTime=it }
                        OutlinedTextField(yandexAttendees,{yandexAttendees=it},label={Text("Участники · адреса через запятую")},modifier=Modifier.fillMaxWidth())
                        OutlinedTextField(yandexOptionalAttendees,{yandexOptionalAttendees=it},label={Text("Необязательные участники")},modifier=Modifier.fillMaxWidth())
                        OutlinedTextField(yandexLocation,{yandexLocation=it},label={Text("Место")},modifier=Modifier.fillMaxWidth())
                        OutlinedTextField(yandexTelemost,{yandexTelemost=it},label={Text("Ссылка на Телемост")},modifier=Modifier.fillMaxWidth())
                    }
                    Text("Занятость")
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        FilterChip(yandexBusy,{yandexBusy=true},label={Text("Занят")})
                        FilterChip(!yandexBusy,{yandexBusy=false},label={Text("Свободен")})
                    }
                    Text("Видимость")
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        FilterChip(yandexVisibility=="private",{yandexVisibility="private"},label={Text("Только участники")})
                        FilterChip(yandexVisibility=="public",{yandexVisibility="public"},label={Text("Все")})
                    }
                    Text("Напоминания Яндекс.Календаря",style=MaterialTheme.typography.titleMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        listOf(0 to "В момент",10 to "10 мин",30 to "30 мин",60 to "1 час",1440 to "1 день").forEach { (minutes,label) ->
                            FilterChip(minutes in yandexReminders,{ yandexReminders=if(minutes in yandexReminders)
                                yandexReminders.filterNot { it==minutes } else (yandexReminders+minutes).take(5) },label={Text(label)})
                        }
                    }
                    Text("Выбранные даты преобразуются в григорианские по часовому поясу устройства.",style=MaterialTheme.typography.bodySmall)
                }
                PriorityControl(priority){priority=it}
                if(task?.recurrence?.enabled==true) Text(
                    "Сохранение изменит всю серию. При удалении можно выбрать только $occurrenceDate.",
                    style=MaterialTheme.typography.bodySmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
                val occurrenceCount = if(googleTaskBacked) 1 else TaskRecurrenceEditor(recurrence,date,prefs.input) { recurrence=it;validation=null }
                Text((if (yandex) "Дополнительные напоминания GENESIS" else "Напомнить") + " · ${reminders.size}/5",style=MaterialTheme.typography.titleMedium)
                Text(if (yandex) "Эти напоминания показываются самим GENESIS на устройстве; настройки выше отправляются в Яндекс.Календарь."
                    else "Число показывает, сколько напоминаний добавлено. Для события Google Calendar доступно не более пяти.",
                    style=MaterialTheme.typography.bodySmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
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
                OutlinedButton(enabled=customReminder || (!googleTaskBacked && reminders.size<5),
                    onClick={customReminder=!customReminder},
                    modifier=Modifier.testTag("custom-reminder-toggle")) {
                    Text(if(customReminder) "Свернуть" else "+ Своё напоминание")
                }
                if(customReminder && !googleTaskBacked) {
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
                        EditorCalendarModePicker(absoluteCalendarMode,
                            { absoluteCalendarMode=it }, tag="reminder-form-calendar")
                        Text("Дата напоминания · ${calendarModeLabel(absoluteCalendarMode)}")
                        AuthorDatePicker(absoluteDate,absoluteCalendarMode){absoluteDate=it}
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
                            yandex && yandexEntryType == "meeting" && time.isNotBlank() &&
                                (runCatching { LocalDateTime.parse("${yandexEndDate}T${yandexEndTime}") }.getOrNull()
                                    ?.isAfter(runCatching { LocalDateTime.parse("${date}T${time}") }.getOrNull()) != true) ->
                                "Окончание встречи должно быть позже её начала."
                            yandex && yandexEntryType == "meeting" && yandexEndDate < date ->
                                "Окончание встречи должно быть позже её начала."
                            yandex && yandexEntryType == "meeting" &&
                                (yandexAttendees + "," + yandexOptionalAttendees).split(',', ';', '\n')
                                    .map(String::trim).filter(String::isNotBlank).any { !android.util.Patterns.EMAIL_ADDRESS.matcher(it).matches() } ->
                                "Проверьте адреса участников встречи."
                            yandex && yandexTelemost.isNotBlank() &&
                                !Regex("https://telemost\\.yandex\\.[a-z.]+/[A-Za-z0-9/_?=&%-]+").matches(yandexTelemost.trim()) ->
                                "Укажите корректную ссылку Яндекс Телемоста."
                            recurrence.enabled && (end == null || end < start || end > start.plusYears(5).minusDays(1)) ->
                                "Период повторения — от даты задачи до пяти лет."
                            recurrence.enabled && occurrenceCount !in 1..500 ->
                                "Серия должна содержать от 1 до 500 повторений."
                            else -> null
                        }
                        val source = JSONObject(task?.sourceFieldsJson ?: "{}")
                        if (yandex) {
                            source.put("yandexEntryType", yandexEntryType)
                                .put("yandexEndTime", yandexEndTime).put("yandexLocation", yandexLocation.trim())
                                .put("yandexTelemostUrl", yandexTelemost.trim())
                                .put("yandexBusy", yandexBusy).put("yandexVisibility", yandexVisibility)
                                .put("yandexReminders", JSONArray(yandexReminders))
                                .put("yandexAttendees", JSONArray(yandexAttendees.split(',', ';', '\n').map(String::trim).filter(String::isNotBlank)))
                                .put("yandexOptionalAttendees", JSONArray(yandexOptionalAttendees.split(',', ';', '\n').map(String::trim).filter(String::isNotBlank)))
                                .put("dueDate", date).put("endDate", if (yandexEntryType == "meeting") yandexEndDate else date)
                        }
                        if(task==null && selectedList!=null) {
                            val listFields=listTaskFields(selectedList,prefs.input)
                            listFields.keys().forEach { field -> source.put(field,listFields.get(field)) }
                        } else if(routing?.mode=="choose" && accountSettings?.multiAccountEnabled==true && accountSettings.accounts.size>1)
                            source.put("syncAccountIds",JSONArray(syncTargets))
                        else if(task==null || task.categoryId!=structure.projects.firstOrNull{it.id==projectId}?.categoryId)
                            source.remove("syncAccountIds")
                        if (validation == null) onSave((task ?: LocalTask(title=title)).copy(title=title.trim(),description=description,date=date,time=time,priority=priority,
                            reminderAt=reminders.firstOrNull{it.kind=="absolute"}?.at,reminders=reminders,
                            projectId=projectId,categoryId=structure.projects.firstOrNull{it.id==projectId}?.categoryId,
                            recurrence=if (recurrence.enabled && !googleTaskBacked) RecurrenceEngine(GenesisCalendar()).resolve(date,recurrence.copy(rangeStart=date))
                                else recurrence.copy(enabled=false,rangeStart="",rangeEnd=""),
                            recurrenceExcludedDates=if(recurrence.enabled) task?.recurrenceExcludedDates ?: emptyList() else emptyList(),
                            sourceFieldsJson=source.toString()))
                    },modifier=Modifier.testTag("save-task")){Text("Сохранить")}
                }
                onDelete?.let { TextButton(onClick={confirmDelete=true}){Text("Удалить задачу")} }
              }
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

private fun projectPath(projects: List<GenesisProject>, selectedId: String?): List<GenesisProject> {
    val byId = projects.associateBy { it.id }
    val result = mutableListOf<GenesisProject>()
    val visited = mutableSetOf<String>()
    var cursor = selectedId?.let(byId::get)
    while (cursor != null && visited.add(cursor.id)) {
        result += cursor
        cursor = cursor.parentId?.let(byId::get)
    }
    return result.asReversed()
}

@Composable
internal fun ProjectHierarchyPicker(projects: List<GenesisProject>, selectedId: String?,
    onSelect: (String?) -> Unit) {
    val sorted = remember(projects) {
        projects.groupBy { it.parentId }.mapValues { (_, values) ->
            values.sortedWith(compareBy<GenesisProject> { it.position }.thenBy { it.title })
        }
    }
    val path = remember(projects, selectedId) { projectPath(projects, selectedId) }
    Text("Проект", style = MaterialTheme.typography.titleMedium)
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        FilterChip(selected = selectedId == null || selectedId == "__genesis_inbox__",
            onClick = { onSelect(null) }, label = { Text("Хаос-бокс") })
        sorted[null].orEmpty().forEach { project ->
            FilterChip(selected = selectedId == project.id, onClick = { onSelect(project.id) },
                label = { Text(project.title) })
        }
    }
    path.forEachIndexed { depth, parent ->
        val children = sorted[parent.id].orEmpty()
        if (children.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (depth == 0) "Подпроекты «${parent.title}»" else "Следующий уровень «${parent.title}»",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    children.forEach { child ->
                        FilterChip(selected = selectedId == child.id, onClick = { onSelect(child.id) },
                            label = { Text(child.title) })
                    }
                }
            }
        }
    }
    if (path.isNotEmpty()) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(12.dp)) {
            Text("Выбрано: ${path.joinToString(" › ") { it.title }}",
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
private fun SettingsScreen(app:GenesisApplication,prefs:UiPreferences,sharedBusy:Boolean,
    canOpenAdmin: Boolean, adminLoad: suspend () -> JSONObject,
    adminDelete: suspend (String, Boolean) -> JSONObject,
    onSet:(String,String)->Unit, onSetLocal:(String,String)->Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    var calendarReference by rememberSaveable { mutableStateOf<String?>(null) }
    var adminOpen by rememberSaveable { mutableStateOf(false) }
    var releaseNotesOpen by rememberSaveable { mutableStateOf(false) }
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){refresh++}
    val scope=rememberCoroutineScope()
    val habits = remember(app, app.workspaceScope) { HabitsRepository(app) }
    val workspace by habits.workspace.collectAsStateWithLifecycle(LocalHabitWorkspace())
    val rows by produceState(emptyList<ReminderRecord>(),refresh) { value=withContext(Dispatchers.IO){app.database.dao().reminders(app.workspaceScope)} }
    val notificationsAllowed = rememberNotificationsAllowed(app)
    val batteryUnrestricted = app.scheduler.batteryOptimizationsIgnored()
    val diagnosticScheduledAt = app.scheduler.lastDiagnosticScheduledAt()
    val diagnosticDeliveredAt = app.scheduler.lastDiagnosticDeliveredAt()
    val futureTaskAlarms = rows.count { it.state == "pending" && it.at > System.currentTimeMillis() }
    fun diagnosticTime(value: Long) = Instant.ofEpochMilli(value).atZone(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("dd.MM HH:mm"))
    AdaptiveSettingsSections {
        GenesisPageHeader(if (prefs.language == "en") "Settings" else "Настройки",
            if (prefs.language == "en") "Calendars, time, privacy and reminders"
            else "Календарь, время, приватность и напоминания", "⚙")
        AndroidUpdateBanner()
        AppearancePanel(app, workspace, prefs.use24)
        SeasonRegionSettings(prefs, onSetLocal)
        SolarPlaceSettings()
        SettingsSection("☷", "Отображение меню", "Кнопки телефона, альбомного режима и планшета",
            Color(0xffe9ede5)) {
            Text("Кнопки меню первого уровня", style = MaterialTheme.typography.titleSmall)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !prefs.navigationLabels,
                    onClick = { onSetLocal("navigationLabels", "icons") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("navigation-icons-only"),
                    leadingIcon = { GenesisVectorIcon(GenesisPageIcon.TODAY, Modifier.size(20.dp)) },
                    label = { Text("Иконки") })
                FilterChip(selected = prefs.navigationLabels,
                    onClick = { onSetLocal("navigationLabels", "text") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("navigation-with-text"),
                    label = { Text("С текстом") })
            }
            AnimatedVisibility(prefs.navigationLabels) {
                Row(Modifier.fillMaxWidth().testTag("navigation-auto-scroll-setting"),
                    verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Автопрокрутка в портретном режиме", style = MaterialTheme.typography.titleSmall)
                        Text("Медленное движение справа налево; удержание пальцем ставит его на паузу.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = prefs.navigationAutoScroll,
                        onCheckedChange = { onSetLocal("navigationAutoScroll", it.toString()) },
                        modifier = Modifier.testTag("navigation-auto-scroll"))
                }
            }
            Text("Расположение меню первого уровня", style = MaterialTheme.typography.titleSmall)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = prefs.wideNavigationOnLeft,
                    onClick = { onSetLocal("wideNavigation", "left") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("wide-navigation-left"),
                    label = { Text("Слева") })
                FilterChip(selected = !prefs.wideNavigationOnLeft,
                    onClick = { onSetLocal("wideNavigation", "top") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("wide-navigation-top"),
                    label = { Text("Сверху") })
            }
            Text("Настройка применяется автоматически при повороте экрана и на планшете.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Переход между вкладками в портретном режиме",
                style = MaterialTheme.typography.titleSmall)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !prefs.menuSwipeEnabled,
                    onClick = { onSetLocal("menuSwipeEnabled", "false") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("menu-swipe-off"),
                    label = { Text("Кнопки меню") })
                FilterChip(selected = prefs.menuSwipeEnabled,
                    onClick = { onSetLocal("menuSwipeEnabled", "true") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("menu-swipe-on"),
                    label = { Text("Общий свайп") })
            }
            Text("Смахивайте содержимое экрана влево или вправо для перехода между разделами.",
                style = MaterialTheme.typography.bodySmall)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = prefs.menuSwipeSubmenus, enabled = prefs.menuSwipeEnabled,
                    onCheckedChange = { onSetLocal("menuSwipeSubmenus", it.toString()) },
                    modifier = Modifier.testTag("menu-swipe-submenus"))
                Text("Включать подменю в общий свайп", style = MaterialTheme.typography.bodyMedium)
            }
            Text("При общем свайпе месяцы и годы переключаются стрелками.",
                style = MaterialTheme.typography.bodySmall)
        }
        SettingsSection("◉", "Календари и время", "Отображение не меняет календарь ввода и повторений",
            Color(0xffe4efed), modifier = Modifier.testTag("calendar-settings-section")) {
            Text("Справочная информация", style = MaterialTheme.typography.titleSmall)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(CalendarMode.PROFANE to "Григорианский", CalendarMode.SACRED to "Сакральный",
                    CalendarMode.LUNAR to "Лунный").forEach { (mode, label) ->
                    val accent = when (mode) {
                        CalendarMode.PROFANE -> if (LocalEveningTheme.current) Color(0xff73b8aa) else Color(0xff2d7065)
                        CalendarMode.SACRED -> if (LocalEveningTheme.current) Color(0xffe4bd64) else Color(0xff92621d)
                        CalendarMode.LUNAR -> if (LocalEveningTheme.current) Color(0xffb6a5df) else Color(0xff68539d)
                    }
                    OutlinedButton(onClick = { calendarReference = mode.wireValue },
                        modifier = Modifier.weight(1f).heightIn(min = 52.dp)
                            .testTag("calendar-reference-${mode.wireValue}"),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = accent.copy(alpha = if (LocalEveningTheme.current) .16f else .12f),
                            contentColor = MaterialTheme.colorScheme.onSurface),
                        border = BorderStroke(1.dp, accent.copy(alpha = .82f)),
                        contentPadding = PaddingValues(horizontal = 3.dp, vertical = 7.dp)) {
                        CompactChoiceLabel(label)
                    }
                }
            }
            listOf("display" to "Календарь отображения","input" to "Календарь ввода и повторений").forEach{(key,label)->
                Text(label, style = MaterialTheme.typography.titleSmall)
                Row(Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) { CalendarMode.entries.forEach { mode->
                    FilterChip(selected=(if(key=="display") prefs.display else prefs.input)==mode,onClick={onSet(key,mode.wireValue)},
                        enabled=!sharedBusy,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                            .testTag("$key-calendar-${mode.wireValue}"),
                        label={CompactChoiceLabel(when(mode){CalendarMode.SACRED->"Сакральный";CalendarMode.LUNAR->"Лунный";else->"Григорианский"})})
                } }
            }
            AnimatedVisibility(prefs.display == CalendarMode.PROFANE) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.testTag("gregorian-week-start-setting")) {
                    Text(genesisTranslate("Начало недели"), style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !prefs.weekStartsOnSunday,
                            onClick = { onSet("weekStart", "monday") },
                            enabled = !sharedBusy,
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                .testTag("week-start-monday"),
                            label = { Text(genesisTranslate("Понедельник")) })
                        FilterChip(selected = prefs.weekStartsOnSunday,
                            onClick = { onSet("weekStart", "sunday") },
                            enabled = !sharedBusy,
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                .testTag("week-start-sunday"),
                            label = { Text(genesisTranslate("Воскресенье")) })
                    }
                    Text("Начало григорианского года", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !prefs.gregorianYearStartsInMarch,
                            onClick = { onSet("gregorianYearStart", "january") }, enabled = !sharedBusy,
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("year-start-january"),
                            label = { Text("С января") })
                        FilterChip(selected = prefs.gregorianYearStartsInMarch,
                            onClick = { onSet("gregorianYearStart", "march") }, enabled = !sharedBusy,
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("year-start-march"),
                            label = { Text("С марта") })
                    }
                    Text("Март был первым месяцем древнеримского года: сентябрь означал «седьмой», октябрь — «восьмой». Январь назван в честь Януса, божества начал и переходов.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Фон сезонов", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !prefs.regionalSeasonArt,
                            onClick = { onSetLocal("seasonArtMode", "static") },
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("season-art-static"),
                            label = { Text("Статичные") })
                        FilterChip(selected = prefs.regionalSeasonArt,
                            onClick = { onSetLocal("seasonArtMode", "regional") },
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("season-art-regional"),
                            label = { Text("По региону") })
                    }
                    Text("Выберите источник региона в разделе «Регион» выше. Для Южного полушария времена года и цвета меняются местами.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text("Формат времени", style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("24h","12h").forEach {
                FilterChip(selected=prefs.use24==(it=="24h"),onClick={onSet("time",it)},
                    enabled=!sharedBusy,label={Text(it)})
            } }
        }
        SettingsSection("Σ", "Стойхейон", "Управление картами без отключения алфавита",
            Color(0xffeee9f4)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Гадания по картам",style=MaterialTheme.typography.titleMedium)
                    Text("Карты дня и расклад можно скрыть; буквы и значения останутся доступны.",
                        style=MaterialTheme.typography.bodySmall,color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked=!prefs.divinationDisabled,
                    onCheckedChange={onSet("stoicheionDivinationDisabled",(!it).toString())},
                    enabled=!sharedBusy,
                    modifier=Modifier.testTag("stoicheion-divination-setting"))
            }
        }
        HabitSettingsPanel(app, prefs.use24)
        SettingsSection("!", "Пропущенные задачи", "Напоминание внутри раздела «Сегодня»",
            Color(0xffffebe4)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Напоминать о пропущенных задачах", style = MaterialTheme.typography.titleSmall)
                    Text("Показывать невыполненные задачи прошлых дней с возможностью перенести их на сегодня.",
                        style = MaterialTheme.typography.bodySmall)
                }
                Switch(checked = prefs.showMissedTasksToday,
                    onCheckedChange = { onSetLocal("showMissedTasksToday", it.toString()) },
                    modifier = Modifier.testTag("show-missed-tasks-today"))
            }
        }
        MoonReminderSettings(app, prefs, onSetLocal)
        SettingsSection("◷", "Системные напоминания", "Проверка разрешений и точности Android",
            Color(0xfffff1cf)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SettingsStatusTile("Уведомления", if(notificationsAllowed) "Включены" else "Выключены",
                    notificationsAllowed, Modifier.weight(1f))
                SettingsStatusTile("Доставка", if(app.scheduler.exactAllowed()) "Точная" else "Приблизительная",
                    app.scheduler.exactAllowed(), Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SettingsStatusTile("Резерв", "${app.scheduler.scheduledHabitAlarmCount() + futureTaskAlarms} событий",
                    notificationsAllowed, Modifier.weight(1f))
                SettingsStatusTile("Батарея", if(batteryUnrestricted) "Без оптимизации" else "Системный режим",
                    batteryUnrestricted, Modifier.weight(1f))
            }
            Text("Каналы: задачи · ${if(app.scheduler.channelAllowed()) "включён" else "выключен"}; привычки · ${if(app.scheduler.channelAllowed(ru.genesis.calendar.reminders.ReminderScheduler.HABIT_CHANNEL)) "включены" else "выключены"}",
                style = MaterialTheme.typography.bodyMedium)
            Button(onClick={
                if(Build.VERSION.SDK_INT>=33 && !app.scheduler.notificationsAllowed()) request.launch(Manifest.permission.POST_NOTIFICATIONS)
                else app.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,app.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)){Text("Настроить уведомления")}
            if(Build.VERSION.SDK_INT in 31..32 && !app.scheduler.exactAllowed()) OutlinedButton(onClick={
                app.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${app.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)){Text("Точное время напоминаний")}
            if(Build.VERSION.SDK_INT>=33 && !app.scheduler.exactAllowed())
                Text("Android может задерживать сигналы. Проверьте разрешения GENESIS в настройках устройства.",
                    style=MaterialTheme.typography.bodySmall,color = Color(0xff7a5521))
            Text("Точные системные сигналы дополнены резервной доставкой WorkManager. После перезагрузки, обновления и возврата из настроек расписание восстанавливается автоматически.",
                style = MaterialTheme.typography.bodySmall)
            app.scheduler.lastRecoveryAt().takeIf { it > 0 }?.let {
                Text("Последнее восстановление расписания · ${diagnosticTime(it)}",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.testTag("notification-last-recovery"))
            }
            OutlinedButton(onClick={scope.launch{app.scheduler.restore(recoverOverdue = true);app.scheduler.restoreHabitNotifications();refresh++}},
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)){Text("Проверить расписание")}
            OutlinedButton(onClick={app.scheduler.scheduleDiagnosticNotification();refresh++},
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("notification-diagnostic-schedule")) {
                Text("Проверить уведомление через 1 минуту")
            }
            if (diagnosticScheduledAt > 0) {
                Text(if (diagnosticDeliveredAt >= diagnosticScheduledAt)
                    "Последняя проверка доставлена · ${diagnosticTime(diagnosticDeliveredAt)}"
                else "Проверка назначена · ${diagnosticTime(diagnosticScheduledAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (diagnosticDeliveredAt >= diagnosticScheduledAt) Color(0xff255b59) else Color(0xff7a5521),
                    modifier = Modifier.testTag("notification-diagnostic-status"))
            }
            OutlinedButton(onClick={app.startActivity(appBatterySettingsIntent(app.packageName))},
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("notification-battery-settings")) {
                Text("Открыть системные настройки батареи")
            }
            samsungNeverSleepingAppsIntent()?.let { samsungIntent ->
                OutlinedButton(onClick={
                    if (runCatching { app.startActivity(samsungIntent); true }.getOrDefault(false).not())
                        app.startActivity(appBatterySettingsIntent(app.packageName))
                }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    .testTag("notification-samsung-never-sleeping")) {
                    Text("Samsung: никогда не спящие приложения")
                }
                Text("One UI может снова перенести редко используемое приложение в сон. После обновления Samsung проверьте, что GENESIS остаётся в списке «Никогда не спящие приложения».",
                    style = MaterialTheme.typography.bodySmall)
            }
            Text("Принудительную остановку приложения Android не разрешает обходить. После неё откройте GENESIS один раз — расписание восстановится.",
                style = MaterialTheme.typography.bodySmall)
            rows.sortedBy{it.at}.takeLast(8).forEach{Text("Напоминание · ${it.state} · ${Instant.ofEpochMilli(it.at).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd.MM HH:mm"))}",style=MaterialTheme.typography.bodySmall)}
        }
        SettingsSection("G", "Аккаунт GENESIS", "Вход, синхронизация и связанные Google-аккаунты",
            Color(0xfff4e8df)) {
            ru.genesis.calendar.auth.AuthPanel(app, prefs.language) { onSet("language", it) }
            if (canOpenAdmin) OutlinedButton(onClick = { adminOpen = true },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("open-native-admin")) {
                Text("Админ-панель")
            }
        }
        SettingsSection("↗", "Ссылки GENESIS", "Академия, поддержка и веб-версия",
            Color(0xfffff5df)) {
            ru.genesis.calendar.auth.GenesisLinksPanel()
        }
        TextButton(onClick = { releaseNotesOpen = true },
            modifier = Modifier.fillMaxWidth().testTag("open-release-notes")) {
            Text("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · ${releaseNotesTitle()}",
                style = MaterialTheme.typography.labelSmall)
        }
    }
    calendarReference?.let { value ->
        CalendarReferenceDialog(CalendarMode.fromWire(value)) { calendarReference = null }
    }
    if (adminOpen && canOpenAdmin) NativeAdminPanel(onClose = { adminOpen = false },
        load = adminLoad, deleteUser = adminDelete)
    if (releaseNotesOpen) ReleaseNotesDialog { releaseNotesOpen = false }
}

@Composable
internal fun SettingsSection(symbol: String, title: String, subtitle: String, color: Color,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit) {
    Card(modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = eveningSurface(color)),
        border = BorderStroke(1.dp, Color(0x55b28a4a))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(Modifier.size(46.dp).clearAndSetSemantics { }, shape = RoundedCornerShape(14.dp), color = Color(0xff123b36)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(symbol, color = Color(0xffffe4a6), style = MaterialTheme.typography.titleLarge)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge,
                        color = Color(0xff132426))
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Color(0xff596665))
                }
            }
            HorizontalDivider(color = Color(0x33b28a4a))
            content()
        }
    }
}

@Composable
private fun SettingsStatusTile(label: String, value: String, active: Boolean, modifier: Modifier = Modifier) {
    val accessibleLabel = genesisTranslate(label)
    val accessibleValue = genesisTranslate(value)
    val accessibleState = genesisTranslate(if (active) "Работает" else "Требует внимания")
    Surface(modifier.semantics(mergeDescendants = true) {
        contentDescription = "$accessibleLabel: $accessibleValue"
        stateDescription = accessibleState
    }, shape = RoundedCornerShape(14.dp),
        color = if(active) Color(0xffe4efe9) else Color(0xffffe0d6),
        border = BorderStroke(1.dp, if(active) Color(0x66255b59) else Color(0x66a5543f))) {
        Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(if(active) "✓" else "!", color = if(active) Color(0xff255b59) else Color(0xffa5543f),
                style = MaterialTheme.typography.titleMedium)
            Text(label, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleSmall)
        }
    }
}
