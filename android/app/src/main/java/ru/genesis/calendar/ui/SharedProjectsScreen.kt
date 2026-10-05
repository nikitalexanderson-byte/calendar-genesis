package ru.genesis.calendar.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.AuthController
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun JSONArray.rows(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

private fun sharedRoleLabel(role: String, en: Boolean): String = when (role) {
    "owner" -> if (en) "Owner" else "Владелец"
    "manager" -> if (en) "Manager" else "Менеджер"
    "member" -> if (en) "Member" else "Участник"
    "commenter" -> if (en) "Commenter" else "Комментатор"
    "viewer" -> if (en) "Viewer" else "Читатель"
    "admin" -> if (en) "Admin" else "Администратор"
    "guest" -> if (en) "Guest" else "Гость"
    else -> role
}

private fun sharedStatusLabel(title: String, en: Boolean): String = if (!en) title else when (title) {
    "К выполнению" -> "To do"
    "В работе" -> "In progress"
    "Готово" -> "Done"
    else -> title
}

@Composable
internal fun SharedProjectsScreen(controller: AuthController, language: String) {
    val en = language == "en"
    val scope = rememberCoroutineScope()
    var spaces by remember { mutableStateOf(emptyList<JSONObject>()) }
    var projects by remember { mutableStateOf(emptyList<JSONObject>()) }
    var archivedProjects by remember { mutableStateOf(emptyList<JSONObject>()) }
    var snapshot by remember { mutableStateOf<JSONObject?>(null) }
    var comments by remember { mutableStateOf(emptyList<JSONObject>()) }
    var spaceId by remember { mutableStateOf("") }
    var projectId by remember { mutableStateOf("") }
    var viewOverride by remember { mutableStateOf<String?>(null) }
    var calendarMonth by remember { mutableStateOf(YearMonth.now()) }
    var calendarDay by remember { mutableStateOf(LocalDate.now()) }
    var showUndated by remember { mutableStateOf(false) }
    var taskId by remember { mutableStateOf("") }
    var showJoin by remember { mutableStateOf(false) }
    var createModal by remember { mutableStateOf<String?>(null) }
    var showManagement by remember { mutableStateOf(false) }
    var spaceTitle by remember { mutableStateOf("") }
    var projectTitle by remember { mutableStateOf("") }
    var projectDescription by remember { mutableStateOf("") }
    var boardLayout by remember { mutableStateOf(false) }
    var parentId by remember { mutableStateOf("") }
    var editTitle by remember { mutableStateOf("") }
    var editDescription by remember { mutableStateOf("") }
    var editBoardLayout by remember { mutableStateOf(false) }
    var editParentId by remember { mutableStateOf("") }
    var memberToRemove by remember { mutableStateOf<String?>(null) }
    var projectToArchive by remember { mutableStateOf<String?>(null) }
    var newStatusTitle by remember { mutableStateOf("") }
    var newStatusDone by remember { mutableStateOf(false) }
    var editingStatusId by remember { mutableStateOf("") }
    var statusTitleDraft by remember { mutableStateOf("") }
    var statusDestinations by remember { mutableStateOf(emptyMap<String, String>()) }
    var statusToDelete by remember { mutableStateOf<JSONObject?>(null) }
    var newCategoryTitle by remember { mutableStateOf("") }
    var newCategoryColor by remember { mutableStateOf("#2d6c68") }
    var editingCategoryId by remember { mutableStateOf("") }
    var categoryTitleDraft by remember { mutableStateOf("") }
    var categoryColorDraft by remember { mutableStateOf("#2d6c68") }
    var categoryToDelete by remember { mutableStateOf<JSONObject?>(null) }
    var newTaskCategoryId by remember { mutableStateOf("") }
    var newTaskStatusId by remember { mutableStateOf("") }
    var newTaskAssigneeId by remember { mutableStateOf("") }
    var newTaskDescription by remember { mutableStateOf("") }
    var newTaskDueDate by remember { mutableStateOf("") }
    var editTaskCategoryId by remember { mutableStateOf("") }
    var taskTitle by remember { mutableStateOf("") }
    var inviteEmail by remember { mutableStateOf("") }
    var inviteRole by remember { mutableStateOf("member") }
    var inviteToken by remember { mutableStateOf("") }
    var inviteLink by remember { mutableStateOf("") }
    var commentBody by remember { mutableStateOf("") }
    var editTaskTitle by remember { mutableStateOf("") }
    var editTaskDescription by remember { mutableStateOf("") }
    var editTaskDueDate by remember { mutableStateOf("") }
    var editTaskRevision by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    suspend fun refreshSpaces() {
        val rows = controller.sharedSpaces().getJSONArray("spaces").rows()
        spaces = rows
        if (rows.none { it.getString("id") == spaceId }) spaceId = rows.firstOrNull()?.getString("id") ?: ""
    }
    suspend fun refreshProjects(id: String) {
        val rows = controller.sharedProjects(id).getJSONArray("projects").rows()
        archivedProjects = controller.archivedSharedProjects(id).getJSONArray("projects").rows()
        projects = rows
        if (rows.none { it.getString("id") == projectId }) projectId = rows.firstOrNull()?.getString("id") ?: ""
    }
    suspend fun refreshProject(id: String) {
        val result = controller.sharedProject(id)
        snapshot = result
        if (result.getJSONArray("tasks").rows().none { it.getString("id") == taskId }) taskId = ""
    }
    fun run(action: suspend () -> Unit) {
        scope.launch {
            busy = true; message = ""
            try { action() } catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
            finally { busy = false }
        }
    }
    LaunchedEffect(Unit) {
        try { refreshSpaces() } catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
    }
    LaunchedEffect(spaceId) {
        if (spaceId.isNotBlank()) try { refreshProjects(spaceId) }
            catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
        else { projects = emptyList(); projectId = "" }
    }
    LaunchedEffect(projectId) {
        if (projectId.isBlank()) { snapshot = null; return@LaunchedEffect }
        while (isActive) {
            try {
                refreshProject(projectId)
                if (spaceId.isNotBlank()) refreshProjects(spaceId)
            } catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
            delay(5_000)
        }
    }
    LaunchedEffect(projectId, taskId) {
        comments = if (projectId.isNotBlank() && taskId.isNotBlank()) try {
            controller.sharedComments(projectId, taskId).getJSONArray("comments").rows()
        } catch (error: Exception) { message = error.message ?: "Ошибка сервера"; emptyList() }
        else emptyList()
    }

    val project = snapshot?.getJSONObject("project")
    val statuses = snapshot?.getJSONArray("statuses")?.rows().orEmpty()
    val categories = snapshot?.optJSONArray("categories")?.rows().orEmpty()
    val tasks = snapshot?.getJSONArray("tasks")?.rows().orEmpty()
    val inboxProject = projects.firstOrNull { it.optInt("isInbox") == 1 }
    val members = snapshot?.getJSONArray("members")?.rows().orEmpty()
    val role = project?.optString("role") ?: ""
    val canWrite = role in setOf("owner", "manager", "member")
    val canComment = role in setOf("owner", "manager", "member", "commenter")
    val canInvite = role in setOf("owner", "manager")
    val selectedTask = tasks.firstOrNull { it.optString("id") == taskId }
    val activeView = viewOverride ?: project?.optString("layout") ?: "list"
    val categoryColors = listOf("#2d6c68", "#a5543f", "#b18b48", "#665c88", "#54718a")
    val pageScroll = rememberScrollState()
    LaunchedEffect(spaceId, projectId) { pageScroll.scrollTo(0) }
    LaunchedEffect(taskId, selectedTask?.optInt("revision")) {
        if (selectedTask != null) {
            withFrameNanos { }
            pageScroll.animateScrollTo(pageScroll.maxValue)
        }
    }
    LaunchedEffect(projectId, taskId) {
        editTaskTitle = selectedTask?.optString("title") ?: ""
        editTaskDescription = selectedTask?.optString("description") ?: ""
        editTaskDueDate = selectedTask?.optString("dueDate")?.takeUnless { it == "null" } ?: ""
        editTaskCategoryId = selectedTask?.optString("categoryId")?.takeUnless { it == "null" } ?: ""
        editTaskRevision = selectedTask?.optInt("revision") ?: 0
    }
    LaunchedEffect(projectId, project?.optInt("revision")) {
        editTitle = project?.optString("title") ?: ""
        editDescription = project?.optString("description") ?: ""
        editBoardLayout = project?.optString("layout") == "board"
        editParentId = project?.optString("parentId")?.takeUnless { it == "null" } ?: ""
    }
    if (memberToRemove != null) AlertDialog(
        onDismissRequest = { memberToRemove = null },
        title = { Text(if (en) "Remove participant?" else "Удалить участника?") },
        confirmButton = { TextButton(onClick = {
            val target = memberToRemove ?: return@TextButton
            memberToRemove = null
            run { controller.removeSharedMember(projectId, target); refreshProject(projectId) }
        }) { Text(if (en) "Remove" else "Удалить") } },
        dismissButton = { TextButton(onClick = { memberToRemove = null }) { Text(if (en) "Cancel" else "Отмена") } },
    )
    if (projectToArchive != null) AlertDialog(
        onDismissRequest = { projectToArchive = null },
        title = { Text(if (en) "Archive project?" else "Архивировать проект?") },
        text = { Text(if (en) "Tasks will be kept and the project can be restored."
            else "Задачи сохранятся, проект можно восстановить.") },
        confirmButton = { TextButton(onClick = {
            val target = projectToArchive ?: return@TextButton
            projectToArchive = null
            run { controller.setSharedProjectArchived(target, true); snapshot = null; refreshProjects(spaceId) }
        }) { Text(if (en) "Archive" else "В архив") } },
        dismissButton = { TextButton(onClick = { projectToArchive = null }) { Text(if (en) "Cancel" else "Отмена") } },
    )
    if (statusToDelete != null) {
        val source = statusToDelete!!
        val destinations = statuses.filter { it.optString("id") != source.optString("id") }
        val destinationId = statusDestinations[source.optString("id")]
            ?.takeIf { chosen -> destinations.any { it.optString("id") == chosen } }
            ?: destinations.firstOrNull()?.optString("id").orEmpty()
        AlertDialog(onDismissRequest = { statusToDelete = null },
            title = { Text(if (en) "Delete status?" else "Удалить статус?") },
            text = { Text(if (en) "Tasks will move to the selected status."
                else "Задачи перейдут в выбранный статус.") },
            confirmButton = { TextButton(onClick = {
                val current = statusToDelete ?: return@TextButton
                statusToDelete = null
                run { controller.deleteSharedStatus(projectId, current.getString("id"),
                    destinationId, current.getInt("revision")); refreshProject(projectId) }
            }, enabled = destinationId.isNotBlank()) { Text(if (en) "Delete" else "Удалить") } },
            dismissButton = { TextButton(onClick = { statusToDelete = null }) { Text(if (en) "Cancel" else "Отмена") } })
    }
    if (categoryToDelete != null) AlertDialog(
        onDismissRequest = { categoryToDelete = null },
        title = { Text(if (en) "Delete category?" else "Удалить категорию?") },
        text = { Text(if (en) "Tasks will remain without a category."
            else "Задачи останутся без категории.") },
        confirmButton = { TextButton(onClick = {
            val category = categoryToDelete ?: return@TextButton
            categoryToDelete = null
            run {
                controller.deleteSharedCategory(projectId, category.getString("id"), category.getInt("revision"))
                if (newTaskCategoryId == category.getString("id")) newTaskCategoryId = ""
                if (editTaskCategoryId == category.getString("id")) editTaskCategoryId = ""
                refreshProject(projectId)
            }
        }) { Text(if (en) "Delete" else "Удалить") } },
        dismissButton = { TextButton(onClick = { categoryToDelete = null }) { Text(if (en) "Cancel" else "Отмена") } },
    )
    if (createModal != null) {
        val modal = createModal!!
        val validDate = newTaskDueDate.isBlank() || runCatching { LocalDate.parse(newTaskDueDate) }.isSuccess
        AlertDialog(onDismissRequest = { if (!busy) createModal = null },
            title = { Text(when (modal) {
                "space" -> if (en) "New workspace" else "Новое пространство"
                "project" -> if (en) "New shared project" else "Новый общий проект"
                "task" -> if (en) "New team task" else "Новая задача команды"
                "status" -> if (en) "New task list / board column" else "Новый список задач / колонка доски"
                "category" -> if (en) "New category" else "Новая категория"
                else -> if (en) "Invite a participant" else "Пригласить участника"
            }) },
            text = { Column(Modifier.fillMaxWidth().heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when (modal) {
                    "space" -> OutlinedTextField(spaceTitle, { spaceTitle = it },
                        label = { Text(if (en) "Workspace name" else "Название пространства") }, modifier = Modifier.fillMaxWidth())
                    "project" -> {
                        OutlinedTextField(projectTitle, { projectTitle = it },
                            label = { Text(if (en) "Project name" else "Название проекта") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(projectDescription, { projectDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                        Text(if (en) "Layout" else "Вид", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = !boardLayout, onClick = { boardLayout = false }, label = { Text(if (en) "Task container" else "Контейнер задач") })
                            FilterChip(selected = boardLayout, onClick = { boardLayout = true }, label = { Text(if (en) "Board" else "Доска") })
                        }
                        Text(if (en) "Parent project" else "Родительский проект", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = parentId.isBlank(), onClick = { parentId = "" }, label = { Text(if (en) "Top level" else "Верхний уровень") })
                            projects.filter { it.optInt("isInbox") == 0 }.forEach { item ->
                                FilterChip(selected = parentId == item.optString("id"), onClick = { parentId = item.optString("id") },
                                    label = { Text(item.optString("title")) })
                            }
                        }
                    }
                    "task" -> {
                        OutlinedTextField(taskTitle, { taskTitle = it },
                            label = { Text(if (en) "Name" else "Название") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(newTaskDescription, { newTaskDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(newTaskDueDate, { newTaskDueDate = it },
                            label = { Text(if (en) "Due date (YYYY-MM-DD)" else "Срок (ГГГГ-ММ-ДД)") },
                            isError = !validDate, modifier = Modifier.fillMaxWidth())
                        Text(if (en) "Task list / status" else "Список задач / статус", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            statuses.forEach { status -> FilterChip(
                                selected = (newTaskStatusId.ifBlank { statuses.firstOrNull()?.optString("id").orEmpty() }) == status.optString("id"),
                                onClick = { newTaskStatusId = status.optString("id") },
                                label = { Text(sharedStatusLabel(status.optString("title"), en)) }) }
                        }
                        Text(if (en) "Category" else "Категория", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + categories).forEach { category ->
                                val id = category?.optString("id") ?: ""
                                FilterChip(selected = newTaskCategoryId == id, onClick = { newTaskCategoryId = id },
                                    label = { Text(category?.optString("title") ?: if (en) "No category" else "Без категории") })
                            }
                        }
                        Text(if (en) "Assigned to" else "Исполнитель", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + members).forEach { member ->
                                val id = member?.optString("userId") ?: ""
                                FilterChip(selected = newTaskAssigneeId == id, onClick = { newTaskAssigneeId = id },
                                    label = { Text(member?.optString("displayName") ?: if (en) "Unassigned" else "Не назначен") })
                            }
                        }
                    }
                    "status" -> {
                        OutlinedTextField(newStatusTitle, { newStatusTitle = it },
                            label = { Text(if (en) "List name" else "Название списка") }, modifier = Modifier.fillMaxWidth())
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Checkbox(checked = newStatusDone, onCheckedChange = { newStatusDone = it })
                            Text(if (en) "Completed tasks" else "Список завершённых задач")
                        }
                    }
                    "category" -> {
                        OutlinedTextField(newCategoryTitle, { newCategoryTitle = it },
                            label = { Text(if (en) "Category name" else "Название категории") }, modifier = Modifier.fillMaxWidth())
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            categoryColors.forEach { color -> FilterChip(selected = newCategoryColor == color,
                                onClick = { newCategoryColor = color }, label = { Text("●", color = Color(android.graphics.Color.parseColor(color))) }) }
                        }
                    }
                    "invite" -> {
                        OutlinedTextField(inviteEmail, { inviteEmail = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("manager", "member", "commenter", "viewer").forEach { value ->
                                FilterChip(selected = inviteRole == value, onClick = { inviteRole = value },
                                    label = { Text(sharedRoleLabel(value, en)) })
                            }
                        }
                    }
                }
            } },
            confirmButton = { TextButton(onClick = { run {
                when (modal) {
                    "space" -> {
                        val created = controller.createSharedSpace(spaceTitle.trim()).getJSONObject("space")
                        spaceTitle = ""; refreshSpaces(); spaceId = created.getString("id")
                    }
                    "project" -> {
                        val created = controller.createSharedProject(spaceId, projectTitle.trim(), projectDescription.trim(),
                            if (boardLayout) "board" else "list", parentId.ifBlank { null }).getJSONObject("project")
                        projectTitle = ""; projectDescription = ""; parentId = ""
                        refreshProjects(spaceId); projectId = created.getString("id")
                    }
                    "task" -> {
                        controller.createSharedTask(projectId, JSONObject().put("title", taskTitle.trim())
                            .put("description", newTaskDescription.trim())
                            .put("dueDate", newTaskDueDate.ifBlank { null } ?: JSONObject.NULL)
                            .put("statusId", newTaskStatusId.ifBlank { statuses.first().getString("id") })
                            .put("categoryId", newTaskCategoryId.ifBlank { null } ?: JSONObject.NULL)
                            .put("assigneeId", newTaskAssigneeId.ifBlank { null } ?: JSONObject.NULL))
                        taskTitle = ""; newTaskDescription = ""; newTaskDueDate = ""
                        newTaskStatusId = ""; newTaskCategoryId = ""; newTaskAssigneeId = ""
                        refreshProject(projectId)
                    }
                    "status" -> {
                        controller.createSharedStatus(projectId, newStatusTitle.trim(), newStatusDone)
                        newStatusTitle = ""; newStatusDone = false; refreshProject(projectId)
                    }
                    "category" -> {
                        controller.createSharedCategory(projectId, newCategoryTitle.trim(), newCategoryColor)
                        newCategoryTitle = ""; refreshProject(projectId)
                    }
                    "invite" -> {
                        val item = controller.inviteSharedMember(projectId, inviteEmail.trim(), inviteRole).getJSONObject("invitation")
                        inviteLink = "https://genesiscalendar.ru/?shared_invite=${item.getString("token")}"
                        message = if (en) "Share this link privately with the named person" else "Передайте ссылку указанному человеку лично"
                    }
                }
                createModal = null
            } }, enabled = !busy && when (modal) {
                "space" -> spaceTitle.isNotBlank()
                "project" -> projectTitle.isNotBlank()
                "task" -> taskTitle.isNotBlank() && statuses.isNotEmpty() && validDate
                "status" -> newStatusTitle.isNotBlank() && statuses.size < 20
                "category" -> newCategoryTitle.isNotBlank() && categories.size < 50
                else -> inviteEmail.isNotBlank()
            }) { Text(if (en) "Create" else "Создать") } },
            dismissButton = { TextButton(onClick = { createModal = null }, enabled = !busy) {
                Text(if (en) "Cancel" else "Отмена")
            } })
    }
    Column(Modifier.fillMaxSize().verticalScroll(pageScroll).padding(16.dp)
        .testTag("shared-projects-screen"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GenesisPageHeader(if (en) "Projects - shared" else "Проекты - общие",
            if (en) "Team projects, tasks and people in one place."
            else "Проекты, задачи и участники команды в одном месте.",
            "",
            icon = GenesisPageIcon.PROJECTS_SHARED)
        if (inboxProject != null) SharedBlock(if (en) "Shared inbox" else "Хаос-бокс") {
            Text(if (en) "Unsorted team tasks" else "Общие задачи без проекта",
                style = MaterialTheme.typography.labelMedium)
            Text(if (en) "${inboxProject.optInt("taskCount")} tasks" else "Задач: ${inboxProject.optInt("taskCount")}",
                style = MaterialTheme.typography.titleMedium)
            Text(if (en) "Keep new tasks here, then place them in a team project."
                else "Собирайте новые задачи здесь, затем распределяйте их по проектам команды.",
                style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { projectId = inboxProject.getString("id"); snapshot = null },
                enabled = projectId != inboxProject.optString("id")) {
                Text(if (en) "Open shared inbox" else "Открыть хаос-бокс")
            }
        }
        SharedBlock(if (en) "Access" else "Доступ") {
        Text(if (en) "Project content is visible to invited members and processed on the GENESIS server."
            else "Содержимое проекта видно приглашённым участникам и обрабатывается сервером GENESIS.",
            style = MaterialTheme.typography.bodySmall)
        if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error)

        TextButton(onClick = { showJoin = !showJoin }, modifier = Modifier.fillMaxWidth()) {
            Text(if (en) "Join by invitation" else "Вступить по приглашению")
        }
        if (showJoin) {
            OutlinedTextField(inviteToken, { inviteToken = it }, label = { Text(if (en) "Invitation token" else "Код приглашения") },
                modifier = Modifier.fillMaxWidth())
            Button(onClick = { run {
                val result = controller.acceptSharedInvitation(inviteToken.trim())
                inviteToken = ""; showJoin = false; refreshSpaces(); spaceId = result.getString("spaceId")
                refreshProjects(spaceId); projectId = result.getString("projectId")
                message = if (en) "Invitation accepted" else "Приглашение принято"
            } }, enabled = !busy && inviteToken.isNotBlank()) { Text(if (en) "Join project" else "Вступить в проект") }
        }
        }

        SharedBlock(if (en) "Workspaces and projects" else "Пространства и проекты") {
        if (spaces.isEmpty()) {
            Button(onClick = { createModal = "space" }, enabled = !busy) {
                Text(if (en) "Create workspace" else "Создать пространство")
            }
        } else {
            Text(if (en) "Workspace" else "Пространство", style = MaterialTheme.typography.titleSmall)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                spaces.forEach { item -> FilterChip(selected = spaceId == item.getString("id"),
                    onClick = { spaceId = item.getString("id"); projectId = ""; snapshot = null },
                    label = { Text(item.getString("title")) }) }
            }
            TextButton(onClick = { createModal = "space" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (en) "Create another workspace" else "Создать ещё пространство")
            }
        }
        if (spaceId.isNotBlank()) {
            HorizontalDivider()
            Text(if (en) "Projects" else "Проекты", style = MaterialTheme.typography.titleMedium)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                projects.forEach { item -> FilterChip(selected = projectId == item.getString("id"),
                    onClick = { projectId = item.getString("id"); snapshot = null; viewOverride = null },
                    label = { Text(item.getString("title")) }) }
            }
            TextButton(onClick = { createModal = "project" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (en) "Create shared project" else "Создать общий проект")
            }
            if (archivedProjects.isNotEmpty()) {
                Text(if (en) "Archived projects" else "Архив проектов", style = MaterialTheme.typography.titleMedium)
                archivedProjects.forEach { item -> Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(item.optString("title"), modifier = Modifier.weight(1f))
                    if (item.optString("role") == "owner") TextButton(onClick = { run {
                        controller.setSharedProjectArchived(item.getString("id"), false)
                        refreshProjects(spaceId); projectId = item.getString("id")
                    } }, enabled = !busy) { Text(if (en) "Restore" else "Восстановить") }
                } }
            }
        }
        }
        if (project != null) {
            SharedBlock(if (en) "Project and team" else "Проект и команда") {
            if (project.optInt("isInbox") == 0) Text(project.optString("title"),
                style = MaterialTheme.typography.titleMedium)
            Text((if (en) "Your role: " else "Ваша роль: ") + sharedRoleLabel(role, en), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { showManagement = !showManagement }, modifier = Modifier.fillMaxWidth()) {
                Text(if (en) "Project and team settings" else "Проект и команда")
            }
            if (showManagement) {
            if (canInvite && project.optInt("isInbox") == 0) {
                Text(if (en) "Project settings" else "Настройки проекта", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(editTitle, { editTitle = it }, label = { Text(if (en) "Name" else "Название") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(editDescription, { editDescription = it }, label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = !editBoardLayout, onClick = { editBoardLayout = false }, label = { Text(if (en) "Task container" else "Контейнер задач") })
                    FilterChip(selected = editBoardLayout, onClick = { editBoardLayout = true }, label = { Text(if (en) "Board" else "Доска") })
                }
                Text(if (en) "Parent project" else "Родительский проект", style = MaterialTheme.typography.titleSmall)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = editParentId.isBlank(), onClick = { editParentId = "" }, label = { Text(if (en) "Top level" else "Верхний уровень") })
                    projects.filter { it.optInt("isInbox") == 0 && it.getString("id") != projectId }.forEach { item ->
                        FilterChip(selected = editParentId == item.getString("id"), onClick = { editParentId = item.getString("id") },
                            label = { Text(item.getString("title")) })
                    }
                }
                Button(onClick = { run {
                    controller.updateSharedProject(projectId, JSONObject()
                        .put("title", editTitle.trim()).put("description", editDescription.trim())
                        .put("layout", if (editBoardLayout) "board" else "list")
                        .put("parentId", editParentId.ifBlank { null } ?: JSONObject.NULL)
                        .put("expectedRevision", project.getInt("revision")))
                    refreshProjects(spaceId); refreshProject(projectId)
                } }, enabled = !busy && editTitle.isNotBlank()) { Text(if (en) "Save project" else "Сохранить проект") }
                if (role == "owner") TextButton(onClick = { projectToArchive = projectId }, enabled = !busy) {
                    Text(if (en) "Archive project" else "Архивировать проект")
                }
            }
            Text(if (en) "Participants and roles" else "Участники и роли", style = MaterialTheme.typography.titleMedium)
            members.forEach { member ->
                ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(member.optString("displayName"))
                    Text(if (en) "Workspace access" else "Доступ к пространству", style = MaterialTheme.typography.bodySmall)
                    if (project.optString("spaceRole") == "owner") {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("owner", "admin", "member", "guest").forEach { value ->
                                FilterChip(selected = member.optString("spaceRole") == value,
                                    onClick = { run {
                                        controller.changeSharedSpaceRole(spaceId, member.getString("userId"), value)
                                        refreshProject(projectId); refreshProjects(spaceId)
                                    } }, enabled = !busy, label = { Text(sharedRoleLabel(value, en)) })
                            }
                        }
                    } else Text(sharedRoleLabel(member.optString("spaceRole"), en))
                    if (role == "owner" && project.optInt("isInbox") == 0) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("owner", "manager", "member", "commenter", "viewer").forEach { value ->
                                FilterChip(selected = member.optString("role") == value,
                                    onClick = { run {
                                        controller.changeSharedMemberRole(projectId, member.getString("userId"), value)
                                        refreshProject(projectId)
                                    } }, enabled = !busy, label = { Text(sharedRoleLabel(value, en)) })
                            }
                        }
                        TextButton(onClick = { memberToRemove = member.getString("userId") },
                            enabled = !busy && !(member.optString("role") == "owner" && members.count { it.optString("role") == "owner" } == 1)) {
                            Text(if (en) "Remove participant" else "Удалить участника")
                        }
                    } else Text(sharedRoleLabel(member.optString("role"), en))
                } }
            }
            if (canInvite) {
                Text(if (en) "Board statuses" else "Статусы доски", style = MaterialTheme.typography.titleMedium)
                statuses.forEach { status ->
                    val id = status.getString("id")
                    val destinations = statuses.filter { it.getString("id") != id }
                    val destinationId = statusDestinations[id]
                        ?.takeIf { chosen -> destinations.any { it.getString("id") == chosen } }
                        ?: destinations.firstOrNull()?.getString("id").orEmpty()
                    val lastDone = status.optInt("isDone") == 1 && statuses.count { it.optInt("isDone") == 1 } == 1
                    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(sharedStatusLabel(status.getString("title"), en), style = MaterialTheme.typography.titleSmall)
                        Text(if (status.optInt("isDone") == 1) (if (en) "Completed" else "Завершено")
                            else (if (en) "Active" else "В работе"), style = MaterialTheme.typography.bodySmall)
                        if (editingStatusId == id) {
                            OutlinedTextField(statusTitleDraft, { statusTitleDraft = it },
                                label = { Text(if (en) "Status name" else "Название статуса") }, modifier = Modifier.fillMaxWidth())
                            Button(onClick = { run {
                                controller.updateSharedStatus(projectId, id, statusTitleDraft.trim(), status.getInt("revision"))
                                editingStatusId = ""; refreshProject(projectId)
                            } }, enabled = !busy && statusTitleDraft.isNotBlank()) { Text(if (en) "Save name" else "Сохранить название") }
                        } else TextButton(onClick = { editingStatusId = id; statusTitleDraft = sharedStatusLabel(status.getString("title"), en) }) {
                            Text(if (en) "Rename" else "Переименовать")
                        }
                        if (destinations.isNotEmpty() && !lastDone) {
                            Text(if (en) "Move tasks to" else "Перенести задачи в", style = MaterialTheme.typography.bodySmall)
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                destinations.forEach { target -> FilterChip(selected = destinationId == target.getString("id"),
                                    onClick = { statusDestinations = statusDestinations + (id to target.getString("id")) },
                                    label = { Text(sharedStatusLabel(target.getString("title"), en)) }) }
                            }
                            TextButton(onClick = { statusToDelete = status }, enabled = !busy) {
                                Text(if (en) "Delete status" else "Удалить статус")
                            }
                        }
                    } }
                }
            }
            if (canInvite) {
                Text(if (en) "Project categories" else "Категории проекта", style = MaterialTheme.typography.titleMedium)
                categories.forEach { category -> ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("●", color = runCatching { Color(android.graphics.Color.parseColor(category.optString("color"))) }
                                .getOrDefault(MaterialTheme.colorScheme.secondary))
                            Text(category.optString("title"))
                        }
                        if (editingCategoryId == category.optString("id")) {
                            OutlinedTextField(categoryTitleDraft, { categoryTitleDraft = it },
                                label = { Text(if (en) "Category name" else "Название категории") }, modifier = Modifier.fillMaxWidth())
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                categoryColors.forEach { color -> FilterChip(selected = categoryColorDraft == color,
                                    onClick = { categoryColorDraft = color }, label = {
                                        Text("●", color = Color(android.graphics.Color.parseColor(color)))
                                    }) }
                            }
                            Button(onClick = { run {
                                controller.updateSharedCategory(projectId, category.getString("id"),
                                    categoryTitleDraft.trim(), categoryColorDraft, category.getInt("revision"))
                                editingCategoryId = ""; refreshProject(projectId)
                            } }, enabled = !busy && categoryTitleDraft.isNotBlank()) { Text(if (en) "Save category" else "Сохранить категорию") }
                        } else TextButton(onClick = {
                            editingCategoryId = category.getString("id")
                            categoryTitleDraft = category.optString("title")
                            categoryColorDraft = category.optString("color")
                        }) { Text(if (en) "Edit" else "Редактировать") }
                        TextButton(onClick = { categoryToDelete = category }, enabled = !busy) {
                            Text(if (en) "Delete category" else "Удалить категорию")
                        }
                    }
                } }
                Button(onClick = { createModal = "category" }, enabled = !busy && categories.size < 50) {
                    Text(if (en) "Create category" else "Создать категорию")
                }
            }
            if (canInvite) {
                Button(onClick = { createModal = "invite" }, enabled = !busy) {
                    Text(if (en) "Create invitation" else "Создать приглашение")
                }
                if (inviteLink.isNotBlank()) Text(inviteLink, style = MaterialTheme.typography.bodySmall)
            }
            }
            }
            SharedBlock(if (en) "Project tasks" else "Задачи проекта") {
            if (canWrite && statuses.isNotEmpty()) {
                Button(onClick = {
                    newTaskStatusId = statuses.first().optString("id")
                    newTaskCategoryId = ""; newTaskAssigneeId = ""; createModal = "task"
                }, enabled = !busy) {
                    Text(if (en) "Create team task" else "Создать задачу команды")
                }
                Button(onClick = { createModal = "status" }, enabled = !busy && statuses.size < 20) {
                    Text(if (en) "Create task list" else "Создать список задач")
                }
            }
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("list", "board", "calendar").forEach { view ->
                    FilterChip(selected = activeView == view, onClick = { viewOverride = view },
                        label = { Text(when (view) {
                            "board" -> if (en) "Board" else "Доска"
                            "calendar" -> if (en) "Calendar" else "Календарь"
                            else -> if (en) "List" else "Список"
                        }) })
                }
            }
            }
            if (activeView == "calendar") {
                if (tasks.size >= 500) Text(if (en)
                    "This project has at least 500 tasks. The calendar may omit later tasks."
                    else "В проекте не менее 500 задач. Календарь может не показывать задачи за пределами загруженной части.",
                    style = MaterialTheme.typography.bodySmall)
                val locale = if (en) Locale.US else Locale.forLanguageTag("ru-RU")
                val first = calendarMonth.atDay(1)
                val offset = first.dayOfWeek.value - 1
                val cells = ((offset + calendarMonth.lengthOfMonth() + 6) / 7) * 7
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    TextButton(onClick = { val target = calendarMonth.minusMonths(1); calendarMonth = target; calendarDay = target.atDay(1) }) { Text("←") }
                    Text(first.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale)),
                        style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { val target = calendarMonth.plusMonths(1); calendarMonth = target; calendarDay = target.atDay(1) }) { Text("→") }
                }
                Row(Modifier.fillMaxWidth()) {
                    (if (en) listOf("Mon","Tue","Wed","Thu","Fri","Sat","Sun")
                        else listOf("Пн","Вт","Ср","Чт","Пт","Сб","Вс")).forEach { day ->
                        Text(day, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall)
                    }
                }
                repeat(cells / 7) { week ->
                    Row(Modifier.fillMaxWidth()) {
                        repeat(7) { weekday ->
                            val date = first.plusDays((week * 7 + weekday - offset).toLong())
                            val count = tasks.count { it.optString("dueDate") == date.toString() }
                            TextButton(onClick = {
                                calendarDay = date
                                if (YearMonth.from(date) != calendarMonth) calendarMonth = YearMonth.from(date)
                            }, modifier = Modifier.weight(1f).height(54.dp).semantics {
                                contentDescription = date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale)) +
                                    if (count > 0) (if (en) " · $count tasks" else " · задач: $count") else ""
                            },
                                contentPadding = PaddingValues(0.dp),
                                colors = ButtonDefaults.textButtonColors(contentColor = if (date == calendarDay)
                                    MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)) {
                                Column {
                                    Text(date.dayOfMonth.toString(), style = MaterialTheme.typography.labelMedium)
                                    if (count > 0) Text(count.toString(), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
                Text(calendarDay.format(DateTimeFormatter.ofPattern("d MMMM yyyy", locale)),
                    style = MaterialTheme.typography.titleMedium)
                val due = tasks.filter { it.optString("dueDate") == calendarDay.toString() }
                if (due.isEmpty()) Text(if (en) "No team tasks due this day." else "На этот день нет общих задач со сроком.",
                    style = MaterialTheme.typography.bodySmall)
                due.forEach { task -> SharedTaskCard(task, statuses, canWrite, busy, taskId == task.getString("id"), en,
                    category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                    completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                    onOpen = { taskId = task.getString("id") },
                    onMove = { destination -> run {
                        controller.updateSharedTask(projectId, task.getString("id"), JSONObject()
                            .put("statusId", destination).put("expectedRevision", task.getInt("revision")))
                        refreshProject(projectId)
                    } }) }
                val undated = tasks.filter { it.isNull("dueDate") || it.optString("dueDate").isBlank() }
                if (undated.isNotEmpty()) {
                    TextButton(onClick = { showUndated = !showUndated }) {
                        Text((if (en) "Without a due date" else "Без срока") + " · ${undated.size}")
                    }
                    if (showUndated) undated.forEach { task ->
                        TextButton(onClick = { taskId = task.getString("id") }) { Text(task.getString("title")) }
                    }
                }
            } else if (activeView == "board") {
                Text(if (en) "Swipe across the board to view all statuses."
                    else "Проведите по доске, чтобы увидеть все статусы.", style = MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    statuses.forEach { status -> Column(Modifier.width(250.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(sharedStatusLabel(status.getString("title"), en), style = MaterialTheme.typography.titleMedium)
                        tasks.filter { it.getString("statusId") == status.getString("id") }.forEach { task ->
                            SharedTaskCard(task, statuses, canWrite, busy, taskId == task.getString("id"), en,
                                category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                                completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                                onOpen = { taskId = task.getString("id") },
                                onMove = { destination -> run {
                                    controller.updateSharedTask(projectId, task.getString("id"), JSONObject()
                                        .put("statusId", destination).put("expectedRevision", task.getInt("revision")))
                                    refreshProject(projectId)
                                } })
                        }
                    } }
                }
            } else statuses.forEach { status ->
                Text(sharedStatusLabel(status.getString("title"), en), style = MaterialTheme.typography.titleMedium)
                tasks.filter { it.getString("statusId") == status.getString("id") }.forEach { task ->
                    SharedTaskCard(task, statuses, canWrite, busy, taskId == task.getString("id"), en,
                        category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                        completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                        onOpen = { taskId = task.getString("id") },
                        onMove = { destination -> run {
                            controller.updateSharedTask(projectId, task.getString("id"), JSONObject()
                                .put("statusId", destination).put("expectedRevision", task.getInt("revision")))
                            refreshProject(projectId)
                        } })
                }
            }
            if (selectedTask != null) ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(selectedTask.getString("title"), style = MaterialTheme.typography.titleLarge)
                    if (canWrite) {
                        OutlinedTextField(editTaskTitle, { editTaskTitle = it },
                            label = { Text(if (en) "Name" else "Название") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(editTaskDescription, { editTaskDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(editTaskDueDate, { editTaskDueDate = it },
                            label = { Text(if (en) "Due date (YYYY-MM-DD)" else "Срок (ГГГГ-ММ-ДД)") },
                            modifier = Modifier.fillMaxWidth())
                        Text(if (en) "Category" else "Категория", style = MaterialTheme.typography.bodySmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + categories).forEach { category ->
                                val id = category?.optString("id") ?: ""
                                FilterChip(selected = editTaskCategoryId == id,
                                    onClick = { editTaskCategoryId = id },
                                    label = { Text(category?.optString("title") ?: if (en) "No category" else "Без категории") })
                            }
                        }
                        if (selectedTask.optInt("revision") != editTaskRevision) {
                            Text(if (en) "Changed elsewhere. Your draft is kept." else "Изменено другим участником. Черновик сохранён.",
                                color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = {
                                editTaskTitle = selectedTask.optString("title")
                                editTaskDescription = selectedTask.optString("description")
                                editTaskDueDate = selectedTask.optString("dueDate").takeUnless { it == "null" } ?: ""
                                editTaskCategoryId = selectedTask.optString("categoryId").takeUnless { it == "null" } ?: ""
                                editTaskRevision = selectedTask.optInt("revision")
                            }) { Text(if (en) "Reload fields" else "Обновить поля") }
                        }
                        val dateValid = editTaskDueDate.isBlank() || runCatching { LocalDate.parse(editTaskDueDate) }.isSuccess
                        Button(onClick = { run {
                            val changed = controller.updateSharedTask(projectId, taskId, JSONObject()
                                .put("title", editTaskTitle.trim()).put("description", editTaskDescription.trim())
                                .put("dueDate", editTaskDueDate.ifBlank { null } ?: JSONObject.NULL)
                                .put("categoryId", editTaskCategoryId.ifBlank { null } ?: JSONObject.NULL)
                                .put("expectedRevision", editTaskRevision)).getJSONObject("task")
                            editTaskRevision = changed.getInt("revision")
                            refreshProject(projectId)
                        } }, enabled = !busy && editTaskTitle.isNotBlank() && dateValid &&
                            selectedTask.optInt("revision") == editTaskRevision) {
                            Text(if (en) "Save task" else "Сохранить задачу")
                        }
                    } else if (selectedTask.optString("description").isNotBlank()) Text(selectedTask.getString("description"))
                    if (canWrite) {
                        Text(if (en) "Assigned to" else "Исполнитель")
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + members).forEach { member ->
                                val id = member?.getString("userId") ?: ""
                                FilterChip(selected = selectedTask.optString("assigneeId") == id,
                                    onClick = { run {
                                        controller.updateSharedTask(projectId, taskId, JSONObject()
                                            .put("assigneeId", if (id.isBlank()) JSONObject.NULL else id)
                                            .put("expectedRevision", selectedTask.getInt("revision")))
                                        refreshProject(projectId)
                                    } }, label = { Text(member?.optString("displayName") ?: if (en) "None" else "Никто") })
                            }
                        }
                    }
                    Text(if (en) "Discussion" else "Обсуждение", style = MaterialTheme.typography.titleMedium)
                    comments.forEach { comment -> Text("${comment.optString("authorName")}: ${comment.getString("body")}") }
                    if (canComment) {
                        OutlinedTextField(commentBody, { commentBody = it }, label = { Text(if (en) "Comment" else "Комментарий") },
                            modifier = Modifier.fillMaxWidth())
                        Button(onClick = { run {
                            controller.addSharedComment(projectId, taskId, commentBody.trim())
                            commentBody = ""; comments = controller.sharedComments(projectId, taskId).getJSONArray("comments").rows()
                        } }, enabled = !busy && commentBody.isNotBlank()) { Text(if (en) "Send" else "Отправить") }
                    }
                }
            }
        }
    }
}

@Composable
private fun SharedBlock(title: String, content: @Composable ColumnScope.() -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            content()
        }
    }
}

@Composable
private fun SharedTaskCard(task: JSONObject, statuses: List<JSONObject>, canWrite: Boolean, busy: Boolean,
    selected: Boolean, en: Boolean, category: JSONObject?, completedBy: String?,
    onOpen: () -> Unit, onMove: (String) -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(8.dp)) {
        TextButton(onClick = onOpen) { Text(task.getString("title")) }
        if (category != null) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("●", color = runCatching { Color(android.graphics.Color.parseColor(category.optString("color"))) }
                .getOrDefault(MaterialTheme.colorScheme.secondary))
            Text(category.optString("title"), style = MaterialTheme.typography.bodySmall)
        }
        if (task.has("completedBy") && !task.isNull("completedBy")) Text(
            (if (en) "Completed by: " else "Выполнил(а): ") +
                (completedBy ?: if (en) "Former member" else "Бывший участник"),
            style = MaterialTheme.typography.bodySmall)
        if (selected) Text(task.optString("dueDate").ifBlank { if (en) "No due date" else "Без срока" }, style = MaterialTheme.typography.bodySmall)
        if (canWrite) Row(Modifier.horizontalScroll(rememberScrollState())) {
            statuses.forEach { status ->
                FilterChip(selected = task.getString("statusId") == status.getString("id"),
                    onClick = { onMove(status.getString("id")) }, enabled = !busy,
                    label = { Text(sharedStatusLabel(status.getString("title"), en)) })
            }
        }
    } }
}
