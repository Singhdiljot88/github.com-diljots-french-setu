import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "French Setu — 120 Days to TEF",
    short_name: "French Setu",
    description: "French for English- and Hindi-speaking beginners, with a 120-day TEF Canada plan.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#1f726b",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
