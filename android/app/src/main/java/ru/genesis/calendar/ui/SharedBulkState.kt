package ru.genesis.calendar.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.CancellationException
import org.json.JSONArray
import org.json.JSONObject
import ru.genesis.calendar.auth.*
import java.time.Instant

/** Only current online responses may supply task titles, reports, permissions or choices. */
internal class SharedBulkState(private val gateway: SharedWorkspaceGateway, val projectId: String, val filter: JSONObject, val sort: String,
    savedForm: String, savedOperation: String, private val onForm: (String) -> Unit, private val onOperation: (String) -> Unit,
    private val onLost: () -> Unit, private val onChanged: () -> Unit) {
    var form by mutableStateOf(runCatching { SharedBulkForm.restore(savedForm) }.getOrElse { SharedBulkForm.initial() }); private set
    var inputInvalid by mutableStateOf(runCatching { SharedBulkForm.restore(savedForm) }.isFailure); private set
    var record by mutableStateOf<JSONObject?>(null); private set
    var project by mutableStateOf<JSONObject?>(null); private set
    var tasks by mutableStateOf<JSONObject?>(null); private set
    var operationId by mutableStateOf(savedOperation.takeIf { runCatching { SharedBulkProtocol.operation(it) }.isSuccess }.orEmpty()); private set
    var report by mutableStateOf<JSONObject?>(null); private set
    var history by mutableStateOf<JSONObject?>(null); private set
    var after by mutableStateOf(0L); private set
    var previousPages by mutableStateOf(emptyList<Long>()); private set
    var pane by mutableStateOf(if (operationId.isEmpty()) "choose" else "operation"); private set
    var busy by mutableStateOf(false); private set
    var loaded by mutableStateOf(false); private set
    var error by mutableStateOf(""); private set
    var online by mutableStateOf(true); private set
    var optionEpoch by mutableStateOf(0); private set
    private var closed = false
    private var epoch = 0
    val phase get() = record?.optString("phase").orEmpty()
    val canEdit get() = project?.let { sharedTaskCanEdit(it) && it.optString("archivedAt").let { value -> value.isBlank() || value == "null" } } == true
    val editable get() = loaded && !inputInvalid && phase !in setOf("pending", "received", "rejected")
    val selectionReady get() = form.all && form.text("queryVersion").isNotBlank() || !form.all && form.selectionCount > 0
    val ready get() = editable && canEdit && selectionReady && runCatching { form.edit(projectId, filter, sort) }.isSuccess
    val expired get() = report?.takeIf { it.optString("state") == "preview" }?.let { Instant.parse(it.getString("expiresAt")) <= Instant.now() } == true
    private fun current(ticket: Int) { if (closed || ticket != epoch) throw CancellationException() }
    private fun clearLive() { project = null; tasks = null; report = null; history = null; optionEpoch++ }
    fun close() { closed = true; epoch++; clearLive(); busy = false }
    fun pause() { epoch++; clearLive(); busy = false; online = false }
    fun change(next: SharedBulkForm) { if (editable && !busy) { form = next; onForm(next.saved()); error = "" } }
    fun resetInvalid() { if (!busy) { inputInvalid = false; form = SharedBulkForm.initial(); onForm(form.saved()); error = "" } }
    private fun failure(failure: Exception) = when (failure) {
        is AuthApiError -> failure.code; is CustomFieldFailure -> failure.code; is WorkflowFailure -> failure.code
        is AuthFailure -> sharedFailureCode(failure)
        else -> failure.message?.takeIf { it.matches(Regex("[A-Z][A-Z0-9_]{0,99}")) } ?: "BULK_PROTOCOL"
    }
    private suspend fun work(action: suspend (Int) -> Unit) {
        if (closed || busy) return
        val ticket = epoch; busy = true; error = ""
        try { action(ticket); current(ticket); online = true }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (cause: Exception) {
            current(ticket); error = failure(cause)
            if (workflowAccessLost(cause)) { clearLive(); online = false; onLost() }
            else if (cause is AuthFailure && cause.kind in setOf(AuthFailure.Kind.NETWORK, AuthFailure.Kind.SERVER, AuthFailure.Kind.PROTOCOL) ||
                error in setOf("BULK_ONLINE_REQUIRED", "BULK_PROTOCOL", "PROTOCOL")) { clearLive(); online = false }
            else if (error == "SHARED_QUERY_CHANGED") tasks = null
            // A command may have become durable before the transport or receipt failed.
            try { val pending = gateway.sharedBulkDraft(projectId); current(ticket); record = pending }
            catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { /* Keep the last known stamp; no new command is created. */ }
        } finally { if (!closed && ticket == epoch) busy = false }
    }
    private suspend fun readProject(ticket: Int) {
        val snapshot = gateway.sharedProject(projectId); current(ticket)
        require(!snapshot.optBoolean("offlineCache")) { "BULK_ONLINE_REQUIRED" }
        val fresh = snapshot.getJSONObject("project"); require(fresh.getString("id") == projectId) { "BULK_SCOPE_CHANGED" }; project = fresh
    }
    private fun page(raw: JSONObject): JSONObject {
        require(!raw.optBoolean("offlineCache")) { "BULK_ONLINE_REQUIRED" }
        val rows = importRows(raw.getJSONArray("tasks")); require(rows.size <= 100 && rows.all { it.optString("projectId") == projectId }) { "BULK_PROTOCOL" }
        rows.forEach(SharedBulkProtocol::reference)
        require(raw.opt("total") is Int && raw.getInt("total") >= rows.size && raw.opt("hasMore") is Boolean && raw.opt("queryVersion") is String && raw.getString("queryVersion").isNotBlank()) { "BULK_PROTOCOL" }
        if (raw.getBoolean("hasMore")) SharedBulkProtocol.cursor(raw.getString("nextCursor"))
        return JSONObject(raw.toString())
    }
    private suspend fun readTasks(ticket: Int) { val fresh = page(gateway.sortedSharedTasks(JSONObject(filter.toString()), sort = sort)); current(ticket); tasks = fresh }
    private suspend fun readReport(ticket: Int) {
        val target = operationId; val cursor = after; report = null
        val fresh = SharedBulkProtocol.report(gateway.sharedBulkReport(target, cursor), target, cursor); current(ticket); report = fresh
    }
    suspend fun load() = work { ticket ->
        clearLive(); val saved = gateway.sharedBulkDraft(projectId); current(ticket); record = saved; loaded = true
        if (saved != null && phase in setOf("pending", "received", "rejected")) {
            form = SharedBulkForm.fromEdit(saved.getJSONObject("edit")); onForm(form.saved()); inputInvalid = false
        }
        if (phase == "received" && operationId.isEmpty()) { operationId = saved!!.getJSONObject("receipt").getString("operationId"); onOperation(operationId); pane = "operation" }
        readProject(ticket)
        when (pane) { "operation" -> if (operationId.isNotBlank()) readReport(ticket); "history" -> readHistory(ticket, null); else -> readTasks(ticket) }
    }
    suspend fun refresh() = if (!loaded) load() else work { ticket ->
        clearLive(); readProject(ticket)
        when (pane) { "operation" -> readReport(ticket); "history" -> readHistory(ticket, null); else -> readTasks(ticket) }
    }
    suspend fun moreTasks() = work { ticket ->
        val previous = requireNotNull(tasks); require(previous.getBoolean("hasMore"))
        require(previous.getJSONArray("tasks").length() < 1000) { "BULK_SELECTION_LIMIT" }
        val next = page(gateway.sortedSharedTasks(JSONObject(filter.toString()), previous.getString("nextCursor"), sort)); current(ticket)
        require(next.getString("queryVersion") == previous.getString("queryVersion")) { "SHARED_QUERY_CHANGED" }
        tasks = JSONObject(next.toString()).put("tasks", JSONArray(importRows(previous.getJSONArray("tasks")) + importRows(next.getJSONArray("tasks"))))
    }
    fun selectAll() {
        val current = tasks ?: return
        change(form.change("all", true).change("items", JSONArray()).change("queryVersion", current.getString("queryVersion")))
    }
    fun configure() { if (editable && selectionReady && !busy) pane = "configure" }
    fun choose() { if (editable && !busy) pane = "choose" }
    suspend fun preview() = work { ticket ->
        require(ready) { "BULK_INVALID" }; val edit = form.edit(projectId, filter, sort)
        var saved = gateway.saveSharedBulkDraft(projectId, record?.getString("stamp"), edit); current(ticket); record = saved
        saved = gateway.prepareSharedBulkDraft(projectId, saved.getString("stamp")); current(ticket); record = saved
        send(ticket)
    }
    private suspend fun send(ticket: Int) {
        val received = gateway.sendSharedBulkDraft(projectId, requireNotNull(record).getString("stamp")); current(ticket); record = received
        require(received.getString("phase") == "received") { "BULK_RECEIPT_INVALID" }
        operationId = SharedBulkProtocol.operation(received.getJSONObject("receipt").getString("operationId")); after = 0; previousPages = emptyList()
        onOperation(operationId); pane = "operation"; readReport(ticket)
    }
    suspend fun retry() = work { ticket -> require(phase == "pending"); send(ticket) }
    suspend fun command(command: String) = work { ticket ->
        require(command in SharedBulkProtocol.commands && operationId.isNotBlank()) { "BULK_INVALID" }
        val old = requireNotNull(report); require(old.getString("id") == operationId)
        if (command == "confirm") {
            require(old.getString("state") == "preview" && !expired && online && canEdit) { "BULK_PREVIEW_EXPIRED" }
            require(!old.getJSONObject("actionInfo").getBoolean("unavailable")) { "BULK_NOT_ALLOWED" }
        }
        val target = operationId; val cursor = after; report = null
        val fresh = SharedBulkProtocol.report(gateway.sharedBulkCommand(target, command, cursor), target, cursor); current(ticket)
        report = fresh; if (command != "confirm") onChanged()
    }
    suspend fun poll() {
        if (closed || busy || pane != "operation" || !online || operationId.isBlank()) return
        val current = report ?: return
        if (current.getString("state") == "running" && (current.isNull("retryAt") || Instant.parse(current.getString("retryAt")) <= Instant.now())) command("advance")
        else work { ticket -> readReport(ticket) }
    }
    suspend fun reportPage(next: Boolean) = work { ticket ->
        if (next) { val fresh = requireNotNull(report); require(fresh.getBoolean("hasMore")); previousPages = previousPages + after; after = fresh.getLong("nextCursor") }
        else { require(previousPages.isNotEmpty()); after = previousPages.last(); previousPages = previousPages.dropLast(1) }
        readReport(ticket)
    }
    private suspend fun readHistory(ticket: Int, cursor: String?) {
        history = null; val fresh = SharedBulkProtocol.history(gateway.sharedBulkHistory(cursor)); current(ticket); history = fresh
    }
    suspend fun showHistory(cursor: String? = null) = work { ticket -> pane = "history"; report = null; tasks = null; readHistory(ticket, cursor) }
    suspend fun openOperation(id: String) = work { ticket ->
        operationId = SharedBulkProtocol.operation(id); onOperation(operationId); after = 0; previousPages = emptyList(); pane = "operation"; history = null; readProject(ticket); readReport(ticket)
    }
    suspend fun recoverPending() = work { ticket ->
        val pending = gateway.sharedBulkDraft(projectId); current(ticket); record = pending
        require(pending != null) { "BULK_RESELECT_REQUIRED" }
        if (pending.getString("phase") == "received") {
            operationId = pending.getJSONObject("receipt").getString("operationId"); onOperation(operationId); pane = "operation"; after = 0; previousPages = emptyList(); readReport(ticket)
        } else { pane = "configure"; form = SharedBulkForm.fromEdit(pending.getJSONObject("edit")); onForm(form.saved()) }
    }
    suspend fun newOperation() = work { ticket ->
        val saved = record
        if (saved?.getString("phase") == "pending" && saved.getInt("attempts") > 0) error("PLANNING_DRAFT_PENDING")
        if (saved != null) { gateway.removeSharedBulkDraft(projectId, saved.getString("stamp")); current(ticket) }
        record = null; operationId = ""; onOperation(""); after = 0; previousPages = emptyList(); report = null; history = null
        form = SharedBulkForm.initial(); onForm(form.saved()); inputInvalid = false; pane = "choose"; readProject(ticket); readTasks(ticket)
    }
}
