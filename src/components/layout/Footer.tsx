"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Instagram } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-gradient-to-t from-neutral-950 to-neutral-950/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <Link href="/">
              <Image
                src="/images/email/logo.png"
                alt="The Rehab Studio - Fisioterapia y Salud"
                width={250}
                height={60}
                className="h-16 w-auto"
              />
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://instagram.com/the.rehabstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-neutral-800/30 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} The Rehab Studio. {t("rights")}
          </p>
          <p className="mt-2">
            Calle Dr Cerrada 29, Local 3 · 50005 Zaragoza
          </p>
        </div>
      </div>
    </footer>
  );
}
