package ru.genesis.calendar.ui

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.AccountSettings
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.data.*

internal fun personalProjectTree(root: GenesisProject, structure: WorkspaceStructure): List<GenesisProject> {
    val ids = WorkspaceStructureCodec.projectSubtreeIds(structure.projects, root.id)
    return WorkspaceStructureCodec.ordered(structure).map { it.first }.filter { it.id in ids }
}

internal fun personalProjectImportPayload(root: GenesisProject, tree: List<GenesisProject>,
    tasks: List<LocalTask>, categories: List<GenesisCategory>, transferId: String, mode: String): JSONObject {
    val categoryById = categories.associateBy { it.id }
    val categoryRows = JSONArray()
    tree.forEach { project ->
        val ids = (listOfNotNull(project.categoryId) + tasks.filter { it.projectId == project.id }
            .mapNotNull { it.categoryId }).distinct()
        ids.forEach { id ->
            categoryById[id]?.let { category ->
                categoryRows.put(JSONObject().put("sourceId", id).put("projectSourceId", project.id)
                    .put("title", category.name).put("color", category.color))
            }
        }
    }
    return JSONObject().put("transferId", transferId).put("mode", mode)
        .put("projects", JSONArray().apply { tree.forEach { project ->
            put(JSONObject().put("sourceId", project.id)
                .put("parentSourceId", if (project.id == root.id) JSONObject.NULL else project.parentId)
                .put("title", project.title).put("description", project.description).put("layout", "list"))
        } })
        .put("categories", categoryRows)
        .put("tasks", JSONArray().apply { tasks.forEach { task ->
            put(JSONObject().put("sourceId", task.id).put("projectSourceId", task.projectId ?: JSONObject.NULL)
                .put("categorySourceId", task.categoryId ?: JSONObject.NULL)
                .put("title", task.title.trim().replace(Regex("\\s+"), " "))
                .put("description", task.description.trim())
                .put("dueDate", task.date).put("done", task.done))
        } })
}

@Composable
internal fun PersonalProjectTransferDialog(root: GenesisProject, structure: WorkspaceStructure,
    allTasks: List<LocalTask>, controller: AuthController, account: AccountSettings?, language: String,
    workspaceScope: String, onDismiss: () -> Unit,
    onMoved: suspend (List<GenesisProject>, List<LocalTask>) -> Unit) {
    val en = language == "en"
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tree = remember(root, structure) { personalProjectTree(root, structure) }
    val ids = remember(tree) { tree.map { it.id }.toSet() }
    val tasks = remember(allTasks, ids) { allTasks.filter { it.projectId in ids } }
    val linkedLists = structure.taskListLinks.count { it.projectId in ids }
    val categoryIds = structure.categories.map { it.id }.toSet()
    val missingCategories = tasks.any { it.categoryId != null && it.categoryId !in categoryIds }
    val canPublish = tree.size in 1..50 && tasks.size <= 500 && !missingCategories &&
        tree.sumOf { project -> (listOfNotNull(project.categoryId) + tasks.filter { it.projectId == project.id }
            .mapNotNull { it.categoryId }).distinct().size } <= 200
    val canMove = canPublish && linkedLists == 0 &&
        tree.all { it.status == "active" && it.tags.isEmpty() } &&
        tasks.none { privateMoveRestriction(it, account, allowCategory = true) }
    var spaces by remember(root.id) { mutableStateOf<List<JSONObject>>(emptyList()) }
    var spaceId by remember(root.id) { mutableStateOf("") }
    var menuOpen by remember { mutableStateOf(false) }
    var consent by remember(root.id) { mutableStateOf(false) }
    var details by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    LaunchedEffect(root.id) {
        try {
            val rows = controller.sharedSpaces().getJSONArray("spaces")
            spaces = (0 until rows.length()).map(rows::getJSONObject)
                .filter { it.optString("role") in setOf("owner", "admin", "member") }
            spaceId = spaces.firstOrNull()?.optString("id").orEmpty()
        } catch (cause: CancellationException) { throw cause }
        catch (cause: Exception) { error = cause.message ?: "Не удалось загрузить пространства." }
    }

    fun publish(mode: String) {
        if (busy || !consent || spaceId.isBlank() || !canPublish || mode == "move" && !canMove) return
        busy = true; error = ""
        scope.launch {
            try {
                val prefs = context.getSharedPreferences("genesis-project-imports", Context.MODE_PRIVATE)
                val fingerprint = UUID.nameUUIDFromBytes(("$spaceId:${structure.revision}:" +
                    tasks.joinToString(",") { "${it.id}:${it.revision}" }).toByteArray(Charsets.UTF_8))
                val key = "$workspaceScope:${root.id}:$mode:$fingerprint"
                val transferId = prefs.getString(key, null) ?: UUID.randomUUID().toString().also {
                    check(prefs.edit().putString(key, it).commit()) { "Не удалось сохранить идентификатор переноса." }
                }
                val payload = personalProjectImportPayload(root, tree, tasks, structure.categories, transferId, mode)
                val receipt = controller.importSharedProject(spaceId, payload).optJSONObject("receipt")
                    ?: throw IllegalStateException("Сервер не подтвердил перенос проекта.")
                val projectIds = receipt.optJSONObject("projectIds")
                val taskIds = receipt.optJSONObject("taskIds")
                check(receipt.optString("mode") == mode &&
                    receipt.optString("rootProjectId") == projectIds?.optString(root.id) &&
                    projectIds?.length() == tree.size && taskIds?.length() == tasks.size) {
                    if (en) "The server did not confirm the complete project."
                    else "Сервер не подтвердил полный перенос проекта."
                }
                if (mode == "move") onMoved(tree, tasks)
                prefs.edit().remove(key).apply()
                onDismiss()
            } catch (cause: CancellationException) { throw cause }
            catch (cause: Exception) { error = cause.message ?: if (en) "Could not share the project." else "Не удалось перенести проект." }
            finally { busy = false }
        }
    }

    AlertDialog(onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (en) "Share a project" else "Переместить проект в общие") },
        text = { Column(Modifier.heightIn(max = 540.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (en) "Review the entire tree before members can see it."
                else "Проверьте состав проекта: участники увидят перечисленные данные.")
            Box {
                TextButton(onClick = { menuOpen = true }, enabled = !busy && spaces.isNotEmpty()) {
                    Text(spaces.firstOrNull { it.optString("id") == spaceId }?.optString("title")
                        ?: if (en) "Create a shared space first" else "Сначала создайте общее пространство")
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    spaces.forEach { space -> DropdownMenuItem(text = { Text(space.optString("title")) },
                        onClick = { spaceId = space.optString("id"); menuOpen = false }) }
                }
            }
            Text(root.title, style = MaterialTheme.typography.titleSmall)
            Text(if (en) "${tree.size} projects · ${tasks.size} tasks"
                else "${tree.size} проектов · ${tasks.size} задач")
            Text(if (en) "Members receive titles, descriptions, dates, completion state and categories. Times, reminders, repeats and Google links are not transferred."
                else "Участники получат названия, описания, сроки, состояние и категории. Время, напоминания, повторы и связи Google не передаются.",
                style = MaterialTheme.typography.bodySmall)
            tree.forEach { Text("${if (it.id == root.id) "◇" else "↳"} ${it.title}") }
            TextButton(onClick = { details = !details }) {
                Text(if (en) "${if (details) "Hide" else "Review"} every task"
                    else "${if (details) "Скрыть" else "Просмотреть"} все задачи")
            }
            if (details) tasks.forEach { task ->
                Text(buildString {
                    append(task.title)
                    if (task.description.isNotBlank()) append(" — ${task.description}")
                    append(" · ${task.date}")
                    if (task.done) append(" · ✓")
                }, style = MaterialTheme.typography.bodySmall)
            }
            Row {
                Checkbox(checked = consent, onCheckedChange = { consent = it }, enabled = !busy)
                Text(if (en) "I agree that members can see these projects and tasks by role."
                    else "Согласен открыть эти проекты и задачи участникам согласно их ролям.")
            }
            if (!canMove) Text(if (en) "Moving is unavailable because some fields or linked lists cannot be preserved. You can copy the basic fields."
                else "Перемещение недоступно: некоторые поля или связанные списки нельзя сохранить. Можно скопировать основные поля.",
                style = MaterialTheme.typography.bodySmall)
            if (!canPublish) Text(if (en) "This tree is too large or contains a missing category."
                else "Дерево превышает допустимый размер или в нём отсутствует категория.",
                color = MaterialTheme.colorScheme.error)
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        } },
        confirmButton = { Row {
            TextButton(onClick = { publish("copy") }, enabled = !busy && consent && spaceId.isNotBlank() && canPublish,
                modifier = Modifier.testTag("copy-personal-project")) { Text(if (en) "Copy" else "Копировать") }
            TextButton(onClick = { publish("move") }, enabled = !busy && consent && spaceId.isNotBlank() && canMove,
                modifier = Modifier.testTag("move-personal-project")) { Text(if (en) "Move" else "Переместить") }
        } },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text(if (en) "Cancel" else "Отмена") } })
}
