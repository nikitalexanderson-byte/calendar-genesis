package ru.genesis.calendar.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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
    val role: String = "owner") : SharedWorkspaceGateway {
    var expanded: List<String> = emptyList()
    var snapshots = 0
    var boardTitle = "К выполнению"
    var boardRevision = 1
    var creates = 0
    var updates = 0
    var failNextUpdate = false
    val queries = mutableListOf<JSONObject>()
    private val sampleTask = JSONObject().put("id", "qa-task").put("projectId", projectFixture)
        .put("title", "Подготовить обзор проекта и согласовать следующий шаг")
        .put("description", "Проверить задачи команды и обсудить план.")
        .put("statusId", boardFixture).put("revision", 1).put("priority", 2)
        .put("dueDate", "2026-10-20").put("categoryId", JSONObject.NULL)
        .put("assigneeId", JSONObject.NULL).put("checklists", JSONArray()).put("unreadCommentCount", 2)
    val records = mutableListOf<JSONObject>().apply { if (withTasks) add(sampleTask) }
    private fun project(id: String, title: String, parent: String? = null) = JSONObject()
        .put("id", id).put("spaceId", spaceFixture).put("title", title).put("parentId", parent ?: JSONObject.NULL)
        .put("layout", "board").put("kind", "project").put("isInbox", 0).put("role", role)
        .put("spaceRole", if (role == "owner") "owner" else "guest")
        .put("revision", 1).put("canOrganizeTasks", role in setOf("owner", "manager", "member"))
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
    override suspend fun queuedSharedTasks(projectId: String) = emptyList<JSONObject>()
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
        if (failNextUpdate) { failNextUpdate = false; error("Нет связи с сервером. Повторите попытку.") }
        val task = records.first { it.optString("id") == taskId }
        assertEquals(task.optInt("revision"), changes.optInt("expectedRevision"))
        changes.keys().forEach { if (it != "expectedRevision") task.put(it, changes.get(it)) }
        task.put("revision", task.optInt("revision") + 1)
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

    @Test fun captureAffairsEntryProjectAndTaskInBothThemes() {
        var dark by mutableStateOf(false)
        val phase = InstrumentationRegistry.getArguments().getString("genesisCapturePhase") ?: "before"
        compose.setContent {
            CompositionLocalProvider(LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark) {
                MaterialTheme(colorScheme = if (dark) evening else standart) {
                    androidx.compose.material3.Surface(Modifier.fillMaxSize()) {
                        key(dark) { SharedProjectsScreen(remember { WorkspaceFixture(withTasks = true) }, "ru") }
                    }
                }
            }
        }
        fun capture(screen: String) {
            compose.waitForIdle()
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            check(androidx.test.uiautomator.UiDevice.getInstance(instrumentation).takeScreenshot(
                File(instrumentation.targetContext.cacheDir, "ui290-$phase-native-shared-$screen-${if (dark) "dark" else "light"}.png")))
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
        }
    }

    private fun openFixtureProject(fixture: WorkspaceFixture) {
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") {
            MaterialTheme(colorScheme = standart) { SharedProjectsScreen(fixture, "ru") }
        } }
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-space-$spaceFixture").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-space-$spaceFixture").performClick()
        compose.onNodeWithTag("shared-project-$projectFixture").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("shared-view-list").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("shared-view-list").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.queries.isNotEmpty() }
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
