#!/usr/bin/env python3
"""
TikTok Travel Vlog Generator

A product-style Python tool that turns trip photos/videos into a cinematic vertical
TikTok/Reels style vlog with themed grading, trendy pacing, text overlays, and audio.

Example usage:
python tiktok_travel_vlog_generator.py \
  --folder ./trip_media \
  --theme Italy \
  --audio_path ./audio/trend_sound.mp3 \
  --output ./outputs/italy_vlog.mp4 \
  --custom "add more zoom on faces and glitch transitions"
"""

import argparse
import os
import random
import math
import textwrap
from typing import Dict, List, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from tqdm import tqdm
from moviepy.editor import (
    VideoFileClip,
    ImageClip,
    AudioFileClip,
    CompositeVideoClip,
    concatenate_videoclips,
    vfx,
)


# ----------------------------- Theme Presets ----------------------------- #
THEME_PRESETS = {
    "Spain": {
        "grade": "warm",
        "energy": "high",
        "default_text": [
            "Madrid vibes 🇪🇸",
            "Barcelona nights ✨",
            "¡Viva España!",
            "Tapas, sunsets, repeat",
            "2025 memories",
            "#travel #spain #fyp",
        ],
        "cut_range": (1.8, 3.0),
        "grain_strength": 0.035,
        "vignette": 0.22,
        "audio_suggestion": "Reggaeton / Latin trap (La Mudanza style energy)",
    },
    "Italy": {
        "grade": "teal",
        "energy": "medium",
        "default_text": [
            "Ciao Roma! 🇮🇹",
            "Bellissimo!",
            "Amalfi dreams 🌊",
            "Espresso & golden hour",
            "Grazie 2025",
            "#travel #italy #reels",
        ],
        "cut_range": (2.4, 4.2),
        "grain_strength": 0.03,
        "vignette": 0.18,
        "audio_suggestion": "Nostalgic upbeat / romantic Mediterranean pop",
    },
    "Custom": {
        "grade": "neutral",
        "energy": "medium",
        "default_text": [
            "2025 recap",
            "Core memory unlocked",
            "POV: travel dump",
            "#travel #dump #fyp",
        ],
        "cut_range": (2.0, 4.0),
        "grain_strength": 0.025,
        "vignette": 0.16,
        "audio_suggestion": "Choose a sound matching your custom prompt",
    },
}

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi"}
TARGET_SIZE = (1080, 1920)  # 9:16 TikTok/Reels
FPS = 30


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a TikTok-style vertical travel vlog from images/videos."
    )
    parser.add_argument("--folder", required=True, help="Input folder with media files.")
    parser.add_argument(
        "--theme",
        required=True,
        choices=["Spain", "Italy", "Custom"],
        help="Theme preset to apply.",
    )
    parser.add_argument(
        "--audio_path",
        required=True,
        help="Path to downloaded trend audio file (MP3/WAV/etc).",
    )
    parser.add_argument("--output", required=True, help="Output MP4 file path.")
    parser.add_argument(
        "--custom",
        default="",
        help="Optional style prompt. Example: 'nostalgic vintage with glitch beats'.",
    )
    parser.add_argument(
        "--order",
        choices=["chronological", "shuffle"],
        default="chronological",
        help="Media ordering style.",
    )
    parser.add_argument(
        "--max_items",
        type=int,
        default=0,
        help="Optional cap on number of media files (0 = no cap).",
    )
    return parser.parse_args()


def collect_media(folder: str, order: str, max_items: int = 0) -> List[str]:
    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Input folder not found: {folder}")

    files = []
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        ext = os.path.splitext(name.lower())[1]
        if ext in SUPPORTED_IMAGE_EXTS or ext in SUPPORTED_VIDEO_EXTS:
            files.append(path)

    if not files:
        raise RuntimeError("No supported media files found in input folder.")

    if order == "chronological":
        files.sort(key=lambda p: os.path.getmtime(p))
    else:
        random.shuffle(files)

    if max_items > 0:
        files = files[:max_items]

    return files


def parse_prompt_adjustments(theme_cfg: Dict, prompt: str) -> Dict:
    """Parse free-text prompt to tweak pacing/effects in a chat-like way."""
    adjustments = {
        "speed_factor": 1.0,        # <1 slower, >1 faster
        "image_duration_scale": 1.0,
        "zoom_intensity": 1.0,
        "use_glitch": False,
        "fade_strength": 0.30,
        "extra_grain": 0.0,
        "custom_grade": None,
        "emotion_text": False,
    }

    txt = (prompt or "").lower()

    if "slow" in txt or "emotional" in txt or "cinematic" in txt:
        adjustments["speed_factor"] = 0.85
        adjustments["image_duration_scale"] = 1.25
        adjustments["zoom_intensity"] = 0.85
        adjustments["emotion_text"] = True

    if "fast" in txt or "hype" in txt or "energetic" in txt or "beat drop" in txt:
        adjustments["speed_factor"] = 1.2
        adjustments["image_duration_scale"] = 0.8

    if "glitch" in txt or "shake" in txt:
        adjustments["use_glitch"] = True
        adjustments["fade_strength"] = 0.2

    if "vintage" in txt or "sepia" in txt:
        adjustments["custom_grade"] = "sepia"

    if "moody" in txt or "dark" in txt:
        adjustments["custom_grade"] = "moody"

    if "zoom" in txt:
        adjustments["zoom_intensity"] = 1.25

    if "grain" in txt or "film" in txt:
        adjustments["extra_grain"] = 0.02

    # Keep compatibility with theme style if prompt did not override grade
    if adjustments["custom_grade"] is None:
        adjustments["custom_grade"] = theme_cfg["grade"]

    return adjustments


def fit_clip_to_vertical(clip, target_size: Tuple[int, int] = TARGET_SIZE):
    """Resize + center crop to fill 9:16 frame without distortion."""
    tw, th = target_size
    cw, ch = clip.size
    clip_aspect = cw / ch
    target_aspect = tw / th

    if clip_aspect > target_aspect:
        clip = clip.resize(height=th)
        x_center = clip.w / 2
        clip = clip.crop(x_center=x_center, width=tw, height=th)
    else:
        clip = clip.resize(width=tw)
        y_center = clip.h / 2
        clip = clip.crop(y_center=y_center, width=tw, height=th)
    return clip


def apply_color_grade(frame: np.ndarray, grade: str, vignette_strength: float, grain_strength: float, glitch: bool = False) -> np.ndarray:
    """Apply cinematic grading + vignette + film grain + optional glitch shake."""
    img = frame.astype(np.float32)

    if grade == "warm":  # Spain
        img[..., 2] *= 1.09  # R
        img[..., 1] *= 1.03  # G
        img[..., 0] *= 0.93  # B
    elif grade == "teal":  # Italy
        img[..., 0] *= 1.10
        img[..., 1] *= 1.05
        img[..., 2] *= 0.93
    elif grade == "sepia":
        kernel = np.array(
            [[0.272, 0.534, 0.131], [0.349, 0.686, 0.168], [0.393, 0.769, 0.189]],
            dtype=np.float32,
        )
        img = cv2.transform(img, kernel)
    elif grade == "moody":
        img *= 0.86
        img[..., 0] *= 1.06

    img = np.clip(img, 0, 255)

    # Subtle S-curve like contrast
    img = img / 255.0
    img = np.where(img < 0.5, 2 * img * img, 1 - 2 * (1 - img) * (1 - img))
    img = np.clip(img * 255.0, 0, 255)

    h, w = img.shape[:2]

    # Vignette mask
    y, x = np.ogrid[:h, :w]
    cy, cx = h / 2, w / 2
    norm = ((x - cx) ** 2 / (cx**2) + (y - cy) ** 2 / (cy**2))
    vignette = 1.0 - vignette_strength * norm
    vignette = np.clip(vignette, 1.0 - vignette_strength, 1.0)
    img *= vignette[..., None]

    # Film grain
    if grain_strength > 0:
        noise = np.random.normal(0, 255 * grain_strength, img.shape).astype(np.float32)
        img += noise

    # Basic glitch/shake: occasional RGB channel offsets
    if glitch and random.random() < 0.08:
        shift = random.randint(-10, 10)
        b, g, r = cv2.split(img.astype(np.uint8))
        r = np.roll(r, shift, axis=1)
        b = np.roll(b, -shift, axis=0)
        img = cv2.merge([b, g, r]).astype(np.float32)

    return np.clip(img, 0, 255).astype(np.uint8)


def make_ken_burns_image_clip(path: str, duration: float, zoom_intensity: float) -> ImageClip:
    clip = ImageClip(path).set_duration(duration)
    clip = fit_clip_to_vertical(clip)

    # Gentle zoom in/out + slight pan
    zoom_start = 1.0
    zoom_end = 1.06 * zoom_intensity
    x_drift = random.randint(-30, 30)
    y_drift = random.randint(-40, 40)

    def kb_transform(get_frame, t):
        frame = get_frame(t)
        h, w = frame.shape[:2]
        z = zoom_start + (zoom_end - zoom_start) * (t / max(duration, 1e-6))
        nw, nh = int(w * z), int(h * z)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_CUBIC)

        x1 = max(0, (nw - w) // 2 + int(x_drift * (t / max(duration, 1e-6))))
        y1 = max(0, (nh - h) // 2 + int(y_drift * (t / max(duration, 1e-6))))
        x1 = min(x1, max(0, nw - w))
        y1 = min(y1, max(0, nh - h))
        out = resized[y1:y1 + h, x1:x1 + w]
        if out.shape[0] != h or out.shape[1] != w:
            out = cv2.resize(out, (w, h))
        return out

    return clip.fl(kb_transform)


def load_video_clip(path: str, cut_duration: float, speed_factor: float):
    clip = VideoFileClip(path)
    clip = fit_clip_to_vertical(clip)

    # Pick a segment from longer clips to keep pacing trendy.
    final_duration = min(cut_duration, clip.duration)
    if clip.duration > final_duration + 0.1:
        start_max = max(0.0, clip.duration - final_duration)
        start = random.uniform(0, start_max)
        clip = clip.subclip(start, start + final_duration)
    else:
        clip = clip.subclip(0, final_duration)

    if speed_factor != 1.0:
        # moviepy vfx is accessible from clip.fx without extra imports
        clip = clip.fx(vfx.speedx, factor=speed_factor)

    return clip


def create_text_card(
    text: str,
    duration: float,
    size: Tuple[int, int] = TARGET_SIZE,
    font_size: int = 74,
) -> ImageClip:
    """Generate modern bold text overlay via PIL (avoids ImageMagick dependency)."""
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Try common bold fonts, fallback to default.
    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    font = None
    for fp in font_candidates:
        if os.path.exists(fp):
            font = ImageFont.truetype(fp, font_size)
            break
    if font is None:
        font = ImageFont.load_default()

    wrapped = textwrap.fill(text, width=22)
    bbox = draw.multiline_textbbox((0, 0), wrapped, font=font, spacing=12)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (w - tw) // 2
    y = int(h * 0.72)

    # Stroke + text for TikTok-like pop readability
    draw.multiline_text(
        (x, y),
        wrapped,
        font=font,
        fill=(255, 255, 255, 255),
        stroke_width=5,
        stroke_fill=(0, 0, 0, 180),
        align="center",
        spacing=12,
    )

    np_img = np.array(img)
    return ImageClip(np_img).set_duration(duration)


def loop_or_trim_audio(audio_path: str, target_duration: float) -> AudioFileClip:
    audio = AudioFileClip(audio_path)
    if audio.duration >= target_duration:
        return audio.subclip(0, target_duration)

    loops = int(math.ceil(target_duration / max(audio.duration, 0.01)))
    pieces = [audio] * loops
    # Audio concatenation without extra third-party imports:
    from moviepy.audio.AudioClip import concatenate_audioclips

    looped = concatenate_audioclips(pieces)
    return looped.subclip(0, target_duration)


def estimate_cut_duration(theme_cfg: Dict, adjustments: Dict) -> float:
    lo, hi = theme_cfg["cut_range"]
    base = random.uniform(lo, hi)
    return max(1.2, base / adjustments["speed_factor"])


def add_transition(clip, idx: int, use_glitch: bool):
    # Mix of fast fade and occasional visual glitch trend
    fade_t = 0.22
    if use_glitch and idx % 4 == 0:
        fade_t = 0.12
    return clip.crossfadein(fade_t)


def build_vlog(
    media_files: List[str],
    theme: str,
    audio_path: str,
    output_path: str,
    custom_prompt: str,
):
    theme_cfg = dict(THEME_PRESETS[theme])
    adjustments = parse_prompt_adjustments(theme_cfg, custom_prompt)
    grade_style = adjustments["custom_grade"]

    text_pool = list(theme_cfg["default_text"])
    if custom_prompt:
        text_pool.insert(0, custom_prompt[:60])
    if adjustments["emotion_text"]:
        text_pool.extend(["core memory", "little moments, big feelings 💫"])

    assembled_clips = []
    text_overlays = []

    print("\n⚠️ Copyright notice: Viral TikTok sounds can be copyrighted and may be muted.")
    print("   Use licensed audio for commercial/public posting. Personal-use edits are safest.\n")
    print(f"Theme: {theme}")
    print(f"Suggested audio mood: {theme_cfg['audio_suggestion']}")

    for idx, path in enumerate(tqdm(media_files, desc="Building timeline", unit="clip")):
        ext = os.path.splitext(path.lower())[1]
        try:
            if ext in SUPPORTED_IMAGE_EXTS:
                duration = estimate_cut_duration(theme_cfg, adjustments) * adjustments["image_duration_scale"]
                clip = make_ken_burns_image_clip(path, duration=duration, zoom_intensity=adjustments["zoom_intensity"])
            else:
                duration = estimate_cut_duration(theme_cfg, adjustments)
                clip = load_video_clip(path, cut_duration=duration, speed_factor=adjustments["speed_factor"])

            # Apply grade frame-by-frame
            clip = clip.fl_image(
                lambda f: apply_color_grade(
                    f,
                    grade=grade_style,
                    vignette_strength=theme_cfg["vignette"],
                    grain_strength=theme_cfg["grain_strength"] + adjustments["extra_grain"],
                    glitch=adjustments["use_glitch"],
                )
            )

            clip = add_transition(clip, idx, adjustments["use_glitch"])
            assembled_clips.append(clip)
        except Exception as e:
            print(f"Skipping media due to error: {path}\n  -> {e}")
            continue

    if not assembled_clips:
        raise RuntimeError("No clips were successfully processed.")

    final = concatenate_videoclips(assembled_clips, method="compose", padding=-0.16)

    # Beat-timed text pops every ~2-4 seconds based on theme energy/prompt.
    beat_step = 2.2 if theme_cfg["energy"] == "high" else 3.2
    if adjustments["speed_factor"] > 1.1:
        beat_step = max(1.8, beat_step - 0.6)

    t = 0.45
    while t < final.duration - 0.5:
        label = random.choice(text_pool)
        txt_dur = 1.1 if adjustments["speed_factor"] > 1.1 else 1.5
        txt = create_text_card(label, duration=txt_dur).set_start(t)
        text_overlays.append(txt)
        t += random.uniform(beat_step, beat_step + 1.0)

    composite = CompositeVideoClip([final] + text_overlays, size=TARGET_SIZE).set_fps(FPS)

    # Audio fit
    try:
        fitted_audio = loop_or_trim_audio(audio_path, composite.duration)
        composite = composite.set_audio(fitted_audio)
    except Exception as e:
        print(f"Audio load failed ({e}). Exporting silent video.")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    composite.write_videofile(
        output_path,
        codec="libx264",
        audio_codec="aac",
        fps=FPS,
        threads=4,
        preset="medium",
    )

    # Cleanup
    composite.close()
    for c in assembled_clips:
        c.close()


def main():
    args = parse_args()

    prompt = args.custom
    if not prompt:
        user_prompt = input(
            "Optional AI-style tweak prompt (e.g., 'more emotional and slow-motion heavy'): "
        ).strip()
        prompt = user_prompt

    media = collect_media(args.folder, args.order, args.max_items)
    print(f"Found {len(media)} media files in: {args.folder}")

    build_vlog(
        media_files=media,
        theme=args.theme,
        audio_path=args.audio_path,
        output_path=args.output,
        custom_prompt=prompt,
    )

    print(f"\nDone! Your TikTok travel vlog is exported to: {args.output}")


if __name__ == "__main__":
    main()
