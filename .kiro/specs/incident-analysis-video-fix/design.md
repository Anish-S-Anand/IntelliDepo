# Design Document — Incident Analysis Video Fix

## Overview

The "Analysis" button on the Incidents page opens a video modal, but the HTML5 `<video>` element fails to play because the backend `stream_video_file` endpoint returns a plain `200 OK` via `FileResponse` instead of supporting HTTP Range requests (`206 Partial Content`). Browsers require Range support to seek into a video before playback begins. A secondary issue is that the `handleAnalysisClick` handler is only wired to breach cards in the "Active Perimeter Breaches" section, not to incident cards in the top "Incidents" list.

---

## Architecture Overview

```
Browser (Next.js)
  └─ <video src="/backend/depot/vision/cameras/video-library/{encoded_filename}/stream">
        │
        │  HTTP GET with Range: bytes=0-  (browser-initiated)
        │
        ▼
  Next.js Rewrite  (/backend/:path* → http://127.0.0.1:8000/:path*)
        │
        ▼
  FastAPI  GET /depot/vision/cameras/video-library/{filename}/stream
        │
        ▼
  camera.py  stream_video_file()
        │
        ▼
  LOCAL_VIDEO_DIR / {filename}  (e.g. Perimeter_Detection.mp4, Theft Camera .mp4)
```

The Next.js proxy in `next.config.mjs` already rewrites `/backend/:path*` to `http://127.0.0.1:8000/:path*`, so the frontend URL `/backend/depot/vision/cameras/video-library/{filename}/stream` correctly reaches the FastAPI endpoint at `/depot/vision/cameras/video-library/{filename}/stream`. No proxy change is needed.

---

## Backend Change — Replace FileResponse with Range-Aware Streaming

### Current Code (Broken)

```python
# camera.py — stream_video_file()
return FileResponse(
    path=str(video_path),
    media_type="video/mp4",
    headers={
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
    },
)
```

`FileResponse` sets the `Accept-Ranges: bytes` header but does **not** parse the incoming `Range` request header or return `206 Partial Content`. The browser's HTML5 video player sends a `Range: bytes=0-` request on first load and expects a `206` response; receiving `200` causes most browsers to refuse to play the video.

### Fixed Code (Design)

Replace `FileResponse` with a custom handler that:

1. Reads the `Range` header from the incoming request.
2. If a `Range` header is present:
   - Parses the byte range (e.g. `bytes=0-` or `bytes=1024-2047`).
   - Opens the file, seeks to the start byte, reads the requested chunk.
   - Returns `206 Partial Content` with headers:
     - `Content-Range: bytes {start}-{end}/{total}`
     - `Accept-Ranges: bytes`
     - `Content-Length: {chunk_size}`
     - `Content-Type: video/mp4`
3. If no `Range` header is present:
   - Streams the full file with `200 OK`.
   - Includes `Accept-Ranges: bytes` and `Content-Length` headers.
4. If the file does not exist:
   - Returns `404` with a clear JSON error message.

The endpoint signature gains a `request: Request` parameter to access headers:

```python
@router.get("/video-library/{filename}/stream")
async def stream_video_file(filename: str, request: Request):
    from app.depot.vision.video_library import get_local_video_path
    import os

    video_path = get_local_video_path(filename)
    if video_path is None or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Video not found: {filename}")

    file_size = os.path.getsize(video_path)
    range_header = request.headers.get("Range")

    if range_header:
        # Parse "bytes=start-end"
        range_val = range_header.replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_file_range():
            with open(video_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = f.read(min(65536, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_file_range(),
            status_code=206,
            media_type="video/mp4",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
                "Cache-Control": "no-cache",
            },
        )
    else:
        def iter_full_file():
            with open(video_path, "rb") as f:
                while True:
                    data = f.read(65536)
                    if not data:
                        break
                    yield data

        return StreamingResponse(
            iter_full_file(),
            status_code=200,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "no-cache",
            },
        )
```

---

## Frontend Change — Wire handleAnalysisClick to Incident Cards and Encode Filenames

### Current State

In `IncidentsPage.tsx`:

- `handleAnalysisClick(breach: BreachResponse)` is defined and wired to breach cards in the "Active Perimeter Breaches" section (line 367).
- Incident cards in the top "Incidents" list have no "Analysis" button — they only have "View Evidence", "Acknowledge", and "Resolve" buttons.
- The video `src` already uses `encodeURIComponent` on the filename:
  ```tsx
  src={`/backend/depot/vision/cameras/video-library/${encodeURIComponent(selectedBreachVideo.videoFile)}/stream`}
  ```
  This correctly encodes `Theft Camera .mp4` → `Theft%20Camera%20.mp4`. No change needed here.

### Required Change

Add an "Analysis" button to incident cards in the top list. Since incident cards use the `Incident` shape (not `BreachResponse`), a separate handler is needed that accepts an `Incident` and maps it to a video file using the incident type string.

```tsx
// Map incident types to video files (mirrors BREACH_VIDEO_MAP logic)
const INCIDENT_VIDEO_MAP: Record<string, string> = {
  "Unauthorized Entry": "Perimeter_Detection.mp4",
  "Loitering": "Theft Camera .mp4",
  "Forced Entry": "Perimeter_Detection.mp4",
  "After Hours": "Perimeter_Detection.mp4",
  "Object Left Behind": "Theft Camera .mp4",
};

const handleIncidentAnalysisClick = (incident: Incident) => {
  const videoFile = INCIDENT_VIDEO_MAP[incident.type] || "Perimeter_Detection.mp4";
  setSelectedBreachVideo({
    breachId: incident.id,
    videoFile,
    breachType: incident.type,
  });
};
```

Wire this to the incident card action buttons alongside "View Evidence":

```tsx
<button
  onClick={() => handleIncidentAnalysisClick(i)}
  className="px-3 py-1.5 rounded-lg border border-[#5B9BF5] text-[#5B9BF5] text-[11px] font-bold hover:bg-[#5B9BF5]/10 transition"
>
  📊 Analysis
</button>
```

---

## Error Handling — Video Load Failure in Modal

### Current State

The `<video>` element has no `onError` handler. If the video fails to load (file not found, network error, unsupported format), the browser shows a broken video player with no user-facing message.

### Required Change

Add an `onError` handler and a state variable to track video load errors:

```tsx
const [videoError, setVideoError] = useState<string | null>(null);

// In the modal:
<video
  key={selectedBreachVideo.videoFile}
  controls
  autoPlay
  className="w-full h-auto"
  style={{ maxHeight: '70vh' }}
  onError={() => setVideoError("Video could not be loaded. The file may be unavailable or the format is unsupported.")}
>
  <source
    src={`/backend/depot/vision/cameras/video-library/${encodeURIComponent(selectedBreachVideo.videoFile)}/stream`}
    type="video/mp4"
  />
</video>
{videoError && (
  <div className="mt-3 rounded-lg border border-[#F04A4A]/30 bg-[#F04A4A]/10 px-3 py-2 text-[12px] text-[#F04A4A]">
    ⚠ {videoError}
  </div>
)}
```

Reset `videoError` when the modal opens or the selected video changes.

---

## Unchanged Behavior (Regression Prevention)

- The Next.js proxy rewrite in `next.config.mjs` is not modified.
- The `acknowledgeBreach`, `acknowledge`, and `handleResolve` functions are not modified.
- The 20-second polling interval for incidents and breaches is not modified.
- The modal close behavior (backdrop click / × button) is not modified.
- Non-range requests to the stream endpoint continue to return `200 OK` with the full file.
- All other camera endpoints (`/mjpeg`, `/snapshot`, `/rtsp-proxy/stream`, etc.) are not modified.

---

## File Change Summary

| File | Change |
|------|--------|
| `backend/app/depot/vision/camera.py` | Replace `FileResponse` in `stream_video_file` with a custom `StreamingResponse` that handles `Range` headers and returns `206 Partial Content` |
| `frontend/src/components/depot/operations/IncidentsPage.tsx` | Add `handleIncidentAnalysisClick`, wire "Analysis" button to incident cards, add `onError` handler and error state to video modal |

---

## Test Strategy

- **Bug condition test** (`backend/tests/test_video_stream_range.py`): Send a `GET` request with `Range: bytes=0-` to the stream endpoint. Assert `206` status, `Content-Range` header, and `Accept-Ranges: bytes`. This test should **fail** on the current code and **pass** after the fix.
- **Regression test**: Send a `GET` request without a `Range` header. Assert `200` status and full file content.
- **404 test**: Send a request for a non-existent filename. Assert `404` status.
