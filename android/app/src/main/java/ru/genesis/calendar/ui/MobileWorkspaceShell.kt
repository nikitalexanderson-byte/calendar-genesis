package ru.genesis.calendar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.genesis.calendar.BuildConfig
import ru.genesis.calendar.auth.UiVisibility
import ru.genesis.calendar.domain.CalendarMode

internal data class MobileDestination(val page: String, val section: String?, val title: String,
    val icon: GenesisPageIcon, val group: String) {
    val key: String get() = "$page-${section ?: "root"}"
}

internal class WorkspaceHeaderContent(val title: State<String>, val subtitle: State<String?>,
    val actions: State<@Composable () -> Unit>, val navigation: State<@Composable () -> Unit>,
    val singleLine: State<Boolean>, val titleIsUserContent: State<Boolean>)
internal val LocalWorkspaceHeader = staticCompositionLocalOf<MutableState<WorkspaceHeaderContent?>?> { null }

/** A screen owns its actions; the shell renders them before the shared calendar controls. */
@Composable
internal fun WorkspaceScreenHeader(title: String, subtitle: String? = null,
    navigation: @Composable () -> Unit = {}, singleLine: Boolean = false, titleIsUserContent: Boolean = false,
    actions: @Composable () -> Unit = {}): Boolean {
    val host = LocalWorkspaceHeader.current ?: return false
    val latestTitle = rememberUpdatedState(title)
    val latestSubtitle = rememberUpdatedState(subtitle)
    val latestActions = rememberUpdatedState(actions)
    val latestNavigation = rememberUpdatedState(navigation)
    val latestSingleLine = rememberUpdatedState(singleLine)
    val latestUserContent = rememberUpdatedState(titleIsUserContent)
    val entry = remember { WorkspaceHeaderContent(latestTitle, latestSubtitle, latestActions,
        latestNavigation, latestSingleLine, latestUserContent) }
    DisposableEffect(host) {
        host.value = entry
        onDispose { if (host.value === entry) host.value = null }
    }
    return true
}

/** The menu is derived from the same account visibility and role gates as the workspace. */
internal fun mobileDestinations(pages: List<String>, visibility: UiVisibility,
    sharedEnabled: Boolean, settingsSubmenus: Boolean): List<MobileDestination> = buildList {
    fun entry(page: String, section: String?, title: String, icon: GenesisPageIcon, group: String) {
        if (page in pages) add(MobileDestination(page, section, title, icon, group))
    }
    entry("Сегодня", null, "Сегодня", GenesisPageIcon.TODAY, "Мой день")
    if (listOf("calendar.month", "calendar.year").any { it !in visibility.hiddenSubmenus })
        entry("Календарь", null, "Календарь", GenesisPageIcon.MONTH, "Мой день")
    if (!sharedEnabled || listOf("projects.personal", "projects.shared").any { it !in visibility.hiddenSubmenus })
        entry("Проекты", null, "Дела", GenesisPageIcon.PROJECTS, "Рабочее пространство")
    entry("Дневник", null, "Дневник", GenesisPageIcon.DIARY, "Рабочее пространство")
    if (sharedEnabled && "projects.shared" !in visibility.hiddenSubmenus)
        entry("Сообщения", null, "Личные сообщения", GenesisPageIcon.MESSAGES, "Рабочее пространство")
    if ("habits.habits" !in visibility.hiddenSubmenus)
        entry("Привычки", "Привычки", "Привычки", GenesisPageIcon.HABITS, "Развитие")
    if ("habits.sleep" !in visibility.hiddenSubmenus)
        entry("Привычки", "Сон и настроение", "Сон и настроение", GenesisPageIcon.TRACKERS, "Развитие")
    if (("sacred.stoicheion" !in visibility.hiddenSubmenus && "stoicheion" !in visibility.hiddenMenuItems) ||
        ("sacred.theokyklos" !in visibility.hiddenSubmenus && "theokyklos" !in visibility.hiddenMenuItems))
        entry("Сакральное", null, "Оракул", GenesisPageIcon.ORACLE, "Развитие")
    if (settingsSubmenus) settingsSections.forEach { section ->
        entry("Настройки", section.id, if (section.id == "habits") "Настройки привычек" else section.ru, section.icon, "Настройки")
    } else entry("Настройки", null, "Настройки", GenesisPageIcon.SETTINGS, "Настройки")
}

@Composable internal fun MobileWorkspaceShell(selectedPage: String, selectedSection: String?,
    destinations: List<MobileDestination>, accountStatus: String, gesturesEnabled: Boolean,
    calendarMode: CalendarMode = CalendarMode.PROFANE,
    titleOverride: String? = null, subtitle: String? = null,
    onNavigate: (MobileDestination) -> Unit, actions: @Composable RowScope.() -> Unit,
    footerActions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val screenHeader = remember(selectedPage, selectedSection) { mutableStateOf<WorkspaceHeaderContent?>(null) }
    val current = destinations.firstOrNull { it.page == selectedPage && it.section == selectedSection }
        ?: destinations.firstOrNull { it.page == selectedPage }
    val title = titleOverride ?: if (selectedPage == "Календарь")
        mobileCalendarCopy(LocalGenesisLanguage.current).calendarName(calendarMode)
        else if (selectedPage == "Настройки") "Настройки\n${current?.title?.removePrefix("Настройки ") ?: selectedPage}"
        else current?.title ?: selectedPage
    val menuLabel = genesisTranslate("Открыть меню")
    BackHandler(drawer.isOpen) { scope.launch { drawer.close() } }
    // An open drawer can always be dismissed; closed-screen gestures belong to each feature.
    ModalNavigationDrawer(drawerState = drawer, gesturesEnabled = drawer.isOpen,
        drawerContent = {
            val width = (LocalConfiguration.current.screenWidthDp - 40).coerceAtMost(344).dp
            ModalDrawerSheet(Modifier.width(width).testTag("workspace-drawer"),
                drawerShape = RoundedCornerShape(topEnd = 10.dp, bottomEnd = 10.dp),
                drawerContainerColor = MaterialTheme.colorScheme.surface,
                drawerTonalElevation = 0.dp) {
                Column(Modifier.fillMaxHeight().verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        GenesisBrandLogo(Modifier.size(40.dp))
                        Text("GENESIS", Modifier.weight(1f).padding(start = 12.dp),
                            style = MaterialTheme.typography.titleLarge)
                        val closeLabel = genesisTranslate("Закрыть меню")
                        IconButton(onClick = { scope.launch { drawer.close() } },
                            modifier = Modifier.size(48.dp).testTag("drawer-close")
                                .semantics { contentDescription = closeLabel }) {
                            AffairsActionIcon(AffairsAction.CLOSE)
                        }
                    }
                    destinations.groupBy { it.group }.forEach { (group, entries) ->
                        if (group.isNotEmpty()) Text(group, Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        else Spacer(Modifier.height(16.dp))
                        entries.forEach { destination ->
                            val picked = destination == current
                            val name = genesisTranslate(destination.title)
                            NavigationDrawerItem(label = {
                                Text(destination.title,
                                    style = MaterialTheme.typography.bodyMedium)
                            }, icon = {
                                GenesisVectorIcon(destination.icon, Modifier.size(24.dp),
                                    tint = if (picked) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.onSurfaceVariant)
                            }, selected = picked, onClick = {
                                onNavigate(destination)
                                scope.launch { drawer.close() }
                            }, shape = AffairsLayout.controlShape,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                                    .testTag("drawer-${destination.page}-${destination.section ?: "root"}")
                                    .semantics { contentDescription = name },
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                    unselectedContainerColor = MaterialTheme.colorScheme.surface))
                        }
                    }
                    HorizontalDivider(Modifier.padding(top = 16.dp, bottom = 8.dp),
                        color = MaterialTheme.colorScheme.outlineVariant)
                    GenesisAccountFooter(accountStatus)
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)
                        .testTag("drawer-version-row"), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("GENESIS Calendar ${BuildConfig.VERSION_NAME}\nСборка · ${BuildConfig.VERSION_CODE}",
                            Modifier.weight(1f).testTag("trial-build-info"),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall)
                        footerActions()
                    }
                }
            }
        }) {
        CompositionLocalProvider(LocalWorkspaceHeader provides screenHeader) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
            Surface(color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).padding(horizontal = 4.dp, vertical = 6.dp)
                    .testTag("app-header"), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { scope.launch { drawer.open() } },
                        modifier = Modifier.size(48.dp).testTag("workspace-menu")
                            .semantics { contentDescription = menuLabel }) {
                        GenesisLucideIcon("menu", Modifier.size(24.dp))
                    }
                    screenHeader.value?.navigation?.value?.invoke()
                    Row(Modifier.weight(1f).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        val compactTitle = screenHeader.value?.singleLine?.value == true
                        val currentTitle = screenHeader.value?.title?.value ?: title
                        val currentSubtitle = if (screenHeader.value != null) screenHeader.value?.subtitle?.value else subtitle
                        androidx.compose.material3.Text(
                            if (screenHeader.value?.titleIsUserContent?.value == true) currentTitle else genesisTranslate(currentTitle),
                            Modifier.testTag("workspace-title").then(if (compactTitle && android.animation.ValueAnimator.areAnimatorsEnabled())
                                Modifier.basicMarquee(iterations = Int.MAX_VALUE, initialDelayMillis = 1800) else Modifier),
                            maxLines = if (compactTitle || !currentSubtitle.isNullOrBlank()) 1 else 2,
                            overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                        currentSubtitle?.takeIf { it.isNotBlank() }?.let { Text(it, Modifier.testTag("workspace-subtitle"),
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                        screenHeader.value?.actions?.value?.invoke()
                        actions()
                    }
                }
            }
            content()
        }
        }
    }
}

@Composable
internal fun WorkspaceAccountRefreshButton(description: String, enabled: Boolean = true,
    onClick: () -> Unit) {
    IconButton(onClick = onClick, enabled = enabled,
        modifier = Modifier.size(48.dp).testTag("account-refresh")
            .semantics { contentDescription = description },
        colors = IconButtonDefaults.iconButtonColors(contentColor = MaterialTheme.colorScheme.onSurfaceVariant)) {
        if (enabled) GenesisLucideIcon("refresh-cw", Modifier.size(22.dp))
        else CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
    }
}

@Composable
internal fun WorkspaceHeaderButton(description: String, tag: String, enabled: Boolean = true,
    onClick: () -> Unit, content: @Composable () -> Unit) {
    androidx.compose.material3.Surface(onClick = onClick, enabled = enabled,
        modifier = Modifier.size(48.dp).testTag(tag).semantics { contentDescription = description },
        shape = AffairsLayout.controlShape, color = Color(0xff173b38), contentColor = Color(0xffdfc17e),
        border = BorderStroke(1.dp, Color(0xffdfc17e).copy(alpha = .55f))) {
        Box(contentAlignment = Alignment.Center) { content() }
    }
}
