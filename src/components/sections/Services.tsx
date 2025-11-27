"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  Zap,
  Hand,
  Dumbbell,
  ScanLine,
  Crosshair,
} from "lucide-react";

const serviceKeys = [
  { key: "sportPhysio", icon: Activity },
  { key: "ecoMsk", icon: ScanLine },
  { key: "epi", icon: Zap },
  { key: "dryNeedling", icon: Crosshair },
  { key: "manualTherapy", icon: Hand },
  { key: "therapeuticExercise", icon: Dumbbell },
] as const;

export function Services() {
  const t = useTranslations("services");

  return (
    <section id="servicios" className="container mx-auto px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {serviceKeys.map((service) => (
          <Card
            key={service.key}
            className="group relative overflow-hidden transition-all hover:shadow-lg"
          >
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <service.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">
                {t(`items.${service.key}.title`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                {t(`items.${service.key}.description`)}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
