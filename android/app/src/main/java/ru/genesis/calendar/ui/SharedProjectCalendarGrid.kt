package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import ru.genesis.calendar.domain.*
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/** Shared tasks use the same cells, date arithmetic and artwork as the main calendar. */
@Composable internal fun SharedProjectCalendarGrid(calendar: GenesisCalendar, anchor: LocalDate, mode: CalendarMode,
    selected: LocalDate, sundayFirst: Boolean, counts: JSONObject, onChoose: (LocalDate) -> Unit,
    dropBounds: MutableMap<String, Rect>, draggingAt: Offset?) {
    val range = remember(anchor, mode) { calendar.monthRange(anchor, mode) }
    val dates = when (mode) {
        CalendarMode.PROFANE -> gregorianGridDates(range, sundayFirst)
        // Lunar decades and sacred pentads are intrinsic to these calendars.
        else -> range.dates()
    }
    val columns = if (mode == CalendarMode.PROFANE) 7 else 5
    val locale = Locale.forLanguageTag(LocalGenesisLanguage.current)
    val sharedCounts = range.dates().associate { it.toString() to counts.optInt(it.toString()) }
    DisposableEffect(range, mode) { onDispose { dropBounds.clear() } }
    CompositionLocalProvider(LocalSharedCalendarCounts provides sharedCounts) {
    Surface(Modifier.fillMaxWidth().testTag("shared-calendar-grid"), shape = AffairsLayout.shape,
        color = MaterialTheme.colorScheme.surfaceContainerLow, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        BoxWithConstraints(Modifier.padding(4.dp)) {
        Column(Modifier.horizontalScroll(rememberScrollState()).width(maxOf(maxWidth, (columns * 48 + columns - 1).dp)),
            verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (mode == CalendarMode.PROFANE) Row(Modifier.fillMaxWidth()) {
                val first = if (sundayFirst) java.time.DayOfWeek.SUNDAY else java.time.DayOfWeek.MONDAY
                repeat(7) { index -> Text(first.plus(index.toLong()).getDisplayName(TextStyle.SHORT, locale),
                    Modifier.weight(1f), style = MaterialTheme.typography.labelSmall) }
            }
            dates.chunked(columns).forEachIndexed { row, week ->
                if (mode == CalendarMode.LUNAR && row % 2 == 0) Text(
                    listOf("Декада Роста", "Декада Полноты", "Декада Исхода")[(row / 2).coerceAtMost(2)],
                    style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 4.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                    week.forEach { date ->
                        val adjacent = date !in range.start..range.end
                        val bounds = dropBounds[date.toString()]
                        val hovered = !adjacent && draggingAt != null && bounds?.contains(draggingAt) == true
                        val cell = Modifier.weight(1f).height(84.dp).onGloballyPositioned {
                            if (!adjacent) dropBounds[date.toString()] = it.boundsInWindow()
                        }
                        if (mode == CalendarMode.LUNAR) LunarCalendarDay(calendar, date, selected == date || hovered, onChoose,
                            cell, 0, adjacent, .42f, onChoose, null)
                        else {
                            val sacred = calendar.sacredDate(date)
                            CalendarDay(calendar, date, if (mode == CalendarMode.SACRED) sacred.day else date.dayOfMonth,
                                if (mode == CalendarMode.SACRED) listOf("I", "II", "III", "IIII", "V")[(sacred.day - 1) % 5] else null,
                                calendar.formatDate(date, mode), selected == date || hovered, onChoose, cell,
                                calendar.moonInfo(date), if (mode == CalendarMode.SACRED) "${date.dayOfMonth}.${date.monthValue}" else null,
                                0, null, patron = if (mode == CalendarMode.PROFANE) weekdayPatronMark(date) else null,
                                adjacent = adjacent, onTaskBadgeClick = onChoose)
                        }
                    }
                    repeat(columns - week.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        }
    }
    }
}
