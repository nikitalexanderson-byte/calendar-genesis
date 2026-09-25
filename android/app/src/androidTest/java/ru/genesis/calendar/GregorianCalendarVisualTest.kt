package ru.genesis.calendar

import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import java.time.LocalDate
import org.junit.Rule
import org.junit.Test
import ru.genesis.calendar.domain.CalendarMode
import ru.genesis.calendar.auth.AuthController
import ru.genesis.calendar.auth.AuthPanelState
import ru.genesis.calendar.ui.CalendarScreen
import ru.genesis.calendar.ui.LocalGenesisLanguage
import ru.genesis.calendar.ui.Text
import ru.genesis.calendar.ui.WelcomeScreen

class GregorianCalendarVisualTest {
    @get:Rule val compose = createAndroidComposeRule<StoicheionGestureActivity>()

    @Test fun selectedGregorianDateUsesWeekdayArtAndGregorianPrimaryLabel() {
        compose.setContent {
            MaterialTheme {
                CalendarScreen(LocalDate.of(2026, 1, 29), CalendarMode.PROFANE, onSelect = {})
            }
        }
        compose.onNodeWithTag("calendar-day-2026-01-29").assertExists()
        compose.onNodeWithTag("calendar-selected-primary-date")
            .assert(hasText("29 января 2026", substring = true))
        compose.onNodeWithTag("calendar-weekday-art").assertExists()
    }

    @Test fun websiteEnglishCopyIsAvailableOffline() {
        compose.setContent {
            CompositionLocalProvider(LocalGenesisLanguage provides "en") {
                MaterialTheme { Column {
                    Text("Привычки")
                    Text("Месяц Рождения и Замысла")
                    Text("Арейос Ридзоматос (Арейос Укореняющий)")
                } }
            }
        }
        compose.onNodeWithText("Habits").assertExists()
        compose.onNodeWithText("Month of Birth and Intention").assertExists()
        compose.onNodeWithText("Areios Ridzomatos (Areios Rooting)").assertExists()
    }

    @Test fun welcomeHasLanguageChoiceAndNoWorkspaceShortcut() {
        val app = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
            .targetContext.applicationContext as GenesisApplication
        compose.setContent {
            var language by androidx.compose.runtime.remember { mutableStateOf("ru") }
            CompositionLocalProvider(LocalGenesisLanguage provides language) {
                MaterialTheme {
                    WelcomeScreen(AuthPanelState(), AuthController.get(app), language) { language = it }
                }
            }
        }
        compose.onNodeWithTag("genesis-welcome").assertExists()
        compose.onNodeWithTag("welcome-google-sign-in").assertExists()
        compose.onNodeWithTag("language-en").performClick()
        compose.onNodeWithText("Welcome to GENESIS").assertExists()
        compose.onNodeWithText("Задачи").assertDoesNotExist()
    }
}
