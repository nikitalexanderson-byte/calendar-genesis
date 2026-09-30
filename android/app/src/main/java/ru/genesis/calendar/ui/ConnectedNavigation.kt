package ru.genesis.calendar.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

private class NavigationAnchors(val page: String) {
    var parent by mutableStateOf(Rect.Zero)
    var viewport by mutableStateOf(Rect.Zero)
    var origin by mutableStateOf(Offset.Zero)
    val children = mutableStateMapOf<String, Rect>()
}
private val LocalNavigationAnchors = staticCompositionLocalOf<NavigationAnchors?> { null }
internal val LocalNavigationGlowPhase = staticCompositionLocalOf { -1f }
internal val LocalCompactSubmenus = staticCompositionLocalOf { false }

internal fun navigationGlowColor(phase: Float, evening: Boolean): Color {
    val colors = if (evening) listOf(Color(0xff83bdb0), Color(0xffaa9cc9),
        Color(0xffd6bd87), Color(0xff83bdb0)) else listOf(Color(0xff377a70),
        Color(0xff7969a0), Color(0xffa17c3b), Color(0xff377a70))
    val position = (phase.coerceIn(0f, 1f) * 3f).coerceAtMost(2.999f)
    val index = position.toInt()
    return lerp(colors[index], colors[index + 1], position - index)
}

/** Coordinates follow layout and horizontal scrolling; the spring gently follows the parent. */
@Composable internal fun NavigationConnectionScope(page: String, showConnections: Boolean = true,
    iconGlow: Boolean = false,
    content: @Composable () -> Unit) {
    val glowPhase = if (iconGlow) {
        val transition = rememberInfiniteTransition(label = "icon-navigation-glow")
        val phase by transition.animateFloat(0f, 1f,
            infiniteRepeatable(tween(5_400, easing = LinearEasing)), label = "glow-phase")
        phase
    } else -1f
    val anchors = remember(page) { NavigationAnchors(page) }
    val target = if (anchors.viewport.width > 16f)
        anchors.parent.center.x.coerceIn(anchors.viewport.left + 8f, anchors.viewport.right - 8f) else 0f
    val parentX by animateFloatAsState(target, spring(dampingRatio = 1f, stiffness = 450f), label = "menu-link")
    val ink = MaterialTheme.colorScheme.secondary.copy(alpha = if (LocalEveningTheme.current) .6f else .4f)
    Box(Modifier.fillMaxSize().onGloballyPositioned { anchors.origin = it.positionInRoot() }
        .drawWithContent {
            drawContent()
            if (!showConnections || anchors.parent == Rect.Zero) return@drawWithContent
            val startY = anchors.parent.bottom - anchors.origin.y + 2.dp.toPx()
            anchors.children.values.forEach { child ->
                val endY = child.top - anchors.origin.y - 2.dp.toPx()
                // A scrolling page may move its sub-menu away. Never draw across its content.
                if (endY > startY && endY - startY < 180.dp.toPx()) {
                    val startX = parentX - anchors.origin.x
                    val endX = child.center.x - anchors.origin.x
                    val midY = (startY + endY) / 2f
                    val path = Path().apply {
                        moveTo(startX, startY)
                        cubicTo(startX, midY, endX, midY, endX, endY)
                    }
                    drawPath(path, ink, style = Stroke(width = 1.dp.toPx(), cap = StrokeCap.Round))
                }
            }
        }.testTag("navigation-connections")) {
        CompositionLocalProvider(LocalNavigationAnchors provides anchors,
            LocalNavigationGlowPhase provides glowPhase) { content() }
    }
}

@Composable internal fun navigationParentAnchor(page: String): Modifier {
    val anchors = LocalNavigationAnchors.current ?: return Modifier
    return if (anchors.page != page) Modifier else Modifier.onGloballyPositioned {
        val position = it.positionInRoot()
        anchors.parent = Rect(position, androidx.compose.ui.geometry.Size(it.size.width.toFloat(), it.size.height.toFloat()))
    }
}
@Composable internal fun navigationViewportAnchor(): Modifier {
    val anchors = LocalNavigationAnchors.current ?: return Modifier
    return Modifier.onGloballyPositioned { anchors.viewport = it.boundsInRoot() }
}

internal data class SubmenuItem(val id: String, val title: String, val accent: Color? = null, val tag: String? = null)

/** Equal-height, full-width controls across Calendar, Habits, Tasks and Projects. */
@Composable internal fun ConnectedSubmenu(items: List<SubmenuItem>, selectedId: String,
    onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    val anchors = LocalNavigationAnchors.current
    val compact = LocalCompactSubmenus.current
    val glowPhase = LocalNavigationGlowPhase.current
    val evening = LocalEveningTheme.current
    DisposableEffect(anchors) { onDispose { anchors?.children?.clear() } }
    Column(modifier.fillMaxWidth().padding(horizontal = if (compact) 8.dp else 12.dp,
        vertical = if (compact) 3.dp else 5.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 6.dp)) {
        items.chunked(if(items.size in 1..4) items.size else 3).forEachIndexed { rowIndex, row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEachIndexed { itemIndex, item ->
                    val picked = selectedId == item.id
                    val glow = if (glowPhase >= 0f) navigationGlowColor(
                        (glowPhase + (rowIndex * 3 + itemIndex) * .08f) % 1f, evening) else null
                    androidx.compose.material3.Surface(onClick = { onSelect(item.id) }, shape = RoundedCornerShape(14.dp),
                        color = item.accent?.let { androidx.compose.ui.graphics.lerp(MaterialTheme.colorScheme.surface,it,if(picked) .32f else .17f) }
                            ?: if (glow != null) lerp(if (picked) MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surface, glow, if (picked) .10f else .045f)
                            else if (picked) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                        border = if (glow != null) BorderStroke(1.dp, Brush.horizontalGradient(listOf(
                            glow.copy(alpha = if (picked) .44f else .24f),
                            navigationGlowColor((glowPhase + .16f) % 1f, evening)
                                .copy(alpha = if (picked) .72f else .43f),
                            glow.copy(alpha = if (picked) .44f else .24f))))
                        else BorderStroke(1.dp, item.accent?.copy(alpha=if(picked) .9f else .55f)
                            ?: if (picked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                        modifier = Modifier.weight(1f).height(if (compact) 44.dp else 48.dp)
                            .testTag(item.tag ?: "submenu-${item.id}")
                            .semantics { selected = picked; role = Role.Tab }
                            .onGloballyPositioned { anchors?.children?.set(item.id, it.boundsInRoot()) }) {
                        Row(Modifier.padding(horizontal = 5.dp), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center) {
                            item.accent?.let { accent ->
                                androidx.compose.material3.Surface(Modifier.size(8.dp), color = accent,
                                    shape = RoundedCornerShape(50)) {}
                                Spacer(Modifier.width(5.dp))
                            }
                            Text(item.title, style = if (compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.labelLarge,
                                textAlign = TextAlign.Center,
                                maxLines = 2, overflow = TextOverflow.Ellipsis,
                                color = if (picked) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }
        }
    }
}
