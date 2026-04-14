import { NextRequest, NextResponse } from "next/server";

/**
 * Camera Proxy — fetches live MJPEG/JPEG frames from public cameras
 * and serves them to the browser, bypassing CORS/mixed-content restrictions.
 *
 * Usage:
 *   /api/camera-proxy?url=https://weathercam.digitraffic.fi/C0150200.jpg
 *   /api/camera-proxy?url=http://88.53.197.250/axis-cgi/mjpg/video.cgi
 *
 * For MJPEG streams, extracts a single JPEG frame.
 * For JPEG endpoints, proxies the image directly.
 */

// Whitelist of allowed camera host patterns (security)
const ALLOWED_HOSTS = [
  "weathercam.digitraffic.fi",
  "88.53.197.250",
  "cam-mckeldin-eastview.umd.edu",
];

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

  // Security: only allow whitelisted camera hosts
  if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "IntelliVision/1.0" },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream ${resp.status}` }, { status: 502 });
    }

    const contentType = resp.headers.get("content-type") || "";

    // --- Single JPEG image (Finnish cams) ---
    if (contentType.includes("image/jpeg") || contentType.includes("image/png") || url.endsWith(".jpg")) {
      const buf = await resp.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // --- MJPEG stream: extract one frame ---
    if (contentType.includes("multipart/x-mixed-replace")) {
      const body = resp.body;
      if (!body) {
        return NextResponse.json({ error: "No stream body" }, { status: 502 });
      }

      // Read chunks until we find a complete JPEG frame
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let totalLen = 0;
      const MAX_BYTES = 2 * 1024 * 1024; // 2MB safety limit

      try {
        while (totalLen < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;

          // Check if we have a complete JPEG (FFD8 start, FFD9 end)
          const combined = concat(chunks);
          const jpegStart = findBytes(combined, [0xff, 0xd8]);
          const jpegEnd = findBytes(combined, [0xff, 0xd9], jpegStart);

          if (jpegStart >= 0 && jpegEnd > jpegStart) {
            const frame = combined.slice(jpegStart, jpegEnd + 2);
            reader.cancel();
            return new NextResponse(frame, {
              status: 200,
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      return NextResponse.json({ error: "No JPEG frame found" }, { status: 502 });
    }

    // Unknown content type — try to pass through
    const buf = await resp.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502 });
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
