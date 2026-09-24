package ru.genesis.calendar.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ru.genesis.calendar.data.LocalHabitWorkspace
import ru.genesis.calendar.domain.habits.HeroPathCheckpoint
import ru.genesis.calendar.domain.habits.HeroProgress
import ru.genesis.calendar.domain.habits.HeroRankCatalog
import ru.genesis.calendar.domain.habits.HeroicRank

/** Phone-sized alternating tree based on the site's HeroPathPanel, not a horizontal gallery. */
private val rankPaintings = listOf(
    "01_tantal.webp", "02_sisyphus.webp", "03_cyclops.webp", "04_icarus.webp",
    "05_lionheart.webp", "06_poison_conqueror.webp", "07_golden_horn_pathfinder.webp",
    "08_mountain_tamer.webp", "09_lord_of_the_flow.webp", "10_bronze_wing.webp",
    "11_tamer_of_might.webp", "12_iron_charioteer.webp", "13_bearer_of_royal_honor.webp",
    "14_guardian_of_the_western_border.webp", "15_keeper_of_the_golden_garden.webp",
    "16_risen_from_the_abyss.webp")
private val amphoraPaintings = listOf("17_amphora_of_aspiration.webp", "18_amphora_of_endurance.webp",
    "19_amphora_of_mastery.webp", "20_amphora_of_abyss.webp")

@Composable
internal fun HeroRankTree(workspace: LocalHabitWorkspace, busy: Boolean,
    onClaimAmphora: (String) -> Unit, onRevealHiddenPath: () -> Unit) {
    val progress = workspace.progress
    val current = HeroProgress.rankForProgress(progress)
    val next = HeroProgress.nextRankForProgress(progress)
    var selected by remember { mutableStateOf<HeroicRank?>(null) }
    Column(Modifier.fillMaxWidth().testTag("hero-rank-tree"),
        verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text("Путь Героя", style = MaterialTheme.typography.titleLarge)
        Text("${current.title} · ${progress.lifetimeXp} XP", style = MaterialTheme.typography.titleMedium)
        Text(if (next == null) "Видимый путь пройден" else
            "До «${next.title}»: ${(next.threshold - progress.lifetimeXp).coerceAtLeast(0)} XP",
            style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(12.dp))
        val visible = HeroRankCatalog.ranks.filter { it.path != "hidden" }
        visible.forEachIndexed { index, rank ->
            RankTreeRow(rank, index, rankPaintings.getOrNull(index), workspace, busy,
                onSelect = { selected = rank }, onClaimAmphora = onClaimAmphora)
        }
        if (!HeroProgress.hiddenUnlocked(progress.lifetimeXp)) {
            Card(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text("Путь продолжается…", style = MaterialTheme.typography.titleMedium)
                    Text("За видимыми вратами скрывается продолжение.",
                        style = MaterialTheme.typography.bodySmall)
                }
            }
        } else if (!HeroProgress.hiddenRevealed(progress)) {
            Button(onClick = onRevealHiddenPath, enabled = !busy,
                modifier = Modifier.fillMaxWidth().testTag("reveal-hidden-hero-path")) {
                Text("Открыть продолжение пути")
            }
        } else {
            Text("Второй путь · за вратами", Modifier.padding(vertical = 12.dp),
                style = MaterialTheme.typography.titleLarge)
            HeroRankCatalog.ranks.filter { it.path == "hidden" }.forEachIndexed { index, rank ->
                RankTreeRow(rank, visible.size + index, null, workspace, busy,
                    onSelect = { selected = rank }, onClaimAmphora = onClaimAmphora)
            }
        }
    }
    selected?.let { rank ->
        val index = HeroRankCatalog.ranks.indexOf(rank)
        val painting = rankPaintings.getOrNull(index)
        Dialog(onDismissRequest = { selected = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Surface(Modifier.fillMaxWidth().padding(16.dp), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Ступень ${index + 1} · ${rank.title}", style = MaterialTheme.typography.titleLarge)
                    if (painting != null) OriginalImage("hero-path/512/$painting", rank.title,
                        Modifier.fillMaxWidth().height(260.dp))
                    Text("${rank.threshold} XP · ${if (progress.lifetimeXp >= rank.threshold) "Достигнут" else "Впереди"}")
                    Text("Опыт ранга сохраняется навсегда и не тратится.",
                        style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { selected = null }) { Text("Закрыть") }
                }
            }
        }
    }
}

@Composable
private fun RankTreeRow(rank: HeroicRank, index: Int, painting: String?,
    workspace: LocalHabitWorkspace, busy: Boolean, onSelect: () -> Unit,
    onClaimAmphora: (String) -> Unit) {
    val left = index % 2 == 0
    val checkpoint = HeroProgress.checkpoints.firstOrNull { it.rankId == rank.id }
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) {
            if (left) RankTreeNode(rank, index, painting, checkpoint, workspace, busy, onSelect,
                onClaimAmphora)
        }
        Canvas(Modifier.width(26.dp).fillMaxHeight()) {
            val center = size.width / 2f
            val y = size.height / 2f
            val gold = Color(0xffb18b48)
            drawLine(gold.copy(alpha = .6f), Offset(center, 0f), Offset(center, size.height),
                strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
            drawLine(gold, Offset(center, y), Offset(if (left) 0f else size.width, y),
                strokeWidth = 2.dp.toPx())
            drawCircle(gold, radius = 5.dp.toPx(), center = Offset(center, y))
        }
        Box(Modifier.weight(1f)) {
            if (!left) RankTreeNode(rank, index, painting, checkpoint, workspace, busy, onSelect,
                onClaimAmphora)
        }
    }
}

@Composable
private fun RankTreeNode(rank: HeroicRank, index: Int, painting: String?,
    checkpoint: HeroPathCheckpoint?, workspace: LocalHabitWorkspace, busy: Boolean,
    onSelect: () -> Unit, onClaimAmphora: (String) -> Unit) {
    val reached = workspace.progress.lifetimeXp >= rank.threshold
    val current = HeroProgress.rankForProgress(workspace.progress).id == rank.id
    val gold = Color(0xffb18b48)
    Column(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Card(onClick = onSelect, modifier = Modifier.fillMaxWidth().testTag("hero-tree-rank-${rank.id}"),
            border = BorderStroke(1.dp, if (reached) gold else MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(7.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (painting != null) OriginalImage("hero-path/256/$painting", rank.title,
                    Modifier.fillMaxWidth().height(104.dp))
                Text("СТУПЕНЬ ${index + 1}", color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelSmall)
                Text(rank.title, style = MaterialTheme.typography.titleSmall, maxLines = 2)
                Text("${rank.threshold} XP · ${if (current) "Вы здесь" else if (reached) "Достигнут" else "Впереди"}",
                    style = MaterialTheme.typography.labelSmall)
            }
        }
        if (checkpoint != null) {
            val claimed = workspace.rewards.any {
                it.idempotencyKey == "hero-path-amphora:self:${checkpoint.rankId}"
            }
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Column(Modifier.padding(7.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    val art = amphoraPaintings.getOrNull(HeroProgress.checkpoints.indexOf(checkpoint))
                    if (art != null) OriginalImage("hero-path/256/$art", checkpoint.title,
                        Modifier.size(42.dp))
                    Text(checkpoint.title, style = MaterialTheme.typography.labelMedium)
                    Text("+${checkpoint.rewardLaurels} Лавров", style = MaterialTheme.typography.labelSmall)
                    TextButton(onClick = { onClaimAmphora(checkpoint.rankId) },
                        enabled = reached && !claimed && !busy,
                        modifier = Modifier.testTag("amphora-${checkpoint.rankId}")) {
                        Text(if (claimed) "Получено" else if (reached) "Открыть" else "Закрыто")
                    }
                }
            }
        }
    }
}
