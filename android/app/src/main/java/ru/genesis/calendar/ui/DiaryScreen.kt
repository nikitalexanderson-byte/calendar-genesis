package ru.genesis.calendar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.Text as ContentText
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.ui.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import ru.genesis.calendar.data.DiaryConflict
import ru.genesis.calendar.data.DiaryNote
import ru.genesis.calendar.data.DiaryRecord
import ru.genesis.calendar.data.DiaryRepository
import java.time.Instant

@Composable internal fun DiaryScreen(repository: DiaryRepository, onClose: () -> Unit) {
    val state by repository.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableStateOf("board") }
    var query by rememberSaveable { mutableStateOf("") }
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    var newEditor by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    var more by remember { mutableStateOf(false) }
    var discard by remember { mutableStateOf<DiaryRecord?>(null) }
    var deleteNote by remember { mutableStateOf<DiaryRecord?>(null) }
    var settingsOpen by remember { mutableStateOf(false) }
    fun refresh() { scope.launch {
        loading = true; error = false
        try { repository.loadCached(); repository.refresh() }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { error = true }
        finally { loading = false }
    } }
    LaunchedEffect(repository) {
        try { repository.loadCached(); repository.refresh() }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { error = true }
        finally { loading = false }
    }
    fun change(row: DiaryRecord, note: DiaryNote) { scope.launch {
        if (busy) return@launch
        busy = true; error = false
        try { repository.save(note, row.revision) }
        catch (cancel: CancellationException) { throw cancel }
        catch (_: Exception) { error = true }
        finally { busy = false }
    } }
    BackHandler(!newEditor && editing == null) { if (tab != "board") tab = "board" else onClose() }
    val notes = remember(state.records, query, tab) {
        state.records.filter { !it.draft && (if (tab == "archive") it.note.archived else !it.note.archived &&
            (tab != "favorites" || it.note.reaction == "favorite")) &&
            (query.isBlank() || (it.note.title + "\n" + it.note.body).contains(query, ignoreCase = true)) }
            .sortedWith(compareByDescending<DiaryRecord> { it.note.pinned }.thenByDescending { it.note.updatedAt })
    }
    val drafts = state.records.filter { it.draft }
    val headerActions: @Composable () -> Unit = {
            WorkspaceHeaderButton(genesisTranslate("Новая запись"), "diary-create",
                enabled = state.ready && !state.protected && !busy, onClick = { editing = null; newEditor = true }) { GenesisLucideIcon("plus") }
            Box {
                WorkspaceHeaderButton(genesisTranslate("Действия дневника"), "diary-actions", onClick = { more = true }) { GenesisLucideIcon("ellipsis") }
                DropdownMenu(more, { more = false }) {
                    DropdownMenuItem(text = { Text(diaryText("settings")) }, leadingIcon = { GenesisLucideIcon("settings") },
                        modifier = Modifier.testTag("diary-settings-open"), onClick = { more = false; settingsOpen = true })
                    DropdownMenuItem(text = { Text("Избранное") }, leadingIcon = { GenesisLucideIcon("star") },
                        modifier = Modifier.testTag("diary-favorites-open"),
                        onClick = { tab = "favorites"; more = false })
                    DropdownMenuItem(text = { Text("Архив") }, leadingIcon = { GenesisLucideIcon("archive") },
                        onClick = { tab = "archive"; more = false })
                    DropdownMenuItem(text = { Text("Обновить") }, leadingIcon = { GenesisLucideIcon("refresh-cw") },
                        onClick = { more = false; refresh() }, enabled = !loading && !busy)
                }
            }
    }
    val headerInShell = WorkspaceScreenHeader("Дневник",
        when (tab) { "favorites" -> "Избранное"; "archive" -> "Архив"; else -> null }, actions = headerActions)
    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().testTag("diary-screen")) {
        if (!headerInShell) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            AffairsIconButton("Назад", AffairsAction.BACK, onClose)
            Text("Дневник", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            headerActions()
        }
        if (tab != "board") OutlinedButton(onClick = { tab = "board" }, shape = AffairsLayout.controlShape,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
                .heightIn(min = 48.dp).testTag("diary-back-to-board")) {
            AffairsActionIcon(AffairsAction.BACK, Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Назад в дневник")
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
        if (error || state.protected) Row(Modifier.fillMaxWidth().padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically) {
            Text(if (state.protected) "Формат дневника изменился. Обновите приложение; записи сохранены."
                else "Не удалось обновить дневник. Черновики сохранены на устройстве.", Modifier.weight(1f),
                color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            AffairsIconButton("Повторить", AffairsAction.REFRESH, { refresh() }, enabled = !loading && !busy)
        }
        if (state.offline) Text("Нет сети. Доступна защищённая локальная копия дневника.",
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp).testTag("diary-offline"), style = MaterialTheme.typography.bodySmall)
        if (!state.syncEnabled) Text(diaryText("localOnly"), Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
            .testTag("diary-local-only"), style = MaterialTheme.typography.bodySmall)
        LazyColumn(Modifier.fillMaxSize().testTag("diary-notes"), contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 92.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("Записи и черновики зашифрованы. Архивирование можно отменить.", style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (drafts.isNotEmpty()) item {
                AffairsDisclosure("Черновики · ${drafts.size}") {
                    drafts.forEach { row ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            TextButton(onClick = { editing = row.draftKey ?: "note:${row.note.id}"; newEditor = false }, Modifier.weight(1f).heightIn(min = 48.dp)
                                .testTag("diary-draft-${row.note.id}")) {
                                ContentText(row.note.title.ifBlank { genesisTranslate("Без названия") }, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                            AffairsIconButton("Удалить черновик", AffairsAction.DELETE, { discard = row },
                                Modifier.testTag("diary-discard-${row.note.id}"), enabled = !busy)
                        }
                    }
                }
            }
            if (!loading && state.ready && notes.isEmpty()) item {
                Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        GenesisLucideIcon("book-open", Modifier.size(32.dp), tint = MaterialTheme.colorScheme.secondary)
                        Text(when { query.isNotBlank() -> "Записи не найдены. Измените запрос."; tab == "archive" -> "В архиве пока нет записей."
                            tab == "favorites" -> "Избранных советов пока нет."; else -> "Сохраните мысль или заметку дня." }, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            items(notes, key = { it.note.id }) { row ->
                DiaryNoteCard(row, busy || state.protected, onOpen = { editing = row.draftKey ?: "note:${row.note.id}"; newEditor = false },
                    onPin = { change(row, row.note.changed { put("pinned", !row.note.pinned) }) },
                    onArchive = { change(row, if (row.note.archived) row.note.restored() else row.note.changed { put("archived", true) }) },
                    onDelete = { deleteNote = row },
                    onFavorite = { change(row, row.note.changed { put("reaction", if (row.note.reaction == "favorite") JSONObject.NULL else "favorite"); put("archived", false) }) })
            }
        }
    }
    WorkspaceSearchDock(query, { query = it }, "Поиск записей", "diary-search", Modifier.align(Alignment.BottomCenter))
    }
    discard?.let { row -> AlertDialog(onDismissRequest = { discard = null }, title = { Text("Удалить черновик?") },
        text = { Text("Будет удалён только черновик с этого устройства. Сохранённая запись останется в дневнике.") },
        confirmButton = { TextButton(onClick = { scope.launch {
            try { repository.discardDraft(requireNotNull(row.draftKey)); discard = null }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { error = true }
        } }) { Text("Удалить черновик") } }, dismissButton = { TextButton(onClick = { discard = null }) { Text("Отмена") } }) }
    val editingRecord = state.records.firstOrNull { (it.draftKey ?: "note:${it.note.id}") == editing }
    if (settingsOpen) DiaryPrivacySettings(repository, state) { settingsOpen = false }
    deleteNote?.let { row -> DiaryDeleteConfirmation(repository, row) { deleteNote = null } }
    if (newEditor || editingRecord != null) DiaryEditor(repository, editingRecord, onClose = { newEditor = false; editing = null })
}

@Composable private fun DiaryNoteCard(record: DiaryRecord, busy: Boolean, onOpen: () -> Unit,
    onPin: () -> Unit, onArchive: () -> Unit, onDelete: () -> Unit, onFavorite: () -> Unit) {
    val note = record.note
    val accent = note.customColor?.let { Color(android.graphics.Color.parseColor(it)) } ?: diaryPresetColor(note.color)
    Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth().testTag("diary-note-${note.id}")) {
        Column {
            Box(Modifier.fillMaxWidth().height(4.dp).background(accent))
            TextButton(onClick = onOpen, modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp).testTag("diary-open-${note.id}")) {
                Column(Modifier.fillMaxWidth().padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ContentText(note.title.ifBlank { genesisTranslate("Без названия") }, style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface)
                    ContentText(note.body, maxLines = 6, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                ContentText(note.createdAt.take(10), Modifier.weight(1f), style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (note.adviceId != null) {
                    val favoriteLabel = genesisTranslate(if (note.reaction == "favorite") "Убрать из избранного" else "В избранное")
                    IconButton(onFavorite, Modifier.size(48.dp).semantics { contentDescription = favoriteLabel }
                        .testTag("diary-favorite-${note.id}"), enabled = !busy) {
                        GenesisLucideIcon("star", tint = if (note.reaction == "favorite") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            filled = note.reaction == "favorite")
                    }
                }
                val pinLabel = genesisTranslate(if (note.pinned) "Открепить запись" else "Закрепить запись")
                IconButton(onPin, Modifier.size(48.dp).semantics { contentDescription = pinLabel }.testTag("diary-pin-${note.id}"), enabled = !busy) {
                    GenesisLucideIcon("pin", tint = if (note.pinned) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
                AffairsIconButton(if (note.archived) "Восстановить запись" else "В архив", if (note.archived) AffairsAction.RESTORE else AffairsAction.ARCHIVE,
                    onArchive, Modifier.testTag("diary-archive-${note.id}"), enabled = !busy, outlined = false)
                AffairsIconButton(diaryText("deleteNote"), AffairsAction.DELETE, onDelete,
                    Modifier.testTag("diary-delete-${note.id}"), enabled = !busy, outlined = false,
                    contentColor = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun DiaryEditor(repository: DiaryRepository, record: DiaryRecord?, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    val key = record?.draftKey ?: record?.note?.id ?: "new"
    val encryptedSaver = remember(repository) { Saver<String, String>(
        save = { repository.sealEditorState(it) }, restore = { repository.openEditorState(it) }) }
    var formJson by rememberSaveable(key, stateSaver = encryptedSaver) { mutableStateOf(JSONObject()
        .put("note", record?.note?.json() ?: DiaryNote.newDraftJson())
        .put("baseline", JSONObject().put("title", record?.note?.title ?: "").put("body", record?.note?.body ?: "").put("color", record?.note?.color ?: "sage")
            .put("customColor", record?.note?.customColor ?: ""))
        .put("revision", record?.revision ?: 0).toString()) }
    val form = JSONObject(formJson).getJSONObject("note")
    val baseline = JSONObject(formJson).getJSONObject("baseline")
    var draftKey by rememberSaveable(key) { mutableStateOf(record?.draftKey) }
    val revision = JSONObject(formJson).getLong("revision")
    var saving by remember { mutableStateOf(false) }
    var closeConfirm by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    var conflict by remember { mutableStateOf(false) }
    var draftSaved by remember { mutableStateOf(record?.draft == true) }
    var paletteOpen by rememberSaveable(key) { mutableStateOf(false) }
    val customColor = (form.opt("customColor") as? String)
    val changed = listOf("title", "body", "color", "customColor").any { form.optString(it, "") != baseline.optString(it, "") }
    val valid = form.optString("body").isNotBlank()
    fun note(): DiaryNote = DiaryNote.parse(JSONObject(formJson).getJSONObject("note").put("updatedAt", Instant.now().toString()))
    fun update(field: String, value: String) { formJson = JSONObject(formJson).apply { getJSONObject("note").put(field, value) }.toString(); draftSaved = false; error = false }
    fun requestClose() { if (saving) return; if (changed) closeConfirm = true else onClose() }
    suspend fun keep(): Boolean = try {
        if (valid && changed) { val draft = repository.keepDraft(note(), revision, draftKey); draftKey = draft.draftKey; draftSaved = true; error = false }
        true
    } catch (cancel: CancellationException) { throw cancel }
    catch (_: Exception) { error = true; false }
    LaunchedEffect(formJson, saving) {
        if (!changed || !valid || saving) return@LaunchedEffect
        delay(650)
        if (!saving) keep()
    }
    Dialog(onDismissRequest = ::requestClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BoxWithConstraints(Modifier.fillMaxWidth().safeDrawingPadding().imePadding().padding(12.dp), contentAlignment = Alignment.Center) {
            Surface(Modifier.widthIn(max = 720.dp).fillMaxWidth().heightIn(max = maxHeight).testTag("diary-editor"),
                shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surface) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (record == null) "Новая запись" else "Редактирование записи", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                        AffairsIconButton("Закрыть", AffairsAction.CLOSE, ::requestClose, enabled = !saving)
                    }
                    Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(form.getString("title"), { update("title", it.take(200)) }, Modifier.fillMaxWidth().testTag("diary-title"),
                            label = { Text("Заголовок") }, singleLine = false, maxLines = 2, enabled = !saving, shape = RoundedCornerShape(10.dp))
                        OutlinedTextField(form.getString("body"), { update("body", it.take(30_000)) }, Modifier.fillMaxWidth().heightIn(min = 180.dp).testTag("diary-body"),
                            label = { Text("Текст записи") }, minLines = 6, maxLines = 12, enabled = !saving, shape = RoundedCornerShape(10.dp))
                        DiaryColorOptions(form.getString("color"), customColor, !saving, onPreset = { color ->
                            update("color", color)
                            formJson = JSONObject(formJson).apply { getJSONObject("note").remove("customColor") }.toString()
                        }, onCustom = { paletteOpen = true })
                        form.optJSONObject("advice")?.let { advice ->
                            AffairsDisclosure("Исходный совет и источники") {
                                ContentText(advice.getString("body"), style = MaterialTheme.typography.bodySmall)
                                val sources = advice.getJSONArray("sources")
                                for (i in 0 until sources.length()) { val source = sources.getJSONObject(i)
                                    ContentText(listOf("author", "work", "reference").mapNotNull { source.optString(it).takeIf { text -> text.isNotBlank() && text != "null" } }
                                        .joinToString(" · "), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        if (conflict || error) Text(if (conflict) "Запись изменена на другом устройстве. Сохраните свою версию как копию."
                            else "Не удалось сохранить запись. Введённые данные остаются в форме.", color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall, modifier = Modifier.testTag("diary-editor-error"))
                        else if (draftSaved) Text("Защищённый черновик сохранён", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.testTag("diary-draft-saved"))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { scope.launch {
                            saving = true; error = false
                            try {
                                if (conflict) repository.saveCopy(note(), draftKey) else repository.save(note(), revision, draftKey)
                                onClose()
                            } catch (cancel: CancellationException) { throw cancel }
                            catch (_: DiaryConflict) { conflict = true; draftKey = repository.state.value.records.firstOrNull { it.draft && it.note.id == form.getString("id") }?.draftKey }
                            catch (failure: Exception) {
                                if (failure.message in setOf("DIARY_NOTE_DELETED", "DIARY_LOCAL_UPLOAD_PENDING")) conflict = true else error = true
                            }
                            finally { saving = false }
                        } }, enabled = valid && !saving, modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("diary-save"), shape = RoundedCornerShape(10.dp)) {
                            Text(if (conflict) "Сохранить копию" else "Сохранить")
                        }
                        TextButton(::requestClose, enabled = !saving, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Отмена") }
                    }
                }
            }
        }
    }
    if (paletteOpen) GenesisColorPicker("Цвет записи", customColor ?: String.format("#%06x", diaryPresetColor(form.getString("color")).let {
        android.graphics.Color.rgb((it.red * 255).toInt(), (it.green * 255).toInt(), (it.blue * 255).toInt()) and 0xffffff
    }), onDismiss = { paletteOpen = false }, onColor = { color ->
        if (color != null) update("customColor", color)
        paletteOpen = false
    }, allowThemeColor = false, previewLabel = "Запись", tagPrefix = "diary")
    if (closeConfirm) AlertDialog(onDismissRequest = { closeConfirm = false }, title = { Text("Сохранить черновик?") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Можно продолжить редактирование позже. Сохранение черновика не изменяет запись на сервере.")
            if (error) Text("Не удалось сохранить запись. Введённые данные остаются в форме.",
                color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("diary-close-error"))
        } },
        confirmButton = { DialogActionRow(
            DialogIconAction("Продолжить редактирование", AffairsAction.EDIT, { closeConfirm = false }, enabled = !saving),
            DialogIconAction("Отменить изменения", AffairsAction.UNDO, { scope.launch {
                try { draftKey?.let { repository.discardDraft(it) }; closeConfirm = false; onClose() }
                catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { error = true }
            } }, enabled = !saving, destructive = true),
            DialogIconAction("Сохранить черновик", AffairsAction.SAVE,
                { scope.launch { if (keep()) { closeConfirm = false; onClose() } } }, enabled = valid && !saving)
        ) })
}
