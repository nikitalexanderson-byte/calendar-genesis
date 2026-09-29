package ru.genesis.calendar

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*
import ru.genesis.calendar.ui.completedTaskInk

/** Real interactions in the debug workspace; never changes a signed-in account. */
class MobilePolishTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()
    private val app get() = compose.activity.application as GenesisApplication

    @Before fun requireDebugWorkspace() {
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        app.activateAccount(null)
        check(app.workspaceScope == "internal-validation-v1")
        compose.runOnUiThread { compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        runBlocking { LocalPreferences(app, app.workspaceScope).set("language", "ru") }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("app-theme-Standart").fetchSemanticsNodes().isNotEmpty() }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(app.getExternalFilesDir(null), "2.3.4-$name.png")))
    }

    @Test fun completionIsGreyAndStruckThroughAndCanBeUndone() {
        val taskId = "mobile-polish-completion-${UUID.randomUUID()}"
        runBlocking {
            val old = app.repository.get(taskId)
            app.repository.save(LocalTask(id = taskId, title = "Проверить выполненную задачу",
                date = LocalDate.now().toString(), revision = old?.revision ?: 0))
        }
        try {
            compose.onNodeWithTag("navigation-Задачи").performScrollTo().performClick()
            compose.onNodeWithTag("tasks-screen").performScrollToNode(hasTestTag("task-$taskId"))
            val checkbox = compose.onNode(isToggleable() and hasAnyAncestor(hasTestTag("task-$taskId")), useUnmergedTree = true)
            checkbox.assertIsOff().performClick()
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.done == true } }
            compose.onNodeWithTag("tasks-screen").performScrollToNode(hasTestTag("task-$taskId"))
            checkbox.assertIsDisplayed().assertIsOn()
            val layouts = mutableListOf<TextLayoutResult>()
            compose.onNodeWithTag("task-title-$taskId", useUnmergedTree = true)
                .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertEquals(TextDecoration.LineThrough, layouts.single().layoutInput.style.textDecoration)
            assertEquals(completedTaskInk, layouts.single().layoutInput.style.color)
            capture("completed-task")
            checkbox.performClick()
            compose.waitUntil(10_000) { runBlocking { app.repository.get(taskId)?.done == false } }
            compose.onNodeWithTag("tasks-screen").performScrollToNode(hasTestTag("task-$taskId"))
            layouts.clear()
            compose.onNodeWithTag("task-title-$taskId", useUnmergedTree = true)
                .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertEquals(TextDecoration.None, layouts.single().layoutInput.style.textDecoration)
        } finally { runBlocking { app.repository.delete(taskId) } }
    }

    @Test fun taskCloseRemainsAtTopRightAfterScrollingAndDoesNotSaveDraft() {
        val draft = "Несохранённая задача полировки"
        compose.onNodeWithTag("navigation-Задачи").performScrollTo().performClick()
        compose.onNodeWithTag("create-task").performClick()
        compose.onNodeWithTag("create-task-choice").performClick()
        compose.onNodeWithTag("task-title").performTextInput(draft)
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        val close = compose.onNodeWithTag("close-task-editor")
        close.assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        val title = compose.onNodeWithText("Новая задача").fetchSemanticsNode().boundsInRoot
        assertTrue(close.fetchSemanticsNode().boundsInRoot.left >= title.right)
        capture("task-editor-top")
        val before = close.fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("save-task").performScrollTo()
        close.assertIsDisplayed()
        assertEquals(before, close.fetchSemanticsNode().boundsInRoot)
        capture("task-editor-scrolled")
        close.performClick()
        compose.onNodeWithTag("task-title").assertDoesNotExist()
        assertFalse(runBlocking { app.repository.tasks.first().any { it.title == draft } })
    }

    @Test fun projectCloseDiscardsDraftAndSecondClickCollapsesProject() {
        val projectId = "mobile-polish-project"
        val projectTitle = "A Проект проверки сворачивания"
        runBlocking { WorkspaceStructureRepository(app).saveProject(
            GenesisProject(projectId, null, null, projectTitle, "Описание раскрытого проекта", emptyList(), "active", 0)) }
        compose.onNodeWithText("Проекты").performScrollTo().performClick()
        compose.onNodeWithTag("create-project").performClick()
        compose.onNodeWithTag("project-title").performTextInput("Несохранённый проект полировки")
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
        val close = compose.onNodeWithTag("close-project-editor")
        close.assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        val title = compose.onNodeWithText("Новый проект").fetchSemanticsNode().boundsInRoot
        assertTrue(close.fetchSemanticsNode().boundsInRoot.left >= title.right)
        capture("project-editor-top")
        val before = close.fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("save-project").performScrollTo()
        close.assertIsDisplayed()
        assertEquals(before, close.fetchSemanticsNode().boundsInRoot)
        close.performClick()
        compose.onNodeWithTag("project-title").assertDoesNotExist()
        assertFalse(runBlocking { WorkspaceStructureRepository(app).workspace.first().projects
            .any { it.title == "Несохранённый проект полировки" } })
        compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$projectId"))
        // Click the title as a user does; the expanded card also contains task buttons.
        val project = compose.onNodeWithText(projectTitle, useUnmergedTree = true)
        project.performClick()
        compose.onNodeWithTag("delete-project-$projectId").assertExists()
        capture("project-expanded")
        project.performClick()
        compose.onNodeWithTag("delete-project-$projectId").assertDoesNotExist()
        capture("project-collapsed")
        project.performClick()
        compose.onNodeWithTag("delete-project-$projectId").assertExists()
    }
}
