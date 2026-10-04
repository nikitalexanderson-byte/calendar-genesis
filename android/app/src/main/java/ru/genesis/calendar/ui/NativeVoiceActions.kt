package ru.genesis.calendar.ui

import ru.genesis.calendar.data.GenesisProject
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.habits.Habit
import ru.genesis.calendar.domain.CalendarMode

sealed interface NativeVoiceAction {
    data class Navigate(val section: String): NativeVoiceAction
    data class CalendarModeChange(val mode: CalendarMode): NativeVoiceAction
    data class CalendarView(val year: Boolean): NativeVoiceAction
    data class CalendarStep(val year: Boolean, val step: Int): NativeVoiceAction
    data class CalendarSwipe(val step: Int): NativeVoiceAction
    data class CalendarDate(val year: Int, val month: Int, val day: Int): NativeVoiceAction
    data class CalendarMonth(val ordinal: Int): NativeVoiceAction
    data class Scroll(val direction: String): NativeVoiceAction
    data class CreateProject(val title: String): NativeVoiceAction
    data class CreateTaskList(val title: String): NativeVoiceAction
    data class EditProject(val id: String, val title: String): NativeVoiceAction
    data class CreateHabit(val title: String): NativeVoiceAction
    data class EditHabit(val id: String, val title: String): NativeVoiceAction
    data class DeleteHabit(val id: String, val title: String): NativeVoiceAction
    data class EditTask(val id: String, val title: String): NativeVoiceAction
    data class SetTaskDone(val id: String, val title: String, val done: Boolean): NativeVoiceAction
    data class SetHabitDone(val id: String, val title: String, val done: Boolean): NativeVoiceAction
    data class MoveTask(val id: String, val title: String, val projectId: String?): NativeVoiceAction
}

/** Explicit commands only: unknown or ambiguous titles never mutate user data. */
internal fun parseNativeVoiceAction(raw: String, tasks: List<LocalTask>, projects: List<GenesisProject>,
    habits: List<Habit>): NativeVoiceAction? {
    val command=raw.trim().replace(Regex("\\s+")," ")
        .replace(Regex("(?iu)^(?:генезис|genesis)[,\\s]+"),"")
        .replace(Regex("(?iu)^(?:(?:хочу|пожалуйста|please|i want to|можешь|could you)[,\\s]+)+"),"")
        .replace(Regex("(?iu)[,\\s]+(?:пожалуйста|please)[.!?]*$"),"")
        .trimEnd('.','!','?').trim()
    if(command.isBlank() || command.contains(';') || command.contains('\n')) return null
    fun subject(pattern: String): String? = Regex(pattern,RegexOption.IGNORE_CASE).matchEntire(command)
        ?.groupValues?.get(1)?.trim(' ','«','»','"','.',',','!','?')?.takeIf(String::isNotBlank)
    fun <T> resolve(name: String, records: List<T>, title: (T)->String): T {
        val exact=records.filter { title(it).equals(name,true) }
        val found=if(exact.isNotEmpty()) exact else records.filter { title(it).contains(name,true) }
        require(found.size==1) { if(found.isEmpty()) "Не найдено: $name" else "Найдено несколько совпадений: $name. Уточните название." }
        return found.single()
    }
    subject("(?:(?:переключи|переключить|поменяй|выбери|установи|включи|покажи|открой|switch(?: to)?|select|use|show|open)\\s+)?(?:календарь\\s+)?(?:на\\s+|в\\s+)?(лунн[а-яё]*|сакральн[а-яё]*|григорианск[а-яё]*|профанск[а-яё]*|lunar|sacred|gregorian)(?:\\s+календарь)?")?.let {
        val mode=when {
            it.startsWith("лун",true) || it.equals("lunar",true) -> CalendarMode.LUNAR
            it.startsWith("сакрал",true) || it.equals("sacred",true) -> CalendarMode.SACRED
            else -> CalendarMode.PROFANE
        }
        return NativeVoiceAction.CalendarModeChange(mode)
    }
    subject("(?:открой|покажи|перейди\\s+(?:в|на|к)|выбери|open|show|switch\\s+to)\\s+(?:(?:календарь|calendar)\\s*)?(год(?:овой\\s+вид)?|месяц|year(?:\\s+view)?|month(?:\\s+view)?)")?.let {
        return NativeVoiceAction.CalendarView(it.startsWith("год",true) || it.startsWith("year",true))
    }
    Regex("(?iu)(?:(следующ[а-яё]*|предыдущ[а-яё]*|прошл[а-яё]*|next|previous|last)\\s+(месяц[а-яё]*|год[а-яё]*|month|year)|(месяц[а-яё]*|год[а-яё]*|month|year)\\s+(впер[её]д|назад|forward|back))")
        .matchEntire(command)?.let { match ->
            val unit=match.groupValues[2].ifBlank { match.groupValues[3] }
            val direction=match.groupValues[1].ifBlank { match.groupValues[4] }
            return NativeVoiceAction.CalendarStep(unit.startsWith("год",true) || unit.startsWith("year",true),
                if(Regex("(?iu)^(?:пред|прош|prev|last|назад|back)").containsMatchIn(direction)) -1 else 1)
        }
    subject("(?:свайп(?:ни|нуть|ай)?|листай|пролистай|swipe)\\s+(влево|вправо|left|right)")?.let {
        return NativeVoiceAction.CalendarSwipe(if(it.equals("влево",true) || it.equals("left",true)) 1 else -1)
    }
    subject("(?:прокрути|пролистай|листай|скролл(?:ь|и)?|scroll)(?:\\s+(?:страницу|экран|page))?\\s+(вверх|вниз|наверх|в\\s+начало|в\\s+конец|up|down|top|bottom)")?.let {
        return NativeVoiceAction.Scroll(when {
            it.equals("наверх",true) || it.equals("top",true) || it.equals("в начало",true) -> "top"
            it.equals("bottom",true) || it.equals("в конец",true) -> "bottom"
            it.equals("вверх",true) || it.equals("up",true) -> "up"
            else -> "down"
        })
    }
    Regex("(?iu)(?:покажи|открой|выбери|перейди\\s+на|show|open|select)\\s+(?:(?:дату|день|date|day)\\s+)?(\\d{4})-(\\d{1,2})-(\\d{1,2})")
        .matchEntire(command)?.let { return NativeVoiceAction.CalendarDate(it.groupValues[1].toInt(),it.groupValues[2].toInt(),it.groupValues[3].toInt()) }
    Regex("(?iu)(?:покажи|открой|выбери|перейди\\s+на|show|open|select)\\s+(?:(?:дату|день|date|day)\\s+)?(\\d{1,2})\\s+([а-яёa-z]+)\\s+(\\d{4})(?:\\s+года)?")
        .matchEntire(command)?.let { match ->
            val name=match.groupValues[2].lowercase()
            val russian=listOf("январ","феврал","март","апрел","май","июн","июл","август","сентябр","октябр","ноябр","декабр")
            val english=listOf("january","february","march","april","may","june","july","august","september","october","november","december")
            val month=russian.indexOfFirst { name.startsWith(it) || it=="май" && name=="мая" }
                .takeIf { it>=0 } ?: english.indexOfFirst { name==it || name==it.take(3) }
            if(month>=0) return NativeVoiceAction.CalendarDate(match.groupValues[3].toInt(),month+1,match.groupValues[1].toInt())
        }
    subject("(?:покажи|открой|выбери|перейди\\s+(?:в|на|к)|show|open|select)\\s+(?:(?:месяц|month)\\s+)?(\\d{1,2})(?:[-\\s]?(?:й|ый|ой|го|месяц|month))?")?.let {
        return NativeVoiceAction.CalendarMonth(it.toInt())
    }
    subject("(?:открой|покажи|перейди в|open|show)\\s+(сегодня|календарь|задачи|списки задач|проекты|привычки|сакральные привычки|путь героя|путь героических рангов|настройки|сон и настроение|теокиклос|стойхейон|today|calendar|tasks|task lists|projects|habits|sacred habits|hero path|settings|sleep and mood|theokyklos|stoicheion)")?.let {
        val tab=when(it.lowercase()) {
            "сегодня","today" -> "Сегодня"
            "календарь","calendar" -> "Календарь"
            "задачи","tasks" -> "Задачи"
            "списки задач","task lists" -> "Списки задач"
            "проекты","projects" -> "Проекты"
            "привычки","habits" -> "Привычки"
            "сакральные привычки","sacred habits" -> "Сакральные привычки"
            "путь героя","путь героических рангов","hero path" -> "Путь героя"
            "настройки","settings" -> "Настройки"
            "теокиклос","theokyklos" -> "Теокиклос"
            "стойхейон","stoicheion" -> "Стойхейон"
            else -> "Сон и настроение"
        }
        return NativeVoiceAction.Navigate(tab)
    }
    subject("(?:создай|создать|добавь|добавить|create|add)\\s+(?:новый\\s+)?(?:проект|project)\\s+(.+)")?.let {
        return NativeVoiceAction.CreateProject(it.take(500))
    }
    subject("(?:создай|создать|добавь|добавить|create|add)\\s+(?:новую\\s+)?(?:привычку|привычка|habit)\\s+(.+)")?.let {
        return NativeVoiceAction.CreateHabit(it.take(300))
    }
    subject("(?:создай|создать|добавь|добавить|create|add)\\s+(?:новый\\s+)?(?:список задач|task list)\\s+(.+)")?.let {
        return NativeVoiceAction.CreateTaskList(it.take(300))
    }
    subject("(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\\s+(?:задачу|задача|task)\\s+(.+)")?.let {
        val task=resolve(it,tasks,LocalTask::title)
        return NativeVoiceAction.EditTask(task.id,task.title)
    }
    subject("(?:выполни|заверши|отметь|пометь|complete)\\s+(?:задачу|задача|task)\\s+(.+)")?.let {
        val task=resolve(it,tasks,LocalTask::title)
        return NativeVoiceAction.SetTaskDone(task.id,task.title,true)
    }
    subject("(?:сними выполнение|отмени выполнение|uncomplete)\\s+(?:задачи|задачу|task)\\s+(.+)")?.let {
        val task=resolve(it,tasks,LocalTask::title)
        return NativeVoiceAction.SetTaskDone(task.id,task.title,false)
    }
    subject("(?:выполни|отметь|пометь|complete)\\s+(?:привычку|привычка|habit)\\s+(.+)")?.let {
        val habit=resolve(it,habits,Habit::title)
        return NativeVoiceAction.SetHabitDone(habit.id,habit.title,true)
    }
    subject("(?:сними отметку|отмени выполнение|uncomplete)\\s+(?:привычки|привычку|habit)\\s+(.+)")?.let {
        val habit=resolve(it,habits,Habit::title)
        return NativeVoiceAction.SetHabitDone(habit.id,habit.title,false)
    }
    subject("(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\\s+(?:привычку|привычка|habit)\\s+(.+)")?.let {
        val habit=resolve(it,habits,Habit::title)
        return NativeVoiceAction.EditHabit(habit.id,habit.title)
    }
    subject("(?:удали|удалить|delete|remove)\\s+(?:привычку|привычка|habit)\\s+(.+)")?.let {
        val habit=resolve(it,habits,Habit::title)
        return NativeVoiceAction.DeleteHabit(habit.id,habit.title)
    }
    subject("(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\\s+(?:проект|project)\\s+(.+)")?.let {
        val project=resolve(it,projects,GenesisProject::title)
        return NativeVoiceAction.EditProject(project.id,project.title)
    }
    val move=Regex("(?iu)(?:перемести|перенеси|move)\\s+(?:задачу|задача|task)\\s+(.+?)\\s+(?:в|into|to)\\s+(?:проект|project)\\s+(.+)")
        .matchEntire(command)
    if(move!=null) {
        val task=resolve(move.groupValues[1].trim(' ','«','»','"'),tasks,LocalTask::title)
        val name=move.groupValues[2].trim(' ','«','»','"','.',',','!','?')
        val projectId=if(name.equals("хаос-бокс",true) || name.equals("inbox",true)) null
            else resolve(name,projects,GenesisProject::title).id
        return NativeVoiceAction.MoveTask(task.id,task.title,projectId)
    }
    subject("(?:убери|исключи|remove)\\s+(?:задачу|задача|task)\\s+(.+?)\\s+(?:из проекта|from project)")?.let {
        val task=resolve(it,tasks,LocalTask::title)
        return NativeVoiceAction.MoveTask(task.id,task.title,null)
    }
    return null
}

internal fun looksLikeUnsupportedVoiceAction(command: String): Boolean =
    Regex("(?iu)^(?:(?:хочу|пожалуйста|please|i want to)\\s+)?(?:удали|удалить|delete|remove|редактируй|отредактируй|отредактировать|редактировать|измени|изменить|edit|перемести|перенеси|move|открой|покажи|перейди|open|show|убери|исключи|прокрути|пролистай|листай|скролль|свайпни|поменяй|переключи|установи|выбери|scroll|swipe|switch|select)(?=\\s|$)")
        .containsMatchIn(command.trim()) ||
    Regex("(?iu)^(?:создай|создать|добавь|добавить|create|add)\\s+(?:новый|новую|new)?\\s*(?:проект|привычк[а-яё]*|список|project|habit|task list)(?=\\s|$)")
        .containsMatchIn(command.trim())

internal fun isVoiceTaskCreationCommand(command: String): Boolean =
    Regex("(?iu)^(создай|создать|добавь|добавить|create|add)\\s+(?:новую?\\s+)?(?:задачу|задачи|task|tasks)(?=\\s|$)")
        .containsMatchIn(command.trim())
