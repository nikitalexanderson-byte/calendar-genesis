package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.HabitEngine
import java.time.LocalDate

/** Read-only completion matrix. Its calendar changes the viewed period, never recurrence rules. */
@Composable
internal fun HabitCompletionCalendar(workspace: LocalHabitWorkspace, today: LocalDate,
    initialMode: CalendarMode) {
    val calendar = remember { GenesisCalendar() }
    val engine = remember(calendar) { HabitEngine(calendar) }
    var selectedMode by rememberSaveable { mutableStateOf<CalendarMode?>(null) }
    LaunchedEffect(initialMode) { selectedMode = null }
    var anchorValue by rememberSaveable { mutableStateOf(today.toString()) }
    val enabledCalendars = LocalEnabledCalendars.current
    val mode = (selectedMode ?: initialMode).takeIf { it in enabledCalendars }
        ?: enabledCalendars.firstOrNull() ?: initialMode
    val range = remember(anchorValue, mode) { calendar.monthRange(LocalDate.parse(anchorValue), mode) }
    val days = remember(range) { range.dates() }
    val columns = if (mode == CalendarMode.SACRED) 5 else 7
    val scheduled = workspace.habits.filter { it.active }.sumOf { habit ->
        days.count { day -> !day.isAfter(today) && engine.isScheduled(habit, day) }
    }
    val completed = workspace.completions.count { entry ->
        entry.completed && !entry.date.isBefore(range.start) && !entry.date.isAfter(range.end)
            && !entry.date.isAfter(today) && workspace.habits.any { it.id == entry.habitId && it.active }
    }
    Surface(Modifier.fillMaxWidth(), shape=RoundedCornerShape(20.dp), color=Color(0xff0b2b2d),
        border=BorderStroke(1.dp,Color(0x88dfc17e))) {
        Column(Modifier.padding(14.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text("Календарь выполнения привычек", color=Color(0xfffff5df),
                style=MaterialTheme.typography.titleLarge)
            Row(verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                CalendarModeSwitcher(mode, { selectedMode=nextAvailableCalendarMode(mode, enabledCalendars) }, size=42.dp)
                Text(mobileCalendarCopy(LocalGenesisLanguage.current).calendarName(mode),
                    Modifier.weight(1f), color=Color(0xffc8d9d4),
                    style=MaterialTheme.typography.bodySmall)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.SpaceBetween) {
                TextButton(onClick={anchorValue=range.start.minusDays(1).toString()}) {
                    Text("←", color=Color(0xffdfc17e))
                }
                Text(calendar.formatDate(range.start,mode), color=Color(0xfffff5df),
                    style=MaterialTheme.typography.bodyMedium)
                TextButton(onClick={anchorValue=range.end.plusDays(1).toString()},
                    enabled=range.end.isBefore(today)) {
                    Text("→", color=Color(0xffdfc17e))
                }
            }
            Text("$completed / $scheduled", color=Color(0xffdfc17e),
                style=MaterialTheme.typography.titleMedium)
            if (workspace.habits.isEmpty()) Text("Создайте привычку, чтобы увидеть её историю.",
                color=Color(0xffc8d9d4),style=MaterialTheme.typography.bodySmall)
            workspace.habits.forEach { habit ->
                val marked = workspace.completions.filter { it.habitId==habit.id && it.completed }
                    .map { it.date }.toHashSet()
                Column(verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    Text("${habit.emoji} ${habit.title}", color=Color(0xfffff5df),
                        style=MaterialTheme.typography.titleSmall)
                    days.chunked(columns).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                            row.forEach { day ->
                                val done = day in marked
                                val planned = !day.isAfter(today) && habit.active && engine.isScheduled(habit,day)
                                val label = when(mode) {
                                    CalendarMode.PROFANE -> day.dayOfMonth
                                    CalendarMode.SACRED -> calendar.sacredDate(day).day
                                    CalendarMode.LUNAR -> calendar.lunarDate(day).day
                                }
                                Surface(Modifier.weight(1f).heightIn(min=27.dp),
                                    shape=RoundedCornerShape(6.dp),
                                    color=when {
                                        done -> Color(0xffdfc17e)
                                        planned -> Color(0xff365b55)
                                        else -> Color(0xff183838)
                                    }) {
                                    Box(contentAlignment=Alignment.Center) {
                                        Text(label.toString(), color=if(done) Color(0xff0b2b2d)
                                            else Color(0xffc8d9d4),
                                            style=MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                            repeat(columns-row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
            Text("Золотой — выполнено · зелёный — запланировано",
                color=Color(0xffc8d9d4), style=MaterialTheme.typography.labelSmall)
        }
    }
}
