"""
Download 6 warehouse/depot stock videos from Mixkit (free, no auth needed).
Direct CDN pattern: assets.mixkit.co/videos/{id}/{id}-720.mp4
"""
import urllib.request, os, ssl, sys

ctx = ssl._create_unverified_context()

# Use platform-appropriate temp dir
if sys.platform == "win32":
    VIDEO_DIR = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "depot_videos")
else:
    VIDEO_DIR = "/tmp/depot_videos"

os.makedirs(VIDEO_DIR, exist_ok=True)

# Mixkit warehouse/logistics clips — confirmed direct MP4 URLs (720p, free)
# Each maps to a specific camera scene in the IntelliVision grid
CLIPS = [
    # scene_0: Gate Entry North — freight truck arriving at warehouse
    ("https://assets.mixkit.co/videos/23011/23011-720.mp4", "scene_0.mp4"),
    # scene_1: Zone-A Overhead — man walking through warehouse interior
    ("https://assets.mixkit.co/videos/23551/23551-720.mp4", "scene_1.mp4"),
    # scene_2: Loading Bay 1-4 — men working loading a freight truck
    ("https://assets.mixkit.co/videos/13067/13067-720.mp4", "scene_2.mp4"),
    # scene_3: Zone-C Perimeter — large warehouse area high-angle shot
    ("https://assets.mixkit.co/videos/39453/39453-720.mp4", "scene_3.mp4"),
    # scene_4: Gate Exit South — worker giving directions to freight truck
    ("https://assets.mixkit.co/videos/23852/23852-720.mp4", "scene_4.mp4"),
    # scene_5: Yard Overview — warehouse port/yard aerial view
    ("https://assets.mixkit.co/videos/39462/39462-720.mp4", "scene_5.mp4"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://mixkit.co/",
}

print(f"Downloading to: {VIDEO_DIR}\n")

for url, filename in CLIPS:
    dest = os.path.join(VIDEO_DIR, filename)
    if os.path.exists(dest) and os.path.getsize(dest) > 100_000:
        print(f"  EXISTS: {filename} ({os.path.getsize(dest) // 1024}KB)")
        continue
    print(f"Downloading {filename} ...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
            data = r.read()
        with open(dest, "wb") as f:
            f.write(data)
        print(f"  OK: {os.path.getsize(dest) // 1024}KB")
    except Exception as e:
        print(f"  FAILED: {e}")

print(f"\nDone. Files in {VIDEO_DIR}:")
for f in sorted(os.listdir(VIDEO_DIR)):
    path = os.path.join(VIDEO_DIR, f)
    print(f"  {f}: {os.path.getsize(path) // 1024}KB")
