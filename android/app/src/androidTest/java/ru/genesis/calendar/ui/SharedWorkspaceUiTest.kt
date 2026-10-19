package ru.genesis.calendar.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.text.AnnotatedString
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import java.io.File

private const val spaceFixture = "10000000-0000-4000-8000-000000000001"
private const val projectFixture = "10000000-0000-4000-8000-000000000002"
private const val childFixture = "10000000-0000-4000-8000-000000000003"
private const val boardFixture = "10000000-0000-4000-8000-000000000004"

private class WorkspaceFixture(val available: Boolean = true, val withTasks: Boolean = false,
    val role: String = "owner", var planning: Boolean = false, var editPermission: Boolean? = null) : SharedWorkspaceGateway {
    var expanded: List<String> = emptyList()
    var snapshots = 0
    var boardTitle = "К выполнению"
    var boardRevision = 1
    var estimateUnit = "points"
    var creates = 0
    var updates = 0
    var failNextUpdate = false
    var pendingNextUpdate = false
    var rejectNextRetry = false
    val retries = mutableListOf<String>()
    var lastMutation: JSONObject? = null
    val queue = mutableListOf<JSONObject>()
    val queries = mutableListOf<JSONObject>()
    private val sampleTask = JSONObject().put("id", "qa-task").put("projectId", projectFixture)
        .put("title", "Подготовить обзор проекта и согласовать следующий шаг")
        .put("description", "Проверить задачи команды и обсудить план.")
        .put("statusId", boardFixture).put("revision", 1).put("priority", 2)
        .put("dueDate", "2026-10-20").put("categoryId", JSONObject.NULL)
        .put("assigneeId", JSONObject.NULL).put("checklists", JSONArray()).put("unreadCommentCount", 2)
        .apply { if (planning) put("storyPoints", 0).put("estimateHours", 2.5) }
    val records = mutableListOf<JSONObject>().apply { if (withTasks) add(sampleTask) }
    private fun project(id: String, title: String, parent: String? = null) = JSONObject()
        .put("id", id).put("spaceId", spaceFixture).put("title", title).put("parentId", parent ?: JSONObject.NULL)
        .put("layout", "board").put("kind", "project").put("isInbox", 0).put("role", role)
        .put("spaceRole", if (role == "owner") "owner" else "guest")
        .put("revision", 1).put("canOrganizeTasks", role in setOf("owner", "manager", "member"))
        .put("planning", JSONObject().put("enabled", planning).put("estimateUnit", estimateUnit).put("revision", 1))
        .apply { if (editPermission != null) put("permissions", JSONObject().put("editTasks", editPermission)) }
    override suspend fun sharedSpaces() = JSONObject().put("spaces", JSONArray().apply {
        if (available) put(JSONObject().put("id", spaceFixture).put("title", "Команда QA")
            .put("role", if (role == "owner") "owner" else "guest"))
    })
    override suspend fun sharedProjects(spaceId: String) = JSONObject().put("projects", JSONArray()
        .put(project(projectFixture, "Проект QA")).put(project(childFixture, "Подпроект QA", projectFixture)))
    override suspend fun archivedSharedProjects(spaceId: String) = JSONObject().put("projects", JSONArray())
    override suspend fun sharedInvitations() = JSONObject().put("invitations", JSONArray())
    override suspend fun sharedSpaceUi(spaceId: String) = JSONObject().put("expandedIds", JSONArray(expanded))
    override suspend fun saveSharedSpaceUi(spaceId: String, ids: List<String>): JSONObject {
        expanded = ids.toList()
        return sharedSpaceUi(spaceId)
    }
    override suspend fun sharedProject(projectId: String): JSONObject {
        snapshots++
        return JSONObject().put("project", project(projectId, "Проект QA"))
            .put("statuses", JSONArray().put(JSONObject().put("id", boardFixture).put("title", boardTitle)
                .put("position", 0).put("revision", boardRevision).put("isDone", 0).put("color", "#2d6c68").put("imageUrl", ""))
                .put(JSONObject().put("id", "done").put("title", "Готово").put("isDone", 1).put("revision", 1)))
            .put("tasks", JSONArray(records.map { JSONObject(it.toString()) })).put("members", JSONArray()).put("spaceMembers", JSONArray())
            .put("categories", JSONArray())
    }
    override suspend fun sharedPlanning(projectId: String): JSONObject {
        val total = JSONObject().put("count", records.size).put("completed", 0)
        for ((key, unit) in listOf("storyPoints" to "points", "estimateHours" to "hours")) total.put(unit,
            JSONObject().put("value", records.filter { !it.isNull(key) }.sumOf { it.getDouble(key) }).put("unestimated", records.count { it.isNull(key) }))
        return JSONObject().put("config", JSONObject().put("enabled", planning).put("estimateUnit", estimateUnit))
            .put("sprints", JSONArray()).put("totals", JSONObject().put("backlog", total)).put("byAssignee", JSONObject())
            .put("context", JSONObject().put("permissions", JSONObject().put("editTasks", editPermission ?: (role != "viewer"))
                .put("organizeTasks", role != "viewer").put("manageProjects", role == "owner")))
    }
    override suspend fun querySharedTasks(filter: JSONObject, cursor: String?): JSONObject {
        queries.add(JSONObject(filter.toString()))
        fun contains(key: String, value: String): Boolean = filter.optJSONArray(key)?.let { ids ->
            (0 until ids.length()).any { ids.optString(it) == value } } ?: true
        val matches = records.filter { task ->
            contains("projectIds", task.optString("projectId")) && contains("statusIds", task.optString("statusId")) &&
                contains("priority", task.optInt("priority").toString()) &&
                task.optString("title").contains(filter.optString("q"), ignoreCase = true) &&
                when (filter.optString("completion", "any")) {
                    "completed" -> task.optString("statusId") == "done"
                    "open" -> task.optString("statusId") != "done"
                    else -> true
                }
        }
        return JSONObject().put("tasks", JSONArray(matches.map { JSONObject(it.toString()) }))
            .put("total", matches.size).put("queryVersion", "fixture-${records.sumOf { it.optInt("revision") }}")
            .put("hasMore", false)
    }
    override suspend fun sharedTask(projectId: String, taskId: String) = JSONObject().put("task",
        JSONObject(records.first { it.optString("id") == taskId && it.optString("projectId") == projectId }.toString()))
    override suspend fun sharedComments(projectId: String, taskId: String) = JSONObject().put("comments", JSONArray())
    override suspend fun sharedGoogleSettings(projectId: String) = JSONObject().put("settings", JSONObject())
    override suspend fun queuedSharedTasks(projectId: String) = queue.map { JSONObject(it.toString()) }
    override suspend fun flushSharedOfflineTasks() = 0
    override suspend fun createSharedTask(projectId: String, fields: JSONObject): JSONObject {
        check(role in setOf("owner", "manager", "member"))
        creates++
        val task = JSONObject(fields.toString()).put("id", "qa-new-$creates").put("projectId", projectId)
            .put("revision", 1).put("priority", 0).put("checklists", JSONArray())
        records.add(task)
        return JSONObject().put("task", JSONObject(task.toString()))
    }
    override suspend fun updateSharedTask(projectId: String, taskId: String, changes: JSONObject): JSONObject {
        check(role in setOf("owner", "manager", "member"))
        updates++
        lastMutation = JSONObject(changes.toString())
        if (failNextUpdate) { failNextUpdate = false; error("Нет связи с сервером. Повторите попытку.") }
        val task = records.first { it.optString("id") == taskId }
        if (pendingNextUpdate) {
            pendingNextUpdate = false
            queue.add(JSONObject().put("taskId", taskId).put("requestId", "stable-pending")
                .put("body", JSONObject(changes.toString()).put("requestId", "stable-pending")).put("title", changes.optString("title")))
            return JSONObject().put("task", JSONObject().put("id", taskId).put("projectId", projectId)
                .put("revision", changes.getInt("expectedRevision")).put("pending", true))
        }
        assertEquals(task.optInt("revision"), changes.optInt("expectedRevision"))
        changes.keys().forEach { if (it != "expectedRevision") task.put(it, changes.get(it)) }
        task.put("revision", task.optInt("revision") + 1)
        return JSONObject().put("task", JSONObject(task.toString()))
    }
    override suspend fun retryFailedSharedMutation(requestId: String): JSONObject {
        val item = queue.first { it.getString("requestId") == requestId }
        val body = item.getJSONObject("body")
        retries.add(body.toString())
        if (rejectNextRetry) { rejectNextRetry = false; error("Нет доступа") }
        val task = records.first { it.getString("id") == item.getString("taskId") }
        assertEquals(task.getInt("revision"), body.getInt("expectedRevision"))
        body.keys().forEach { if (it !in setOf("requestId", "expectedRevision")) task.put(it, body.get(it)) }
        task.put("revision", task.getInt("revision") + 1)
        queue.remove(item)
        return JSONObject().put("task", JSONObject(task.toString()))
    }
    override suspend fun moveSharedTask(projectId: String, taskId: String, changes: JSONObject): JSONObject {
        check(role in setOf("owner", "manager", "member"))
        val task = records.first { it.optString("id") == taskId }
        assertEquals(task.optInt("revision"), changes.optInt("expectedRevision"))
        task.put("statusId", changes.getString("statusId")).put("revision", task.optInt("revision") + 1)
            .put("completedAt", if (changes.getString("statusId") == "done") "2026-10-17T09:00:00Z" else JSONObject.NULL)
        return JSONObject().put("task", JSONObject(task.toString()))
    }
    override suspend fun updateSharedBoard(projectId: String, statusId: String, changes: JSONObject): JSONObject {
        assertEquals(boardFixture, statusId)
        assertEquals(boardRevision, changes.getInt("expectedRevision"))
        boardTitle = changes.getString("title"); boardRevision++
        return JSONObject().put("ok", true)
    }
}

class SharedWorkspaceUiTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()

    @Test fun projectPlanningMenuOpensTheExistingTaskCard() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-actions").performClick()
        compose.onNodeWithTag("shared-planning-open").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("planning-task-qa-task").fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(hasText("Подготовить обзор проекта и согласовать следующий шаг") and hasAnyAncestor(hasTestTag("shared-planning-screen"))).performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-task-estimates").fetchSemanticsNodes().isNotEmpty() }
        compose.onAllNodes(hasTestTag("shared-planning-screen")).assertCountEquals(0)
    }

    @Test fun captureAffairsEntryProjectAndTaskInBothThemes() {
        var dark by mutableStateOf(false)
        val phase = InstrumentationRegistry.getArguments().getString("genesisCapturePhase") ?: "before"
        val planning = InstrumentationRegistry.getArguments().getString("genesisPlanningFixture") == "true"
        val pending = InstrumentationRegistry.getArguments().getString("genesisPendingFixture") == "true"
        var currentFixture: WorkspaceFixture? = null
        compose.setContent {
            CompositionLocalProvider(LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
                MaterialTheme(colorScheme = if (dark) evening else standart) {
                    androidx.compose.material3.Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                        key(dark) {
                            val fixture = remember { WorkspaceFixture(withTasks = true, planning = planning) }
                            currentFixture = fixture
                            SharedProjectsScreen(fixture, "ru")
                        }
                    }
                }
            }
        }
        fun capture(screen: String) {
            compose.waitForIdle()
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val image = File(instrumentation.targetContext.cacheDir, "ui290-$phase-native-shared-$screen-${if (dark) "dark" else "light"}.png")
            android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("screencap -p")).use { input ->
                image.outputStream().use { output -> input.copyTo(output) }
            }
            check(image.length() > 0)
        }
        for (theme in listOf(false, true)) {
            compose.runOnIdle { dark = theme }
            compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-space-$spaceFixture").fetchSemanticsNodes().isNotEmpty() }
            capture("entry")
            compose.onNodeWithTag("shared-space-$spaceFixture").performScrollTo().performClick()
            compose.onNodeWithTag("shared-project-$projectFixture").performScrollTo().performClick()
            compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-boards").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithTag("shared-boards").performScrollTo()
            capture("project")
            compose.onNodeWithText("Подготовить обзор проекта и согласовать следующий шаг").performScrollTo().performClick()
            compose.onNodeWithText("Название", substring = false).performScrollTo()
            capture("task")
            if (compose.onAllNodesWithTag("shared-task-estimates").fetchSemanticsNodes().isNotEmpty()) {
                compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("3.5")
                if (phase.endsWith("-390")) capture("task-keyboard")
                compose.onNodeWithTag("shared-estimate-hours").performScrollTo().performClick().performImeAction()
                awaitEstimateImeHidden()
                compose.onNodeWithTag("shared-task-estimates").performScrollTo()
                capture("task-estimates")
                val fieldBounds = compose.onNodeWithTag("shared-estimate-points").getUnclippedBoundsInRoot()
                assertTrue((fieldBounds.bottom - fieldBounds.top).value >= 48f)
                if (pending) {
                    val fixture = requireNotNull(currentFixture)
                    fixture.pendingNextUpdate = true
                    compose.onNodeWithTag("affairs-save").performClick()
                    compose.waitUntil(5_000) { fixture.queue.isNotEmpty() }
                    compose.runOnIdle { fixture.queue.single().put("error", "UNAUTHORIZED") }
                    awaitFixturePoll(fixture) { compose.onAllNodesWithText("Подробнее").fetchSemanticsNodes().isNotEmpty() }
                    compose.onNodeWithText("Подробнее").performScrollTo().performClick()
                    val retryBounds = compose.onNodeWithTag("shared-pending-retry").getUnclippedBoundsInRoot()
                    assertTrue((retryBounds.bottom - retryBounds.top).value >= 48f && (retryBounds.right - retryBounds.left).value >= 48f)
                    capture("task-pending")
                    compose.onNodeWithText("Закрыть").performClick()
                }
            }
        }
    }

    private fun openFixtureProject(fixture: WorkspaceFixture, restoration: StateRestorationTester? = null) {
        if (restoration == null) compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") {
            MaterialTheme(colorScheme = standart) { SharedProjectsScreen(fixture, "ru") }
        } } else restoration.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") {
            MaterialTheme(colorScheme = standart) { SharedProjectsScreen(fixture, "ru") }
        } }
        selectFixtureProject(fixture)
    }

    private fun selectFixtureProject(fixture: WorkspaceFixture) {
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-space-$spaceFixture").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-space-$spaceFixture").performClick()
        compose.onNodeWithTag("shared-project-$projectFixture").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-view-list").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-view-list").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.queries.isNotEmpty() }
    }

    private fun openEstimateTask(fixture: WorkspaceFixture, restoration: StateRestorationTester? = null) {
        openFixtureProject(fixture, restoration)
        compose.onNodeWithTag("shared-task-qa-task").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-task-estimates").fetchSemanticsNodes().isNotEmpty() }
    }

    private fun estimateValue(key: String, expected: String) {
        compose.onNodeWithTag("shared-estimate-$key").assert(SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(expected)))
    }

    private fun awaitEstimateImeHidden() {
        compose.waitUntil(5_000) {
            androidx.core.view.ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                ?.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) == false
        }
        InstrumentationRegistry.getInstrumentation().uiAutomation.waitForIdle(350, 5_000)
    }

    private fun awaitFixturePoll(fixture: WorkspaceFixture, condition: () -> Boolean) {
        compose.mainClock.advanceTimeBy(6_000)
        compose.waitForIdle()
        try { compose.waitUntil(15_000, condition) }
        catch (cause: Throwable) {
            throw AssertionError("Fixture snapshots=${fixture.snapshots}, queries=${fixture.queries.size}, planning=${fixture.planning}, edit=${fixture.editPermission}, task=${fixture.records.singleOrNull()}; UI=${compose.onRoot().printToString().take(5000)}", cause)
        }
    }

    @Test fun estimateCardDistinguishesZeroClearAndNoopWithoutSendingItsSibling() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        openEstimateTask(fixture)
        estimateValue("points", "0")
        estimateValue("hours", "2.5")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("0.00")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        assertEquals(0, fixture.updates)
        compose.onNodeWithTag("shared-estimate-points").performTextReplacement("")
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.updates == 1 }
        assertTrue(fixture.lastMutation!!.has("storyPoints"))
        assertTrue(fixture.lastMutation!!.isNull("storyPoints"))
        assertFalse(fixture.lastMutation!!.has("estimateHours"))
        assertFalse(fixture.lastMutation!!.has(SHARED_ESTIMATE_DRAFT_KEY))
        assertEquals(2.5, fixture.records.single().getDouble("estimateHours"), 0.0)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("0")
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.updates == 2 }
        assertEquals(0.0, fixture.records.single().getDouble("storyPoints"), 0.0)
        val before = fixture.snapshots
        compose.runOnIdle { fixture.estimateUnit = "hours" }
        compose.waitUntil(15_000) { fixture.snapshots > before }
        estimateValue("points", "0")
        estimateValue("hours", "2.5")
        assertEquals(2, fixture.updates)
    }

    @Test fun estimateConflictExplicitlyKeepsTouchedPointsAndReloadsUntouchedHours() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("5")
        compose.runOnIdle { fixture.records.single().put("storyPoints", 3).put("estimateHours", 8).put("revision", 2) }
        awaitFixturePoll(fixture) { compose.onAllNodesWithText("Обновить поля").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        compose.onNodeWithText("Обновить поля").performScrollTo().performClick()
        estimateValue("points", "5")
        estimateValue("hours", "8")
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.updates == 1 }
        assertEquals(5.0, fixture.records.single().getDouble("storyPoints"), 0.0)
        assertEquals(8.0, fixture.records.single().getDouble("estimateHours"), 0.0)
        assertFalse(fixture.lastMutation!!.has("estimateHours"))
        assertEquals(2, fixture.lastMutation!!.getInt("expectedRevision"))
    }

    @Test fun disabledPlanningAndRevokedEditRightKeepTheProposedValue() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("3")
        compose.runOnIdle { fixture.planning = false }
        awaitFixturePoll(fixture) { compose.onAllNodesWithText("Планирование для этого проекта ещё не включено.").fetchSemanticsNodes().isNotEmpty() }
        estimateValue("points", "3")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        compose.onNodeWithTag("shared-estimate-reset").performScrollTo().performClick()
        compose.onNodeWithTag("shared-estimate-points-value").assertTextContains("0")
        compose.runOnIdle { fixture.planning = true }
        awaitFixturePoll(fixture) { compose.onAllNodesWithTag("shared-estimate-points").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("3")
        compose.runOnIdle { fixture.editPermission = false }
        awaitFixturePoll(fixture) { compose.onAllNodesWithTag("shared-task-title-input").fetchSemanticsNodes().isEmpty() }
        estimateValue("points", "3")
        compose.onNodeWithTag("shared-estimate-points").assertIsNotEnabled()
        compose.onNodeWithTag("affairs-save").assertDoesNotExist()
        compose.onNodeWithTag("affairs-back").performScrollTo().performClick()
        compose.onNodeWithText("Несохранённые изменения").assertExists()
        compose.onNodeWithText("Продолжить редактирование").performClick()
        estimateValue("points", "3")
        assertEquals(0, fixture.updates)
    }

    @Test fun invalidEstimateSurvivesSavedStateAndCannotBecomeAZeroMutation() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        val restoration = StateRestorationTester(compose)
        openEstimateTask(fixture, restoration)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("1.111")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        restoration.emulateSavedInstanceStateRestore()
        compose.waitUntil(15_000) { compose.onAllNodesWithTag("shared-estimate-points").fetchSemanticsNodes().isNotEmpty() }
        estimateValue("points", "1.111")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        assertEquals(0, fixture.updates)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("0.00")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        assertEquals(0, fixture.updates)
    }

    @Test fun pendingEstimateBodyKeepsZeroNullAndBlocksASecondCommand() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        fixture.records.single().put("storyPoints", 3)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("0")
        compose.onNodeWithTag("shared-estimate-hours").performScrollTo().performTextReplacement("")
        fixture.pendingNextUpdate = true
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.queue.size == 1 }
        estimateValue("points", "0")
        estimateValue("hours", "")
        compose.onNodeWithTag("shared-estimate-points").assertIsNotEnabled()
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        val body = fixture.queue.single().getJSONObject("body")
        assertEquals(0.0, body.getDouble("storyPoints"), 0.0)
        assertTrue(body.has("estimateHours") && body.isNull("estimateHours"))
        assertFalse(body.has(SHARED_ESTIMATE_DRAFT_KEY))
        compose.runOnIdle { fixture.queue.single().put("error", "FORBIDDEN") }
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        assertEquals(1, fixture.updates)
    }

    @Test fun savedEstimatesRemainReadableWhenPlanningIsOffAndRoleIsViewer() {
        val fixture = WorkspaceFixture(withTasks = true, role = "viewer")
        fixture.records.single().put("storyPoints", 0).put("estimateHours", 2.5)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-estimate-points-value").assertTextContains("0")
        compose.onNodeWithTag("shared-estimate-hours-value").assertTextContains("2,5")
        compose.onNodeWithTag("shared-estimate-points").assertDoesNotExist()
        compose.onNodeWithTag("affairs-save").assertDoesNotExist()
    }

    @Test fun explicitRetryKeepsTheSameEstimateBodyAfterAnotherRefusal() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        fixture.records.single().put("storyPoints", 3)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("0")
        compose.onNodeWithTag("shared-estimate-hours").performScrollTo().performTextReplacement("")
        fixture.pendingNextUpdate = true
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.queue.size == 1 }
        val original = fixture.queue.single().getJSONObject("body").toString()
        compose.runOnIdle { fixture.queue.single().put("error", "UNAUTHORIZED") }
        awaitFixturePoll(fixture) { compose.onAllNodesWithText("Подробнее").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Подробнее").performScrollTo().performClick()
        fixture.rejectNextRetry = true
        compose.onNodeWithTag("shared-pending-retry").performClick()
        compose.waitUntil(5_000) { fixture.retries.size == 1 }
        assertEquals(original, fixture.queue.single().getJSONObject("body").toString())
        compose.onNodeWithTag("shared-pending-retry").performClick()
        compose.waitUntil(5_000) { fixture.retries.size == 2 && fixture.queue.isEmpty() }
        assertEquals(listOf(original, original), fixture.retries)
        assertEquals(0.0, fixture.records.single().getDouble("storyPoints"), 0.0)
        assertTrue(fixture.records.single().isNull("estimateHours"))
        assertEquals(2, fixture.records.single().getInt("revision"))
    }

    @Test fun explicitTaskPermissionOverridesAnOwnerRoleInTheCard() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true, editPermission = false)
        openEstimateTask(fixture)
        compose.onNodeWithTag("shared-task-title-input").assertDoesNotExist()
        compose.onNodeWithTag("shared-estimate-points-value").assertTextContains("0")
        compose.onNodeWithTag("affairs-save").assertDoesNotExist()
        assertEquals(0, fixture.updates)
    }

    @Test fun estimateCopyFollowsFourteenLanguagesWithoutResettingInput() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        var language by mutableStateOf("ru")
        val dark = InstrumentationRegistry.getArguments().getString("genesisCaptureDark") == "true"
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides language, LocalEveningTheme provides dark) {
            MaterialTheme(colorScheme = if (dark) evening else standart) {
                androidx.compose.material3.Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    SharedProjectsScreen(fixture, language)
                }
            }
        } }
        selectFixtureProject(fixture)
        compose.onNodeWithTag("shared-task-qa-task").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-estimate-points").fetchSemanticsNodes().isNotEmpty() }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val copy = context.assets.open("originals/i18n/planning-translations.json").bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
        for (code in listOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja")) {
            compose.runOnIdle { language = code }
            compose.onNodeWithTag("shared-estimate-points").performScrollTo().performTextReplacement("3.5")
            estimateValue("points", "3.5")
            compose.onNodeWithText(copy.getJSONObject(code).getString("estimates")).assertExists()
            compose.onNodeWithText(copy.getJSONObject(code).getString("independent")).assertExists()
            compose.onNodeWithTag("affairs-save").assertIsEnabled()
            compose.onNodeWithTag("shared-estimate-points").performTextReplacement("1.111")
            estimateValue("points", "1.111")
            compose.onNodeWithText(copy.getJSONObject(code).getString("numbersInvalid")).assertExists()
            compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        }
        compose.onNodeWithTag("shared-estimate-hours").performScrollTo().performClick().performImeAction()
        awaitEstimateImeHidden()
        compose.onNodeWithTag("shared-task-estimates").performScrollTo()
        val image = File(context.cacheDir, "native-estimates-after-ja-error-${if (dark) "dark" else "light"}.png")
        android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p")).use { input ->
            image.outputStream().use { output -> input.copyTo(output) }
        }
        assertEquals(0, fixture.updates)
    }

    @Test fun searchAndAppliedFiltersResetAndTaskCanBeCompletedWithoutDragging() {
        val fixture = WorkspaceFixture(withTasks = true)
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-task-search").performTextInput("обзор")
        compose.waitUntil(5_000) { fixture.queries.last().optString("q") == "обзор" }
        compose.onNodeWithTag("shared-filters").performClick()
        compose.onNodeWithTag("shared-filter-completion-completed").performClick()
        compose.onNodeWithTag("affairs-apply-filters").performClick()
        compose.waitUntil(5_000) { fixture.queries.last().optString("completion") == "completed" }
        compose.onNodeWithTag("shared-task-qa-task").assertDoesNotExist()
        compose.onNodeWithTag("shared-reset-filters").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.queries.last().optString("completion").isBlank() && fixture.queries.last().optString("q").isBlank() }
        compose.onNodeWithContentDescription("Завершить задачу: Подготовить обзор проекта и согласовать следующий шаг")
            .performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.records.single().optString("statusId") == "done" }
    }

    @Test fun failedSaveKeepsDraftAndSaveActionThenRetryAndBackRestoreTheProject() {
        val fixture = WorkspaceFixture(withTasks = true)
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-task-qa-task").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-task-title-input").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-task-title-input").performTextReplacement("Обновлённый план команды")
        compose.onNodeWithTag("affairs-save").assertIsDisplayed()
        fixture.failNextUpdate = true
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.updates == 1 }
        compose.onNodeWithTag("shared-task-title-input").assertTextContains("Обновлённый план команды")
        compose.onNodeWithTag("shared-feedback").assertTextContains("Нет связи с сервером", substring = true)
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.records.single().optString("title") == "Обновлённый план команды" }
        compose.onNodeWithTag("affairs-back").performScrollTo().performClick()
        compose.onNodeWithTag("shared-view-list").assertExists()
        compose.onNodeWithTag("shared-task-title-input").assertDoesNotExist()
        compose.onNodeWithTag("shared-task-qa-task").assertIsDisplayed()
        compose.onNodeWithTag("shared-project-$projectFixture").assertDoesNotExist()
    }

    @Test fun pendingIdentityReplyKeepsTheSubmittedTitleInTheEditor() {
        val fixture = WorkspaceFixture(withTasks = true, planning = true)
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-task-qa-task").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-task-title-input").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-task-title-input").performTextReplacement("Queued task proposal")
        fixture.pendingNextUpdate = true
        compose.onNodeWithTag("affairs-save").performClick()
        compose.waitUntil(5_000) { fixture.updates == 1 && fixture.queue.size == 1 }
        compose.onNodeWithTag("shared-task-title-input").assertTextContains("Queued task proposal")
        compose.onNodeWithTag("affairs-save").assertIsNotEnabled()
        assertEquals("Queued task proposal", fixture.queue.single().getJSONObject("body").getString("title"))
    }

    @Test fun newTaskUsesExplicitCreateAndViewerCannotEditOrComplete() {
        val fixture = WorkspaceFixture(withTasks = true)
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-create-task").performScrollTo().performClick()
        compose.onNodeWithTag("shared-new-task-title").performTextInput("Задача для команды")
        compose.onNodeWithTag("shared-create-confirm").assertTextContains("Добавить задачу").performClick()
        compose.waitUntil(5_000) { fixture.creates == 1 }
        assertEquals("Задача для команды", fixture.records.last().optString("title"))
    }

    @Test fun viewerHasTaskDetailsWithoutWriteActions() {
        val fixture = WorkspaceFixture(withTasks = true, role = "viewer")
        openFixtureProject(fixture)
        compose.onNodeWithTag("shared-create-task").assertDoesNotExist()
        compose.onAllNodesWithContentDescription("Завершить задачу", substring = true).assertCountEquals(0)
        compose.onNodeWithTag("shared-task-qa-task").performScrollTo().performClick()
        compose.onNodeWithTag("shared-task-title-input").assertDoesNotExist()
        compose.onNodeWithTag("affairs-save").assertDoesNotExist()
        compose.onNodeWithText("Подготовить обзор проекта и согласовать следующий шаг").assertExists()
        assertEquals(0, fixture.creates + fixture.updates)
    }

    @Test fun emptyEntryHasCreationAndInvitationDialog() {
        val fixture = WorkspaceFixture(false)
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") { MaterialTheme { SharedProjectsScreen(fixture, "ru") } } }
        compose.onNodeWithTag("shared-create-space").assertIsDisplayed()
        compose.onNodeWithTag("shared-actions").performClick()
        compose.onNodeWithTag("shared-join-space").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Приглашений пока нет.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Приглашений пока нет.").assertIsDisplayed()
        assertEquals(0, fixture.snapshots)
    }

    @Test fun projectsStartCollapsedThenSaveExpansionAndBoardChanges() {
        val fixture = WorkspaceFixture()
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") { MaterialTheme { SharedProjectsScreen(fixture, "ru") } } }
        compose.onNodeWithTag("shared-space-$spaceFixture").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-project-$projectFixture").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-project-$childFixture").assertDoesNotExist()
        assertEquals(0, fixture.snapshots)
        compose.onNodeWithTag("shared-actions").performClick()
        compose.onNodeWithTag("shared-invite-space").assertIsDisplayed()
        androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        compose.onNodeWithTag("shared-project-expand-$projectFixture").performClick()
        compose.waitUntil(5_000) { fixture.expanded.contains(projectFixture) }
        compose.onNodeWithTag("shared-project-$childFixture").assertExists()
        compose.onNodeWithTag("shared-project-$projectFixture").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.expanded.contains(projectFixture) && fixture.snapshots > 0 }
        compose.onNodeWithTag("shared-project-$projectFixture").assertDoesNotExist()
        compose.onNodeWithTag("shared-boards").performScrollTo()
        compose.onNodeWithTag("shared-status-actions-$boardFixture").performClick()
        compose.onNodeWithTag("shared-board-settings-$boardFixture").assertIsDisplayed().performClick()
        try {
            compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-board-title-input").fetchSemanticsNodes().isNotEmpty() }
        } catch (error: Throwable) {
            compose.onRoot().printToLog("SharedBoardQA")
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                .takeScreenshot(File(context.getExternalFilesDir(null), "android-board-dialog-failure.png"))
            throw error
        }
        compose.onNodeWithTag("shared-board-title-input").performTextReplacement("План команды")
        compose.onNodeWithText("Сохранить", substring = false).performClick()
        compose.waitUntil(5_000) { fixture.boardTitle == "План команды" }
        compose.onNodeWithText("План команды").assertExists()
        val app = InstrumentationRegistry.getInstrumentation().targetContext
        androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            .takeScreenshot(File(app.getExternalFilesDir(null), "android-shared-boards.png"))
        compose.onNodeWithTag("affairs-back").performScrollTo().performClick()
        compose.onNodeWithTag("shared-project-$childFixture").assertExists()
        compose.onNodeWithTag("shared-project-expand-$projectFixture").performClick()
        compose.waitUntil(5_000) { fixture.expanded.isEmpty() }
        compose.onNodeWithTag("shared-project-$childFixture").assertDoesNotExist()
    }
}
