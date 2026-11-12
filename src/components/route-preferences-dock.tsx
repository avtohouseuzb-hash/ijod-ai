"use client";

import { usePathname } from "next/navigation";
import { LanguageSelect, ThemeToggle } from "@/components/site-preferences";

export function RoutePreferencesDock() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/news") return null;

  return (
    <div className="ijod-route-preferences" aria-label="Til va ko‘rinish sozlamalari">
      <ThemeToggle />
      <LanguageSelect className="ijod-language-select w-[54px] sm:w-[150px]" />
    </div>
  );
}
