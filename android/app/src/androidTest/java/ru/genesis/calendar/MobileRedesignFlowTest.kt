package ru.genesis.calendar

import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.os.Build
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.domain.habits.HabitEngine
import ru.genesis.calendar.domain.habits.TrackerEntity
import ru.genesis.calendar.ui.AppearanceSettings
import ru.genesis.calendar.ui.GenesisApp

/** Actual shell, encrypted local repositories and synthetic data; never enters a user account. */
class MobileRedesignFlowTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()
    @get:Rule val testName = TestName()
    private val args get() = InstrumentationRegistry.getArguments()
    private val width get() = args.getString("genesisWidth")?.toIntOrNull() ?: 411
    private val dark get() = args.getString("genesisDark") == "true"
    private val fontScale get() = args.getString("genesisFontScale")?.toFloatOrNull() ?: 1f
    private val app get() = compose.activity.application as GenesisApplication
    private val device get() = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    private val token = UUID.randomUUID().toString()
    private val projectId = "mobile3-project-$token"
    private val secondProjectId = "mobile3-second-$token"
    private val habitId = "mobile3-habit-$token"
    private val todayTaskId = "mobile3-today-$token"
    private val tomorrowTaskId = "mobile3-tomorrow-$token"
    private val inboxTaskId = "mobile3-inbox-$token"
    private val ownedTasks = mutableSetOf(todayTaskId, tomorrowTaskId, inboxTaskId)
    private lateinit var previousPrefs: UiPreferences
    private lateinit var previousHabitSettings: HabitSettings
    private val checks = JSONArray()
    private val images = JSONArray()
    private var seeded = false
    private val folder get() = File(app.getExternalFilesDir(null), "3.0-captures").apply { mkdirs() }
    private val orientation get() = if (compose.activity.resources.displayMetrics.widthPixels > compose.activity.resources.displayMetrics.heightPixels) "landscape" else "portrait"
    private val suffix get() = "${width}-${if (dark) "dark" else "light"}-font${(fontScale * 100).toInt()}-$orientation"
    private data class Route(val page: String, val section: String?, val title: String) {
        val tag get() = "drawer-$page-${section ?: "root"}"
    }
    private val todayRoute = Route("Сегодня", null, "Сегодня")
    private val monthRoute = Route("Календарь", "month", "Календарь · месяц")
    private val yearRoute = Route("Календарь", "year", "Календарь · год")
    private val personalRoute = Route("Проекты", "personal-projects", "Дела — личные")
    private val routes = listOf(todayRoute, monthRoute, yearRoute, personalRoute,
        Route("Привычки", "Привычки", "Привычки"),
        Route("Привычки", "Сон и настроение", "Сон и настроение"),
        Route("Сакральное", "stoicheion", "Стойхейон"),
        Route("Сакральное", "theokyklos", "Теокиклос"),
        Route("Настройки", "appearance", "Оформление"),
        Route("Настройки", "habits", "Настройки привычек"),
        Route("Настройки", "reminders", "Напоминания"),
        Route("Настройки", "shared", "Общие проекты"),
        Route("Настройки", "region", "Регион"),
        Route("Настройки", "account", "Аккаунт GENESIS"),
        Route("Настройки", "links", "Ссылки"))

    @Before fun seedOnlyGuardedLocalWorkspace() {
        args.getString("genesisLandscape")?.let { value ->
            val landscape = value == "true"
            compose.runOnUiThread {
                compose.activity.requestedOrientation = if (landscape)
                    android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                else android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
            compose.waitUntil(10_000) {
                compose.activity.resources.displayMetrics.let { (it.widthPixels > it.heightPixels) == landscape }
            }
        }
        check(BuildConfig.DEBUG && app.packageName.endsWith(".debug"))
        check(app.workspaceScope == "internal-validation-v1") {
            "Refusing to switch or mutate an account workspace"
        }
        require(width in 320..1600 && fontScale in 1f..2f)
        runBlocking {
            val prefs = LocalPreferences(app, app.workspaceScope)
            previousPrefs = prefs.values.first()
            val habits = HabitsRepository(app)
            previousHabitSettings = habits.workspace.first().settings
            prefs.set("language", "ru")
            prefs.set("display", "profane")
            prefs.set("input", "profane")
            prefs.set("gregorianYearStart", "january")
            prefs.set("theme", if (dark) "standart-dark" else "standart")
            prefs.set("navigationLabels", "text")
            prefs.set("settingsSubmenuEnabled", "true")
            habits.updateSettings(previousHabitSettings.copy(enabled = true))
            habits.updateAppearance(AppearanceSettings(mode = if (dark) "evening" else "light").json())
            val structure = WorkspaceStructureRepository(app)
            structure.saveProject(GenesisProject(projectId, null, null, "Пробная версия · мой проект",
                "Синтетический проект для проверки возвращения в контекст", emptyList(), "active", 0))
            structure.saveProject(GenesisProject(secondProjectId, null, null, "Идеи и заметки",
                "Только тестовые данные", emptyList(), "active", 1))
            val date = LocalDate.now()
            app.repository.save(LocalTask(todayTaskId, "План сегодняшнего дня", date = date.toString(), projectId = projectId))
            app.repository.save(LocalTask(tomorrowTaskId, "Задача только на завтра", date = date.plusDays(1).toString(), projectId = secondProjectId))
            app.repository.save(LocalTask(inboxTaskId, "Разобрать входящие идеи", date = ""))
            habits.save(Habit(TrackerEntity.create("habit", id = habitId), "Ежедневное чтение", date,
                HabitEngine(GenesisCalendar()).defaultSchedule(date, CalendarMode.PROFANE)))
            seeded = true
        }
        bindViewport()
        await("workspace-menu")
        await(if (dark) "app-theme-Evening" else "app-theme-Standart")
    }

    private fun bindViewport() {
        compose.runOnUiThread {
            compose.activity.setContent {
                val density = compose.activity.resources.displayMetrics.widthPixels.toFloat() / width
                val config = Configuration(LocalConfiguration.current).apply {
                    screenWidthDp = width
                    screenHeightDp = (compose.activity.resources.displayMetrics.heightPixels / density).toInt()
                    this.fontScale = this@MobileRedesignFlowTest.fontScale
                }
                CompositionLocalProvider(LocalDensity provides Density(density, fontScale),
                    LocalConfiguration provides config) {
                    GenesisApp(app, null, testWorkspace = true)
                }
            }
        }
        compose.waitForIdle()
    }

    private fun await(tag: String) = compose.waitUntil(15_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
    private fun exists(tag: String) = compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    private fun drawerClosed() {
        compose.waitUntil(5_000) { !compose.onNodeWithTag("workspace-drawer").isDisplayed() }
        compose.onNodeWithTag("app-account-status").assertIsNotDisplayed()
    }
    private fun openDrawer() {
        if (!compose.onNodeWithTag("workspace-drawer").isDisplayed())
            compose.onNodeWithTag("workspace-menu").performClick()
        compose.waitUntil(5_000) { compose.onNodeWithTag("workspace-drawer").isDisplayed() }
    }
    private fun navigate(route: Route, assertSelection: Boolean = true) {
        openDrawer()
        compose.onNodeWithTag(route.tag).performScrollTo().performClick()
        drawerClosed()
        compose.onNodeWithTag("workspace-title").assertTextEquals(route.title)
        if (assertSelection) {
            openDrawer()
            compose.onNodeWithTag(route.tag).performScrollTo().assertIsSelected()
            compose.onNodeWithTag("drawer-close").performScrollTo().performClick()
            drawerClosed()
        }
        checks.put("route:${route.tag}")
    }
    private fun capture(scene: String) {
        compose.waitForIdle()
        val image = compose.onRoot().captureToImage()
        assertTrue("Empty bitmap for $scene", image.width > 0 && image.height > 0)
        val pixels = image.toPixelMap()
        val colors = mutableSetOf<Int>()
        for (y in 0 until pixels.height step maxOf(1, pixels.height / 24))
            for (x in 0 until pixels.width step maxOf(1, pixels.width / 24))
                colors += pixels[x, y].hashCode()
        assertTrue("Blank screenshot for $scene", colors.size > 3)
        val target = File(folder, "$suffix-$scene.png")
        target.outputStream().use {
            assertTrue(image.asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it))
            it.fd.sync() // Preserve diagnostic PNGs even if the host emulator later crashes.
        }
        assertTrue("PNG was not written for $scene", target.length() > 1024)
        images.put(target.name)
    }
    private fun checkTarget(tag: String) {
        val node = compose.onNodeWithTag(tag).assertIsDisplayed().fetchSemanticsNode()
        val bounds = node.boundsInRoot
        val density = node.layoutInfo.density.density
        assertTrue("$tag width is ${bounds.width / density}dp", bounds.width + 1 >= 48 * density)
        assertTrue("$tag height is ${bounds.height / density}dp", bounds.height + 1 >= 48 * density)
        checks.put("48dp:$tag")
    }
    private fun text(tag: String) = compose.onNodeWithTag(tag).fetchSemanticsNode()
        .config[SemanticsProperties.Text].joinToString(" ") { it.text }
    private fun assertActualToday() {
        compose.scrollToTodayNode(hasTestTag("today-civil-date"))
        compose.onNodeWithTag("today-civil-date").assertTextEquals(LocalDate.now().format(
            java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy", java.util.Locale.forLanguageTag("ru"))))
        checks.put("today:actual-date")
    }
    private fun projectCard() = compose.onNodeWithTag("project-drop-$projectId")
    private fun showProject() {
        compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$projectId"))
        if (compose.onAllNodesWithText("Синтетический проект для проверки возвращения в контекст").fetchSemanticsNodes().isEmpty())
            projectCard().performClick()
        compose.onNodeWithText("Синтетический проект для проверки возвращения в контекст").assertExists()
    }

    @Test fun drawerRoutesDismissalTargetsAndSnapshots() {
        // Save diagnostic frames before assertions so a failure still leaves reviewable UI.
        capture("today")
        openDrawer()
        capture("drawer")
        device.pressBack()
        drawerClosed()
        listOf("main-navigation-icons", "main-navigation-rail", "main-navigation-text", "main-navigation-pager")
            .forEach { compose.onNodeWithTag(it).assertDoesNotExist() }
        checkTarget("workspace-menu")
        checkTarget("voice-assistant-open")
        assertActualToday()
        capture("today")
        openDrawer()
        compose.onNodeWithTag(todayRoute.tag).assertIsSelected()
        compose.onNodeWithTag("app-account-status").assert(hasAnyAncestor(hasTestTag("workspace-drawer")))
        compose.onNodeWithTag("drawer-Проекты-shared").assertDoesNotExist()
        capture("drawer")
        device.pressBack()
        drawerClosed()
        openDrawer()
        val outsideBounds = compose.onRoot().fetchSemanticsNode().boundsInRoot
        compose.onRoot().performTouchInput { click(Offset(outsideBounds.width - 2f, outsideBounds.height / 2f)) }
        drawerClosed()
        checks.put("drawer:button-back-outside-select-dismissal")
        for (route in routes) {
            navigate(route)
            when (route) {
                monthRoute -> {
                    await("calendar-month")
                    compose.onNodeWithTag("calendar-month-description").assertDoesNotExist()
                    checkTarget("calendar-month-today")
                    capture("calendar-month")
                    compose.onNodeWithTag("calendar-month-info-toggle").performClick()
                    compose.onNodeWithTag("calendar-month-description").assertExists()
                    compose.onNodeWithTag("calendar-month-info-toggle").performClick()
                }
                yearRoute -> {
                    await("calendar-year-panel")
                    compose.onNodeWithTag("calendar-year-solar-points").assertDoesNotExist()
                    checkTarget("calendar-year-today")
                    capture("calendar-year")
                    compose.onNodeWithTag("calendar-year-solar-toggle").performClick()
                    compose.onNodeWithTag("calendar-year-solar-points").assertExists()
                    compose.onNodeWithTag("calendar-year-solar-toggle").performClick()
                }
                personalRoute -> { await("projects-screen"); capture("personal") }
                else -> when {
                    route.page == "Дневник" -> capture("diary")
                    route.page == "Привычки" && route.section == "Привычки" -> {
                        val create = compose.onNodeWithTag("habit-create").fetchSemanticsNode().boundsInRoot
                        val catalogue = compose.onNodeWithTag("habit-catalogue").fetchSemanticsNode().boundsInRoot
                        assertTrue("Habit actions must stay aligned at the current font scale", kotlin.math.abs(create.height - catalogue.height) <= 1f)
                        checks.put("habits:actions-equal-height")
                        capture("habits")
                    }
                    route.section == "Сон и настроение" -> capture("sleep")
                    route.page == "Настройки" && route.section == "appearance" -> capture("settings")
                }
            }
        }
        navigate(todayRoute)
        runBlocking { LocalPreferences(app, app.workspaceScope).set("navigationLabels", "icons") }
        compose.waitForIdle()
        openDrawer()
        compose.onNodeWithTag(monthRoute.tag).performScrollTo().assertContentDescriptionEquals(monthRoute.title)
        compose.onNode(hasText(monthRoute.title) and hasAnyAncestor(hasTestTag(monthRoute.tag))).assertDoesNotExist()
        compose.onNodeWithTag("drawer-close").performScrollTo().performClick()
        drawerClosed()
        checks.put("drawer:icons-have-accessible-names")
    }

    @Test fun calendarAndProjectContextsSurviveDrawerRoundTrips() {
        navigate(monthRoute)
        compose.onNodeWithTag("calendar-month-next").performScrollTo().performClick()
        val month = text("calendar-month-period")
        navigate(todayRoute)
        assertActualToday()
        compose.scrollToTodayNode(hasTestTag("today-tasks-section"))
        compose.onNodeWithTag("task-$todayTaskId").assertExists()
        compose.onNodeWithTag("task-$tomorrowTaskId").assertDoesNotExist()
        navigate(monthRoute)
        compose.onNodeWithTag("calendar-month-period").assertTextEquals(month)
        compose.onNodeWithTag("calendar-month-today").performClick()
        val actualMonth = LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern(
            "LLLL yyyy", java.util.Locale.forLanguageTag("ru"))).replaceFirstChar { it.titlecase(java.util.Locale.forLanguageTag("ru")) }
        compose.onNodeWithTag("calendar-month-period").assertTextEquals(actualMonth)
        navigate(yearRoute)
        compose.onNodeWithTag("calendar-year-next").performScrollTo().performClick()
        val year = text("calendar-year-period")
        navigate(todayRoute)
        navigate(yearRoute)
        compose.onNodeWithTag("calendar-year-period").assertTextEquals(year)
        compose.onNodeWithTag("calendar-year-today").performClick()
        compose.onNodeWithTag("calendar-year-period").assertTextEquals(LocalDate.now().year.toString())
        navigate(personalRoute)
        showProject()
        compose.onNodeWithTag("personal-task-search").performTextInput("План")
        navigate(todayRoute)
        navigate(personalRoute)
        compose.onNodeWithTag("personal-task-search").assert(SemanticsMatcher.expectValue(
            SemanticsProperties.EditableText, AnnotatedString("План")))
        compose.onNodeWithTag("personal-task-search").performTextClearance()
        showProject()
        navigate(todayRoute)
        navigate(personalRoute)
        compose.onNodeWithText("Синтетический проект для проверки возвращения в контекст").assertExists()
        checks.put("state:month-year-project-search-roundtrip")
    }

    @Test fun offlineTaskDraftEditCompleteAndActivityRestartPreserveEncryptedData() {
        assumeTrue("Offline network toggles are restricted to an emulator", Build.HARDWARE in listOf("ranchu", "goldfish"))
        val oldWifi = device.executeShellCommand("settings get global wifi_on").trim() == "1"
        val oldData = device.executeShellCommand("settings get global mobile_data").trim() == "1"
        try {
            device.executeShellCommand("svc wifi disable")
            device.executeShellCommand("svc data disable")
            val connectivity = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            compose.waitUntil(10_000) { connectivity.activeNetwork == null }
            checks.put("network:offline-confirmed")
            navigate(personalRoute)
            showProject()
            compose.onNode(hasText("Добавить задачу") and hasAnyAncestor(hasTestTag("project-drop-$projectId")))
                .performScrollTo().performClick()
            await("task-title")
            val title = "Новая задача пробной версии ${token.take(6)}"
            compose.onNodeWithTag("task-title").performTextInput(title)
            compose.onNodeWithTag("save-task").assertIsDisplayed()
            device.pressBack()
            compose.waitForIdle()
            if (exists("keep-task-draft")) compose.onNodeWithTag("keep-task-draft").performClick()
            compose.onNodeWithTag("close-task-editor").performClick()
            compose.onNodeWithTag("keep-task-draft").assertIsDisplayed().performClick()
            compose.onNodeWithTag("task-title").assert(SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText, AnnotatedString(title)))
            compose.onNodeWithTag("save-task").assertIsDisplayed().performClick()
            compose.waitUntil(10_000) { !exists("task-title") }
            var saved: LocalTask? = null
            compose.waitUntil(10_000) { runBlocking { app.repository.tasks.first().firstOrNull { it.title == title }
                .also { saved = it } != null } }
            val task = requireNotNull(saved)
            ownedTasks += task.id
            assertEquals(projectId, task.projectId)
            val row = runBlocking { requireNotNull(app.database.dao().task(app.workspaceScope, task.id)) }
            assertFalse("Task title leaked into encrypted storage", row.encrypted.contains(title))
            assertEquals(title, LocalTask.from(row, LocalCipher().decrypt(row.encrypted, "${app.workspaceScope}/${task.id}")).title)
            showProject()
            capture("task-created")
            compose.onNodeWithTag("drag-task-${task.id}", useUnmergedTree = true).performScrollTo()
            compose.onNodeWithText(title).performClick()
            await("task-title")
            val edited = "$title · изменена"
            compose.onNodeWithTag("task-title").performTextReplacement(edited)
            device.pressBack()
            compose.waitForIdle()
            if (exists("keep-task-draft")) compose.onNodeWithTag("keep-task-draft").performClick()
            compose.onNodeWithTag("save-task").assertIsDisplayed().performClick()
            compose.waitUntil(10_000) { runBlocking { app.repository.get(task.id)?.title == edited } }
            showProject()
            compose.onNodeWithTag("drag-task-${task.id}", useUnmergedTree = true).performScrollTo()
            compose.onNode(hasContentDescription("Выполнить задачу") and hasAnyAncestor(hasTestTag("drag-task-${task.id}")),
                useUnmergedTree = true)
                .performClick()
            compose.waitUntil(10_000) { runBlocking { app.repository.get(task.id)?.done == true } }
            compose.activityRule.scenario.recreate()
            compose.waitForIdle()
            bindViewport()
            await("workspace-menu")
            navigate(personalRoute)
            showProject()
            compose.onNodeWithTag("drag-task-${task.id}", useUnmergedTree = true).performScrollTo()
            compose.onNodeWithText(edited).assertExists()
            val reopened = Room.databaseBuilder(app, GenesisDatabase::class.java, "genesis.db").build()
            try {
                val persisted = runBlocking { requireNotNull(reopened.dao().task(app.workspaceScope, task.id)) }
                assertTrue(persisted.done)
                assertFalse(persisted.encrypted.contains(edited))
                assertEquals(edited, LocalTask.from(persisted, LocalCipher().decrypt(persisted.encrypted,
                    "${app.workspaceScope}/${task.id}")).title)
            } finally { reopened.close() }
            assertEquals(1, runBlocking { app.repository.tasks.first().count { it.id == task.id } })
            checks.put("task:create-dirty-dismiss-keep-edit-complete-recreate-encrypted-disk")
        } finally {
            device.executeShellCommand("svc wifi ${if (oldWifi) "enable" else "disable"}")
            device.executeShellCommand("svc data ${if (oldData) "enable" else "disable"}")
        }
    }

    @After fun reportAndRemoveOnlyOwnedFixtures() {
        if (!seeded) return
        val report = JSONObject().put("test", testName.methodName).put("widthDp", width)
            .put("runId", args.getString("genesisRunId") ?: "manual")
            .put("dark", dark).put("fontScale", fontScale).put("orientation", orientation).put("checks", checks).put("screenshots", images)
            .put("workspace", app.workspaceScope).put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("notTested", JSONArray(listOf("Real Google sign-in and cloud synchronization",
                "Shared-project role access and server operations", "Physical-phone installation",
                "Process death differs from Activity recreation")))
        File(folder, "$suffix-${testName.methodName}.json").writeText(report.toString(2))
        println("GENESIS_3_0_REPORT ${report}")
        runBlocking {
            check(app.workspaceScope == "internal-validation-v1")
            ownedTasks.forEach { app.repository.delete(it) }
            val structure = WorkspaceStructureRepository(app)
            structure.deleteProject(projectId)
            structure.deleteProject(secondProjectId)
            val habits = HabitsRepository(app)
            habits.delete(habitId)
            habits.updateSettings(previousHabitSettings)
            val prefs = LocalPreferences(app, app.workspaceScope)
            prefs.set("navigationLabels", if (previousPrefs.navigationLabels) "text" else "icons")
            prefs.set("settingsSubmenuEnabled", previousPrefs.settingsSubmenuEnabled.toString())
            prefs.set("language", previousPrefs.language)
            prefs.set("display", previousPrefs.display.wireValue)
            prefs.set("input", previousPrefs.input.wireValue)
            prefs.set("gregorianYearStart", if (previousPrefs.gregorianYearStartsInMarch) "march" else "january")
            prefs.set("theme", previousPrefs.theme.orEmpty())
        }
    }
}
