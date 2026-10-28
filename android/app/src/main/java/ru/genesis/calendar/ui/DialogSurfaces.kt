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
    val closeLabel = genesisTranslate("Закрыть")
    val timeLabel = genesisTranslate("Выберите время")
    return { dialog ->
        if (dialog is android.app.TimePickerDialog) {
            val context = dialog.context
            val target = (48 * density).toInt()
            val header = android.widget.LinearLayout(context).apply {
                orientation = android.widget.LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding((16 * density).toInt(), (4 * density).toInt(), (8 * density).toInt(), 0)
            }
            header.addView(android.widget.TextView(context).apply {
                text = timeLabel; textSize = 18f; setTextColor(stroke)
            }, android.widget.LinearLayout.LayoutParams(0, target, 1f))
            header.addView(android.widget.ImageButton(context).apply {
                setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
                imageTintList = android.content.res.ColorStateList.valueOf(stroke)
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                contentDescription = closeLabel
                setOnClickListener { dialog.cancel() }
            }, android.widget.LinearLayout.LayoutParams(target, target))
            dialog.setCustomTitle(header)
        }
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
    tonalElevation: Dp = 0.dp, properties: DialogProperties = DialogProperties(), showCloseButton: Boolean = true) {
    val framedTitle: @Composable () -> Unit = {
            GenesisDialogHeader(onClose = if (showCloseButton && (properties.dismissOnBackPress || properties.dismissOnClickOutside))
                onDismissRequest else null) {
                androidx.compose.material3.ProvideTextStyle(MaterialTheme.typography.titleLarge) { title?.invoke() }
            }
    }
    androidx.compose.material3.AlertDialog(onDismissRequest, confirmButton,
        modifier.border(1.dp, MaterialTheme.colorScheme.secondary, shape), dismissButton, icon, framedTitle, text,
        shape, containerColor, iconContentColor, titleContentColor, textContentColor, tonalElevation, properties)
}

@Composable internal fun Dialog(onDismissRequest: () -> Unit,
    properties: DialogProperties = DialogProperties(), content: @Composable () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest, properties) {
        Box(Modifier.border(1.dp, MaterialTheme.colorScheme.secondary, AffairsLayout.shape).clip(AffairsLayout.shape),
            propagateMinConstraints = true) { content() }
    }
}
