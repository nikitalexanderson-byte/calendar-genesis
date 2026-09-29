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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.roundToInt

/** Horizontal touch slop leaves vertical scrolling and taps to the calendar's children. */
@Composable
internal fun <T> CalendarPeriodPager(period: T, onPrevious: () -> Unit, onNext: () -> Unit,
    modifier: Modifier = Modifier, fillHeight: Boolean = false,
    content: @Composable (T, () -> Unit, () -> Unit) -> Unit) {
    var direction by remember { mutableIntStateOf(1) }
    var dragging by remember { mutableStateOf(false) }
    var dragPixels by remember { mutableFloatStateOf(0f) }
    val threshold = with(LocalDensity.current) { 64.dp.toPx() }
    val previous by rememberUpdatedState(onPrevious)
    val next by rememberUpdatedState(onNext)
    val offset by animateFloatAsState(dragPixels,
        if (dragging) snap() else spring(stiffness = Spring.StiffnessMediumLow), label = "period-drag")
    val navigate: (Int) -> Unit = { step ->
        direction = step; dragging = false; dragPixels = 0f
        if (step < 0) previous() else next()
    }
    Box(modifier.clip(RoundedCornerShape(24.dp)).pointerInput(period, threshold) {
        detectHorizontalDragGestures(
            onDragStart = { dragging = true },
            onDragCancel = { dragging = false; dragPixels = 0f },
            onDragEnd = {
                if (abs(dragPixels) >= threshold) navigate(if (dragPixels < 0) 1 else -1)
                else { dragging = false; dragPixels = 0f }
            },
            onHorizontalDrag = { change, amount ->
                change.consume()
                dragPixels = (dragPixels + amount).coerceIn(-size.width * .45f, size.width * .45f)
            })
    }) {
        AnimatedContent(period,
            modifier = (if (fillHeight) Modifier.fillMaxSize() else Modifier.fillMaxWidth())
                .offset { IntOffset(offset.roundToInt(), 0) },
            transitionSpec = {
                (slideInHorizontally(tween(340, easing = FastOutSlowInEasing)) { it * direction } + fadeIn(tween(220)))
                    .togetherWith(slideOutHorizontally(tween(340, easing = FastOutSlowInEasing)) { -it * direction } + fadeOut(tween(180)))
                    .using(SizeTransform(clip = true))
            }, label = "calendar-period") { page -> content(page, { navigate(-1) }, { navigate(1) }) }
    }
}

@Composable
internal fun CalendarPeriodNavigation(title: String, year: Boolean,
    onPrevious: () -> Unit, onNext: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val english = LocalGenesisLanguage.current == "en"
    Row(Modifier.fillMaxWidth().testTag(if (year) "calendar-year-navigation" else "calendar-month-navigation")
        .background(Brush.verticalGradient(listOf(colors.primaryContainer, colors.surfaceContainerLow)))
        .padding(horizontal = 8.dp, vertical = 10.dp),
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
            Canvas(Modifier.size(24.dp).offset(x = shift.dp)) {
                val tip = size.width * if (direction < 0) .32f else .68f
                val tail = size.width * if (direction < 0) .66f else .34f
                drawLine(ink, Offset(tail, size.height * .24f), Offset(tip, size.height * .5f), 2.dp.toPx(), StrokeCap.Round)
                drawLine(ink, Offset(tip, size.height * .5f), Offset(tail, size.height * .76f), 2.dp.toPx(), StrokeCap.Round)
            }
        }
    }
}
