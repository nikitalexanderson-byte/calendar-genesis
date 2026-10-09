import { normalizeGenesisTheme, type GenesisTheme } from "./theme-controller";
export { withExperimentalTheme, withThemeColorMode } from "./theme-controller";

/** Both visual families use the same Standart components and account preferences. */
export function normalizeWebTheme(value: unknown): GenesisTheme {
  return normalizeGenesisTheme(value);
}
