package ru.genesis.calendar.ui

import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

internal data class SwipeDestination(val page: String, val section: String? = null)

class MenuSwipeState {
    var tasks by mutableStateOf("tasks")
    var projects by mutableStateOf("all")
    var projectArea by mutableStateOf("personal")
    var calendar by mutableStateOf("month")
    var habits by mutableStateOf("Привычки")
    var sacred by mutableStateOf("stoicheion")
    var settings by mutableStateOf("appearance")

    fun section(page: String): String? = when (page) {
        "Задачи" -> tasks
        "Проекты" -> projectArea
        "Календарь" -> calendar
        "Привычки" -> habits
        "Сакральное" -> sacred
        "Настройки" -> settings
        else -> null
    }

    fun select(page: String, section: String) {
        when (page) {
            "Задачи" -> tasks = section
            "Проекты" -> projectArea = section
            "Календарь" -> calendar = section
            "Привычки" -> habits = section
            "Сакральное" -> sacred = section
            "Настройки" -> settings = section
        }
    }
}

internal fun menuSwipeSequence(includeSubmenus: Boolean, habitsEnabled: Boolean,
    sharedProjectsEnabled: Boolean = false, hiddenMenuItems: Set<String> = emptySet(),
    hiddenSubmenus: Set<String> = emptySet(),
    settingsSubmenuEnabled: Boolean = true): List<SwipeDestination> {
    val pages = listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки", "Сакральное", "Настройки")
        .filter { (habitsEnabled || it != "Привычки") && menuVisibilityId(it) !in hiddenMenuItems &&
            (it != "Сакральное" || !("stoicheion" in hiddenMenuItems && "theokyklos" in hiddenMenuItems)) }
    if (!includeSubmenus) return pages.map { SwipeDestination(it) }
    return pages.flatMap { page -> when (page) {
        "Задачи" -> listOf("tasks", "lists").filter { "tasks.$it" !in hiddenSubmenus }
            .map { SwipeDestination(page, it) }
        "Проекты" -> if (sharedProjectsEnabled) listOf("personal", "shared")
            .filter { "projects.$it" !in hiddenSubmenus }.map { SwipeDestination(page, it) }
            else listOf(SwipeDestination(page))
        "Календарь" -> listOf("month", "year").filter { "calendar.$it" !in hiddenSubmenus }
            .map { SwipeDestination(page, it) }
        "Привычки" -> listOf("Привычки", "Сон и настроение")
            .filter { (if (it == "Привычки") "habits.habits" else "habits.sleep") !in hiddenSubmenus }
            .map { SwipeDestination(page, it) }
        "Сакральное" -> listOf("stoicheion", "theokyklos")
            .filter { "sacred.$it" !in hiddenSubmenus && it !in hiddenMenuItems }
            .map { SwipeDestination(page, it) }
        "Настройки" -> if (settingsSubmenuEnabled)
            settingsSections.map { SwipeDestination(page, it.id) }
            else listOf(SwipeDestination(page))
        else -> listOf(SwipeDestination(page))
    } }
}

internal fun menuVisibilityId(page: String): String = when (page) {
    "Задачи" -> "tasks"; "Проекты" -> "projects"; "Календарь" -> "calendar"
    "Привычки" -> "habits"; "Сакральное" -> "sacred"
    else -> ""
}

internal fun firstVisibleSubmenu(page: String, habitsEnabled: Boolean,
    sharedProjectsEnabled: Boolean, hiddenMenuItems: Set<String>,
    hiddenSubmenus: Set<String>, settingsSubmenuEnabled: Boolean): String? =
    menuSwipeSequence(true, habitsEnabled, sharedProjectsEnabled, hiddenMenuItems,
        hiddenSubmenus, settingsSubmenuEnabled).firstOrNull { it.page == page }?.section

internal fun nextMenuSwipeDestination(sequence: List<SwipeDestination>, page: String,
    section: String?, step: Int): SwipeDestination? {
    require(step == -1 || step == 1)
    val current = sequence.indexOf(SwipeDestination(page, section)).takeIf { it >= 0 }
        ?: sequence.indexOfFirst { it.page == page }
    if (current < 0) return null
    return sequence.getOrNull(current + step)
}

/** Compose's pager keeps adjacent destinations ready before the finger reaches them. */
@Composable
internal fun MenuSwipePager(current: SwipeDestination, sequence: List<SwipeDestination>,
    enabled: Boolean, onNavigate: (SwipeDestination) -> Unit,
    onPreview: (SwipeDestination) -> Unit = {},
    modifier: Modifier = Modifier, content: @Composable (SwipeDestination) -> Unit) {
    val currentIndex = sequence.indexOf(current).takeIf { it >= 0 }
        ?: sequence.indexOfFirst { it.page == current.page }.coerceAtLeast(0)
    key(sequence) {
    val pagerState = rememberPagerState(initialPage = currentIndex) { sequence.size }
    val latestCurrent = rememberUpdatedState(current)
    val latestNavigate = rememberUpdatedState(onNavigate)
    val latestPreview = rememberUpdatedState(onPreview)
    LaunchedEffect(pagerState, currentIndex, sequence) {
        // A visibility change can assign a different destination to the same page index.
        // Align by destination before either observer starts, so that index is never
        // interpreted using the new sequence while the pager still holds the old one.
        if (pagerState.settledPage != currentIndex) pagerState.scrollToPage(currentIndex)
        launch {
            snapshotFlow { pagerState.settledPage }.distinctUntilChanged().drop(1).collect { index ->
                sequence.getOrNull(index)?.takeIf { it != latestCurrent.value }?.let(latestNavigate.value)
            }
        }
        launch {
            // Preview changes as the finger crosses a page, before the fling settles.
            snapshotFlow { pagerState.currentPage }.distinctUntilChanged().drop(1).collect { index ->
                sequence.getOrNull(index)?.let(latestPreview.value)
            }
        }
    }
    HorizontalPager(state = pagerState, modifier = modifier.fillMaxSize(),
        userScrollEnabled = enabled, beyondViewportPageCount = 1,
        key = { index -> sequence.getOrNull(index)?.let { "${it.page}:${it.section.orEmpty()}" }
            ?: "removed:$index" }) { index ->
        sequence.getOrNull(index)?.let { destination ->
            Box(Modifier.fillMaxSize().then(if (index == pagerState.settledPage) Modifier
                else Modifier.clearAndSetSemantics { })) {
                content(destination)
            }
        }
    }
    }
}
