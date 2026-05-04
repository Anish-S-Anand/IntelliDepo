"""Test script to verify video files are accessible"""
from pathlib import Path
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.depot.vision.video_library import LOCAL_VIDEO_DIR, SCENE_VIDEOS, get_local_video_path

print("=" * 80)
print("VIDEO ACCESS TEST")
print("=" * 80)

print(f"\nLOCAL_VIDEO_DIR: {LOCAL_VIDEO_DIR}")
print(f"Directory exists: {LOCAL_VIDEO_DIR.exists()}")

if LOCAL_VIDEO_DIR.exists():
    print(f"\nFiles in directory:")
    for file in LOCAL_VIDEO_DIR.iterdir():
        if file.is_file():
            size_mb = file.stat().st_size / (1024 * 1024)
            print(f"  - {file.name} ({size_mb:.2f} MB)")

print(f"\nSCENE_VIDEOS configuration:")
for i, scene in enumerate(SCENE_VIDEOS):
    print(f"\n  Scene {i}: {scene['label']}")
    print(f"    Filename: {scene['filename']}")
    video_path = get_local_video_path(scene['filename'])
    if video_path:
        print(f"    ✅ Found: {video_path}")
        print(f"    Size: {video_path.stat().st_size / (1024 * 1024):.2f} MB")
    else:
        print(f"    ❌ NOT FOUND")

print("\n" + "=" * 80)
