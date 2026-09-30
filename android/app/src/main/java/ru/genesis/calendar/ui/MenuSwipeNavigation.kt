package ru.genesis.calendar.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.abs

internal data class SwipeDestination(val page: String, val section: String? = null)

class MenuSwipeState {
    var tasks by mutableStateOf("tasks")
    var projects by mutableStateOf("all")
    var calendar by mutableStateOf("month")
    var habits by mutableStateOf("Привычки")

    fun section(page: String): String? = when (page) {
        "Задачи" -> tasks
        "Проекты" -> projects
        "Календарь" -> calendar
        "Привычки" -> habits
        else -> null
    }

    fun select(page: String, section: String) {
        when (page) {
            "Задачи" -> tasks = section
            "Проекты" -> projects = section
            "Календарь" -> calendar = section
            "Привычки" -> habits = section
        }
    }
}

internal fun menuSwipeSequence(includeSubmenus: Boolean, habitsEnabled: Boolean,
    categoryIds: List<String>): List<SwipeDestination> {
    val pages = listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки", "Стойхейон", "Теокиклос", "Настройки")
        .filter { habitsEnabled || it != "Привычки" }
    if (!includeSubmenus) return pages.map { SwipeDestination(it) }
    return pages.flatMap { page -> when (page) {
        "Задачи" -> listOf("tasks", "lists").map { SwipeDestination(page, it) }
        "Проекты" -> (listOf("all") + categoryIds.distinct()).map { SwipeDestination(page, it) }
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

/** Reads horizontal gestures before nested scrollers, while leaving vertical scroll and taps intact. */
@Composable
internal fun rememberMenuSwipeModifier(enabled: Boolean, onSwipe: (Int) -> Unit): Modifier {
    val latest by rememberUpdatedState(onSwipe)
    if (!enabled) return Modifier
    return Modifier.pointerInput(enabled) {
        val threshold = 72.dp.toPx()
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            var dx = 0f
            var dy = 0f
            var horizontal = false
            var vertical = false
            do {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                val delta = change.position - change.previousPosition
                dx += delta.x
                dy += delta.y
                if (!horizontal && !vertical) {
                    horizontal = abs(dx) > viewConfiguration.touchSlop && abs(dx) > abs(dy) * 1.2f
                    vertical = abs(dy) > viewConfiguration.touchSlop && abs(dy) > abs(dx)
                }
                if (horizontal) change.consume()
                if (!change.pressed || vertical) break
            } while (true)
            if (horizontal && abs(dx) >= threshold) latest(if (dx < 0) 1 else -1)
        }
    }
}
