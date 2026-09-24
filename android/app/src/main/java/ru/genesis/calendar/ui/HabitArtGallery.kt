package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.habits.StreakRewards
import ru.genesis.calendar.domain.habits.StreakProtection
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

private fun achievementIsQualified(id: String, workspace: LocalHabitWorkspace): Boolean {
    return workspace.achievementUnlocks.any { it.achievementId == id }
}

/** Original web images stay visible in their semantic rank, achievement and reward sections. */
@Composable
fun HabitArtGallery(workspace: LocalHabitWorkspace, today: LocalDate, busy: Boolean,
    onClaimAmphora: (String) -> Unit, onRevealHiddenPath: () -> Unit,
    onBuySpark: () -> Unit) {
    var galleryOpen by remember { mutableStateOf(false) }
    var rankOpen by remember { mutableStateOf(false) }
    var streakOpen by remember { mutableStateOf(false) }
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
                if (rankOpen) HeroRankTree(workspace, busy, onClaimAmphora, onRevealHiddenPath)
            }
        }
        Card(Modifier.fillMaxWidth().testTag("streak-reward-ladder")) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Награды за серию", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { streakOpen = !streakOpen }) {
                        Text(if (streakOpen) "Свернуть" else "Все рубежи")
                    }
                }
                val claimed = workspace.rewards.filter { it.reason == "streak-milestone" }
                    .mapNotNull { it.sourceId.toIntOrNull() }.toSet()
                val next = StreakRewards.milestones.firstOrNull { it.days !in claimed }
                Text("Рекорд: ${workspace.progress.longestStreak} дней · получено ${claimed.size}/${StreakRewards.milestones.size}",
                    style = MaterialTheme.typography.bodySmall)
                Text(if (next == null) "Все рубежи достигнуты" else
                    "Следующий рубеж: ${next.title} · ${next.days} ${if (next.days == 3) "дня" else "дней"} · +${next.laurels} Лавров",
                    style = MaterialTheme.typography.bodySmall)
                Text("Каждая награда начисляется один раз. Разрыв серии её не отнимает.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (streakOpen) StreakRewards.milestones.forEach { milestone ->
                    val earned = milestone.days in claimed
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(if (earned) "✓" else "◇", color = MaterialTheme.colorScheme.primary)
                        Text("${milestone.days} ${if (milestone.days == 3) "дня" else "дней"} · ${milestone.title}", Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium)
                        Text(if (earned) "Получено" else "+${milestone.laurels} Лавров",
                            style = MaterialTheme.typography.labelMedium)
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
                Text("Достигнутые рубежи сохраняются. Достижения не изменяют опыт ранга.",
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
        Card(Modifier.fillMaxWidth().testTag("hestia-spark-card")) {
            Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                OriginalImage("habit-reward-art/hestia-spark.png", "Искра Гестии", Modifier.size(72.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Искра Гестии", style = MaterialTheme.typography.titleMedium)
                    Text("Автоматически защитит один пропущенный день без XP и ложного выполнения.",
                        style = MaterialTheme.typography.bodySmall)
                    Text("Запас: ${workspace.progress.streakFreezeCount}/${StreakProtection.sparkMax} · ${StreakProtection.sparkCost} Лавров",
                        style = MaterialTheme.typography.labelMedium)
                    workspace.streakFreezeTransactions.lastOrNull { it.reason == "automatic-use" }?.let {
                        Text("Последняя защита: ${it.sourceId}", style = MaterialTheme.typography.bodySmall)
                    }
                    Button(onClick = onBuySpark, enabled = !busy &&
                        workspace.progress.streakFreezeCount < StreakProtection.sparkMax &&
                        workspace.progress.laurelsBalance >= StreakProtection.sparkCost,
                        modifier = Modifier.testTag("buy-hestia-spark")) { Text("Купить Искру") }
                }
            }
        }
        val comeback = StreakProtection.comebackSummary(workspace.goals, today)
        Card(Modifier.fillMaxWidth().testTag("comeback-card")) {
            Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                OriginalImage("habit-reward-art/comeback.png", "Возвращение", Modifier.size(72.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Возвращение", style = MaterialTheme.typography.titleMedium)
                    Text(if (comeback.active) "Выполните дневную цель три раза подряд. Прежняя серия не восстанавливается."
                        else "После разрыва серии здесь появится трёхдневный путь возвращения.",
                        style = MaterialTheme.typography.bodySmall)
                    Text(if (comeback.active) "${comeback.progress}/${StreakProtection.comebackTarget} дня"
                        else "Готово", style = MaterialTheme.typography.labelMedium)
                    comeback.lastCompletedDate?.let { date ->
                        Text("Последнее возвращение: $date · +${StreakProtection.comebackReward} Лавров",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
