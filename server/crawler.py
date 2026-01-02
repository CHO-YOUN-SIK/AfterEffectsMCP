import requests
from bs4 import BeautifulSoup
import os
import re
from urllib.parse import urljoin, urlparse

class ProductCrawler:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def crawl_page(self, url, temp_dir):
        """
        URL에서 제품 정보(이미지, 텍스트)를 추출하여 다운로드합니다.
        """
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 1. 정보 추출
            title = self._extract_title(soup)
            description = self._extract_description(soup)
            price = self._extract_price(soup)
            
            # 2. 이미지 추출 및 다운로드
            images = self._extract_images(soup, url, temp_dir)
            
            return {
                "status": "success",
                "title": title,
                "description": description,
                "price": price,
                "images": images  # 로컬 파일 경로 리스트
            }
            
        except requests.exceptions.RequestException as e:
            return {"status": "error", "message": f"네트워크 오류: {str(e)}"}
        except Exception as e:
            return {"status": "error", "message": f"크롤링 오류: {str(e)}"}

    def _extract_title(self, soup):
        # 1. 아모레몰/Shopify 전용 선택자 우선
        selectors = [
            'h1.product__title',        # Shopify standard
            'h1.product-single__title', # Shopify standard
            '.product-meta__title',     # 테마 변형
            'h1'                        # Fallback
        ]
        
        for selector in selectors:
            tag = soup.select_one(selector)
            if tag:
                return tag.get_text(strip=True)
                    
        return soup.title.string if soup.title else "제목 없음"

    def _extract_description(self, soup):
        # 1. 아모레몰 상세 설명 영역
        selectors = [
            '.product__description',    # Shopify standard
            '.product-single__description',
            '.rte',                     # Rich Text Editor content
            'meta[name="description"]'
        ]
        
        for selector in selectors:
            if 'meta' in selector:
                tag = soup.select_one(selector)
                if tag and tag.get('content'):
                    return tag['content'].strip()
            else:
                tag = soup.select_one(selector)
                if tag:
                    # 설명이 너무 길면 앞부분만 자름 (Gemini Context 제한 고려)
                    return tag.get_text(strip=True)[:500] + "..."
            
        return ""

    def _extract_price(self, soup):
        # 1. 아모레몰 가격 (할인가 우선)
        selectors = [
            '.price-item--sale',        # Shopify standard (할인가)
            '.price-item--regular',     # Shopify standard (정가)
            '.price__sale .price-item',
            '.product__price',
            '[data-product-price]'
        ]
        
        for selector in selectors:
            tag = soup.select_one(selector)
            if tag:
                return tag.get_text(strip=True)
        return ""

    def _extract_images(self, soup, base_url, temp_dir):
        """이미지를 찾아 다운로드하고 로컬 경로 리스트 반환"""
        image_urls = []
        saved_paths = []
        
        # 1. 대표 이미지 (OG Image) - 가장 고화질일 확률 높음
        og_img = soup.select_one('meta[property="og:image"]')
        if og_img and og_img.get('content'):
            image_urls.append(og_img['content'])
            
        # 2. 제품 상세 이미지 (Shopify 썸네일/메인 이미지)
        # 보통 .product__media-item img 또는 .product-single__media img
        media_selectors = [
            '.product__media img', 
            '.product-single__media img',
            '.product-gallery__image'
        ]
        
        for selector in media_selectors:
            for img in soup.select(selector):
                src = img.get('src') or img.get('data-src') or img.get('data-srcset')
                if not src: continue
                
                # Shopify CDN URL 보정 (//cdn.shopify.com... -> https://cdn...)
                if src.startswith('//'):
                    src = 'https:' + src
                
                # 썸네일(_small, _compact 등) 대신 원본(_original, _1024x1024) 유추 시도
                # (일단은 원본 URL 그대로 수집하되, 중복 제거)
                
                full_url = urljoin(base_url, src)
                if full_url not in image_urls:
                    image_urls.append(full_url)
        
        # 3. Fallback: 본문의 큰 이미지
        if not image_urls:
            for img in soup.select('img'):
                src = img.get('src')
                if not src: continue
                if src.startswith('//'): src = 'https:' + src
                full_url = urljoin(base_url, src)
                if full_url not in image_urls:
                    image_urls.append(full_url)

        # 다운로드 (최대 5개)
        count = 0
        for i, img_url in enumerate(image_urls[:5]):
            try:
                # 쿼리스트링 제거 (?v=...)
                clean_url = img_url.split('?')[0]
                ext = os.path.splitext(clean_url)[1]
                if not ext: ext = '.jpg'
                
                filename = f"product_img_{i}{ext}"
                filepath = os.path.join(temp_dir, filename)
                
                # 다운로드
                img_data = requests.get(img_url, headers=self.headers, timeout=5).content
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                    
                saved_paths.append(filepath)
                count += 1
                
            except Exception as e:
                print(f"[Warning] 이미지 다운로드 실패 ({img_url}): {e}")
                
        return saved_paths

# 전역 인스턴스
crawler_instance = ProductCrawler()

def crawl_product_page(url, temp_dir):
    return crawler_instance.crawl_page(url, temp_dir)
