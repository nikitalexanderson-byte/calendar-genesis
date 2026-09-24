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
import ru.genesis.calendar.data.*

class ProjectsFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

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
            WorkspaceStructureRepository(app).workspace.first().projects.any { it.title == projectTitle }
        }
        compose.onNodeWithText("Проекты").performScrollTo().performClick()
        compose.onNodeWithTag("projects-screen").assertExists()
        compose.onNodeWithTag("create-project").performClick()
        if (alreadyCreated) {
            compose.onNodeWithTag("project-title").assertExists()
            compose.onNodeWithText("Отмена").performScrollTo().performClick()
        } else {
            compose.onNodeWithTag("project-title").performTextInput(projectTitle)
            compose.onNodeWithTag("project-category-work").performClick()
            compose.onNodeWithTag("save-project").performScrollTo().performClick()
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("project-title").fetchSemanticsNodes().isEmpty() }
        val preferences = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { preferences.values.first().theme }
        try {
            for (theme in listOf("Standart", "Experimental")) {
                runBlocking { preferences.set("theme", theme) }
                compose.waitUntil(10_000) { compose.onAllNodesWithTag("app-theme-$theme").fetchSemanticsNodes().isNotEmpty() }
                compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("category-filter-work"))
                compose.onNodeWithTag("category-filter-work").performClick()
                compose.onNodeWithTag("projects-screen").performScrollToIndex(0)
                compose.waitForIdle()
                val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                val overview = File(app.getExternalFilesDir(null), "projects-${theme.lowercase()}-overview.png")
                assertTrue("Overview screenshot failed: $theme", device.takeScreenshot(overview))
                compose.onNodeWithTag("projects-screen").performScrollToNode(hasText(projectTitle))
                assertTrue(compose.onAllNodesWithText(projectTitle).fetchSemanticsNodes().isNotEmpty())
                compose.waitForIdle()
                val image = File(app.getExternalFilesDir(null), "projects-${theme.lowercase()}.png")
                assertTrue("Detail screenshot failed: $theme", device.takeScreenshot(image))
            }
        } finally {
            runBlocking { preferences.set("theme", originalTheme) }
        }
    }

    @Test fun chaosBoxTaskCanBeMovedIntoProjectWithoutGoogleAccount() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val preferences = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { preferences.values.first().theme }
        val projectId = "internal-drag-target-v1"
        val taskId = "internal-chaos-drag-v1"
        val title = "Проект для переноса"
        try {
            runBlocking {
                WorkspaceStructureRepository(app).saveProject(
                    GenesisProject(projectId, null, "work", title, "", emptyList(), "active", 0))
                val previous = app.repository.get(taskId)
                app.repository.save(LocalTask(id = taskId, title = "Задача из Хаос-бокса",
                    revision = previous?.revision ?: 0))
                preferences.set("theme", "Experimental")
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Experimental").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Проекты").performScrollTo().performClick()
            compose.onNodeWithTag("project-inbox").assertExists()
            compose.onNodeWithText("Открыть").performClick()
            compose.onNodeWithTag("drag-task-$taskId", useUnmergedTree = true)
                .performScrollTo().assertIsDisplayed()
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
        } finally {
            runBlocking { preferences.set("theme", originalTheme) }
        }
    }

    @Test fun longPressDragMovesChaosTaskToProject() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val preferences = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { preferences.values.first().theme }
        val taskId = "internal-gesture-task-v1"
        val projectId = runBlocking {
            val repo = WorkspaceStructureRepository(app)
            if (repo.workspace.first().projects.isEmpty()) repo.saveProject(
                GenesisProject("internal-gesture-project-v1", null, null, "Проект жеста", "", emptyList(), "active", 0))
            val id = WorkspaceStructureCodec.ordered(repo.workspace.first()).first().first.id
            val previous = app.repository.get(taskId)
            app.repository.save(LocalTask(id = taskId, title = "Задача для жеста",
                revision = previous?.revision ?: 0))
            preferences.set("theme", "Experimental")
            id
        }
        try {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Experimental").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Проекты").performScrollTo().performClick()
            compose.onNodeWithText("Открыть").performClick()
            val source = compose.onNodeWithTag("drag-task-$taskId", useUnmergedTree = true)
            source.performScrollTo()
            source.assertIsDisplayed()
            val sourceBounds = source.fetchSemanticsNode().boundsInRoot
            source.performTouchInput {
                down(center)
                advanceEventTime(700)
                moveBy(Offset(0f, 4f))
            }
            compose.onNodeWithTag("drag-overlay").assertExists()
            val preview = File(app.getExternalFilesDir(null), "projects-drag-preview-after.png")
            assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(preview))
            val targetPoint = compose.onNodeWithTag("drag-overlay-target-$projectId")
                .fetchSemanticsNode().boundsInRoot.center
            source.performTouchInput {
                moveTo(Offset(targetPoint.x - sourceBounds.left, targetPoint.y - sourceBounds.top))
                advanceEventTime(300)
                up()
            }
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == projectId } }
        } finally {
            runBlocking { preferences.set("theme", originalTheme) }
        }
    }

    @Test fun longPressDragMovesTaskBetweenProjectsAndBackToChaosBox() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        val prefs = LocalPreferences(app, app.workspaceScope)
        val originalTheme = runBlocking { prefs.values.first().theme }
        val originId = "internal-project-drag-origin-v1"
        val destinationId = "internal-project-drag-destination-v1"
        val taskId = "internal-project-drag-task-v1"
        try {
            runBlocking {
                val repo = WorkspaceStructureRepository(app)
                repo.saveProject(GenesisProject(originId, null, null, "B Жест — исток", "", emptyList(), "active", 0))
                repo.saveProject(GenesisProject(destinationId, null, null, "A Жест — цель", "", emptyList(), "active", 0))
                val previous = app.repository.get(taskId)
                app.repository.save(LocalTask(id = taskId, title = "Задача между проектами", projectId = originId,
                    revision = previous?.revision ?: 0))
                prefs.set("theme", "Experimental")
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("app-theme-Experimental").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Проекты").performScrollTo().performClick()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("projects-screen").fetchSemanticsNodes().isNotEmpty()
            }
            fun dragTo(targetId: String) {
                val source = compose.onNodeWithTag("drag-task-$taskId", useUnmergedTree = true)
                source.performScrollTo()
                source.assertIsDisplayed()
                val sourceBounds = source.fetchSemanticsNode().boundsInRoot
                source.performTouchInput { down(center); advanceEventTime(700); moveBy(Offset(0f, 4f)) }
                compose.onNodeWithTag("drag-overlay").assertExists()
                val point = compose.onNodeWithTag("drag-overlay-target-$targetId")
                    .fetchSemanticsNode().boundsInRoot.center
                source.performTouchInput {
                    moveTo(Offset(point.x - sourceBounds.left, point.y - sourceBounds.top))
                    advanceEventTime(150)
                    up()
                }
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
            compose.onNodeWithTag("project-drop-$destinationId").performClick()
            dragTo("__genesis_inbox__")
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.projectId == null } }
        } finally {
            runBlocking { prefs.set("theme", originalTheme) }
        }
    }
}
