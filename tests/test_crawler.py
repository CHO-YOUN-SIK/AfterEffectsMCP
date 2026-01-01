import pytest

from server import crawler


SAMPLE_HTML = """
<html>
  <head>
    <meta property="og:title" content="Sample Product" />
    <meta property="og:description" content="Short description for testing." />
    <meta property="og:image" content="http://global.amoremall.com/images/hero.jpg" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Sample Product Name",
        "description": "Line one\\nLine two continues here.\\n\\nBullet A\\nBullet B",
        "brand": {"@type": "Brand", "name": "BrandName"},
        "sku": "SKU-123",
        "image": [
          "//global.amoremall.com/images/img1.jpg",
          "https://global.amoremall.com/images/img2.jpg#frag"
        ],
        "offers": {
          "@type": "Offer",
          "price": "12.34",
          "priceCurrency": "USD"
        }
      }
    </script>
  </head>
  <body>
    <img src="https://global.amoremall.com/images/img3.jpg" />
  </body>
</html>
"""


def test_extract_product_data_parses_core_fields():
    data = crawler.extract_product_data(SAMPLE_HTML, "https://example.com/p/1")

    assert data["name"] == "Sample Product Name"
    assert data["brand"] == "BrandName"
    assert data["sku"] == "SKU-123"
    assert data["price"] == "12.34"
    assert data["currency"] == "USD"
    assert data["url"] == "https://example.com/p/1"


def test_benefits_split_is_clean():
    data = crawler.extract_product_data(SAMPLE_HTML, "https://example.com/p/1")
    benefits = data["benefits"]

    assert benefits
    assert all(len(item) >= 8 for item in benefits)
    assert all(len(item) <= 160 for item in benefits)


def test_image_urls_normalized():
    data = crawler.extract_product_data(SAMPLE_HTML, "https://example.com/p/1")
    images = data["images"]

    assert images
    assert all(url.startswith("https://") for url in images)
    assert all("#" not in url for url in images)


def test_fetch_html_rejects_invalid_url():
    with pytest.raises(ValueError):
        crawler.fetch_html("ftp://example.com")
