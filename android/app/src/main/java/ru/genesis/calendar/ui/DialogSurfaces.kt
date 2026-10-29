package ru.genesis.calendar.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties

internal val LocalGenesisModal = compositionLocalOf { false }
internal val LocalGenesisModalFramePending = compositionLocalOf { false }

/** Only the card is opaque; the surrounding area remains Android's dimmed backdrop. */
@Composable internal fun GenesisModalFrame(onDismissRequest: () -> Unit,
    maxWidth: Dp = 1120.dp, content: @Composable BoxWithConstraintsScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding(), contentAlignment = Alignment.Center) {
        DialogBackdrop(onDismissRequest, Modifier.matchParentSize())
        androidx.compose.material3.Surface(Modifier.widthIn(max = maxWidth).fillMaxWidth().padding(12.dp)
            .heightIn(max = maxHeight * .94f).testTag("genesis-modal-surface"), shape = AffairsLayout.shape,
            color = MaterialTheme.colorScheme.surface.copy(alpha = 1f), shadowElevation = 12.dp) {
            CompositionLocalProvider(LocalGenesisModalFramePending provides false) {
                BoxWithConstraints(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.secondary, AffairsLayout.shape), content = content)
            }
        }
    }
}

/** Preserve the platform time picker's background, insets and 24h/AM-PM controls. */
@Composable internal fun genesisNativeDialogFrame(): (android.app.Dialog) -> Unit {
    val stroke = MaterialTheme.colorScheme.secondary.toArgb()
    val fill = MaterialTheme.colorScheme.surface.copy(alpha = 1f).toArgb()
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
            val frame = android.graphics.drawable.GradientDrawable().apply {
                setColor(fill)
                cornerRadius = 10f * density
                setStroke(kotlin.math.max(1, density.toInt()), stroke)
            }
            window.setBackgroundDrawable(frame)
        }
    }
}

/** Keep native focus, Back and dismissal behavior while sharing the menu frame. */
@Composable internal fun AlertDialog(onDismissRequest: () -> Unit, confirmButton: @Composable () -> Unit,
    modifier: Modifier = Modifier, dismissButton: (@Composable () -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null, title: (@Composable () -> Unit)? = null,
    text: (@Composable () -> Unit)? = null, shape: Shape = AffairsLayout.shape,
    containerColor: Color = MaterialTheme.colorScheme.surface,
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
    CompositionLocalProvider(LocalAffairsControlOutlined provides false, LocalGenesisModal provides true,
        LocalGenesisModalFramePending provides false,
        LocalAffairsControlWidth provides 48.dp) {
    androidx.compose.material3.AlertDialog(onDismissRequest, confirmButton,
        modifier.background(containerColor.compositeOver(MaterialTheme.colorScheme.surface.copy(alpha=1f)), shape)
            .border(1.dp, MaterialTheme.colorScheme.secondary, shape), dismissButton, icon, framedTitle, text,
        shape, containerColor.compositeOver(MaterialTheme.colorScheme.surface.copy(alpha=1f)), iconContentColor, titleContentColor, textContentColor, tonalElevation, properties)
    }
}

@Composable internal fun Dialog(onDismissRequest: () -> Unit,
    properties: DialogProperties = DialogProperties(), content: @Composable () -> Unit) {
    androidx.compose.ui.window.Dialog(onDismissRequest, properties) {
        // The caller's opaque Surface owns the frame. Painting the window here also
        // paints its outside-tap area, turning bounded dialogs into full-screen sheets.
        CompositionLocalProvider(LocalAffairsControlOutlined provides false, LocalGenesisModal provides true,
            LocalGenesisModalFramePending provides true,
            LocalAffairsControlWidth provides 48.dp) { content() }
    }
}
