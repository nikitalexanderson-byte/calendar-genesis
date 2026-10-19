package ru.genesis.calendar.ui

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Verifies actual packaged catalog precedence, including the year and native fallbacks. */
@RunWith(AndroidJUnit4::class)
class QuintaTerminologyTest {
    @Test fun packagedCalendarNamesKeepRussianAndUseQuintaInEveryOtherLanguage() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        check(context.packageName == "ru.genesis.calendar.g1qa.debug")
        val languages = listOf("ru", "en", "el", "de", "fr", "es", "it", "pt", "pl", "sr", "uk", "zh", "tr", "ja")
        for (language in languages) {
            fun translated(source: String) = translateGenesisText(context, source, language)
            if (language == "ru") {
                for (source in listOf("Пята", "Пяты", "ПЯТА", "Дни пяты", "II пята")) {
                    assertEquals(source, translated(source))
                }
            } else {
                assertEquals("$language/singular", "Quinta", translated("Пята"))
                assertEquals("$language/plural", "Quintas", translated("Пяты"))
                assertEquals("$language/capital", "QUINTA", translated("ПЯТА"))
                assertEquals("$language/number", "Quinta II", translated("II пята"))
                for (source in listOf("Дни пяты", "Дни внутри пяты", "Нечётные пяты", "Чётные пяты", "пят вместо недель")) {
                    assertTrue("$language/$source: ${translated(source)}", translated(source).contains("quinta", ignoreCase = true))
                }
            }
        }
    }
}
