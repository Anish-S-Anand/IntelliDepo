# Tasks

## Task 1: Write bug condition exploration property test
- [x] 1.1 Create test file `backend/tests/test_video_stream_range.py`
- [x] 1.2 Write a pytest test that sends a GET request with a `Range: bytes=0-` header to `/depot/vision/cameras/video-library/{filename}/stream` using the existing test client
- [x] 1.3 Assert the response status code is 206 (this test should FAIL on the current code, confirming the bug)
- [x] 1.4 Assert response headers contain `Content-Range` and `Accept-Ranges: bytes`

## Task 2: Fix backend video stream endpoint to support HTTP Range requests
**Depends on:** Task 1
- [x] 2.1 In `camera.py`, replace the `FileResponse` in the stream endpoint with a custom streaming response that reads the `Range` header
- [x] 2.2 If `Range` header present: parse byte range, return `206 Partial Content` with `Content-Range`, `Accept-Ranges`, `Content-Length` headers and the partial file content
- [x] 2.3 If no `Range` header: return `200 OK` with full file content (streaming)
- [x] 2.4 If file does not exist: return `404` with a clear error message

## Task 3: Fix frontend Analysis button wiring and URL encoding
**Depends on:** Task 2
- [x] 3.1 Find the incidents page component and ensure `handleAnalysisClick` (or equivalent) is wired to incident cards in the top incidents list, not just breach cards
- [x] 3.2 Ensure the video `src` URL uses `encodeURIComponent` on the filename portion
- [x] 3.3 Add an `onError` handler to the `<video>` element that shows a user-friendly error message inside the modal when the video fails to load

## Task 4: Verify the fix end-to-end
**Depends on:** Task 3
- [x] 4.1 Run the bug condition exploration test from Task 1 — it should now PASS (206 returned)
- [x] 4.2 Confirm non-range requests still return 200 (regression test)
- [x] 4.3 Confirm the frontend video modal opens and plays video for breach cards
