import { NextRequest, NextResponse } from "next/server";

/**
 * Camera Proxy — fetches live MJPEG/JPEG frames from public cameras
 * and serves them to the browser, bypassing CORS/mixed-content restrictions.
 *
 * For MJPEG streams, extracts a single JPEG frame.
 * For JPEG endpoints, proxies the image directly.
 * Caches last successful frame per URL so transient failures still show an image.
 */

const ALLOWED_HOSTS = [
  "weathercam.digitraffic.fi",
  "88.53.197.250",
  "cam-mckeldin-eastview.umd.edu",
];

// In-memory frame cache: url → { data, timestamp }
const frameCache = new Map<string, { data: Uint8Array; ts: number }>();
const CACHE_TTL = 30_000; // serve cached frame for up to 30s

function cachedResponse(url: string): NextResponse | null {
  const entry = frameCache.get(url);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return new NextResponse(entry.data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Cache": "HIT",
      },
    });
  }
  return null;
}

function cacheFrame(url: string, data: Uint8Array) {
  frameCache.set(url, { data, ts: Date.now() });
  // Evict old entries
  if (frameCache.size > 20) {
    const oldest = [...frameCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) frameCache.delete(oldest[0]);
  }
}

function makeJpegResponse(data: Uint8Array): NextResponse {
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    // Connection timeout: 10s to establish connection
    const connectCtrl = new AbortController();
    const connectTimer = setTimeout(() => connectCtrl.abort(), 10_000);

    const resp = await fetch(url, {
      signal: connectCtrl.signal,
      headers: { "User-Agent": "IntelliVision/1.0" },
    });
    clearTimeout(connectTimer);

    if (!resp.ok) {
      return cachedResponse(url) ?? NextResponse.json({ error: `Upstream ${resp.status}` }, { status: 502 });
    }

    const contentType = resp.headers.get("content-type") || "";

    // --- Single JPEG image ---
    if (contentType.includes("image/jpeg") || contentType.includes("image/png") || url.endsWith(".jpg")) {
      const buf = new Uint8Array(await resp.arrayBuffer());
      cacheFrame(url, buf);
      return makeJpegResponse(buf);
    }

    // --- MJPEG stream: extract one frame with its own read timeout ---
    if (contentType.includes("multipart/x-mixed-replace")) {
      const body = resp.body;
      if (!body) {
        return cachedResponse(url) ?? NextResponse.json({ error: "No stream body" }, { status: 502 });
      }

      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let totalLen = 0;
      const MAX_BYTES = 2 * 1024 * 1024;

      // Read timeout: 12s to extract a complete frame
      const readTimeout = setTimeout(() => {
        reader.cancel().catch(() => {});
      }, 12_000);

      try {
        while (totalLen < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;

          // Check for complete JPEG (FFD8...FFD9)
          const combined = concat(chunks);
          const jpegStart = findBytes(combined, [0xff, 0xd8]);
          const jpegEnd = findBytes(combined, [0xff, 0xd9], jpegStart);

          if (jpegStart >= 0 && jpegEnd > jpegStart) {
            clearTimeout(readTimeout);
            const frame = combined.slice(jpegStart, jpegEnd + 2);
            reader.cancel().catch(() => {});
            cacheFrame(url, frame);
            return makeJpegResponse(frame);
          }
        }
      } catch {
        // Read timed out or was cancelled
      } finally {
        clearTimeout(readTimeout);
        reader.cancel().catch(() => {});
      }

      // No frame extracted — return cached if available
      return cachedResponse(url) ?? NextResponse.json({ error: "No JPEG frame found" }, { status: 502 });
    }

    // Unknown content type — try to pass through as image
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length > 100 && buf[0] === 0xff && buf[1] === 0xd8) {
      // It's a JPEG despite wrong content-type
      cacheFrame(url, buf);
      return makeJpegResponse(buf);
    }
    return new NextResponse(buf, {
      status: 200,
      headers: { "Content-Type": contentType || "application/octet-stream", "Cache-Control": "no-cache" },
    });
  } catch {
    // Connection failed — serve cached frame if available
    const cached = cachedResponse(url);
    if (cached) return cached;
    return NextResponse.json({ error: "Camera unreachable" }, { status: 502 });
  }
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function findBytes(data: Uint8Array, pattern: number[], startFrom = 0): number {
  for (let i = startFrom; i <= data.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
