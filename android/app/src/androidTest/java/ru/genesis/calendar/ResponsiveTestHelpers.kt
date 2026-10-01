package ru.genesis.calendar

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeContentTestRule

/** A day uses one lazy list on phones and two independent scrolling panes on tablets. */
internal fun ComposeContentTestRule.scrollToTodayNode(matcher: SemanticsMatcher) {
    if (onAllNodesWithTag("today-two-pane").fetchSemanticsNodes().isEmpty()) {
        onNodeWithTag("today-list").performScrollToNode(matcher)
    } else {
        onNode(matcher).performScrollTo()
    }
}
