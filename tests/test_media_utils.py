import io

import pytest
from PIL import Image

from server import media_utils


class DummyResponse:
    def __init__(self, content=b"", headers=None, status=200):
        self.content = content
        self.headers = headers or {}
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP error")

    def iter_content(self, chunk_size=8192):
        stream = io.BytesIO(self.content)
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            yield chunk


def _make_image_bytes():
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_download_image_success(monkeypatch, tmp_path):
    image_bytes = _make_image_bytes()
    response = DummyResponse(
        content=image_bytes,
        headers={"Content-Type": "image/jpeg", "Content-Length": str(len(image_bytes))},
    )

    monkeypatch.setattr(media_utils.requests, "get", lambda *args, **kwargs: response)

    filename, filepath = media_utils.download_and_prepare_media(
        "https://example.com/img.jpg", "image", str(tmp_path)
    )

    assert filename.endswith(".jpg")
    assert tmp_path.joinpath(filename).exists()
    assert filepath.endswith(".jpg")


def test_download_video_rejects_wrong_content_type(monkeypatch, tmp_path):
    response = DummyResponse(
        content=b"video",
        headers={"Content-Type": "image/jpeg", "Content-Length": "5"},
    )

    monkeypatch.setattr(media_utils.requests, "get", lambda *args, **kwargs: response)

    with pytest.raises(RuntimeError):
        media_utils.download_and_prepare_media(
            "https://example.com/video.mp4", "video", str(tmp_path)
        )


def test_download_rejects_too_large(monkeypatch, tmp_path):
    response = DummyResponse(
        content=b"x" * 10,
        headers={"Content-Type": "video/mp4", "Content-Length": str(9999999)},
    )

    monkeypatch.setattr(media_utils.requests, "get", lambda *args, **kwargs: response)
    monkeypatch.setattr(media_utils, "MAX_DOWNLOAD_BYTES", 1)

    with pytest.raises(RuntimeError):
        media_utils.download_and_prepare_media(
            "https://example.com/video.mp4", "video", str(tmp_path)
        )
