# Bugfix Requirements Document

## Introduction

The "Analysis" button on the Incidents page is broken — clicking it opens a video modal but the video never loads or plays. This affects both the "Active Perimeter Breaches" section and individual incident cards. The feature is intended to stream a relevant CCTV analysis video (e.g. `Perimeter_Detection.mp4`, `Theft Camera .mp4`) from the backend based on the breach type. The root cause is a malformed video `src` URL in the modal: the frontend constructs the URL as `/backend/depot/vision/cameras/video-library/{filename}/stream`, but the Next.js proxy rewrites `/backend/:path*` to `http://127.0.0.1:8000/:path*`, meaning the actual request hits `http://127.0.0.1:8000/backend/depot/vision/cameras/video-library/{filename}/stream` — a path that does not exist on the backend. The correct backend route is `/depot/vision/cameras/video-library/{filename}/stream`, so the video `src` must be `/backend/depot/vision/cameras/video-library/{filename}/stream` — which is already the right proxy path. However, the `<video>` element is embedded inside the Next.js app and the `src` is constructed without the proxy prefix being stripped correctly, causing a 404 on the video resource.

Upon deeper inspection: the `<video>` `src` is set to `/backend/depot/vision/cameras/video-library/{filename}/stream`. The Next.js rewrite maps `/backend/:path*` → `http://127.0.0.1:8000/:path*`, so the effective backend URL becomes `http://127.0.0.1:8000/depot/vision/cameras/video-library/{filename}/stream`. The backend endpoint `GET /depot/vision/cameras/video-library/{filename}/stream` exists in `camera.py` and uses `FileResponse`. The bug is that `FileResponse` does **not** support HTTP Range requests properly (it sets `Accept-Ranges: bytes` in headers but FastAPI's `FileResponse` does not handle partial content / `Range` header natively), so the browser's HTML5 `<video>` element — which requires range request support to seek and begin playback — receives a `200` response instead of `206 Partial Content`, causing the video to fail to play in most browsers. Additionally, the filename contains a space (`Theft Camera .mp4`) which must be percent-encoded in the URL.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks the "Analysis" button on an Active Perimeter Breach card THEN the system opens a video modal but the video player displays no content and does not play

1.2 WHEN the video modal is open and the browser requests the video stream via the `<video>` element THEN the system returns a response that does not support HTTP Range requests (no `206 Partial Content`), causing the HTML5 video player to fail to load the video

1.3 WHEN the breach type maps to a video filename containing a space (e.g. `Theft Camera .mp4`) THEN the system constructs a URL with an unencoded space, resulting in a malformed HTTP request that returns a 404 or fails to resolve

1.4 WHEN the Analysis button is clicked on an incident card in the top "Incidents" list THEN the system does not provide any video playback functionality (no `handleAnalysisClick` handler is wired to incident cards, only to breach cards)

### Expected Behavior (Correct)

2.1 WHEN a user clicks the "Analysis" button on an Active Perimeter Breach card THEN the system SHALL open a video modal and the HTML5 video player SHALL successfully load and autoplay the analysis video associated with the breach type

2.2 WHEN the browser requests the video stream via the `<video>` element THEN the system SHALL respond with proper HTTP Range request support (`206 Partial Content` for range requests, `200` for full requests), enabling the HTML5 video player to seek and play the video

2.3 WHEN the breach type maps to a video filename containing special characters (e.g. spaces) THEN the system SHALL correctly percent-encode the filename in the video `src` URL so the HTTP request resolves to the correct backend endpoint (this is already handled via `encodeURIComponent` in the frontend — the backend must decode it correctly)

2.4 WHEN the video file referenced by the breach type does not exist on the backend filesystem THEN the system SHALL display a user-friendly error message inside the modal instead of a broken video player

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user clicks "Acknowledge" on a breach card THEN the system SHALL CONTINUE TO call the acknowledge incident API and update the incident status as before

3.2 WHEN a user clicks "Resolve" on an incident card THEN the system SHALL CONTINUE TO open the resolve modal and submit resolution notes to the backend as before

3.3 WHEN the Incidents page loads THEN the system SHALL CONTINUE TO fetch and display active incidents and perimeter breaches from the backend on a 20-second polling interval

3.4 WHEN the video modal is closed (by clicking the backdrop or the × button) THEN the system SHALL CONTINUE TO dismiss the modal and stop video playback as before

3.5 WHEN the backend video-library stream endpoint is called with a valid filename THEN the system SHALL CONTINUE TO serve the correct video file from the configured `LOCAL_VIDEO_DIR` path

---

## Bug Condition (Pseudocode)

**Bug Condition Function** — identifies requests that trigger the broken video playback:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type VideoStreamRequest
  OUTPUT: boolean

  // Bug is triggered when the HTML5 video player requests the stream
  // and the server does not handle Range headers
  RETURN X.method = "GET"
    AND X.path MATCHES "/depot/vision/cameras/video-library/{filename}/stream"
    AND X.headers CONTAINS "Range"
END FUNCTION
```

**Property: Fix Checking**

```pascal
// Property: Fix Checking — Range request returns 206 Partial Content
FOR ALL X WHERE isBugCondition(X) DO
  result ← streamVideoFile'(X)
  ASSERT result.status_code = 206
    AND result.headers["Content-Range"] IS NOT NULL
    AND result.headers["Accept-Ranges"] = "bytes"
END FOR
```

**Property: Preservation Checking**

```pascal
// Property: Preservation Checking — non-range requests still return 200
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT streamVideoFile(X) = streamVideoFile'(X)
END FOR
```
