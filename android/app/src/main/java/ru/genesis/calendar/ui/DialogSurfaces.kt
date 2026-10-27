package ru.genesis.calendar.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties

/** Preserve the platform time picker's background, insets and 24h/AM-PM controls. */
@Composable internal fun genesisNativeDialogFrame(): (android.app.Dialog) -> Unit {
    val stroke = MaterialTheme.colorScheme.secondary.toArgb()
    val density = LocalDensity.current.density
    return { dialog ->
        dialog.window?.let { window ->
            val original = window.decorView.background
            val padding = android.graphics.Rect()
            original?.getPadding(padding)
            val frame = android.graphics.drawable.GradientDrawable().apply {
                setColor(android.graphics.Color.TRANSPARENT)
                cornerRadius = 10f * density
                setStroke(kotlin.math.max(1, density.toInt()), stroke)
            }
            val layers = android.graphics.drawable.LayerDrawable(arrayOf(
                original ?: android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT), frame))
            layers.setLayerInset(1, padding.left, padding.top, padding.right, padding.bottom)
            window.setBackgroundDrawable(layers)
        }
    }
}

/** Keep native focus, Back and dismissal behavior while sharing the menu frame. */
@Composable internal fun AlertDialog(onDismissRequest: () -> Unit, confirmButton: @Composable () -> Unit,
    modifier: Modifier = Modifier, dismissButton: (@Composable () -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null, title: (@Composable () -> Unit)? = null,
    text: (@Composable () -> Unit)? = null, shape: Shape = AffairsLayout.shape,
    containerColor: Color = MaterialTheme.colorScheme.surfaceContainerHigh,
    iconContentColor: Color = AlertDialogDefaults.iconContentColor,
    titleContentColor: Color = AlertDialogDefaults.titleContentColor,
    textContentColor: Color = AlertDialogDefaults.textContentColor,
    tonalElevation: Dp = 0.dp, properties: DialogProperties = DialogProperties()) {
    androidx.compose.material3.AlertDialog(onDismissRequest, confirmButton,
        modifier.border(1.dp, MaterialTheme.colorScheme.secondary, shape), dismissButton, icon, title, text,
        shape, containerColor, iconContentColor, titleContentColor, textContentColor, tonalElevation, properties)
}

@Composable internal fun Dialog(onDismissRequest: () -> Unit,
    properties: DialogProperties = DialogProperties(), content: @Composable () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest, properties) {
        Box(Modifier.border(1.dp, MaterialTheme.colorScheme.secondary, AffairsLayout.shape).clip(AffairsLayout.shape),
            propagateMinConstraints = true) { content() }
    }
}
