import requests
from bs4 import BeautifulSoup
import os
import re
import json
from urllib.parse import urljoin, urlparse

class ProductCrawler:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8'
        }

    def crawl_page(self, url, temp_dir):
        """
        URL에서 제품 정보(이미지, 텍스트)를 추출하여 다운로드합니다.
        Shopify JSON-LD 및 메타 태그를 우선적으로 사용합니다.
        """
        print(f"[Crawler] Accessing URL: {url}")
        
        try:
            response = requests.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 데이터 컨테이너 초기화
            product_data = {
                "title": "",
                "description": "",
                "price": "",
                "images": []
            }

            # 1. JSON-LD 파싱 (가장 정확함)
            self._extract_from_json_ld(soup, product_data)
            
            # 2. 부족한 정보 Fallback (Meta tag, HTML parsing)
            if not product_data["title"]:
                product_data["title"] = self._extract_title(soup)
            
            if not product_data["description"]:
                product_data["description"] = self._extract_description(soup)
                
            if not product_data["price"]:
                product_data["price"] = self._extract_price(soup)
                
            # 3. 이미지 추출 및 다운로드
            # JSON-LD에 이미지가 있으면 그것을 우선, 없으면 HTML에서 추출
            if not product_data["images"]:
                image_urls = self._extract_image_urls_from_html(soup, url)
            else:
                image_urls = product_data["images"]
                # HTML에서도 추가로 찾아봄 (JSON-LD에 썸네일만 있는 경우 대비)
                extra_urls = self._extract_image_urls_from_html(soup, url)
                for u in extra_urls:
                    if u not in image_urls:
                        image_urls.append(u)

            # 이미지 다운로드 수행
            saved_paths = self._download_images(image_urls, temp_dir)
            
            print(f"[Crawler] Success! Title: {product_data['title']}, Images: {len(saved_paths)}")
            
            return {
                "status": "success",
                "title": product_data["title"],
                "description": product_data["description"],
                "price": product_data["price"],
                "images": saved_paths  # 로컬 파일 경로 리스트
            }
            
        except requests.exceptions.RequestException as e:
            print(f"[Crawler] Network Error: {e}")
            return {"status": "error", "message": f"네트워크 오류: {str(e)}"}
        except Exception as e:
            print(f"[Crawler] Error: {e}")
            return {"status": "error", "message": f"크롤링 오류: {str(e)}"}

    def _extract_from_json_ld(self, soup, data):
        """JSON-LD 스크립트 태그에서 제품 정보를 찾습니다."""
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                content = json.loads(script.string)
                # 단일 객체거나 리스트일 수 있음
                if isinstance(content, list):
                    items = content
                else:
                    items = [content]
                    
                for item in items:
                    if item.get('@type') == 'Product':
                        # 제목
                        if not data["title"] and item.get('name'):
                            data["title"] = item['name']
                        
                        # 설명
                        if not data["description"] and item.get('description'):
                            data["description"] = item['description'][:600] # 길이 제한가
                            
                        # 이미지 (단일 문자열 또는 리스트)
                        if item.get('image'):
                            imgs = item['image']
                            if isinstance(imgs, str):
                                data["images"].append(imgs)
                            elif isinstance(imgs, list):
                                data["images"].extend(imgs)
                                
                        # 가격 (offers 내부)
                        if not data["price"] and item.get('offers'):
                            offers = item['offers']
                            if isinstance(offers, list):
                                offers = offers[0]
                            if isinstance(offers, dict):
                                price = offers.get('price')
                                currency = offers.get('priceCurrency', 'KRW')
                                if price:
                                    data["price"] = f"{price} {currency}"
                                    
            except json.JSONDecodeError:
                continue
            except Exception as e:
                print(f"[Crawler] JSON-LD parse warning: {e}")
                continue

    def _extract_title(self, soup):
        selectors = ['h1.product__title', 'h1.product-single__title', '.product-meta__title', 'h1']
        for sel in selectors:
            tag = soup.select_one(sel)
            if tag: return tag.get_text(strip=True)
        return soup.title.string if soup.title else "Untitled Product"

    def _extract_description(self, soup):
        # 범용 블로그/기사 본문 셀렉터 추가
        selectors = [
            'article', '.article-body', '.post-content', '.entry-content', 
            '.product__description', '.product-single__description', '.rte', 
            'meta[name="description"]'
        ]
        text_content = ""
        
        for sel in selectors:
            if 'meta' in sel:
                tag = soup.select_one(sel)
                if tag and tag.get('content'): 
                    return tag['content'].strip()
            else:
                # 본문 텍스트 추출 (여러 태그가 걸릴 수 있으므로 가장 내용이 긴 것 선호하거나 다 합침)
                # 여기서는 첫 번째 매칭되는 본문 컨테이너를 사용
                tag = soup.select_one(sel)
                if tag:
                    text_content = tag.get_text(strip=True)
                    if len(text_content) > 50: # 너무 짧으면 무시하고 다음 셀렉터 시도
                        return text_content[:2000] # 길이 제한

        # 못 찾았으면 p 태그들을 긁어모음
        if not text_content:
            paragraphs = [p.get_text().strip() for p in soup.find_all('p') if len(p.get_text().strip()) > 30]
            if paragraphs:
                return ' '.join(paragraphs)[:2000]

        return ""

    def _extract_price(self, soup):
        selectors = ['.price-item--sale', '.price-item--regular', '[data-product-price]']
        for sel in selectors:
            tag = soup.select_one(sel)
            if tag: return tag.get_text(strip=True)
        return ""

    def _extract_image_urls_from_html(self, soup, base_url):
        urls = []
        
        # 1. OG Image
        og = soup.select_one('meta[property="og:image"]')
        if og and og.get('content'):
            urls.append(og['content'])
            
        # 2. General Images (크기 필터링은 다운로드 시 하면 좋음)
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src:
                # 상대 경로 처리
                full_url = urljoin(base_url, src)
                
                # 필터링
                if any(x in full_url.lower() for x in ['.svg', 'logo', 'icon', 'button']):
                    continue
                urls.append(full_url)
                    
        return list(dict.fromkeys(urls)) # 중복 제거 (순서 유지)

    def _download_images(self, urls, temp_dir):
        saved = []
        count = 0
        MAX_IMAGES = 5
        import time
        
        # 다운로드 폴더 생성
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        for url in urls:
            if count >= MAX_IMAGES: break
            
            # URL 정리
            clean_url = url.split('?')[0]
            if not clean_url.startswith('http'): continue
            
            try:
                # 확장자 추출
                ext = os.path.splitext(clean_url)[1].lower()
                if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
                    ext = '.jpg'
                    
                # 타임스탬프 추가로 덮어쓰기 방지
                filename = f"crawl_{int(time.time())}_{count}{ext}"
                filepath = os.path.join(temp_dir, filename)
                
                # 이미 존재하면 스킵? 아니면 덮어쓰기 (타임스탬프 있어서 덮어쓸 일 거의 없음)
                
                print(f"[Crawler] Downloading: {url}")
                resp = requests.get(url, headers=self.headers, timeout=10)
                
                # 너무 작은 이미지는 무시 (아이콘 등)
                if len(resp.content) < 5000: # 5KB 미만 무시
                    continue

                with open(filepath, 'wb') as f:
                    f.write(resp.content)
                
                saved.append(filepath)
                count += 1
                
            except Exception as e:
                print(f"[Crawler] Image download failed: {e}")
                
        return saved

# 전역 인스턴스
crawler_instance = ProductCrawler()

def crawl_product_page(url, temp_dir):
    return crawler_instance.crawl_page(url, temp_dir)
