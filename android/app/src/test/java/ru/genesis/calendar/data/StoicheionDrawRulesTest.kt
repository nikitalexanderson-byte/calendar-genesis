package ru.genesis.calendar.data

import org.junit.Assert.*
import org.junit.Test

class StoicheionDrawRulesTest {
    @Test fun oneRerollWithinThreeMinutesAndThenFixedForDay() {
        val first = StoicheionDrawRules.next(null, "daily", "2026-09-24", 42L, 1_000L)
        assertEquals(1, first.attempts)
        assertEquals(181_000L, first.rerollDeadline)
        assertTrue(first.canReroll(180_999L))
        val second = StoicheionDrawRules.next(first, "daily", "2026-09-24", 43L, 180_999L)
        assertEquals(2, second.attempts)
        assertEquals(first.firstAt, second.firstAt)
        assertEquals(first.rerollDeadline, second.rerollDeadline)
        assertFalse(second.canReroll(181_000L))
        assertThrows(IllegalArgumentException::class.java) {
            StoicheionDrawRules.next(second, "daily", "2026-09-24", 44L, 181_000L)
        }
        assertThrows(IllegalArgumentException::class.java) {
            StoicheionDrawRules.next(first, "daily", "2026-09-24", 43L, 181_000L)
        }
        assertEquals(1, StoicheionDrawRules.next(null, "daily", "2026-09-25", 44L, 181_000L).attempts)
    }

    @Test fun dailyAndSpreadHaveIndependentLimits() {
        val daily = StoicheionDrawRules.next(null, "daily", "2026-09-24", 1L, 1_000L)
        val spread = StoicheionDrawRules.next(null, "spread", "2026-09-24", 2L, 1_000L)
        assertEquals("daily", daily.kind)
        assertEquals("spread", spread.kind)
        assertThrows(IllegalArgumentException::class.java) {
            StoicheionDrawRules.next(daily, "spread", "2026-09-24", 3L, 1_001L)
        }
    }
}
