package ru.genesis.calendar.ui

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
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
                fun finish(cancelled: Boolean) {
                    val source = active
                    // The callback may immediately move/recycle its card and dispose its modifier.
                    // Release ownership before it changes the tree, and finish every gesture once.
                    active = null
                    source?.finish?.invoke(cancelled)
                }
                try {
                    // Foundation owns event consumption and pointer-up/cancellation dispatch.
                    // Mutating the boards during the Initial pass can detach a node while the
                    // same event is still being dispatched to its children.
                    detectDragGesturesAfterLongPress(
                        onDragStart = { position ->
                            val point = owner.origin + position
                            val source = owner.sources.toList().filter { it.bounds.contains(point) }
                                .minByOrNull { it.bounds.width * it.bounds.height }
                            active = source
                            source?.let { it.start(point - it.bounds.topLeft) }
                        },
                        onDrag = { change, delta ->
                            if (active != null && delta.x.isFinite() && delta.y.isFinite()) {
                                change.consume(); active?.move?.invoke(delta)
                            }
                        },
                        onDragEnd = { finish(false) },
                        onDragCancel = { finish(true) })
                } finally { finish(true) }
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
