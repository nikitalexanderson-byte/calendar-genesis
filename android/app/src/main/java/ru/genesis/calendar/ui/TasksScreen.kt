package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import ru.genesis.calendar.auth.AccountSettings
import ru.genesis.calendar.data.*

@Composable internal fun TasksScreen(tasks: List<LocalTask>, lists: List<GoogleTaskList>,
    structure: WorkspaceStructure, use24: Boolean, confirmed: Boolean,
    onCreateTask: (GoogleTaskList?) -> Unit, onCreateList: () -> Unit,
    onComplete: (LocalTask) -> Unit, onOpen: (String) -> Unit,
    menuSwipeState: MenuSwipeState? = null) {
    var localSection by rememberSaveable { mutableStateOf("tasks") }
    val section = menuSwipeState?.tasks ?: localSection
    var expanded by rememberSaveable { mutableStateOf<String?>(null) }
    val knownLists = remember(lists, tasks) { taskListsForTasks(lists,tasks) }
    val english = LocalGenesisLanguage.current == "en"
    val total = tasks.size
    val active = tasks.count { !it.done }
    Column(Modifier.fillMaxSize()) {
        ConnectedSubmenu(listOf(SubmenuItem("tasks", "Задачи"), SubmenuItem("lists", "Списки задач")),
            section, { localSection = it; menuSwipeState?.tasks = it })
        LazyVerticalGrid(columns = GridCells.Adaptive(360.dp), modifier = Modifier.weight(1f).testTag("tasks-screen"), contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    GenesisPageHeader(if (section == "lists") {
                        if (english) "Task lists" else "Списки задач"
                    } else if (english) "Tasks" else "Задачи",
                        if (section == "lists") {
                            if (english) "Organize tasks by list" else "Организуйте задачи по спискам"
                        } else if (english) "Your tasks, due dates, priorities and reminders"
                        else "Все задачи, сроки, приоритеты и напоминания", "✦",
                        icon = if (section == "lists") GenesisPageIcon.TASK_LISTS else GenesisPageIcon.TASKS)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(if(english) "$total tasks · $active active · ${knownLists.size} lists" else
                            "$total ${russianCount(total,"задача","задачи","задач")} · $active ${russianCount(active,"активная","активные","активных")} · " +
                            "${knownLists.size} ${russianCount(knownLists.size,"список","списка","списков")}",
                            Modifier.weight(1f).padding(end = 8.dp).testTag("tasks-summary"), style = MaterialTheme.typography.labelLarge)
                        Button(onClick = if (section == "lists") onCreateList else ({ onCreateTask(null) }),
                            modifier = Modifier.heightIn(min = 48.dp).testTag("create-task")) { Text("Создать") }
                    }
                }
            }
            if(section == "tasks") {
                if(tasks.isEmpty()) item { Text(if(!confirmed) "Ожидаем загрузки задач аккаунта." else "Задач пока нет. Создайте первую запись.") }
                items(tasks, key = { it.id }) { task -> NativeTaskCard(task,use24,structure,onComplete,onOpen) }
            } else {
                if(knownLists.isEmpty()) item { Text("Списков пока нет. Создайте список и добавьте в него задачи.") }
                items(knownLists, key = { "${it.accountId}/${it.id}" }) { list ->
                    val rows = tasks.filter { it.taskListId() == list.id &&
                        JSONObject(it.sourceFieldsJson).optString("googleAccountId").let { account -> list.accountId == null || account == list.accountId } }
                    val project = structure.taskListLinks.firstOrNull { it.taskListId == list.id }?.projectId
                        ?.let { id -> structure.projects.firstOrNull { it.id == id } }
                    val key = "${list.accountId}/${list.id}"
                    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f).clickable { expanded = if(expanded == key) null else key }.padding(4.dp)) {
                                    Text(list.title,style = MaterialTheme.typography.titleMedium)
                                    Text("${rows.count { it.done }} / ${rows.size} · ${project?.title ?: "Без проекта"}",
                                        style = MaterialTheme.typography.bodySmall)
                                    if(list.accountEmail.isNotBlank()) Text(list.accountEmail,style = MaterialTheme.typography.labelSmall)
                                }
                                TextButton({ expanded = if(expanded == key) null else key }) { Text(if(expanded == key) "Свернуть" else "Открыть") }
                            }
                            if(expanded == key) {
                                if(rows.isEmpty()) Text("В списке пока нет задач.")
                                rows.forEach { NativeTaskCard(it,use24,structure,onComplete,onOpen) }
                                OutlinedButton({ onCreateTask(list) }, Modifier.fillMaxWidth()) { Text("Добавить задачу") }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun NativeTaskCard(task: LocalTask, use24: Boolean, structure: WorkspaceStructure,
    onComplete: (LocalTask) -> Unit, onOpen: (String) -> Unit) {
    Card(Modifier.fillMaxWidth().testTag("task-${task.id}"), shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = if(task.done) completedTaskSurface else MaterialTheme.colorScheme.surfaceContainerLowest,
            contentColor = if(task.done) completedTaskInk else MaterialTheme.colorScheme.onSurface),
        border = BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(task.done, { onComplete(task) },colors=CheckboxDefaults.colors(checkedColor=completedTaskInk))
            Column(Modifier.weight(1f).clickable { onOpen(task.id) }.padding(8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                TaskTitle(task,Modifier.testTag("task-title-${task.id}"),style=MaterialTheme.typography.titleMedium)
                Text("${task.date} ${timeLabel(task.time,use24)} · Приоритет ${task.priority}" + if(task.recurrence.enabled) " · Повторяется" else "",
                    style=MaterialTheme.typography.bodySmall)
                task.projectId?.let { id -> Text(structure.projects.firstOrNull { it.id == id }?.title ?: task.project.ifBlank { "Проект" },
                    style=MaterialTheme.typography.labelSmall, color=if(task.done) completedTaskInk else MaterialTheme.colorScheme.primary) }
            }
        }
    }
}

@Composable internal fun TaskListEditor(structure: WorkspaceStructure, accounts: AccountSettings?, prefs: UiPreferences,
    canCreate: Boolean, onDismiss: () -> Unit, onCreate: suspend (String,String) -> GoogleTaskList,
    onSaveTasks: suspend (GoogleTaskList,String?,String,List<Pair<String,String>>) -> Unit) {
    var title by rememberSaveable { mutableStateOf("") }
    var projectId by rememberSaveable { mutableStateOf<String?>(null) }
    val connected = accounts?.accounts.orEmpty().filter { it.tasksConnected }
    var accountId by rememberSaveable { mutableStateOf(connected.firstOrNull { it.id in accounts?.routing?.defaultAccountIds.orEmpty() }?.id ?: connected.firstOrNull()?.id.orEmpty()) }
    var date by rememberSaveable { mutableStateOf(java.time.LocalDate.now().toString()) }
    var formCalendarMode by rememberSaveable { mutableStateOf(prefs.input) }
    var rowsText by rememberSaveable { mutableStateOf("") }
    var rowIds by rememberSaveable { mutableStateOf(listOf<String>()) }
    var createdJson by rememberSaveable { mutableStateOf<String?>(null) }
    val created = createdJson?.let { GoogleTaskList.from(JSONObject(it)) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Dialog({ if(!busy) onDismiss() }, properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.widthIn(max = 840.dp).fillMaxWidth().padding(12.dp),shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(16.dp).imePadding()) {
                EditorDialogHeader("Новый список задач", "close-task-list-editor", { if(!busy) onDismiss() })
                Column(Modifier.weight(1f,fill=false).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Text("Список хранится в Google Tasks и доступен на сайте и смартфоне.",style=MaterialTheme.typography.bodySmall)
                    OutlinedTextField(title,{title=it},label={Text("Название списка")},enabled=!busy && created==null,
                        singleLine=true,modifier=Modifier.fillMaxWidth().testTag("task-list-title"))
                    if(!canCreate || connected.isEmpty()) Text("Подключите Google Tasks и войдите в аккаунт в настройках.", color=MaterialTheme.colorScheme.error)
                    else connected.forEach { account ->
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                            RadioButton(accountId==account.id,{accountId=account.id},enabled=!busy && created==null)
                            Text(account.email,style=MaterialTheme.typography.bodyMedium)
                        }
                    }
                    ProjectHierarchyPicker(structure.projects,projectId) { if(!busy && created==null) projectId=it }
                    Text("Задачи списка · по одной в строке",style=MaterialTheme.typography.titleSmall)
                    OutlinedTextField(rowsText,{rowsText=it},enabled=!busy && created==null,label={Text("Задачи списка")},minLines=3,
                        modifier=Modifier.fillMaxWidth().testTag("task-list-drafts"))
                    EditorCalendarModePicker(formCalendarMode, { formCalendarMode=it },
                        enabled=!busy && created==null, tag="task-list-form-calendar")
                    Text("Дата задач · ${calendarModeLabel(formCalendarMode)}")
                    AuthorDatePicker(date,formCalendarMode) { if(!busy && created==null) date=it }
                    error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
                    Button(enabled=canCreate && connected.any { it.id==accountId } && title.trim().length in 1..300 && !busy,
                        modifier=Modifier.fillMaxWidth().testTag("save-task-list"),onClick={
                            val rows=rowsText.lines().map(String::trim).filter(String::isNotBlank)
                            if(rows.size>100 || rows.any { it.length>500 }) { error="Добавьте до 100 задач, до 500 символов каждая."; return@Button }
                            if(rowIds.size<rows.size) rowIds=rowIds + List(rows.size-rowIds.size) { UUID.randomUUID().toString() }
                            busy=true; error=null
                            scope.launch {
                                try {
                                    val list=created ?: onCreate(title.trim(),accountId).also { createdJson=it.json().toString() }
                                    onSaveTasks(list,projectId,date,rows.mapIndexed { index,text -> rowIds[index] to text })
                                    onDismiss()
                                } catch(e:CancellationException) { throw e }
                                catch(e:IllegalArgumentException) { error=e.message ?: "Проверьте данные списка." }
                                catch(_:Exception) { error=if(createdJson==null) "Не удалось создать список. Проверьте подключение и повторите попытку."
                                    else "Список создан. Не удалось сохранить все задачи; повторите сохранение." }
                                finally { busy=false }
                            }
                        }) { Text(if(busy) "Сохраняем…" else if(created==null) "Создать список" else "Сохранить задачи") }
                }
            }
        }
    }
}
