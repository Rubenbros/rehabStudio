"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <span className="font-[family-name:var(--font-pinyon-script)] text-2xl text-white">
            The Rehab Studio
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-8">
          <Link
            href="#servicios"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("services")}
          </Link>
          <Link
            href="#nosotros"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("about")}
          </Link>
          <Link
            href="#contacto"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("contact")}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <BookingDialog>
            <Button size="sm" className="rounded-full gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">{t("bookAppointment")}</span>
            </Button>
          </BookingDialog>
        </div>
      </div>
    </nav>
  );
}
