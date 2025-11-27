"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

const highlightKeys = [
  "licensed",
  "epiCenter",
  "sportSpecialist",
  "invasiveTraining",
  "mskUltrasound",
] as const;

export function About() {
  const t = useTranslations("about");

  return (
    <section id="nosotros" className="bg-neutral-900/50 py-24">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            <Image
              src="/images/img_4.png"
              alt="Recepción de The Rehab Studio"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="w-fit rounded-full px-4 py-1">
              {t("badge")}
            </Badge>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("title")}
            </h2>

            <p className="mt-6 text-lg text-muted-foreground">
              {t("description1")}
            </p>

            <p className="mt-4 text-muted-foreground">{t("description2")}</p>

            <ul className="mt-8 space-y-3">
              {highlightKeys.map((key) => (
                <li key={key} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>{t(`highlights.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
