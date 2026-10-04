package ru.genesis.calendar.ui

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test
import ru.genesis.calendar.data.GenesisProject
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.GenesisCalendar
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.domain.habits.HabitEngine
import ru.genesis.calendar.domain.habits.TrackerEntity
import ru.genesis.calendar.domain.CalendarMode

class NativeVoiceActionsTest {
    private val project=GenesisProject("project-1",null,"work","Работа","",emptyList(),"active",0)
    private val task=LocalTask(id="task-1",title="Отправить отчёт")
    private val habit=Habit(TrackerEntity.create("habit"),"Читать утром",LocalDate.of(2026,10,4),
        HabitEngine(GenesisCalendar()).defaultSchedule(LocalDate.of(2026,10,4),CalendarMode.SACRED))

    @Test fun opensExactTaskAndNeverCreatesOneByMistake() {
        assertEquals(NativeVoiceAction.EditTask("task-1","Отправить отчёт"),
            parseNativeVoiceAction("хочу отредактировать задачу Отправить отчёт",listOf(task),listOf(project),listOf(habit)))
        assertTrue(looksLikeUnsupportedVoiceAction("удали проект Работа"))
    }

    @Test fun movesTaskAndRoutesHabitDeleteToConfirmation() {
        assertEquals(NativeVoiceAction.MoveTask("task-1","Отправить отчёт","project-1"),
            parseNativeVoiceAction("перенеси задачу Отправить отчёт в проект Работа",listOf(task),listOf(project),listOf(habit)))
        assertEquals(NativeVoiceAction.DeleteHabit(habit.id,habit.title),
            parseNativeVoiceAction("удали привычку Читать утром",listOf(task),listOf(project),listOf(habit)))
    }

    @Test fun backgroundCommandsNavigateAndMarkItemsComplete() {
        assertEquals(NativeVoiceAction.Navigate("Сакральные привычки"),
            parseNativeVoiceAction("открой сакральные привычки",listOf(task),listOf(project),listOf(habit)))
        assertEquals(NativeVoiceAction.Navigate("Путь героя"),
            parseNativeVoiceAction("покажи путь героя",listOf(task),listOf(project),listOf(habit)))
        assertEquals(NativeVoiceAction.SetTaskDone(task.id,task.title,true),
            parseNativeVoiceAction("выполни задачу Отправить отчёт",listOf(task),listOf(project),listOf(habit)))
        assertEquals(NativeVoiceAction.SetHabitDone(habit.id,habit.title,false),
            parseNativeVoiceAction("сними отметку привычки Читать утром",listOf(task),listOf(project),listOf(habit)))
        assertTrue(isVoiceTaskCreationCommand("создай задачу Проверить почту"))
        assertFalse(isVoiceTaskCreationCommand("создай проект Проверить почту"))
    }
}
