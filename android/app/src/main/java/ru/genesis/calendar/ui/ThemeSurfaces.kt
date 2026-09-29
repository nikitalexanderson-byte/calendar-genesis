package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Shared theme treatment also covers the original feature cards and their dialogs. */
@Composable
internal fun Surface(modifier: Modifier = Modifier, shape: Shape = RectangleShape,
    color: Color = MaterialTheme.colorScheme.surface, contentColor: Color = contentColorFor(color),
    tonalElevation: Dp = 0.dp, shadowElevation: Dp = 0.dp, border: BorderStroke? = null,
    content: @Composable () -> Unit) {
    androidx.compose.material3.Surface(modifier, shape, eveningSurface(color), eveningInk(contentColor),
        tonalElevation, shadowElevation, border, content)
}

@Composable
internal fun Surface(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = RectangleShape, color: Color = MaterialTheme.colorScheme.surface,
    contentColor: Color = contentColorFor(color), tonalElevation: Dp = 0.dp, shadowElevation: Dp = 0.dp,
    border: BorderStroke? = null, interactionSource: MutableInteractionSource? = null,
    content: @Composable () -> Unit) {
    androidx.compose.material3.Surface(onClick = onClick, modifier = modifier, enabled = enabled,
        shape = shape, color = eveningSurface(color), contentColor = eveningInk(contentColor),
        tonalElevation = tonalElevation, shadowElevation = shadowElevation, border = border,
        interactionSource = interactionSource, content = content)
}

@Composable private fun cardColors(colors: CardColors) = if (!LocalEveningTheme.current) colors else
    CardDefaults.cardColors(containerColor = eveningSurface(colors.containerColor),
        contentColor = eveningInk(colors.contentColor),
        disabledContainerColor = eveningSurface(colors.disabledContainerColor),
        disabledContentColor = eveningInk(colors.disabledContentColor))

@Composable
internal fun Card(modifier: Modifier = Modifier, shape: Shape = CardDefaults.shape,
    colors: CardColors = CardDefaults.cardColors(), elevation: CardElevation = CardDefaults.cardElevation(),
    border: BorderStroke? = null, content: @Composable ColumnScope.() -> Unit) {
    androidx.compose.material3.Card(modifier, shape, cardColors(colors), elevation, border, content)
}

@Composable
internal fun Card(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = CardDefaults.shape, colors: CardColors = CardDefaults.cardColors(),
    elevation: CardElevation = CardDefaults.cardElevation(), border: BorderStroke? = null,
    interactionSource: MutableInteractionSource? = null, content: @Composable ColumnScope.() -> Unit) {
    androidx.compose.material3.Card(onClick = onClick, modifier = modifier, enabled = enabled,
        shape = shape, colors = cardColors(colors), elevation = elevation, border = border,
        interactionSource = interactionSource, content = content)
}
