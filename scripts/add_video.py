#!/usr/bin/env python3
"""Aggiunge un video alla scheda di un punto.

Uso:  python3 scripts/add_video.py VIDEO LIVELLO ID [--muto]
  es: python3 scripts/add_video.py ~/video.mp4 vedovelle v179

Comprime il video per il web (H.264, 30 fps, avvio veloce), ne estrae
un'immagine di copertina e lo registra in data/media.json.
Con --muto il video viene salvato senza audio.
Richiede ffmpeg.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
INDEX = ROOT / "data" / "media.json"


def has_audio(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
    return bool(out.strip())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 3:
        sys.exit(__doc__)
    src, layer, pid = Path(args[0]), args[1], args[2]
    mute = "--muto" in sys.argv
    MEDIA.mkdir(exist_ok=True)
    video, poster = MEDIA / f"{layer}-{pid}.mp4", MEDIA / f"{layer}-{pid}.jpg"

    audio = ["-an"] if mute else ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-r", "30", "-vf", "scale='min(720,iw)':-2",
                    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "25", "-preset", "slow",
                    *audio, "-movflags", "+faststart", str(video)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", str(video), "-frames:v", "1", "-q:v", "4",
                    str(poster)], check=True)

    index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
    entry = {"video": f"media/{video.name}", "poster": f"media/{poster.name}"}
    if has_audio(video):
        entry["audio"] = True
    index.setdefault(layer, {})[pid] = entry
    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"✓ {video.name} ({video.stat().st_size // 1024} KB){' con audio' if entry.get('audio') else ''}")


if __name__ == "__main__":
    main()
