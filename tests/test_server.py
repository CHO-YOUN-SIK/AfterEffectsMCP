import importlib.util
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1] / "server"
sys.path.insert(0, str(SERVER_DIR))

spec = importlib.util.spec_from_file_location("server_module", SERVER_DIR / "server.py")
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)


@pytest.fixture
def client():
    server_module.app.testing = True
    return server_module.app.test_client()


def test_crawl_product_success(client, monkeypatch):
    sample = {
        "url": "https://example.com/p/1",
        "name": "Sample",
        "description": "Desc",
        "price": "1.00",
        "currency": "USD",
        "brand": "Brand",
        "sku": "SKU",
        "benefits": ["A", "B"],
        "images": ["https://example.com/a.jpg"],
    }

    monkeypatch.setattr(server_module, "crawl_product_page", lambda url: sample)

    res = client.post("/crawl-product", json={"url": "https://example.com/p/1"})
    data = res.get_json()

    assert res.status_code == 200
    assert data["status"] == "success"
    assert data["product"]["name"] == "Sample"


def test_crawl_product_missing_url(client):
    res = client.post("/crawl-product", json={})
    data = res.get_json()

    assert res.status_code == 400
    assert data["error"] == "Missing product URL"


def test_generate_media_requires_prompt(client):
    res = client.post("/generate-media", json={"type": "image"})
    data = res.get_json()

    assert res.status_code == 400
    assert data["status"] == "error"
