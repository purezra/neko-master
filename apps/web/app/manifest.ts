import type { MetadataRoute } from "next";
import { APP_DISPLAY_NAME, APP_NAME, BRAND_ASSET_VERSION } from "@/lib/project-info";
import messages from "@/messages/en.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_DISPLAY_NAME,
    short_name: APP_NAME,
    description: messages.metadata.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The manifest cannot follow the in-app palette; these are the defaults
    // from globals.css (dark = Catppuccin Mocha). ThemeAttributeSync updates
    // the live <meta name="theme-color"> once a palette is selected.
    background_color: "#1e1e2e",
    theme_color: "#1e1e2e",
    orientation: "any",
    categories: ["utilities", "network"],
    icons: [
      {
        src: `/icons/icon-72x72.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "72x72",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-96x96.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-128x128.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-144x144.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-152x152.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "152x152",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-192x192.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-384x384.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-512x512.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-maskable-192x192.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/icons/icon-maskable-512x512.png?v=${BRAND_ASSET_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
