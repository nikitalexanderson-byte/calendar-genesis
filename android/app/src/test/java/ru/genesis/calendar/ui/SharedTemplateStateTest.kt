package ru.genesis.calendar.ui

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.auth.*
import ru.genesis.calendar.data.UiPreferences
import ru.genesis.calendar.domain.CalendarMode

private class TemplateWorkspaceFixture : SharedWorkspaceGateway {
    val storage = MemoryPlanningStorage()
    val journal = PlanningJournal(storage, contract = SharedTemplateJournalContract)
    var afterSave: (() -> Unit)? = null
    var afterSend: (() -> Unit)? = null
    var loseReply = false
    var sourceUnavailable = false
    var rejection: String? = null
    var sent = 0
    var sourceRevision = 1
    var previewRevision = 1
    var previews = 0
    val commands = mutableListOf<String>()
    private val access = object : SharedTemplateAccess {
        override fun check() = Unit
        override fun project(id: String) = JSONObject().put("id", id).put("spaceId", templateSpace).put("permissions", JSONObject().put("editTasks", true))
        override fun source(space: String, id: String, language: String, deleted: Boolean) = JSONObject().put("id", id).put("canEdit", true).put("revision", 1)
        override fun preview(id: String, request: JSONObject): JSONObject = previewValue(id, request)
        override fun hasTaskQueue() = false
        override fun send(command: JSONObject): JSONObject {
            sent++; commands.add(command.toString())
            rejection?.let { throw AuthApiError(it) }
            if (loseReply) { loseReply = false; throw AuthFailure(AuthFailure.Kind.NETWORK) }
            return JSONObject().put("id", templateId).put("revision", 1).put("deleted", false)
        }
    }
    private fun service() = SharedTemplateDraftService(journal, "account", access)
    private fun previewValue(id: String, request: JSONObject): JSONObject {
        val source = templateStarters().getJSONObject(1); val manifest = source.getJSONObject("manifest")
        previews++
        return JSONObject().put("templateId", id).put("fingerprint", "a".repeat(64)).put("revision", previewRevision).put("canApply", true)
            .put("kind", source.getString("kind")).put("calendarMode", manifest.getString("calendarMode")).put("calendarContext", manifest.getJSONObject("calendarContext"))
            .put("options", SharedTemplateProtocol.options(request)).put("projects", manifest.getJSONArray("projects")).put("tasks", manifest.getJSONArray("tasks"))
            .apply { for (key in listOf("members", "statuses", "categories", "fields", "sourceFields", "newFields", "notices", "blockers")) put(key, JSONArray()) }
    }
    override suspend fun sharedTemplateDraft(project: String) = service().load(project)
    override suspend fun sharedTemplateCopies(project: String) = service().copies(project)
    override suspend fun saveSharedTemplateDraft(project: String, stamp: String?, edit: JSONObject) = service().save(project, stamp, edit).also { afterSave?.invoke() }
    override suspend fun prepareSharedTemplateDraft(project: String, stamp: String) = service().prepare(project, stamp)
    override suspend fun sendSharedTemplateDraft(project: String, stamp: String) = service().send(project, stamp).also { afterSend?.invoke() }
    override suspend fun removeSharedTemplateDraft(project: String, stamp: String) = service().remove(project, stamp)
    override suspend fun saveSharedTemplateCopy(project: String, id: String, stamp: String?, edit: JSONObject) = service().saveCopy(project, id, stamp, edit)
    override suspend fun useSharedTemplateCopy(project: String, id: String, copyStamp: String, stamp: String?) = service().useCopy(project, id, copyStamp, stamp)
    override suspend fun removeSharedTemplateCopy(project: String, id: String, stamp: String) = service().removeCopy(project, id, stamp)
    override suspend fun sharedTemplates(space: String, language: String, deleted: Boolean, cursor: String?) = JSONObject().put("templates", JSONArray())
        .put("systemTemplates", if (deleted) JSONArray() else templateStarters(language)).put("total", 0).put("hasMore", false).put("nextCursor", JSONObject.NULL)
    override suspend fun sharedTemplate(space: String, id: String, language: String, deleted: Boolean): JSONObject {
        if (sourceUnavailable) throw AuthApiError("TEMPLATE_UNAVAILABLE")
        return templateStarters(language).getJSONObject(1).put("revision", sourceRevision)
    }
    override suspend fun previewSharedTemplate(space: String, id: String, request: JSONObject) = previewValue(id, request)
}

class SharedTemplateStateTest {
    private val gateway = TemplateWorkspaceFixture()
    private fun state() = SharedTemplateState(gateway, "account", templateSpace, templateProject, "ru")
    @Test fun typingWhileAQuietSaveCompletesRetainsTheNewerInputAndUsesTheAdvancedStamp() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.changeTitle("First input")
        gateway.afterSave = { state.changeTitle("Newer input") }; state.save(); gateway.afterSave = null
        assertTrue(state.dirty); assertEquals("Newer input", state.edit!!.getJSONObject("request").getString("title"))
        assertEquals("First input", gateway.sharedTemplateDraft(templateProject)!!.getJSONObject("edit").getJSONObject("request").getString("title"))
        state.save(); assertFalse(state.dirty); assertEquals("Newer input", gateway.sharedTemplateDraft(templateProject)!!.getJSONObject("edit").getJSONObject("request").getString("title"))
    }
    @Test fun lostReplyUsesTheAdvancedPendingStampAndCannotCreateANewOperation() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.prepare(); gateway.loseReply = true; state.send()
        assertEquals("pending", state.phase); assertEquals(1, state.record!!.getInt("attempts")); assertEquals("NETWORK", state.error)
        val command = state.record!!.getString("command"); state.send()
        assertEquals("received", state.phase); assertEquals(command, state.record!!.getString("command")); assertEquals(gateway.commands[0], gateway.commands[1])
        state.send(); assertEquals(2, gateway.sent)
    }
    @Test fun staleEditorPreservesItsOwnCopyAndRequiresExplicitVersionSelection() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.changeTitle("Own input")
        val current = gateway.sharedTemplateDraft(templateProject)!!
        gateway.saveSharedTemplateDraft(templateProject, current.getString("stamp"), templateSave().apply { getJSONObject("request").put("title", "Other window") })
        state.save(); assertTrue(state.conflicted); assertTrue(state.dirty)
        assertEquals("Own input", state.edit!!.getJSONObject("request").getString("title"))
        state.saveOwnCopy(); assertFalse(state.dirty); assertTrue(state.conflicted)
        assertEquals("Other window", gateway.sharedTemplateDraft(templateProject)!!.getJSONObject("edit").getJSONObject("request").getString("title"))
        state.useCopy(state.copies.single().getString("id")); assertFalse(state.conflicted)
        assertEquals("Own input", state.edit!!.getJSONObject("request").getString("title"))
        assertTrue(state.copies.any { it.getJSONObject("edit").getJSONObject("request").getString("title") == "Other window" })
    }
    @Test fun anyMappingOrTitleChangeInvalidatesReviewAndBlankOverrideRemainsEditable() = runBlocking {
        val state = state(); state.load()
        state.start(SharedTemplateProtocol.newEdit(templateSpace, templateProject, "template-apply", "system:publication", templateOptions().put("projectId", templateProject)))
        state.review(); assertTrue(state.previewCurrent)
        state.changeTitle(""); assertTrue(state.edit!!.getJSONObject("request").isNull("title")); assertFalse(state.previewCurrent)
        state.prepare(); assertEquals("TEMPLATE_REVIEW_REQUIRED", state.error); assertEquals("editing", state.phase)
    }
    @Test fun revokedSourceAndDisposedScreenClearReadableDataAndIgnoreLateSuccess() = runBlocking {
        val state = state(); state.load(); state.open("system:publication"); assertNotNull(state.source)
        gateway.sourceUnavailable = true; state.open("system:publication")
        assertTrue(state.lost); assertNull(state.source); assertNull(state.library); assertNull(state.edit)
        val fresh = state(); fresh.load(); fresh.start(templateSave()); fresh.prepare(); gateway.afterSend = { fresh.close() }
        try { fresh.send(); fail("Disposed screen accepted a late result") } catch (_: CancellationException) { }
        assertNull(fresh.record); assertNull(fresh.edit); assertNull(fresh.preview)
        assertEquals("received", gateway.sharedTemplateDraft(templateProject)!!.getString("phase"))
    }
    @Test fun revokedReplayClearsTheReadableCommandWhileKeepingItsExactEncryptedJournalIdentity() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.prepare(); gateway.loseReply = true; state.send()
        val command = state.record!!.getString("command"); gateway.rejection = "TEMPLATE_FORBIDDEN"; state.send()
        assertTrue(state.lost); assertNull(state.record); assertNull(state.edit); assertNull(state.preview); assertNull(state.library)
        val protected = gateway.sharedTemplateDraft(templateProject)!!
        assertEquals("pending", protected.getString("phase")); assertEquals(command, protected.getString("command")); assertEquals(2, protected.getInt("attempts"))
    }
    @Test fun anUnusedPreparedCommandCanReturnToEditingWithItsOwnInputProtectedFirst() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.changeTitle("Own prepared title"); state.prepare()
        val oldCommand = state.record!!.getString("command"); assertEquals(0, state.record!!.getInt("attempts"))
        state.resumeEditing(); assertEquals("editing", state.phase); assertEquals("", state.error)
        assertEquals("Own prepared title", state.edit!!.getJSONObject("request").getString("title")); assertTrue(state.copies.isNotEmpty()); assertEquals(0, gateway.sent)
        state.prepare(); assertNotEquals(oldCommand, state.record!!.getString("command"))
    }
    @Test fun deletingAnEditedTaskRemovesOnlyItsInputWhilePreservingTheIndependentInputCalendar() = runBlocking {
        val state = state(); state.load(); state.start(templateSave()); state.changeEstimate("task:child", "storyPoints", "-")
        state.changeEstimate("task:parent", "estimateHours", "2,5")
        state.changeDateInput(SharedCustomCalendar.initial(UiPreferences(input = CalendarMode.LUNAR)))
        state.changeManifest(SharedTemplateEdits.removeTasks(state.edit!!.getJSONObject("request").getJSONObject("manifest"), setOf("task:child")))
        assertFalse(state.edit!!.getJSONObject("inputs").has("estimate/task:child/storyPoints"))
        assertEquals("2,5", state.edit!!.getJSONObject("inputs").getString("estimate/task:parent/estimateHours"))
        assertEquals("lunar", state.edit!!.getJSONObject("dateInput").getString("mode")); assertEquals("sacred", state.edit!!.getJSONObject("request").getJSONObject("manifest").getString("calendarMode"))
        state.save(); val restored = state(); restored.load(); assertEquals("lunar", restored.edit!!.getJSONObject("dateInput").getString("mode"))
    }

    @Test fun inputCalendarDoesNotInvalidateReviewedWireButDestinationDoesAndReopenedApplyFetchesSource() = runBlocking {
        val state = state(); state.load()
        state.start(SharedTemplateProtocol.newEdit(templateSpace, templateProject, "template-apply", "system:publication", templateOptions().put("projectId", templateProject)))
        state.review(); assertTrue(state.previewCurrent); assertNotNull(state.source)
        state.changeDateInput(SharedCustomCalendar.initial(UiPreferences(input = CalendarMode.LUNAR))); state.save()
        assertTrue(state.previewCurrent)
        val edit = JSONObject(state.edit!!.toString()); edit.getJSONObject("request").put("anchorDate", "2026-10-21"); state.change(edit)
        assertNotNull(state.preview); assertFalse(state.previewCurrent)
        edit.getJSONObject("request").put("projectId", "10000000-0000-4000-8000-000000000099"); state.change(edit)
        assertNull(state.preview); state.save()
        val restored = state(); restored.load(); assertNull(restored.source); restored.review(); assertNotNull(restored.source)
        assertTrue(restored.previewCurrent)
    }

    @Test fun aSourceRevisionChangeDuringReviewCannotApproveAStaleManifest() = runBlocking {
        val state = state(); state.load()
        state.start(SharedTemplateProtocol.newEdit(templateSpace, templateProject, "template-apply", "system:publication", templateOptions().put("projectId", templateProject)))
        gateway.sourceRevision = 2; state.review()
        assertEquals("TEMPLATE_PREVIEW_CHANGED", state.error); assertFalse(state.previewCurrent)
        gateway.previewRevision = 2; state.review(); assertTrue(state.previewCurrent)
    }
}
