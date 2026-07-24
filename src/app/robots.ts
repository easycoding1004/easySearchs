import type { MetadataRoute } from "next";

const BASE_URL = "https://ezzsearch.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/result/*", "/dashboard/*"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
