package ru.genesis.calendar.ui

import androidx.compose.runtime.staticCompositionLocalOf
import ru.genesis.calendar.auth.FeatureAccess

/** Capability checks for future UI gates; 3.1.3 is unrestricted for every account. */
internal val LocalFeatureAccess = staticCompositionLocalOf { FeatureAccess() }
