package ru.genesis.calendar.ui

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import kotlin.math.*

internal enum class GenesisPageIcon { TODAY, TASKS, PROJECTS, CALENDAR, MONTH, YEAR, HABITS, STOICHEION, THEOKYKLOS, SETTINGS, TRACKERS }

internal fun genesisPageIcon(title: String): GenesisPageIcon = when (title.trim()) {
    "Сегодня", "Today" -> GenesisPageIcon.TODAY
    "Задачи", "Tasks" -> GenesisPageIcon.TASKS
    "Проекты", "Projects" -> GenesisPageIcon.PROJECTS
    "Календарь", "Calendar" -> GenesisPageIcon.CALENDAR
    "Календарь - месяц", "Calendar - month" -> GenesisPageIcon.MONTH
    "Календарь - год", "Calendar - year" -> GenesisPageIcon.YEAR
    "Привычки", "Habits" -> GenesisPageIcon.HABITS
    "Стойхейон", "Stoicheion" -> GenesisPageIcon.STOICHEION
    "Теокиклос", "Theokyklos" -> GenesisPageIcon.THEOKYKLOS
    "Сон и настроение", "Sleep & mood" -> GenesisPageIcon.TRACKERS
    else -> GenesisPageIcon.SETTINGS
}

@Composable
internal fun rememberIconPhase(label: String, durationMillis: Int, animated: Boolean = true): Float {
    if (!animated || !ValueAnimator.areAnimatorsEnabled()) return 0f
    return rememberInfiniteTransition(label = label).animateFloat(0f, 1f,
        infiniteRepeatable(tween(durationMillis, easing = LinearEasing)), label = "$label-motion").value
}

private fun inkProgress(phase: Float, index: Int = 0): Float {
    val drawStart = index * .13f
    val eraseStart = .62f + index * .12f
    return minOf(((phase - drawStart) / .18f).coerceIn(0f, 1f),
        (1f - (phase - eraseStart) / .13f).coerceIn(0f, 1f))
}

/** Original vector paths on a 24-unit grid. Buttons and headings share the same geometry. */
@Composable
internal fun GenesisVectorIcon(icon: GenesisPageIcon, modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current, animated: Boolean = false) {
    val moving = animated && ValueAnimator.areAnimatorsEnabled()
    val phase = rememberIconPhase("genesis-icon-${icon.name}",
        if (icon == GenesisPageIcon.TASKS || icon == GenesisPageIcon.PROJECTS) 7_200 else 12_000, moving)
    Canvas(modifier.testTag("genesis-icon-${icon.name.lowercase()}-${if (animated) "animated" else "static"}")
        .clearAndSetSemantics { }) {
        val stroke = Stroke(1.55f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        withTransform({ scale(size.width / 24f, size.height / 24f, Offset.Zero) }) {
            fun line(a: Offset, b: Offset, color: Color = tint) = drawLine(color, a, b, 1.55f, StrokeCap.Round)
            fun path(a: Offset, b: Offset, c: Offset? = null, d: Offset? = null, e: Offset? = null,
                f: Offset? = null, g: Offset? = null, h: Offset? = null, j: Offset? = null, color: Color = tint) {
                drawPath(Path().apply { listOfNotNull(a, b, c, d, e, f, g, h, j).forEachIndexed { i, p ->
                    if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) } }, color, style = stroke)
            }
            fun orbit(radius: Float, angle: Float, dot: Float = 1.1f) {
                val radians = angle * PI / 180
                drawCircle(tint, dot, Offset(12 + cos(radians).toFloat() * radius, 12 + sin(radians).toFloat() * radius))
            }
            fun inkPath(points: List<Offset>, progress: Float) {
                if (progress <= 0f) return
                var remaining = points.zipWithNext().sumOf { (a, b) -> (b - a).getDistance().toDouble() }
                    .toFloat() * progress.coerceAtMost(1f)
                val ink = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    for ((a, b) in points.zipWithNext()) {
                        if (remaining <= 0f) break
                        val length = (b - a).getDistance()
                        val end = a + (b - a) * minOf(1f, remaining / length)
                        lineTo(end.x, end.y)
                        remaining -= length
                    }
                }
                drawPath(ink, tint, style = stroke)
            }
            when (icon) {
                GenesisPageIcon.TODAY -> {
                    drawCircle(tint.copy(alpha = .12f), 5f, Offset(12f, 12f))
                    drawCircle(tint, 4.2f, Offset(12f, 12f), style = stroke)
                    rotate(phase * 45, Offset(12f, 12f)) { repeat(8) { i ->
                        val angle = i * PI / 4
                        line(Offset(12 + cos(angle).toFloat() * 7, 12 + sin(angle).toFloat() * 7),
                            Offset(12 + cos(angle).toFloat() * 9.7f, 12 + sin(angle).toFloat() * 9.7f))
                    } }
                    drawCircle(tint, 1f, Offset(12f, 12f))
                }
                GenesisPageIcon.TASKS -> {
                    drawRoundRect(tint, Offset(3.5f, 3f), Size(17f, 18f), androidx.compose.ui.geometry.CornerRadius(2.6f), style = stroke)
                    listOf(7f, 12f, 17f).forEachIndexed { i, y ->
                        inkPath(listOf(Offset(6f, y), Offset(7.2f, y + 1.2f), Offset(9.5f, y - 1.4f)),
                            if (moving) inkProgress(phase, i) else 1f)
                        line(Offset(12f, y), Offset(17.8f, y))
                    }
                }
                GenesisPageIcon.PROJECTS -> {
                    path(Offset(3f, 19f), Offset(3f, 5f), Offset(9f, 5f), Offset(11f, 7f),
                        Offset(21f, 7f), Offset(21f, 19f), Offset(3f, 19f))
                    val tree = if (moving) inkProgress(phase) else 1f
                    inkPath(listOf(Offset(12f, 10.7f), Offset(12f, 13.6f)), (tree * 3).coerceIn(0f, 1f))
                    listOf(7f, 17f).forEach { x ->
                        inkPath(listOf(Offset(12f, 13.6f), Offset(x, 13.6f)), (tree * 3 - 1).coerceIn(0f, 1f))
                    }
                    listOf(7f, 12f, 17f).forEach { x ->
                        val branch = (tree * 3 - 2).coerceIn(0f, 1f)
                        inkPath(listOf(Offset(x, 13.6f), Offset(x, 16.6f)), branch)
                        if (branch > .8f) drawCircle(tint.copy(alpha = (branch - .8f) * 5), 1f, Offset(x, 16.6f))
                    }
                }
                GenesisPageIcon.CALENDAR, GenesisPageIcon.MONTH -> {
                    drawRoundRect(tint, Offset(3f, 4.5f), Size(18f, 16.5f), androidx.compose.ui.geometry.CornerRadius(2.7f), style = stroke)
                    line(Offset(7.5f, 2.5f), Offset(7.5f, 6.5f)); line(Offset(16.5f, 2.5f), Offset(16.5f, 6.5f))
                    line(Offset(3f, 9f), Offset(21f, 9f))
                    repeat(6) { i ->
                        val x = 7f + (i % 3) * 5; val y = 12.5f + (i / 3) * 4.3f
                        drawCircle(tint.copy(alpha = .55f), .9f, Offset(x, y))
                        if (i == if (animated) (phase * 6).toInt().coerceAtMost(5) else 4)
                            drawCircle(tint, 2f, Offset(x, y), style = Stroke(1.3f))
                    }
                }
                GenesisPageIcon.YEAR -> {
                    drawCircle(tint.copy(alpha = .45f), 9.1f, Offset(12f, 12f), style = Stroke(1.2f))
                    repeat(12) { i -> orbit(9.1f, i * 30f - 90f, if (i % 3 == 0) 1.2f else .65f) }
                    repeat(4) { i -> drawArc(tint.copy(alpha = .55f + .35f * abs(sin((phase + i / 4f) * 2 * PI)).toFloat()),
                        i * 90f - 80f, 65f, false, Offset(5.3f, 5.3f), Size(13.4f, 13.4f), style = Stroke(2.1f, cap = StrokeCap.Round)) }
                    path(Offset(8.7f, 12f), Offset(11.2f, 14.5f), Offset(15.3f, 9.4f))
                    if (animated) orbit(9.1f, phase * 360f - 90f)
                }
                GenesisPageIcon.HABITS -> {
                    drawCircle(tint.copy(alpha = .65f), 10f, Offset(12f, 12f), style = stroke)
                    // Even at the largest breath, the smaller plant has space inside the ring.
                    val leafScale = (1f / 1.5f) * if (moving) 1f + .08f * sin(phase * 4 * PI).toFloat() else 1f
                    scale(leafScale, leafScale, Offset(12f, 12f)) {
                    path(Offset(11.7f, 19f), Offset(11.7f, 10f), Offset(15.9f, 5.9f))
                    val leaf = Path().apply { moveTo(12f, 11f); cubicTo(12f, 6f, 16f, 5f, 18f, 6f); cubicTo(18f, 10f, 15f, 12f, 12f, 11f) }
                    drawPath(leaf, tint.copy(alpha = .13f)); drawPath(leaf, tint, style = stroke)
                    val lower = Path().apply { moveTo(11.6f, 15f); cubicTo(6f, 15f, 5f, 11f, 6f, 9.5f); cubicTo(10.5f, 9.5f, 12f, 12f, 11.6f, 15f) }
                    drawPath(lower, tint, style = stroke)
                    }
                    orbit(10f, phase * 360f - 90f, .9f)
                }
                GenesisPageIcon.STOICHEION -> {
                    rotate(if (animated) sin(phase * 2 * PI).toFloat() * 3 else 0f, Offset(12f, 12f)) {
                        drawRoundRect(tint.copy(alpha = .4f), Offset(2.8f, 4f), Size(15f, 18f), androidx.compose.ui.geometry.CornerRadius(2f), style = stroke)
                        drawRoundRect(tint, Offset(6f, 2f), Size(15f, 18f), androidx.compose.ui.geometry.CornerRadius(2f), style = stroke)
                        path(Offset(9.4f, 15.5f), Offset(13.5f, 6.5f), Offset(17.5f, 15.5f))
                        line(Offset(11f, 12.5f), Offset(16f, 12.5f))
                    }
                }
                GenesisPageIcon.THEOKYKLOS -> {
                    drawCircle(tint.copy(alpha = .7f), 9.2f, Offset(12f, 12f), style = stroke)
                    drawCircle(tint.copy(alpha = .4f), 5.7f, Offset(12f, 12f), style = Stroke(1f))
                    repeat(8) { i ->
                        val a = i * PI / 4 - PI / 2
                        line(Offset(12f, 12f), Offset(12 + cos(a).toFloat() * 9.2f, 12 + sin(a).toFloat() * 9.2f), tint.copy(alpha = .35f))
                        orbit(9.2f, i * 45f - 90f, .85f)
                    }
                    drawCircle(tint, 1.8f, Offset(12f, 12f))
                }
                GenesisPageIcon.SETTINGS -> rotate(phase * 45, Offset(12f, 12f)) {
                    val gear = Path().apply { repeat(32) { i ->
                        val radius = if (i % 4 in 1..2) 9.5f else 7.4f
                        val a = i * PI / 16 - PI / 2
                        val x = 12 + cos(a).toFloat() * radius; val y = 12 + sin(a).toFloat() * radius
                        if (i == 0) moveTo(x, y) else lineTo(x, y)
                    }; close() }
                    drawPath(gear, tint, style = stroke)
                    drawCircle(tint, 3.2f, Offset(12f, 12f), style = stroke)
                }
                GenesisPageIcon.TRACKERS -> {
                    val moon = Path().apply { moveTo(15f, 3f); cubicTo(4f, 2f, 1f, 19f, 13f, 21f); cubicTo(5f, 15f, 9f, 6f, 15f, 3f) }
                    drawPath(moon, tint, style = stroke)
                    path(Offset(12f, 14f), Offset(15f, 14f), Offset(17f, 10f), Offset(19f, 16f), Offset(21.5f, 12f))
                }
            }
        }
    }
}
