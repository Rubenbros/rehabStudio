"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <nav className="fixed top-0 z-50 w-full bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-800/30">
      <div className="container mx-auto flex h-16 items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/email/logo_simple_transpaarente.png"
            alt="The Rehab Studio"
            width={200}
            height={50}
            className="h-9 w-auto"
            priority
          />
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
