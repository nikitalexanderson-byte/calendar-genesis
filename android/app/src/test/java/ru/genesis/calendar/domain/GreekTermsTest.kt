package ru.genesis.calendar.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class GreekTermsTest {
    @Test fun authoredWordsUseTheRequestedWritingSystem() {
        assertEquals("Архе · психе · Теос", formatGreekTerms("Ἀρχή · ψυχή · Θεός", "ru"))
        assertEquals("Arche · psyche · Theos", formatGreekTerms("Ἀρχή · ψυχή · Θεός", "en"))
        assertEquals("психе", formatGreekTerms("ψυχή", "sr"))
        assertEquals("psyche", formatGreekTerms("ψυχή", "ja"))
    }

    @Test fun alphabetSymbolsAndTheirCombiningAccentsRemainGreek() {
        val symbols = "Α Ω Ψ α ά α\u0301"
        assertEquals(symbols, formatGreekTerms(symbols, "ru"))
        assertEquals(symbols, formatGreekTerms(symbols, "en"))
    }

    @Test fun composedAndDecomposedWordsHaveTheSameTranscription() {
        val word = "Ἀρχή"
        val decomposed = java.text.Normalizer.normalize(word, java.text.Normalizer.Form.NFD)
        assertEquals("Arche", formatGreekTerms(decomposed, "en"))
        assertEquals(formatGreekTerms(word, "ru"), formatGreekTerms(decomposed, "ru"))
    }

    @Test fun surroundingScriptsEmojiAndPunctuationArePreserved() {
        assertEquals("GENESIS: Arche — мир 🌙, 世界; Α!", formatGreekTerms("GENESIS: Ἀρχή — мир 🌙, 世界; Α!", "en"))
        assertEquals("", formatGreekTerms("", "en"))
        assertEquals("123, мир 🌙", formatGreekTerms("123, мир 🌙", "ru"))
    }

    @Test fun greekInterfaceKeepsTheAuthoredTextExactly() {
        val text = "Ἀρχή · ψυχή · α\u0301 · 🌙"
        assertEquals(text, formatGreekTerms(text, "el"))
    }
}
