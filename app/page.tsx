import type { Metadata } from "next";
import { GenesisCalendar } from "./GenesisCalendar";

export const metadata: Metadata = {
  title: "GENESIS — сакральный календарь",
  description:
    "Эллинистический календарь из двенадцати месяцев и Апейрона: ритмы Пят, стихий, Луны и личных задач.",
};

export default function Home() {
  return <GenesisCalendar />;
}
