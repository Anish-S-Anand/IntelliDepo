import { NextRequest, NextResponse } from "next/server";

/**
 * HLS Proxy — fetches .m3u8 manifests and .ts segments from public traffic
 * cameras, rewrites internal URLs to also go through this proxy, and serves
 * them with permissive CORS headers so hls.js can consume them client-side.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // Only allow http(s) schemes
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);

    const upstream = await fetch(targetUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "IntelliVision/1.0" },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502, headers: CORS_HEADERS },
      );
    }

    const ct = upstream.headers.get("content-type") || "";
    const isManifest =
      ct.includes("mpegurl") ||
      ct.includes("apple") ||
      targetUrl.endsWith(".m3u8") ||
      ct.includes("audio/x-mpegurl");

    if (isManifest) {
      let body = await upstream.text();
      // Compute base URL for resolving relative references
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
      const proxyBase = "/api/hls-proxy?url=";

      // Rewrite every non-comment, non-empty line that looks like a URL
      body = body
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            // Rewrite URI= inside EXT-X tags (e.g. EXT-X-MAP, EXT-X-MEDIA)
            if (trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
                const abs = uri.startsWith("http") ? uri : baseUrl + uri;
                return `URI="${proxyBase}${encodeURIComponent(abs)}"`;
              });
            }
            return line;
          }
          // Regular segment / sub-playlist line
          const absUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
          return proxyBase + encodeURIComponent(absUrl);
        })
        .join("\n");

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store",
          ...CORS_HEADERS,
        },
      });
    }

    // Binary segment (.ts, .aac, .mp4, init segments, etc.)
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct || "video/mp2t",
        "Cache-Control": "no-cache",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502, headers: CORS_HEADERS });
  }
}
