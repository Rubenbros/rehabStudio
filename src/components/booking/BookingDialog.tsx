"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  CalendarCheck,
  ExternalLink,
} from "lucide-react";

interface BookingDialogProps {
  children: React.ReactNode;
}

const PHONE_NUMBER = "34639380630";
const PHONE_DISPLAY = "+34 639 38 06 30";
const GOOGLE_CALENDAR_URL = "https://calendar.app.google/weQaod2Q4wkWGGoH6";

export function BookingDialog({ children }: BookingDialogProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("booking");

  const handleGoogleCalendar = () => {
    window.open(GOOGLE_CALENDAR_URL, "_blank");
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(t("whatsappMessage"));
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${message}`, "_blank");
  };

  const handleCall = () => {
    window.location.href = `tel:+${PHONE_NUMBER}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Opción principal: Google Calendar */}
          <div
            onClick={handleGoogleCalendar}
            className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 cursor-pointer hover:border-blue-500/50 transition-colors group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/30">
              <CalendarCheck className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white flex items-center gap-2">
                {t("bookOnline")}
                <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("chooseDatetime")}
              </p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">{t("book")}</Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-900 px-2 text-muted-foreground">
                {t("orContactDirectly")}
              </span>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/20">
              <MessageCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white text-sm">{t("whatsapp")}</h3>
              <p className="text-xs text-muted-foreground">{t("quickResponse")}</p>
            </div>
            <Button
              onClick={handleWhatsApp}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {t("open")}
            </Button>
          </div>

          {/* Llamar */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/20">
              <Phone className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white text-sm">{t("call")}</h3>
              <p className="text-xs text-muted-foreground">{PHONE_DISPLAY}</p>
            </div>
            <Button
              onClick={handleCall}
              size="sm"
              variant="outline"
              className="border-neutral-600 hover:bg-neutral-800"
            >
              {t("call")}
            </Button>
          </div>

          {/* Horario */}
          <div className="mt-2 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{t("scheduleTitle")}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-white">{t("mondayFriday")}</p>
                <p className="text-muted-foreground">9:00 - 14:00</p>
                <p className="text-muted-foreground">16:00 - 21:00</p>
              </div>
              <div>
                <p className="text-white">{t("saturday")}</p>
                <p className="text-muted-foreground">9:00 - 14:00</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{t("firstConsultation")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
