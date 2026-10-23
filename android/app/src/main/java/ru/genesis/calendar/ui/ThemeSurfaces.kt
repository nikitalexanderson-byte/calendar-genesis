package ru.genesis.calendar.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** STANDART controls keep Material behavior with the shared rectangular silhouette. */
@Composable internal fun Button(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = AffairsLayout.controlShape, colors: ButtonColors = ButtonDefaults.buttonColors(),
    elevation: ButtonElevation? = ButtonDefaults.buttonElevation(), border: BorderStroke? = null,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding, interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit) {
    androidx.compose.material3.Button(onClick, modifier.heightIn(min = 48.dp), enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)
}

@Composable internal fun OutlinedButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = AffairsLayout.controlShape, colors: ButtonColors = ButtonDefaults.outlinedButtonColors(),
    elevation: ButtonElevation? = null, border: BorderStroke? = ButtonDefaults.outlinedButtonBorder(enabled),
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding, interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit) {
    androidx.compose.material3.OutlinedButton(onClick, modifier.heightIn(min = 48.dp), enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)
}

@Composable internal fun FilledTonalButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = AffairsLayout.controlShape, colors: ButtonColors = ButtonDefaults.filledTonalButtonColors(),
    elevation: ButtonElevation? = ButtonDefaults.filledTonalButtonElevation(), border: BorderStroke? = null,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding, interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit) {
    androidx.compose.material3.FilledTonalButton(onClick, modifier.heightIn(min = 48.dp), enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)
}

@Composable internal fun TextButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    shape: Shape = AffairsLayout.controlShape, colors: ButtonColors = ButtonDefaults.textButtonColors(),
    elevation: ButtonElevation? = null, border: BorderStroke? = null,
    contentPadding: PaddingValues = ButtonDefaults.TextButtonContentPadding, interactionSource: MutableInteractionSource? = null,
    content: @Composable RowScope.() -> Unit) {
    androidx.compose.material3.TextButton(onClick, modifier.heightIn(min = 48.dp), enabled, shape, colors, elevation, border, contentPadding, interactionSource, content)
}

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
