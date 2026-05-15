"""
Fine-tune the cement-bag YOLO model when labelled data is available.

This script intentionally requires an explicit dataset YAML. Production code
should not "train" from live footage without reviewed labels, because that
would bake false positives into the model.

Example:
    python -m app.depot.vision.train_cement_bag_model ^
        --data C:\datasets\cement-bags\data.yaml ^
        --epochs 80 ^
        --imgsz 960
"""
from __future__ import annotations

import argparse
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_BASE_WEIGHTS = PROJECT_ROOT / "best_cement_bags_2025-05-29.pt"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "backend" / "app" / "depot" / "vision" / "training_runs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune cement-bag YOLO weights.")
    parser.add_argument("--data", required=True, help="YOLO dataset YAML with train/val paths.")
    parser.add_argument("--weights", default=str(DEFAULT_BASE_WEIGHTS), help="Base .pt weights to fine-tune.")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default=None, help="Optional ultralytics device, e.g. 0 or cpu.")
    parser.add_argument("--project", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--name", default="cement_bags_finetune")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_path = Path(args.data).expanduser().resolve()
    weights_path = Path(args.weights).expanduser().resolve()

    if not data_path.exists():
        raise FileNotFoundError(f"Dataset YAML not found: {data_path}")
    if not weights_path.exists():
        raise FileNotFoundError(f"Base weights not found: {weights_path}")

    from ultralytics import YOLO

    model = YOLO(str(weights_path))
    train_kwargs = {
        "data": str(data_path),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "project": args.project,
        "name": args.name,
        "patience": 20,
        "cache": False,
        "exist_ok": False,
    }
    if args.device is not None:
        train_kwargs["device"] = args.device

    result = model.train(**train_kwargs)
    print(result)


if __name__ == "__main__":
    main()
