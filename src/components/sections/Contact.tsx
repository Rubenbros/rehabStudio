"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Clock, Instagram } from "lucide-react";

export function Contact() {
  const t = useTranslations("contact");

  return (
    <section id="contacto" className="container mx-auto px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        {/* Info de contacto */}
        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t("address")}</h3>
                <p className="mt-1 text-muted-foreground">
                  Calle Dr Cerrada 29, Local 3
                  <br />
                  50005 Zaragoza, España
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t("phone")}</h3>
                <p className="mt-1 text-muted-foreground">
                  <a
                    href="tel:+34639380630"
                    className="hover:text-foreground transition-colors"
                  >
                    +34 639 38 06 30
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t("schedule")}</h3>
                <p className="mt-1 text-muted-foreground">
                  {t("weekdays")}: 9:00 - 20:00
                  <br />
                  {t("saturday")}: {t("byAppointment")}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button className="flex-1 gap-2" asChild>
              <a href="tel:+34639380630">
                <Phone className="h-4 w-4" />
                {t("call")}
              </a>
            </Button>
            <Button variant="outline" className="flex-1 gap-2" asChild>
              <a
                href="https://instagram.com/the.rehabstudio"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </a>
            </Button>
          </div>
        </div>

        {/* Mapa */}
        <div className="overflow-hidden rounded-2xl">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2981.0!2d-0.8833!3d41.6561!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd5914d1234567890%3A0x1234567890!2sCalle%20Dr%20Cerrada%2029%2C%2050005%20Zaragoza!5e0!3m2!1ses!2ses!4v1234567890"
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: "400px" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Ubicación de The Rehab Studio"
          />
        </div>
      </div>
    </section>
  );
}
