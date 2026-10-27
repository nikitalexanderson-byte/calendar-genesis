package ru.genesis.calendar.ui

import ru.genesis.calendar.domain.habits.Habit

/** A reading keeps its own saved habit; it never occupies a default catalog practice slot. */
internal fun standardSacredHabit(habits: List<Habit>, practiceId: String): Habit? = habits.firstOrNull {
    it.sacredPracticeId == practiceId && it.stoicheionRestoration == null
}
