package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import ru.genesis.calendar.domain.CalendarMode

/** One native page heading, based on the existing Settings heading. */
@Composable
internal fun GenesisPageHeader(title: String, description: String, symbol: String,
    modifier: Modifier = Modifier, animatedMandala: Boolean = false, subtitle: String? = null,
    icon: GenesisPageIcon = genesisPageIcon(title), calendarMode: CalendarMode? = null,
    onCalendarModeClick: (() -> Unit)? = null,
    footer: (@Composable () -> Unit)? = null) {
    val compact = compactWindowHeight()
    val night = Color(0xff0b2b2d)
    val gold = Color(0xffdfc17e)
    val calendarCopy = mobileCalendarCopy(LocalGenesisLanguage.current)
    var switchCount by remember { mutableIntStateOf(0) }
    val canSwitch = calendarMode != null && onCalendarModeClick != null
    val switchCalendar = {
        switchCount++
        onCalendarModeClick?.invoke()
    }
    Surface(modifier.fillMaxWidth().testTag("genesis-page-header")
        .then(if (canSwitch) Modifier.semantics {
            contentDescription = "$title. ${calendarCopy.calendarName(requireNotNull(calendarMode))}. ${calendarCopy.switchHint}"
            onClick(label = calendarCopy.switchHint) { switchCalendar(); true }
        }.pointerInput(onCalendarModeClick) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val origin = down.position
                var moved = false
                while (true) {
                    val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                    if ((change.position - origin).getDistance() > viewConfiguration.touchSlop) moved = true
                    if (!change.pressed) {
                        if (!moved) switchCalendar()
                        break
                    }
                }
            }
        } else Modifier),
        shape = RoundedCornerShape(24.dp), color = night,
        border = BorderStroke(1.dp, gold.copy(alpha = .55f)), shadowElevation = 8.dp) {
        Box(Modifier.background(Brush.linearGradient(listOf(night, Color(0xff123b36))))) {
            if (canSwitch) CalendarPlaqueWave(switchCount)
            Column {
            Row(Modifier.padding(if (compact) 10.dp else 18.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                if (calendarMode != null && onCalendarModeClick != null)
                    CalendarModeSwitcher(calendarMode, {}, interactive = false,
                        animationTrigger = switchCount)
                else if (animatedMandala) TheokyklosHeaderMandala()
                else Surface(Modifier.size(54.dp).clearAndSetSemantics { },
                    shape = RoundedCornerShape(17.dp), color = Color(0xff173b38)) {
                    Box(contentAlignment = Alignment.Center) {
                        GenesisVectorIcon(icon, Modifier.size(38.dp), tint = gold, animated = true)
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(title, color = Color(0xfffff5df), style = if (compact) MaterialTheme.typography.titleLarge else MaterialTheme.typography.headlineSmall)
                    subtitle?.let {
                        Text(it, color = gold, style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.testTag("genesis-page-subtitle"))
                    }
                    androidx.compose.material3.Text(description, color = Color(0xffc8d9d4),
                        style = MaterialTheme.typography.bodySmall)
                    if (calendarMode != null) androidx.compose.material3.Text(
                        calendarCopy.switchHint,
                        color = gold, style = MaterialTheme.typography.labelSmall)
                }
            }
            footer?.let {
                Column(Modifier.fillMaxWidth().padding(start = if (compact) 10.dp else 18.dp,
                    end = if (compact) 10.dp else 18.dp, bottom = if (compact) 10.dp else 18.dp)) {
                    it()
                }
            }
            }
        }
    }
}

/** Small native interpretation of the site's living SVG mandala; no WebView is needed. */
@Composable
private fun TheokyklosHeaderMandala() {
    val angle = rememberIconPhase("theokyklos-heading", 18_000) * 360f
    val pulse = rememberIconPhase("theokyklos-rays", 1_800)
    val gold = Color(0xffdfc17e)
    Canvas(Modifier.size(54.dp).testTag("genesis-theokyklos-mandala").clearAndSetSemantics { }) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = size.minDimension * .39f
        drawCircle(Color(0xff173b38), radius = size.minDimension * .49f)
        drawCircle(gold.copy(alpha = .7f), radius, style = Stroke(width = 1.4.dp.toPx()))
        drawCircle(gold.copy(alpha = .45f), radius * .62f, style = Stroke(width = 1.dp.toPx()))
        repeat(8) { index ->
            val radians = index * PI / 4 - PI / 2
            val point = center + Offset((cos(radians) * radius).toFloat(),
                (sin(radians) * radius).toFloat())
            drawLine(gold.copy(alpha = .35f), center, point, strokeWidth = 1.dp.toPx())
            if (pulse > 0f) {
                val direction = point - center
                val tail = (pulse - .14f).coerceAtLeast(0f)
                drawLine(gold.copy(alpha = sin(pulse * PI).toFloat() * .8f),
                    center + direction * tail, center + direction * pulse,
                    strokeWidth = 1.1.dp.toPx(), cap = StrokeCap.Round)
            }
            drawCircle(gold, radius = 2.dp.toPx(), center = point)
        }
        drawArc(gold, startAngle = angle, sweepAngle = 80f, useCenter = false,
            topLeft = Offset(center.x - radius, center.y - radius),
            size = androidx.compose.ui.geometry.Size(radius * 2, radius * 2),
            style = Stroke(width = 2.4.dp.toPx(), cap = StrokeCap.Round))
        drawCircle(gold, radius = 4.dp.toPx(), center = center)
        drawCircle(Color(0xff0b2b2d), radius = 1.5.dp.toPx(), center = center)
    }
}
