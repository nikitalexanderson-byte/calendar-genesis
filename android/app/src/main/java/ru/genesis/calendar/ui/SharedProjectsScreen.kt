package ru.genesis.calendar.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.Saver
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.SacredCatalog
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

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
internal fun SharedProjectsScreen(controller: SharedWorkspaceGateway, language: String,
    destination: SharedInvitationDestination? = null) {
    // Keep Compose's optional-argument mask out of the large workspace method.
    // R8 9.4.14 emits an invalid >255 register reference for that mask in release DEX.
    SharedProjectsContent(controller, language, destination)
}

@Composable
private fun SharedProjectsContent(controller: SharedWorkspaceGateway, language: String,
    destination: SharedInvitationDestination?) {
    val en = language == "en"
    val scope = rememberCoroutineScope()
    val lifecycleState by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val pageActive = LocalNavigationPageContext.current?.active != false && lifecycleState.isAtLeast(Lifecycle.State.STARTED)
    var spaces by remember { mutableStateOf(emptyList<JSONObject>()) }
    var projects by remember { mutableStateOf(emptyList<JSONObject>()) }
    var archivedProjects by remember { mutableStateOf(emptyList<JSONObject>()) }
    var snapshot by remember { mutableStateOf<JSONObject?>(null) }
    var googleSettings by remember { mutableStateOf<JSONObject?>(null) }
    var googleMessage by remember { mutableStateOf("") }
    var comments by remember { mutableStateOf(emptyList<JSONObject>()) }
    val (taskSort,setTaskSort)=rememberTaskListSort("shared")
    var discussionVisible by remember { mutableStateOf(false) }
    val discussionWindowHeight=androidx.compose.ui.platform.LocalContext.current.resources.displayMetrics.heightPixels
    var spaceId by rememberSaveable { mutableStateOf(destination?.spaceId.orEmpty()) }
    var expandedIds by remember { mutableStateOf(emptySet<String>()) }
    var uiReadySpace by remember { mutableStateOf("") }
    val expansionWrites = remember { Mutex() }
    var invitations by remember { mutableStateOf(emptyList<JSONObject>()) }
    var loadingInvitations by remember { mutableStateOf(false) }
    var createKind by remember { mutableStateOf("project") }
    var parentBoardId by remember { mutableStateOf("") }
    var parentProjectSnapshot by remember { mutableStateOf<JSONObject?>(null) }
    var managementPage by remember { mutableStateOf("project") }
    var boardDraft by remember { mutableStateOf<JSONObject?>(null) }
    var boardColor by remember { mutableStateOf("#2d6c68") }
    var boardImage by remember { mutableStateOf("") }
    var pendingImageBoard by remember { mutableStateOf<Pair<String, String>?>(null) }
    var boardDone by remember { mutableStateOf(false) }
    var projectId by rememberSaveable { mutableStateOf("") }
    var projectTrail by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var taskId by rememberSaveable { mutableStateOf("") }
    var actionsOpen by remember { mutableStateOf(false) }
    var showArchived by rememberSaveable { mutableStateOf(false) }
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    var statusFilter by rememberSaveable(projectId) { mutableStateOf("") }
    var completionFilter by rememberSaveable(projectId) { mutableStateOf("any") }
    var assigneeFilter by rememberSaveable(projectId) { mutableStateOf("") }
    var priorityFilter by rememberSaveable(projectId) { mutableIntStateOf(-1) }
    var discardTaskDraft by remember { mutableStateOf(false) }
    var viewOverride by remember { mutableStateOf<String?>(null) }
    val calendarEngine = remember { GenesisCalendar() }
    val enabledCalendars = LocalEnabledCalendars.current
    val context = LocalContext.current
    val calendarPreferences = remember(context) { context.getSharedPreferences("genesis-shared-projects", 0) }
    var calendarMode by rememberSaveable {
        mutableStateOf(CalendarMode.fromWire(calendarPreferences.getString("calendarMode", "profane") ?: "profane")
            .takeIf { it in enabledCalendars } ?: enabledCalendars.firstOrNull() ?: CalendarMode.PROFANE)
    }
    LaunchedEffect(enabledCalendars) {
        if (calendarMode !in enabledCalendars) {
            calendarMode = enabledCalendars.firstOrNull() ?: CalendarMode.PROFANE
            calendarPreferences.edit().putString("calendarMode", calendarMode.wireValue).apply()
        }
    }
    var calendarAnchor by remember { mutableStateOf(LocalDate.now()) }
    var calendarDay by remember { mutableStateOf(LocalDate.now()) }
    var showUndated by remember { mutableStateOf(false) }
    var taskPage by remember { mutableStateOf<JSONObject?>(null) }
    var taskSearch by rememberSaveable(projectId) { mutableStateOf("") }
    var openedTask by remember { mutableStateOf<JSONObject?>(null) }
    var editTaskDetails by rememberSaveable(stateSaver = Saver<JSONObject, String>(
        save = { it.toString() }, restore = { JSONObject(it) })) { mutableStateOf(JSONObject()) }
    var draftTaskKey by rememberSaveable { mutableStateOf("") }
    var createModal by rememberSaveable { mutableStateOf<String?>(null) }
    var showManagement by remember { mutableStateOf(false) }
    var spaceTitle by rememberSaveable { mutableStateOf("") }
    var projectTitle by rememberSaveable { mutableStateOf("") }
    var projectDescription by rememberSaveable { mutableStateOf("") }
    var boardLayout by rememberSaveable { mutableStateOf(false) }
    var parentId by rememberSaveable { mutableStateOf("") }
    var editTitle by remember { mutableStateOf("") }
    var editDescription by remember { mutableStateOf("") }
    var editBoardLayout by remember { mutableStateOf(false) }
    var editParentId by remember { mutableStateOf("") }
    var memberToRemove by remember { mutableStateOf<String?>(null) }
    var projectToArchive by remember { mutableStateOf<String?>(null) }
    var newStatusTitle by rememberSaveable { mutableStateOf("") }
    var newStatusDone by rememberSaveable { mutableStateOf(false) }
    var editingStatusId by remember { mutableStateOf("") }
    var statusTitleDraft by remember { mutableStateOf("") }
    var statusDestinations by remember { mutableStateOf(emptyMap<String, String>()) }
    var statusToDelete by remember { mutableStateOf<JSONObject?>(null) }
    var newCategoryTitle by rememberSaveable { mutableStateOf("") }
    var newCategoryColor by rememberSaveable { mutableStateOf("#2d6c68") }
    var editingCategoryId by remember { mutableStateOf("") }
    var categoryTitleDraft by remember { mutableStateOf("") }
    var categoryColorDraft by remember { mutableStateOf("#2d6c68") }
    var categoryToDelete by remember { mutableStateOf<JSONObject?>(null) }
    var newTaskCategoryId by rememberSaveable { mutableStateOf("") }
    var newTaskStatusId by rememberSaveable { mutableStateOf("") }
    var newTaskAssigneeId by rememberSaveable { mutableStateOf("") }
    var newTaskDescription by rememberSaveable { mutableStateOf("") }
    var newTaskDueDate by rememberSaveable { mutableStateOf("") }
    var editTaskCategoryId by rememberSaveable { mutableStateOf("") }
    var taskTitle by rememberSaveable { mutableStateOf("") }
    var inviteEmail by rememberSaveable { mutableStateOf("") }
    var inviteRole by rememberSaveable { mutableStateOf("member") }
    var commentBody by rememberSaveable { mutableStateOf("") }
    var editTaskTitle by rememberSaveable { mutableStateOf("") }
    var editTaskDescription by rememberSaveable { mutableStateOf("") }
    var editTaskDueDate by rememberSaveable { mutableStateOf("") }
    var editTaskRevision by rememberSaveable { mutableIntStateOf(0) }
    var message by remember { mutableStateOf("") }
    var messageIsError by remember { mutableStateOf(true) }
    var offlineSnapshot by remember { mutableStateOf(false) }
    var pendingTasks by remember { mutableStateOf(emptyList<JSONObject>()) }
    var failedDraft by remember { mutableStateOf<JSONObject?>(null) }
    var busy by remember { mutableStateOf(false) }

    suspend fun refreshSpaces() {
        val response = controller.sharedSpaces()
        offlineSnapshot = response.optBoolean("offlineCache")
        val rows = response.getJSONArray("spaces").rows()
        spaces = rows
        if (rows.none { it.getString("id") == spaceId }) spaceId = ""
    }
    suspend fun refreshProjects(id: String) {
        val response = controller.sharedProjects(id)
        val archivedResponse = controller.archivedSharedProjects(id)
        offlineSnapshot = response.optBoolean("offlineCache") || archivedResponse.optBoolean("offlineCache")
        if (spaceId != id) return
        val rows = response.getJSONArray("projects").rows()
        val archived = archivedResponse.getJSONArray("projects").rows()
        if (archivedProjects.map { it.toString() } != archived.map { it.toString() }) archivedProjects = archived
        if (projects.map { it.toString() } != rows.map { it.toString() }) projects = rows
        if (rows.none { it.getString("id") == projectId }) projectId = ""
    }
    suspend fun refreshProject(id: String) {
        val result = controller.sharedProject(id)
        offlineSnapshot = result.optBoolean("offlineCache")
        if (projectId != id) return
        if (snapshot?.toString() != result.toString()) snapshot = result
        if (taskId.isNotBlank()) {
            val currentId = taskId
            try { val found = controller.sharedTask(id, currentId).getJSONObject("task"); if (taskId == currentId) openedTask = found }
            catch (error: Exception) { message = error.message ?: "TASK_NOT_FOUND"; openedTask = null }
        }
    }
    fun persistExpansion(ids: Set<String>) {
        if (spaceId.isBlank() || uiReadySpace != spaceId) return
        val targetSpace = spaceId
        val next = ids.toList().takeLast(100)
        expandedIds = next.toSet()
        scope.launch {
            try { expansionWrites.withLock { controller.saveSharedSpaceUi(targetSpace, next) } }
            catch (error: Exception) { if (spaceId == targetSpace) message = error.message ?: "Не удалось сохранить вид пространства." }
        }
    }
    fun selectProject(id: String) {
        if (projectId.isNotBlank() && projectId != id) projectTrail = projectTrail + projectId
        persistExpansion(expandedIds + id)
        taskId = ""; projectId = id
        snapshot = null; viewOverride = null
    }
    fun openBoard(status: JSONObject) {
        boardDraft = status
        statusTitleDraft = status.optString("title")
        boardColor = status.optString("color", "#2d6c68")
        boardImage = status.optString("imageUrl")
        boardDone = status.optInt("isDone") == 1
    }
    fun run(action: suspend () -> Unit) {
        if (busy) return
        busy = true; message = ""; messageIsError = false
        scope.launch {
            try { action() } catch (error: Exception) { messageIsError = true; message = when (error.message) {
                "INVITEE_ACCOUNT_UNSUPPORTED" -> if (en) "This account cannot use shared projects." else "Этот аккаунт не может использовать общие проекты."
                "INVITEE_ACCOUNT_NOT_FOUND" -> if (en) "No GENESIS account was found for this email." else "Аккаунт GENESIS с такой почтой не найден."
                else -> error.message ?: "Ошибка сервера"
            } }
            finally { busy = false }
        }
    }
    LaunchedEffect(createModal, parentId, spaceId) {
        parentProjectSnapshot = null
        if (createModal == "project" && parentId.isNotBlank()) try {
            val parent = controller.sharedProject(parentId)
            parentProjectSnapshot = parent
            if (parent.optJSONArray("statuses")?.rows()?.none { it.optString("id") == parentBoardId } == true) parentBoardId = ""
        } catch (cause: kotlinx.coroutines.CancellationException) { throw cause }
        catch (cause: Exception) { message = cause.message ?: "Не удалось открыть родительский проект." }
    }
    LaunchedEffect(createModal) {
        if (createModal == "join") {
            loadingInvitations = true
            try { invitations = controller.sharedInvitations().getJSONArray("invitations").rows() }
            catch (error: Exception) { message = error.message ?: "Не удалось загрузить приглашения." }
            finally { loadingInvitations = false }
        }
    }
    LaunchedEffect(pageActive) {
        if (!pageActive) return@LaunchedEffect
        try { refreshSpaces() } catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
    }
    LaunchedEffect(spaceId, pageActive) {
        if (!pageActive) return@LaunchedEffect
        val targetSpace = spaceId
        val restoredProjectId = projectId
        uiReadySpace = ""; expandedIds = emptySet(); projectId = ""; snapshot = null
        if (targetSpace.isNotBlank()) try {
            refreshProjects(targetSpace)
            val state = controller.sharedSpaceUi(targetSpace)
            if (spaceId == targetSpace) {
                val ids = state.optJSONArray("expandedIds") ?: JSONArray()
                expandedIds = (0 until ids.length()).map(ids::getString).toSet()
                uiReadySpace = targetSpace
                projectId = destination?.takeIf { it.spaceId == targetSpace && projects.any { project -> project.optString("id") == it.projectId } }?.projectId
                    ?: restoredProjectId.takeIf { id -> projects.any { it.optString("id") == id } }.orEmpty()
            }
        } catch (error: Exception) { message = error.message ?: "Ошибка сервера" }
        else { projects = emptyList(); archivedProjects = emptyList() }
    }
    LaunchedEffect(projectId, pageActive) {
        if (!pageActive) return@LaunchedEffect
        if (projectId.isBlank()) { snapshot = null; return@LaunchedEffect }
        while (isActive) {
            try {
                controller.flushSharedOfflineTasks()
                pendingTasks = controller.queuedSharedTasks(projectId)
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
    val tasks = taskPage?.optJSONArray("tasks")?.rows().orEmpty()
    val inboxProject = projects.firstOrNull { it.optInt("isInbox") == 1 }
    val members = snapshot?.getJSONArray("members")?.rows().orEmpty()
    val role = project?.optString("role") ?: ""
    val canWrite = role in setOf("owner", "manager", "member")
    val canEditTask = sharedTaskCanEdit(project)
    val planningEnabled = project?.optJSONObject("planning")?.optBoolean("enabled") == true
    val taskPending = sharedTaskHasPending(taskId, pendingTasks)
    val canOrganize = project?.optBoolean("canOrganizeTasks") == true
    val canComment = role in setOf("owner", "manager", "member", "commenter")
    val canInvite = role in setOf("owner", "manager")
    val selectedTask = openedTask?.takeIf { it.optString("id") == taskId && it.optString("projectId") == projectId } ?: tasks.firstOrNull { it.optString("id") == taskId }
    val estimateDraft = selectedTask?.takeIf { draftTaskKey == "$projectId:$taskId" }?.let { sharedTaskEstimates(it, editTaskDetails) }
    val taskArchived = selectedTask?.optString("archivedAt")?.let { it.isNotBlank() && it != "null" } == true
    LaunchedEffect(projectId,taskId,comments,discussionVisible,pageActive) {
        if(pageActive&&discussionVisible&&taskId.isNotBlank()&&comments.isNotEmpty())runCatching {
            controller.readSharedTaskUpdates(projectId,taskId,comments.map { it.getString("id") })
            taskPage=taskPage?.let { page->JSONObject(page.toString()).put("tasks",JSONArray(page.optJSONArray("tasks")?.rows().orEmpty().map { if(it.optString("id")==taskId)JSONObject(it.toString()).put("unreadCommentCount",0) else it })) }
        }
    }
    val activeView = viewOverride ?: project?.optString("layout") ?: "list"
    val taskFilter = JSONObject().put("projectIds", JSONArray().put(projectId)).put("q", taskSearch)
    if (statusFilter.isNotBlank()) taskFilter.put("statusIds", JSONArray().put(statusFilter))
    if (completionFilter != "any") taskFilter.put("completion", completionFilter)
    if (assigneeFilter.isNotBlank()) taskFilter.put("assigneeIds", JSONArray().put(assigneeFilter))
    if (priorityFilter >= 0) taskFilter.put("priority", JSONArray().put(priorityFilter))
    if (activeView == "calendar") {
        if (showUndated) taskFilter.put("undated", true)
        else taskFilter.put("dueFrom", calendarDay.toString()).put("dueTo", calendarDay.toString())
    }
    val taskFilterKey = taskFilter.toString()
    var taskQueryIdentity by remember { mutableStateOf("") }
    LaunchedEffect(taskFilterKey,taskSort,pageActive) {
        if (!pageActive) return@LaunchedEffect
        val identity = taskFilterKey + ":" + taskSort.wire
        if (taskQueryIdentity != identity) { taskPage = null; taskQueryIdentity = identity }
        if (projectId.isBlank()) return@LaunchedEffect
        while (isActive) {
            try {
                val loaded=taskPage?.optJSONArray("tasks")?.length()?:0
                var next = controller.sortedSharedTasks(JSONObject(taskFilterKey),sort=taskSort.wire)
                while(next.optBoolean("hasMore")&&(next.optJSONArray("tasks")?.length()?:0)<loaded)
                    next=mergeSharedTaskPage(next,controller.sortedSharedTasks(JSONObject(taskFilterKey),next.optString("nextCursor"),taskSort.wire),true)
                taskPage = next
            } catch(error: Exception) { message = error.message ?: "Не удалось загрузить данные" }
            delay(5_000)
        }
    }
    var draggingTask by remember { mutableStateOf<JSONObject?>(null) }
    var draggingAt by remember { mutableStateOf<Offset?>(null) }
    var rootPosition by remember { mutableStateOf(Offset.Zero) }
    val dropBounds = remember { mutableStateMapOf<String, Rect>() }
    fun moveTaskTo(task: JSONObject, destinationProjectId: String, destinationStatusId: String = "") {
        if (!canOrganize || destinationProjectId.isBlank()) return
        run {
            val destination = if (destinationProjectId == projectId) snapshot
                else controller.sharedProject(destinationProjectId)
            val statusId = destinationStatusId.ifBlank {
                destination?.optJSONArray("statuses")?.optJSONObject(0)?.optString("id").orEmpty()
            }
            if (statusId.isBlank()) return@run
            val moved = controller.moveSharedTask(projectId, task.getString("id"), JSONObject()
                .put("destinationProjectId", destinationProjectId).put("statusId", statusId)
                .put("expectedRevision", task.getInt("revision"))
                .put("position", if (destinationProjectId == projectId)
                    tasks.count { it.optString("statusId") == statusId }
                    else destination?.optJSONArray("tasks")?.rows()?.count { it.optString("statusId") == statusId } ?: 0))
            pendingTasks = controller.queuedSharedTasks(projectId)
            if (moved.getJSONObject("task").optBoolean("pending")) {
                message = if (en) "Move saved on this device. It will sync when connected."
                    else "Перенос сохранён на устройстве и синхронизируется после подключения."
                return@run
            }
            refreshProjects(spaceId)
            projectId = destinationProjectId
            refreshProject(destinationProjectId)
        }
    }
    fun moveTaskStatus(task: JSONObject, destination: String) {
        if (!canOrganize || task.optString("statusId") == destination) return
        moveTaskTo(task, projectId, destination)
    }
    fun finishDrag() {
        val task = draggingTask
        val position = draggingAt
        val destination = if (position != null) dropBounds.entries.firstOrNull { it.value.contains(position) }?.key else null
        draggingTask = null; draggingAt = null; dropBounds.clear()
        if (task != null && destination != null) {
            if (destination.startsWith("status:")) moveTaskTo(task, projectId, destination.removePrefix("status:"))
            if (destination.startsWith("project:")) moveTaskTo(task, destination.removePrefix("project:"))
        }
    }
    val categoryColors = listOf("#2d6c68", "#a5543f", "#b18b48", "#665c88", "#54718a")
    val scrollPositions = remember { mutableMapOf<String, ScrollState>() }
    val pageKey = if (taskId.isNotBlank()) "task:$projectId:$taskId" else if (projectId.isNotBlank())
        "project:$projectId" else "space:$spaceId"
    val pageScroll = scrollPositions.getOrPut(pageKey) { ScrollState(0) }
    val taskFieldsChanged = selectedTask != null && draftTaskKey == "$projectId:$taskId" && (
        editTaskTitle != selectedTask.optString("title") ||
        editTaskDescription != selectedTask.optString("description") ||
        editTaskDueDate != selectedTask.optString("dueDate").takeUnless { it == "null" }.orEmpty() ||
        editTaskCategoryId != selectedTask.optString("categoryId").takeUnless { it == "null" }.orEmpty() ||
        sharedTaskDetailsChanged(selectedTask, editTaskDetails))
    val taskDraftChanged = taskFieldsChanged || canComment && commentBody.isNotBlank()
    fun navigateBack() {
        if (busy) return
        actionsOpen = false
        when {
            taskId.isNotBlank() -> if (taskDraftChanged) discardTaskDraft = true else { draftTaskKey = ""; taskId = ""; openedTask = null }
            projectId.isNotBlank() -> {
                projectId = projectTrail.lastOrNull().orEmpty(); projectTrail = projectTrail.dropLast(1)
                snapshot = null; viewOverride = null
            }
            else -> { spaceId = ""; projectTrail = emptyList() }
        }
    }
    BackHandler(enabled = pageActive && (taskId.isNotBlank() || projectId.isNotBlank() || spaceId.isNotBlank()) &&
        createModal == null && !showManagement && boardDraft == null && !filtersOpen && !discardTaskDraft) { navigateBack() }
    if (discardTaskDraft) AlertDialog(onDismissRequest = { discardTaskDraft = false },
        title = { Text("Несохранённые изменения") },
        text = { Text("Вернуться без сохранения изменений?") },
        confirmButton = { TextButton(onClick = { discardTaskDraft = false; draftTaskKey = ""; commentBody = ""; taskId = ""; openedTask = null }) {
            Text("Не сохранять") } },
        dismissButton = { TextButton(onClick = { discardTaskDraft = false }) { Text("Продолжить редактирование") } })
    LaunchedEffect(projectId, pageActive) {
        if (!pageActive) return@LaunchedEffect
        googleSettings = null; googleMessage = ""
        if (projectId.isBlank()) return@LaunchedEffect
        try { googleSettings = controller.sharedGoogleSettings(projectId).getJSONObject("settings") }
        catch (error: Exception) { googleMessage = error.message ?: "Ошибка Google" }
        while (isActive) {
            delay(30_000)
            val settings = googleSettings
            if (settings?.optBoolean("tasksEnabled") == true || settings?.optBoolean("calendarEnabled") == true) {
                try { controller.syncSharedGoogle(projectId) }
                catch (_: Exception) { /* The explicit update button reports failures. */ }
            }
        }
    }
    LaunchedEffect(projectId, taskId, pageActive) {
        if (!pageActive) return@LaunchedEffect
        if (taskId.isBlank()) { openedTask = null; return@LaunchedEffect }
        val targetProject = projectId; val targetTask = taskId
        val current = try { controller.sharedTask(targetProject, targetTask).getJSONObject("task") }
            catch(error: Exception) { message = error.message ?: "TASK_NOT_FOUND"; return@LaunchedEffect }
        if (projectId != targetProject || taskId != targetTask) return@LaunchedEffect
        openedTask = current
        if (draftTaskKey != "$projectId:$taskId") {
            editTaskDetails = sharedTaskDetailDraft(current)
            editTaskTitle = current.optString("title")
            editTaskDescription = current.optString("description")
            editTaskDueDate = current.optString("dueDate").takeUnless { it == "null" }.orEmpty()
            editTaskCategoryId = current.optString("categoryId").takeUnless { it == "null" }.orEmpty()
            editTaskRevision = current.optInt("revision")
            commentBody = ""; draftTaskKey = "$projectId:$taskId"
        }
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
                "join" -> if (en) "Workspace invitations" else "Приглашения в пространства"
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
                    "join" -> {
                        if (loadingInvitations) LinearProgressIndicator(Modifier.fillMaxWidth())
                        else if (invitations.isEmpty()) Text(if (en) "No invitations yet." else "Приглашений пока нет.")
                        invitations.forEach { invitation ->
                            Text(invitation.optString("spaceTitle"), style = MaterialTheme.typography.titleMedium)
                            Text(invitation.optString("inviterName"), style = MaterialTheme.typography.bodySmall)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = { run {
                                    val joined = controller.acceptSharedInvitation(invitation.getString("id"))
                                    refreshSpaces(); spaceId = joined.optString("spaceId"); createModal = null
                                } }, enabled = !busy) { Text(if (en) "Join" else "Присоединиться") }
                                OutlinedButton(onClick = { run {
                                    controller.rejectSharedInvitation(invitation.getString("id"))
                                    invitations = controller.sharedInvitations().getJSONArray("invitations").rows()
                                } }, enabled = !busy) { Text(if (en) "Decline" else "Отклонить") }
                            }
                        }
                    }
                    "space" -> OutlinedTextField(spaceTitle, { spaceTitle = it },
                        label = { Text(if (en) "Workspace name" else "Название пространства") }, modifier = Modifier.fillMaxWidth())
                    "project" -> {
                        OutlinedTextField(projectTitle, { projectTitle = it },
                            label = { Text(if (en) "Project name" else "Название проекта") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(projectDescription, { projectDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = createKind == "project", onClick = { createKind = "project" }, label = { Text(if (en) "Project" else "Проект") })
                            FilterChip(selected = createKind == "task-list", onClick = { createKind = "task-list"; boardLayout = false }, label = { Text(if (en) "Task list" else "Список задач") })
                        }
                        Text(if (en) "Layout" else "Вид", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = !boardLayout, onClick = { boardLayout = false }, label = { Text(if (en) "Project tree" else "Дерево проектов") })
                            FilterChip(selected = boardLayout, onClick = { boardLayout = true }, enabled = createKind == "project", label = { Text(if (en) "Board" else "Доска") })
                        }
                        Text(if (en) "Parent project" else "Родительский проект", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = parentId.isBlank(), onClick = { parentId = ""; parentBoardId = "" }, label = { Text(if (en) "Top level" else "Верхний уровень") })
                            projects.filter { it.optInt("isInbox") == 0 }.forEach { item ->
                                FilterChip(selected = parentId == item.optString("id"), onClick = { parentId = item.optString("id"); parentBoardId = "" },
                                    label = { Text(item.optString("title")) })
                            }
                        }
                        if (parentProjectSnapshot?.optJSONObject("project")?.optString("layout") == "board") {
                            Text(if (en) "Parent board" else "Доска родительского проекта", style = MaterialTheme.typography.titleSmall)
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                parentProjectSnapshot?.optJSONArray("statuses")?.rows().orEmpty().forEach { board ->
                                    FilterChip(parentBoardId == board.optString("id"), onClick = { parentBoardId = board.optString("id") },
                                        label = { Text(sharedStatusLabel(board.optString("title"), en)) })
                                }
                            }
                        }
                    }
                    "task" -> {
                        OutlinedTextField(taskTitle, { taskTitle = it },
                            label = { Text(if (en) "Name" else "Название") }, enabled = !busy,
                            modifier = Modifier.fillMaxWidth().testTag("shared-new-task-title"))
                        OutlinedTextField(newTaskDescription, { newTaskDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
                        Text(if (en) "Due date" else "Срок", style = MaterialTheme.typography.titleSmall)
                        if (newTaskDueDate.isBlank()) TextButton(onClick = { newTaskDueDate = LocalDate.now().toString() }) {
                            Text(if (en) "Set due date" else "Установить срок")
                        } else {
                            AuthorDatePicker(newTaskDueDate, calendarMode) { newTaskDueDate = it }
                            TextButton(onClick = { newTaskDueDate = "" }) { Text(if (en) "Clear" else "Убрать срок") }
                        }
                        Text(if (en) "Task list / status" else "Список задач / статус", style = MaterialTheme.typography.titleSmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            statuses.forEach { status -> FilterChip(
                                selected = (newTaskStatusId.ifBlank { statuses.firstOrNull()?.optString("id").orEmpty() }) == status.optString("id"),
                                onClick = { newTaskStatusId = status.optString("id") },
                                label = { Text(sharedStatusLabel(status.optString("title"), en)) }) }
                        }
                        AffairsDisclosure("Дополнительные параметры задачи") {
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
                        Text(if (en) "The invitation appears in GENESIS. Email notifications will be added later." else "Приглашение появится в GENESIS. Email-оповещения добавим позже.", style = MaterialTheme.typography.bodySmall)
                        OutlinedTextField(inviteEmail, { inviteEmail = it }, label = { Text("Gmail") }, modifier = Modifier.fillMaxWidth())
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("member", "viewer").forEach { value ->
                                FilterChip(selected = inviteRole == value, onClick = { inviteRole = value },
                                    label = { Text(sharedRoleLabel(value, en)) })
                            }
                        }
                    }
                }
            } },
            confirmButton = { if (modal != "join") TextButton(onClick = { run {
                when (modal) {
                    "space" -> {
                        val created = controller.createSharedSpace(spaceTitle.trim()).getJSONObject("space")
                        spaceTitle = ""; refreshSpaces(); spaceId = created.getString("id")
                    }
                    "project" -> {
                        val created = controller.createSharedProject(spaceId, projectTitle.trim(), projectDescription.trim(),
                            if (boardLayout && createKind == "project") "board" else "list", parentId.ifBlank { null },
                            createKind, parentBoardId.ifBlank { null }).getJSONObject("project")
                        projectTitle = ""; projectDescription = ""; parentId = ""; parentBoardId = ""
                        refreshProjects(spaceId); projectId = created.getString("id"); persistExpansion(expandedIds + projectId)
                    }
                    "task" -> {
                        val created = controller.createSharedTask(projectId, JSONObject().put("title", taskTitle.trim())
                            .put("description", newTaskDescription.trim())
                            .put("dueDate", newTaskDueDate.ifBlank { null } ?: JSONObject.NULL)
                            .put("statusId", newTaskStatusId.ifBlank { statuses.first().getString("id") })
                            .put("categoryId", newTaskCategoryId.ifBlank { null } ?: JSONObject.NULL)
                            .put("assigneeId", newTaskAssigneeId.ifBlank { null } ?: JSONObject.NULL))
                        taskTitle = ""; newTaskDescription = ""; newTaskDueDate = ""
                        newTaskStatusId = ""; newTaskCategoryId = ""; newTaskAssigneeId = ""
                        pendingTasks = controller.queuedSharedTasks(projectId)
                        if (created.getJSONObject("task").optBoolean("pending")) {
                            message = if (en) "Task saved on this device and waiting for the connection."
                                else "Задача сохранена на устройстве и ожидает подключения к сети."
                        } else refreshProject(projectId)
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
                        controller.inviteSharedSpaceMember(spaceId, inviteEmail.trim(), if (inviteRole == "viewer") "guest" else "member")
                        inviteEmail = ""
                        message = if (en) "The invitation is now in the recipient's account." else "Приглашение появилось в личном кабинете получателя."
                    }
                }
                createModal = null
            } }, modifier = Modifier.heightIn(min = 48.dp).testTag("shared-create-confirm"), enabled = !busy && when (modal) {
                "space" -> spaceTitle.isNotBlank()
                "project" -> projectTitle.isNotBlank()
                "task" -> taskTitle.isNotBlank() && statuses.isNotEmpty() && validDate
                "status" -> newStatusTitle.isNotBlank() && statuses.size < 30
                "category" -> newCategoryTitle.isNotBlank() && categories.size < 50
                else -> inviteEmail.trim().lowercase(Locale.ROOT).let { it.endsWith("@gmail.com") || it.endsWith("@googlemail.com") }
            }) { Text(when (modal) {
                "task" -> "Добавить задачу"
                "project" -> "Создать проект"
                "space" -> "Создать пространство"
                "invite" -> "Пригласить"
                "status" -> "Создать список задач"
                else -> "Создать категорию"
            }) } },
            dismissButton = { TextButton(onClick = { createModal = null }, enabled = !busy) {
                Text(if (en) "Cancel" else "Отмена")
            } })
    }
    failedDraft?.let { draft -> AlertDialog(onDismissRequest = { if (!busy) failedDraft = null },
        title = { Text(if (en) "Saved team draft" else "Сохранённый черновик команды") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (en) "This change could not be sent. Your draft is kept on this device."
                else "Изменение не удалось отправить. Черновик сохранён на устройстве.")
            Text(draft.optString("error"), style = MaterialTheme.typography.bodySmall)
            if (messageIsError && message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error)
            SelectionContainer { androidx.compose.material3.Text(draft.optJSONObject("body")?.toString(2).orEmpty(),
                Modifier.heightIn(max = 240.dp).verticalScroll(rememberScrollState())) }
        } },
        confirmButton = { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { run {
                controller.retryFailedSharedMutation(draft.getString("requestId"))
                pendingTasks = controller.queuedSharedTasks(projectId)
                failedDraft = null
                refreshProject(projectId)
            } }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp).testTag("shared-pending-retry")) { Text(if (en) "Retry" else "Повторить") }
            TextButton(onClick = { failedDraft = null }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text(if (en) "Close" else "Закрыть") }
        } },
        dismissButton = { TextButton(onClick = { run {
            controller.discardFailedSharedMutation(draft.getString("requestId"))
            pendingTasks = controller.queuedSharedTasks(projectId)
            failedDraft = null
        } }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text(if (en) "Remove local draft" else "Удалить локальный черновик") } }) }
    val chooseBoardImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        val target = pendingImageBoard
        pendingImageBoard = null
        if (uri != null && target != null) scope.launch {
            try {
                val selectedImage = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    val mime = context.contentResolver.getType(uri).orEmpty()
                    require(mime in setOf("image/png", "image/jpeg", "image/webp")) { "Выберите PNG, JPG или WebP." }
                    val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                        val out = java.io.ByteArrayOutputStream()
                        val buffer = ByteArray(8192)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            require(out.size() + count <= 500_000) { "Изображение должно быть не больше 500 КБ." }
                            out.write(buffer, 0, count)
                        }
                        out.toByteArray()
                    } ?: throw IllegalArgumentException("Не удалось прочитать изображение.")
                    val value = "data:$mime;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                    require(genesisImageBitmap(value, 600) != null) { "Не удалось открыть изображение." }
                    value
                }
                if (projectId == target.first && boardDraft?.optString("id") == target.second) boardImage = selectedImage
            } catch (error: Exception) { message = error.message ?: "Не удалось загрузить изображение." }
        }
    }
    boardDraft?.let { board ->
        val onlyDone = board.optInt("isDone") == 1 && statuses.count { it.optInt("isDone") == 1 } == 1
        AlertDialog(onDismissRequest = { if (!busy) boardDraft = null },
            title = { Text(if (en) "Board settings" else "Настройки доски") },
            text = { Column(Modifier.fillMaxWidth().heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(statusTitleDraft, { statusTitleDraft = it }, label = { Text(if (en) "Name" else "Название") }, modifier = Modifier.fillMaxWidth().testTag("shared-board-title-input"))
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Checkbox(boardDone, onCheckedChange = { boardDone = it }, enabled = !onlyDone || !boardDone)
                    Text(if (en) "Completed tasks" else "Завершённые задачи")
                }
                Text(if (en) "Color" else "Цвет", style = MaterialTheme.typography.titleSmall)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    categoryColors.forEach { color -> FilterChip(boardColor == color, onClick = { boardColor = color },
                        label = { Text("●", color = Color(android.graphics.Color.parseColor(color))) }) }
                }
                OutlinedTextField(boardImage.takeUnless { it.startsWith("data:") }.orEmpty(), { boardImage = it },
                    label = { Text(if (en) "Image URL (HTTPS)" else "Ссылка на изображение (HTTPS)") }, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = {
                    pendingImageBoard = projectId to board.getString("id")
                    chooseBoardImage.launch("image/*")
                }, enabled = !busy) {
                    Text(if (en) "Upload image" else "Загрузить изображение")
                }
                Text(if (en) "PNG, JPG or WebP · up to 500 KB" else "PNG, JPG или WebP · до 500 КБ", style = MaterialTheme.typography.bodySmall)
                SharedBoardImage(boardImage)
                if (boardImage.isNotBlank()) TextButton(onClick = { boardImage = "" }) { Text(if (en) "Remove image" else "Убрать изображение") }
                if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error)
                if (statuses.size > 1 && !onlyDone) {
                    Text(if (en) "Move contents to" else "Перенести содержимое в", style = MaterialTheme.typography.titleSmall)
                    val destinations = statuses.filter { it.getString("id") != board.getString("id") }
                    val destination = statusDestinations[board.getString("id")] ?: destinations.first().getString("id")
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        destinations.forEach { target -> FilterChip(destination == target.getString("id"),
                            onClick = { statusDestinations = statusDestinations + (board.getString("id") to target.getString("id")) },
                            label = { Text(target.getString("title")) }) }
                    }
                    TextButton(onClick = { boardDraft = null; statusToDelete = board }, enabled = !busy) { Text(if (en) "Delete board" else "Удалить доску") }
                }
            } },
            confirmButton = { TextButton(onClick = { run {
                controller.updateSharedBoard(projectId, board.getString("id"), JSONObject()
                    .put("title", statusTitleDraft.trim()).put("color", boardColor).put("imageUrl", boardImage.trim())
                    .put("isDone", boardDone).put("expectedRevision", board.getInt("revision")))
                boardDraft = null; refreshProject(projectId)
            } }, enabled = !busy && statusTitleDraft.isNotBlank() && (boardImage.isBlank() || boardImage.startsWith("https://") || boardImage.startsWith("data:image/"))) {
                Text(if (en) "Save" else "Сохранить")
            } },
            dismissButton = { TextButton(onClick = { boardDraft = null }, enabled = !busy) { Text(if (en) "Cancel" else "Отмена") } })
    }

    val googleCopySettings: @Composable () -> Unit = {
            SharedBlock(if (en) "My Google copies" else "Мои копии в Google") {
                Text(if (en) "Only you can enable copies in your Google account. The team task stays in GENESIS."
                    else "Только вы можете включить копии в своём Google-аккаунте. Общая задача остаётся в GENESIS.",
                    style = MaterialTheme.typography.bodySmall)
                Text(if (en) "Copies include the project name and each task's title, due date and status. Descriptions and member details stay in GENESIS."
                    else "В копию попадают название проекта, название, срок и статус задачи. Описание и сведения об участниках остаются в GENESIS.",
                    style = MaterialTheme.typography.bodySmall)
                val google = googleSettings
                if (google == null) Text(if (en) "Loading Google options…" else "Загружаем настройки Google…")
                else {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text(if (en) "Copy to my Google Tasks" else "Копировать в мои Google Tasks", modifier = Modifier.weight(1f))
                        Switch(checked = google.optBoolean("tasksEnabled"),
                            enabled = !busy && (google.optBoolean("tasksAvailable") || google.optBoolean("tasksEnabled")),
                            onCheckedChange = { enabled -> run {
                                val settings = controller.updateSharedGoogleSettings(projectId, enabled,
                                    google.optBoolean("calendarEnabled")).getJSONObject("settings")
                                googleSettings = settings
                                if (enabled) controller.syncSharedGoogle(projectId)
                                googleMessage = if (enabled) {
                                    if (en) "Google Tasks copies updated" else "Копии Google Tasks обновлены"
                                } else if (en) "Sync is off. Existing Google copies remain in your account."
                                else "Синхронизация выключена. Созданные копии остаются в вашем Google-аккаунте."
                            } }, modifier = Modifier.testTag("shared-google-tasks-toggle"))
                    }
                    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text(if (en) "Show in my Google Calendar" else "Показывать в моём Google Calendar", modifier = Modifier.weight(1f))
                        Switch(checked = google.optBoolean("calendarEnabled"),
                            enabled = !busy && (google.optBoolean("calendarAvailable") || google.optBoolean("calendarEnabled")),
                            onCheckedChange = { enabled -> run {
                                val settings = controller.updateSharedGoogleSettings(projectId,
                                    google.optBoolean("tasksEnabled"), enabled).getJSONObject("settings")
                                googleSettings = settings
                                if (enabled) controller.syncSharedGoogle(projectId)
                                googleMessage = if (enabled) {
                                    if (en) "Google Calendar copies updated" else "Копии Google Calendar обновлены"
                                } else if (en) "Sync is off. Existing Google copies remain in your account."
                                else "Синхронизация выключена. Созданные копии остаются в вашем Google-аккаунте."
                            } }, modifier = Modifier.testTag("shared-google-calendar-toggle"))
                    }
                    if (!google.optBoolean("tasksAvailable") || !google.optBoolean("calendarAvailable"))
                        Text(if (en) "Connect the corresponding Google service in account settings to enable its copy."
                            else "Для включения копии подключите соответствующий сервис Google в настройках аккаунта.",
                            style = MaterialTheme.typography.bodySmall)
                    if (google.optBoolean("tasksEnabled") || google.optBoolean("calendarEnabled"))
                        TextButton(onClick = { run {
                            val result = controller.syncSharedGoogle(projectId)
                            googleMessage = if (en) "Google copies updated: ${result.optInt("synced")}."
                                else "Копии Google обновлены: ${result.optInt("synced")}."
                        } }, enabled = !busy) { Text(if (en) "Update copies now" else "Обновить копии сейчас") }
                }
                if (googleMessage.isNotBlank()) Text(googleMessage, style = MaterialTheme.typography.bodySmall)
            }
    }

    if (showManagement && project != null) AlertDialog(
        onDismissRequest = { showManagement = false },
        title = { Text(if (managementPage == "project") (if (en) "Project settings" else "Настройки проекта") else (if (en) "Team" else "Команда")) },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (managementPage == "project") {
            if (canInvite && project.optInt("isInbox") == 0) {
                Text(if (en) "Project settings" else "Настройки проекта", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(editTitle, { editTitle = it }, label = { Text(if (en) "Name" else "Название") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(editDescription, { editDescription = it }, label = { Text(if (en) "Description" else "Описание") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = !editBoardLayout, onClick = { editBoardLayout = false }, label = { Text(if (en) "Project tree" else "Дерево проектов") })
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
            googleCopySettings()
            } else {

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
                    if (project.optString("spaceRole") == "owner" &&
                        member.optString("spaceRole") !in setOf("owner", "admin")) {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Checkbox(checked = member.optBoolean("canOrganizeTasks"), enabled = !busy,
                                onCheckedChange = { enabled -> run {
                                    controller.changeSharedSpaceRole(spaceId, member.getString("userId"),
                                        member.optString("spaceRole"), enabled)
                                    refreshProject(projectId)
                                } })
                            Text(if (en) "Can organize tasks" else "Может распределять задачи")
                        }
                    }
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

            if (spaces.firstOrNull { it.optString("id") == spaceId }?.optString("role") in setOf("owner", "admin")) {
                Button(onClick = { showManagement = false; createModal = "invite" }, enabled = !busy) {
                    Text(if (en) "Invite with Gmail" else "Пригласить по Gmail")
                }
            }

            }
        } },
        confirmButton = { TextButton(onClick = { showManagement = false }) { Text(if (en) "Close" else "Закрыть") } })
    if (filtersOpen) {
        var draftStatus by rememberSaveable { mutableStateOf(statusFilter) }
        var draftCompletion by rememberSaveable { mutableStateOf(completionFilter) }
        var draftAssignee by rememberSaveable { mutableStateOf(assigneeFilter) }
        var draftPriority by rememberSaveable { mutableIntStateOf(priorityFilter) }
        AffairsFilterDialog(onDismiss = { filtersOpen = false }, onApply = {
            statusFilter = draftStatus; completionFilter = draftCompletion
            assigneeFilter = draftAssignee; priorityFilter = draftPriority; filtersOpen = false
        }, onReset = { draftStatus = ""; draftCompletion = "any"; draftAssignee = ""; draftPriority = -1 }) {
            Text("Выполнение", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("any" to "Все задачи", "open" to "Незавершённые", "completed" to "Завершённые").forEach { (id, label) ->
                    FilterChip(draftCompletion == id, { draftCompletion = id }, label = { Text(label) },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("shared-filter-completion-$id"))
                }
            }
            Text("Статус", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(draftStatus.isBlank(), { draftStatus = "" }, label = { Text("Все") })
                statuses.forEach { status -> FilterChip(draftStatus == status.optString("id"),
                    { draftStatus = status.optString("id") }, label = { Text(sharedStatusLabel(status.optString("title"), en)) },
                    modifier = Modifier.heightIn(min = 48.dp)) }
            }
            Text("Исполнитель", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("" to "Все", "me" to "Назначено мне", "unassigned" to "Без исполнителя").forEach { (id, label) ->
                    FilterChip(draftAssignee == id, { draftAssignee = id }, label = { Text(label) },
                        modifier = Modifier.heightIn(min = 48.dp))
                }
                members.forEach { member -> FilterChip(draftAssignee == member.optString("userId"),
                    { draftAssignee = member.optString("userId") }, label = { Text(member.optString("displayName")) },
                    modifier = Modifier.heightIn(min = 48.dp)) }
            }
            Text("Приоритет", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Все", "Без приоритета", "Низкий приоритет", "Средний приоритет", "Высокий приоритет").forEachIndexed { index, label ->
                    FilterChip(draftPriority == index - 1, { draftPriority = index - 1 }, label = { Text(label) },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("shared-filter-priority-${index - 1}"))
                }
            }
        }
    }
    val currentSpace = spaces.firstOrNull { it.optString("id") == spaceId }
    val spaceCanCreate = currentSpace?.optString("role") in setOf("owner", "admin", "member")
    val filterCount = listOf(statusFilter.isNotBlank(), completionFilter != "any",
        assigneeFilter.isNotBlank(), priorityFilter >= 0).count { it }
    val dateValid = editTaskDueDate.isBlank() || runCatching { LocalDate.parse(editTaskDueDate) }.isSuccess
    val saveTask: () -> Unit = { run {
        val current = requireNotNull(selectedTask)
        check(canEditTask && !taskPending && !taskArchived && taskFieldsChanged && estimateDraft?.valid != false &&
            (estimateDraft?.dirty != true || planningEnabled) && current.optInt("revision") == editTaskRevision)
        val fields = sharedTaskDetailChanges(current, editTaskDetails, planningEnabled)
            .put("title", editTaskTitle.trim()).put("description", editTaskDescription.trim())
            .put("dueDate", editTaskDueDate.ifBlank { null } ?: JSONObject.NULL)
            .put("categoryId", editTaskCategoryId.ifBlank { null } ?: JSONObject.NULL)
            .put("expectedRevision", editTaskRevision)
        val changed = controller.updateSharedTask(projectId, taskId, fields).getJSONObject("task")
        pendingTasks = controller.queuedSharedTasks(projectId)
        if (changed.optBoolean("pending")) {
            openedTask = sharedPendingTask(current, changed, fields)
            message = if (en) "Change saved on this device. It will sync when connected."
                else "Изменение сохранено на устройстве и синхронизируется после подключения."
        } else {
            require(changed.optString("id") == taskId && changed.optString("projectId") == projectId) { "PLANNING_TASK_ACK_INVALID" }
            editTaskRevision = changed.getInt("revision"); editTaskDetails = sharedTaskDetailDraft(changed)
            editTaskTitle = changed.optString("title"); editTaskDescription = changed.optString("description")
            editTaskDueDate = changed.optString("dueDate").takeUnless { it == "null" }.orEmpty()
            editTaskCategoryId = changed.optString("categoryId").takeUnless { it == "null" }.orEmpty()
            openedTask = changed
            refreshProject(projectId); message = if (en) "Task saved." else "Задача сохранена."
        }
    } }
    Box(Modifier.fillMaxSize().onGloballyPositioned { rootPosition = it.boundsInWindow().topLeft }) {
    Column(Modifier.fillMaxSize().imePadding()) {
    Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(pageScroll).padding(AffairsLayout.gutter)
        .testTag("shared-projects-screen"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AffairsPageHeader(
            title = when {
                taskId.isNotBlank() -> if (en) "Task" else "Задача"
                projectId.isNotBlank() -> project?.optString("title").orEmpty()
                spaceId.isNotBlank() -> currentSpace?.optString("title").orEmpty()
                else -> if (en) "Shared affairs" else "Общие дела"
            },
            context = when {
                taskId.isNotBlank() -> project?.optString("title").orEmpty()
                projectId.isNotBlank() -> currentSpace?.optString("title").orEmpty() + " · " + genesisTranslate(sharedRoleLabel(role, en))
                spaceId.isNotBlank() -> if (en) "Projects" else "Проекты"
                else -> if (en) "Workspaces and projects" else "Пространства и проекты"
            }, icon = GenesisPageIcon.PROJECTS_SHARED,
            onBack = if (spaceId.isNotBlank()) ({ navigateBack() }) else null, backEnabled = !busy,
            titleIsUserContent = taskId.isBlank() && spaceId.isNotBlank(), contextIsUserContent = projectId.isNotBlank(),
            actions = {
                if (taskId.isBlank()) Box {
                    AffairsIconButton("Дополнительные действия", AffairsAction.MORE, { actionsOpen = true },
                        Modifier.testTag("shared-actions"))
                    DropdownMenu(actionsOpen, { actionsOpen = false }) {
                        if (projectId.isNotBlank()) {
                            DropdownMenuItem(text = { Text("Настройки проекта") }, onClick = {
                                actionsOpen = false; managementPage = "project"; showManagement = true })
                            DropdownMenuItem(text = { Text("Участники и роли") }, onClick = {
                                actionsOpen = false; managementPage = "team"; showManagement = true })
                            if (canWrite) {
                                DropdownMenuItem(text = { Text("Создать список задач") }, enabled = !busy && statuses.size < 30,
                                    onClick = { actionsOpen = false; createModal = "status" })
                                DropdownMenuItem(text = { Text("Добавить проект") }, enabled = !busy, onClick = {
                                    actionsOpen = false; createKind = "project"; parentId = projectId
                                    parentBoardId = ""; createModal = "project" })
                            }
                        } else {
                            DropdownMenuItem(text = { Text("Создать пространство") }, enabled = !busy,
                                onClick = { actionsOpen = false; createModal = "space" })
                            DropdownMenuItem(text = { Text("Присоединиться к пространству") }, enabled = !busy,
                                modifier = Modifier.testTag("shared-join-space"),
                                onClick = { actionsOpen = false; createModal = "join" })
                            if (spaceId.isNotBlank()) {
                                if (currentSpace?.optString("role") in setOf("owner", "admin"))
                                    DropdownMenuItem(text = { Text("Пригласить через Gmail") }, enabled = !busy,
                                        modifier = Modifier.testTag("shared-invite-space"),
                                        onClick = { actionsOpen = false; createModal = "invite" })
                                DropdownMenuItem(text = { Text("Архив проектов") }, onClick = {
                                    actionsOpen = false; showArchived = !showArchived })
                            }
                        }
                    }
                }
            })
        if (offlineSnapshot) Text(if (en) "Offline: showing the last protected team snapshot."
            else "Нет связи: показана последняя защищённая копия команды.",
            modifier = Modifier.fillMaxWidth().testTag("shared-offline-status"),
            color = MaterialTheme.colorScheme.secondary)
        if (pendingTasks.isNotEmpty()) Surface(Modifier.fillMaxWidth().testTag("shared-pending-tasks"),
            shape = AffairsLayout.shape, color = MaterialTheme.colorScheme.surfaceVariant) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (en) "Waiting to send · ${pendingTasks.size}" else "Ожидают отправки · ${pendingTasks.size}",
                    style = MaterialTheme.typography.titleSmall)
                pendingTasks.forEach { item -> Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(item.optString("title") + if (item.optString("error").isBlank()) "" else
                        if (en) " · Needs attention" else " · Нужна проверка", Modifier.weight(1f))
                    if (item.optString("error").isNotBlank()) TextButton(onClick = { failedDraft = item }) { Text("Подробнее") }
                } }
            }
        }
        if (message.isNotBlank() && taskId.isBlank()) Text(message, modifier = Modifier.testTag("shared-feedback"),
            color = if (messageIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
        if (projectId.isBlank()) {
            if (spaceId.isBlank()) {
                if (spaces.isEmpty()) {
                    Text("В этом разделе пока нет проектов.", style = MaterialTheme.typography.bodyMedium)
                    Button(onClick = { createModal = "space" }, enabled = !busy,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("shared-create-space")) {
                        Text("Создать пространство")
                    }
                    OutlinedButton(onClick = { createModal = "join" }, enabled = !busy,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("shared-join-space-empty")) {
                        Text("Присоединиться к пространству")
                    }
                }
                spaces.forEach { item ->
                    OutlinedCard(onClick = { spaceId = item.getString("id"); projectTrail = emptyList(); showArchived = false },
                        modifier = Modifier.fillMaxWidth().testTag("shared-space-${item.optString("id")}"),
                        shape = AffairsLayout.shape) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            androidx.compose.material3.Text(item.getString("title"), style = MaterialTheme.typography.titleMedium)
                            Text(sharedRoleLabel(item.optString("role"), en), style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            } else {
                if (spaceCanCreate) Button(onClick = {
                    createKind = "project"; parentId = ""; parentBoardId = ""; createModal = "project"
                }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("shared-create-project")) {
                    Text("Создать общий проект")
                }
                if (inboxProject != null) Card(onClick = { selectProject(inboxProject.optString("id")) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    shape = AffairsLayout.shape, modifier = Modifier.fillMaxWidth().testTag("shared-project-inbox")) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Хаос-бокс", style = MaterialTheme.typography.titleMedium)
                            Text("${inboxProject.optInt("taskCount")} задач", style = MaterialTheme.typography.bodySmall)
                        }
                        AffairsActionIcon(AffairsAction.EXPAND)
                    }
                }
                if (showArchived) {
                    Text("Архив проектов", style = MaterialTheme.typography.titleMedium)
                    archivedProjects.forEach { item -> Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text(item.optString("title"), modifier = Modifier.weight(1f))
                        if (item.optString("role") == "owner") TextButton(onClick = { run {
                            controller.setSharedProjectArchived(item.getString("id"), false)
                            refreshProjects(spaceId); selectProject(item.getString("id"))
                        } }, enabled = !busy) { Text("Восстановить") }
                    } }
                } else {
                    SharedProjectTree(projects, expandedIds, projectId, ::selectProject,
                        onToggle = { id -> persistExpansion(if (id in expandedIds) expandedIds - id else expandedIds + id) })
                    if (uiReadySpace == spaceId && projects.none { it.optInt("isInbox") == 0 })
                        Text("В этом разделе пока нет проектов.", style = MaterialTheme.typography.bodyMedium)
                }
                if (uiReadySpace != spaceId) LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        if (projectId.isNotBlank() && project == null) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (project != null) {
            if (taskId.isBlank()) {
                if (canWrite && statuses.isNotEmpty()) Button(onClick = {
                    newTaskStatusId = statuses.first().optString("id")
                    newTaskCategoryId = ""; newTaskAssigneeId = ""; createModal = "task"
                }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("shared-create-task")) {
                    Text("Добавить задачу")
                }
                AffairsSearchField(taskSearch, { taskSearch = it.take(200) }, "Поиск задач",
                    Modifier.testTag("shared-task-search"))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    TaskListSortChoice(taskSort, setTaskSort, Modifier.weight(1f), compact = true)
                    OutlinedButton(onClick = { filtersOpen = true }, modifier = Modifier.heightIn(min = 48.dp)
                        .testTag("shared-filters")) { Text("Фильтры" + if (filterCount > 0) " · $filterCount" else "") }
                }
                if (filterCount > 0 || taskSearch.isNotBlank()) Row(Modifier.fillMaxWidth(),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(taskPage?.optInt("total")?.toString().orEmpty(), Modifier.weight(1f), style = MaterialTheme.typography.labelLarge)
                    TextButton(onClick = { statusFilter = ""; completionFilter = "any"; assigneeFilter = "";
                    priorityFilter = -1; taskSearch = "" }, modifier = Modifier.testTag("shared-reset-filters")) { Text("Сбросить фильтры") }
                }
                if (filterCount > 0) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (statusFilter.isNotBlank()) InputChip(true, { statusFilter = "" }, label = {
                        Text(statuses.firstOrNull { it.optString("id") == statusFilter }?.optString("title") ?: "Статус") })
                    if (completionFilter != "any") InputChip(true, { completionFilter = "any" }, label = {
                        Text(if (completionFilter == "open") "Незавершённые" else "Завершённые") })
                    if (assigneeFilter.isNotBlank()) InputChip(true, { assigneeFilter = "" }, label = {
                        Text(when (assigneeFilter) { "me" -> "Назначено мне"; "unassigned" -> "Без исполнителя"
                            else -> members.firstOrNull { it.optString("userId") == assigneeFilter }?.optString("displayName") ?: "Исполнитель" }) })
                    if (priorityFilter >= 0) InputChip(true, { priorityFilter = -1 }, label = {
                        Text(listOf("Без приоритета", "Низкий приоритет", "Средний приоритет", "Высокий приоритет")[priorityFilter]) })
                }
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("list", "board", "calendar").forEach { view ->
                        FilterChip(selected = activeView == view, onClick = { viewOverride = view },
                            modifier = Modifier.heightIn(min = 48.dp).testTag("shared-view-$view"),
                            label = { Text(when (view) { "board" -> "Доска"; "calendar" -> "Календарь"; else -> "Список" }, maxLines = 1, softWrap = false) })
                    }
                }
                if (activeView == "calendar" && enabledCalendars.size > 1) Row(
                    Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    CalendarMode.entries.filter { it in enabledCalendars }.forEach { mode ->
                        FilterChip(selected = calendarMode == mode, onClick = {
                            calendarMode = mode; calendarAnchor = calendarDay
                            calendarPreferences.edit().putString("calendarMode", mode.wireValue).apply()
                        }, label = { Text(when (mode) {
                            CalendarMode.PROFANE -> "Григорианский"; CalendarMode.SACRED -> "Сакральный"; CalendarMode.LUNAR -> "Лунный"
                        }) })
                    }
                }
                if (taskPage == null) LinearProgressIndicator(Modifier.fillMaxWidth())
                else if (tasks.isEmpty()) Text("По вашему запросу ничего не найдено.", style = MaterialTheme.typography.bodyMedium)
            if (activeView == "calendar") {
                val locale = if (en) Locale.US else Locale.forLanguageTag("ru-RU")
                val range = calendarEngine.monthRange(calendarAnchor, calendarMode)
                val periodDates = range.dates()
                val offset = range.start.dayOfWeek.value - 1
                val cells = ((offset + periodDates.size + 6) / 7) * 7
                val periodTitle = when (calendarMode) {
                    CalendarMode.PROFANE -> range.start.format(DateTimeFormatter.ofPattern("LLLL yyyy", locale))
                    CalendarMode.SACRED -> calendarEngine.sacredDate(range.start).let {
                        "${SacredCatalog.months[it.monthIndex].name} · ${it.sacredYear}–${it.sacredYear + 1}"
                    }
                    CalendarMode.LUNAR -> calendarEngine.lunarDate(range.start).let {
                        "${it.month.name} · ${it.year.sacredYear}–${it.year.sacredYear + 1}"
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    TextButton(onClick = { val target = range.start.minusDays(1); calendarAnchor = target; calendarDay = target }) { Text("←") }
                    Text(periodTitle,
                        style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { val target = range.end.plusDays(1); calendarAnchor = target; calendarDay = target }) { Text("→") }
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
                            val index = week * 7 + weekday - offset
                            if (index < 0 || index >= periodDates.size) {
                                Spacer(Modifier.weight(1f))
                                return@repeat
                            }
                            val date = range.start.plusDays(index.toLong())
                            val count = snapshot?.optJSONObject("taskPage")?.optJSONObject("dateCounts")?.optInt(date.toString()) ?: 0
                            TextButton(onClick = { calendarDay = date; showUndated = false }, modifier = Modifier.weight(1f).height(54.dp).semantics {
                                contentDescription = calendarEngine.formatDate(date, calendarMode) +
                                    if (count > 0) (if (en) " · $count tasks" else " · задач: $count") else ""
                            },
                                contentPadding = PaddingValues(0.dp),
                                colors = ButtonDefaults.textButtonColors(contentColor = if (date == calendarDay)
                                    MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)) {
                                Column {
                                    Text(when (calendarMode) {
                                        CalendarMode.SACRED -> calendarEngine.sacredDate(date).day
                                        CalendarMode.LUNAR -> calendarEngine.lunarDate(date).day
                                        CalendarMode.PROFANE -> date.dayOfMonth
                                    }.toString(), style = MaterialTheme.typography.labelMedium)
                                    if (count > 0) Text(count.toString(), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
                Text(calendarEngine.formatDate(calendarDay, calendarMode),
                    style = MaterialTheme.typography.titleMedium)
                val due = tasks.filter { it.optString("dueDate") == calendarDay.toString() }
                if (due.isEmpty()) Text(if (en) "No team tasks due this day." else "На этот день нет общих задач со сроком.",
                    style = MaterialTheme.typography.bodySmall)
                due.forEach { task -> SharedTaskCard(task, statuses, canOrganize, busy, en, calendarMode,
                    category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                    completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                    assignedTo = members.firstOrNull { it.optString("userId") == task.optString("assigneeId") }?.optString("displayName"),
                    onOpen = { taskId = task.getString("id") },
                    onMove = { destination -> moveTaskStatus(task, destination) },
                    onDragStart = { position -> draggingTask = task; draggingAt = position; dropBounds.clear() },
                    onDragMove = { amount -> draggingAt = (draggingAt ?: Offset.Zero) + amount },
                    onDragEnd = { finishDrag() },
                    onDragCancel = { draggingTask = null; draggingAt = null; dropBounds.clear() }) }
                val undated = tasks.filter { it.isNull("dueDate") || it.optString("dueDate").isBlank() }
                if (true) {
                    TextButton(onClick = { showUndated = !showUndated }) {
                        Text((if (en) "Without a due date" else "Без срока") + if (showUndated) " · ${taskPage?.optInt("total") ?: 0}" else "")
                    }
                    if (showUndated) undated.forEach { task ->
                        TextButton(onClick = { taskId = task.getString("id") }) { Text(task.getString("title")) }
                    }
                }
            } else if (activeView == "board") {
                Text(if (en) "Swipe across the board to view all statuses."
                    else "Проведите по доске, чтобы увидеть все статусы.", style = MaterialTheme.typography.bodySmall)
                LazyRow(Modifier.fillMaxWidth().testTag("shared-boards"), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(statuses, key = { it.getString("id") }) { status -> Column(Modifier.width(250.dp)
                        .background(runCatching { Color(android.graphics.Color.parseColor(status.optString("color"))) }
                            .getOrDefault(MaterialTheme.colorScheme.primary).copy(alpha = .12f), RoundedCornerShape(14.dp))
                        .padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        SharedStatusHeader(status, en, canInvite, canWrite, busy,
                            onSettings = { openBoard(status) },
                            onCreateList = { createKind = "task-list"; parentId = projectId; parentBoardId = status.getString("id"); createModal = "project" },
                            onCreateProject = { createKind = "project"; parentId = projectId; parentBoardId = status.getString("id"); createModal = "project" })
                        SharedBoardImage(status.optString("imageUrl"))
                        projects.filter { it.optString("parentId") == projectId && (it.optString("boardStatusId") == status.optString("id") ||
                            it.optString("boardStatusId").let { value -> value.isBlank() || value == "null" } && status == statuses.firstOrNull()) }.forEach { child ->
                            OutlinedButton(onClick = { selectProject(child.getString("id")) }, modifier = Modifier.fillMaxWidth()) {
                                Text(child.optString("title"), modifier = Modifier.fillMaxWidth())
                            }
                            if (child.optString("role") in setOf("owner", "manager")) SharedContainerBoardMenu(child, statuses, en, busy) { destination -> run {
                                controller.updateSharedProject(child.getString("id"), JSONObject().put("title", child.optString("title"))
                                    .put("description", child.optString("description")).put("layout", child.optString("layout"))
                                    .put("parentId", projectId).put("boardStatusId", destination).put("expectedRevision", child.getInt("revision")))
                                refreshProjects(spaceId)
                            } }
                        }
                        tasks.filter { it.getString("statusId") == status.getString("id") }.forEach { task ->
                            SharedTaskCard(task, statuses, canOrganize, busy, en, calendarMode,
                                category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                                completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                    assignedTo = members.firstOrNull { it.optString("userId") == task.optString("assigneeId") }?.optString("displayName"),
                                onOpen = { taskId = task.getString("id") },
                                onMove = { destination -> moveTaskStatus(task, destination) },
                    onDragStart = { position -> draggingTask = task; draggingAt = position; dropBounds.clear() },
                    onDragMove = { amount -> draggingAt = (draggingAt ?: Offset.Zero) + amount },
                    onDragEnd = { finishDrag() },
                    onDragCancel = { draggingTask = null; draggingAt = null; dropBounds.clear() })
                        }
                    } }
                }
            } else statuses.forEach { status ->
                SharedStatusHeader(status, en, canInvite, canWrite, busy,
                            onSettings = { openBoard(status) },
                            onCreateList = { createKind = "task-list"; parentId = projectId; parentBoardId = status.getString("id"); createModal = "project" },
                            onCreateProject = { createKind = "project"; parentId = projectId; parentBoardId = status.getString("id"); createModal = "project" })
                        SharedBoardImage(status.optString("imageUrl"))
                        projects.filter { it.optString("parentId") == projectId && (it.optString("boardStatusId") == status.optString("id") ||
                            it.optString("boardStatusId").let { value -> value.isBlank() || value == "null" } && status == statuses.firstOrNull()) }.forEach { child ->
                            OutlinedButton(onClick = { selectProject(child.getString("id")) }, modifier = Modifier.fillMaxWidth()) {
                                Text(child.optString("title"), modifier = Modifier.fillMaxWidth())
                            }
                            if (child.optString("role") in setOf("owner", "manager")) SharedContainerBoardMenu(child, statuses, en, busy) { destination -> run {
                                controller.updateSharedProject(child.getString("id"), JSONObject().put("title", child.optString("title"))
                                    .put("description", child.optString("description")).put("layout", child.optString("layout"))
                                    .put("parentId", projectId).put("boardStatusId", destination).put("expectedRevision", child.getInt("revision")))
                                refreshProjects(spaceId)
                            } }
                        }
                tasks.filter { it.getString("statusId") == status.getString("id") }.forEach { task ->
                    SharedTaskCard(task, statuses, canOrganize, busy, en, calendarMode,
                        category = categories.firstOrNull { it.optString("id") == task.optString("categoryId") },
                        completedBy = members.firstOrNull { it.optString("userId") == task.optString("completedBy") }?.optString("displayName"),
                    assignedTo = members.firstOrNull { it.optString("userId") == task.optString("assigneeId") }?.optString("displayName"),
                        onOpen = { taskId = task.getString("id") },
                        onMove = { destination -> moveTaskStatus(task, destination) },
                    onDragStart = { position -> draggingTask = task; draggingAt = position; dropBounds.clear() },
                    onDragMove = { amount -> draggingAt = (draggingAt ?: Offset.Zero) + amount },
                    onDragEnd = { finishDrag() },
                    onDragCancel = { draggingTask = null; draggingAt = null; dropBounds.clear() })
                }
            }
            taskPage?.let { page ->
                Text(genesisTranslate("Показано: {loaded} из {total}").replace("{loaded}", tasks.size.toString()).replace("{total}", page.optInt("total").toString()))
                if (page.optBoolean("hasMore")) TextButton(enabled = !busy, onClick = { run {
                    try { taskPage = mergeSharedTaskPage(taskPage, controller.sortedSharedTasks(JSONObject(taskFilterKey), page.optString("nextCursor"),taskSort.wire), true) }
                    catch(error: Exception) { taskPage = controller.sortedSharedTasks(JSONObject(taskFilterKey),sort=taskSort.wire); message = error.message ?: "SHARED_QUERY_CHANGED" }
                } }) { Text("Показать ещё") }
            }
            }
            if (taskId.isNotBlank() && (selectedTask == null || draftTaskKey != "$projectId:$taskId")) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (selectedTask != null && draftTaskKey == "$projectId:$taskId") Column(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!canEditTask) androidx.compose.material3.Text(selectedTask.getString("title"), style = MaterialTheme.typography.titleLarge)
                    if (selectedTask.optString("seriesId").let { it.isNotBlank() && it != "null" }) {
                        Text(genesisTranslate("Серия общих задач"), style = MaterialTheme.typography.titleSmall)
                        Text(genesisTranslate("Изменения задачи относятся к этому повтору. Настройки серии действуют только на ещё не созданные задачи."), style = MaterialTheme.typography.bodySmall)
                    }
                    if (canEditTask) {
                        OutlinedTextField(editTaskTitle, { editTaskTitle = it },
                            label = { Text(if (en) "Name" else "Название") }, enabled = !busy, isError = editTaskTitle.isBlank(),
                            supportingText = if (editTaskTitle.isBlank()) ({ Text("Введите название задачи.") }) else null,
                            modifier = Modifier.fillMaxWidth().testTag("shared-task-title-input"))
                        OutlinedTextField(editTaskDescription, { editTaskDescription = it },
                            label = { Text(if (en) "Description" else "Описание") }, enabled = !busy, modifier = Modifier.fillMaxWidth())
                        SharedTaskEstimates(selectedTask, editTaskDetails, planningEnabled, canEditTask,
                            busy || taskPending || taskArchived, { editTaskDetails = it })
                        Text(if (en) "Due date" else "Срок", style = MaterialTheme.typography.titleSmall)
                        if (editTaskDueDate.isBlank()) TextButton(onClick = { editTaskDueDate = LocalDate.now().toString() }) {
                            Text(if (en) "Set due date" else "Установить срок")
                        } else {
                            AuthorDatePicker(editTaskDueDate, calendarMode) { editTaskDueDate = it }
                            TextButton(onClick = { editTaskDueDate = "" }) { Text(if (en) "Clear" else "Убрать срок") }
                        }
                        AffairsDisclosure("Дополнительные параметры задачи") {
                        Text(if (en) "Category" else "Категория", style = MaterialTheme.typography.bodySmall)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + categories).forEach { category ->
                                val id = category?.optString("id") ?: ""
                                FilterChip(selected = editTaskCategoryId == id,
                                    onClick = { editTaskCategoryId = id },
                                    label = { Text(category?.optString("title") ?: if (en) "No category" else "Без категории") })
                            }
                        }
                        SharedTaskDetailsFields(selectedTask, editTaskDetails, { editTaskDetails = it }, busy)
                    if (canEditTask) {
                        Text(if (en) "Assigned to" else "Исполнитель")
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (listOf<JSONObject?>(null) + members).forEach { member ->
                                val id = member?.getString("userId") ?: ""
                                FilterChip(selected = selectedTask.optString("assigneeId") == id,
                                    onClick = { run {
                                        val changed = controller.updateSharedTask(projectId, taskId, JSONObject()
                                            .put("assigneeId", if (id.isBlank()) JSONObject.NULL else id)
                                            .put("expectedRevision", selectedTask.getInt("revision"))).getJSONObject("task")
                                        pendingTasks = controller.queuedSharedTasks(projectId)
                                        if (changed.optBoolean("pending")) message = if (en)
                                            "Change saved on this device. It will sync when connected."
                                            else "Изменение сохранено на устройстве и синхронизируется после подключения."
                                        else refreshProject(projectId)
                                    } }, label = { Text(member?.optString("displayName") ?: if (en) "None" else "Никто") })
                            }
                        }
                    }
                        }
                        if (selectedTask.optInt("revision") != editTaskRevision) {
                            Text(if (en) "Changed elsewhere. Your draft is kept." else "Изменено другим участником. Черновик сохранён.",
                                color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = {
                                editTaskDetails = rebaseSharedTaskDetailDraft(selectedTask, editTaskDetails)
                                editTaskTitle = selectedTask.optString("title")
                                editTaskDescription = selectedTask.optString("description")
                                editTaskDueDate = selectedTask.optString("dueDate").takeUnless { it == "null" } ?: ""
                                editTaskCategoryId = selectedTask.optString("categoryId").takeUnless { it == "null" } ?: ""
                                editTaskRevision = selectedTask.optInt("revision")
                            }) { Text(if (en) "Reload fields" else "Обновить поля") }
                        }
                    } else {
                        if (selectedTask.optString("description").isNotBlank()) androidx.compose.material3.Text(selectedTask.getString("description"))
                        SharedTaskEstimates(selectedTask, editTaskDetails, planningEnabled, false,
                            busy || taskPending || taskArchived, { editTaskDetails = it })
                        SharedTaskDetailsFields(selectedTask, sharedTaskDetailDraft(selectedTask), {}, true)
                    }
                    Text(if (en) "Discussion" else "Обсуждение", style = MaterialTheme.typography.titleMedium)
                    Column(Modifier.onGloballyPositioned { val bounds=it.boundsInWindow();discussionVisible=bounds.top<discussionWindowHeight&&bounds.bottom>0 }) { comments.forEach { comment -> Text("${comment.optString("authorName")}: ${comment.getString("body")}") } }
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
    if (taskId.isNotBlank() && message.isNotBlank()) Text(message,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).testTag("shared-feedback"),
        color = if (messageIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
    if (taskId.isNotBlank() && selectedTask != null && canEditTask) AffairsSaveBar(saveTask,
        enabled = taskFieldsChanged && !taskPending && !taskArchived && estimateDraft?.valid != false &&
            (estimateDraft?.dirty != true || planningEnabled) && editTaskTitle.isNotBlank() && dateValid && selectedTask.optInt("revision") == editTaskRevision &&
            draftTaskKey == "$projectId:$taskId", busy = busy)
    }
    if (draggingTask != null && draggingAt != null) {
        val drag = draggingTask!!
        Surface(Modifier.align(androidx.compose.ui.Alignment.BottomCenter).fillMaxWidth().padding(8.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            shape = MaterialTheme.shapes.medium, shadowElevation = 10.dp) {
            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(if (en) "Drop task into a column or project" else "Перенесите задачу в колонку или проект",
                    style = MaterialTheme.typography.labelMedium)
                Row(Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    statuses.forEach { status ->
                        val key = "status:${status.optString("id")}"
                        val hover = dropBounds[key]?.contains(draggingAt!!) == true
                        Surface(Modifier.onGloballyPositioned { dropBounds[key] = it.boundsInWindow() }
                            .testTag("shared-drop-$key"), color = if (hover) MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surfaceContainerLow,
                            shape = MaterialTheme.shapes.small) {
                            Text(sharedStatusLabel(status.optString("title"), en), Modifier.padding(10.dp))
                        }
                    }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    projects.filter { it.optString("id") != projectId &&
                        (it.optString("role") in setOf("owner", "manager") ||
                            it.optString("spaceRole") in setOf("owner", "admin") ||
                            it.optInt("canOrganizeTasks") == 1) }.forEach { destination ->
                        val key = "project:${destination.optString("id")}"
                        val hover = dropBounds[key]?.contains(draggingAt!!) == true
                        Surface(Modifier.onGloballyPositioned { dropBounds[key] = it.boundsInWindow() }
                            .testTag("shared-drop-$key"), color = if (hover) MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surfaceContainerLow,
                            shape = MaterialTheme.shapes.small) {
                            Text(destination.optString("title"), Modifier.padding(10.dp))
                        }
                    }
                }
            }
        }
        Surface(Modifier.offset {
            IntOffset((draggingAt!!.x - rootPosition.x - 70.dp.toPx()).roundToInt(),
                (draggingAt!!.y - rootPosition.y - 24.dp.toPx()).roundToInt())
        }.widthIn(max = 180.dp), color = MaterialTheme.colorScheme.primaryContainer,
            shape = MaterialTheme.shapes.small, shadowElevation = 12.dp) {
            Text(drag.optString("title"), Modifier.padding(8.dp), maxLines = 1)
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
private fun SharedTaskCard(task: JSONObject, statuses: List<JSONObject>, canOrganize: Boolean, busy: Boolean,
    en: Boolean, calendarMode: CalendarMode, category: JSONObject?, completedBy: String?,
    onOpen: () -> Unit, onMove: (String) -> Unit, assignedTo: String? = null,
    onDragStart: ((Offset) -> Unit)? = null, onDragMove: ((Offset) -> Unit)? = null,
    onDragEnd: (() -> Unit)? = null, onDragCancel: (() -> Unit)? = null) {
    var topLeft by remember { mutableStateOf(Offset.Zero) }
    var actionsOpen by remember { mutableStateOf(false) }
    val currentStatus = statuses.firstOrNull { it.optString("id") == task.optString("statusId") }
    val completed = currentStatus?.optInt("isDone") == 1 ||
        task.optString("completedAt").let { it.isNotBlank() && it != "null" }
    val toggleStatus = statuses.firstOrNull { (it.optInt("isDone") == 1) != completed }
    val dueDate = task.optString("dueDate").takeUnless { it.isBlank() || it == "null" }
    val dueLabel = dueDate?.let { runCatching {
        GenesisCalendar().formatDate(LocalDate.parse(it), calendarMode)
    }.getOrDefault(it) }
    val priority = task.optInt("priority").takeIf { it in 1..3 }?.let {
        genesisTranslate(listOf("", "Низкий приоритет", "Средний приоритет", "Высокий приоритет")[it]) }
    val statusTitle = currentStatus?.optString("title")
    val statusLabel = statusTitle?.let {
        if (it in setOf("К выполнению", "В работе", "Готово")) genesisTranslate(sharedStatusLabel(it, en)) else it
    }
    val metadata = listOfNotNull(statusLabel,
        dueLabel, assignedTo?.takeIf(String::isNotBlank), priority,
        completedBy?.takeIf { completed }?.let { genesisTranslate("Выполнил(а): ") + it })
    val dragModifier = if (canOrganize && !busy && onDragStart != null) Modifier
        .onGloballyPositioned { topLeft = it.boundsInWindow().topLeft }
        .pointerInput(task.optString("id"), task.optInt("revision")) {
            detectDragGesturesAfterLongPress(
                onDragStart = { onDragStart(topLeft + it) },
                onDragEnd = { onDragEnd?.invoke() },
                onDragCancel = { onDragCancel?.invoke() },
                onDrag = { change, amount -> change.consume(); onDragMove?.invoke(amount) })
        } else Modifier
    AffairsTaskRow(task.getString("title"), completed, onOpen,
        modifier = Modifier.then(dragModifier).testTag("shared-task-${task.optString("id")}"),
        metadata = metadata, unreadComments = task.optInt("unreadCommentCount"), enabled = !busy,
        onComplete = if (canOrganize && toggleStatus != null) ({ onMove(toggleStatus.getString("id")) }) else null,
        actions = if (canOrganize) ({ Box {
            AffairsIconButton("Изменить статус", AffairsAction.MORE, { actionsOpen = true }, enabled = !busy)
            DropdownMenu(actionsOpen, { actionsOpen = false }) {
                statuses.forEach { status -> DropdownMenuItem(text = { Text(sharedStatusLabel(status.getString("title"), en)) },
                    enabled = !busy && task.optString("statusId") != status.optString("id"),
                    onClick = { actionsOpen = false; onMove(status.getString("id")) }) }
            }
        } }) else null,
        extra = if (category != null) ({ Text(category.optString("title"),
            Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.secondary) }) else null)
}

@Composable
private fun SharedStatusHeader(status: JSONObject, en: Boolean, canManage: Boolean, canCreate: Boolean,
    busy: Boolean, onSettings: () -> Unit, onCreateList: () -> Unit, onCreateProject: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Text(sharedStatusLabel(status.getString("title"), en), Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
        if (canManage || canCreate) Box {
            AffairsIconButton("Действия со списком задач", AffairsAction.MORE, { open = true },
                Modifier.testTag("shared-status-actions-${status.optString("id")}"), enabled = !busy)
            DropdownMenu(open, { open = false }) {
                if (canManage) DropdownMenuItem(text = { Text("Настройки") },
                    modifier = Modifier.testTag("shared-board-settings-${status.optString("id")}"),
                    onClick = { open = false; onSettings() })
                if (canCreate) {
                    DropdownMenuItem(text = { Text("Добавить список задач") }, onClick = { open = false; onCreateList() })
                    DropdownMenuItem(text = { Text("Добавить проект") }, onClick = { open = false; onCreateProject() })
                }
            }
        }
    }
}

@Composable
private fun SharedProjectTree(projects: List<JSONObject>, expanded: Set<String>, selected: String,
    onSelect: (String) -> Unit, onToggle: (String) -> Unit,
    parent: String? = null, ancestors: Set<String> = emptySet()) {
    projects.filter { item -> item.optInt("isInbox") == 0 &&
        item.optString("parentId").takeUnless { it.isBlank() || it == "null" } == parent && item.optString("id") !in ancestors
    }.forEach { item ->
        val id = item.getString("id")
        val hasChildren = projects.any { it.optString("parentId") == id }
        OutlinedCard(onClick = { onSelect(id) }, modifier = Modifier.fillMaxWidth()
            .padding(start = (minOf(ancestors.size, 4) * 12).dp).testTag("shared-project-$id"),
            shape = AffairsLayout.shape) {
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 8.dp, bottom = 8.dp, end = 4.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GenesisVectorIcon(if (item.optString("kind") == "task-list") GenesisPageIcon.TASK_LISTS
                    else GenesisPageIcon.PROJECTS, Modifier.size(24.dp), MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    androidx.compose.material3.Text(item.optString("title"), style = MaterialTheme.typography.titleMedium)
                    Text(if (item.optString("kind") == "task-list") "Список задач" else if (item.optString("layout") == "board") "Доски" else "Проект",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (hasChildren) AffairsIconButton(if (id in expanded) "Свернуть подпроекты" else "Показать подпроекты",
                    if (id in expanded) AffairsAction.COLLAPSE else AffairsAction.EXPAND, { onToggle(id) },
                    Modifier.testTag("shared-project-expand-$id"))
            }
        }
        if (id in expanded) SharedProjectTree(projects, expanded, selected, onSelect, onToggle, id, ancestors + id)
    }
}

@Composable
private fun SharedContainerBoardMenu(child: JSONObject, statuses: List<JSONObject>, en: Boolean,
    busy: Boolean, onMove: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { open = true }, enabled = !busy) { Text(if (en) "Move to board" else "Переместить на доску") }
        DropdownMenu(open, onDismissRequest = { open = false }) {
            statuses.forEach { status -> DropdownMenuItem(text = { Text(status.optString("title")) },
                onClick = { open = false; onMove(status.getString("id")) }) }
        }
    }
}

@Composable
private fun SharedBoardImage(url: String) {
    if (url.isBlank()) return
    val bitmap by produceState<android.graphics.Bitmap?>(null, url) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching { genesisImageBitmap(url, 600) }.getOrNull()
        }
    }
    bitmap?.let { androidx.compose.foundation.Image(it.asImageBitmap(), contentDescription = null,
        modifier = Modifier.fillMaxWidth().height(120.dp), contentScale = androidx.compose.ui.layout.ContentScale.Crop) }
}
