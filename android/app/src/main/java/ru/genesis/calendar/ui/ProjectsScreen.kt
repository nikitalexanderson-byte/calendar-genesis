package ru.genesis.calendar.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import java.util.UUID
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*

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
    var creating by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<GenesisCategory?>(null) }
    var categoryEditor by remember { mutableStateOf(false) }
    var categoriesExpanded by remember { mutableStateOf(false) }
    var inboxExpanded by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val background = if (experimental) Color(0xff103632) else MaterialTheme.colorScheme.surface
    val onBackground = if (experimental) Color(0xfff8f3e8) else MaterialTheme.colorScheme.onSurface
    val subText = if (experimental) Color(0xffb8ccc5) else MaterialTheme.colorScheme.onSurfaceVariant
    val ordered = remember(structure) { WorkspaceStructureCodec.ordered(structure) }
    val visible = ordered.filter { selectedCategory == null || it.first.categoryId == selectedCategory }
        .map { (project,depth) -> project to if (selectedCategory == null) depth else 0 }
    val tasksByProject = remember(tasks) { tasks.groupBy { it.projectId } }
    val inbox = remember(tasks) { tasks.filter { it.projectId == null || it.projectId == "__genesis_inbox__" } }

    LazyColumn(Modifier.fillMaxSize().testTag("projects-screen"), contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Проекты", style = MaterialTheme.typography.headlineMedium)
                Text("Структура задач и разделов на этом устройстве", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (experimental) OriginalImage("month-frieze-v2.png", null,
                    Modifier.fillMaxWidth().height(76.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("${structure.projects.size} проектов · ${tasks.count { !it.done }} активных задач",
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
                    FilterChip(selected = selectedCategory == category.id,
                        onClick = { selectedCategory = category.id }, label = { Text(category.name) },
                        modifier = Modifier.testTag("category-filter-${category.id}"))
                }
            }
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
                        Text(category.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = { editingCategory = category; categoryEditor = true; error = null }) { Text("Изменить") }
                    }
                }
            }
        }
        if (visible.isEmpty()) item { Text("В этом разделе пока нет проектов.") }
        items(visible, key = { it.first.id }) { (project, depth) ->
            val count = tasksByProject[project.id].orEmpty().size
            Surface(color = if (experimental && selectedProject == project.id) Color(0xffe4eeea)
                else MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium,
                tonalElevation = if (experimental) 0.dp else 1.dp) {
                Column(Modifier.fillMaxWidth().clickable { selectedProject = project.id }
                    .padding(start = (16 + depth.coerceAtMost(5) * 14).dp, end = 16.dp, top = 14.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(project.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                        Text("$count", style = MaterialTheme.typography.labelLarge)
                    }
                    val category = structure.categories.firstOrNull { it.id == project.categoryId }
                    Text(listOfNotNull(category?.name, project.status.takeIf { it != "active" }?.let {
                        if (it == "completed") "Завершён" else "Архив"
                    }).joinToString(" · ").ifBlank { "Без категории" },
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (selectedProject == project.id) {
                        if (project.description.isNotBlank()) Text(project.description, style = MaterialTheme.typography.bodyMedium)
                        tasksByProject[project.id].orEmpty().forEach { task ->
                            TextButton(onClick = { onOpenTask(task.id) }) { Text(task.title) }
                        }
                        TextButton(onClick = { onCreateTask(project.id) }) { Text("Создать задачу в проекте") }
                        TextButton(onClick = { editing = project; creating = true; error = null }) { Text("Изменить проект") }
                    }
                }
            }
        }
        item {
            Surface(color = background, shape = MaterialTheme.shapes.large) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Без проекта", color = onBackground, style = MaterialTheme.typography.titleMedium)
                    Text("${inbox.size} задач в Хаос-боксе",
                        color = subText, style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { onCreateTask(null) }, colors = ButtonDefaults.textButtonColors(contentColor = onBackground)) {
                        Text("Создать задачу без проекта")
                    }
                    if (selectedProject == null) {
                        inbox.take(if (inboxExpanded) inbox.size else 1).forEach { task ->
                            TextButton(onClick = { onOpenTask(task.id) },
                                colors = ButtonDefaults.textButtonColors(contentColor = onBackground)) { Text(task.title) }
                        }
                        if (inbox.size > 1) TextButton(onClick = { inboxExpanded = !inboxExpanded },
                            colors = ButtonDefaults.textButtonColors(contentColor = onBackground)) {
                            Text(if (inboxExpanded) "Свернуть список" else "Показать ещё ${inbox.size - 1}")
                        }
                    }
                }
            }
        }
        error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error) } }
        item {
            Text("Списки Google Tasks появятся здесь после подключения аккаунта.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                            label = { Text("  ".repeat(depth) + project.title) })
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
