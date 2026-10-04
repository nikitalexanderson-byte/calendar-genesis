package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
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
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.GoogleTaskList
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.data.TaskReminder
import ru.genesis.calendar.data.WorkspaceStructure
import ru.genesis.calendar.data.listTaskFields
import ru.genesis.calendar.domain.CalendarMode

@Composable
internal fun NativeVoiceAssistantDialog(app: GenesisApplication, structure: WorkspaceStructure,
    taskLists: List<GoogleTaskList>, tasks: List<LocalTask>, habits: List<Habit>,
    calendarMode: CalendarMode, use24: Boolean, language: String,
    onDismiss: () -> Unit, onSaved: () -> Unit, onAction: (NativeVoiceAction) -> Unit,
    onStartControl: () -> Unit) {
    val english=language=="en"
    val scope=rememberCoroutineScope()
    val ownerScope=remember(app) { app.workspaceScope }
    var command by rememberSaveable { mutableStateOf("") }
    var drafts by remember { mutableStateOf<List<NativeVoiceTask>>(emptyList()) }
    var action by remember { mutableStateOf<NativeVoiceAction?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Dialog(onDismissRequest={if(!busy)onDismiss()},properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.fillMaxWidth(.94f).fillMaxHeight(.88f),shape=RoundedCornerShape(24.dp),
            color=MaterialTheme.colorScheme.surface,border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.fillMaxSize().imePadding().padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                    Text(if(english)"Voice assistant" else "Голосовой помощник",Modifier.weight(1f),
                        style=MaterialTheme.typography.titleLarge)
                    IconButton(onClick=onDismiss,enabled=!busy,modifier=Modifier.testTag("voice-assistant-close")) {
                        Text("×",style=MaterialTheme.typography.headlineSmall)
                    }
                }
                Text(if(english)"Mode: voice dictation" else "Режим: голосовой набор",
                    style=MaterialTheme.typography.labelMedium)
                OutlinedButton(onClick=onStartControl,modifier=Modifier.fillMaxWidth()
                    .testTag("voice-control-enable")) {
                    Text(if(english)"Switch to app control" else "Включить управление приложением")
                }
                Text(if(english)"Dictate or type a command. Create tasks, projects and habits; open items to edit; move tasks; navigate sections. Check the preview before applying."
                    else "Продиктуйте или напишите команду: создать задачу, проект или привычку, открыть редактирование, перенести задачу или перейти в раздел. Проверьте результат перед выполнением.",
                    style=MaterialTheme.typography.bodySmall)
                OutlinedTextField(command,{command=it;drafts=emptyList();action=null;error=null},
                    modifier=Modifier.fillMaxWidth().heightIn(min=96.dp).testTag("voice-command"),enabled=!busy,
                    label={Text(if(english)"Task command" else "Команда")},minLines=2,maxLines=4)
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    VoiceSpeechInput(english,!busy,modifier=Modifier.weight(1f),onTranscript={ transcript ->
                        command=listOf(command.trim(),transcript.trim()).filter(String::isNotEmpty).joinToString(" ")
                        drafts=emptyList();action=null;error=null
                    },onFailure={error=it})
                    Button(onClick={
                        error=null
                        runCatching {
                            val intent=parseNativeVoiceAction(command,tasks,structure.projects,habits)
                            if(intent!=null) { action=intent;drafts=emptyList() }
                            else {
                                require(!looksLikeUnsupportedVoiceAction(command)) {
                                    if(english)"I could not match that action. Try an exact item title or choose a supported command."
                                    else "Не удалось определить действие. Уточните название или выберите поддерживаемую команду."
                                }
                                drafts=parseNativeVoicePlan(command,LocalDate.now(),structure.projects,taskLists);action=null
                            }
                        }
                            .onFailure { error=it.message ?: if(english)"Could not parse the command." else "Не удалось разобрать команду." }
                    },enabled=!busy&&command.isNotBlank(),modifier=Modifier.testTag("voice-preview")) {
                        Text(if(english)"Preview" else "Проверить")
                    }
                }
                Text(if(english)"Android's speech service may send audio to its provider. Typed commands are parsed on this device."
                    else "Служба распознавания Android может передавать аудио своему поставщику. Написанные команды разбираются на устройстве.",
                    style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                error?.let { Text(it,color=MaterialTheme.colorScheme.error,style=MaterialTheme.typography.bodySmall) }
                action?.let { preview ->
                    HorizontalDivider()
                    Text(when(preview) {
                        is NativeVoiceAction.Navigate -> "Открыть раздел: ${preview.section}"
                        is NativeVoiceAction.CalendarModeChange -> "Переключить календарь: ${preview.mode.wireValue}"
                        is NativeVoiceAction.CalendarView -> if(preview.year) "Открыть год" else "Открыть месяц"
                        is NativeVoiceAction.CalendarStep -> when {
                            preview.year && preview.step>0 -> "Следующий год"
                            preview.year -> "Предыдущий год"
                            preview.step>0 -> "Следующий месяц"
                            else -> "Предыдущий месяц"
                        }
                        is NativeVoiceAction.CalendarSwipe -> if(preview.step>0) "Свайп влево" else "Свайп вправо"
                        is NativeVoiceAction.CalendarDate -> "Выбрать дату: ${preview.day}.${preview.month}.${preview.year}"
                        is NativeVoiceAction.CalendarMonth -> "Выбрать месяц: ${preview.ordinal}"
                        is NativeVoiceAction.Scroll -> "Прокрутить: ${preview.direction}"
                        is NativeVoiceAction.CreateProject -> "Создать проект: ${preview.title}"
                        is NativeVoiceAction.CreateTaskList -> "Создать список задач: ${preview.title}"
                        is NativeVoiceAction.EditProject -> "Изменить проект: ${preview.title}"
                        is NativeVoiceAction.CreateHabit -> "Создать привычку: ${preview.title}"
                        is NativeVoiceAction.EditHabit -> "Изменить привычку: ${preview.title}"
                        is NativeVoiceAction.DeleteHabit -> "Открыть подтверждение удаления привычки: ${preview.title}"
                        is NativeVoiceAction.EditTask -> "Открыть задачу для редактирования: ${preview.title}"
                        is NativeVoiceAction.SetTaskDone -> "${if(preview.done)"Выполнить задачу" else "Снять отметку задачи"}: ${preview.title}"
                        is NativeVoiceAction.SetHabitDone -> "${if(preview.done)"Выполнить привычку" else "Снять отметку привычки"}: ${preview.title}"
                        is NativeVoiceAction.MoveTask -> "Перенести задачу: ${preview.title}"
                    },style=MaterialTheme.typography.titleMedium)
                    Button(onClick={onAction(preview)},enabled=!busy,
                        modifier=Modifier.fillMaxWidth().testTag("voice-apply-action")) {
                        Text(if(english)"Continue" else "Продолжить")
                    }
                }
                if(drafts.isNotEmpty()) {
                    HorizontalDivider()
                    Text(if(english)"Tasks to create: ${drafts.size}" else "Задачи к созданию: ${drafts.size}",
                        style=MaterialTheme.typography.titleMedium)
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        drafts.forEachIndexed { index,draft ->
                            Surface(shape=RoundedCornerShape(14.dp),color=MaterialTheme.colorScheme.surfaceContainerHigh,
                                border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
                                Column(Modifier.fillMaxWidth().padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                    OutlinedTextField(draft.title,{ title ->
                                        drafts=drafts.mapIndexed { i,item -> if(i==index)item.copy(title=title.take(300)) else item }
                                    },label={Text(if(english)"Title" else "Название")},enabled=!busy,modifier=Modifier.fillMaxWidth())
                                    AuthorDatePicker(draft.date.toString(),calendarMode) { value ->
                                        drafts=drafts.mapIndexed { i,item -> if(i==index)item.copy(date=LocalDate.parse(value)) else item }
                                    }
                                    AuthorTimePicker(draft.time,use24) { value ->
                                        drafts=drafts.mapIndexed { i,item -> if(i==index)item.copy(time=value) else item }
                                    }
                                    val project=structure.projects.firstOrNull { it.id==draft.projectId }?.title
                                    val list=taskLists.firstOrNull { it.id==draft.taskListId }?.title
                                    val routing=listOfNotNull(project?.let { "${if(english)"Project" else "Проект"}: $it" },
                                        list?.let { "${if(english)"List" else "Список"}: $it" })
                                    if(routing.isNotEmpty()) Text(routing.joinToString(" · "),style=MaterialTheme.typography.bodySmall)
                                    if(draft.reminderMinutes>0) Text(if(draft.time.isBlank()) {
                                        if(english)"Set a time to enable the reminder" else "Укажите время для напоминания"
                                    } else if(english)"Remind ${draft.reminderMinutes} min before"
                                        else "Напомнить за ${draft.reminderMinutes} мин",
                                        style=MaterialTheme.typography.bodySmall,
                                        color=if(draft.time.isBlank()) MaterialTheme.colorScheme.error
                                            else MaterialTheme.colorScheme.onSurfaceVariant)
                                    TextButton(onClick={drafts=drafts.filterIndexed { i,_ -> i!=index }},enabled=!busy) {
                                        Text(if(english)"Remove" else "Убрать")
                                    }
                                }
                            }
                        }
                    }
                    Button(onClick={scope.launch {
                        busy=true;error=null
                        try {
                            val repository=app.repository
                            while(drafts.isNotEmpty()) {
                                check(app.workspaceScope==ownerScope) { "Аккаунт изменился. Откройте помощника заново." }
                                val draft=drafts.first()
                                require(draft.title.isNotBlank()) { "Введите название задачи." }
                                val list=taskLists.firstOrNull { it.id==draft.taskListId }
                                val projectId=draft.projectId ?: structure.taskListLinks.firstOrNull { it.taskListId==list?.id }?.projectId
                                val source=(list?.let { listTaskFields(it,calendarMode) } ?: JSONObject())
                                    .put("tags",JSONArray(draft.tags))
                                repository.save(LocalTask(title=draft.title.trim(),date=draft.date.toString(),time=draft.time,
                                    zoneId=ZoneId.systemDefault().id,priority=draft.priority,projectId=projectId,
                                    categoryId=structure.projects.firstOrNull { it.id==projectId }?.categoryId,
                                    sourceFieldsJson=source.toString(),reminders=if(draft.time.isNotBlank() && draft.reminderMinutes>0)
                                        listOf(TaskReminder.relative(draft.reminderMinutes)) else emptyList()))
                                drafts=drafts.drop(1)
                            }
                            onSaved()
                        } catch (failure: Exception) {
                            error=failure.message ?: if(english)"Could not save all tasks. Remaining tasks are still in the preview."
                                else "Не удалось сохранить все задачи. Оставшиеся задачи видны в списке."
                        } finally { busy=false }
                    }},enabled=!busy&&drafts.all { it.title.isNotBlank() && (it.reminderMinutes<=0 || it.time.isNotBlank()) },
                        modifier=Modifier.fillMaxWidth().heightIn(min=48.dp).testTag("voice-save")) {
                        Text(if(busy)"…" else if(english)"Create tasks" else "Создать задачи")
                    }
                } else Spacer(Modifier.weight(1f))
            }
        }
    }
}
