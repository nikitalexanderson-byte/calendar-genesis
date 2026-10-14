package ru.genesis.calendar.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
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

private class WorkspaceFixture(val available: Boolean = true) : SharedWorkspaceGateway {
    var expanded: List<String> = emptyList()
    var snapshots = 0
    var boardTitle = "К выполнению"
    var boardRevision = 1
    private fun project(id: String, title: String, parent: String? = null) = JSONObject()
        .put("id", id).put("spaceId", spaceFixture).put("title", title).put("parentId", parent ?: JSONObject.NULL)
        .put("layout", "board").put("kind", "project").put("isInbox", 0).put("role", "owner")
        .put("revision", 1).put("canOrganizeTasks", true)
    override suspend fun sharedSpaces() = JSONObject().put("spaces", JSONArray().apply {
        if (available) put(JSONObject().put("id", spaceFixture).put("title", "Команда QA").put("role", "owner"))
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
            .put("tasks", JSONArray()).put("members", JSONArray()).put("spaceMembers", JSONArray())
            .put("categories", JSONArray())
    }
    override suspend fun querySharedTasks(filter: JSONObject, cursor: String?) = JSONObject().put("tasks", JSONArray()).put("total", 0).put("queryVersion", "fixture").put("hasMore", false)
    override suspend fun sharedGoogleSettings(projectId: String) = JSONObject().put("settings", JSONObject())
    override suspend fun queuedSharedTasks(projectId: String) = emptyList<JSONObject>()
    override suspend fun flushSharedOfflineTasks() = 0
    override suspend fun updateSharedBoard(projectId: String, statusId: String, changes: JSONObject): JSONObject {
        assertEquals(boardFixture, statusId)
        assertEquals(boardRevision, changes.getInt("expectedRevision"))
        boardTitle = changes.getString("title"); boardRevision++
        return JSONObject().put("ok", true)
    }
}

class SharedWorkspaceUiTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()

    @Test fun emptyEntryHasCreationAndInvitationDialog() {
        val fixture = WorkspaceFixture(false)
        compose.setContent { CompositionLocalProvider(LocalGenesisLanguage provides "ru") { MaterialTheme { SharedProjectsScreen(fixture, "ru") } } }
        compose.onNodeWithTag("shared-create-space").assertIsDisplayed()
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
        compose.onNodeWithTag("shared-invite-space").assertExists()
        compose.onNodeWithTag("shared-project-$projectFixture").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.expanded.contains(projectFixture) && fixture.snapshots > 0 }
        compose.onNodeWithTag("shared-project-$childFixture").assertExists()
        compose.onNodeWithTag("shared-boards").performScrollTo()
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
        compose.onNodeWithTag("shared-project-$projectFixture").performScrollTo().performClick()
        compose.waitUntil(5_000) { fixture.expanded.isEmpty() }
        compose.onNodeWithTag("shared-project-$childFixture").assertDoesNotExist()
    }
}
