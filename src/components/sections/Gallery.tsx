"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

const images = [
  {
    src: "/images/img_2.png",
    altKey: "facade",
    className: "col-span-2 row-span-2",
  },
  {
    src: "/images/img_1.png",
    altKey: "treatmentRoom",
    className: "col-span-1 row-span-1",
  },
  {
    src: "/images/img_5.png",
    altKey: "ultrasound",
    className: "col-span-1 row-span-1",
  },
  {
    src: "/images/img.png",
    altKey: "waitingRoom",
    className: "col-span-1 row-span-1",
  },
  {
    src: "/images/img_3.png",
    altKey: "equipment",
    className: "col-span-1 row-span-1",
  },
];

export function Gallery() {
  const t = useTranslations("gallery");

  return (
    <section className="py-24">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px]">
          {images.map((image, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-xl group ${image.className}`}
            >
              <Image
                src={image.src}
                alt={t(`images.${image.altKey}`)}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
