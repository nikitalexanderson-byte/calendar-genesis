package ru.genesis.calendar.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.size
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** A direct, green entry point; motion follows the user's press, never an idle loop. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun SharedMindmapButton(onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) .94f else 1f, label = "mindmap-press")
    val label = genesisTranslate("Общие майндмепы")
    TooltipBox(positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
        tooltip = { PlainTooltip { Text("Общие майндмепы") } }, state = rememberTooltipState()) {
        FilledIconButton(onClick, interactionSource = interaction, shape = AffairsLayout.controlShape,
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary),
            modifier = Modifier.size(48.dp).scale(scale).testTag("shared-mindmaps-open")
                .semantics { contentDescription = label }) { AffairsActionIcon(AffairsAction.MINDMAP) }
    }
}
