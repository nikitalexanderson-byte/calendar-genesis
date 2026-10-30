package ru.genesis.calendar

import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.data.*
import ru.genesis.calendar.ui.*

/** Actual mobile routes in the isolated QA package; no account data or remote writes. */
class NativeTranslationWalkthroughTest {
    @get:Rule val compose = createAndroidComposeRule<TestWorkspaceActivity>()

    @Test fun visitMainScreensInEverySupportedLanguage() {
        val app = compose.activity.application as GenesisApplication
        check(BuildConfig.DEBUG && app.packageName == "ru.genesis.calendar.v313.debug" &&
            app.workspaceScope == "internal-validation-v1")
        val prefs = LocalPreferences(app, app.workspaceScope)
        val original = runBlocking { prefs.values.first() }
        val languages = listOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja")
        val nativeNames = setOf("Русский", "Српски", "Українська")
        val cyrillic = Regex("[А-Яа-яЁё]")
        val findings = linkedSetOf<String>()
        val wordFindings = linkedSetOf<String>()
        val layouts = ConcurrentHashMap<String, Boolean>()
        val states = JSONArray()
        val ignoredUserCopy = linkedSetOf<String>()
        // Only values read from user-authored fields are exempt. Surrounding UI labels remain audited.
        val userCopy = runBlocking {
            buildSet {
                app.repository.tasks.first().forEach { add(it.title); add(it.description); add(it.project) }
                WorkspaceStructureRepository(app).workspace.first().let { structure ->
                    structure.projects.forEach { add(it.title); add(it.description); addAll(it.tags) }
                    structure.categories.forEach { add(it.name) }
                    structure.taskLists.forEach { add(it.title) }
                }
                HabitsRepository(app).workspace.first().habits.forEach { add(it.title); add(it.description); add(it.ritualName) }
                TrackersRepository(app).workspace.first().let { trackers ->
                    trackers.sleepPlans.forEach { add(it.title) }
                    trackers.addictionTrackers.forEach { add(it.trackedBehavior); add(it.description) }
                }
                add(original.ipRegionLabel)
            }.filter { it.length >= 3 && cyrillic.containsMatchIn(it) }.sortedByDescending { it.length }
        }
        val userPatterns = userCopy.map { value -> value to
            Regex("(?<![\\p{L}\\p{N}])${Regex.escape(value)}(?![\\p{L}\\p{N}])") }
        val russianSources = buildSet {
            for (file in listOf("translations.en.json", "ui-translations/en.json", "shared-work-translations/en.json",
                "curated-translations.en.json", "year-translations/en.json")) {
                JSONObject(app.assets.open("originals/i18n/$file").bufferedReader().use { it.readText() })
                    .keys().forEach { if (it.length >= 8 && cyrillic.containsMatchIn(it)) add(it) }
            }
        }.sortedByDescending { it.length }
        fun withoutUserCopy(value: String): String {
            var remaining = value
            userPatterns.forEach { (userText, pattern) ->
                if (pattern.containsMatchIn(remaining)) {
                    ignoredUserCopy += userText
                    remaining = remaining.replace(pattern, " ")
                }
            }
            return remaining.trim()
        }
        fun descendants(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::descendants)
        fun activeNodes(): List<SemanticsNode> {
            val root = compose.onAllNodes(isRoot(), useUnmergedTree = true).onLast().fetchSemanticsNode()
            val viewport = root.boundsInRoot
            return descendants(root).filter { it.boundsInRoot.width > 0 && it.boundsInRoot.height > 0 &&
                it.boundsInRoot.overlaps(viewport) }
        }
        fun scan(language: String, state: String) {
            compose.waitForIdle()
            val text = activeNodes().flatMap { node ->
                node.config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } +
                    node.config.getOrNull(SemanticsProperties.ContentDescription).orEmpty() +
                    listOfNotNull(node.config.getOrNull(SemanticsProperties.EditableText)?.text,
                        node.config.getOrNull(SemanticsProperties.StateDescription),
                        node.config.getOrNull(SemanticsProperties.PaneTitle))
            }.filter(String::isNotBlank).distinct()
            if (language != "ru") text.forEach { value ->
                if (value.trim() in nativeNames) return@forEach
                val remaining = withoutUserCopy(value)
                if (!cyrillic.containsMatchIn(remaining)) return@forEach
                val russian = when (language) {
                    "sr" -> Regex("[ЁёЙйЩщЪъЫыЬьЭэЮюЯя]").containsMatchIn(remaining)
                    "uk" -> Regex("[ЁёЪъЫыЭэ]").containsMatchIn(remaining)
                    else -> true
                } || russianSources.any { source -> remaining.contains(source) &&
                    translateGenesisText(app, source, language) != source }
                if (russian) findings += "$language/$state: $remaining"
            }
            layouts.filterValues { it }.keys.forEach { wordFindings += "$language/$state: $it" }
            states.put(JSONObject().put("language", language).put("state", state).put("visibleStrings", text.size))
        }
        fun scanPage(language: String, state: String) {
            compose.waitForIdle()
            val viewport = activeNodes().filter { node ->
                node.config.getOrNull(SemanticsProperties.VerticalScrollAxisRange) != null &&
                    node.config.contains(SemanticsActions.ScrollBy)
            }.maxByOrNull { it.boundsInRoot.height }
            if (viewport == null) { scan(language, state); return }
            val scroll = compose.onNode(SemanticsMatcher("current vertical viewport ${viewport.id}") { it.id == viewport.id },
                useUnmergedTree = true)
            scroll.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, -1_000_000f) }
            for (page in 0 until 30) {
                scan(language, "$state/$page")
                val before = scroll.fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()
                scroll.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, viewport.boundsInRoot.height * .8f) }
                compose.waitForIdle()
                val after = scroll.fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()
                if (after == before) {
                    scroll.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, -1_000_000f) }
                    compose.waitForIdle()
                    return
                }
            }
            findings += "$language/$state: vertical traversal did not reach the end in 30 viewports"
        }
        try {
            runBlocking { prefs.set("display", "sacred"); prefs.set("stoicheionDivinationDisabled", "false") }
            compose.runOnUiThread { compose.activity.setContent {
                CompositionLocalProvider(LocalGenesisTextLayoutAudit provides { text, layout -> layouts[text] = layout.splitsWord() }) {
                    GenesisApp(app, null, testWorkspace = true)
                }
            } }
            for (language in languages) {
                layouts.clear()
                runBlocking { prefs.set("language", language) }
                compose.waitForIdle()
                // Confirm that the shell has consumed the locale before scanning its routes.
                compose.onNodeWithTag("workspace-menu").performClick()
                compose.onNodeWithTag("drawer-Сегодня-root").performScrollTo()
                val expectedToday = translateGenesisText(app, "Сегодня", language)
                compose.waitUntil(5_000) {
                    compose.onNodeWithTag("drawer-Сегодня-root").fetchSemanticsNode().config
                        .getOrNull(SemanticsProperties.ContentDescription).orEmpty().contains(expectedToday)
                }
                scan(language, "drawer")
                fun visit(page: String, section: String? = null, state: String = page) {
                    layouts.clear()
                    compose.openWorkspacePage(page, section)
                    scanPage(language, state)
                }
                visit("Сегодня")
                visit("Проекты", state = "affairs/personal")
                visit("Календарь", "month", "calendar/month")
                visit("Календарь", "year", "calendar/year")
                visit("Привычки", "Привычки", "habits")
                visit("Привычки", "Сон и настроение", "trackers")
                visit("Сакральное", "stoicheion", "oracle/stoicheion")
                visit("Сакральное", "theokyklos", "oracle/theokyklos")
                for (section in listOf("appearance", "habits", "reminders", "shared", "region", "account", "links"))
                    visit("Настройки", section, "settings/$section")
                visit("Настройки", "appearance", "settings/appearance/reference-entry")
                compose.onNodeWithTag("calendar-reference-sacred").performScrollTo().performClick()
                layouts.clear()
                scanPage(language, "calendar/reference-sacred")
                compose.onNodeWithTag("calendar-reference-close").performClick()
                println("GENESIS_NATIVE_LOCALE_CHECKED=$language")
            }
            assertTrue("Russian interface remnants:\n${findings.joinToString("\n")}", findings.isEmpty())
            assertTrue("Words split across lines:\n${wordFindings.joinToString("\n")}", wordFindings.isEmpty())
        } finally {
            runBlocking {
                prefs.set("language", original.language)
                prefs.set("display", original.display.wireValue)
                prefs.set("stoicheionDivinationDisabled", original.divinationDisabled.toString())
            }
            File(app.getExternalFilesDir(null), "translation-walkthrough-313.json").writeText(JSONObject()
                .put("states", states).put("russianFindings", JSONArray(findings.toList()))
                .put("wordSplitFindings", JSONArray(wordFindings.toList()))
                .put("excludedSyntheticUserStrings", JSONArray(ignoredUserCopy.toList()))
                .put("cyrillicLocaleAudit", "Russian-only letters and known Russian source phrases; shared Cyrillic words are not language proof.")
                .toString(2))
        }
    }
}
