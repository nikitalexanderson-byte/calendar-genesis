package ru.genesis.calendar.ui

import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop

internal data class SwipeDestination(val page: String, val section: String? = null)

class MenuSwipeState {
    var tasks by mutableStateOf("tasks")
    var projects by mutableStateOf("all")
    var projectArea by mutableStateOf("personal")
    var calendar by mutableStateOf("month")
    var habits by mutableStateOf("Привычки")

    fun section(page: String): String? = when (page) {
        "Задачи" -> tasks
        "Проекты" -> projectArea
        "Календарь" -> calendar
        "Привычки" -> habits
        else -> null
    }

    fun select(page: String, section: String) {
        when (page) {
            "Задачи" -> tasks = section
            "Проекты" -> projectArea = section
            "Календарь" -> calendar = section
            "Привычки" -> habits = section
        }
    }
}

internal fun menuSwipeSequence(includeSubmenus: Boolean, habitsEnabled: Boolean,
    sharedProjectsEnabled: Boolean = false): List<SwipeDestination> {
    val pages = listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки", "Стойхейон", "Теокиклос", "Настройки")
        .filter { habitsEnabled || it != "Привычки" }
    if (!includeSubmenus) return pages.map { SwipeDestination(it) }
    return pages.flatMap { page -> when (page) {
        "Задачи" -> listOf("tasks", "lists").map { SwipeDestination(page, it) }
        "Проекты" -> if (sharedProjectsEnabled) listOf("personal", "shared")
            .map { SwipeDestination(page, it) } else listOf(SwipeDestination(page))
        "Календарь" -> listOf("month", "year").map { SwipeDestination(page, it) }
        "Привычки" -> listOf("Привычки", "Сон и настроение").map { SwipeDestination(page, it) }
        else -> listOf(SwipeDestination(page))
    } }
}

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
    modifier: Modifier = Modifier, content: @Composable (SwipeDestination) -> Unit) {
    val currentIndex = sequence.indexOf(current).takeIf { it >= 0 }
        ?: sequence.indexOfFirst { it.page == current.page }.coerceAtLeast(0)
    val pagerState = rememberPagerState(initialPage = currentIndex) { sequence.size }
    val latestCurrent = rememberUpdatedState(current)
    val latestNavigate = rememberUpdatedState(onNavigate)
    LaunchedEffect(currentIndex, sequence) {
        if (pagerState.settledPage != currentIndex) pagerState.scrollToPage(currentIndex)
    }
    LaunchedEffect(pagerState, sequence) {
        // The first value after a sequence change is the old numeric index, which can now
        // name another destination. Let scrollToPage align it before accepting gestures.
        snapshotFlow { pagerState.settledPage }.distinctUntilChanged().drop(1).collect { index ->
            sequence.getOrNull(index)?.takeIf { it != latestCurrent.value }?.let(latestNavigate.value)
        }
    }
    HorizontalPager(state = pagerState, modifier = modifier.fillMaxSize(),
        userScrollEnabled = enabled, beyondViewportPageCount = 1,
        key = { index -> "${sequence[index].page}:${sequence[index].section.orEmpty()}" }) { index ->
        Box(Modifier.fillMaxSize().then(if (index == pagerState.settledPage) Modifier
            else Modifier.clearAndSetSemantics { })) {
            content(sequence[index])
        }
    }
}
