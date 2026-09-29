package ru.genesis.calendar.reminders

internal fun notificationCopyIndex(seed: String, length: Int): Int {
    var hash = 2166136261u
    seed.forEach { hash = (hash xor it.code.toUInt()) * 16777619u }
    return (hash % length.toUInt()).toInt()
}

internal fun habitNotificationBody(tone: String, kind: String, count: Int, english: Boolean,
    seed: String = "preview", subject: String? = null): String {
    val pool = habitNotificationMessages["$tone/${if (kind == "goal") "goal" else "habit"}"]
        ?: habitNotificationMessages.getValue("calm/habit")
    val pair = pool[notificationCopyIndex(seed, pool.size)]
    val name = subject ?: if (english) "your daily practice" else "«Практика дня»"
    return (if (english) pair.second else pair.first).replace("{subject}", name).replace("{count}", count.toString())
}
