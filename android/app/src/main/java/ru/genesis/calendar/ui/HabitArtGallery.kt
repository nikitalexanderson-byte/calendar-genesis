package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.habits.HeroRankCatalog
import java.time.LocalDate

private data class AchievementArt(val id: String, val title: String, val rule: String, val hidden: Boolean = false)
private val achievements = listOf(
    AchievementArt("first-step", "Первый шаг", "Выполнить первую привычку"),
    AchievementArt("three-day-rhythm", "Нить ритма", "Серия три дня"),
    AchievementArt("seven-sunrises", "Семь восходов", "Серия семь дней"),
    AchievementArt("fortnight-rhythm", "Укреплённый ритм", "Серия 14 дней"),
    AchievementArt("perfect-day", "Завершённый круг", "Первый идеальный день"),
    AchievementArt("habit-thirty", "Укоренение", "Одна привычка 30 раз"),
    AchievementArt("century", "Сотня", "Одна привычка 100 раз"),
    AchievementArt("iron-rhythm", "Железный ритм", "Серия 30 дней"),
    AchievementArt("fifty-sunrises", "Пятьдесят восходов", "Серия 50 дней"),
    AchievementArt("hundred-day-path", "Стодневный путь", "Серия 100 дней"),
    AchievementArt("perfect-week", "Идеальная неделя", "Семь идеальных дней подряд", true),
    AchievementArt("perfect-month", "Золотая череда", "30 идеальных дней подряд", true),
    AchievementArt("half-year-circle", "Полугодовой круг", "Серия 180 дней", true),
    AchievementArt("full-revolution", "Полный оборот", "Серия 365 дней", true),
    AchievementArt("five-hundred-sunrises", "Пятьсот восходов", "Серия 500 дней", true),
    AchievementArt("thousand-day-path", "Тысяча дней пути", "Серия 1000 дней", true),
    AchievementArt("comeback", "Возвращение", "Завершить путь возвращения", true),
    AchievementArt("consistency", "Созвездие постоянства", "1000 выполнений всего", true)
)

private val rankArt = listOf(
    "01_tantal.webp", "02_sisyphus.webp", "03_cyclops.webp", "04_icarus.webp",
    "05_lionheart.webp", "06_poison_conqueror.webp", "07_golden_horn_pathfinder.webp",
    "08_mountain_tamer.webp", "09_lord_of_the_flow.webp", "10_bronze_wing.webp",
    "11_tamer_of_might.webp", "12_iron_charioteer.webp", "13_bearer_of_royal_honor.webp",
    "14_guardian_of_the_western_border.webp", "15_keeper_of_the_golden_garden.webp",
    "16_risen_from_the_abyss.webp"
)

private fun achievementIsQualified(id: String, workspace: LocalHabitWorkspace): Boolean {
    val completed = workspace.completions.filter { it.completed }
    val bestHabit = completed.groupingBy { it.habitId }.eachCount().values.maxOrNull() ?: 0
    val streak = workspace.progress.longestStreak
    val perfectDates = workspace.goals.filter { it.status == "perfect" }.map { it.date }.distinct().sorted()
    var perfectRun = 0
    var currentRun = 0
    var previous: LocalDate? = null
    perfectDates.forEach { date ->
        currentRun = if (previous?.plusDays(1) == date) currentRun + 1 else 1
        perfectRun = maxOf(perfectRun, currentRun)
        previous = date
    }
    return when (id) {
        "first-step" -> completed.isNotEmpty()
        "three-day-rhythm" -> streak >= 3
        "seven-sunrises" -> streak >= 7
        "fortnight-rhythm" -> streak >= 14
        "perfect-day" -> perfectDates.isNotEmpty()
        "habit-thirty" -> bestHabit >= 30
        "century" -> bestHabit >= 100
        "iron-rhythm" -> streak >= 30
        "fifty-sunrises" -> streak >= 50
        "hundred-day-path" -> streak >= 100
        "perfect-week" -> perfectRun >= 7
        "perfect-month" -> perfectRun >= 30
        "half-year-circle" -> streak >= 180
        "full-revolution" -> streak >= 365
        "five-hundred-sunrises" -> streak >= 500
        "thousand-day-path" -> streak >= 1_000
        "comeback" -> workspace.rewards.any { it.reason == "comeback" }
        else -> completed.size >= 1_000
    }
}

/** Original web images stay visible in their semantic rank, achievement and reward sections. */
@Composable
fun HabitArtGallery(workspace: LocalHabitWorkspace) {
    var galleryOpen by remember { mutableStateOf(false) }
    var rankOpen by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth().testTag("hero-rank-path")) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Путь героических рангов", Modifier.weight(1f),
                        style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { rankOpen = !rankOpen }) {
                        Text(if (rankOpen) "Свернуть" else "Все ранги")
                    }
                }
                if (rankOpen) {
                    Row(Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        HeroRankCatalog.ranks.take(rankArt.size).forEachIndexed { index, rank ->
                            Card(Modifier.width(136.dp), border = BorderStroke(1.dp,
                                if (workspace.progress.lifetimeXp >= rank.threshold) Color(0xffb18b48)
                                else Color(0xffd9d7cc))) {
                                Column(Modifier.padding(6.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    OriginalImage("hero-path/256/${rankArt[index]}", rank.title,
                                        Modifier.fillMaxWidth().height(116.dp))
                                    Text(rank.title, style = MaterialTheme.typography.labelMedium,
                                        maxLines = 2)
                                    Text("${rank.threshold} XP", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                    Row(Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("17_amphora_of_aspiration.webp", "18_amphora_of_endurance.webp",
                            "19_amphora_of_mastery.webp", "20_amphora_of_abyss.webp").forEach { filename ->
                            OriginalImage("hero-path/256/$filename", "Амфора пути",
                                Modifier.size(82.dp))
                        }
                    }
                }
            }
        }
        Card(Modifier.fillMaxWidth().testTag("achievement-gallery")) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Достижения", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    Text("${achievements.count { achievementIsQualified(it.id, workspace) }} / ${achievements.size}",
                        style = MaterialTheme.typography.labelLarge)
                }
                Text("Иллюстрации и условия из оригинального каталога. Награда за новое достижение появится после переноса системы достижений.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { galleryOpen = !galleryOpen }) {
                    Text(if (galleryOpen) "Свернуть галерею" else "Открыть всю галерею")
                }
                if (galleryOpen) achievements.chunked(2).forEach { pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { achievement ->
                            val qualified = achievementIsQualified(achievement.id, workspace)
                            Card(Modifier.weight(1f).testTag("achievement-${achievement.id}")) {
                                Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    OriginalImage("achievement-art/${achievement.id}.webp", achievement.title,
                                        Modifier.fillMaxWidth().height(110.dp)
                                            .graphicsLayer { alpha = if (achievement.hidden && !qualified) .45f else 1f })
                                    Text(if (achievement.hidden && !qualified) "Тайное достижение" else achievement.title,
                                        style = MaterialTheme.typography.titleSmall)
                                    Text(if (achievement.hidden && !qualified) "Откроется по мере продвижения"
                                        else achievement.rule, style = MaterialTheme.typography.bodySmall)
                                    if (qualified) Text("Условие выполнено", color = MaterialTheme.colorScheme.primary,
                                        style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RewardImageCard("habit-reward-art/hestia-spark.png", "Искра Гестии", Modifier.weight(1f))
            RewardImageCard("habit-reward-art/comeback.png", "Возвращение", Modifier.weight(1f))
        }
    }
}

@Composable
private fun RewardImageCard(path: String, title: String, modifier: Modifier) {
    Card(modifier) {
        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            OriginalImage(path, title, Modifier.fillMaxWidth().height(112.dp))
            Text(title, style = MaterialTheme.typography.titleSmall)
        }
    }
}
