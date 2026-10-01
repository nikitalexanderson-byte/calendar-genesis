package ru.genesis.calendar.ui

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.time.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import ru.genesis.calendar.GenesisApplication
import ru.genesis.calendar.data.*
import ru.genesis.calendar.domain.*
import ru.genesis.calendar.domain.habits.*

@Composable
fun HabitsScreen(app: GenesisApplication, experimental: Boolean, inputCalendarMode: CalendarMode = CalendarMode.SACRED,
    displayCalendarMode: CalendarMode = CalendarMode.SACRED,
    menuSwipeState: MenuSwipeState? = null) {
    var localSection by rememberSaveable { mutableStateOf("Привычки") }
    val section = menuSwipeState?.habits ?: localSection
    Column(Modifier.fillMaxSize()) {
        ConnectedSubmenu(listOf(SubmenuItem("Привычки", "Привычки"), SubmenuItem("Сон и настроение", "Сон и настроение")),
            section, { localSection = it; menuSwipeState?.habits = it })
        Box(Modifier.weight(1f)) {
            if (section == "Привычки") HabitWorkspaceContent(app, experimental, inputCalendarMode, displayCalendarMode) else TrackersScreen(app)
        }
    }
}

@Composable
private fun HabitWorkspaceContent(app: GenesisApplication, experimental: Boolean, inputCalendarMode: CalendarMode,
    displayCalendarMode: CalendarMode) {
    val repository=remember(app) { HabitsRepository(app) }
    val scope=rememberCoroutineScope()
    var workspace by remember { mutableStateOf<LocalHabitWorkspace?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var storageError by remember { mutableStateOf(false) }
    var edit by remember { mutableStateOf<Habit?>(null) }
    var deleteCandidate by remember { mutableStateOf<Habit?>(null) }
    var editorOpen by remember { mutableStateOf(false) }
    var catalogueOpen by rememberSaveable { mutableStateOf(false) }
    var heroPathOpen by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var today by remember { mutableStateOf(LocalDate.now()) }
    val hapticFeedback = LocalHapticFeedback.current
    val language = LocalGenesisLanguage.current
    val english = language == "en"
    val engine=HabitEngine(GenesisCalendar())
    suspend fun runAction(action: suspend () -> Unit) {
        busy=true
        try { action(); error=null }
        catch(e: CancellationException) { throw e }
        catch(e: IllegalArgumentException) { error=e.message ?: "Проверьте введённые данные." }
        catch(_: Exception) { error="Не удалось сохранить привычки. Данные формы сохранены на экране." }
        finally { busy=false }
    }
    suspend fun completionFeedback(settings: HabitFeedbackSettings) {
        if (settings.haptics) hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
        if (settings.sound) {
            val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 35)
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 120)
            delay(140)
            tone.release()
        }
    }
    suspend fun recordCompletion(id: String, checked: Boolean, quality: Double?, settings: HabitFeedbackSettings) {
        val result = repository.complete(id, checked, quality)
        if (checked) {
            completionFeedback(settings)
            if (settings.achievementPopups && result.newlyUnlockedAchievements > 0)
                app.scheduler.showAchievementNotification(result.newlyUnlockedAchievements, language)
        }
    }
    LaunchedEffect(repository) {
        try { repository.workspace.collect { workspace=it; storageError=false } }
        catch(e: CancellationException) { throw e }
        catch(_: Exception) { storageError=true; error="Защищённые привычки недоступны. Новые записи не заменят сохранённые данные." }
    }
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle,repository) {
        val observer=LifecycleEventObserver { _,event -> if(event==Lifecycle.Event.ON_RESUME) {
            today=LocalDate.now(); scope.launch { runAction { repository.refresh() } }
        } }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(repository) { runAction { repository.refresh() } }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        val current=workspace
        GenesisPageHeader(if (english) "Habits" else "Привычки",
            if (english) "Daily practice, goals, streaks and progress"
            else "Ежедневные практики, цели, серии и прогресс", "◇",
            footer = if (current != null && current.settings.feedback.gamificationWidgets) {{
                val rank=HeroProgress.rankForProgress(current.progress)
                val goal=current.goals.firstOrNull { it.date==today }
                Column(Modifier.testTag("habit-daily-hero"),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    HorizontalDivider(color=Color(0xff46645e))
                    Text("ЕЖЕДНЕВНЫЙ РИТМ",style=MaterialTheme.typography.labelMedium,color=Color(0xffdfc17e))
                    Text(if(goal==null || goal.scheduledCount==0) "Свободный день" else
                        "Сегодня · ${goal.completedCount} из ${goal.scheduledCount}",
                        style=MaterialTheme.typography.headlineSmall,color=Color(0xfff8f3e8))
                    Text(if(goal==null || goal.scheduledCount==0)
                        "На сегодня нет запланированных привычек. Серия не изменится."
                        else "Дневная цель: ${goal.targetCount} · ${if(goal.status=="achieved") "достигнута" else "впереди"}",
                        style=MaterialTheme.typography.bodyMedium,color=Color(0xffd8e7df))
                    if(goal!=null && goal.scheduledCount>0) LinearProgressIndicator(
                        progress={ (goal.completedCount.toFloat()/goal.scheduledCount).coerceIn(0f,1f) },
                        modifier=Modifier.fillMaxWidth(),color=Color(0xffdfc17e),trackColor=Color(0xff46645e))
                    HorizontalDivider(color=Color(0xff46645e))
                    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                        heroRankThumbnailPath(rank)?.let { OriginalImage(it,rank.title,
                            Modifier.size(56.dp)) }
                        Column(verticalArrangement=Arrangement.spacedBy(2.dp)) {
                            Text("Путь Героя · ${rank.title}",style=MaterialTheme.typography.titleMedium,color=Color(0xfff8f3e8))
                            Text("${current.progress.lifetimeXp} XP · серия ${current.progress.currentStreak} дн.",
                                style=MaterialTheme.typography.bodySmall,color=Color(0xffd8e7df))
                        }
                    }
                    Text("Ритм ${current.progress.rhythmScore}%  ·  ${current.progress.laurelsBalance} лавров",
                        style=MaterialTheme.typography.labelMedium,color=Color(0xffdfc17e))
                }
            }} else null)
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        if(current==null) {
            if(!storageError) CircularProgressIndicator()
        } else {
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Button(enabled=!busy&&!storageError,onClick={edit=null;editorOpen=true},modifier=Modifier.weight(1f)) { Text("Новая привычка") }
                OutlinedButton(enabled=!busy&&!storageError,onClick={catalogueOpen=!catalogueOpen},modifier=Modifier.weight(1f)) {
                    Text(if(catalogueOpen) "Скрыть подборку" else "Подборка") }
            }
            if(catalogueOpen) HabitTemplateCatalog.templates
                .filterNot { it.id in current.hiddenDefaultTemplates }.forEach { template ->
                Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
                    Text("${template.icon} ${template.title}",style=MaterialTheme.typography.titleMedium)
                    Text(template.description)
                    TextButton(enabled=!busy&&!storageError,onClick={
                        val schedule=engine.defaultSchedule(today,CalendarMode.SACRED)
                        edit=Habit(TrackerEntity.create("habit"),template.title,today,
                            schedule.copy(recurrence=schedule.recurrence.copy(days=listOf(1,2,3,4,5))),description=template.description,
                            emoji=template.icon,color=template.color,sourceTemplateId=template.id,preferredTime=template.suggestedTime,
                            ritualId=when(template.suggestedTime.take(2).toIntOrNull() ?: -1) { in 0..11 -> "morning"; in 18..23 -> "evening"; else -> "day" },
                            reminder=HabitReminder(time=template.suggestedTime))
                        editorOpen=true; catalogueOpen=false
                    }) { Text("Добавить из библиотеки") }
                } }
            }
            Text("Мои привычки",style=MaterialTheme.typography.titleLarge)
            if(current.habits.isEmpty()) Text("Здесь появятся ваши практики. Выберите идею из подборки или создайте свою.",
                style=MaterialTheme.typography.bodyMedium)
            AdaptiveCardGrid(current.habits.sortedByDescending { it.priority }, { it.id }) { habit ->
                val entry=current.completions.firstOrNull { it.habitId==habit.id && it.date==today }
                val scheduled=runCatching { engine.isScheduled(habit,today) }.getOrDefault(false)
                if (experimental) ExperimentalHabitCard(habit, entry, scheduled, busy || storageError,
                    animate = current.settings.feedback.animations,
                    onComplete={checked,quality -> scope.launch { runAction {
                        recordCompletion(habit.id,checked,quality,current.settings.feedback)
                    } }},
                    onEdit={edit=habit;editorOpen=true},
                    onToggle={scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } }},
                    onDelete={deleteCandidate=habit})
                else Card((if (current.settings.feedback.animations) Modifier.animateContentSize() else Modifier).fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text("${habit.emoji} ${habit.title}",style=MaterialTheme.typography.titleMedium)
                    if(habit.description.isNotEmpty()) Text(habit.description)
                    Text(if(!habit.active) "На паузе" else if(scheduled) "Запланировано сегодня" else "Сегодня не запланировано",style=MaterialTheme.typography.bodySmall)
                    if(habit.scoringMode.startsWith("quality") && scheduled) {
                        var quality by remember(habit.id,entry?.qualityValue) { mutableFloatStateOf((entry?.qualityValue ?: if(habit.scoringMode=="quality-ten") 5.0 else 0.0).toFloat()) }
                        Text("Качество: ${quality.toInt()}")
                        Slider(value=quality,onValueChange={quality=it},enabled=!busy&&!storageError,valueRange=if(habit.scoringMode=="quality-ten") 1f..10f else -5f..5f,
                            steps=if(habit.scoringMode=="quality-ten") 8 else 9)
                        Button(enabled=!busy&&!storageError,onClick={scope.launch { runAction {
                            recordCompletion(habit.id,true,quality.toDouble(),current.settings.feedback)
                        } }}) { Text(if(entry?.completed==true) "Обновить оценку" else "Выполнено") }
                        if(entry?.completed==true) TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.complete(habit.id,false,entry.qualityValue) } }}) { Text("Снять отметку") }
                    } else Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Checkbox(checked=entry?.completed==true,enabled=scheduled&&!busy&&!storageError,
                            onCheckedChange={ checked -> scope.launch { runAction {
                                recordCompletion(habit.id,checked,null,current.settings.feedback)
                            } } })
                        Text(if(entry?.completed==true) "Выполнено · ${entry.score} баллов" else "Отметить выполнение",Modifier.padding(top=12.dp))
                    }
                    Row {
                        TextButton(enabled=!busy&&!storageError,onClick={edit=habit;editorOpen=true}) { Text("Изменить") }
                        TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } }}) { Text(if(habit.active) "Пауза" else "Продолжить") }
                        TextButton(enabled=!busy&&!storageError,onClick={deleteCandidate=habit},
                            colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error),
                            modifier=Modifier.testTag("delete-habit-${habit.id}")) { Text("Удалить") }
                    }
                } }
            }
            if (experimental && current.settings.feedback.gamificationWidgets) {
                Surface(Modifier.fillMaxWidth().testTag("habit-hero-path-section"),
                    shape = RoundedCornerShape(22.dp), color = Color(0xff0b2b2d),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x99dfc17e)),
                    shadowElevation = 8.dp) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Surface(Modifier.size(52.dp), shape = RoundedCornerShape(16.dp),
                                color = Color(0xffdfc17e)) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("✦", color = Color(0xff0b2b2d),
                                        style = MaterialTheme.typography.headlineSmall)
                                }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text("Путь Героя и награды",style=MaterialTheme.typography.titleLarge,
                                    color = Color(0xfffff6e2))
                                Text("Древо рангов, награды и полная статистика привычек. Накопленный XP не тратится.",
                                    style=MaterialTheme.typography.bodySmall,color=Color(0xffc8d9d4))
                            }
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(
                                "XP" to current.progress.lifetimeXp.toString(),
                                "Серия" to "${current.progress.currentStreak} дн.",
                                "Лавры" to current.progress.laurelsBalance.toString(),
                            ).forEach { (label, value) ->
                                Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp),
                                    color = Color(0xff143b39)) {
                                    Column(Modifier.padding(9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(value, color = Color(0xffffe4a6),
                                            style = MaterialTheme.typography.titleSmall)
                                        Text(label, color = Color(0xffb8ccc5),
                                            style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                        FilledTonalButton(onClick={heroPathOpen=!heroPathOpen},
                            modifier=Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("habit-hero-path-toggle"),
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = eveningSurface(Color(0xffdfc17e)),
                                contentColor = eveningInk(Color(0xff0b2b2d)))) {
                            Text(if(heroPathOpen) "Свернуть путь" else "Открыть путь и награды")
                        }
                    }
                }
                if(heroPathOpen) {
                    HabitCompletionCalendar(current, today, displayCalendarMode)
                    HabitArtGallery(current, today, busy,
                    onClaimAmphora = { rankId -> scope.launch { runAction { repository.claimHeroPathAmphora(rankId) } } },
                    onRevealHiddenPath = { scope.launch { runAction { repository.revealHiddenHeroicPath() } } },
                    onBuySpark = { scope.launch { runAction { repository.buyHestiaSpark() } } },
                    showQuests = current.settings.feedback.questsEnabled)
                }
            }
            if(current.completions.isNotEmpty()) {
                Text("История отметок",style=MaterialTheme.typography.titleMedium)
                current.completions.sortedByDescending { it.date }.take(30).forEach { c ->
                    val title=current.habits.firstOrNull { it.id==c.habitId }?.title ?: "Привычка"
                    Text("${c.date} · $title · ${if(c.completed) "выполнено" else "отметка снята"} · XP ${c.xpAwarded}",style=MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
    if(editorOpen) HabitEditor(edit,busy,error,inputCalendarMode,onDismiss={if(!busy) editorOpen=false},onSave={ habit ->
        scope.launch { runAction { repository.save(habit); editorOpen=false } }
    })
    deleteCandidate?.let { habit ->
        val completionCount = workspace?.let { habitCompletionCount(it.completions, habit.id) } ?: 0
        val retainsLaurels = completionCount >= HABIT_LAUREL_RETENTION_COMPLETIONS
        AlertDialog(onDismissRequest={if(!busy) deleteCandidate=null},
            title={Text("Удалить привычку?")},
            text={Text(if(retainsLaurels)
                "«${habit.title}» и все отметки будут удалены. Рубеж в $HABIT_LAUREL_RETENTION_COMPLETIONS выполнений достигнут — заработанные Лавры сохранятся."
                else "«${habit.title}» и все отметки будут удалены. Прогресс: $completionCount/$HABIT_LAUREL_RETENTION_COMPLETIONS; баланс Лавров будет обнулён.")},
            confirmButton={TextButton(enabled=!busy,onClick={scope.launch {
                runAction { repository.delete(habit.id); deleteCandidate=null; if(edit?.id==habit.id) editorOpen=false }
            }},modifier=Modifier.testTag("confirm-delete-habit"),
                colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error)) { Text("Удалить") }},
            dismissButton={TextButton(enabled=!busy,onClick={deleteCandidate=null}) { Text("Отмена") }})
    }
}

@Composable
private fun ExperimentalHabitCard(habit: Habit, entry: HabitCompletion?, scheduled: Boolean, disabled: Boolean,
    animate: Boolean, onComplete: (Boolean, Double?) -> Unit, onEdit: () -> Unit,
    onToggle: () -> Unit, onDelete: () -> Unit) {
    val status = if (!habit.active) "На паузе" else if (scheduled) "Запланировано сегодня" else "Сегодня свободно"
    val calendar = when (habit.schedule.recurrence.mode) {
        "classic" -> "Григорианский ритм"
        "lunar" -> "Лунный ритм"
        else -> "Сакральный ритм"
    }
    val cardModifier = if (animate) Modifier.fillMaxWidth().animateContentSize()
        else Modifier.fillMaxWidth()
    Card(cardModifier.testTag("habit-card-${habit.id}"), shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xfff8f3e8))) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(Modifier.size(48.dp), shape = RoundedCornerShape(14.dp), color = Color(0xff123b36)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(habit.emoji, style = MaterialTheme.typography.headlineSmall, color = Color(0xfff8f3e8))
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(habit.title, style = MaterialTheme.typography.titleMedium, color = Color(0xff132426))
                    Text(status, style = MaterialTheme.typography.labelMedium,
                        color = if (habit.active && scheduled) Color(0xff255b59) else Color(0xff596665))
                }
            }
            if (habit.description.isNotEmpty()) Text(habit.description,
                style = MaterialTheme.typography.bodyMedium, color = Color(0xff344747))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp), color = Color(0xffe4ded0)) {
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("РАСПИСАНИЕ", style = MaterialTheme.typography.labelSmall, color = Color(0xff596665))
                        Text(calendar, style = MaterialTheme.typography.bodySmall, color = Color(0xff132426))
                    }
                }
                Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp), color = Color(0xffd7e3dd)) {
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("ПРИОРИТЕТ", style = MaterialTheme.typography.labelSmall, color = Color(0xff45605e))
                        Text("${habit.priority} из 10", style = MaterialTheme.typography.bodySmall, color = Color(0xff132426))
                    }
                }
            }
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
                color = if (entry?.completed == true) Color(0xffcfe1d8) else Color(0xffeee7d8)) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (habit.scoringMode.startsWith("quality") && scheduled) {
                        var quality by remember(habit.id, entry?.qualityValue) {
                            mutableFloatStateOf((entry?.qualityValue ?: if(habit.scoringMode=="quality-ten") 5.0 else 0.0).toFloat())
                        }
                        Text("Качество выполнения · ${quality.toInt()}", style = MaterialTheme.typography.titleSmall)
                        Slider(value=quality,onValueChange={quality=it},enabled=!disabled,
                            valueRange=if(habit.scoringMode=="quality-ten") 1f..10f else -5f..5f,
                            steps=if(habit.scoringMode=="quality-ten") 8 else 9)
                        Row {
                            Button(enabled=!disabled,onClick={onComplete(true,quality.toDouble())}) {
                                Text(if(entry?.completed==true) "Обновить оценку" else "Выполнено")
                            }
                            if(entry?.completed==true) TextButton(enabled=!disabled,
                                onClick={onComplete(false,entry.qualityValue)}) { Text("Снять отметку") }
                        }
                    } else Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked=entry?.completed==true,enabled=scheduled&&!disabled,
                            onCheckedChange={ checked -> onComplete(checked,null) })
                        Text(if(entry?.completed==true) "Выполнено · ${entry.score} баллов" else
                            if(scheduled) "Отметить выполнение" else "Сегодня не запланировано",
                            style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            HorizontalDivider(color = Color(0xffd5cab4))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                TextButton(enabled=!disabled,onClick=onEdit) { Text("Изменить") }
                TextButton(enabled=!disabled,onClick=onToggle) { Text(if(habit.active) "Пауза" else "Продолжить") }
                TextButton(enabled=!disabled,onClick=onDelete,
                    colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error),
                    modifier=Modifier.testTag("delete-habit-${habit.id}")) { Text("Удалить") }
            }
        }
    }
}

@Composable
private fun HabitEditor(existing: Habit?, busy: Boolean, error: String?, inputCalendarMode: CalendarMode,
    onDismiss: () -> Unit, onSave: (Habit) -> Unit) {
    val engine=remember { HabitEngine(GenesisCalendar()) }
    val initial=remember(existing) { existing ?: Habit(TrackerEntity.create("habit"),"",LocalDate.now(),engine.defaultSchedule(LocalDate.now(),CalendarMode.SACRED)) }
    var title by rememberSaveable(initial.id) { mutableStateOf(initial.title) }
    var description by rememberSaveable(initial.id) { mutableStateOf(initial.description) }
    var preferredTime by rememberSaveable(initial.id) { mutableStateOf(initial.preferredTime) }
    var reminder by remember(initial.id) { mutableStateOf(initial.reminder) }
    var priority by rememberSaveable(initial.id) { mutableIntStateOf(initial.priority) }
    var scoring by rememberSaveable(initial.id) { mutableStateOf(initial.scoringMode) }
    var start by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.startDate.toString()) }
    var end by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.endDate?.toString() ?: "") }
    var formCalendarMode by rememberSaveable(initial.id) { mutableStateOf(inputCalendarMode) }
    var config by remember(initial.id) { mutableStateOf(initial.schedule.recurrence) }
    val mode=when(config.mode) { "classic"->CalendarMode.PROFANE;"lunar"->CalendarMode.LUNAR;else->CalendarMode.SACRED }
    Dialog(onDismissRequest=onDismiss, properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)) { Surface(Modifier.widthIn(max=720.dp).fillMaxWidth().padding(12.dp),shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(if(existing==null) "Новая привычка" else "Изменить привычку",style=MaterialTheme.typography.titleLarge)
            OutlinedTextField(title,{title=it},label={Text("Название")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            OutlinedTextField(description,{description=it},label={Text("Описание")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            PriorityControl(priority) { if(!busy) priority=it }
            Text("Календарь расписания")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf(CalendarMode.SACRED to "Сакральный",CalendarMode.PROFANE to "Григорианский",CalendarMode.LUNAR to "Лунный").forEach { (option,label) ->
                    FilterChip(selected=mode==option,enabled=!busy,onClick={config=engine.defaultSchedule(LocalDate.parse(start),option).recurrence},label={Text(label)})
                }
            }
            EditorCalendarModePicker(formCalendarMode, { formCalendarMode=it }, enabled=!busy,
                tag="habit-form-calendar")
            Text("Начало"); AuthorDatePicker(start,formCalendarMode) { if(!busy) start=it }
            Row { Checkbox(checked=end.isNotEmpty(),enabled=!busy,onCheckedChange={end=if(it) start else ""}); Text("Ограничить срок",Modifier.padding(top=12.dp)) }
            if(end.isNotEmpty()) AuthorDatePicker(end,formCalendarMode) { if(!busy) end=it }
            if(mode==CalendarMode.PROFANE) Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf("daily" to "Ежедневно","weekdays" to "Дни недели","monthly" to "Ежемесячно","yearly" to "Ежегодно").forEach { (pattern,label) ->
                    FilterChip(config.pattern==pattern,{config=config.copy(pattern=pattern)},enabled=!busy,label={Text(label)})
                }
            }
            val limit=when { mode==CalendarMode.SACRED -> if(config.pattern=="month-days") 30 else 5; mode==CalendarMode.LUNAR -> 30;config.pattern=="weekdays" -> 7;else -> 0 }
            if(mode==CalendarMode.SACRED) Row {
                FilterChip(config.pattern=="pyata-days",{config=config.copy(pattern="pyata-days",days=listOf(1))},enabled=!busy,label={Text("Дни пяты")})
                FilterChip(config.pattern=="month-days",{config=config.copy(pattern="month-days",days=listOf(1))},enabled=!busy,label={Text("Дни месяца")})
            }
            if(limit>0) {
                Text("Дни расписания")
                (1..limit).chunked(5).forEach { row -> Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) { row.forEach { day ->
                    FilterChip(day in config.days,{config=config.copy(days=if(day in config.days) config.days.filterNot { it==day } else config.days+day)},enabled=!busy,
                        label={Text(if(mode==CalendarMode.SACRED&&config.pattern=="pyata-days") listOf("I","II","III","IIII","V")[day-1] else day.toString())})
                } } }
            }
            HabitReminderFields(preferredTime, reminder, !busy, onTime = { preferredTime = it }, onReminder = { reminder = it })
            Text("Начисление XP")
            listOf("none" to "Без баллов","binary" to "Выполнение · 10","quality-ten" to "Качество · 1–10","quality-bipolar" to "Качество · −5…+5").forEach { (value,label) ->
                FilterChip(scoring==value,{scoring=value},enabled=!busy,label={Text(label)})
            }
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                TextButton(enabled=!busy,onClick=onDismiss) { Text("Отмена") }
                Button(enabled=!busy&&title.isNotBlank()&&(limit==0||config.days.isNotEmpty())&&(end.isEmpty()||end>=start),onClick={
                    onSave(initial.copy(title=title.trim(),description=description,priority=priority,scoringMode=scoring,
                        preferredTime=preferredTime,reminder=reminder,
                        qualityScale=when(scoring){"quality-ten"->"ten";"quality-bipolar"->"bipolar";else->"none"},
                        schedule=initial.schedule.copy(startDate=LocalDate.parse(start),endDate=end.takeIf(String::isNotEmpty)?.let(LocalDate::parse),recurrence=config)))
                }) { Text(if(busy) "Сохранение…" else "Сохранить") }
            }
        }
    } }
}
