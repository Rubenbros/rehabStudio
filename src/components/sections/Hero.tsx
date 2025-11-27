"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin } from "lucide-react";
import { BookingDialog } from "@/components/booking/BookingDialog";

export function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="container relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-32 text-center lg:px-8">
        <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1">
          {t("badge")}
        </Badge>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          {t("title")}{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {t("titleHighlight")}
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          {t("description")}
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <BookingDialog>
            <Button size="lg" className="rounded-full gap-2">
              <CalendarDays className="h-5 w-5" />
              {t("bookAppointment")}
            </Button>
          </BookingDialog>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full gap-2"
            asChild
          >
            <a
              href="https://www.google.com/maps/search/?api=1&query=Calle+Dr+Cerrada+29,+50005+Zaragoza,+España"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="h-5 w-5" />
              {t("directions")}
            </a>
          </Button>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span>{t("tags.sportPhysio")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{t("tags.ecoMsk")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{t("tags.invasiveEpi")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span>{t("tags.manualTherapy")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
