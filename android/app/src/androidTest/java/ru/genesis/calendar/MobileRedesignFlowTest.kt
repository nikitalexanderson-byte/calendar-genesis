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
import androidx.compose.ui.semantics.SemanticsActions
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
import ru.genesis.calendar.ui.calendarName

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
    private val ownedLists = mutableSetOf<String>()
    private lateinit var previousPrefs: UiPreferences
    private lateinit var previousHabitSettings: HabitSettings
    private val checks = JSONArray()
    private val images = JSONArray()
    private var seeded = false
    private val folder get() = File(app.getExternalFilesDir(null), "3.0-captures").apply { mkdirs() }
    private val orientation get() = if (compose.activity.resources.displayMetrics.widthPixels > compose.activity.resources.displayMetrics.heightPixels) "landscape" else "portrait"
    private val suffix get() = "${width}-${if (dark) "dark" else "light"}-font${(fontScale * 100).toInt()}-$orientation"
    private data class Route(val page: String, val section: String?, val title: String) {
        val tag get() = "drawer-$page-${if (page in listOf("Календарь", "Сакральное", "Проекты")) "root" else section ?: "root"}"
    }
    private val todayRoute = Route("Сегодня", null, "Сегодня")
    private val monthRoute = Route("Календарь", "month", "Календарь")
    private val yearRoute = Route("Календарь", "year", "Календарь")
    private val personalRoute = Route("Проекты", "personal-projects", "Дела — личные")
    private val routes = listOf(todayRoute, monthRoute, yearRoute, personalRoute,
        Route("Привычки", "Привычки", "Привычки"),
        Route("Привычки", "Сон и настроение", "Сон и настроение"),
        Route("Сакральное", "stoicheion", "Оракул"),
        Route("Сакральное", "theokyklos", "Оракул"),
        Route("Настройки", "appearance", "Оформление"),
        Route("Настройки", "habits", "Настройки привычек"),
        Route("Настройки", "reminders", "Напоминания"),
        Route("Настройки", "shared", "Общие дела"),
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
        if (route.page in listOf("Календарь", "Сакральное") && route.section != null)
            compose.onNodeWithTag("submenu-${route.section}").performClick()
        if (route.page == "Проекты" && exists("submenu-personal"))
            compose.onNodeWithTag("submenu-personal").performClick()
        val expectedTitle = when (route.page) {
            "Календарь" -> ru.genesis.calendar.ui.mobileCalendarCopy("ru").calendarName(
                runBlocking { LocalPreferences(app, app.workspaceScope).values.first().display })
            "Проекты" -> "Личные дела"
            "Сакральное" -> if (route.section == "theokyklos") "Оракул · Теокиклос" else "Оракул · Стойхейон"
            "Настройки" -> "Настройки\n${route.title.removePrefix("Настройки ")}"
            else -> route.title
        }
        compose.onNodeWithTag("workspace-title").assertTextEquals(expectedTitle)
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
    private fun scrollToTodayNode(matcher: SemanticsMatcher) {
        if (compose.onAllNodesWithTag("today-two-pane").fetchSemanticsNodes().isEmpty())
            compose.onNodeWithTag("today-list").performScrollToNode(matcher)
        else compose.onNode(matcher).performScrollTo()
    }
    private fun assertActualToday() {
        scrollToTodayNode(hasTestTag("today-civil-date"))
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

    @Test fun sharedCalendarHeaderAndAlwaysVisibleDayKnowledge() {
        val prefs = LocalPreferences(app, app.workspaceScope)
        fun switchTag(mode: CalendarMode) = hasTestTag("calendar-mode-icon-${mode.wireValue}") and
            hasAnyAncestor(hasTestTag("global-calendar-switch"))
        fun waitMode(mode: CalendarMode) {
            compose.waitUntil(8_000) { runBlocking { prefs.values.first().display == mode } }
            compose.onNode(switchTag(mode), useUnmergedTree = true).assertIsDisplayed()
            assertEquals("Display calendar must not change task input", CalendarMode.PROFANE,
                runBlocking { prefs.values.first().input })
        }
        checkTarget("global-calendar-switch")
        compose.onNodeWithTag("voice-assistant-open").assertDoesNotExist()
        val permissions = app.packageManager.getPackageInfo(app.packageName,
            android.content.pm.PackageManager.GET_PERMISSIONS).requestedPermissions.orEmpty()
        assertFalse(permissions.contains("android.permission.RECORD_AUDIO"))
        compose.onNodeWithTag("today-art-expand").assertDoesNotExist()
        compose.onNodeWithTag("today-art-collapse").assertDoesNotExist()
        compose.onNodeWithTag("today-hero-description").assertExists()
        assertActualToday()
        compose.onNode(hasTestTag("calendar-mode-icon-profane") and hasAnyAncestor(hasTestTag("today-hero")),
            useUnmergedTree = true).assertDoesNotExist()
        capture("today-profane-art")
        openDrawer()
        compose.onNodeWithTag("drawer-labels").assertDoesNotExist()
        compose.onNodeWithTag(monthRoute.tag).assertExists()
        compose.onNodeWithTag("drawer-Календарь-month").assertDoesNotExist()
        compose.onNodeWithTag("drawer-Календарь-year").assertDoesNotExist()
        capture("drawer-always-labels")
        compose.onNodeWithTag("account-refresh").performScrollTo()
            .assert(hasAnyAncestor(hasTestTag("drawer-version-row")))
        checkTarget("account-refresh")
        compose.onAllNodes(hasTestTag("account-refresh") and hasAnyAncestor(hasTestTag("app-header"))).assertCountEquals(0)
        capture("drawer-refresh-by-version")
        device.pressBack(); drawerClosed()
        compose.onNodeWithTag("account-refresh").assertIsNotDisplayed()
        compose.onNode(switchTag(CalendarMode.PROFANE), useUnmergedTree = true).performClick()
        waitMode(CalendarMode.SACRED)
        compose.onNodeWithTag("today-day-details-toggle").assertDoesNotExist()
        scrollToTodayNode(hasTestTag("today-day-details"))
        compose.onNodeWithTag("day-knowledge").assertExists()
        capture("sacred-knowledge-bottom")
        scrollToTodayNode(hasTestTag("today-hero"))
        capture("today-sacred-art")
        compose.onNodeWithTag("today-art-expand").assertDoesNotExist()
        compose.onNodeWithTag("today-day-details-toggle").assertDoesNotExist()
        scrollToTodayNode(hasTestTag("today-hero-description"))
        compose.onNodeWithTag("today-hero-description").assertExists()
        capture("today-sacred-description")
        navigate(monthRoute)
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
        compose.onNodeWithTag("calendar-month-info-toggle").assertDoesNotExist()
        compose.onNodeWithTag("calendar-view-switch").assertIsDisplayed()
        compose.onNode(switchTag(CalendarMode.SACRED), useUnmergedTree = true).performClick()
        waitMode(CalendarMode.LUNAR)
        compose.onNodeWithTag("calendar-month-description").assertExists()
        capture("calendar-lunar-month")
        compose.onNodeWithTag("submenu-year").performClick()
        compose.onNodeWithTag("calendar-year-panel").assertExists()
        compose.onNodeWithTag("genesis-page-header").assertDoesNotExist()
        capture("calendar-lunar-year")
        compose.onNode(switchTag(CalendarMode.LUNAR), useUnmergedTree = true).performClick()
        waitMode(CalendarMode.PROFANE)
        navigate(personalRoute)
        compose.onNode(switchTag(CalendarMode.PROFANE), useUnmergedTree = true).assertIsDisplayed()
        runBlocking {
            prefs.set("navigationLabels", "icons")
            prefs.set("settingsSubmenuEnabled", "false")
        }
        navigate(Route("Настройки", "appearance", "Оформление"))
        compose.onNodeWithTag("settings-layout-submenu").assertDoesNotExist()
        compose.onNodeWithTag("settings-layout-sequential").assertDoesNotExist()
        compose.onNodeWithTag("settings-section-reminders").assertDoesNotExist()
        compose.onNodeWithTag("navigation-icons-only").assertDoesNotExist()
        compose.onNodeWithTag("navigation-with-text").assertDoesNotExist()
        compose.onNodeWithTag("appearance-system").performScrollTo()
        val themeBounds = listOf("light", "evening", "system").map {
            checkTarget("appearance-$it")
            compose.onNodeWithTag("appearance-$it").fetchSemanticsNode().boundsInRoot
        }
        assertTrue("Three theme choices must share one row", themeBounds.maxOf { it.top } - themeBounds.minOf { it.top } <= 1f)
        assertTrue("Theme choices must have equal widths", themeBounds.maxOf { it.width } - themeBounds.minOf { it.width } <= 1f)
        val deviceText = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
        compose.onNode(hasText("Устройство") and hasAnyAncestor(hasTestTag("appearance-system")), useUnmergedTree = true)
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(deviceText) }
        assertTrue(deviceText.isNotEmpty())
        assertTrue("Device label must stay readable on one line", deviceText.all { it.lineCount == 1 && !it.hasVisualOverflow })
        capture("appearance-without-menu-label-choice")
        navigate(Route("Сакральное", "theokyklos", "Оракул"))
        compose.onNodeWithTag("sacred-submenu").assertIsDisplayed()
        compose.onNodeWithTag("workspace-subtitle").assertTextEquals("Круг божественных сил")
        compose.onNodeWithTag("workspace-information").assertDoesNotExist()
        listOf("workspace-title", "workspace-subtitle").forEach { tag ->
            val layouts = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
            compose.onNodeWithTag(tag).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertTrue("Oracle $tag must fit one readable line", layouts.isNotEmpty() && layouts.all { it.lineCount == 1 && !it.hasVisualOverflow })
        }
        capture("oracle-theokyklos")
        compose.onNodeWithTag("submenu-stoicheion").performClick()
        compose.onNodeWithTag("workspace-information").assertDoesNotExist()
        capture("oracle-stoicheion")
        navigate(todayRoute)
        assertActualToday()
        checks.put("global-calendar:shared-across-tabs-input-independent-no-audio-permission")
    }

    @Test fun review4FullArtworkLunarImagesEqualTilesAndPinnedSearch() {
        val hero = compose.onNodeWithTag("today-hero").fetchSemanticsNode().boundsInRoot
        val panel = compose.onNodeWithTag("today-hero-copy").fetchSemanticsNode().boundsInRoot
        assertTrue("Black copy layer must cover the complete artwork", kotlin.math.abs(hero.width-panel.width)<1 && kotlin.math.abs(hero.height-panel.height)<1)
        compose.onNodeWithTag("today-art-expand").assertDoesNotExist()
        capture("review4-today-expanded")
        compose.onNodeWithTag("today-art-collapse").assertDoesNotExist()
        scrollToTodayNode(hasTestTag("day-rhythm-title"))
        compose.onNodeWithTag("day-rhythm-title").assertTextEquals("Сакральное время")
        navigate(monthRoute)
        val prefs = LocalPreferences(app, app.workspaceScope)
        runBlocking { prefs.set("display", "sacred") }
        capture("review4-sacred-month-frames")
        runBlocking { prefs.set("display", "lunar") }
        compose.onNodeWithTag("lunar-month-art").assertExists()
        capture("review4-lunar-month-art-frames")
        compose.onNodeWithTag("submenu-year").performClick()
        fun height(tag: String): Float {
            compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag(tag))
            return compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot.height
        }
        val first = height("lunar-year-month-1")
        val current = height("lunar-year-month-${ru.genesis.calendar.domain.GenesisCalendar().lunarDate(LocalDate.now()).monthOrdinal}")
        assertEquals("Task counts must not grow lunar year tiles", first, current, 1f)
        capture("review4-lunar-year-equal-tiles")
        runBlocking { prefs.set("display", "sacred") }
        val sacredFirst = height("sacred-year-month-0")
        val sacredCurrent = height("sacred-year-month-${ru.genesis.calendar.domain.GenesisCalendar().sacredDate(LocalDate.now()).monthIndex}")
        assertEquals("Task counts must not grow sacred year tiles", sacredFirst, sacredCurrent, 1f)
        capture("review4-sacred-year-equal-tiles")
        compose.onNodeWithTag("calendar-year").performScrollToNode(hasTestTag("solar-model-open"))
        compose.onNodeWithTag("solar-model-open").assertIsDisplayed()
        runBlocking { prefs.set("display", "profane") }
        val gregorianFirst = height("calendar-year-month-${LocalDate.of(LocalDate.now().year,1,1)}")
        val gregorianCurrent = height("calendar-year-month-${LocalDate.now().withDayOfMonth(1)}")
        assertEquals("Task counts must not grow Gregorian year tiles", gregorianFirst, gregorianCurrent, 1f)
        capture("review4-gregorian-year-equal-tiles")
        navigate(personalRoute)
        compose.onNodeWithTag("personal-actions").assert(hasAnyAncestor(hasTestTag("app-header")))
        compose.onNodeWithTag("personal-mindmaps").assertIsDisplayed()
        capture("review4-personal-header-and-search-button")
        compose.onNodeWithTag("personal-task-search-open").performClick()
        val dock = compose.onNodeWithTag("personal-task-search-dock").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("projects-screen").performScrollToIndex(1)
        val after = compose.onNodeWithTag("personal-task-search-dock").fetchSemanticsNode().boundsInRoot
        assertEquals("Search must stay pinned",dock.bottom,after.bottom,1f)
        compose.onNodeWithTag("personal-task-search").performTextReplacement("Разобрать")
        compose.onNodeWithTag("task-$inboxTaskId").assertExists()
        capture("review4-pinned-search-expanded")
        compose.onNodeWithTag("personal-task-search-close").performClick()
        compose.onNodeWithTag("personal-task-search-open").assertIsDisplayed()
        checks.put("review4:full-artwork-labelled-sacred-time-13-lunar-assets-equal-year-tiles-header-actions-pinned-search")
    }

    @Test fun review5PreferencesAndDrawerGesture() {
        val prefs = LocalPreferences(app, app.workspaceScope)
        runBlocking { prefs.set("menuSwipeEnabled", "false") }
        openDrawer()
        compose.onNode(hasTestTag("genesis-icon-oracle-static") and
            hasAnyAncestor(hasTestTag("drawer-Сакральное-root")), useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("workspace-drawer").performTouchInput { swipeLeft() }
        drawerClosed()
        compose.onNodeWithTag("workspace-title").assertTextEquals("Сегодня")
        checks.put("drawer:swipe-left-closes-even-with-legacy-swipes-disabled")
        runBlocking {
            val habits = HabitsRepository(app)
            val habit = habits.workspace.first().habits.first { it.id == habitId }
            habits.save(habit.copy(title = "Пить 250 мл воды каждые полтора часа",
                intervalSchedule = ru.genesis.calendar.domain.habits.HabitIntervalSchedule(90, "11:00", "22:00")))
        }
        scrollToTodayNode(hasTestTag("today-habit-$habitId"))
        compose.onNodeWithTag("today-habit-title-$habitId").assertExists()
        val titleLeft = compose.onNodeWithTag("today-habit-title-$habitId").fetchSemanticsNode().boundsInRoot.left
        val summaryLeft = compose.onNodeWithTag("habit-interval-summary-$habitId").fetchSemanticsNode().boundsInRoot.left
        assertEquals("Habit title and schedule must share one text inset", titleLeft, summaryLeft, 1f)
        capture("review5-habit-insets")
        checkTarget("today-habit-check-$habitId")
        compose.onNodeWithTag("habit-interval-marks-toggle").performScrollTo().performClick()
        compose.onNodeWithTag("habit-interval-mark-11:00").assertExists()
        capture("review5-habit-repetitions")
        checks.put("habits:shared-compact-insets-readable-intervals-and-48dp-checkbox")
        runBlocking { prefs.set("display", "lunar") }
        scrollToTodayNode(hasTestTag("today-hero"))
        compose.onNodeWithTag("today-lunar-phase").assertExists()
        compose.onNodeWithTag("today-hero-description").assertExists()
        compose.onNodeWithTag("today-art-expand").assertDoesNotExist()
        capture("review5-today-lunar-expanded")
        for (route in routes.filter { it.page == "Настройки" }) {
            navigate(route, assertSelection = false)
            compose.onAllNodes(hasTestTag("app-header") and hasAnyDescendant(
                hasTestTag("genesis-icon-${ru.genesis.calendar.ui.settingsSections.first { it.id == route.section }.icon.name.lowercase()}-static")))
                .assertCountEquals(0)
            capture("review5-settings-${route.section}")
            val headings = compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
                .fetchSemanticsNodes()
            assertTrue("Settings ${route.section} must keep named sections", headings.isNotEmpty())
            checks.put("settings:${route.section}:common-card-heading-without-header-icon")
        }
        navigate(personalRoute, assertSelection = false)
        compose.onNodeWithTag("personal-task-search-open").performClick()
        fun equalSearchHeight() {
            val field = compose.onNodeWithTag("personal-task-search").fetchSemanticsNode().boundsInRoot
            val close = compose.onNodeWithTag("personal-task-search-close").fetchSemanticsNode().boundsInRoot
            assertEquals("Close and search must have equal heights", field.height, close.height, 1f)
            assertEquals("Close and search must align at top", field.top, close.top, 1f)
            checkTarget("personal-task-search-close")
        }
        equalSearchHeight()
        capture("review5-search-empty")
        compose.onNodeWithTag("personal-task-search").performClick()
        compose.onNodeWithTag("personal-task-search").performTextInput("Разобрать")
        equalSearchHeight()
        capture("review5-search-query")
        compose.onNodeWithTag("personal-task-search-close").performClick()
        compose.onNodeWithTag("personal-task-search-open").performClick()
        compose.onNodeWithTag("personal-task-search").assertTextContains("Разобрать")
        checks.put("search:equal-height-empty-query-keyboard-close-retains-query")
    }

    @Test fun review4WholeTaskAndListDragBetweenInboxProjectsAndSubprojects() {
        val repo = WorkspaceStructureRepository(app)
        val listId = "review4-list-$token"; val listTask = "review4-list-task-$token"
        ownedLists += listId; ownedTasks += listTask
        runBlocking {
            val target = repo.workspace.first().projects.first { it.id == secondProjectId }
            repo.saveProject(target.copy(parentId = projectId))
            repo.saveTaskList(GoogleTaskList(listId, "Список для переноса"))
            app.repository.save(LocalTask(listTask, "Задача внутри списка", sourceFieldsJson = JSONObject()
                .put("googleTaskListId",listId).toString()))
        }
        navigate(personalRoute)
        fun drag(tag: String, target: String) {
            val node = compose.onNodeWithTag(tag, useUnmergedTree = true)
            compose.onNodeWithTag("projects-screen", useUnmergedTree = true).performScrollToNode(hasTestTag(tag))
            val origin = node.fetchSemanticsNode().boundsInRoot
            node.performTouchInput { down(center); advanceEventTime(700); moveBy(Offset(0f,4f)) }
            compose.onNodeWithTag("drag-overlay").assertIsDisplayed()
            compose.onNodeWithTag("drag-overlay-target-$target").performScrollTo()
            val destination = compose.onNodeWithTag("drag-overlay-target-$target").fetchSemanticsNode().boundsInRoot.center
            node.performTouchInput { moveTo(destination-origin.topLeft); advanceEventTime(300); up() }
            compose.waitUntil(10_000) { !exists("drag-overlay") }
        }
        drag("drag-task-$inboxTaskId",projectId)
        compose.waitUntil(10_000) { runBlocking { app.repository.get(inboxTaskId)?.projectId == projectId } }
        showProject()
        drag("drag-task-$inboxTaskId",secondProjectId)
        compose.waitUntil(10_000) { runBlocking { app.repository.get(inboxTaskId)?.projectId == secondProjectId } }
        drag("drag-block-list-$listId",secondProjectId)
        compose.waitUntil(10_000) { runBlocking {
            repo.workspace.first().taskListLinks.any { it.taskListId == listId && it.projectId == secondProjectId } &&
                app.repository.get(listTask)?.projectId == secondProjectId
        } }
        compose.onNodeWithTag("projects-screen").performScrollToNode(hasTestTag("project-drop-$secondProjectId"))
        compose.onNodeWithTag("project-drop-$secondProjectId").performClick()
        capture("review4-list-and-task-in-subproject")
        drag("drag-block-list-$listId","__genesis_inbox__")
        compose.waitUntil(10_000) { runBlocking { repo.workspace.first().taskListLinks.any { it.taskListId == listId && it.projectId == null } } }
        assertNotNull(runBlocking { app.repository.get(listTask) })
        checks.put("review4:real-longpress-task-and-whole-list-moves-project-subproject-inbox-no-record-loss")
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
        checkTarget("global-calendar-switch")
        compose.onNodeWithTag("voice-assistant-open").assertDoesNotExist()
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
                    compose.onNodeWithTag("calendar-month-description").assertExists()
                    compose.onNodeWithTag("calendar-month-info-toggle").assertDoesNotExist()
                    checkTarget("calendar-month-today")
                    capture("calendar-month")
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
        compose.onNode(hasText(monthRoute.title) and hasAnyAncestor(hasTestTag(monthRoute.tag))).assertExists()
        compose.onNodeWithTag("drawer-labels").assertDoesNotExist()
        compose.onNodeWithTag("drawer-close").performScrollTo().performClick()
        drawerClosed()
        checks.put("drawer:labels-always-visible-even-with-legacy-icon-preference")
    }

    @Test fun calendarAndProjectContextsSurviveDrawerRoundTrips() {
        navigate(monthRoute)
        compose.onNodeWithTag("calendar-month-next").performScrollTo().performClick()
        val month = text("calendar-month-period")
        navigate(todayRoute)
        assertActualToday()
        scrollToTodayNode(hasTestTag("today-tasks-section"))
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
        compose.onNodeWithTag("personal-task-search-open").performClick()
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
            ownedLists.forEach { structure.removeTaskList(it) }
            listOf(secondProjectId,projectId).forEach { id ->
                if (structure.workspace.first().projects.any { it.id==id }) structure.deleteProject(id)
            }
            val habits = HabitsRepository(app)
            habits.delete(habitId)
            habits.updateSettings(previousHabitSettings)
            val prefs = LocalPreferences(app, app.workspaceScope)
            prefs.set("navigationLabels", if (previousPrefs.navigationLabels) "text" else "icons")
            prefs.set("menuSwipeEnabled", previousPrefs.menuSwipeEnabled.toString())
            prefs.set("settingsSubmenuEnabled", previousPrefs.settingsSubmenuEnabled.toString())
            prefs.set("language", previousPrefs.language)
            prefs.set("display", previousPrefs.display.wireValue)
            prefs.set("input", previousPrefs.input.wireValue)
            prefs.set("gregorianYearStart", if (previousPrefs.gregorianYearStartsInMarch) "march" else "january")
            prefs.set("theme", previousPrefs.theme.orEmpty())
        }
    }
}
