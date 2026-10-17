package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.window.Dialog
import java.util.UUID
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlin.math.roundToInt
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.auth.AccountSettings
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.data.*

private const val inboxDropId = "__genesis_inbox__"

@Composable private fun categoryAccent(value: String): Color {
    val original=runCatching { android.graphics.Color.parseColor(value) }.getOrDefault(0xff2d6c68.toInt())
    if(!LocalEveningTheme.current) return Color(original)
    val hsv=FloatArray(3)
    android.graphics.Color.colorToHSV(original,hsv)
    hsv[2]=(hsv[2]+.22f).coerceAtMost(.95f)
    return Color(android.graphics.Color.HSVToColor(hsv))
}

internal fun russianCount(value: Int, one: String, few: String, many: String): String =
    if (value % 100 in 11..14) many else when (value % 10) {
        1 -> one
        in 2..4 -> few
        else -> many
    }

internal fun projectTreeLabel(title: String, depth: Int): String =
    if (depth > 0) "— $title" else title

internal fun projectHierarchyLabel(title: String, depth: Int): String =
    if (depth > 0) "${"  ".repeat(depth - 1)}↳ $title" else title

internal fun projectBreadcrumb(projects: List<GenesisProject>, projectId: String?): String {
    val byId = projects.associateBy { it.id }
    val path = mutableListOf<String>()
    val visited = mutableSetOf<String>()
    var cursor = projectId?.let(byId::get)
    while (cursor != null && visited.add(cursor.id)) {
        path += cursor.title
        cursor = cursor.parentId?.let(byId::get)
    }
    return path.asReversed().joinToString(" › ")
}

private data class TaskPickup(val id: String, val title: String, val originId: String?, val position: Offset)

@Composable
private fun TaskDragHandle(task: LocalTask) {
    val ink = MaterialTheme.colorScheme.primary
    val dragDescription = genesisTranslate("Ручка переноса задачи ${task.title}")
    Surface(
        modifier = Modifier.size(48.dp)
            .semantics { contentDescription = dragDescription },
        shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.primaryContainer
    ) {
        Box(contentAlignment = Alignment.Center) {
            Canvas(Modifier.size(22.dp)) {
                for (column in 0..1) for (row in 0..2)
                    drawCircle(ink, radius = 2.dp.toPx(),
                        center = Offset(size.width * (0.35f + column * 0.3f), size.height * (0.25f + row * 0.25f)))
            }
        }
    }
}

@Composable
private fun ProjectTaskDeleteButton(task: LocalTask, onClick: () -> Unit) {
    val action = genesisTranslate("Удалить задачу")
    IconButton(onClick = onClick, modifier = Modifier.size(48.dp)
        .testTag("project-delete-task-${task.id}")
        .semantics { contentDescription = "$action ${task.title}" }) {
        Text("×", style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.error)
    }
}

/** Pick-up-and-move stays inside the Projects workspace and gives the finger a visible task preview. */
@Composable
private fun DraggableTaskRow(task: LocalTask, pickedUp: Boolean,
    onStart: (LocalTask, Offset) -> Unit, onMove: (Offset) -> Unit, onFinish: (Boolean) -> Unit,
    content: @Composable RowScope.() -> Unit) {
    var bounds by remember(task.id) { mutableStateOf(Rect.Zero) }
    val start by rememberUpdatedState(onStart)
    val move by rememberUpdatedState(onMove)
    val finish by rememberUpdatedState(onFinish)
    val haptics = LocalHapticFeedback.current
    val dragDescription = genesisTranslate("Удерживайте задачу ${task.title} и перетащите в проект")
    Row(Modifier.fillMaxWidth().testTag("drag-task-${task.id}")
        .semantics { contentDescription = dragDescription }
        .onGloballyPositioned { bounds = it.boundsInRoot() }
        .pointerInput(task.id) {
            detectDragGesturesAfterLongPress(
                onDragStart = { offset ->
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    start(task, bounds.topLeft + offset)
                },
                onDrag = { change, delta -> change.consume(); move(delta) },
                onDragEnd = { finish(false) },
                onDragCancel = { finish(true) }
            )
        }
        .background(if (pickedUp) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
        .graphicsLayer { alpha = if (pickedUp) .48f else 1f },
        verticalAlignment = Alignment.CenterVertically, content = content)
}

/** One native screen adapted from the web Projects workspace. Standart uses its existing Material roles. */
@Composable
internal fun ProjectsScreen(app: GenesisApplication, tasks: List<LocalTask>, experimental: Boolean,
    onOpenTask: (String) -> Unit, onCreateTask: (String?) -> Unit,
    taskLists: List<GoogleTaskList> = emptyList(),
    onDeleteTask: (LocalTask) -> Unit = {}, onCompleteTask: (LocalTask) -> Unit = {},
    onCreateList: () -> Unit = {}, onCreateListTask: (GoogleTaskList) -> Unit = {},
    onUpdateList: suspend (GoogleTaskList, String) -> Unit = { _, _ -> },
    onDeleteList: suspend (GoogleTaskList) -> Unit = {}, use24: Boolean = true,
    initialListId: String? = null, onInitialListConsumed: () -> Unit = {},
    menuSwipeState: MenuSwipeState? = null, voiceRequest: NativeVoiceAction? = null,
    onVoiceRequestConsumed: () -> Unit = {},
    sharedController: AuthController? = null, sharedAccount: AccountSettings? = null,
    onMindmaps: (String?)->Unit = {}, initialProjectId:String?=null,onInitialProjectConsumed:()->Unit={}) {
    val repo = remember(app) { WorkspaceStructureRepository(app) }
    val loadedStructure by produceState<WorkspaceStructure?>(null, repo) {
        repo.workspace.collect { value = it }
    }
    if (loadedStructure == null) {
        Box(Modifier.fillMaxSize().testTag("projects-loading"), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }
    val structure = loadedStructure!!
    val (taskSort,setTaskSort)=rememberTaskListSort("personal")
    val orderedTasks=remember(tasks,taskSort){orderPersonalTasks(tasks,taskSort)}
    var searchQuery by rememberSaveable(app.workspaceScope) { mutableStateOf("") }
    var createActionsOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var localSelectedCategory by remember { mutableStateOf<String?>(null) }
    val selectedCategory = if (menuSwipeState == null) localSelectedCategory
        else menuSwipeState.projects.takeUnless { it == "all" }
    fun selectCategory(id: String?) {
        localSelectedCategory = id
        menuSwipeState?.projects = id ?: "all"
    }
    var selectedProject by remember { mutableStateOf<String?>(null) }
    var openedListId by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<GenesisProject?>(null) }
    var deleteCandidate by remember { mutableStateOf<GenesisProject?>(null) }
    var deleteTaskCandidate by remember { mutableStateOf<LocalTask?>(null) }
    var transferProject by remember { mutableStateOf<GenesisProject?>(null) }
    var creating by remember { mutableStateOf(false) }
    var voiceDraftTitle by remember { mutableStateOf("") }
    var voiceDraftCategoryTitle by remember { mutableStateOf("") }
    var editingCategory by remember { mutableStateOf<GenesisCategory?>(null) }
    var deleteCategoryCandidate by remember { mutableStateOf<GenesisCategory?>(null) }
    var categoryEditor by remember { mutableStateOf(false) }
    var categoriesExpanded by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(voiceRequest,structure.revision) {
        if(voiceRequest!=null) {
            when(voiceRequest) {
                is NativeVoiceAction.CreateProject -> {
                    editing=null;voiceDraftTitle=voiceRequest.title;creating=true
                }
                is NativeVoiceAction.EditProject -> {
                    structure.projects.firstOrNull { it.id==voiceRequest.id }?.let {
                        editing=it;voiceDraftTitle="";creating=true
                    }
                }
                is NativeVoiceAction.DeleteProject -> {
                    deleteCandidate=structure.projects.firstOrNull { it.id==voiceRequest.id }
                }
                is NativeVoiceAction.CreateCategory -> {
                    editingCategory=null;voiceDraftCategoryTitle=voiceRequest.title
                    categoryEditor=true;categoriesExpanded=true
                }
                is NativeVoiceAction.EditCategory -> {
                    structure.categories.firstOrNull { it.id==voiceRequest.id }?.let {
                        editingCategory=it;voiceDraftCategoryTitle=""
                        categoryEditor=true;categoriesExpanded=true
                    }
                }
                is NativeVoiceAction.DeleteCategory -> {
                    deleteCategoryCandidate=structure.categories.firstOrNull { it.id==voiceRequest.id }
                    categoriesExpanded=true
                }
                else -> Unit
            }
            if (voiceRequest !is NativeVoiceAction.EditTaskList && voiceRequest !is NativeVoiceAction.DeleteTaskList)
                onVoiceRequestConsumed()
        }
    }
    var moveAnnouncement by remember { mutableStateOf<String?>(null) }
    var pickup by remember { mutableStateOf<TaskPickup?>(null) }
    var workspaceBounds by remember { mutableStateOf(Rect.Zero) }
    val dropBounds = remember { mutableStateMapOf<String, Rect>() }
    val ordered = remember(structure) { WorkspaceStructureCodec.ordered(structure) }
    val visible = ordered.filter { selectedCategory == null || it.first.categoryId == selectedCategory }
        .map { (project,depth) -> project to if (selectedCategory == null) depth else 0 }
    val knownLists = remember(taskLists, tasks, structure) {
        userTaskLists(taskListsForTasks(taskLists + structure.taskLists, tasks))
    }
    fun listProjectId(list: GoogleTaskList): String? = structure.taskListLinks
        .firstOrNull { it.taskListId == list.id }?.projectId
        ?.takeIf { id -> structure.projects.any { it.id == id } }
    val inboxLists = knownLists.filter { listProjectId(it) == null }
    val tasksByProject = remember(orderedTasks, structure) { orderedTasks.groupBy { personalTaskProjectId(it, structure) } }
    val inbox = tasksByProject[null].orEmpty().filterNot { task -> inboxLists.any { task.belongsToList(it) } }
    val searchResults = remember(orderedTasks, structure, knownLists, searchQuery, selectedCategory) {
        if (searchQuery.isBlank()) emptyList()
        else searchPersonalAffairs(orderedTasks, structure, knownLists, searchQuery, selectedCategory)
    }
    LaunchedEffect(initialProjectId,structure) {
        val target=structure.projects.firstOrNull {it.id==initialProjectId} ?: return@LaunchedEffect
        searchQuery = ""
        selectCategory(null);selectedProject=target.id
        val index=ordered.indexOfFirst {it.first.id==target.id}
        if(index>=0)listState.scrollToItem(index+3)
        onInitialProjectConsumed()
    }
    LaunchedEffect(initialListId, knownLists, structure) {
        val list = knownLists.firstOrNull { it.id == initialListId } ?: return@LaunchedEffect
        searchQuery = ""
        openedListId = list.id
        selectCategory(null)
        selectedProject = listProjectId(list)
        val index = selectedProject?.let { id -> ordered.indexOfFirst { it.first.id == id } }
        listState.scrollToItem(if (index != null && index >= 0) index + 3 else 1)
        onInitialListConsumed()
    }
    LaunchedEffect(voiceRequest, knownLists, structure) {
        val id = when (voiceRequest) {
            is NativeVoiceAction.EditTaskList -> voiceRequest.id
            is NativeVoiceAction.DeleteTaskList -> voiceRequest.id
            else -> null
        } ?: return@LaunchedEffect
        knownLists.firstOrNull { it.id == id }?.let { list ->
            searchQuery = ""
            selectCategory(null); selectedProject = listProjectId(list)
        }
    }
    val language = LocalGenesisLanguage.current
    val projectCount = structure.projects.size
    val activeCount = tasks.count { !it.done }
    val projectSummary = mobileCalendarCopy(language).projectSummary(projectCount, activeCount)
    val moveTask: (String, String) -> Unit = { taskId, targetId ->
        scope.launch {
            try {
                val project = if (targetId == inboxDropId) null else {
                    structure.projects.firstOrNull { it.id == targetId }
                        ?: throw IllegalArgumentException("Проект больше не существует.")
                }
                val task = app.repository.get(taskId) ?: throw IllegalArgumentException("Задача больше не существует.")
                val assignment = project?.id ?: inboxDropId
                if (task.projectId != assignment) {
                    app.repository.save(task.copy(projectId = assignment, categoryId = project?.categoryId,
                        project = project?.title ?: ""))
                    moveAnnouncement = if (project == null) "«${task.title}» возвращена в Хаос-бокс."
                        else "«${task.title}» перенесена в «${project.title}»."
                }
                error = null
            } catch (e: IllegalArgumentException) { error = e.message ?: "Не удалось перенести задачу." }
            catch (_: Exception) { error = "Не удалось перенести задачу. Повторите попытку." }
        }
    }
    val listCard: @Composable (GoogleTaskList) -> Unit = { list ->
        PersonalTaskListCard(list, orderedTasks.filter { it.belongsToList(list) &&
            personalTaskProjectId(it, structure) == listProjectId(list) }, structure, use24,
            onCreateListTask, onCompleteTask, onOpenTask, onUpdateList, onDeleteList,
            initialExpanded = openedListId == list.id,
            deleteTaskCount = tasks.count { it.belongsToList(list) },
            voiceRequest = voiceRequest, onVoiceRequestConsumed = onVoiceRequestConsumed)
    }
    val onPickup: (LocalTask, Offset) -> Unit = { task, point ->
        dropBounds.clear()
        pickup = TaskPickup(task.id, task.title, task.projectId, point)
    }
    val onDrag: (Offset) -> Unit = { delta -> pickup = pickup?.let { it.copy(position = it.position + delta) } }
    val onRelease: (Boolean) -> Unit = { cancelled ->
        if (!cancelled) pickup?.let { held ->
            dropBounds.entries.firstOrNull { it.value.contains(held.position) }?.let { (id, _) ->
                moveTask(held.id, id)
            }
        }
        pickup = null
        dropBounds.clear()
    }

    BoxWithConstraints(Modifier.fillMaxSize().onGloballyPositioned { workspaceBounds = it.boundsInRoot() }) {
    val wide = maxWidth >= 840.dp
    val categoriesContent: @Composable () -> Unit = {
            Card(Modifier.fillMaxWidth().testTag("life-categories-card"), shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 10.dp, top = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f).padding(end = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("Категории жизни", style = MaterialTheme.typography.titleMedium)
                            Text(genesisTranslate("Выберите категорию, чтобы отфильтровать проекты."),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = { categoriesExpanded = !categoriesExpanded },
                            modifier = Modifier.heightIn(min = 48.dp).testTag("manage-categories")) {
                            Text(if (categoriesExpanded) "Свернуть" else "Управлять")
                        }
                    }
                    ConnectedSubmenu(listOf(SubmenuItem("all", "Все")) +
                        structure.categories.sortedBy { it.position }.map {
                            SubmenuItem(it.id, it.name, categoryAccent(it.color), "category-filter-${it.id}")
                        }, selectedCategory ?: "all",
                        { selectCategory(it.takeUnless { id -> id == "all" }) },
                        Modifier.testTag("life-category-filters"), connectToParent = false)
                    if (categoriesExpanded) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = {
                                editingCategory = null; categoryEditor = true; error = null
                            }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                                .testTag("create-category")) {
                                Text("Добавить категорию")
                            }
                            structure.categories.sortedBy { it.position }.forEach { category ->
                                Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
                                    color = MaterialTheme.colorScheme.surfaceContainerLowest,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                                    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            androidx.compose.material3.Surface(Modifier.padding(end = 10.dp).size(16.dp),
                                                color = categoryAccent(category.color), shape = CircleShape) {}
                                            Text(category.name, Modifier.weight(1f),
                                                style = MaterialTheme.typography.titleSmall)
                                        }
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                            TextButton(onClick = {
                                                editingCategory = category; categoryEditor = true; error = null
                                            }, modifier = Modifier.heightIn(min = 48.dp)
                                                .testTag("edit-category-${category.id}")) { Text("Изменить") }
                                            TextButton(onClick = { deleteCategoryCandidate = category },
                                                colors = ButtonDefaults.textButtonColors(
                                                    contentColor = MaterialTheme.colorScheme.error),
                                                modifier = Modifier.heightIn(min = 48.dp)
                                                    .testTag("delete-category-${category.id}")) { Text("Удалить") }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
    }
    Row(Modifier.fillMaxSize()) {
    LazyColumn(state = listState, modifier = Modifier.weight(if (wide) 1.4f else 1f).fillMaxHeight().testTag("projects-screen"), contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "personal-controls") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AffairsPageHeader("Личные дела", projectSummary, contextIsUserContent = true) {
                    Box {
                        AffairsIconButton("Дополнительные действия", AffairsAction.MORE,
                            { createActionsOpen = true }, Modifier.testTag("personal-actions"))
                        DropdownMenu(createActionsOpen, { createActionsOpen = false }) {
                            DropdownMenuItem(text = { Text("Создать проект") }, onClick = {
                                createActionsOpen = false; creating = true; editing = null; error = null
                            }, modifier = Modifier.testTag("create-project"))
                            DropdownMenuItem(text = { Text("Создать список") }, onClick = {
                                createActionsOpen = false; onCreateList()
                            }, modifier = Modifier.testTag("personal-create-list"))
                        }
                    }
                }
                Button(onClick = { onCreateTask(null) }, modifier = Modifier.fillMaxWidth()
                    .heightIn(min = 48.dp).testTag("personal-create-task")) { Text("Создать задачу") }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(onClick = { onMindmaps(null) }, modifier = Modifier.weight(1f)
                        .heightIn(min = 48.dp).testTag("personal-mindmaps")) { Text("Майндмепы") }
                    TaskListSortChoice(taskSort, setTaskSort, Modifier.weight(1.25f), compact = true)
                }
                AffairsSearchField(searchQuery, { searchQuery = it.take(200) }, "Поиск задач",
                    Modifier.testTag("personal-task-search"))
                structure.categories.firstOrNull { it.id == selectedCategory }?.let { category ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Text(category.name, Modifier.weight(1f),
                            style = MaterialTheme.typography.labelLarge)
                        TextButton(onClick = { selectCategory(null) }, modifier = Modifier.heightIn(min = 48.dp)
                            .testTag("personal-reset-category")) { Text("Сбросить") }
                    }
                }
            }
        }
        if (searchQuery.isNotBlank()) {
            if (searchResults.isEmpty()) item {
                Text("Ничего не найдено. Измените запрос.", Modifier.testTag("personal-search-empty"),
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            items(searchResults, key = { "search-${it.id}" }) { task ->
                NativeTaskCard(task, use24, structure, onCompleteTask, onOpenTask)
            }
        } else {
        if (!wide) item {
            InboxProjectCard(inbox, structure.projects, experimental, pickup?.id,
                onPickup, onDrag, onRelease, onOpenTask, onCreateTask, moveTask,
                onDeleteClick = { deleteTaskCandidate = it }, listCount = inboxLists.size) {
                inboxLists.forEach { list -> key(list.accountId, list.id) { listCard(list) } }
            }
        }
        if (!wide) item { categoriesContent() }
        if (visible.isEmpty()) item { Text("В этом разделе пока нет проектов.") }
        items(visible, key = { it.first.id }) { (project, depth) ->
            val count = tasksByProject[project.id].orEmpty().size
            Surface(onClick = { selectedProject = if (selectedProject == project.id) null else project.id },
                color = if (experimental && selectedProject == project.id) Color(0xffe4eeea)
                else MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().testTag("project-drop-${project.id}"),
                tonalElevation = if (experimental) 0.dp else 1.dp) {
                Column(Modifier.fillMaxWidth()
                    .padding(start = (16 + depth.coerceAtMost(5) * 14).dp, end = 16.dp, top = 14.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Text(if (experimental) projectHierarchyLabel(project.title, depth)
                            else projectTreeLabel(project.title, depth), Modifier.weight(1f),
                            style = MaterialTheme.typography.titleMedium)
                        Text("$count", style = MaterialTheme.typography.labelLarge)
                    }
                    val category = structure.categories.firstOrNull { it.id == project.categoryId }
                    category?.let {
                        val accent = categoryAccent(it.color)
                        androidx.compose.material3.Surface(shape = RoundedCornerShape(50),
                            color = androidx.compose.ui.graphics.lerp(MaterialTheme.colorScheme.surface, accent, if(LocalEveningTheme.current) .28f else .15f),
                            border = BorderStroke(1.dp, accent.copy(alpha = .45f)),
                            modifier = Modifier.testTag("project-category-color-${project.id}")) {
                            Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.Surface(Modifier.size(10.dp), color = accent, shape = RoundedCornerShape(50)) {}
                                Text(it.name, style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                    val projectStatus = project.status.takeIf { it != "active" }?.let {
                        if (it == "completed") "Завершён" else "Архив"
                    }
                    if (category == null || projectStatus != null) Text(projectStatus ?: "Без категории",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (selectedProject == project.id) {
                        if (project.description.isNotBlank()) Text(project.description, style = MaterialTheme.typography.bodyMedium)
                        val projectLists = knownLists.filter { listProjectId(it) == project.id }
                        projectLists.forEach { list -> key(list.accountId, list.id) { listCard(list) } }
                        tasksByProject[project.id].orEmpty().filterNot { task -> projectLists.any { task.belongsToList(it) } }.forEach { task ->
                            DraggableTaskRow(task, pickup?.id == task.id, onPickup, onDrag, onRelease) {
                                if (experimental) {
                                    TaskDragHandle(task)
                                    TextButton(onClick = { onOpenTask(task.id) }, modifier = Modifier.weight(1f)) {
                                        TaskTitle(task)
                                    }
                                    TaskDestinationMenu(task, structure.projects, moveTask)
                                    ProjectTaskDeleteButton(task) { deleteTaskCandidate = task }
                                } else {
                                    TextButton(onClick = { onOpenTask(task.id) }, modifier = Modifier.weight(1f)) {
                                        TaskTitle(task)
                                    }
                                    ProjectTaskDeleteButton(task) { deleteTaskCandidate = task }
                                }
                            }
                        }
                        TextButton(onClick = { onCreateTask(project.id) }) { Text("Создать задачу в проекте") }
                        TextButton(onClick = { onMindmaps(project.id) }) { Text("Майндмепы проекта") }
                        TextButton(onClick = { editing = project; creating = true; error = null }) { Text("Изменить проект") }
                        if (sharedController != null) TextButton(onClick = { transferProject = project },
                            modifier = Modifier.testTag("transfer-project-${project.id}")) {
                            Text(if (language == "en") "Move to shared" else "Переместить в общие")
                        }
                        TextButton(onClick = { deleteCandidate = project },
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.testTag("delete-project-${project.id}")) {
                            Text("Удалить проект")
                        }
                    }
                }
            }
        }
        }
        error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error) } }
        moveAnnouncement?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.testTag("project-move-announcement")) } }
        item {
            Text("Проекты, задачи и списки объединены в личных делах.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    if (wide && searchQuery.isBlank()) Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState())
        .padding(top = 16.dp, end = 16.dp, bottom = 16.dp).testTag("project-tools-pane"),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        InboxProjectCard(inbox, structure.projects, experimental, pickup?.id,
            onPickup, onDrag, onRelease, onOpenTask, onCreateTask, moveTask,
            onDeleteClick = { deleteTaskCandidate = it }, listCount = inboxLists.size) {
            inboxLists.forEach { list -> key(list.accountId, list.id) { listCard(list) } }
        }
        categoriesContent()
    }
    }
    pickup?.let { held ->
        ProjectDropOverlay(held, structure.projects, experimental, workspaceBounds, dropBounds)
    }
    }

    if (creating) ProjectEditor(structure, editing, error, voiceDraftTitle,
        onDismiss = { creating = false;voiceDraftTitle="" }) { draft, expectedRevision ->
        scope.launch {
            try { repo.saveProject(draft, expectedRevision); selectedProject = draft.id; error = null; creating = false }
            catch (e: IllegalArgumentException) { error = e.message ?: "Проверьте проект." }
            catch (_: Exception) { error = "Не удалось сохранить проект. Повторите попытку." }
        }
    }
    transferProject?.let { root -> sharedController?.let { controller ->
        PersonalProjectTransferDialog(root, structure, tasks, controller, sharedAccount, language,
            app.workspaceScope, onDismiss = { transferProject = null }, onMoved = { tree, selectedTasks ->
                repo.removeImportedProjectTree(root.id, structure.revision, tree.map { it.id }.toSet(),
                    selectedTasks.associate { it.id to it.revision })
                selectedProject = null
                controller.syncPending()
            })
    } }
    if (categoryEditor) CategoryEditor(editingCategory,structure.categories.size,structure.revision,error,
        initialTitle=voiceDraftCategoryTitle,
        onDismiss = { categoryEditor = false;voiceDraftCategoryTitle="" }) { draft, expectedRevision ->
        scope.launch {
            try { repo.saveCategory(draft, expectedRevision); error = null; categoryEditor = false;voiceDraftCategoryTitle="" }
            catch (e: IllegalArgumentException) { error = e.message ?: "Проверьте категорию." }
            catch (_: Exception) { error = "Не удалось сохранить категорию." }
        }
    }
    deleteCandidate?.let { project ->
        AlertDialog(onDismissRequest = { deleteCandidate = null },
            title = { Text("Удалить проект?") },
            text = { Text("Удалить проект «${project.title}» и все его подпроекты? Задачи останутся, но перейдут в Хаос-бокс.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteCandidate = null
                    scope.launch {
                        try {
                            val removed = WorkspaceStructureCodec.projectSubtreeIds(structure.projects, project.id)
                            tasks.filter { it.projectId in removed }.forEach { task ->
                                app.repository.save(task.copy(projectId = null, categoryId = null, project = ""))
                            }
                            repo.deleteProject(project.id, structure.revision)
                            if (selectedProject in removed) selectedProject = null
                            if (editing?.id in removed) { editing = null; creating = false }
                            error = null
                        } catch (e: IllegalArgumentException) {
                            error = e.message ?: "Не удалось удалить проект."
                        } catch (_: Exception) {
                            error = "Не удалось удалить проект. Повторите попытку."
                        }
                    }
                }, modifier = Modifier.testTag("confirm-delete-project"),
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                    Text("Удалить")
                }
            },
            dismissButton = { TextButton(onClick = { deleteCandidate = null }) { Text("Отмена") } })
    }
    deleteTaskCandidate?.let { task ->
        AlertDialog(onDismissRequest = { deleteTaskCandidate = null },
            title = { Text("Удалить задачу?") },
            text = { Text("«${task.title}» будет удалена из проекта и всех разделов. Если задача повторяется, удалится вся серия.") },
            confirmButton = {
                TextButton(onClick = { deleteTaskCandidate = null; onDeleteTask(task) },
                    modifier = Modifier.testTag("confirm-project-task-delete"),
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                    Text("Удалить")
                }
            },
            dismissButton = { TextButton(onClick = { deleteTaskCandidate = null }) { Text("Отмена") } })
    }
    deleteCategoryCandidate?.let { category ->
        AlertDialog(onDismissRequest = { deleteCategoryCandidate = null },
            title = { Text("Удалить категорию?") },
            text = { Text("Удалить категорию «${category.name}»? Проекты и задачи останутся, но будут перенесены в раздел «Без категории».") },
            confirmButton = {
                TextButton(onClick = {
                    deleteCategoryCandidate = null
                    scope.launch {
                        try {
                            tasks.filter { it.categoryId == category.id }.forEach { task ->
                                app.repository.save(task.copy(categoryId = null))
                            }
                            repo.deleteCategory(category.id, structure.revision)
                            if (selectedCategory == category.id) selectCategory(null)
                            if (editingCategory?.id == category.id) { editingCategory = null; categoryEditor = false }
                            error = null
                        } catch (e: IllegalArgumentException) {
                            error = e.message ?: "Не удалось удалить категорию."
                        } catch (_: Exception) {
                            error = "Не удалось удалить категорию. Повторите попытку."
                        }
                    }
                }, modifier = Modifier.testTag("confirm-delete-category"),
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                    Text("Удалить")
                }
            },
            dismissButton = { TextButton(onClick = { deleteCategoryCandidate = null }) { Text("Отмена") } })
    }
}

@Composable
private fun InboxProjectCard(inbox: List<LocalTask>, projects: List<GenesisProject>, experimental: Boolean,
    pickedUpId: String?,
    onPickup: (LocalTask, Offset) -> Unit, onDrag: (Offset) -> Unit, onRelease: (Boolean) -> Unit,
    onOpenTask: (String) -> Unit, onCreateTask: (String?) -> Unit,
    onMoveTask: (String, String) -> Unit, onDeleteClick: (LocalTask) -> Unit,
    listCount: Int = 0, listsContent: @Composable () -> Unit = {}) {
    val background = if (experimental) Color(0xff103632) else MaterialTheme.colorScheme.surface
    val foreground = if (experimental) Color(0xfff8f3e8) else MaterialTheme.colorScheme.onSurface
    val secondary = if (experimental) Color(0xffb8ccc5) else MaterialTheme.colorScheme.onSurfaceVariant
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("project-inbox"),
        shape = MaterialTheme.shapes.medium, color = background,
        tonalElevation = if (experimental) 0.dp else 1.dp
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Хаос-бокс", color = foreground,
                        style = MaterialTheme.typography.titleMedium)
                    Text("${inbox.size} задач · ${genesisTranslate("Списки задач")}: $listCount", color = secondary,
                        style = MaterialTheme.typography.bodySmall)
                }

            }
            if (experimental) Text("Удерживайте задачу и перетащите её в проект. Здесь можно вернуть задачу обратно.",
                color = secondary, style = MaterialTheme.typography.bodySmall)
            run {
                if (inbox.isEmpty() && listCount == 0) Text("Задач без проекта пока нет.", color = secondary,
                    style = MaterialTheme.typography.bodyMedium)
                inbox.forEach { task ->
                    DraggableTaskRow(task, pickedUpId == task.id, onPickup, onDrag, onRelease) {
                        TaskDragHandle(task)
                        TextButton(onClick = { onOpenTask(task.id) }, modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.textButtonColors(contentColor = foreground)) {
                            TaskTitle(task, maxLines = 2,
                                completedColor = if (experimental) Color(0xffaab3b0) else completedTaskInk)
                        }
                        TaskDestinationMenu(task, projects, onMoveTask, foreground)
                        ProjectTaskDeleteButton(task) { onDeleteClick(task) }
                    }
                }
                listsContent()
                TextButton(onClick = { onCreateTask(null) },
                    colors = ButtonDefaults.textButtonColors(contentColor = foreground)) {
                    Text("Создать задачу")
                }
            }
        }
    }
}

@Composable
private fun TaskDestinationMenu(task: LocalTask, projects: List<GenesisProject>,
    onMoveTask: (String, String) -> Unit, tint: Color = MaterialTheme.colorScheme.primary) {
    var open by remember(task.id) { mutableStateOf(false) }
    var query by remember(task.id) { mutableStateOf("") }
    TextButton(onClick = { query = ""; open = true }, modifier = Modifier.testTag("move-task-${task.id}"),
        colors = ButtonDefaults.textButtonColors(contentColor = tint)) {
        Text(if (task.projectId == null) "В проект" else "Перенести")
    }
    if (open) Dialog(onDismissRequest = { open = false }) {
        Surface(shape = MaterialTheme.shapes.large) {
            Column(Modifier.fillMaxWidth().heightIn(max = 580.dp).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Куда перенести задачу?", style = MaterialTheme.typography.titleLarge)
                androidx.compose.material3.Text(task.title, style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(query, { query = it }, label = { Text("Найти проект") },
                    singleLine = true, modifier = Modifier.fillMaxWidth().testTag("project-destination-search"))
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())
                    .testTag("project-destination-list")) {
                    if (task.projectId != null && (query.isBlank() || "Хаос-бокс".contains(query, true))) {
                        TextButton(onClick = { open = false; onMoveTask(task.id, inboxDropId) },
                            modifier = Modifier.fillMaxWidth().testTag("project-menu-target-$inboxDropId")) {
                            Text("Хаос-бокс")
                        }
                    }
                    WorkspaceStructureCodec.ordered(WorkspaceStructure(projects = projects))
                        .filterNot { (project, _) -> project.id == task.projectId }
                        .filter { (project, _) -> query.isBlank() ||
                            projectBreadcrumb(projects, project.id).contains(query, true) }
                        .forEach { (project, depth) ->
                            TextButton(onClick = { open = false; onMoveTask(task.id, project.id) },
                                modifier = Modifier.fillMaxWidth().testTag("project-menu-target-${project.id}"),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)) {
                                Column(Modifier.fillMaxWidth().padding(start = (depth * 16).dp),
                                    horizontalAlignment = Alignment.Start) {
                                    androidx.compose.material3.Text(projectHierarchyLabel(project.title, depth),
                                        style = MaterialTheme.typography.titleSmall)
                                    project.parentId?.let {
                                        Text("В составе: ${projectBreadcrumb(projects, it)}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                }
                TextButton(onClick = { open = false }, modifier = Modifier.align(Alignment.End)) {
                    Text("Отмена")
                }
            }
        }
    }
}

@Composable
private fun BoxScope.ProjectDropOverlay(held: TaskPickup, projects: List<GenesisProject>,
    experimental: Boolean, workspaceBounds: Rect, dropBounds: MutableMap<String, Rect>) {
    val density = LocalDensity.current
    val targetScroll = rememberScrollState()
    var targetListBounds by remember { mutableStateOf(Rect.Zero) }
    val parchment = if (experimental) Color(0xfff7f1e5) else MaterialTheme.colorScheme.onSurface
    val background = if (experimental) Color(0xff071d20) else MaterialTheme.colorScheme.surfaceContainerHigh
    val gold = if (experimental) Color(0xffdfc17e) else MaterialTheme.colorScheme.primary
    data class Target(val id: String, val title: String, val depth: Int, val parentPath: String)
    val entries = (listOf(Target(inboxDropId, "Хаос-бокс", 0, "")) +
        WorkspaceStructureCodec.ordered(WorkspaceStructure(projects = projects)).map { (project, depth) ->
            Target(project.id, project.title, depth, projectBreadcrumb(projects, project.parentId))
        }).filterNot { it.id == (held.originId ?: inboxDropId) }
    LaunchedEffect(held.position, targetListBounds, targetScroll.maxValue) {
        if (targetListBounds == Rect.Zero || targetScroll.maxValue == 0) return@LaunchedEffect
        val edge = with(density) { 72.dp.toPx() }
        while (true) {
            val speed = when {
                held.position.y < targetListBounds.top + edge -> -with(density) { 13.dp.toPx() }
                held.position.y > targetListBounds.bottom - edge -> with(density) { 13.dp.toPx() }
                else -> 0f
            }
            if (speed == 0f) break
            val consumed = targetScroll.scrollBy(speed)
            if (kotlin.math.abs(consumed) < .5f) break
            delay(16)
        }
    }
    Surface(Modifier.align(Alignment.BottomCenter).fillMaxWidth().heightIn(max = 490.dp)
        .padding(12.dp).testTag("drag-overlay"),
        shape = MaterialTheme.shapes.large, color = background,
        border = BorderStroke(2.dp, gold), shadowElevation = 18.dp) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Переносим «${held.title}»", color = parchment,
                style = MaterialTheme.typography.titleMedium, maxLines = 2)
            Text("Отпустите задачу над нужным проектом", color = gold,
                style = MaterialTheme.typography.bodySmall)
            Column(Modifier.fillMaxWidth().weight(1f).onGloballyPositioned {
                    targetListBounds = it.boundsInRoot()
                }.verticalScroll(targetScroll).testTag("drag-overlay-target-list"),
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                entries.forEach { target ->
                    val id = target.id
                    val hovered = dropBounds[id]?.contains(held.position) == true
                    Surface(Modifier.fillMaxWidth().heightIn(min = 56.dp)
                        .onGloballyPositioned { dropBounds[id] = it.boundsInRoot() }
                        .testTag("drag-overlay-target-$id"),
                        color = if (hovered) gold else if (experimental) Color(0xff103632)
                            else MaterialTheme.colorScheme.surface,
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(if (hovered) 2.dp else 1.dp,
                            if (hovered) parchment else gold.copy(alpha = .45f))) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.padding(start = (target.depth * 14).dp)) {
                                Text(projectHierarchyLabel(target.title, target.depth),
                                    color = if (hovered) background else parchment,
                                    style = MaterialTheme.typography.titleSmall, maxLines = 2)
                                if (target.parentPath.isNotEmpty()) Text("В составе: ${target.parentPath}",
                                    color = if (hovered) background.copy(alpha = .75f) else gold,
                                    style = MaterialTheme.typography.labelSmall, maxLines = 1)
                            }
                        }
                    }
                }
            }
        }
    }
    val ghostWidth = with(density) { 228.dp.toPx() }
    val ghostHeight = with(density) { 68.dp.toPx() }
    Surface(Modifier.align(Alignment.TopStart).offset {
            IntOffset((held.position.x - workspaceBounds.left - ghostWidth / 2f).roundToInt(),
                (held.position.y - workspaceBounds.top - ghostHeight - with(density) { 18.dp.toPx() }).roundToInt())
        }.width(228.dp).height(68.dp).testTag("drag-floating-task")
        .graphicsLayer { alpha = .94f },
        color = if (experimental) Color(0xff24534b) else MaterialTheme.colorScheme.primaryContainer,
        shape = MaterialTheme.shapes.medium, border = BorderStroke(2.dp, gold), shadowElevation = 12.dp) {
        Row(Modifier.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("⋮⋮", color = gold, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.width(12.dp))
            Text(held.title, color = if (experimental) Color(0xfff7f1e5)
                else MaterialTheme.colorScheme.onPrimaryContainer,
                maxLines = 2, style = MaterialTheme.typography.titleSmall)
        }
    }
}

@Composable
private fun CategoryEditor(existing: GenesisCategory?, position: Int, revision: Long, error: String?, onDismiss: () -> Unit,
    initialTitle: String = "", onSave: (GenesisCategory, Long) -> Unit) {
    val expectedRevision = remember(existing?.id) { revision }
    var name by remember(existing?.id,initialTitle) { mutableStateOf(existing?.name ?: initialTitle) }
    var color by remember(existing?.id) { mutableStateOf(existing?.color ?: "#2d6c68") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existing == null) "Новая категория" else "Изменить категорию") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(name, { name = it }, Modifier.testTag("category-name"), label = { Text("Название") }, singleLine = true)
                CategoryColorPicker(color) { color = it }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }, confirmButton = { TextButton(enabled = name.trim().isNotBlank() && validCategoryColor(color),
            modifier = Modifier.testTag("save-category"), onClick = {
            onSave(GenesisCategory(existing?.id ?: UUID.randomUUID().toString(), name.trim(), color.uppercase(java.util.Locale.ROOT),
                existing?.position ?: position), expectedRevision)
        }) { Text("Сохранить") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } })
}

@Composable
private fun ProjectEditor(structure: WorkspaceStructure, existing: GenesisProject?, error: String?,
    initialTitle: String = "",
    onDismiss: () -> Unit, onSave: (GenesisProject, Long) -> Unit) {
    val expectedRevision = remember(existing?.id) { structure.revision }
    var title by remember(existing?.id,initialTitle) { mutableStateOf(existing?.title ?: initialTitle) }
    var description by remember(existing?.id) { mutableStateOf(existing?.description ?: "") }
    var categoryId by remember(existing?.id) { mutableStateOf(existing?.categoryId) }
    var parentId by remember(existing?.id) { mutableStateOf(existing?.parentId) }
    var status by remember(existing?.id) { mutableStateOf(existing?.status ?: "active") }
    var tags by remember(existing?.id) { mutableStateOf(existing?.tags?.joinToString(", ") ?: "") }
    val invalidParents = remember(structure, existing) {
        if (existing == null) emptySet() else structure.projects.filter { project ->
            if (project.id == existing.id) true else {
                var cursor = project.parentId
                val visited = mutableSetOf<String>()
                var descendant = false
                while (cursor != null && visited.add(cursor)) {
                    if (cursor == existing.id) { descendant = true; break }
                    cursor = structure.projects.firstOrNull { it.id == cursor }?.parentId
                }
                descendant
            }
        }.map { it.id }.toSet()
    }
    Dialog(onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxWidth().widthIn(max = 720.dp).padding(12.dp),
            shape = RoundedCornerShape(20.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp).imePadding()) {
                EditorDialogHeader(if (existing == null) "Новый проект" else "Изменить проект",
                    "close-project-editor", onDismiss)
              Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                EditorSection("Основное") {
                OutlinedTextField(title, { title = it }, label = { Text("Название") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("project-title"))
                OutlinedTextField(description, { description = it }, label = { Text("Описание") },
                    modifier = Modifier.fillMaxWidth())
                }
                EditorSection("Категория") {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = categoryId == null, onClick = { categoryId = null }, label = { Text("Без категории") })
                    structure.categories.sortedBy { it.position }.forEach { category ->
                        val accent = categoryAccent(category.color)
                        FilterChip(selected = categoryId == category.id, onClick = { categoryId = category.id },
                            label = { Text(category.name) }, modifier = Modifier.testTag("project-category-${category.id}"),
                            border = BorderStroke(1.dp,accent),
                            colors = FilterChipDefaults.filterChipColors(
                                containerColor = accent.copy(alpha = .12f),
                                selectedContainerColor = accent.copy(alpha = .28f),
                                labelColor = accent, selectedLabelColor = accent))
                    }
                }
                }
                EditorSection("Родительский проект") {
                Column {
                    FilterChip(selected = parentId == null, onClick = { parentId = null }, label = { Text("Корневой") })
                    WorkspaceStructureCodec.ordered(structure).filter { it.first.id !in invalidParents }.forEach { (project, depth) ->
                        FilterChip(selected = parentId == project.id, onClick = { parentId = project.id },
                            label = { Text("  ".repeat(depth) + projectTreeLabel(project.title, depth)) })
                    }
                }
                }
                EditorSection("Метки") {
                OutlinedTextField(tags, { tags = it }, label = { Text("Метки через запятую") },
                    modifier = Modifier.fillMaxWidth())
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (existing != null) {
                    EditorSection("Состояние") {
                    Row(Modifier.horizontalScroll(rememberScrollState())) {
                        listOf("active" to "Активен", "completed" to "Завершён", "archived" to "Архив").forEach { (key, label) ->
                            FilterChip(selected = status == key, onClick = { status = key }, label = { Text(label) })
                        }
                    }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Отмена") }
                    Button(enabled = title.trim().isNotEmpty(), onClick = {
                        val normalizedTags = tags.split(",").map { it.trim().removePrefix("#") }.filter { it.isNotBlank() }.take(10)
                        onSave(GenesisProject(existing?.id ?: UUID.randomUUID().toString(), parentId, categoryId,
                            title.trim(), description.trim(), normalizedTags, status,
                            existing?.position ?: structure.projects.size), expectedRevision)
                    }, modifier = Modifier.testTag("save-project")) { Text("Сохранить") }
                }
              }
            }
        }
    }
}
