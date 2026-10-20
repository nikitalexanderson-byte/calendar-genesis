package ru.genesis.calendar.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import ru.genesis.calendar.auth.AuthApiError
import ru.genesis.calendar.auth.AuthFailure
import ru.genesis.calendar.auth.SharedTemplateManifest
import ru.genesis.calendar.auth.SharedTemplateProtocol
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import java.util.UUID

/** One selected project owns one durable template editor; server catalogs and previews remain in memory. */
internal class SharedTemplateState(private val gateway: SharedWorkspaceGateway, private val account: String,
    val space: String, val project: String, val language: String) {
    var library by mutableStateOf<JSONObject?>(null); private set
    var source by mutableStateOf<JSONObject?>(null); private set
    var preview by mutableStateOf<JSONObject?>(null); private set
    var record by mutableStateOf<JSONObject?>(null); private set
    var edit by mutableStateOf<JSONObject?>(null); private set
    var copies by mutableStateOf(emptyList<JSONObject>()); private set
    var deleted by mutableStateOf(false); private set
    var loaded by mutableStateOf(false); private set
    var busy by mutableStateOf(false); private set
    var dirty by mutableStateOf(false); private set
    var conflicted by mutableStateOf(false); private set
    var lost by mutableStateOf(false); private set
    var error by mutableStateOf(""); private set
    var inputVersion by mutableStateOf(0); private set
    @Volatile private var active = true
    private val mutex = Mutex()
    val phase get() = record?.optString("phase") ?: "editing"
    val editable get() = loaded && !busy && !lost && !conflicted && edit != null && phase == "editing"
    val receipt get() = record?.optJSONObject("receipt")
    val previewCurrent get() = preview != null && edit?.opt("review") == preview?.opt("fingerprint") && !dirty
    val hasMore get() = library?.optBoolean("hasMore") == true
    private fun copy(value: JSONObject) = JSONObject(value.toString())
    private fun current() { if (!active) throw CancellationException() }
    fun close() { active = false; source = null; preview = null; library = null; edit = null; record = null; copies = emptyList() }
    private suspend fun <T> checked(block: suspend () -> T): T {
        currentCoroutineContext().ensureActive(); current()
        return block().also { currentCoroutineContext().ensureActive(); current() }
    }
    private fun accept(value: JSONObject?) {
        record = value?.let(::copy); edit = value?.getJSONObject("edit")?.let(::copy)
        dirty = false; conflicted = false; preview = null; inputVersion++
    }
    private fun code(failure: Exception) = when (failure) {
        is AuthApiError -> failure.code
        is AuthFailure -> failure.kind.name
        else -> failure.message?.takeIf { it.matches(Regex("[A-Z][A-Z0-9_]{0,99}")) } ?: "PROTOCOL"
    }
    private suspend fun operate(quiet: Boolean = false, block: suspend () -> Unit) = mutex.withLock {
        current(); if (!quiet) busy = true; error = ""
        try { block() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            current(); error = code(failure)
            if (error in setOf("UNAUTHORIZED", "SHARED_PROJECT_FORBIDDEN", "SHARED_SPACE_FORBIDDEN", "TEMPLATE_FORBIDDEN", "TEMPLATE_PERMISSION_CHANGED", "TEMPLATE_UNAVAILABLE", "TEMPLATE_SOURCE_UNAVAILABLE", "TEMPLATE_SOURCE_SCOPE_UNAVAILABLE")) {
                source = null; preview = null; library = null; edit = null; record = null; copies = emptyList(); lost = true
            } else {
                if (error == "PLANNING_DRAFT_CHANGED") conflicted = true
                try {
                    val latest = checked { gateway.sharedTemplateDraft(project) }
                    if (latest != null && latest.optString("phase") != "editing") accept(latest)
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { /* Own input remains visible when local storage cannot be read. */ }
            }
        } finally { if (active && !quiet) busy = false }
    }
    suspend fun load() = operate {
        require(account.isNotBlank()) { "UNAUTHORIZED" }
        SharedTemplateProtocol.id(space); SharedTemplateProtocol.id(project); SharedTemplateProtocol.language(language)
        accept(checked { gateway.sharedTemplateDraft(project) }); copies = checked { gateway.sharedTemplateCopies(project) }; loaded = true
        library = SharedTemplateProtocol.library(space, checked { gateway.sharedTemplates(space, language, deleted, null) })
    }
    suspend fun loadLibrary(archive: Boolean = deleted, more: Boolean = false) = operate {
        require(!lost) { "TEMPLATE_SOURCE_UNAVAILABLE" }
        val previous = if (more) requireNotNull(library) else null
        val cursor = previous?.getString("nextCursor")
        val result = checked { gateway.sharedTemplates(space, language, archive, cursor) }
        library = SharedTemplateProtocol.library(space, result, previous, cursor); deleted = archive
    }
    suspend fun open(id: String) = operate {
        require(edit == null && record == null) { "TEMPLATE_OWN_DRAFT" }
        source = null; preview = null
        source = SharedTemplateProtocol.source(space, id, checked { gateway.sharedTemplate(space, id, language, deleted) })
    }
    suspend fun start(value: JSONObject) = operate {
        require(loaded && !lost && record == null && edit == null) { "TEMPLATE_OWN_DRAFT" }
        val initial = SharedTemplateProtocol.edit(value)
        require(initial.getString("spaceId") == space && initial.getString("projectId") == project) { "TEMPLATE_SCOPE_CHANGED" }
        edit = copy(initial); dirty = true; inputVersion++; persist()
    }
    fun change(value: JSONObject) {
        if (!editable) return
        val next = SharedTemplateProtocol.edit(value)
        require(next.getString("spaceId") == space && next.getString("projectId") == project) { "TEMPLATE_SCOPE_CHANGED" }
        edit = copy(next).put("review", JSONObject.NULL); dirty = true; preview = null; inputVersion++; error = ""
    }
    fun changeTitle(value: String) {
        val next = edit?.let(::copy) ?: return
        next.getJSONObject("request").put("title", if (next.getString("kind") == "template-apply" && value.isBlank()) JSONObject.NULL else value); change(next)
    }
    fun changeManifest(value: JSONObject) {
        val next = edit?.let(::copy) ?: return
        require(next.getString("kind") == "template-save")
        next.getJSONObject("request").put("manifest", SharedTemplateManifest.validate(value, complete = false)); change(next)
    }
    fun changeEstimate(task: String, field: String, value: String) {
        require(field in setOf("storyPoints", "estimateHours"))
        changeInput("estimate/${SharedTemplateManifest.key(task)}/$field", value)
    }
    fun changeInput(path: String, value: String) {
        if (!editable) return
        val next = edit?.let(::copy) ?: return
        next.getJSONObject("inputs").put(path, value); change(next)
    }
    private suspend fun persist() {
        if (!dirty) return
        require(!lost && !conflicted && phase == "editing") { "PLANNING_DRAFT_PENDING" }
        val version = inputVersion; val snapshot = copy(requireNotNull(edit))
        val saved = checked { gateway.saveSharedTemplateDraft(project, record?.getString("stamp"), snapshot) }
        record = copy(saved)
        if (version == inputVersion) { edit = copy(saved.getJSONObject("edit")); dirty = false }
    }
    suspend fun save() = operate(quiet = true) { persist() }
    suspend fun review() = operate {
        require(!lost && !conflicted && phase == "editing") { "PLANNING_DRAFT_PENDING" }; persist()
        val value = requireNotNull(edit); require(value.getString("kind") == "template-apply")
        val result = SharedTemplateProtocol.preview(space, value.getString("templateId"), value.getJSONObject("request"),
            checked { gateway.previewSharedTemplate(space, value.getString("templateId"), value.getJSONObject("request")) })
        edit = copy(value).put("review", result.getString("fingerprint")); dirty = true; inputVersion++; persist(); preview = result
    }
    suspend fun prepare() = operate {
        require(!lost && !conflicted && phase == "editing") { "PLANNING_DRAFT_PENDING" }; persist()
        if (edit?.optString("kind") == "template-apply") require(previewCurrent && preview?.optBoolean("canApply") == true) { "TEMPLATE_REVIEW_REQUIRED" }
        val reviewed = preview?.let(::copy)
        val ready = checked { gateway.prepareSharedTemplateDraft(project, requireNotNull(record).getString("stamp")) }; accept(ready); preview = reviewed
    }
    suspend fun send() = operate {
        require(!lost && !dirty && !conflicted && phase in setOf("pending", "received")) { "PLANNING_DRAFT_PENDING" }
        accept(checked { gateway.sendSharedTemplateDraft(project, requireNotNull(record).getString("stamp")) })
    }
    suspend fun discard() = operate {
        val value = record
        if (value != null) checked { gateway.removeSharedTemplateDraft(project, value.getString("stamp")) }
        accept(null); source = null
    }
    suspend fun saveOwnCopy() = operate {
        val value = requireNotNull(edit); require(!lost)
        checked { gateway.saveSharedTemplateCopy(project, UUID.randomUUID().toString(), null, value) }
        copies = checked { gateway.sharedTemplateCopies(project) }
        if (conflicted) dirty = false // Own input is now durable in a named copy; choosing a version remains explicit.
    }
    suspend fun useCopy(id: String) = operate {
        require(!dirty && !lost) { "TEMPLATE_OWN_DRAFT" }
        val selected = copies.single { it.getString("id") == id }
        val latest = checked { gateway.sharedTemplateDraft(project) }
        accept(checked { gateway.useSharedTemplateCopy(project, id, selected.getString("stamp"), latest?.getString("stamp")) })
        copies = checked { gateway.sharedTemplateCopies(project) }; source = null
    }
    suspend fun removeCopy(id: String) = operate {
        val selected = copies.single { it.getString("id") == id }
        checked { gateway.removeSharedTemplateCopy(project, id, selected.getString("stamp")) }; copies = checked { gateway.sharedTemplateCopies(project) }
    }
}
