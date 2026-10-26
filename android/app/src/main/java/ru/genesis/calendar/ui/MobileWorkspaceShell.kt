package ru.genesis.calendar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.genesis.calendar.BuildConfig
import ru.genesis.calendar.auth.UiVisibility

internal data class MobileDestination(val page: String, val section: String?, val title: String,
    val icon: GenesisPageIcon, val group: String) {
    val key: String get() = "$page-${section ?: "root"}"
}

/** The menu is derived from the same account visibility and role gates as the workspace. */
internal fun mobileDestinations(pages: List<String>, visibility: UiVisibility,
    sharedEnabled: Boolean, settingsSubmenus: Boolean): List<MobileDestination> = buildList {
    fun entry(page: String, section: String?, title: String, icon: GenesisPageIcon, group: String) {
        if (page in pages) add(MobileDestination(page, section, title, icon, group))
    }
    entry("Сегодня", null, "Сегодня", GenesisPageIcon.TODAY, "Мой день")
    if ("calendar.month" !in visibility.hiddenSubmenus)
        entry("Календарь", "month", "Календарь · месяц", GenesisPageIcon.MONTH, "Мой день")
    if ("calendar.year" !in visibility.hiddenSubmenus)
        entry("Календарь", "year", "Календарь · год", GenesisPageIcon.YEAR, "Мой день")
    if (!sharedEnabled || "projects.personal" !in visibility.hiddenSubmenus)
        entry("Проекты", "personal-projects", "Дела — личные", GenesisPageIcon.PROJECTS, "Рабочее пространство")
    if (sharedEnabled && "projects.shared" !in visibility.hiddenSubmenus)
        entry("Проекты", "shared", "Дела — общие", GenesisPageIcon.PROJECTS_SHARED, "Рабочее пространство")
    entry("Дневник", null, "Дневник", GenesisPageIcon.DIARY, "Рабочее пространство")
    if (sharedEnabled && "projects.shared" !in visibility.hiddenSubmenus)
        entry("Сообщения", null, "Личные сообщения", GenesisPageIcon.MESSAGES, "Рабочее пространство")
    if ("habits.habits" !in visibility.hiddenSubmenus)
        entry("Привычки", "Привычки", "Привычки", GenesisPageIcon.HABITS, "Развитие")
    if ("habits.sleep" !in visibility.hiddenSubmenus)
        entry("Привычки", "Сон и настроение", "Сон и настроение", GenesisPageIcon.TRACKERS, "Развитие")
    if ("sacred.stoicheion" !in visibility.hiddenSubmenus && "stoicheion" !in visibility.hiddenMenuItems)
        entry("Сакральное", "stoicheion", "Стойхейон", GenesisPageIcon.STOICHEION, "Развитие")
    if ("sacred.theokyklos" !in visibility.hiddenSubmenus && "theokyklos" !in visibility.hiddenMenuItems)
        entry("Сакральное", "theokyklos", "Теокиклос", GenesisPageIcon.THEOKYKLOS, "Развитие")
    if (settingsSubmenus) settingsSections.forEach { section ->
        entry("Настройки", section.id, if (section.id == "habits") "Настройки привычек" else section.ru, section.icon, "Настройки")
    } else entry("Настройки", null, "Настройки", GenesisPageIcon.SETTINGS, "Настройки")
}

@Composable internal fun MobileWorkspaceShell(selectedPage: String, selectedSection: String?,
    destinations: List<MobileDestination>, accountStatus: String, showLabels: Boolean,
    onLabelsChange: (Boolean) -> Unit, gesturesEnabled: Boolean,
    onNavigate: (MobileDestination) -> Unit, actions: @Composable RowScope.() -> Unit,
    content: @Composable ColumnScope.() -> Unit) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val current = destinations.firstOrNull { it.page == selectedPage && it.section == selectedSection }
        ?: destinations.firstOrNull { it.page == selectedPage }
    val title = current?.title ?: selectedPage
    val menuLabel = genesisTranslate("Открыть меню")
    BackHandler(drawer.isOpen) { scope.launch { drawer.close() } }
    ModalNavigationDrawer(drawerState = drawer, gesturesEnabled = gesturesEnabled && drawer.isOpen,
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
                        Text(group, Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        entries.forEach { destination ->
                            val picked = destination == current
                            val name = genesisTranslate(destination.title)
                            NavigationDrawerItem(label = {
                                if (showLabels || picked) Text(destination.title,
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
                    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("Подписи меню", Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                        Switch(checked = showLabels, onCheckedChange = onLabelsChange,
                            modifier = Modifier.testTag("drawer-labels"))
                    }
                    GenesisAccountFooter(accountStatus)
                    Text("GENESIS Calendar ${BuildConfig.VERSION_NAME}\nПробная версия · ${BuildConfig.VERSION_CODE}",
                        Modifier.padding(horizontal = 16.dp, vertical = 12.dp).testTag("trial-build-info"),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall)
                }
            }
        }) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
            Surface(color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 4.dp)
                    .testTag("app-header"), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { scope.launch { drawer.open() } },
                        modifier = Modifier.size(48.dp).testTag("workspace-menu")
                            .semantics { contentDescription = menuLabel }) {
                        GenesisLucideIcon("menu", Modifier.size(24.dp))
                    }
                    Text(title, Modifier.weight(1f).padding(horizontal = 8.dp).testTag("workspace-title"),
                        style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    actions()
                }
            }
            content()
        }
    }
}
