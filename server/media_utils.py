import os
import time
from datetime import datetime, timedelta
from io import BytesIO

import requests

ALLOWED_SCHEMES = ("http://", "https://")
MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024

# Pillow는 이미지 리사이즈/크롭에 사용됩니다.
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False


def ensure_temp_dir(base_dir):
    """임시 미디어 파일을 저장할 폴더를 준비합니다."""
    temp_dir = os.path.join(base_dir, "temp_images")
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def cleanup_old_images(temp_dir, hours=24):
    """오래된 임시 파일을 정리합니다(기본 24시간)."""
    try:
        now = datetime.now()
        for filename in os.listdir(temp_dir):
            filepath = os.path.join(temp_dir, filename)
            if os.path.isfile(filepath):
                file_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                if now - file_modified > timedelta(hours=hours):
                    os.remove(filepath)
                    print(f"[INFO] Removed old temp file: {filename}")
    except Exception as exc:
        print(f"[ERROR] Failed to cleanup temp files: {exc}")


def download_and_prepare_media(url, media_type, temp_dir):
    """외부 URL에서 미디어를 받아 로컬에 저장하고, 이미지면 1920x1080으로 정리합니다."""
    if not url or not isinstance(url, str):
        raise ValueError("URL이 비어 있습니다.")
    if not url.startswith(ALLOWED_SCHEMES):
        raise ValueError("URL은 http/https로 시작해야 합니다.")
    if media_type not in ("image", "video"):
        raise ValueError("media_type은 image 또는 video여야 합니다.")
    if not os.path.isdir(temp_dir):
        os.makedirs(temp_dir, exist_ok=True)

    print(f"[INFO] Download start: {url}")
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise RuntimeError("미디어 다운로드 요청에 실패했습니다.") from exc

    content_type = response.headers.get("Content-Type", "").lower()
    if media_type == "image" and "image" not in content_type:
        raise RuntimeError(f"이미지 요청인데 Content-Type이 올바르지 않습니다: {content_type}")
    if media_type == "video" and "video" not in content_type:
        raise RuntimeError(f"영상 요청인데 Content-Type이 올바르지 않습니다: {content_type}")

    content_length = response.headers.get("Content-Length")
    if content_length and int(content_length) > MAX_DOWNLOAD_BYTES:
        raise RuntimeError("다운로드 파일이 너무 큽니다.")

    timestamp = int(time.time())

    if media_type == "image":
        if not PILLOW_AVAILABLE:
            raise Exception("Pillow is required. Run: pip install pillow")

        # 다운로드한 이미지를 열고, 색상 모드를 RGB로 통일합니다.
        img = Image.open(BytesIO(response.content))
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 1920x1080 비율에 맞추기 위해 가장 긴 축을 기준으로 리사이즈합니다.
        target_ratio = 1920 / 1080
        img_ratio = img.width / img.height

        if img_ratio > target_ratio:
            new_height = 1080
            new_width = int(img.width * (1080 / img.height))
        else:
            new_width = 1920
            new_height = int(img.height * (1920 / img.width))

        img = img.resize((new_width, new_height), Image.LANCZOS)

        # 중앙 기준으로 1920x1080 크롭합니다.
        left = (new_width - 1920) // 2
        top = (new_height - 1080) // 2
        img = img.crop((left, top, left + 1920, top + 1080))

        filename = f"downloaded_{timestamp}.jpg"
        filepath = os.path.join(temp_dir, filename)
        img.save(filepath, "JPEG", quality=95)
        print(f"[INFO] Image saved: {filename}")
    else:
        # 영상은 그대로 파일로 저장합니다.
        filename = f"downloaded_{timestamp}.mp4"
        filepath = os.path.join(temp_dir, filename)

        total = 0
        with open(filepath, "wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    total += len(chunk)
                    if total > MAX_DOWNLOAD_BYTES:
                        raise RuntimeError("다운로드 파일이 너무 큽니다.")
                    handle.write(chunk)
        print(f"[INFO] Video saved: {filename}")

    return filename, filepath
