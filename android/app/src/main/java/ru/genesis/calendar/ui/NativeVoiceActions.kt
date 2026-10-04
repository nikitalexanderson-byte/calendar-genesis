package ru.genesis.calendar.ui

import ru.genesis.calendar.data.GenesisProject
import ru.genesis.calendar.data.LocalTask
import ru.genesis.calendar.domain.habits.Habit

internal sealed interface NativeVoiceAction {
    data class Navigate(val section: String): NativeVoiceAction
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
        .replace(Regex("(?iu)^(?:хочу|пожалуйста|please|i want to)\\s+"),"").trim()
    if(command.isBlank() || command.contains(';') || command.contains('\n')) return null
    fun subject(pattern: String): String? = Regex(pattern,RegexOption.IGNORE_CASE).matchEntire(command)
        ?.groupValues?.get(1)?.trim(' ','«','»','"','.',',','!','?')?.takeIf(String::isNotBlank)
    fun <T> resolve(name: String, records: List<T>, title: (T)->String): T {
        val exact=records.filter { title(it).equals(name,true) }
        val found=if(exact.isNotEmpty()) exact else records.filter { title(it).contains(name,true) }
        require(found.size==1) { if(found.isEmpty()) "Не найдено: $name" else "Найдено несколько совпадений: $name. Уточните название." }
        return found.single()
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
    Regex("(?iu)^(?:(?:хочу|пожалуйста|please|i want to)\\s+)?(?:удали|удалить|delete|remove|редактируй|отредактируй|отредактировать|редактировать|измени|изменить|edit|перемести|перенеси|move|открой|покажи|перейди|open|show|убери|исключи)(?=\\s|$)")
        .containsMatchIn(command.trim()) ||
    Regex("(?iu)^(?:создай|создать|добавь|добавить|create|add)\\s+(?:новый|новую|new)?\\s*(?:проект|привычк[а-яё]*|список|project|habit|task list)(?=\\s|$)")
        .containsMatchIn(command.trim())

internal fun isVoiceTaskCreationCommand(command: String): Boolean =
    Regex("(?iu)^(создай|создать|добавь|добавить|create|add)\\s+(?:новую?\\s+)?(?:задачу|задачи|task|tasks)(?=\\s|$)")
        .containsMatchIn(command.trim())
