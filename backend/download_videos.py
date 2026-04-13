"""
Download 6 warehouse/depot stock videos from Mixkit (free, no auth needed).
CDN pattern: assets.mixkit.co/videos/preview/{id}/{id}-large.mp4
"""
import urllib.request, os, ssl

ctx = ssl._create_unverified_context()
os.makedirs("/tmp/depot_videos", exist_ok=True)

# Mixkit warehouse/forklift/logistics clips — IDs from their public URLs
# Each maps to a specific camera scene
CLIPS = [
    # scene_0: Gate Entry — freight truck arriving at warehouse
    ("https://assets.mixkit.co/videos/preview/mixkit-freight-truck-arriving-at-the-warehouse-23011-large.mp4", "scene_0.mp4"),
    # scene_1: Zone-A Overhead — worker driving forklift through warehouse
    ("https://assets.mixkit.co/videos/preview/mixkit-a-worker-driving-through-the-warehouse-24127-large.mp4", "scene_1.mp4"),
    # scene_2: Loading Bay — forklift driver operating in warehouse
    ("https://assets.mixkit.co/videos/preview/mixkit-view-of-a-forklift-driver-operating-in-a-warehouse-45848-large.mp4", "scene_2.mp4"),
    # scene_3: Zone-C Perimeter — industrial warehouse facility
    ("https://assets.mixkit.co/videos/preview/mixkit-industrial-warehouse-facility-21946-large.mp4", "scene_3.mp4"),
    # scene_4: Gate Exit — man walking through warehouse
    ("https://assets.mixkit.co/videos/preview/mixkit-man-walking-through-the-warehouse-23551-large.mp4", "scene_4.mp4"),
    # scene_5: Yard Overview — business people walking in warehouse
    ("https://assets.mixkit.co/videos/preview/mixkit-business-people-walking-in-the-warehouse-23237-large.mp4", "scene_5.mp4"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://mixkit.co/",
}

for url, filename in CLIPS:
    dest = f"/tmp/depot_videos/{filename}"
    if os.path.exists(dest) and os.path.getsize(dest) > 500_000:
        print(f"  EXISTS: {filename} ({os.path.getsize(dest)//1024}KB)")
        continue
    print(f"Downloading {filename}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
            data = r.read()
        with open(dest, "wb") as f:
            f.write(data)
        print(f"  OK: {os.path.getsize(dest)//1024}KB")
    except Exception as e:
        print(f"  FAILED: {e}")

print("\nDone. Files in /tmp/depot_videos/:")
for f in sorted(os.listdir("/tmp/depot_videos")):
    path = f"/tmp/depot_videos/{f}"
    print(f"  {f}: {os.path.getsize(path)//1024}KB")
