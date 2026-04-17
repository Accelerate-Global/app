import type { MetadataRoute } from "next";

const siteIconVersion = "20260417";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accelerate Global",
    short_name: "Accelerate Global",
    description: "Access shared people group datasets for Accelerate Global.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: `/ag-site-icon-192.png?v=${siteIconVersion}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/ag-site-icon-512.png?v=${siteIconVersion}`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `/ag-apple-touch-icon.png?v=${siteIconVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
