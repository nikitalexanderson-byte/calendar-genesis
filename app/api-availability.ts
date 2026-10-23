import { getRuntimeLanguage } from "./i18n";
import unavailable from "./api-availability-copy.json";
export const isTemporaryApiStatus = (status: number) => [408, 502, 503, 504].includes(status);
export const apiUnavailableMessage = () => unavailable[getRuntimeLanguage()] ?? unavailable.en;
