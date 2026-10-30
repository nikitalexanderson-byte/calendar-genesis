package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.*
import ru.genesis.calendar.domain.trackers.*
import ru.genesis.calendar.ui.dailySleepSchedule

/** Actual application shell and repositories; exclusively synthetic data in the 3.1.3 QA app. */
class StoreListing313CaptureTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()
    private val app get() = compose.activity.application as GenesisApplication
    private fun await(tag: String) = compose.waitUntil(15_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
    private fun open(page: String, section: String? = null) {
        compose.onNodeWithTag("workspace-menu").performClick()
        val suffix = if (page in listOf("Календарь", "Сакральное", "Проекты")) "root" else section ?: "root"
        compose.onNodeWithTag("drawer-$page-$suffix").performScrollTo().performClick()
        compose.waitUntil(5_000) { !compose.onNodeWithTag("workspace-drawer").isDisplayed() }
        if (page in listOf("Календарь", "Сакральное") && section != null)
            compose.onNodeWithTag("submenu-$section").performClick()
    }

    @Test fun captureSixFinalScreensWithSyntheticData() = runBlocking {
        check(BuildConfig.DEBUG && app.packageName == "ru.genesis.calendar.v313.debug" && app.workspaceScope == "internal-validation-v1")
        val args = InstrumentationRegistry.getArguments()
        val language = args.getString("genesisStoreLanguage", "ru")
        require(language in setOf("ru", "en"))
        val english = language == "en"
        fun copy(ru: String, en: String) = if (english) en else ru
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = prefs.values.first()
        val dao = app.database.dao()
        val originalTaskRows = dao.accountTasks(app.workspaceScope)
        val kinds = listOf("habits", "trackers", "stoicheion-draws", "structure")
        val documents = kinds.associateWith { dao.document(app.workspaceScope, it) }
        val documentOutboxIds = setOf("habits", "trackers", "stoicheion-draws", "workspace-structure")
        val documentOutbox = dao.outbox(app.workspaceScope).filter { it.entityId in documentOutboxIds }
        val token = "store313-${UUID.randomUUID()}"
        val project = "$token-project"
        val ownedTasks = listOf("$token-read", "$token-plan")
        val folder = File(app.getExternalFilesDir(null), "store-313-$language").apply { mkdirs() }
        fun capture(name: String) {
            compose.waitForIdle()
            val target = File(folder, "tasker-313-$name.png")
            captureNativeWindow(target)
            val bitmap = android.graphics.BitmapFactory.decodeFile(target.absolutePath)
            try {
                assertEquals("Store captures use the actual 9:16 QA display", 9 * bitmap.height, 16 * bitmap.width)
                assertTrue(target.length() < 8 * 1024 * 1024)
            } finally { bitmap.recycle() }
        }
        try {
            // Only the QA documents are temporarily replaced. Their exact encrypted rows are restored below.
            kinds.forEach { dao.deleteDocument(app.workspaceScope, it) }
            originalTaskRows.forEach { dao.putTask(it.copy(deleted = true)) }
            prefs.set("language", language); prefs.set("theme", "standart")
            prefs.set("display", "profane"); prefs.set("input", "profane")
            prefs.set("settingsSubmenuEnabled", "true")
            val date = LocalDate.now()
            val structure = WorkspaceStructureRepository(app)
            structure.saveProject(GenesisProject(project, null, null, copy("Личные планы", "Personal plans"), "", emptyList(), "active", 0))
            app.repository.save(LocalTask(ownedTasks[0], copy("Прочитать новую главу", "Read a new chapter"), date = date.toString(), projectId = project))
            app.repository.save(LocalTask(ownedTasks[1], copy("Спланировать завтрашний день", "Plan tomorrow"), date = date.toString(), projectId = project))
            val habits = HabitsRepository(app)
            val initialHabits = habits.workspace.first()
            habits.updateSettings(initialHabits.settings.copy(enabled = true))
            habits.save(Habit(TrackerEntity.create("habit", id = "$token-habit"), copy("Читать каждый день", "Read every day"),
                date, HabitEngine(GenesisCalendar()).defaultSchedule(date, CalendarMode.PROFANE),
                emoji = "📖", timerEnabled = true))
            val trackers = TrackersRepository(app)
            val schedule = dailySleepSchedule(date.minusDays(7), CalendarMode.PROFANE)
            trackers.savePlan(SleepPlan(TrackerEntity.create("sleep-plan", id = "$token-sleep"), schedule,
                copy("Спокойный сон", "Restful sleep")))
            trackers.saveSleep("$token-sleep", date, LocalTime.of(23, 0), LocalTime.of(7, 0), 8.0, "", 0)
            trackers.saveAddiction(AddictionTracker(TrackerEntity.create("addiction", id = "$token-abstinence"), schedule,
                copy("Меньше сахара", "Less sugar")))
            StoicheionDrawRepository(app).save("timeline", 0x12345678L)
            await("workspace-menu")
            open("Сегодня"); await("today-list"); capture("today")
            open("Календарь", "month"); await("calendar-month"); capture("calendar-month")
            compose.onNodeWithTag("submenu-year").performClick(); await("calendar-year")
            capture("calendar-year")
            open("Привычки", "Привычки"); await("habit-view-today")
            prefs.set("theme", "standart-dark")
            compose.waitForIdle(); capture("habits-dark")
            prefs.set("theme", "standart")
            open("Привычки", "Сон и настроение"); await("sleep-plan-header"); capture("sleep")
            open("Сакральное", "stoicheion"); await("stoicheion-grid")
            compose.onNodeWithTag("stoicheion-grid").performScrollToNode(hasTestTag("stoicheion-timeline-cards"))
            compose.onNodeWithTag("stoicheion-timeline-past").assertExists()
            compose.onNodeWithTag("stoicheion-timeline-present").assertExists()
            compose.onNodeWithTag("stoicheion-timeline-future").assertExists()
            capture("timeline")
        } finally {
            ownedTasks.forEach { id ->
                app.repository.delete(id)
                dao.deleteTaskReminders(app.workspaceScope, id)
                dao.outbox(app.workspaceScope).filter { it.entityId == id }.forEach {
                    dao.acknowledgeOutbox(app.workspaceScope, it.entityId, it.revision, it.operationId)
                }
                dao.deleteCachedTask(app.workspaceScope, id)
            }
            originalTaskRows.forEach { dao.putTask(it) }
            documents.forEach { (kind, row) -> if (row == null) dao.deleteDocument(app.workspaceScope, kind) else dao.putDocument(row) }
            dao.outbox(app.workspaceScope).filter { it.entityId in documentOutboxIds }.forEach {
                dao.acknowledgeOutbox(app.workspaceScope, it.entityId, it.revision, it.operationId)
            }
            documentOutbox.forEach { dao.putOutbox(it) }
            prefs.set("language", original.language); prefs.set("theme", original.theme ?: "")
            prefs.set("display", original.display.wireValue); prefs.set("input", original.input.wireValue)
            prefs.set("settingsSubmenuEnabled", original.settingsSubmenuEnabled.toString())
            app.scheduler.restoreHabitNotifications()
            ru.genesis.calendar.reminders.SleepReminderScheduler.restore(app)
        }
    }
}
