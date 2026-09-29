package ru.genesis.calendar.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Horizontal touch slop leaves vertical scrolling and taps to the calendar's children. */
@Composable
internal fun <T : Any> CalendarPeriodPager(period: T, previousPeriod: T?, nextPeriod: T?,
    onPrevious: () -> Unit, onNext: () -> Unit,
    modifier: Modifier = Modifier, fillHeight: Boolean = false,
    content: @Composable (T, () -> Unit, () -> Unit) -> Unit) {
    var dragPixels by remember(period) { mutableFloatStateOf(0f) }
    var incoming by remember(period) { mutableStateOf<Pair<T, Int>?>(null) }
    var width by remember { mutableIntStateOf(0) }
    var settling by remember { mutableStateOf(false) }
    var motionJob by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    val threshold = with(LocalDensity.current) { 64.dp.toPx() }
    val previous by rememberUpdatedState(onPrevious)
    val next by rememberUpdatedState(onNext)
    val previousPage by rememberUpdatedState(previousPeriod)
    val nextPage by rememberUpdatedState(nextPeriod)
    DisposableEffect(period) {
        onDispose { motionJob?.cancel(); settling = false }
    }
    val finish: (Int) -> Unit = { step ->
        settling = true
        motionJob = scope.launch {
            try {
                val destination = -step * width.toFloat()
                val duration = (abs(destination - dragPixels) / width.coerceAtLeast(1) * 420)
                    .roundToInt().coerceIn(180, 420)
                Animatable(dragPixels).animateTo(destination,
                    if (step == 0) spring(dampingRatio = 1f, stiffness = 240f)
                    else tween(duration, easing = CubicBezierEasing(.22f, .8f, .22f, 1f))) {
                    dragPixels = value
                }
                if (step < 0) previous() else if (step > 0) next()
            } finally {
                dragPixels = 0f; incoming = null; settling = false
            }
        }
    }
    val navigate: (Int) -> Unit = { step ->
        if (!settling) {
            val page = if (step < 0) previousPage else nextPage
            if (page == null || width == 0) {
                if (step < 0) previous() else next()
            } else {
                incoming = page to step
                finish(step)
            }
        }
    }
    Box(modifier.clip(RoundedCornerShape(24.dp)).onSizeChanged { width = it.width }
        .animateContentSize(tween(320, easing = CubicBezierEasing(.22f, .8f, .22f, 1f)))
        .pointerInput(period, threshold) {
        detectHorizontalDragGestures(
            onDragCancel = { if (!settling) finish(0) },
            onDragEnd = {
                if (!settling) {
                    if (abs(dragPixels) >= threshold) navigate(if (dragPixels < 0) 1 else -1)
                    else finish(0)
                }
            },
            onHorizontalDrag = { change, amount ->
                if (!settling) {
                    change.consume()
                    dragPixels = (dragPixels + amount).coerceIn(-size.width * .85f, size.width * .85f)
                    incoming = if (dragPixels < 0) nextPage?.let { it to 1 }
                        else previousPage?.let { it to -1 }
                }
            })
    }) {
        val pageModifier = if (fillHeight) Modifier.fillMaxSize() else Modifier.fillMaxWidth()
        key(period) {
            Box(pageModifier.offset { IntOffset(dragPixels.roundToInt(), 0) }) {
                content(period, { navigate(-1) }, { navigate(1) })
            }
        }
        incoming?.let { (page, step) ->
            key(page) {
                Box(pageModifier.offset { IntOffset((dragPixels + step * width).roundToInt(), 0) }) {
                    content(page, { navigate(-1) }, { navigate(1) })
                }
            }
        }
    }
}

@Composable
internal fun CalendarPeriodNavigation(title: String, year: Boolean,
    onPrevious: () -> Unit, onNext: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val english = LocalGenesisLanguage.current == "en"
    Column(Modifier.fillMaxWidth().testTag(if (year) "calendar-year-navigation" else "calendar-month-navigation")
        .background(Brush.verticalGradient(listOf(colors.primaryContainer, colors.surfaceContainerLow)))
        .padding(horizontal = 8.dp, vertical = 10.dp)) {
        Row(Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PeriodArrow(-1, if (year) "year" else "month", onPrevious)
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(if (english) { if (year) "YEAR" else "MONTH" } else if (year) "ГОД" else "МЕСЯЦ",
                color = colors.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
            Text(title, Modifier.testTag(if (year) "calendar-year-period" else "calendar-month-period"),
                color = colors.onSurface, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        }
        PeriodArrow(1, if (year) "year" else "month", onNext)
        }
        Row(Modifier.fillMaxWidth().padding(top = 5.dp)
            .testTag(if (year) "calendar-year-swipe-hint" else "calendar-month-swipe-hint"),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            val ink = colors.onSurfaceVariant
            Canvas(Modifier.size(28.dp).padding(end = 6.dp)) {
                val middle = size.height / 2
                drawLine(ink, Offset(2.dp.toPx(), middle), Offset(size.width - 2.dp.toPx(), middle), 1.dp.toPx(), StrokeCap.Round)
                for (side in listOf(-1, 1)) {
                    val tip = if (side < 0) 2.dp.toPx() else size.width - 2.dp.toPx()
                    val tail = tip - side * 4.dp.toPx()
                    drawLine(ink, Offset(tail, middle - 3.dp.toPx()), Offset(tip, middle), 1.dp.toPx(), StrokeCap.Round)
                    drawLine(ink, Offset(tip, middle), Offset(tail, middle + 3.dp.toPx()), 1.dp.toPx(), StrokeCap.Round)
                }
            }
            Text(if (english) "Swipe left or right" else "Смахните влево или вправо",
                style = MaterialTheme.typography.labelSmall, color = ink)
        }
    }
}

@Composable
private fun PeriodArrow(direction: Int, period: String, onClick: () -> Unit) {
    val english = LocalGenesisLanguage.current == "en"
    val label = if (english) "${if (direction < 0) "Previous" else "Next"} $period"
        else "${if (direction < 0) "Предыдущий" else "Следующий"} ${if (period == "year") "год" else "месяц"}"
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val shift by animateFloatAsState(if (pressed) direction * 3f else 0f, spring(stiffness = Spring.StiffnessLow), label = "arrow-press")
    val ink = MaterialTheme.colorScheme.primary
    androidx.compose.material3.Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .35f))) {
        IconButton(onClick, Modifier.size(48.dp).testTag("calendar-$period-${if (direction < 0) "previous" else "next"}")
            .semantics { contentDescription = label }, interactionSource = interaction) {
            val density = LocalDensity.current
            Canvas(Modifier.size(24.dp).offset { IntOffset(with(density) { shift.dp.roundToPx() }, 0) }) {
                val tip = size.width * if (direction < 0) .32f else .68f
                val tail = size.width * if (direction < 0) .66f else .34f
                drawLine(ink, Offset(tail, size.height * .24f), Offset(tip, size.height * .5f), 2.dp.toPx(), StrokeCap.Round)
                drawLine(ink, Offset(tip, size.height * .5f), Offset(tail, size.height * .76f), 2.dp.toPx(), StrokeCap.Round)
            }
        }
    }
}
