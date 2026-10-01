package ru.genesis.calendar.ui

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.offset
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

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

internal fun menuSwipeSequence(includeSubmenus: Boolean, habitsEnabled: Boolean): List<SwipeDestination> {
    val pages = listOf("Сегодня", "Задачи", "Проекты", "Календарь", "Привычки", "Стойхейон", "Теокиклос", "Настройки")
        .filter { habitsEnabled || it != "Привычки" }
    if (!includeSubmenus) return pages.map { SwipeDestination(it) }
    return pages.flatMap { page -> when (page) {
        "Задачи" -> listOf("tasks", "lists").map { SwipeDestination(page, it) }
        "Проекты" -> listOf(SwipeDestination(page))
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

/** Follows the finger, then settles the adjacent destination into place. */
@Composable
internal fun MenuSwipePager(current: SwipeDestination, sequence: List<SwipeDestination>,
    enabled: Boolean, onNavigate: (SwipeDestination) -> Unit,
    modifier: Modifier = Modifier, content: @Composable (SwipeDestination) -> Unit) {
    var width by remember { mutableIntStateOf(0) }
    var offset by remember { mutableFloatStateOf(0f) }
    var incoming by remember { mutableStateOf<SwipeDestination?>(null) }
    var settling by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val previous = nextMenuSwipeDestination(sequence, current.page, current.section, -1)
    val next = nextMenuSwipeDestination(sequence, current.page, current.section, 1)
    val gesture = if (!enabled) Modifier else Modifier.pointerInput(current, previous, next, width) {
        val threshold = minOf(72.dp.toPx(), width * .22f)
        val flingVelocity = 1_100.dp.toPx()
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            if (settling) return@awaitEachGesture
            val velocity = VelocityTracker().apply { addPosition(down.uptimeMillis, down.position) }
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
                velocity.addPosition(change.uptimeMillis, change.position)
                if (!horizontal && !vertical) {
                    horizontal = abs(dx) > viewConfiguration.touchSlop && abs(dx) > abs(dy) * 1.2f
                    vertical = abs(dy) > viewConfiguration.touchSlop && abs(dy) > abs(dx)
                }
                if (horizontal) {
                    change.consume()
                    incoming = if (dx < 0) next else previous
                    offset = if (incoming == null) dx * .16f
                        else dx.coerceIn(-width.toFloat(), width.toFloat())
                }
                if (!change.pressed || vertical) break
            } while (true)
            if (horizontal) {
                val destination = incoming?.takeIf {
                    abs(offset) >= threshold ||
                        abs(velocity.calculateVelocity().x) >= flingVelocity && abs(offset) >= 24.dp.toPx()
                }
                val target = if (destination == null) 0f else if (offset < 0) -width.toFloat() else width.toFloat()
                val start = offset
                settling = true
                scope.launch {
                    try {
                        if (ValueAnimator.areAnimatorsEnabled()) {
                            val duration = (260f * abs(target - start) / width.coerceAtLeast(1))
                                .roundToInt().coerceIn(120, 320)
                            Animatable(start).animateTo(target,
                                tween(duration, easing = CubicBezierEasing(.16f, 1f, .3f, 1f))) {
                                offset = value
                            }
                        }
                        if (destination != null) onNavigate(destination)
                    } finally {
                        offset = 0f
                        incoming = null
                        settling = false
                    }
                }
            }
        }
    }
    Box(modifier.fillMaxSize().clipToBounds().onSizeChanged { width = it.width }.then(gesture)) {
        incoming?.let { destination ->
            key(destination) {
                Box(Modifier.fillMaxSize().offset {
                    IntOffset((offset + if (offset < 0) width else -width).roundToInt(), 0)
                }) { content(destination) }
            }
        }
        key(current) {
            Box(Modifier.fillMaxSize().offset { IntOffset(offset.roundToInt(), 0) }) {
                content(current)
            }
        }
    }
}
