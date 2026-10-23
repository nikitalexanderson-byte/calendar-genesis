package ru.genesis.calendar.domain.habits

import org.json.JSONObject
import ru.genesis.calendar.auth.adviceCategories
import ru.genesis.calendar.auth.adviceTopics
import java.text.Normalizer
import java.time.LocalDate
import java.util.Locale

/** Identical dictionaries and bounded numeric signals to web; habit text never leaves the device. */
internal object AdviceAffinity {
    private val separator = Regex("[^\\p{L}\\p{N}]+")
    // Android 9's ICU rejects Java's IsHan/IsHiragana regex aliases.
    private fun containsCjk(value: String): Boolean {
        var offset = 0
        while (offset < value.length) {
            val point = value.codePointAt(offset)
            val script = Character.UnicodeScript.of(point)
            if (script == Character.UnicodeScript.HAN || script == Character.UnicodeScript.HIRAGANA ||
                script == Character.UnicodeScript.KATAKANA) return true
            offset += Character.charCount(point)
        }
        return false
    }
    private val shortLatin = Regex("[a-z]+")
    fun context(habits: List<Habit>, day: LocalDate, smart: Boolean, categories: JSONObject, topics: JSONObject): JSONObject {
        val scores = JSONObject(); val topicScores = JSONObject()
        if (!smart) return JSONObject().put("scores", scores).put("topics", topicScores)
        adviceCategories.forEach { scores.put(it, 0.0) }; adviceTopics.forEach { topicScores.put(it, 0.0) }
        for (habit in habits) {
            val state = HabitLifecycle.state(habit, day)
            if (state.status != "active" || state.conflict || habit.createdDate > day || habit.schedule.startDate > day ||
                habit.schedule.endDate?.let { it < day } == true) continue
            val tokens = Normalizer.normalize(habit.title + " " + habit.description + " " + habit.ritualName,
                Normalizer.Form.NFKC).lowercase(Locale.ROOT).split(separator)
            val weight = 1.0 + (if (habit.isKeyHabit) 1 else 0) + habit.priority.coerceIn(0, 3) / 3.0
            fun score(rule: JSONObject, sectors: Boolean): Double {
                fun match(key: String, value: String?) = value != null && rule.optJSONArray(key)?.let { rows ->
                    (0 until rows.length()).any { rows.getString(it) == value }
                } == true
                val words = rule.getJSONArray("words")
                val matches = (0 until words.length()).count { index ->
                    val word = words.getString(index)
                    tokens.any { token -> when {
                        containsCjk(word) -> token.contains(word)
                        word.length <= 4 && shortLatin.matches(word) -> token == word
                        else -> token.startsWith(word)
                    } }
                }.coerceAtMost(3)
                return weight * ((if (match("templates", habit.sourceTemplateId)) 3 else 0) +
                    (if (sectors && match("sectors", habit.sacredSectorId)) 2 else 0) + matches)
            }
            adviceCategories.forEach { scores.put(it, (scores.getDouble(it) + score(categories.getJSONObject(it), true)).coerceAtMost(1000.0)) }
            adviceTopics.forEach { topicScores.put(it, (topicScores.getDouble(it) + score(topics.getJSONObject(it), false)).coerceAtMost(1000.0)) }
        }
        return JSONObject().put("scores", scores).put("topics", topicScores)
    }
}
