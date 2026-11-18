import type { MetadataRoute } from "next";

/** Пилот закрыт от поисковых роботов. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
