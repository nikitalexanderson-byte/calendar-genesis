import { GENESIS_THEME, type GenesisTheme } from "./theme-controller";

// Keep the colour choice when upgrading an account from the retired web theme.
export function normalizeWebTheme(value: unknown): GenesisTheme {
  return value === GENESIS_THEME.STANDART_DARK || value === GENESIS_THEME.EXPERIMENTAL_DARK
    ? GENESIS_THEME.STANDART_DARK : GENESIS_THEME.STANDART;
}
