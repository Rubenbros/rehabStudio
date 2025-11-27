"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = () => {
    const newLocale = locale === "es" ? "en" : "es";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{locale === "es" ? "EN" : "ES"}</span>
    </Button>
  );
}
