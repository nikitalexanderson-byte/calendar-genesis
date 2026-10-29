package ru.genesis.calendar.ui

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned

private class WorkspaceDragSource {
    var bounds = Rect.Zero
    var start: (Offset) -> Unit = {}
    var move: (Offset) -> Unit = {}
    var finish: (Boolean) -> Unit = {}
}

private class WorkspaceDragOwner {
    val sources = mutableSetOf<WorkspaceDragSource>()
    var origin = Offset.Zero
}
private val LocalWorkspaceDragOwner = staticCompositionLocalOf<WorkspaceDragOwner?> { null }

/** The viewport owns the pointer, so recycling an offscreen lazy row cannot cancel its drag. */
@Composable internal fun WorkspaceDragHost(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val owner = remember { WorkspaceDragOwner() }
    CompositionLocalProvider(LocalWorkspaceDragOwner provides owner) {
        Box(modifier.onGloballyPositioned { owner.origin = it.boundsInRoot().topLeft }
            .pointerInput(owner) {
                var active: WorkspaceDragSource? = null
                try {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        val point = owner.origin + down.position
                        val source = owner.sources.filter { it.bounds.contains(point) }
                            .minByOrNull { it.bounds.width * it.bounds.height } ?: return@awaitEachGesture
                        val held = awaitLongPressOrCancellation(down.id) ?: return@awaitEachGesture
                        active = source
                        source.start(point - source.bounds.topLeft)
                        held.consume()
                        while (true) {
                            // Consume before child scrollables see a move. Ordinary scrolling remains untouched
                            // until a source has actually been held for the platform's long-press interval.
                            val event = awaitPointerEvent(PointerEventPass.Initial)
                            val change = event.changes.firstOrNull { it.id == down.id }
                            if (change == null || change.isConsumed) {
                                active = null; source.finish(true); break
                            }
                            val delta = change.position - change.previousPosition
                            change.consume()
                            if (!change.pressed) { active = null; source.finish(false); break }
                            source.move(delta)
                        }
                    }
                } finally { active?.finish?.invoke(true) }
            }, content = content)
    }
}

@Composable internal fun Modifier.workspaceDragSource(key: String, enabled: Boolean = true,
    onStart: (Offset) -> Unit, onMove: (Offset) -> Unit, onFinish: (Boolean) -> Unit): Modifier {
    val owner = LocalWorkspaceDragOwner.current
    val start by rememberUpdatedState(onStart)
    val move by rememberUpdatedState(onMove)
    val finish by rememberUpdatedState(onFinish)
    val source = remember(key) { WorkspaceDragSource() }
    source.start = { start(it) }; source.move = { move(it) }; source.finish = { finish(it) }
    DisposableEffect(owner, source, enabled) {
        if (enabled) owner?.sources?.add(source)
        // An active drag retains its source until release, independently of this hit-test registry.
        onDispose { owner?.sources?.remove(source) }
    }
    if (!enabled) return this
    return onGloballyPositioned { source.bounds = it.boundsInRoot() }
        .then(if (owner != null) Modifier else Modifier.pointerInput(source) {
            detectDragGesturesAfterLongPress(onDragStart = { source.start(it) },
                onDrag = { change, delta -> change.consume(); source.move(delta) },
                onDragEnd = { source.finish(false) }, onDragCancel = { source.finish(true) })
        })
}
