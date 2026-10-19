package ru.genesis.calendar.ui

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import ru.genesis.calendar.auth.AccountSettings
import ru.genesis.calendar.auth.AuthController

@Composable
internal fun HabitsScreen(app: GenesisApplication, experimental: Boolean, inputCalendarMode: CalendarMode = CalendarMode.SACRED,
    displayCalendarMode: CalendarMode = CalendarMode.SACRED,
    accountSettings: AccountSettings? = null, taskLists: List<GoogleTaskList> = emptyList(),
    menuSwipeState: MenuSwipeState? = null, openSacredHabits: Boolean = false,
    onSacredHabitsOpened: () -> Unit = {}, voiceRequest: NativeVoiceAction? = null,
    onVoiceRequestConsumed: () -> Unit = {}, openHeroPath: Boolean = false,
    onHeroPathOpened: () -> Unit = {}, hiddenSubmenus: Set<String> = emptySet(),
    reminderRequest: ru.genesis.calendar.reminders.HabitReminderOpenRequest? = null) {
    var localSection by rememberSaveable { mutableStateOf("Привычки") }
    val section = (menuSwipeState?.habits ?: localSection).takeIf {
        (if (it == "Привычки") "habits.habits" else "habits.sleep") !in hiddenSubmenus
    } ?: if ("habits.habits" !in hiddenSubmenus) "Привычки" else "Сон и настроение"
    Column(Modifier.fillMaxSize()) {
        val submenuItems = listOf(SubmenuItem("Привычки", "Привычки"), SubmenuItem("Сон и настроение", "Сон и настроение"))
            .filter { (if (it.id == "Привычки") "habits.habits" else "habits.sleep") !in hiddenSubmenus }
        if (!LocalFixedSubmenu.current && submenuItems.size > 1) ConnectedSubmenu(submenuItems,
            section, { localSection = it; menuSwipeState?.habits = it })
        Box(Modifier.weight(1f)) {
            if (section == "Привычки") HabitWorkspaceContent(app, experimental, inputCalendarMode, displayCalendarMode,
                accountSettings,taskLists,
                openSacredHabits,onSacredHabitsOpened,voiceRequest,onVoiceRequestConsumed,
                openHeroPath,onHeroPathOpened,reminderRequest) else TrackersScreen(app, experimental)
        }
    }
}

@Composable
private fun HabitWorkspaceContent(app: GenesisApplication, experimental: Boolean, inputCalendarMode: CalendarMode,
    displayCalendarMode: CalendarMode, accountSettings: AccountSettings?, taskLists: List<GoogleTaskList>,
    openSacredHabits: Boolean, onSacredHabitsOpened: () -> Unit,
    voiceRequest: NativeVoiceAction?, onVoiceRequestConsumed: () -> Unit,
    openHeroPath: Boolean, onHeroPathOpened: () -> Unit,
    reminderRequest: ru.genesis.calendar.reminders.HabitReminderOpenRequest?) {
    val repository=remember(app) { HabitsRepository(app) }
    val externalSync=remember(app) { HabitExternalSync(app,AuthController.get(app)) }
    val scope=rememberCoroutineScope()
    var workspace by remember { mutableStateOf<LocalHabitWorkspace?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var storageError by remember { mutableStateOf(false) }
    var edit by remember { mutableStateOf<Habit?>(null) }
    var deleteCandidate by remember { mutableStateOf<Habit?>(null) }
    var editorOpen by remember { mutableStateOf(false) }
    var voiceDraftTitle by remember { mutableStateOf("") }
    var catalogueOpen by rememberSaveable { mutableStateOf(false) }
    var heroPathOpen by rememberSaveable { mutableStateOf(false) }
    var timerHabitId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(openHeroPath) {
        if (openHeroPath) { heroPathOpen=true;onHeroPathOpened() }
    }
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
            workspace?.habits?.firstOrNull { it.id==id }?.let { externalSync.advanceTaskAfterCompletion(it,LocalDate.now()) }
            completionFeedback(settings)
            if (settings.achievementPopups && result.newlyUnlockedAchievements > 0)
                app.scheduler.showAchievementNotification(result.newlyUnlockedAchievements, language)
        }
    }
    suspend fun recordInterval(habit: Habit, time: String, checked: Boolean, settings: HabitFeedbackSettings) {
        val previous=workspace?.completions?.firstOrNull { it.habitId==habit.id && it.date==LocalDate.now() }
        val marks=habitIntervalMarks(habit,previous).toMutableSet()
        if(checked) marks.add(time) else marks.remove(time)
        val result=repository.completeInterval(habit.id,time,checked)
        if(checked) {
            if(previous?.completed!=true && habit.intervalSchedule!!.times().all { it in marks } &&
                (!habit.scoringMode.startsWith("quality") || previous?.qualityValue!=null))
                externalSync.advanceTaskAfterCompletion(habit,LocalDate.now())
            completionFeedback(settings)
            if(settings.achievementPopups && result.newlyUnlockedAchievements>0)
                app.scheduler.showAchievementNotification(result.newlyUnlockedAchievements,language)
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
    LaunchedEffect(voiceRequest,workspace) {
        if(workspace!=null && voiceRequest!=null) {
            when(voiceRequest) {
                is NativeVoiceAction.CreateHabit -> { edit=null;voiceDraftTitle=voiceRequest.title;editorOpen=true }
                is NativeVoiceAction.EditHabit -> {
                    workspace?.habits?.firstOrNull { it.id==voiceRequest.id }?.let { edit=it;editorOpen=true }
                }
                is NativeVoiceAction.DeleteHabit -> {
                    workspace?.habits?.firstOrNull { it.id==voiceRequest.id }?.let { deleteCandidate=it }
                }
                is NativeVoiceAction.SetHabitDone -> {
                    workspace?.habits?.firstOrNull { it.id==voiceRequest.id }?.let { habit ->
                        scope.launch { runAction {
                            recordCompletion(habit.id,voiceRequest.done,null,
                                requireNotNull(workspace).settings.feedback)
                        } }
                    }
                }
                else -> Unit
            }
            onVoiceRequestConsumed()
        }
    }
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
                    if (!experimental) {
                        HorizontalDivider(color=Color(0xff46645e))
                        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            heroRankThumbnailPath(rank)?.let { OriginalImage(it,rank.title,
                                Modifier.size(56.dp)) }
                            Column(verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                Text("Путь Героя · ${rank.title}",style=MaterialTheme.typography.titleMedium,color=Color(0xfff8f3e8))
                                Text("✦ ${current.progress.lifetimeXp} XP  ·  🔥 ${current.progress.currentStreak} дн.",
                                    style=MaterialTheme.typography.bodySmall,color=Color(0xffd8e7df))
                            }
                        }
                        Text("Ритм ${current.progress.rhythmScore}%  ·  🌿 ${current.progress.laurelsBalance} лавров",
                            style=MaterialTheme.typography.labelMedium,color=Color(0xffdfc17e))
                    }
                }
            }} else null)
        error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
        current?.habits?.filter { HabitRuleHistory.state(it,LocalDate.MAX).conflicts.isNotEmpty() }?.forEach { habit ->
            Text("Правила изменены на нескольких устройствах. Выберите действующий вариант.",color=MaterialTheme.colorScheme.error)
            Text(habitDisplayTitle(habit))
            TextButton(onClick={edit=habit;editorOpen=true}) { Text("Открыть историю") }
        }
        if(current==null) {
            if(!storageError) CircularProgressIndicator()
        } else {
            HabitReminderFocus(app, current, repository, reminderRequest)
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
            HabitTimerShelf(current, repository.timerOwner, timerHabitId, { timerHabitId = null }, !busy && !storageError) {
                repository.applyTimer(it); Unit
            }
            if(current.habits.isEmpty()) Text("Здесь появятся ваши практики. Выберите идею из подборки или создайте свою.",
                style=MaterialTheme.typography.bodyMedium)
            AdaptiveCardGrid(current.habits.sortedByDescending { it.priority }, { it.id }) { habit ->
                val entry=current.completions.firstOrNull { it.habitId==habit.id && it.date==today }
                val scheduled=runCatching { engine.isScheduled(habit,today) }.getOrDefault(false)
                val measured=HabitMeasurements.effective(HabitMeasurements.rule(habit,today))!=null
                if (experimental) ExperimentalHabitCard(habit, entry, scheduled, busy || storageError,
                    animate = current.settings.feedback.animations,
                    onComplete={checked,quality -> scope.launch { runAction {
                        recordCompletion(habit.id,checked,quality,current.settings.feedback)
                    } }},
                    onIntervalComplete={time,checked -> scope.launch { runAction { recordInterval(habit,time,checked,current.settings.feedback) } }},
                    onEdit={edit=habit;editorOpen=true},
                    onToggle={scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } }},
                    onDelete={deleteCandidate=habit})
                else Card((if (current.settings.feedback.animations) Modifier.animateContentSize() else Modifier).fillMaxWidth()) { Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text("${habit.emoji} ${habitDisplayTitle(habit)}",style=MaterialTheme.typography.titleMedium)
                    if(habit.description.isNotEmpty()) Text(habit.description)
                    Text(if(!habit.active) "На паузе" else if(scheduled) "Запланировано сегодня" else "Сегодня не запланировано",style=MaterialTheme.typography.bodySmall)
                    if(habit.scoringMode.startsWith("quality") && scheduled && !measured) {
                        var quality by remember(habit.id,entry?.qualityValue) { mutableFloatStateOf((entry?.qualityValue ?: if(habit.scoringMode=="quality-ten") 5.0 else 0.0).toFloat()) }
                        Text("Качество: ${quality.toInt()}")
                        Slider(value=quality,onValueChange={quality=it},enabled=!busy&&!storageError,valueRange=if(habit.scoringMode=="quality-ten") 1f..10f else -5f..5f,
                            steps=if(habit.scoringMode=="quality-ten") 8 else 9)
                        Button(enabled=!busy&&!storageError,onClick={scope.launch { runAction {
                            recordCompletion(habit.id,true,quality.toDouble(),current.settings.feedback)
                        } }}) { Text(if(entry?.completed==true) "Обновить оценку" else "Выполнено") }
                        if(entry?.completed==true) TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.complete(habit.id,false,entry.qualityValue) } }}) { Text("Снять отметку") }
                    } else Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Checkbox(checked=entry?.completed==true,enabled=scheduled&&!busy&&!storageError&&!measured,
                            onCheckedChange={ checked -> scope.launch { runAction {
                                recordCompletion(habit.id,checked,null,current.settings.feedback)
                            } } })
                        Text(if(entry?.completed==true) "Выполнено · ${entry.score} баллов" else if(habit.intervalSchedule?.completionMode=="each") "Отметить все повторения" else "Отметить выполнение",Modifier.padding(top=12.dp))
                    }
                    HabitIntervalMarks(habit,entry,scheduled&&!busy&&!storageError) { time,checked -> scope.launch { runAction { recordInterval(habit,time,checked,current.settings.feedback) } } }
                    Row {
                        TextButton(enabled=!busy&&!storageError,onClick={edit=habit;editorOpen=true}) { Text("Изменить") }
                        TextButton(enabled=!busy&&!storageError,onClick={scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } }}) { Text(if(habit.active) "Пауза" else "Продолжить") }
                        TextButton(enabled=!busy&&!storageError,onClick={deleteCandidate=habit},
                            colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error),
                            modifier=Modifier.testTag("delete-habit-${habit.id}")) { Text("Удалить") }
                    }
                } }
                if(measured) HabitMeasurementInputs(habit,current.measurements,today,entry,scheduled&&!busy&&!storageError,
                    onRecord={amount,entryId,replaces,note -> repository.recordMeasurement(habit.id,today,amount,entryId,replaces,note);Unit},
                    onQuality={quality -> recordCompletion(habit.id,true,quality,current.settings.feedback)})
                HabitPeriodGoalProgress(habit,current.measurements,current.completions,today)
                TextButton(onClick = { timerHabitId = habit.id }, enabled = scheduled && !busy && !storageError,
                    modifier = Modifier.testTag("habit-timer-open-${habit.id}")) { Text("Таймер") }
            }
            if (experimental && current.settings.feedback.gamificationWidgets) {
                val motionEnabled = current.settings.feedback.animations
                val iconScale by animateFloatAsState(if (heroPathOpen) 1.09f else 1f,
                    label = "hero-path-icon-scale")
                val iconGlow = rememberIconPhase("hero-path-card-glow", 3_800, motionEnabled)
                Surface(Modifier.fillMaxWidth().testTag("habit-hero-path-section"),
                    shape = RoundedCornerShape(22.dp), color = Color(0xff0b2b2d),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x99dfc17e)),
                    shadowElevation = 8.dp) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Row(Modifier.fillMaxWidth().clickable(role = Role.Button,
                            onClickLabel = if (heroPathOpen) "Свернуть путь и награды" else "Открыть путь и награды") {
                                heroPathOpen = !heroPathOpen
                            }.testTag("habit-hero-path-heading"),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Surface(Modifier.size(68.dp).graphicsLayer {
                                val pulse = if (motionEnabled) kotlin.math.sin(iconGlow * 2f * Math.PI).toFloat() else 0f
                                scaleX = iconScale + pulse * .025f
                                scaleY = iconScale + pulse * .025f
                            }, shape = RoundedCornerShape(18.dp),
                                color = Color(0xff163d3a),
                                border = androidx.compose.foundation.BorderStroke(1.dp,
                                    Color(0xffdfc17e).copy(alpha = .45f + iconGlow * .3f))) {
                                OriginalImage("hero-path/256/07_golden_horn_pathfinder.webp", null,
                                    Modifier.fillMaxSize().genesisDescription("Путь героя"))
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
                                Triple("XP",current.progress.lifetimeXp.toString(),"✦"),
                                Triple("Серия","${current.progress.currentStreak} дн.","🔥"),
                                Triple("Лавры",current.progress.laurelsBalance.toString(),"🌿"),
                            ).forEach { (label, value, icon) ->
                                Surface(Modifier.weight(1f), shape = RoundedCornerShape(12.dp),
                                    color = Color(0xff143b39)) {
                                    Column(Modifier.padding(9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(icon,style=MaterialTheme.typography.titleMedium)
                                        Text(value, color = Color(0xffffe4a6),
                                            style = MaterialTheme.typography.titleSmall)
                                        Text(label, color = Color(0xffb8ccc5),
                                            style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                        HabitsFeatureActionButton(
                            label=if(heroPathOpen) "Свернуть путь" else "Открыть путь и награды",
                            onClick={heroPathOpen=!heroPathOpen},
                            containerColor=Color(0xffdfc17e), contentColor=Color(0xff0b2b2d),
                            borderColor=Color(0xffffe4a6),
                            modifier=Modifier.testTag("habit-hero-path-toggle"))
                    }
                }
                AnimatedVisibility(visible=heroPathOpen,
                    enter=if (current.settings.feedback.animations) fadeIn() + expandVertically() else EnterTransition.None,
                    exit=if (current.settings.feedback.animations) fadeOut() + shrinkVertically() else ExitTransition.None) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HabitCompletionCalendar(current, today, displayCalendarMode)
                    HabitArtGallery(current, today, busy,
                    onClaimAmphora = { rankId -> scope.launch { runAction { repository.claimHeroPathAmphora(rankId) } } },
                    onRevealHiddenPath = { scope.launch { runAction { repository.revealHiddenHeroicPath() } } },
                    onBuySpark = { scope.launch { runAction { repository.buyHestiaSpark() } } },
                    showQuests = current.settings.feedback.questsEnabled)
                    }
                }
            }
            if (LocalSacredFeaturesEnabled.current) SacredHabitsBlock(current,today,displayCalendarMode,busy || storageError,openSacredHabits,
                experimental = experimental,
                onRequestedOpenConsumed=onSacredHabitsOpened,
                onStart={ practice -> scope.launch { runAction { repository.save(practice.toHabit(displayCalendarMode,english)) } } },
                onEdit={ habit -> edit=habit;editorOpen=true },
                onComplete={ habit,checked -> scope.launch { runAction {
                    recordCompletion(habit.id,checked,null,current.settings.feedback)
                } } },
                onToggle={ habit -> scope.launch { runAction { repository.save(habit.copy(active=!habit.active)) } } })
            if(current.completions.isNotEmpty()) {
                Text("История отметок",style=MaterialTheme.typography.titleMedium)
                HabitHistoryPanel(current,repository,displayCalendarMode)
            }
        }
    }
    if(editorOpen) HabitEditor(edit,busy,error,inputCalendarMode,accountSettings,voiceDraftTitle,
        onChooseRule={chosen,heads,operation -> scope.launch { runAction {
            try { repository.resolveRule(requireNotNull(edit).id,chosen,heads,operation);editorOpen=false }
            catch(e: CancellationException) { throw e }
            catch(_: Exception) { throw IllegalStateException("Не удалось сохранить выбор. Обновите данные и повторите.") }
        } }},
        onDismiss={if(!busy) { editorOpen=false;voiceDraftTitle="" }},onSave={ habit ->
        scope.launch { runAction {
            val previous=edit
            val saved=repository.save(habit).second.habits.first { it.id==habit.id }
            edit=saved
            try {
                val synced=externalSync.apply(saved,previous,accountSettings,taskLists,inputCalendarMode)
                if(synced.reminder!=saved.reminder) {
                    edit=repository.save(synced).second.habits.first { it.id==habit.id }
                }
            } catch(e: CancellationException) { throw e }
            catch(_: Exception) {
                throw IllegalArgumentException("Привычка сохранена на устройстве. Синхронизация Google пока не завершена — повторите сохранение.")
            }
            editorOpen=false; voiceDraftTitle=""
        } }
    })
    deleteCandidate?.let { habit ->
        val completionCount = workspace?.let { habitCompletionCount(it.completions, habit.id) } ?: 0
        val retainsLaurels = completionCount >= HABIT_LAUREL_RETENTION_COMPLETIONS
        AlertDialog(onDismissRequest={if(!busy) deleteCandidate=null},
            title={Text("Удалить привычку?")},
            text={Text(if(retainsLaurels)
                "«${habitDisplayTitle(habit)}» и все отметки будут удалены. Рубеж в $HABIT_LAUREL_RETENTION_COMPLETIONS выполнений достигнут — заработанные Лавры сохранятся."
                else "«${habitDisplayTitle(habit)}» и все отметки будут удалены. Прогресс: $completionCount/$HABIT_LAUREL_RETENTION_COMPLETIONS; баланс Лавров будет обнулён.")},
            confirmButton={TextButton(enabled=!busy,onClick={scope.launch {
                runAction {
                    repository.delete(habit.id)
                    externalSync.remove(habit)
                    deleteCandidate=null; if(edit?.id==habit.id) editorOpen=false
                }
            }},modifier=Modifier.testTag("confirm-delete-habit"),
                colors=ButtonDefaults.textButtonColors(contentColor=MaterialTheme.colorScheme.error)) { Text("Удалить") }},
            dismissButton={TextButton(enabled=!busy,onClick={deleteCandidate=null}) { Text("Отмена") }})
    }
}

@Composable
private fun ExperimentalHabitCard(habit: Habit, entry: HabitCompletion?, scheduled: Boolean, disabled: Boolean,
    animate: Boolean, onComplete: (Boolean, Double?) -> Unit, onEdit: () -> Unit,
    onIntervalComplete: (String,Boolean) -> Unit,
    onToggle: () -> Unit, onDelete: () -> Unit) {
    val measured = HabitMeasurements.effective(HabitMeasurements.rule(habit,LocalDate.now()))!=null
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
                    Text(habitDisplayTitle(habit), style = MaterialTheme.typography.titleMedium, color = Color(0xff132426))
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
                    if (habit.scoringMode.startsWith("quality") && scheduled && !measured) {
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
                        Checkbox(checked=entry?.completed==true,enabled=scheduled&&!disabled&&!measured,
                            onCheckedChange={ checked -> onComplete(checked,null) })
                        Text(if(entry?.completed==true) "Выполнено · ${entry.score} баллов" else
                            if(scheduled) if(habit.intervalSchedule?.completionMode=="each") "Отметить все повторения" else "Отметить выполнение" else "Сегодня не запланировано",
                            style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            HabitIntervalMarks(habit,entry,scheduled&&!disabled,onIntervalComplete)
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

private fun sacredHabitCadence(config: ru.genesis.calendar.domain.RecurrenceConfig): String = when {
    config.pattern == "month-days" && config.months.size == 1 -> "yearly"
    config.pattern == "month-days" -> "monthly"
    config.pyatas == listOf(1, 3, 5) || config.pyatas == listOf(2, 4, 6) -> "parity"
    config.days.sorted() == listOf(1, 2, 3, 4, 5) && config.pyatas.isEmpty() && config.months.isEmpty() -> "daily"
    else -> "pyata-days"
}

@Composable
private fun HabitEditor(existing: Habit?, busy: Boolean, error: String?, inputCalendarMode: CalendarMode,
    accountSettings: AccountSettings?,
    initialTitle: String = "",
    onDismiss: () -> Unit, onSave: (Habit) -> Unit,
    onChooseRule: (String,List<String>,String)->Unit) {
    val engineCalendar=remember { GenesisCalendar() }
    val engine=remember(engineCalendar) { HabitEngine(engineCalendar) }
    val initial=remember(existing,initialTitle) { existing ?: Habit(TrackerEntity.create("habit"),initialTitle,LocalDate.now(),engine.defaultSchedule(LocalDate.now(),inputCalendarMode)) }
    val displayTitle = habitDisplayTitle(initial)
    val editorInitialTitle = rememberSaveable(initial.id) { displayTitle }
    var title by rememberSaveable(initial.id) { mutableStateOf(editorInitialTitle) }
    var description by rememberSaveable(initial.id) { mutableStateOf(initial.description) }
    var emoji by rememberSaveable(initial.id) { mutableStateOf(initial.emoji) }
    var color by rememberSaveable(initial.id) { mutableStateOf(initial.color) }
    var isKeyHabit by rememberSaveable(initial.id) { mutableStateOf(initial.isKeyHabit) }
    var ritualId by rememberSaveable(initial.id) { mutableStateOf(initial.ritualId) }
    var ritualName by rememberSaveable(initial.id) { mutableStateOf(initial.ritualName) }
    var preferredTime by rememberSaveable(initial.id) { mutableStateOf(initial.preferredTime) }
    var reminder by remember(initial.id) { mutableStateOf(initial.reminder) }
    var intervalSchedule by remember(initial.id) { mutableStateOf(initial.intervalSchedule) }
    var measurement by remember(initial.id) { mutableStateOf(initial.measurement) }
    var measurementValid by remember(initial.id) { mutableStateOf(true) }
    var periodGoal by remember(initial.id) { mutableStateOf(initial.periodGoal) }
    var periodValid by remember(initial.id) { mutableStateOf(true) }
    var priority by rememberSaveable(initial.id) { mutableIntStateOf(initial.priority) }
    var scoring by rememberSaveable(initial.id) { mutableStateOf(initial.scoringMode) }
    var start by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.startDate.toString()) }
    var end by rememberSaveable(initial.id) { mutableStateOf(initial.schedule.endDate?.toString() ?: "") }
    var formCalendarMode by rememberSaveable(initial.id) { mutableStateOf(
        if (existing == null) inputCalendarMode else when(initial.schedule.recurrence.mode) {
            "classic" -> CalendarMode.PROFANE
            "lunar" -> CalendarMode.LUNAR
            else -> CalendarMode.SACRED
        }) }
    var config by remember(initial.id) { mutableStateOf(initial.schedule.recurrence) }
    var sacredCadence by remember(initial.id) { mutableStateOf(sacredHabitCadence(initial.schedule.recurrence)) }
    val mode=formCalendarMode
    val lunarDaily = config.pattern == "lunar-days" && config.days == (1..30).toList() && config.months.isEmpty()
    val limit=when {
        mode==CalendarMode.SACRED -> when(sacredCadence) {"pyata-days"->5;"monthly","yearly"->30;else->0}
        mode==CalendarMode.LUNAR -> when(config.pattern) {"lunar-decades"->3;"lunar-decade-days"->10;"lunar-phases"->0
            else -> if(lunarDaily) 0 else 30}
        config.pattern=="weekdays" -> 7
        else -> 0
    }
    Dialog(onDismissRequest=onDismiss, properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)) { Surface(Modifier.widthIn(max=720.dp).fillMaxWidth().padding(12.dp),shape=MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically) {
                Text(if(existing==null) "Новая привычка" else "Изменить привычку",
                    modifier=Modifier.weight(1f),style=MaterialTheme.typography.titleLarge)
                IconButton(onClick=onDismiss,enabled=!busy,modifier=Modifier.testTag("habit-editor-close")) {
                    Text("×",style=MaterialTheme.typography.headlineSmall)
                }
            }
            EditorSection("Основное") {
            OutlinedTextField(title,{title=it},label={Text("Название")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            OutlinedTextField(description,{description=it},label={Text("Описание")},modifier=Modifier.fillMaxWidth(),enabled=!busy)
            HabitMeasurementFields(measurement,existing!=null,onChange={measurement=it},onValidity={measurementValid=it},periodGoal=periodGoal,
                hadPeriodGoal=initial.periodGoal!=null||initial.ruleHistory.any { it.periodGoal!=null })
            HabitPeriodGoalFields(periodGoal,measurement,mode,initial.schedule.timezone,existing!=null,
                onChange={periodGoal=it},onValidity={periodValid=it},hadPeriodGoal=initial.periodGoal!=null||initial.ruleHistory.any { it.periodGoal!=null })
            if(existing!=null) HabitRuleHistoryPanel(existing,LocalDate.now(),busy,onChooseRule)
            HabitPersonalizationFields(emoji,color,isKeyHabit,ritualId,ritualName,!busy,
                onEmoji={ emoji=it.take(32) },onColor={ color=it.take(7) },
                onKeyHabit={ isKeyHabit=it },
                onRitual={ ritualId=it; if(it!="custom") ritualName="" },
                onRitualName={ ritualName=it.take(60) })
            PriorityControl(priority) { if(!busy) priority=it }
            }
            EditorSection("Календарь и срок") {
            if (LocalSacredFeaturesEnabled.current) {
            Text("Календарь привычки", style=MaterialTheme.typography.titleSmall)
            Text("Определяет повторение и вид дат этой привычки.",
                style=MaterialTheme.typography.bodySmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                (listOf(inputCalendarMode) + listOf(CalendarMode.SACRED,CalendarMode.PROFANE,CalendarMode.LUNAR)
                    .filterNot { it==inputCalendarMode }).filter { LocalSacredFeaturesEnabled.current || it!=CalendarMode.SACRED || mode==CalendarMode.SACRED }.forEach { option ->
                    val label=when(option) {CalendarMode.SACRED->"Сакральный";CalendarMode.PROFANE->"Григорианский";CalendarMode.LUNAR->"Лунный"}
                    FilterChip(selected=mode==option,enabled=!busy,onClick={
                        config=engine.defaultSchedule(LocalDate.parse(start),option).recurrence
                        formCalendarMode=option
                        if(option==CalendarMode.SACRED) sacredCadence="pyata-days"
                    },modifier=Modifier.testTag("habit-calendar-${option.wireValue}"),label={Text(label)})
                }
            }
            }
            Text("Начало")
            if(existing==null) AuthorDatePicker(start,formCalendarMode,minDate=LocalDate.now()) {
                if(!busy && LocalDate.parse(it)>=LocalDate.now()) {
                    start=it
                    if(end.isNotEmpty() && end<start) end=start
                    config=config.copy(rangeStart=start)
                }
            } else {
                Text(engineCalendar.formatDate(existing.schedule.startDate,
                    if (LocalSacredFeaturesEnabled.current) formCalendarMode else CalendarMode.PROFANE),
                    modifier=Modifier.testTag("habit-start-locked"))
                Text("🔒 Дата начала зафиксирована при создании.",style=MaterialTheme.typography.bodySmall)
            }
            Row { Checkbox(checked=end.isNotEmpty(),enabled=!busy,onCheckedChange={end=if(it) start else ""}); Text("Ограничить срок",Modifier.padding(top=12.dp)) }
            if(end.isNotEmpty()) AuthorDatePicker(end,formCalendarMode,minDate=LocalDate.parse(start)) { if(!busy) end=it }
            }
            EditorSection("Повторение") {
            if(mode==CalendarMode.PROFANE) Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf("daily" to "Ежедневно","weekdays" to "Дни недели","monthly" to "Ежемесячно","yearly" to "Ежегодно").forEach { (pattern,label) ->
                    FilterChip(config.pattern==pattern,{config=config.copy(pattern=pattern)},enabled=!busy,label={Text(label)})
                }
            }
            if(mode==CalendarMode.SACRED) {
                Text("Повторение по сакральному календарю")
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    listOf("daily" to "Ежедневно", "pyata-days" to "Дни пяты",
                        "parity" to "Чётная/нечётная", "monthly" to "Ежемесячно",
                        "yearly" to "Ежегодно").forEach { (cadence,label) ->
                        FilterChip(sacredCadence==cadence,onClick={
                            sacredCadence=cadence
                            val sacred=engineCalendar.sacredDate(LocalDate.parse(start))
                            val day=if(sacred.monthIndex<12) sacred.day else 1
                            config=when(cadence) {
                                "daily" -> config.copy(pattern="pyata-days",days=(1..5).toList(),months=emptyList(),pyatas=emptyList())
                                "pyata-days" -> config.copy(pattern="pyata-days",days=listOf(1),months=emptyList(),pyatas=emptyList())
                                "parity" -> config.copy(pattern="pyata-days",days=(1..5).toList(),months=emptyList(),pyatas=listOf(1,3,5))
                                "monthly" -> config.copy(pattern="month-days",days=listOf(day),months=emptyList(),pyatas=emptyList())
                                else -> config.copy(pattern="month-days",days=listOf(day),months=listOf(if(sacred.monthIndex<12) sacred.monthIndex+1 else 1),pyatas=emptyList())
                            }
                        },enabled=!busy,label={Text(label)})
                    }
                }
                if(sacredCadence=="parity") Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    FilterChip(config.pyatas==listOf(1,3,5),onClick={config=config.copy(pyatas=listOf(1,3,5))},enabled=!busy,label={Text("Нечётные пяты")})
                    FilterChip(config.pyatas==listOf(2,4,6),onClick={config=config.copy(pyatas=listOf(2,4,6))},enabled=!busy,label={Text("Чётные пяты")})
                }
                if(sacredCadence=="yearly") {
                    Text("Сакральный месяц")
                    (1..12).chunked(4).forEach { row -> Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                        row.forEach { month -> FilterChip(month in config.months,onClick={config=config.copy(months=listOf(month))},enabled=!busy,label={Text(month.toString())}) }
                    } }
                }
                if(sacredCadence=="monthly" || sacredCadence=="yearly") Text("Апейрон исключён из расписания")
            }
            if(mode==CalendarMode.LUNAR) {
                Text("Повторение по лунному календарю")
                Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    listOf("daily" to "Ежедневно", "lunar-days" to "Дни месяца",
                        "lunar-decades" to "Декады", "lunar-decade-days" to "Дни декады",
                        "lunar-phases" to "Новолуние / полнолуние", "lunar-yearly" to "Ежегодно").forEach { (cadence,label) ->
                        FilterChip(if(cadence=="daily") lunarDaily else !lunarDaily&&config.pattern==cadence,
                            onClick={
                                val lunar=engineCalendar.lunarDate(LocalDate.parse(start))
                                config=when(cadence) {
                                    "daily" -> config.copy(pattern="lunar-days",days=(1..30).toList(),months=emptyList(),pyatas=emptyList())
                                    "lunar-decades" -> config.copy(pattern=cadence,days=listOf((lunar.day-1)/10+1),months=emptyList(),pyatas=emptyList())
                                    "lunar-decade-days" -> config.copy(pattern=cadence,days=listOf((lunar.day-1)%10+1),months=emptyList(),pyatas=listOf((lunar.day-1)/10+1))
                                    "lunar-phases" -> config.copy(pattern=cadence,days=listOf(1),months=emptyList(),pyatas=emptyList())
                                    "lunar-yearly" -> config.copy(pattern=cadence,days=listOf(lunar.day),months=listOf(lunar.monthOrdinal),pyatas=emptyList())
                                    else -> config.copy(pattern="lunar-days",days=listOf(lunar.day),months=emptyList(),pyatas=emptyList())
                                }
                            },enabled=!busy,modifier=Modifier.testTag("habit-lunar-cadence-$cadence"),label={Text(label)})
                    }
                }
                if(config.pattern=="lunar-decade-days") {
                    Text("В каких декадах месяца")
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) { (1..3).forEach { decade ->
                        FilterChip(decade in config.pyatas,onClick={
                            val next=if(decade in config.pyatas) config.pyatas.filterNot { it==decade } else config.pyatas+decade
                            if(next.isNotEmpty()) config=config.copy(pyatas=next)
                        },enabled=!busy,label={Text("$decade декада")})
                    } }
                }
                if(config.pattern=="lunar-phases") {
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        listOf(1 to "Новолуние",2 to "Полнолуние").forEach { (phase,label) ->
                            FilterChip(phase in config.days,onClick={
                                val next=if(phase in config.days) config.days.filterNot { it==phase } else config.days+phase
                                if(next.isNotEmpty()) config=config.copy(days=next)
                            },enabled=!busy,label={Text(label)})
                        }
                    }
                }
                if(config.pattern=="lunar-yearly") {
                    Text("Лунный месяц года · 13-й бывает не каждый год")
                    (1..13).chunked(5).forEach { row -> Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                        row.forEach { month -> FilterChip(month in config.months,onClick={config=config.copy(months=listOf(month))},
                            enabled=!busy,label={Text(month.toString())}) }
                    } }
                }
            }
            if(limit>0) {
                Text(when {
                    mode==CalendarMode.SACRED && sacredCadence=="pyata-days" -> "Дни внутри пяты"
                    mode==CalendarMode.LUNAR && config.pattern=="lunar-decades" -> "Декады месяца"
                    mode==CalendarMode.LUNAR && config.pattern=="lunar-decade-days" -> "Дни внутри выбранных декад"
                    else -> "Дни расписания"
                })
                (1..limit).chunked(5).forEach { row -> Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) { row.forEach { day ->
                    FilterChip(day in config.days,onClick={
                        if(mode==CalendarMode.SACRED && sacredCadence in setOf("monthly","yearly")) config=config.copy(days=listOf(day))
                        else if(day !in config.days || config.days.size>1) config=config.copy(days=if(day in config.days) config.days.filterNot { it==day } else config.days+day)
                    },enabled=!busy,
                        label={Text(if(mode==CalendarMode.SACRED&&sacredCadence=="pyata-days") listOf("I","II","III","IIII","V")[day-1] else day.toString())})
                } } }
            }
            }
            EditorSection("Время и напоминание") {
            HabitIntervalFields(intervalSchedule,!busy) { interval ->
                intervalSchedule=interval
                if(interval!=null) { preferredTime=""; reminder=reminder.copy(timing="habit") }
            }
            HabitReminderFields(preferredTime, reminder, !busy,
                intervalSchedule=intervalSchedule,
                googleTasksReady=accountSettings?.authProvider=="google" && accountSettings.accounts.any { it.tasksConnected },
                googleCalendarReady=accountSettings?.authProvider=="google" && accountSettings.accounts.any { it.calendarConnected },
                onTime = {
                preferredTime = it
                if(it.isEmpty() && reminder.timing=="habit") reminder=reminder.copy(timing="custom")
            }, onReminder = { reminder = it })
            }
            EditorSection("Начисление XP") {
            Text("Начисление XP")
            if(existing!=null) Text("🔒 Начисление XP зафиксировано при создании. Для другой формулы удалите привычку и создайте новую.",style=MaterialTheme.typography.bodySmall)
            if(existing==null) listOf("none" to "Без баллов","binary" to "Выполнение · 10","quality-ten" to "Качество · 1–10","quality-bipolar" to "Качество · −5…+5").forEach { (value,label) ->
                FilterChip(scoring==value,{scoring=value},enabled=!busy,label={Text(label)})
            } else Text(when(scoring) {"none"->"Без баллов";"quality-ten"->"Качество · 1–10";"quality-bipolar"->"Качество · −5…+5";else->"Выполнение · 10"})
            }
            error?.let { Text(it,color=MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                TextButton(enabled=!busy,onClick=onDismiss) { Text("Отмена") }
                Button(enabled=!busy&&HabitRuleHistory.state(initial,LocalDate.MAX).conflicts.isEmpty()&&measurementValid&&periodValid&&title.isNotBlank()&&normalizedHabitColor(color)!=null&&normalizedHabitEmoji(emoji)!=null&&
                    (ritualId!="custom"||ritualName.isNotBlank())&&
                    (limit==0||config.days.isNotEmpty())&&(end.isEmpty()||end>=start)&&intervalSchedule?.valid()!=false,onClick={
                    onSave(initial.copy(title=if (title.trim() == editorInitialTitle) initial.title else title.trim(),description=description,priority=priority,scoringMode=scoring,
                        createdDate=if(existing==null) LocalDate.parse(start) else initial.createdDate,
                        emoji=requireNotNull(normalizedHabitEmoji(emoji)),color=requireNotNull(normalizedHabitColor(color)),
                        isKeyHabit=isKeyHabit,ritualId=ritualId,ritualName=if(ritualId=="custom") ritualName.trim() else "",
                        preferredTime=preferredTime,reminder=reminder,measurement=measurement,periodGoal=periodGoal,
                        intervalSchedule=if(measurement!=null||periodGoal!=null) intervalSchedule?.copy(completionMode="day") else intervalSchedule,
                        qualityScale=when(scoring){"quality-ten"->"ten";"quality-bipolar"->"bipolar";else->"none"},
                        schedule=initial.schedule.copy(startDate=LocalDate.parse(start),endDate=end.takeIf(String::isNotEmpty)?.let(LocalDate::parse),recurrence=config)))
                }) { Text(if(busy) "Сохранение…" else "Сохранить") }
            }
        }
    } }
}
