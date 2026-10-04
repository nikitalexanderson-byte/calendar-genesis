package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.time.LocalDate
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.TheokyklosCatalogSource
import ru.genesis.calendar.domain.TheokyklosPractice
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.domain.habits.HabitEngine

/** The same 14-sector catalog and practice identities used on the site and in Theokyklos. */
@Composable
internal fun SacredHabitsBlock(workspace: LocalHabitWorkspace, today: LocalDate, calendarMode: CalendarMode,
    disabled: Boolean, requestedOpen: Boolean, onRequestedOpenConsumed: () -> Unit,
    onStart: (TheokyklosPractice) -> Unit, onEdit: (Habit) -> Unit,
    onComplete: (Habit,Boolean) -> Unit, onToggle: (Habit) -> Unit) {
    val context=LocalContext.current
    val english=LocalGenesisLanguage.current=="en"
    val catalog=remember(context,english) {
        runCatching { TheokyklosCatalogSource.load(context,if(english)"en" else "ru") }.getOrNull()
    }
    var open by rememberSaveable { mutableStateOf(false) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(requestedOpen) {
        if(requestedOpen) { open=true;onRequestedOpenConsumed() }
    }
    Surface(Modifier.fillMaxWidth().testTag("sacred-habits-block"),shape=RoundedCornerShape(20.dp),
        color=MaterialTheme.colorScheme.surfaceContainerHigh,
        border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            FilledTonalButton(onClick={open=!open},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)
                .testTag("sacred-habits-toggle")) {
                Text(if(open)"⌃  ${if(english)"Hide sacred habits" else "Скрыть сакральные привычки"}"
                    else "⌄  ${if(english)"Sacred habits" else "Сакральные привычки"}")
            }
            if(open) {
                Text(if(english)"THEOKYKLOS · EMBODIED MYTH" else "ТЕОКИКЛОС · ВОПЛОЩЁННЫЙ МИФ",
                    style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary)
                Text(if(english)"Each practice is a trackable everyday action inspired by a myth and patron deity."
                    else "Каждая практика — отслеживаемое действие, связанное с мифом и божеством-покровителем.",
                    style=MaterialTheme.typography.bodySmall)
                if(catalog==null) Text(if(english)"The sacred practice catalog is unavailable."
                    else "Каталог сакральных практик недоступен.",color=MaterialTheme.colorScheme.error)
                else catalog.sectors.chunked(2).forEach { pair ->
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        pair.forEach { sector ->
                            val started=workspace.habits.count { it.sacredSectorId==sector.id }
                            OutlinedCard(onClick={selectedId=sector.id},modifier=Modifier.weight(1f).heightIn(min=92.dp)
                                .testTag("sacred-sector-${sector.id}"),enabled=!disabled) {
                                Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                                    OriginalImage(sector.symbolArt,null,Modifier.size(28.dp))
                                    Text(if(english)sector.short.en else sector.short.ru,
                                        style=MaterialTheme.typography.titleSmall,maxLines=2)
                                    Text(if(started>0)"$started/${catalog.practicesFor(sector.id).size}"
                                        else if(english)sector.patrons.en else sector.patrons.ru,
                                        style=MaterialTheme.typography.labelSmall,maxLines=2)
                                }
                            }
                        }
                        if(pair.size==1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
    val sector=selectedId?.let { catalog?.byId?.get(it) }
    if(sector!=null && catalog!=null) {
        val engine=remember { HabitEngine(GenesisCalendar()) }
        Dialog(onDismissRequest={selectedId=null},properties=DialogProperties(usePlatformDefaultWidth=false)) {
            Surface(Modifier.fillMaxWidth(.94f).fillMaxHeight(.91f),shape=RoundedCornerShape(22.dp),
                color=MaterialTheme.colorScheme.surface) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                        OriginalImage(sector.symbolArt,null,Modifier.size(42.dp))
                        Column(Modifier.weight(1f).padding(start=8.dp)) {
                            Text(if(english)sector.title.en else sector.title.ru,
                                style=MaterialTheme.typography.titleLarge)
                            Text(if(english)sector.patrons.en else sector.patrons.ru,
                                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick={selectedId=null},modifier=Modifier.testTag("sacred-sector-close")) {
                            Text("×",style=MaterialTheme.typography.headlineSmall)
                        }
                    }
                    OriginalImage(sector.art,if(english)sector.title.en else sector.title.ru,
                        Modifier.fillMaxWidth().height(150.dp))
                    Text(if(english)sector.essence.en else sector.essence.ru,
                        style=MaterialTheme.typography.titleSmall)
                    Text(if(english)sector.description.en else sector.description.ru,
                        style=MaterialTheme.typography.bodySmall)
                    HorizontalDivider()
                    Text(if(english)"Choose a sacred habit" else "Выберите сакральную привычку",
                        style=MaterialTheme.typography.titleMedium)
                    catalog.practicesFor(sector.id).forEach { practice ->
                        val habit=workspace.habits.firstOrNull { it.sacredPracticeId==practice.id }
                        val entry=habit?.let { found -> workspace.completions.firstOrNull {
                            it.habitId==found.id && it.date==today } }
                        val scheduled=habit?.let { runCatching { engine.isScheduled(it,today) }.getOrDefault(false) } == true
                        Card(Modifier.fillMaxWidth().testTag("sacred-practice-${practice.id}"),
                            colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surfaceContainerHigh)) {
                            Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                                Text("${habit?.emoji ?: practice.emoji} ${habit?.title ?: if(english)practice.title.en else practice.title.ru}",
                                    style=MaterialTheme.typography.titleMedium)
                                Text(habit?.description ?: if(english)practice.description.en else practice.description.ru,
                                    style=MaterialTheme.typography.bodyMedium)
                                Text(if(english)practice.myth.en else practice.myth.ru,
                                    style=MaterialTheme.typography.bodySmall,
                                    color=MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(if(habit==null) {
                                    if(english)"Suggested ${practice.suggestedTime} · priority ${practice.priority}"
                                    else "Рекомендуется ${practice.suggestedTime} · приоритет ${practice.priority}"
                                } else {
                                    if(english) "${if(habit.active)"Active" else "Paused"} · " +
                                        (if(scheduled)"scheduled today" else "not scheduled today")
                                    else "${if(habit.active)"Активна" else "На паузе"} · " +
                                        (if(scheduled)"запланирована сегодня" else "сегодня не запланирована")
                                },style=MaterialTheme.typography.labelSmall)
                                if(habit==null) Button(onClick={onStart(practice)},enabled=!disabled) {
                                    Text(if(english)"Begin practice" else "Начать практику")
                                } else {
                                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                                        TextButton(onClick={selectedId=null;onEdit(habit)},enabled=!disabled) {
                                            Text(if(english)"Edit" else "Изменить")
                                        }
                                        if(habit.active) {
                                            TextButton(onClick={onComplete(habit,entry?.completed!=true)},
                                                enabled=!disabled&&scheduled) {
                                                Text(if(entry?.completed==true)"✓ ${if(english)"Done" else "Выполнено"}"
                                                    else if(english)"Mark today" else "Отметить")
                                            }
                                        }
                                    }
                                    OutlinedButton(onClick={onToggle(habit)},enabled=!disabled) {
                                        Text(if(habit.active) { if(english)"Pause" else "Пауза" }
                                            else if(english)"Resume" else "Возобновить")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
