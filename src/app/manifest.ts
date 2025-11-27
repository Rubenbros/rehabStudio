import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Rehab Studio - Fisioterapia en Zaragoza",
    short_name: "The Rehab Studio",
    description:
      "Centro de fisioterapia especializado en fisioterapia deportiva, invasiva y EPI en Zaragoza.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
