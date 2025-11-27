"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Instagram } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-neutral-800 bg-neutral-900/30">
      <div className="container mx-auto px-6 py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <Link
              href="/"
              className="font-[family-name:var(--font-pinyon-script)] text-2xl text-white"
            >
              The Rehab Studio
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("description")}
            </p>
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

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
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
