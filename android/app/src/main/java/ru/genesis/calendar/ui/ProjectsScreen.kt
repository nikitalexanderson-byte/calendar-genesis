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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import ru.genesis.calendar.data.*

private const val inboxDropId = "__genesis_inbox__"

private fun categoryAccent(value: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(value)) }.getOrDefault(Color(0xff2d6c68))

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
fun ProjectsScreen(app: GenesisApplication, tasks: List<LocalTask>, experimental: Boolean,
    onOpenTask: (String) -> Unit, onCreateTask: (String?) -> Unit) {
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
    val scope = rememberCoroutineScope()
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var selectedProject by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<GenesisProject?>(null) }
    var deleteCandidate by remember { mutableStateOf<GenesisProject?>(null) }
    var creating by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<GenesisCategory?>(null) }
    var deleteCategoryCandidate by remember { mutableStateOf<GenesisCategory?>(null) }
    var categoryEditor by remember { mutableStateOf(false) }
    var categoriesExpanded by remember { mutableStateOf(false) }
    var inboxExpanded by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var moveAnnouncement by remember { mutableStateOf<String?>(null) }
    var pickup by remember { mutableStateOf<TaskPickup?>(null) }
    var workspaceBounds by remember { mutableStateOf(Rect.Zero) }
    val dropBounds = remember { mutableStateMapOf<String, Rect>() }
    val ordered = remember(structure) { WorkspaceStructureCodec.ordered(structure) }
    val visible = ordered.filter { selectedCategory == null || it.first.categoryId == selectedCategory }
        .map { (project,depth) -> project to if (selectedCategory == null) depth else 0 }
    val tasksByProject = remember(tasks) { tasks.groupBy { it.projectId } }
    val inbox = remember(tasks) { tasks.filter { it.projectId == null || it.projectId == "__genesis_inbox__" } }
    val language = LocalGenesisLanguage.current
    val projectCount = structure.projects.size
    val activeCount = tasks.count { !it.done }
    val projectSummary = if (language == "en")
        "$projectCount ${if (projectCount == 1) "project" else "projects"} · " +
            "$activeCount active ${if (activeCount == 1) "task" else "tasks"}"
    else "$projectCount ${russianCount(projectCount, "проект", "проекта", "проектов")} · " +
        "$activeCount ${russianCount(activeCount, "активная задача", "активные задачи", "активных задач")}"
    val moveTask: (String, String) -> Unit = { taskId, targetId ->
        scope.launch {
            try {
                val project = if (targetId == inboxDropId) null else {
                    structure.projects.firstOrNull { it.id == targetId }
                        ?: throw IllegalArgumentException("Проект больше не существует.")
                }
                val task = app.repository.get(taskId) ?: throw IllegalArgumentException("Задача больше не существует.")
                if (task.projectId != project?.id) {
                    app.repository.save(task.copy(projectId = project?.id, categoryId = project?.categoryId,
                        project = project?.title ?: ""))
                    moveAnnouncement = if (project == null) "«${task.title}» возвращена в Хаос-бокс."
                        else "«${task.title}» перенесена в «${project.title}»."
                }
                error = null
            } catch (e: IllegalArgumentException) { error = e.message ?: "Не удалось перенести задачу." }
            catch (_: Exception) { error = "Не удалось перенести задачу. Повторите попытку." }
        }
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

    Box(Modifier.fillMaxSize().onGloballyPositioned { workspaceBounds = it.boundsInRoot() }) {
    LazyColumn(Modifier.fillMaxSize().testTag("projects-screen"), contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                GenesisPageHeader(if (language == "en") "Projects" else "Проекты",
                    if (language == "en") "Categories, projects and their tasks"
                    else "Категории, проекты и задачи внутри них", "▦")
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(projectSummary, Modifier.weight(1f).padding(end = 8.dp),
                        style = MaterialTheme.typography.labelLarge)
                    Button(onClick = { creating = true; editing = null; error = null }, modifier = Modifier.testTag("create-project")) {
                        Text("Создать")
                    }
                }
            }
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = selectedCategory == null, onClick = { selectedCategory = null }, label = { Text("Все") })
                structure.categories.sortedBy { it.position }.forEach { category ->
                    val accent = categoryAccent(category.color)
                    FilterChip(selected = selectedCategory == category.id,
                        onClick = { selectedCategory = category.id }, label = { Text(category.name) },
                        leadingIcon = { Surface(Modifier.size(12.dp), color = accent,
                            shape = RoundedCornerShape(50)) {} },
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = androidx.compose.ui.graphics.lerp(MaterialTheme.colorScheme.surface, accent, .12f),
                            selectedContainerColor = androidx.compose.ui.graphics.lerp(MaterialTheme.colorScheme.surface, accent, .25f),
                            labelColor = MaterialTheme.colorScheme.onSurface,
                            selectedLabelColor = MaterialTheme.colorScheme.onSurface),
                        modifier = Modifier.testTag("category-filter-${category.id}"))
                }
            }
        }
        if (experimental) item {
            InboxProjectCard(inbox, structure.projects, true, inboxExpanded,
                { inboxExpanded = !inboxExpanded }, pickup?.id,
                onPickup, onDrag, onRelease, onOpenTask, onCreateTask, moveTask)
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("Категории жизни", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { categoriesExpanded = !categoriesExpanded }) {
                    Text(if (categoriesExpanded) "Свернуть" else "Управлять")
                }
            }
            if (categoriesExpanded) {
                TextButton(onClick = { editingCategory = null; categoryEditor = true; error = null }) { Text("Добавить категорию") }
                structure.categories.sortedBy { it.position }.forEach { category ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Surface(Modifier.padding(end = 10.dp).size(16.dp), color = categoryAccent(category.color),
                            shape = RoundedCornerShape(50)) {}
                        Text(category.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = { editingCategory = category; categoryEditor = true; error = null }) { Text("Изменить") }
                        TextButton(onClick = { deleteCategoryCandidate = category },
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.testTag("delete-category-${category.id}")) { Text("Удалить") }
                    }
                }
            }
        }
        if (visible.isEmpty()) item { Text("В этом разделе пока нет проектов.") }
        items(visible, key = { it.first.id }) { (project, depth) ->
            val count = tasksByProject[project.id].orEmpty().size
            Surface(onClick = { selectedProject = project.id },
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
                        Surface(shape = RoundedCornerShape(50),
                            color = androidx.compose.ui.graphics.lerp(MaterialTheme.colorScheme.surface, accent, .15f),
                            border = BorderStroke(1.dp, accent.copy(alpha = .45f)),
                            modifier = Modifier.testTag("project-category-color-${project.id}")) {
                            Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Surface(Modifier.size(10.dp), color = accent, shape = RoundedCornerShape(50)) {}
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
                        tasksByProject[project.id].orEmpty().forEach { task ->
                            DraggableTaskRow(task, pickup?.id == task.id, onPickup, onDrag, onRelease) {
                                if (experimental) {
                                    TaskDragHandle(task)
                                    TextButton(onClick = { onOpenTask(task.id) }, modifier = Modifier.weight(1f)) {
                                        androidx.compose.material3.Text(task.title)
                                    }
                                    TaskDestinationMenu(task, structure.projects, moveTask)
                                } else {
                                    TextButton(onClick = { onOpenTask(task.id) }) { androidx.compose.material3.Text(task.title) }
                                }
                            }
                        }
                        TextButton(onClick = { onCreateTask(project.id) }) { Text("Создать задачу в проекте") }
                        TextButton(onClick = { editing = project; creating = true; error = null }) { Text("Изменить проект") }
                        TextButton(onClick = { deleteCandidate = project },
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.testTag("delete-project-${project.id}")) {
                            Text("Удалить проект")
                        }
                    }
                }
            }
        }
        if (!experimental) item {
            Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.large) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Без проекта", style = MaterialTheme.typography.titleMedium)
                    Text("${inbox.size} задач в Хаос-боксе", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = { onCreateTask(null) }) { Text("Создать задачу без проекта") }
                    if (selectedProject == null) {
                        inbox.take(if (inboxExpanded) inbox.size else 1).forEach { task ->
                            DraggableTaskRow(task, pickup?.id == task.id, onPickup, onDrag, onRelease) {
                                TextButton(onClick = { onOpenTask(task.id) }) { androidx.compose.material3.Text(task.title) }
                            }
                        }
                        if (inbox.size > 1) TextButton(onClick = { inboxExpanded = !inboxExpanded }) {
                            Text(if (inboxExpanded) "Свернуть список" else "Показать ещё ${inbox.size - 1}")
                        }
                    }
                }
            }
        }
        error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error) } }
        moveAnnouncement?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.testTag("project-move-announcement")) } }
        item {
            Text("Списки Google Tasks появятся здесь после подключения аккаунта.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    pickup?.let { held ->
        ProjectDropOverlay(held, structure.projects, experimental, workspaceBounds, dropBounds)
    }
    }

    if (creating) ProjectEditor(structure, editing, error, onDismiss = { creating = false }) { draft, expectedRevision ->
        scope.launch {
            try { repo.saveProject(draft, expectedRevision); selectedProject = draft.id; error = null; creating = false }
            catch (e: IllegalArgumentException) { error = e.message ?: "Проверьте проект." }
            catch (_: Exception) { error = "Не удалось сохранить проект. Повторите попытку." }
        }
    }
    if (categoryEditor) CategoryEditor(editingCategory,structure.categories.size,structure.revision,error,
        onDismiss = { categoryEditor = false }) { draft, expectedRevision ->
        scope.launch {
            try { repo.saveCategory(draft, expectedRevision); error = null; categoryEditor = false }
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
                            if (selectedCategory == category.id) selectedCategory = null
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
    expanded: Boolean, onToggleExpand: () -> Unit, pickedUpId: String?,
    onPickup: (LocalTask, Offset) -> Unit, onDrag: (Offset) -> Unit, onRelease: (Boolean) -> Unit,
    onOpenTask: (String) -> Unit, onCreateTask: (String?) -> Unit,
    onMoveTask: (String, String) -> Unit) {
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
                    Text(if (experimental) "Хаос-бокс" else "Без проекта", color = foreground,
                        style = MaterialTheme.typography.titleMedium)
                    Text("${inbox.size} задач", color = secondary, style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = onToggleExpand,
                    colors = ButtonDefaults.textButtonColors(contentColor = foreground)) {
                    Text(if (expanded) "Свернуть" else "Открыть")
                }
            }
            if (experimental) Text("Удерживайте задачу и перетащите её в проект. Здесь можно вернуть задачу обратно.",
                color = secondary, style = MaterialTheme.typography.bodySmall)
            if (expanded) {
                if (inbox.isEmpty()) Text("Задач без проекта пока нет.", color = secondary,
                    style = MaterialTheme.typography.bodyMedium)
                inbox.forEach { task ->
                    DraggableTaskRow(task, pickedUpId == task.id, onPickup, onDrag, onRelease) {
                        TaskDragHandle(task)
                        TextButton(onClick = { onOpenTask(task.id) }, modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.textButtonColors(contentColor = foreground)) {
                            androidx.compose.material3.Text(task.title, maxLines = 2)
                        }
                        TaskDestinationMenu(task, projects, onMoveTask, foreground)
                    }
                }
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
    onSave: (GenesisCategory, Long) -> Unit) {
    val expectedRevision = remember(existing?.id) { revision }
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var color by remember(existing?.id) { mutableStateOf(existing?.color ?: "#2d6c68") }
    val palette = listOf("#2d6c68" to "Бирюза", "#a5543f" to "Терракота",
        "#b18b48" to "Золото", "#665c88" to "Фиолетовый", "#54718a" to "Синий")
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existing == null) "Новая категория" else "Изменить категорию") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Название") }, singleLine = true)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    palette.forEach { (swatch, label) ->
                        FilterChip(selected = color == swatch, onClick = { color = swatch },
                            label = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(color = Color(android.graphics.Color.parseColor(swatch)),
                                        shape = CircleShape, modifier = Modifier.size(16.dp)) {}
                                    Spacer(Modifier.width(6.dp))
                                    Text(label)
                                }
                            })
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }, confirmButton = { TextButton(enabled = name.trim().isNotBlank(), onClick = {
            onSave(GenesisCategory(existing?.id ?: UUID.randomUUID().toString(), name.trim(), color,
                existing?.position ?: position), expectedRevision)
        }) { Text("Сохранить") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } })
}

@Composable
private fun ProjectEditor(structure: WorkspaceStructure, existing: GenesisProject?, error: String?,
    onDismiss: () -> Unit, onSave: (GenesisProject, Long) -> Unit) {
    val expectedRevision = remember(existing?.id) { structure.revision }
    var title by remember(existing?.id) { mutableStateOf(existing?.title ?: "") }
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
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = MaterialTheme.shapes.large) {
            Column(Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(if (existing == null) "Новый проект" else "Изменить проект", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(title, { title = it }, label = { Text("Название") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("project-title"))
                OutlinedTextField(description, { description = it }, label = { Text("Описание") },
                    modifier = Modifier.fillMaxWidth())
                Text("Категория", style = MaterialTheme.typography.titleSmall)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = categoryId == null, onClick = { categoryId = null }, label = { Text("Без категории") })
                    structure.categories.sortedBy { it.position }.forEach { category ->
                        FilterChip(selected = categoryId == category.id, onClick = { categoryId = category.id },
                            label = { Text(category.name) }, modifier = Modifier.testTag("project-category-${category.id}"))
                    }
                }
                Text("Родительский проект", style = MaterialTheme.typography.titleSmall)
                Column {
                    FilterChip(selected = parentId == null, onClick = { parentId = null }, label = { Text("Корневой") })
                    WorkspaceStructureCodec.ordered(structure).filter { it.first.id !in invalidParents }.forEach { (project, depth) ->
                        FilterChip(selected = parentId == project.id, onClick = { parentId = project.id },
                            label = { Text("  ".repeat(depth) + projectTreeLabel(project.title, depth)) })
                    }
                }
                OutlinedTextField(tags, { tags = it }, label = { Text("Метки через запятую") },
                    modifier = Modifier.fillMaxWidth())
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (existing != null) {
                    Text("Состояние", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.horizontalScroll(rememberScrollState())) {
                        listOf("active" to "Активен", "completed" to "Завершён", "archived" to "Архив").forEach { (key, label) ->
                            FilterChip(selected = status == key, onClick = { status = key }, label = { Text(label) })
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
