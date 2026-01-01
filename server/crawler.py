import json
import re
from urllib.parse import urlparse, urlunparse

import requests
from bs4 import BeautifulSoup


# 웹사이트가 정상 HTML을 돌려주도록 최신 User-Agent를 사용합니다.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)
ALLOWED_SCHEMES = ("http://", "https://")


def fetch_html(url, timeout=20):
    """제품 페이지의 HTML을 다운로드합니다."""
    if not url or not isinstance(url, str):
        raise ValueError("URL이 비어 있습니다.")
    if not url.startswith(ALLOWED_SCHEMES):
        raise ValueError("URL은 http/https로 시작해야 합니다.")

    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise RuntimeError("HTML 다운로드에 실패했습니다.") from exc

    html = response.text or ""
    if not html.strip():
        raise RuntimeError("빈 HTML이 반환되었습니다.")
    return html


def _unique(items):
    """중복을 제거하되, 원래 순서는 유지합니다."""
    seen = set()
    result = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _extract_json_ld(soup):
    """페이지에 포함된 JSON-LD 스크립트를 전부 모읍니다."""
    nodes = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.text or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        nodes.append(data)
    return nodes


def _find_product_nodes(payload):
    """JSON-LD 안에서 Product 타입만 찾아냅니다."""
    results = []
    if isinstance(payload, dict):
        if payload.get("@type") == "Product":
            results.append(payload)
        if "@graph" in payload and isinstance(payload["@graph"], list):
            for item in payload["@graph"]:
                results.extend(_find_product_nodes(item))
    elif isinstance(payload, list):
        for item in payload:
            results.extend(_find_product_nodes(item))
    return results


def _split_benefits(text, limit=5):
    """설명을 줄 단위로 쪼개서 베네핏 목록을 만듭니다."""
    if not text:
        return []
    lines = _normalize_lines(text)
    sentences = _expand_sentences(lines)
    return _pick_benefits(sentences, limit)


def _normalize_lines(text):
    """줄바꿈으로 끊긴 문장을 최대한 자연스럽게 이어 붙입니다."""
    raw_lines = [line.strip() for line in text.replace("\r", "\n").split("\n")]
    raw_lines = [line for line in raw_lines if line]

    merged = []
    for line in raw_lines:
        if not merged:
            merged.append(line)
            continue

        prev = merged[-1]
        prev_end = prev[-1] if prev else ""
        # 이전 줄이 문장 끝(.!?)이 아니고, 다음 줄이 소문자로 시작하면 이어 붙입니다.
        if prev_end not in ".!?" and re.match(r"^[a-z]", line):
            merged[-1] = f"{prev} {line}"
        else:
            merged.append(line)
    return merged


def _expand_sentences(lines):
    """긴 문장을 문장 단위로 쪼개 후보 목록을 늘립니다."""
    sentences = []
    for line in lines:
        # 너무 긴 줄은 문장 단위로 분리합니다.
        if len(line) > 140:
            parts = re.split(r"(?<=[.!?])\s+", line)
            sentences.extend([p.strip() for p in parts if p.strip()])
        else:
            sentences.append(line)
    return sentences


def _pick_benefits(candidates, limit):
    """길이 기준으로 베네핏 후보를 정리합니다."""
    cleaned = []
    for item in candidates:
        piece = item.strip()
        if len(piece) < 8:
            continue
        if len(piece) > 160:
            continue
        cleaned.append(piece)
        if len(cleaned) >= limit:
            break
    return cleaned


def _normalize_image_url(url):
    """이미지 URL을 https로 통일하고, fragment를 제거합니다."""
    if not url:
        return ""
    cleaned = url.strip()
    if cleaned.startswith("//"):
        cleaned = "https:" + cleaned
    if cleaned.startswith("http://"):
        cleaned = "https://" + cleaned[len("http://"):]

    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https"):
        return ""

    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
    )


def extract_product_data(html, url):
    """HTML을 파싱해 제품 정보 구조로 정리합니다."""
    soup = BeautifulSoup(html, "html.parser")

    data = {
        "url": url,
        "name": "",
        "description": "",
        "price": "",
        "currency": "",
        "brand": "",
        "sku": "",
        "benefits": [],
        "images": [],
    }

    # 1) JSON-LD는 제품 메타데이터가 정리돼 있는 경우가 많습니다.
    json_ld_nodes = _extract_json_ld(soup)
    product_nodes = []
    for node in json_ld_nodes:
        product_nodes.extend(_find_product_nodes(node))

    if product_nodes:
        product = product_nodes[0]
        data["name"] = product.get("name", "") or data["name"]
        data["description"] = product.get("description", "") or data["description"]
        data["sku"] = product.get("sku", "") or data["sku"]

        brand = product.get("brand")
        if isinstance(brand, dict):
            data["brand"] = brand.get("name", "")
        elif isinstance(brand, str):
            data["brand"] = brand

        images = product.get("image", [])
        if isinstance(images, str):
            images = [images]
        data["images"].extend(images)

        offers = product.get("offers", {})
        if isinstance(offers, list) and offers:
            offers = offers[0]
        if isinstance(offers, dict):
            data["price"] = str(offers.get("price", "")) or data["price"]
            data["currency"] = offers.get("priceCurrency", "") or data["currency"]

    # 2) JSON-LD가 부족하면 Open Graph 메타를 사용합니다.
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        data["name"] = data["name"] or og_title["content"].strip()

    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        data["description"] = data["description"] or og_desc["content"].strip()

    # 3) Open Graph 이미지 + img 태그에서 후보 이미지 목록을 모읍니다.
    og_images = [
        tag.get("content")
        for tag in soup.find_all("meta", property="og:image")
        if tag.get("content")
    ]

    img_tags = soup.find_all("img")
    img_sources = []
    for tag in img_tags:
        src = tag.get("src") or tag.get("data-src") or tag.get("data-original")
        if not src:
            continue
        img_sources.append(src)

    normalized_images = []
    for img in data["images"] + og_images + img_sources:
        normalized = _normalize_image_url(img)
        if normalized:
            normalized_images.append(normalized)

    all_images = _unique(normalized_images)
    filtered_images = []
    for img in all_images:
        # 아이콘/추적 픽셀을 줄이기 위해 도메인을 제한합니다.
        if "cdn.shopify.com" in img or "amoremall" in img:
            filtered_images.append(img)
        if len(filtered_images) >= 12:
            break

    data["images"] = _unique(filtered_images)[:12]

    # 4) 설명이 비어 있으면 일반 메타 설명을 사용합니다.
    if not data["description"]:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            data["description"] = meta_desc["content"].strip()

    # 5) 설명을 기반으로 베네핏 후보를 만듭니다.
    data["benefits"] = _split_benefits(data["description"])

    return data


def crawl_product_page(url):
    """URL을 받아 HTML 다운로드 → 제품 정보 추출까지 한 번에 수행합니다."""
    html = fetch_html(url)
    return extract_product_data(html, url)
