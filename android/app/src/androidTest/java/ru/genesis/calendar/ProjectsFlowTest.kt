package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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
            compose.onNodeWithText("Отмена").performClick()
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
}
