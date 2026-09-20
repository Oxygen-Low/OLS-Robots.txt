import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal stub for @oxygenlow/webdefender/cloudflare to keep tests fast and
// decoupled from the real SDK. The stub's withDefender passes requests through.
// ---------------------------------------------------------------------------
vi.mock("@oxygenlow/webdefender/cloudflare", () => ({
  withDefender: (handler: ExportedHandler) => handler,
}));

// ---------------------------------------------------------------------------
// Inline the robots.txt template text so tests run without wrangler's loader.
// This mirrors the file content with the Sitemap line already removed.
// ---------------------------------------------------------------------------
vi.mock("../robots.txt", () => ({
  default: [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: Bytespider # https://knownagents.com/agents/bytespider",
    "Disallow: /",
    "User-agent: ClaudeBot # https://knownagents.com/agents/claudebot",
    "Disallow: /",
    "User-agent: meta-externalagent # https://knownagents.com/agents/meta-externalagent",
    "Disallow: /",
    "User-agent: Applebot # https://knownagents.com/agents/applebot",
    "Disallow: /",
    "User-agent: atlassian-bot # https://knownagents.com/agents/atlassian-bot",
    "Disallow: /",
    "User-agent: Claude-SearchBot # https://knownagents.com/agents/claude-searchbot",
    "Disallow: /",
    "User-agent: meta-webindexer # https://knownagents.com/agents/meta-webindexer",
    "Disallow: /",
    "User-agent: Claude-User # https://knownagents.com/agents/claude-user",
    "Disallow: /",
    "",
    "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
  ].join("\n"),
}));

// Import after mocks are registered
const { default: worker } = await import("../src/index");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://oxygenlow.com${path}`, { headers });
}

const fakeEnv = {} as never;
const fakeCtx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("OLS Robots.txt Worker", () => {
  it("returns 200 for /robots.txt", async () => {
    const res = await worker.fetch!(makeRequest("/robots.txt"), fakeEnv, fakeCtx);
    expect(res.status).toBe(200);
  });

  it("returns text/plain content type", async () => {
    const res = await worker.fetch!(makeRequest("/robots.txt"), fakeEnv, fakeCtx);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("returns correct Cache-Control header", async () => {
    const res = await worker.fetch!(makeRequest("/robots.txt"), fakeEnv, fakeCtx);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
  });

  it("dynamically injects Sitemap from the request host", async () => {
    const res = await worker.fetch!(makeRequest("/robots.txt"), fakeEnv, fakeCtx);
    const text = await res.text();
    expect(text).toContain("Sitemap: https://oxygenlow.com/sitemap.xml");
  });

  it("respects X-Forwarded-Host when building the Sitemap URL", async () => {
    const res = await worker.fetch!(
      makeRequest("/robots.txt", { "x-forwarded-host": "staging.oxygenlow.com" }),
      fakeEnv,
      fakeCtx
    );
    const text = await res.text();
    expect(text).toContain("Sitemap: https://staging.oxygenlow.com/sitemap.xml");
  });

  it("respects X-Forwarded-Proto when building the Sitemap URL", async () => {
    const res = await worker.fetch!(
      makeRequest("/robots.txt", { "x-forwarded-proto": "http" }),
      fakeEnv,
      fakeCtx
    );
    const text = await res.text();
    expect(text).toContain("Sitemap: http://oxygenlow.com/sitemap.xml");
  });

  it("returns 404 for non /robots.txt paths", async () => {
    const res = await worker.fetch!(makeRequest("/"), fakeEnv, fakeCtx);
    expect(res.status).toBe(404);
  });

  it("returns 404 for /sitemap.xml", async () => {
    const res = await worker.fetch!(makeRequest("/sitemap.xml"), fakeEnv, fakeCtx);
    expect(res.status).toBe(404);
  });

  it("does not contain the old hardcoded oxygenlow.com sitemap line", async () => {
    const res = await worker.fetch!(
      makeRequest("/robots.txt", { "x-forwarded-host": "example.com" }),
      fakeEnv,
      fakeCtx
    );
    const text = await res.text();
    // Should have example.com sitemap, not the old hardcoded one
    expect(text).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(text).not.toContain("Sitemap: https://oxygenlow.com/sitemap.xml");
  });
});
