package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.geometry.Offset
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import androidx.room.Room
import java.io.File
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.Before
import ru.genesis.calendar.data.*

class ProjectsFlowTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Before fun selectIsolatedWorkspace() {
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        app.activateAccount(null)
    }

    private fun workspaceRoot() = compose.onNode(isRoot() and hasAnyDescendant(hasTestTag("projects-screen")))

    private fun beginTaskDrag(id: String) {
        val source = compose.onNodeWithTag("drag-task-$id", useUnmergedTree = true)
        source.performScrollTo().assertIsDisplayed()
        val point = source.fetchSemanticsNode().boundsInRoot.center
        val origin = workspaceRoot().fetchSemanticsNode().boundsInRoot.topLeft
        try {
            workspaceRoot().performTouchInput { down(point - origin) }
            compose.mainClock.advanceTimeBy(800)
            workspaceRoot().performTouchInput { moveBy(Offset(0f, 4f)) }
            compose.onNodeWithTag("drag-floating-task").assertExists()
        } catch (error: Throwable) {
            cancelTaskDrag()
            throw error
        }
    }

    private fun cancelTaskDrag() { runCatching { workspaceRoot().performTouchInput { cancel() } } }

    private fun dropTaskOn(id: String) {
        val tag = if (id == "__genesis_inbox__") "project-inbox" else "project-drop-$id"
        if (!compose.onNodeWithTag(tag).isDisplayed())
            compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag(tag))
        val target = compose.onNodeWithTag(tag).assertIsDisplayed().fetchSemanticsNode().boundsInRoot.center
        val origin = workspaceRoot().fetchSemanticsNode().boundsInRoot.topLeft
        // The viewport retains the pointer even after the lazy source row is recycled.
        workspaceRoot().performTouchInput { moveTo(target - origin, 300); up() }
    }

    @Test fun projectAndTaskAssignmentPersistEncrypted() = runBlocking {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val projectId="internal-project-validation-v1"
        val structure=WorkspaceStructureRepository(app)
        structure.saveProject(GenesisProject(projectId,null,"work","Тестовый проект","",emptyList(),"active",0))
        val taskId="internal-project-task-v1"
        val previous=app.repository.get(taskId)
        val saved=app.repository.save(LocalTask(id=taskId,title="Тест задачи в проекте",projectId=projectId,
            revision=previous?.revision ?: 0))
        assertEquals("work",saved.categoryId)
        assertEquals("Тестовый проект",saved.project)
        val independent=Room.databaseBuilder(app,GenesisDatabase::class.java,"genesis.db").build()
        try {
            val document=independent.dao().document(app.workspaceScope,"structure")!!
            assertFalse(document.encrypted.contains("Тестовый проект"))
            assertEquals(projectId,WorkspaceStructureCodec.decode(LocalCipher().decrypt(document.encrypted,
                app.workspaceScope+"/structure"),document.revision).projects.single { it.id==projectId }.id)
            val row=independent.dao().task(app.workspaceScope,taskId)!!
            assertFalse(row.encrypted.contains("Тест задачи в проекте"))
            assertEquals(projectId,app.repository.get(taskId)?.projectId)
            structure.saveCategory(GenesisCategory("internal-category-validation-v1","Тестовый раздел","#2d6c68",10),
                expectedRevision=document.revision)
            var staleRejected=false
            try {
                structure.saveCategory(GenesisCategory("internal-category-validation-v2","Устаревший раздел","#2d6c68",11),
                    expectedRevision=document.revision)
            } catch (_: IllegalArgumentException) { staleRejected=true }
            assertTrue("stale structure revision must not overwrite local changes",staleRejected)
        } finally { independent.close() }
    }

    @Test fun projectScreenOffersNativeEditor() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        val projectTitle = "Проект UI-проверки"
        val alreadyCreated = runBlocking {
            val repo = WorkspaceStructureRepository(app)
            if (repo.workspace.first().categories.none { it.id == "work" }) {
                repo.saveCategory(GenesisCategory("work", "Работа", "#2d6c68", 0))
            }
            repo.workspace.first().projects.any { it.title == projectTitle }
        }
        compose.openWorkspacePage("Проекты")
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("projects-screen").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("projects-screen").assertExists()
        compose.onNodeWithTag("personal-actions").performClick()
        compose.onNodeWithTag("create-project").performClick()
        if (alreadyCreated) {
            compose.onNodeWithTag("project-title").assertExists()
            compose.onNodeWithText("Отмена").performScrollTo().performClick()
        } else {
            compose.onNodeWithTag("project-title").performTextInput(projectTitle)
            compose.onNodeWithTag("project-category-work").performScrollTo().performClick()
            compose.onNodeWithTag("save-project").performScrollTo().performClick()
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("project-title").fetchSemanticsNodes().isEmpty() }
        compose.onAllNodes(hasTestTag("app-theme-Standart") or hasTestTag("app-theme-Evening")).onFirst().assertExists()
        compose.onNodeWithTag("personal-task-search-open").performClick()
        compose.onNodeWithTag("personal-category-filters").assertIsEnabled().performClick()
        compose.onNodeWithTag("category-filter-work").performScrollTo()
        compose.onNodeWithTag("category-filter-work")
            .assert(hasAnyAncestor(hasTestTag("life-categories-card")))
        compose.onNodeWithTag("category-filter-work").performClick().assertIsSelected()
        compose.onNodeWithTag("personal-task-search-close").performClick()
        compose.onNodeWithTag("projects-screen").performScrollToIndex(0)
        compose.waitForIdle()
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "projects-standart-overview.png")))
        compose.onNodeWithTag("projects-screen").performScrollToNode(hasText(projectTitle))
        assertTrue(compose.onAllNodesWithText(projectTitle).fetchSemanticsNodes().isNotEmpty())
        compose.waitForIdle()
        assertTrue(device.takeScreenshot(File(app.getExternalFilesDir(null), "projects-standart.png")))
    }

    @Test fun chaosBoxTaskCanBeMovedIntoProjectWithoutGoogleAccount() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val projectId = "internal-drag-target-v1"
        val taskId = "internal-chaos-drag-v1"
        val title = "Проект для переноса"
            runBlocking {
                WorkspaceStructureRepository(app).saveProject(
                    GenesisProject(projectId, null, "work", title, "", emptyList(), "active", 0))
                val previous = app.repository.get(taskId)
                app.repository.save(LocalTask(id = taskId, title = "Задача из Хаос-бокса",
                    revision = previous?.revision ?: 0))
            }
            compose.waitUntil(10_000) {
                compose.onAllNodes(hasTestTag("app-theme-Standart") or hasTestTag("app-theme-Evening")).fetchSemanticsNodes().isNotEmpty()
            }
            compose.openWorkspacePage("Проекты")
            compose.onNodeWithTag("project-inbox").assertExists()
            compose.onNodeWithTag("drag-task-$taskId", useUnmergedTree = true)
                .performScrollTo().assertIsDisplayed()
            val taskTitle = runBlocking { requireNotNull(app.repository.get(taskId)).title }
            compose.onNode(hasContentDescription("Действия с задачей: $taskTitle") and
                hasAnyAncestor(hasTestTag("drag-task-$taskId")), useUnmergedTree = true).performClick()
            compose.onNodeWithTag("move-task-$taskId").performClick()
            compose.onNodeWithTag("project-destination-search").assertIsDisplayed()
            compose.onNodeWithTag("project-destination-list")
                .performScrollToNode(hasTestTag("project-menu-target-$projectId"))
            compose.onNodeWithTag("project-menu-target-$projectId").performClick()
            compose.waitUntil(10_000) {
                runBlocking { app.repository.get(taskId)?.projectId == projectId }
            }
            compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$projectId"))
            compose.onNodeWithTag("project-drop-$projectId").assertExists()
    }

    @Test fun longPressDragMovesChaosTaskToProject() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val taskId = "internal-gesture-task-v1"
        val projectId = runBlocking {
            val repo = WorkspaceStructureRepository(app)
            if (repo.workspace.first().projects.isEmpty()) repo.saveProject(
                GenesisProject("internal-gesture-project-v1", null, null, "Проект жеста", "", emptyList(), "active", 0))
            val id = WorkspaceStructureCodec.ordered(repo.workspace.first()).first().first.id
            val previous = app.repository.get(taskId)
            app.repository.save(LocalTask(id = taskId, title = "Задача для жеста",
                revision = previous?.revision ?: 0))
            id
        }
            compose.waitUntil(10_000) {
                compose.onAllNodes(hasTestTag("app-theme-Standart") or hasTestTag("app-theme-Evening")).fetchSemanticsNodes().isNotEmpty()
            }
            compose.openWorkspacePage("Проекты")
            beginTaskDrag(taskId)
            try {
                val preview = File(app.getExternalFilesDir(null), "projects-drag-preview-after.png")
                assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(preview))
                dropTaskOn(projectId)
            } finally { cancelTaskDrag() }
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == projectId } }
    }

    @Test fun longPressDragMovesTaskBetweenProjectsAndBackToChaosBox() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val originId = "internal-project-drag-origin-v1"
        val destinationId = "internal-project-drag-destination-v1"
        val taskId = "internal-project-drag-task-v1"
            runBlocking {
                val repo = WorkspaceStructureRepository(app)
                repo.saveProject(GenesisProject(originId, null, null, "B Жест — исток", "", emptyList(), "active", 0))
                repo.saveProject(GenesisProject(destinationId, null, null, "A Жест — цель", "", emptyList(), "active", 0))
                val previous = app.repository.get(taskId)
                app.repository.save(LocalTask(id = taskId, title = "Задача между проектами", projectId = originId,
                    revision = previous?.revision ?: 0))
            }
            compose.waitUntil(10_000) {
                compose.onAllNodes(hasTestTag("app-theme-Standart") or hasTestTag("app-theme-Evening")).fetchSemanticsNodes().isNotEmpty()
            }
            compose.openWorkspacePage("Проекты")
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("projects-screen").fetchSemanticsNodes().isNotEmpty()
            }
            fun dragTo(targetId: String) {
                beginTaskDrag(taskId)
                try { dropTaskOn(targetId) } finally { cancelTaskDrag() }
            }
            compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$originId"))
            compose.onNodeWithTag("project-drop-$originId").performClick()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("drag-task-$taskId", useUnmergedTree = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            dragTo(destinationId)
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == destinationId } }
            compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$destinationId"))
            if (compose.onAllNodesWithTag("drag-task-$taskId", useUnmergedTree = true).fetchSemanticsNodes().isEmpty())
                compose.onNodeWithTag("project-drop-$destinationId").performClick()
            dragTo("__genesis_inbox__")
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == "__genesis_inbox__" } }
    }

    @Test fun draggingNearBottomAutoScrollsProjectDestinations() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val originId = "internal-autoscroll-origin-v1"
        val lastId = "internal-autoscroll-target-18-v1"
        val taskId = "internal-autoscroll-task-v1"
        runBlocking {
            val repo = WorkspaceStructureRepository(app)
            repo.saveProject(GenesisProject(originId, null, null, "00 Auto-scroll origin", "", emptyList(), "active", 0))
            (1..18).forEach { index ->
                val id = "internal-autoscroll-target-${index.toString().padStart(2, '0')}-v1"
                repo.saveProject(GenesisProject(id, null, null,
                    "${index.toString().padStart(2, '0')} Auto-scroll destination", "", emptyList(), "active", index))
            }
            val previous = app.repository.get(taskId)
            app.repository.save(LocalTask(id = taskId, title = "Auto-scroll drag task", projectId = originId,
                revision = previous?.revision ?: 0))
        }
        compose.waitUntil(10_000) {
            compose.onAllNodes(hasTestTag("app-theme-Standart") or hasTestTag("app-theme-Evening")).fetchSemanticsNodes().isNotEmpty()
        }
        compose.openWorkspacePage("Проекты")
        compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$originId"))
        compose.onNodeWithTag("project-drop-$originId").performClick()
        beginTaskDrag(taskId)
        try {
            val listBounds = compose.onNodeWithTag("projects-screen").fetchSemanticsNode().boundsInRoot
            val origin = workspaceRoot().fetchSemanticsNode().boundsInRoot.topLeft
            workspaceRoot().performTouchInput { moveTo(Offset(listBounds.center.x, listBounds.bottom - 8f) - origin) }
            compose.waitUntil(10_000) {
                compose.mainClock.advanceTimeBy(32)
                compose.onAllNodesWithTag("project-drop-$lastId").fetchSemanticsNodes().any {
                    it.boundsInRoot.height > 0f && it.boundsInRoot.top >= listBounds.top && it.boundsInRoot.bottom <= listBounds.bottom
                }
            }
            compose.onNodeWithTag("project-drop-$lastId").assertIsDisplayed()
            dropTaskOn(lastId)
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == lastId } }
        } finally { cancelTaskDrag() }
    }
}
