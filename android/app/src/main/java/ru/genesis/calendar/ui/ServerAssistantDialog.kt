package ru.genesis.calendar.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.auth.AssistantGateway
import ru.genesis.calendar.auth.LinkedGoogleAccount
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.CalendarMode
import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import java.util.Base64

private class AssistantRecording(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var file: File? = null
    fun start() {
        clear()
        val target = File.createTempFile("assistant-", ".m4a", context.cacheDir)
        file = target
        try {
            @Suppress("DEPRECATION")
            val activeRecorder = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else MediaRecorder()
            recorder = activeRecorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16000); setAudioEncodingBitRate(64000)
                setMaxDuration(60_000); setMaxFileSize(4 * 1024 * 1024)
                setOutputFile(target.absolutePath); prepare(); start()
            }
        } catch (error: Exception) { clear(); throw error }
    }
    fun stop(): ByteArray {
        try {
            recorder?.stop()
            val target = requireNotNull(file)
            require(target.length() in 1..(4 * 1024 * 1024).toLong())
            return target.readBytes()
        } finally { clear() }
    }
    fun clear() {
        runCatching { recorder?.release() }; recorder = null
        file?.delete(); file = null
    }
}

@Composable
internal fun ServerAssistantDialog(app: GenesisApplication, uid: String, gateway: AssistantGateway,
    structure: WorkspaceStructure, lists: List<GoogleTaskList>, accounts: List<LinkedGoogleAccount>,
    mode: CalendarMode, language: String, createList: suspend (String, String) -> GoogleTaskList,
    onDismiss: () -> Unit, onSaved: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val recording = remember(context) { AssistantRecording(context) }
    val repository = remember(app, uid, gateway) { AssistantPlanRepository(app, uid, gateway, createList) }
    var status by remember { mutableStateOf<JSONObject?>(null) }
    var command by rememberSaveable(uid) { mutableStateOf("") }
    var audio by remember { mutableStateOf<ByteArray?>(null) }
    var recordingNow by remember { mutableStateOf(false) }
    var journal by remember { mutableStateOf<JSONObject?>(null) }
    var busy by remember { mutableStateOf(false) }
    var storageBlocked by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmingClose by remember { mutableStateOf(false) }
    var confirmingDiscard by remember { mutableStateOf(false) }
    val provider = status?.optString("provider")?.let { if (it == "gemini") "Gemini" else if (it == "gigachat") "GigaChat" else "GENESIS" } ?: "GENESIS"
    fun copy(source: String) = translateGenesisText(context, source, language)
    fun fail(failure: Throwable) { error = failure.message?.takeIf { it.isNotBlank() && it != "Authentication request failed" } ?: copy("Не удалось подготовить план. Проверьте соединение и повторите.") }
    fun close() {
        if (!busy && !recordingNow) {
            if (journal != null) onDismiss()
            else if (command.isNotBlank() || audio != null) confirmingClose = true else onDismiss()
        }
    }
    fun stopRecording() {
        if (!recordingNow) return
        recordingNow = false
        runCatching { recording.stop() }.onSuccess { audio?.fill(0); audio = it }.onFailure { error = copy("Не удалось прочитать запись. Запишите команду ещё раз.") }
    }
    fun startRecording() {
        runCatching { recording.start() }.onSuccess { audio?.fill(0); audio = null; recordingNow = true; error = null }
            .onFailure { error = copy("Микрофон недоступен. Напишите команду или повторите запись.") }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startRecording() else error = copy("Разрешите микрофон в настройках Android или напишите команду.")
    }
    DisposableEffect(recording) { onDispose { recording.clear(); audio?.fill(0) } }
    LaunchedEffect(recordingNow) { if (recordingNow) { delay(59_000); stopRecording() } }
    LaunchedEffect(repository) {
        busy = true
        try { journal = repository.load() }
        catch (failure: CancellationException) { throw failure }
        catch (failure: Exception) { storageBlocked = true; fail(failure) }
        try { status = gateway.status() }
        catch (failure: CancellationException) { throw failure }
        catch (failure: Exception) { fail(failure) }
        finally { busy = false }
    }
    Dialog(onDismissRequest = ::close, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = !busy && !recordingNow)) {
        Surface(Modifier.fillMaxWidth(.96f).fillMaxHeight(.94f), shape = AffairsLayout.shape) {
            Column(Modifier.fillMaxSize().imePadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EditorDialogHeader(genesisTranslate("Серверный помощник") + " · $provider", "server-assistant-close", onClose = ::close)
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Личное пространство", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    if (journal == null) {
                        Text("План может создавать проекты, списки и задачи. Проверьте даты и место назначения перед сохранением.", style = MaterialTheme.typography.bodyMedium)
                        Text(if (provider == "GigaChat") "Команда, запись, названия проектов и списков и адреса подключённых аккаунтов будут отправлены в GigaChat после нажатия «Подготовить план»."
                            else "Команда, запись, названия проектов и списков и адреса подключённых аккаунтов будут отправлены в Google Gemini после нажатия «Подготовить план».",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (status?.optBoolean("available") == false) Text("Серверный помощник сейчас недоступен. Можно вернуться к локальному помощнику.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedTextField(command, { command = it.take(6000) }, Modifier.fillMaxWidth().testTag("server-assistant-command"),
                            label = { Text("Команда") }, minLines = 3, maxLines = 8, enabled = !busy && !recordingNow)
                        if (status?.optBoolean("audioAvailable") == true) OutlinedButton(onClick = {
                            if (recordingNow) stopRecording()
                            else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRecording()
                            else permission.launch(Manifest.permission.RECORD_AUDIO)
                        }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("server-assistant-record")) {
                            GenesisLucideIcon(if (recordingNow) "pause" else "mic", Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp)); Text(if (recordingNow) "Остановить запись" else if (audio != null) "Записать заново" else "Записать команду")
                        }
                        if (recordingNow) Text("Идёт запись · максимум 60 секунд", style = MaterialTheme.typography.bodySmall)
                        audio?.let { Text(genesisTranslate("Запись готова") + " · ${it.size / 1024} KB", style = MaterialTheme.typography.bodySmall) }
                        Button(onClick = { scope.launch {
                            busy = true; error = null
                            try {
                                val payload = JSONObject().put("language", language).put("calendarMode", mode.wireValue)
                                    .put("today", LocalDate.now().toString()).put("timeZone", ZoneId.systemDefault().id)
                                    .put("categories", JSONArray(structure.categories.map { JSONObject().put("name", it.name) }))
                                    .put("projects", JSONArray(structure.projects.map { project -> JSONObject().put("title", project.title)
                                        .put("parent", structure.projects.firstOrNull { it.id == project.parentId }?.title.orEmpty())
                                        .put("category", structure.categories.firstOrNull { it.id == project.categoryId }?.name.orEmpty()) }))
                                    .put("taskLists", JSONArray(lists.map { JSONObject().put("title", it.title).put("accountEmail", it.accountEmail) }))
                                    .put("accounts", JSONArray(accounts.map { JSONObject().put("email", it.email) }))
                                val response = gateway.plan(command, audio?.let { JSONObject().put("mimeType", "audio/mp4").put("data", Base64.getEncoder().encodeToString(it)) }, payload)
                                journal = repository.prepare(response, structure, lists, accounts)
                                audio?.fill(0); audio = null
                            } catch (failure: CancellationException) { throw failure }
                            catch (failure: Exception) { fail(failure) }
                            finally { busy = false }
                        } }, enabled = !busy && !recordingNow && !storageBlocked && status?.optBoolean("available") == true && (command.isNotBlank() || audio != null),
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("server-assistant-preview")) {
                            Text(if (busy) "Подготовка…" else "Подготовить план")
                        }
                    } else journal?.let { saved ->
                        val plan = saved.getJSONObject("response").getJSONObject("plan")
                        Text("Проверка перед созданием", style = MaterialTheme.typography.titleMedium)
                        Text(plan.optString("summary"), style = MaterialTheme.typography.bodyMedium)
                        Text("План сохранён на устройстве в зашифрованном виде. Его можно продолжить после закрытия.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        for ((field, label) in listOf("projects" to "Проекты", "taskLists" to "Списки задач", "tasks" to "Задачи")) {
                            val rows = plan.getJSONArray(field)
                            if (rows.length() > 0) {
                                Text(label + " · ${rows.length()}", style = MaterialTheme.typography.titleMedium)
                                for (index in 0 until rows.length()) {
                                    val row = rows.getJSONObject(index)
                                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(row.getString("title"), style = MaterialTheme.typography.titleSmall)
                                        val listName = if (field == "tasks") row.optString("taskList") else if (field == "taskLists") row.getString("title") else ""
                                        val plannedLists = plan.getJSONArray("taskLists")
                                        val plannedList = (0 until plannedLists.length()).map { plannedLists.getJSONObject(it) }
                                            .firstOrNull { AssistantPlanProtocol.key(it.getString("title")) == AssistantPlanProtocol.key(listName) }
                                        val existingList = lists.singleOrNull { AssistantPlanProtocol.key(it.title) == AssistantPlanProtocol.key(listName) }
                                        val destinationEmail = if (listName.isBlank()) "" else plannedList?.optString("accountEmail")?.takeIf(String::isNotBlank)
                                            ?: existingList?.accountEmail?.takeIf(String::isNotBlank)
                                            ?: accounts.firstOrNull { it.id == existingList?.accountId }?.email
                                            ?: accounts.singleOrNull { it.tasksConnected }?.email.orEmpty()
                                        val details = listOf(row.optString("project"), row.optString("parentProject"), row.optString("category"), row.optString("taskList"), row.optString("accountEmail"),
                                            destinationEmail, row.optString("startDate"), row.optString("dueDate"), row.optString("time")).filter(String::isNotBlank).distinct()
                                        if (details.isNotEmpty()) Text(details.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        row.optString("description").takeIf(String::isNotBlank)?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                                        if (field == "tasks") Text(genesisTranslate("Приоритет") + ": ${row.getInt("priority")}/10 · " + genesisTranslate("Напоминание") + ": ${row.getInt("reminderMinutes")} " + genesisTranslate("мин"), style = MaterialTheme.typography.bodySmall)
                                        row.optJSONArray("tags")?.takeIf { it.length() > 0 }?.let { tags -> Text((0 until tags.length()).joinToString(" ") { "#${tags.getString(it)}" }, style = MaterialTheme.typography.bodySmall) }
                                    }
                                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                                }
                            }
                        }
                        Text(genesisTranslate("Создано") + ": ${saved.getInt("projectsDone")} / ${saved.getInt("listsDone")} / ${saved.getInt("tasksDone")}", style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { confirmingDiscard = true }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text("Отменить оставшуюся часть плана") }
                    }
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("server-assistant-error")) }
                    if (error != null && journal == null && !storageBlocked) OutlinedButton(onClick = { scope.launch {
                        busy = true; error = null
                        try { status = gateway.status() }
                        catch (failure: CancellationException) { throw failure }
                        catch (failure: Exception) { fail(failure) }
                        finally { busy = false }
                    } }, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) { Text("Повторить") }
                }
                journal?.let { saved ->
                    Button(onClick = { scope.launch {
                        busy = true; error = null
                        try { repository.apply(saved, accounts, mode) { journal = it }; journal = null; onSaved() }
                        catch (failure: CancellationException) { throw failure }
                        catch (failure: Exception) { fail(failure) }
                        finally { busy = false }
                    } }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("server-assistant-apply")) {
                        Text(if (busy) "Сохранение…" else "Создать по плану")
                    }
                }
            }
        }
    }
    if (confirmingClose) AlertDialog(onDismissRequest = { confirmingClose = false }, title = { Text("Удалить несохранённую команду?") },
        text = { Text("Текст и запись ещё не отправлены. После закрытия они будут удалены.") },
        confirmButton = { TextButton(onClick = { confirmingClose = false; onDismiss() }) { Text("Удалить") } },
        dismissButton = { TextButton(onClick = { confirmingClose = false }) { Text("Продолжить") } })
    if (confirmingDiscard) AlertDialog(onDismissRequest = { confirmingDiscard = false }, title = { Text("Отменить оставшуюся часть плана?") },
        text = { Text("Уже созданные проекты, списки и задачи сохранятся. Оставшиеся действия выполняться не будут.") },
        confirmButton = { TextButton(onClick = { scope.launch {
            busy = true
            try { repository.discard(requireNotNull(journal).getString("id")); journal = null; confirmingDiscard = false }
            catch (failure: CancellationException) { throw failure }
            catch (failure: Exception) { confirmingDiscard = false; fail(failure) }
            finally { busy = false }
        } }, enabled = !busy) { Text("Отменить план") } },
        dismissButton = { TextButton(onClick = { confirmingDiscard = false }) { Text("Продолжить") } })
}
