package ru.genesis.calendar

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.time.LocalDate
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.ui.*

class CalendarSacredVisibilityTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun calendarRendersWithoutSacredDataInBothThemesAndRestoresItsArtwork() {
        var sacred by mutableStateOf(false)
        var dark by mutableStateOf(false)
        compose.setContent {
            CompositionLocalProvider(LocalSacredFeaturesEnabled provides sacred,
                LocalEnabledCalendars provides if (sacred) CalendarMode.entries.toSet() else setOf(CalendarMode.PROFANE),
                LocalEveningTheme provides dark) {
                MaterialTheme(colorScheme = if (dark) evening else standart) {
                    Surface(Modifier.fillMaxSize()) {
                        CalendarScreen(LocalDate.of(2026, 10, 17), CalendarMode.PROFANE,
                            onSelect = {}, experimental = true)
                    }
                }
            }
        }
        for (eveningMode in listOf(false, true)) {
            compose.runOnIdle { dark = eveningMode; sacred = false }
            compose.onNodeWithTag("calendar-selected-primary-date").performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag("calendar-weekday-art").assertDoesNotExist()
            compose.onNodeWithTag("calendar-selected-fact-blocks").assertDoesNotExist()
            compose.onNodeWithTag("calendar-selected-patron").assertDoesNotExist()
            compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertDoesNotExist()
            compose.runOnIdle { sacred = true }
            compose.onNodeWithTag("calendar-weekday-art").assertExists()
            compose.onNodeWithTag("calendar-selected-fact-blocks").assertExists()
        }
        compose.runOnIdle { sacred = false }
        compose.onNodeWithText("Год").performClick()
        compose.onNodeWithTag("calendar-year-panel").assertExists()
        compose.onNodeWithTag("calendar-mode-icon-profane", useUnmergedTree = true).assertDoesNotExist()
    }
}
