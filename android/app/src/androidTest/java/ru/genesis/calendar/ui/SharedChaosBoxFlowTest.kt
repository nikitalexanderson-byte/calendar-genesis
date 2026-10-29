package ru.genesis.calendar.ui

import android.content.SharedPreferences
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.PagerTestActivity
import ru.genesis.calendar.auth.SharedWorkspaceGateway
import ru.genesis.calendar.captureNativeWindow
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.data.UiPreferences
import java.io.File
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.math.abs

/** Actual hosted Compose screens; every identity and server response is an isolated fixture. */
class SharedChaosBoxFlowTest {
    @get:Rule val compose = createAndroidComposeRule<PagerTestActivity>()
    private val args get() = InstrumentationRegistry.getArguments()
    private val width get() = args.getString("genesisWidth")?.toIntOrNull() ?: 390
    private val dark get() = args.getString("genesisDark") == "true"
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val testAccount = "review5-shared-${UUID.randomUUID()}"
    private var account by mutableStateOf(testAccount)
    private var displayCalendar by mutableStateOf(CalendarMode.PROFANE)
    private lateinit var displayPreferences: SharedPreferences
    private lateinit var sortKey: String
    private var originalSort: String? = null
    private var hadSort = false

    @Before fun preserveDisplayPreference() {
        val app = context.applicationContext as GenesisApplication
        displayPreferences = app.getSharedPreferences("genesis.task-display.v1", 0)
        sortKey = "${app.workspaceScope}:shared:sort"
        hadSort = displayPreferences.contains(sortKey)
        originalSort = displayPreferences.getString(sortKey, null)
        displayPreferences.edit().remove(sortKey).commit()
    }

    @After fun removeOnlySyntheticPreferences() {
        val layout = context.getSharedPreferences("genesis.shared-inbox-layout.v1", 0)
        val edit = layout.edit()
        layout.all.keys.filter { it.startsWith(testAccount) }.forEach { edit.remove(it) }
        edit.commit()
        displayPreferences.edit().apply {
            if (hadSort) putString(sortKey, originalSort) else remove(sortKey)
        }.commit()
    }

    @Composable private fun Theme(content: @Composable () -> Unit) {
        val density = compose.activity.resources.displayMetrics.widthPixels.toFloat() / width
        CompositionLocalProvider(
            LocalDensity provides Density(density, args.getString("genesisFontScale")?.toFloatOrNull() ?: 1f),
            LocalGenesisLanguage provides "ru", LocalEveningTheme provides dark,
            LocalGenesisUserId provides account
        ) {
            MaterialTheme(colorScheme = if (dark) evening else standart, typography = GenesisTypography, shapes = GenesisShapes) {
                Surface(Modifier.fillMaxSize()) { content() }
            }
        }
    }

    private fun open(fixture: ChaosFixture) {
        compose.setContent { Theme {
            MobileWorkspaceShell("Проекты", null, emptyList(), "Синтетическая проверка", true,
                onNavigate = {}, actions = { CalendarModeSwitcher(displayCalendar,
                    { displayCalendar = nextAvailableCalendarMode(displayCalendar, CalendarMode.entries.toSet()) }, size = 48.dp) }) {
                SharedProjectsScreen(fixture, "ru", preferences = UiPreferences(display = displayCalendar, input = CalendarMode.PROFANE))
            }
        } }
        await("shared-space-${fixture.spaceA}")
    }

    private fun await(tag: String) {
        compose.waitUntil(15_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.waitForIdle()
    }

    private fun click(tag: String, scroll: Boolean = false) {
        await(tag)
        if (scroll) compose.onNodeWithTag(tag).performScrollTo()
        if (tag == "shared-legacy-tasks") {
            compose.onNode(hasClickAction() and hasAnyAncestor(hasTestTag(tag))).performClick()
        } else compose.onNodeWithTag(tag).performClick()
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        captureNativeWindow(File(context.getExternalFilesDir(null),
            "review5-shared-$width-${if (dark) "dark" else "light"}-$name.png"))
    }

    private fun assertPlainInlineInbox() {
        compose.onNodeWithTag("shared-project-inbox").assertExists()
        compose.onNode(hasSetTextAction() and hasAnyAncestor(hasTestTag("shared-project-inbox")), useUnmergedTree = true)
            .assertDoesNotExist()
        compose.onNode(hasTestTag("shared-boards") and hasAnyAncestor(hasTestTag("shared-project-inbox")), useUnmergedTree = true)
            .assertDoesNotExist()
        compose.onNodeWithTag("affairs-page-header").assertDoesNotExist()
    }

    @Test fun spaceContainsOnlyProjectsAndHidesLegacyInboxControls() {
        val fixture = ChaosFixture()
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        await("shared-project-${fixture.projectA}")
        compose.onNodeWithTag("shared-inbox-create-task").assertDoesNotExist()
        compose.onNodeWithTag("shared-project-inbox").assertDoesNotExist()
        compose.onNodeWithTag("shared-task-root-task").assertDoesNotExist()
        compose.onNodeWithTag("shared-legacy-tasks").assertDoesNotExist()
        compose.onNodeWithTag("shared-inbox-list-${fixture.spaceList}").assertDoesNotExist()
        capture("space-projects-only")
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-task-project-a-1")
        assertPlainInlineInbox()
        compose.onNodeWithTag("shared-task-root-task").assertDoesNotExist()
    }

    @Test fun inboxVisibilityRemainsIndependentInsideEachProject() {
        val fixture = ChaosFixture()
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-task-project-a-1")
        assertPlainInlineInbox()
        click("shared-hide-inbox", scroll = true)
        await("shared-show-inbox")
        click("shared-back")
        click("shared-project-${fixture.projectB}", scroll = true)
        await("shared-task-project-b-task")
        assertPlainInlineInbox()
        click("shared-back")
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-show-inbox")
        compose.onNodeWithTag("shared-project-inbox").assertDoesNotExist()
        click("shared-show-inbox", scroll = true)
        compose.onNodeWithTag("shared-task-project-a-1").assertExists()
    }

    @Test fun projectSearchSortAndFiltersUseAFixedDockAndCorrectQueryPages() {
        val fixture = ChaosFixture()
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-task-project-a-1")
        val create = compose.onNodeWithTag("shared-create-task")
            .assert(hasAnyAncestor(hasTestTag("shared-create-actions"))).fetchSemanticsNode().boundsInRoot
        val folder = compose.onNodeWithTag("shared-create-board").fetchSemanticsNode().boundsInRoot
        val tools = listOf("shared-work-actions", "shared-team-actions", "shared-actions").map { tag ->
            compose.onNodeWithTag(tag).assert(hasAnyAncestor(hasTestTag("shared-create-actions"))).fetchSemanticsNode().boundsInRoot
        }
        val row = listOf(create, folder) + tools
        assertTrue("Project actions: plus, folder, task tools, teamwork, settings", row.zipWithNext().all { (left, right) -> left.right <= right.left })
        assertTrue(row.all { abs(it.width - folder.width) <= 1f && abs(it.height - folder.height) <= 1f })
        assertPlainInlineInbox()
        compose.onNodeWithTag("shared-task-project-a-1").assert(hasAnyAncestor(hasTestTag("shared-list-board-todo")))
        compose.onNode(hasTestTag("shared-task-project-a-1") and hasAnyAncestor(hasTestTag("shared-project-inbox"))).assertDoesNotExist()
        compose.onNodeWithTag("shared-task-project-a-3").assertDoesNotExist()
        val dockBefore = compose.onNodeWithTag("shared-task-search-open").fetchSemanticsNode().boundsInRoot
        click("shared-task-more", scroll = true)
        await("shared-task-project-a-3")
        click("shared-task-more", scroll = true)
        await("shared-task-project-a-5")
        compose.onNodeWithTag("shared-task-more").assertDoesNotExist()
        val dockAfter = compose.onNodeWithTag("shared-task-search-open").fetchSemanticsNode().boundsInRoot
        assertTrue("Search must stay fixed during list scrolling", abs(dockBefore.top - dockAfter.top) <= 1.5f)
        assertTrue(fixture.queries.any { it.cursor == "2" } && fixture.queries.any { it.cursor == "4" })
        compose.onNodeWithText("Показано: 5 из 5").assertExists()

        click("shared-task-search-open")
        await("shared-task-search-close")
        val field = compose.onNodeWithTag("shared-task-search").fetchSemanticsNode().boundsInRoot
        val close = compose.onNodeWithTag("shared-task-search-close").fetchSemanticsNode().boundsInRoot
        assertTrue("Search controls must share a vertical center: $field / $close", abs(field.center.y - close.center.y) <= 1.5f)
        compose.onNodeWithTag("shared-task-search")
            .assert(hasAnyAncestor(hasTestTag("shared-task-search-dock")))
        compose.onNode(hasTestTag("shared-task-search-dock") and hasAnyAncestor(hasTestTag("shared-project-inbox")))
            .assertDoesNotExist()
        compose.onNodeWithTag("shared-task-search").performTextReplacement("Бета")
        click("shared-task-search-close")
        compose.waitUntil(15_000) { fixture.queries.any { it.filter.optString("q") == "Бета" && it.cursor == null } }
        await("shared-task-project-a-2")
        compose.onNodeWithTag("shared-task-project-a-1").assertDoesNotExist()
        click("shared-task-search-open")
        await("shared-task-search-close")
        compose.onNodeWithTag("shared-task-search").assertTextContains("Бета")
        click("shared-field-sort")
        click("task-sort-title", scroll = true)
        compose.waitUntil(15_000) { fixture.queries.any { it.sort == "title" && it.filter.optString("q") == "Бета" } }
        click("shared-filters")
        click("shared-filter-completion", scroll = true)
        click("shared-filter-completion-completed")
        click("affairs-apply-filters")
        compose.waitUntil(15_000) {
            fixture.queries.any { it.filter.optString("completion") == "completed" && it.filter.optString("q") == "Бета" && it.sort == "title" }
        }
        await("shared-task-project-a-2")
        capture("project-search-dock")
        click("shared-task-search-close")
        await("shared-task-search-open")
        compose.onNodeWithTag("shared-task-search").assertDoesNotExist()
        click("shared-task-search-open")
        compose.onNodeWithTag("shared-task-search").assertTextContains("Бета")
        compose.onNodeWithTag("shared-filters").assertIsDisplayed()
        compose.onNodeWithTag("shared-field-sort").assertIsDisplayed()
    }

    @Test fun sharedCalendarAndGanttFollowTheSingleHeaderCalendarChoice() {
        val fixture = ChaosFixture()
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        val create = compose.onNodeWithTag("shared-create-project").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("shared-inbox-create-task").assertDoesNotExist()
        val team = compose.onNodeWithTag("shared-space-team").assertHeightIsAtLeast(48.dp).fetchSemanticsNode().boundsInRoot
        val data = compose.onNodeWithTag("shared-space-data").assertHeightIsAtLeast(48.dp).fetchSemanticsNode().boundsInRoot
        assertTrue(create.right <= team.left && team.right <= data.left)
        click("shared-project-${fixture.projectA}", scroll = true)
        for (view in listOf("calendar", "gantt")) {
            click("shared-view-selector")
            click("shared-view-$view")
            val tag = if (view == "calendar") "shared-calendar-period" else "shared-gantt"
            compose.onNodeWithTag(tag).performScrollTo()
            compose.onNodeWithTag(tag).assert(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.StateDescription, displayCalendar.wireValue))
            val before = displayCalendar
            click("calendar-mode-icon-${before.wireValue}")
            compose.onNodeWithTag(tag).assert(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.StateDescription, displayCalendar.wireValue))
            assertNotEquals(before, displayCalendar)
            capture("$view-global-calendar")
        }
    }

    @Test fun viewerSeesTaskRowsButNoCreationCompletionOrStatusMutationControls() {
        val fixture = ChaosFixture(viewer = true)
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        compose.onNodeWithTag("shared-project-inbox").assertDoesNotExist()
        compose.onNodeWithTag("shared-legacy-tasks").assertDoesNotExist()
        compose.onNodeWithTag("shared-task-root-task").assertDoesNotExist()
        compose.onNode(hasContentDescription("Изменить статус") and hasAnyAncestor(hasTestTag("shared-project-inbox")))
            .assertDoesNotExist()
        compose.onNodeWithTag("shared-inbox-create-task").assertDoesNotExist()
        compose.onNodeWithTag("shared-inbox-create-list").assertDoesNotExist()
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-task-project-a-1")
        compose.onNodeWithTag("shared-create-task").assertDoesNotExist()
        compose.onNodeWithContentDescription("Завершить задачу: Альфа — первый шаг").assertDoesNotExist()
        compose.onNode(hasContentDescription("Изменить статус") and hasAnyAncestor(hasTestTag("shared-project-inbox")))
            .assertDoesNotExist()
        click("shared-task-search-open")
        compose.onNodeWithTag("shared-field-sort").assertIsDisplayed()
        compose.onNodeWithTag("shared-filters").assertIsDisplayed()
        capture("viewer-project")
        assertEquals(0, fixture.mutations)
    }

    private data class Query(val filter: JSONObject, val cursor: String?, val sort: String)

    @Test fun toolbarFitsWithoutScrollingAndLongPressDropsOnTheBoardItself() {
        val fixture = ChaosFixture(allowMove = true)
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        click("shared-project-${fixture.projectA}", scroll = true)
        await("shared-create-actions")
        val row = compose.onNodeWithTag("shared-create-actions").fetchSemanticsNode().boundsInRoot
        val tags = listOf("shared-mindmaps-open", "shared-view-selector", "shared-create-task", "shared-create-board", "shared-work-actions", "shared-team-actions", "shared-actions")
        val buttons = tags.map { compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot }
        assertEquals(7, buttons.size)
        buttons.forEach { assertTrue(it.left >= row.left - 1 && it.right <= row.right + 1); assertEquals(buttons.first().width, it.width, 2f) }
        click("shared-view-selector"); click("shared-view-board")
        compose.onNodeWithTag("shared-boards").performScrollTo()
        await("shared-task-project-a-1")
        val source = compose.onNodeWithTag("shared-task-project-a-1").fetchSemanticsNode().boundsInRoot
        val target = compose.onNodeWithTag("shared-board-done").fetchSemanticsNode().boundsInRoot
        // Drop in the visible left edge of the next board, above the detached drop panel.
        val drop = androidx.compose.ui.geometry.Offset(target.left + 12f, target.top + 70f)
        compose.onNodeWithTag("shared-task-project-a-1").performTouchInput {
            down(androidx.compose.ui.geometry.Offset(30f, 30f))
        }
        compose.mainClock.advanceTimeBy(800)
        compose.onNodeWithTag("shared-task-project-a-1").performTouchInput {
            moveTo(drop - source.topLeft, 400); up()
        }
        compose.waitUntil(10_000) { fixture.mutations > 0 }
        assertEquals("done", fixture.lastMove?.getString("statusId"))
        assertEquals("project-a-1", fixture.lastMovedTask)
        assertEquals(1, fixture.lastMove?.getInt("expectedRevision"))
        capture("board-direct-drop-and-toolbar")
    }

    @Test fun listLongPressDropsOnTheActualListWithoutASubstituteTray() {
        val fixture=ChaosFixture(allowMove=true)
        open(fixture)
        click("shared-space-${fixture.spaceA}")
        click("shared-project-${fixture.projectA}",scroll=true)
        await("shared-list-board-todo")
        compose.onNodeWithTag("shared-task-project-a-1").performScrollTo()
        val source=compose.onNodeWithTag("shared-task-project-a-1").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("shared-task-project-a-1").performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(800)
        // Scroll the actual list while the task is held, then release over its header.
        compose.onNodeWithTag("shared-list-board-done").performScrollTo()
        val target=compose.onNodeWithTag("shared-list-board-done").fetchSemanticsNode().boundsInRoot
        val currentSource=compose.onNodeWithTag("shared-task-project-a-1").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("shared-task-project-a-1").performTouchInput {
            moveTo(androidx.compose.ui.geometry.Offset(target.center.x,target.top+30f)-currentSource.topLeft,400);up()
        }
        compose.waitUntil(10000) { fixture.mutations>0 }
        assertEquals("done",fixture.lastMove?.getString("statusId"))
        assertEquals("project-a-1",fixture.lastMovedTask)
        assertEquals(1,fixture.lastMove?.getInt("expectedRevision"))
        compose.onAllNodes(hasTestTag("shared-drop-project:${fixture.projectA}")).assertCountEquals(0)
        capture("list-direct-drop")
    }

    private class ChaosFixture(private val viewer: Boolean = false, private val allowMove: Boolean = false) : SharedWorkspaceGateway {
        val spaceA = "chaos-space-a"
        val spaceB = "chaos-space-b"
        val inboxA = "chaos-inbox-a"
        private val inboxB = "chaos-inbox-b"
        val projectA = "chaos-project-a"
        val projectB = "chaos-project-b"
        val spaceList = "chaos-space-list"
        val projectList = "chaos-project-list"
        val queries = CopyOnWriteArrayList<Query>()
        val taskReads = CopyOnWriteArrayList<Pair<String, String>>()
        var mutations = 0
        var lastMove: JSONObject? = null
        var lastMovedTask = ""
        private val expanded = mutableMapOf<String, List<String>>()
        private val role get() = if (viewer) "viewer" else "owner"
        private val containers get() = listOf(
            project(inboxA, "Хаос-бокс", spaceA, inbox = true), project(inboxB, "Хаос-бокс", spaceB, inbox = true),
            project(projectA, "Проект Альфа", spaceA), project(projectB, "Проект Бета", spaceA),
            project(spaceList, "Входящий список", spaceA, inboxA, kind = "task-list"),
            project(projectList, "Проверка проекта", spaceA, projectA, kind = "task-list")
        )
        private val tasks = listOf(
            task("root-task", inboxA, "Мысль без проекта"), task("space-b-task", inboxB, "Мысль второй команды"),
            task("space-list-task", spaceList, "Пункт входящего списка"),
            task("project-a-1", projectA, "Альфа — первый шаг"), task("project-a-2", projectA, "Бета — готовый результат", done = true),
            task("project-a-3", projectA, "Гамма — следующий шаг"), task("project-a-4", projectA, "Дельта — проверка"),
            task("project-a-5", projectA, "Эпсилон — завершение"), task("project-b-task", projectB, "Отдельная задача проекта Бета"),
            task("project-list-task", projectList, "Пункт проектного списка")
        )

        private fun project(id: String, title: String, space: String, parent: String? = null,
            kind: String = "project", inbox: Boolean = false) = JSONObject()
            .put("id", id).put("spaceId", space).put("title", title).put("description", "")
            .put("parentId", parent ?: JSONObject.NULL).put("kind", kind).put("layout", "list")
            .put("isInbox", if (inbox) 1 else 0).put("role", role).put("spaceRole", if (viewer) "guest" else "owner")
            .put("revision", 1).put("taskCount", if (id == projectA) 5 else 1)
            .put("canOrganizeTasks", !viewer).put("permissions", JSONObject().put("editTasks", !viewer).put("createProjects", !viewer))
            .put("planning", JSONObject().put("enabled", false).put("estimateUnit", "points").put("revision", 1))

        private fun task(id: String, project: String, title: String, done: Boolean = false) = JSONObject()
            .put("id", id).put("projectId", project).put("spaceId", if (project == inboxB) spaceB else spaceA)
            .put("title", title).put("description", "Текст синтетической задачи").put("statusId", if (done) "done" else "todo")
            .put("revision", 1).put("priority", 0).put("position", 0).put("dueDate", JSONObject.NULL)
            .put("assigneeId", JSONObject.NULL).put("categoryId", JSONObject.NULL).put("archivedAt", JSONObject.NULL)
            .put("parentTaskId", JSONObject.NULL).put("completedAt", if (done) "2026-10-27T00:00:00Z" else JSONObject.NULL)
            .put("checklists", JSONArray()).put("attachments", JSONArray()).put("customFields", JSONObject())

        override suspend fun sharedSpaces() = JSONObject().put("spaces", JSONArray().apply {
            listOf(spaceA to "Команда Альфа", spaceB to "Команда Бета").forEach { (id, title) ->
                put(JSONObject().put("id", id).put("title", title).put("role", if (viewer) "guest" else "owner"))
            }
        })
        override suspend fun sharedProjects(spaceId: String) = JSONObject()
            .put("projects", JSONArray(containers.filter { it.getString("spaceId") == spaceId }))
        override suspend fun archivedSharedProjects(spaceId: String) = JSONObject().put("projects", JSONArray())
        override suspend fun sharedInvitations() = JSONObject().put("invitations", JSONArray())
        override suspend fun sharedSpaceUi(spaceId: String) = JSONObject().put("expandedIds", JSONArray(expanded[spaceId].orEmpty()))
        override suspend fun saveSharedSpaceUi(spaceId: String, ids: List<String>): JSONObject {
            expanded[spaceId] = ids.toList()
            return sharedSpaceUi(spaceId)
        }
        override suspend fun flushSharedOfflineTasks() = 0
        override suspend fun queuedSharedTasks(projectId: String) = emptyList<JSONObject>()
        override suspend fun sharedProject(projectId: String) = JSONObject()
            .put("project", containers.first { it.getString("id") == projectId })
            .put("statuses", JSONArray().put(JSONObject().put("id", "todo").put("title", "К выполнению").put("isDone", 0).put("revision", 1).put("position", 0))
                .put(JSONObject().put("id", "done").put("title", "Готово").put("isDone", 1).put("revision", 1).put("position", 1)))
            .put("tasks", JSONArray(tasks.filter { it.getString("projectId") == projectId }))
            .put("members", JSONArray()).put("spaceMembers", JSONArray()).put("categories", JSONArray()).put("customFieldDefinitions", JSONArray())
        override suspend fun sharedTask(projectId: String, taskId: String): JSONObject {
            taskReads += projectId to taskId
            return JSONObject().put("task", JSONObject(tasks.first { it.getString("id") == taskId && it.getString("projectId") == projectId }.toString()))
        }
        override suspend fun sharedComments(projectId: String, taskId: String) = JSONObject().put("comments", JSONArray())
        override suspend fun sharedTaskWatch(projectId: String, taskId: String, watching: Boolean?) = JSONObject().put("watching", watching ?: false)
        override suspend fun sharedTaskSeries(project: String, task: String) = JSONObject().put("series", JSONObject.NULL)
        override suspend fun sharedGoogleSettings(projectId: String) = JSONObject().put("settings", JSONObject())
        override suspend fun sortedSharedTasks(filter: JSONObject, cursor: String?, sort: String): JSONObject {
            queries += Query(JSONObject(filter.toString()), cursor, sort)
            fun accepts(key: String, value: String) = filter.optJSONArray(key)?.let { ids ->
                (0 until ids.length()).any { ids.optString(it) == value }
            } ?: true
            var matching = tasks.filter {
                accepts("projectIds", it.getString("projectId")) && accepts("statusIds", it.getString("statusId")) &&
                    it.getString("title").contains(filter.optString("q"), ignoreCase = true) &&
                    (!filter.has("parentTaskId") || it.optString("parentTaskId") == filter.getString("parentTaskId")) &&
                    when (filter.optString("completion", "any")) {
                        "completed" -> it.getString("statusId") == "done"
                        "open" -> it.getString("statusId") != "done"
                        else -> true
                    }
            }
            if (sort == "title") matching = matching.sortedBy { it.getString("title") }
            val offset = cursor?.toInt() ?: 0
            val page = matching.drop(offset).take(2)
            val next = offset + page.size
            return JSONObject().put("tasks", JSONArray(page.map { JSONObject(it.toString()) })).put("total", matching.size)
                .put("queryVersion", "chaos-fixture-v1").put("hasMore", next < matching.size)
                .put("nextCursor", if (next < matching.size) next.toString() else JSONObject.NULL)
        }
        override suspend fun moveSharedTask(projectId: String, taskId: String, changes: JSONObject): JSONObject {
            check(allowMove && !viewer)
            val task = tasks.first { it.getString("id") == taskId && it.getString("projectId") == projectId }
            check(task.getInt("revision") == changes.getInt("expectedRevision"))
            lastMove = JSONObject(changes.toString()); lastMovedTask = taskId
            task.put("projectId", changes.getString("destinationProjectId")).put("statusId", changes.getString("statusId")).put("revision", task.getInt("revision") + 1)
            mutations++
            return JSONObject().put("task", JSONObject(task.toString()))
        }
    }
}
