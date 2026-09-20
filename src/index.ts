// @ts-expect-error — Wrangler text module import (no TS declaration needed)
import robotsTemplate from "../robots.txt";
import { withDefender } from "@oxygenlow/webdefender/cloudflare";

export interface Env {
  /** API key for @oxygenlow/webdefender — set via: npx wrangler secret put DEFENDER_API_KEY */
  DEFENDER_API_KEY?: string;
  /** Alternate env key name also supported by webdefender */
  WEBDEFENDER_API_KEY?: string;
}

async function handleFetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // Strict path guard — this Worker only handles /robots.txt
  if (url.pathname !== "/robots.txt") {
    return new Response("Not Found", { status: 404 });
  }

  // Resolve host and protocol, respecting CDN/proxy forwarding headers
  const proto =
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "") ||
    "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    url.host;

  const sitemapUrl = `${proto}://${host}/sitemap.xml`;

  // Append the dynamic Sitemap directive to the template
  const body = `${(robotsTemplate as string).trimEnd()}\nSitemap: ${sitemapUrl}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

// Wrap with @oxygenlow/webdefender for DDoS protection and request logging.
// DEFENDER_API_KEY (or WEBDEFENDER_API_KEY) is read automatically from env.
export default withDefender({ fetch: handleFetch });
