# Why This Stack (Korean Notes)

이 문서는 "왜 이 라이브러리를 선택했는지"와 "각 파일이 왜 필요한지"를
초보자도 이해할 수 있게 설명합니다. 모든 설명은 한글 기준입니다.

---

## File: `server/crawler.py`
### 왜 이 파일이 필요한가?
제품 상세 페이지 URL을 입력하면 제품명/가격/이미지 같은 정보를 자동으로
수집해야 합니다. 이 파일은 **HTML 다운로드 + 파싱**만 전담합니다.

### 사용 라이브러리와 선택 이유
- `requests`
  - 역할: URL에서 HTML을 다운로드하는 HTTP 클라이언트
  - 왜 선택했나: 사용법이 단순하고 안정적이며 자료가 많음
  - 대안: `httpx`가 있으나, 현재 규모에선 `requests`가 더 단순
- `beautifulsoup4` (`bs4`)
  - 역할: HTML 안에서 필요한 태그를 찾고 정보를 추출
  - 왜 선택했나: HTML이 조금 깨져 있어도 잘 처리하고 초보자에게 읽기 쉬움
  - 대안: `lxml`이나 `parsel`이 있지만 설정/학습이 더 복잡함
- `json`, `re`
  - 역할: JSON-LD 파싱, 텍스트를 베네핏 문장으로 분리
  - 왜 선택했나: 파이썬 기본 제공 라이브러리

### 주요 함수와 기능
- `fetch_html(url, timeout=20)`
  - URL에서 HTML을 다운로드합니다.
  - 특정 사이트가 기본 UA를 차단할 수 있어 최신 UA를 사용합니다.
- `_unique(items)`
  - 중복을 제거하면서 순서는 유지합니다.
  - 이미지 목록의 품질을 정리하기 위함입니다.
- `_extract_json_ld(soup)`
  - HTML 안의 JSON-LD 스크립트를 모읍니다.
  - 제품 정보가 구조화되어 있을 때 가장 신뢰도가 높습니다.
- `_find_product_nodes(payload)`
  - JSON-LD에서 `@type == "Product"`만 찾아냅니다.
  - 제품명/가격/브랜드를 안정적으로 얻기 위해 필요합니다.
- `_split_benefits(text, limit=5)`
  - 긴 설명 문장을 짧은 베네핏 문장으로 나눕니다.
  - 영상 컷 문구로 사용하기 위해 필요합니다.
- `extract_product_data(html, url)`
  - 제품 정보를 통합해서 하나의 구조로 정리합니다.
  - JSON-LD → OG 태그 → 일반 메타 순서로 보강합니다.
- `crawl_product_page(url)`
  - HTML 다운로드 + 제품 정보 추출을 한 번에 수행합니다.

---

## File: `server/media_utils.py`
### 왜 이 파일이 필요한가?
외부 이미지/영상 소스를 받아 AE에서 바로 쓸 수 있게 정리해야 합니다.
이 파일은 **다운로드 + 이미지 리사이즈/크롭 + 임시 파일 관리**를 담당합니다.

### 사용 라이브러리와 선택 이유
- `requests`
  - 역할: URL에서 이미지/영상 데이터를 스트리밍 다운로드
  - 왜 선택했나: 안정적이고 구현이 단순함
- `Pillow` (`PIL`)
  - 역할: 이미지 크기 조정, 색상 모드 변환, 크롭
  - 왜 선택했나: 이미지 처리에 가장 널리 쓰이고 배우기 쉬움
  - 대안: `opencv-python`도 가능하지만 의존성이 크고 복잡함
- `os`, `time`, `datetime`, `BytesIO`
  - 역할: 파일 경로 관리, 타임스탬프 생성, 오래된 파일 정리
  - 왜 선택했나: 표준 라이브러리로 충분함

### 주요 함수와 기능
- `ensure_temp_dir(base_dir)`
  - 임시 파일 저장 폴더를 만들고 경로를 반환합니다.
  - 다운로드 파일을 한 곳에서 관리하기 위해 필요합니다.
- `cleanup_old_images(temp_dir, hours=24)`
  - 일정 시간이 지난 임시 파일을 삭제합니다.
  - 디스크 공간 낭비를 막기 위해 필요합니다.
- `download_and_prepare_media(url, media_type, temp_dir)`
  - 미디어를 다운로드해 저장합니다.
  - 이미지라면 1920x1080으로 맞춰 AE 템플릿에 바로 사용 가능하게 합니다.

---

## File: `server/server.py`
### 왜 이 파일이 필요한가?
CEP 패널이 호출할 **API 창구**입니다. 크롤러/미디어 유틸/AI 호출을
하나의 서버에서 묶어 제공합니다.

### 사용 라이브러리와 선택 이유
- `Flask`
  - 역할: HTTP API 서버
  - 왜 선택했나: 가장 단순하고 학습 곡선이 낮음
  - 대안: `FastAPI`가 있지만, 현재 수준에선 Flask가 충분
- `google-generativeai`
  - 역할: Gemini 호출로 ExtendScript 코드 생성
  - 왜 선택했나: 공식 SDK라 안정적이고 예제가 많음
- `requests`
  - 역할: 네트워크 오류 처리 시 사용

### 주요 엔드포인트
- `POST /crawl-product`
  - 입력: `{ "url": "..." }`
  - 출력: 제품명/가격/이미지/설명 등 구조화 데이터
  - 필요 이유: URL을 입력하면 자동으로 데이터가 나와야 하기 때문
- `POST /chat`
  - 입력: `{ "apiKey": "...", "prompt": "..." }`
  - 출력: AE 실행용 ExtendScript 코드
  - 필요 이유: 자연어 명령을 실제 AE 코드로 바꿔야 하기 때문
- `POST /fetch-media`
  - 입력: `{ "source": "...", "query": "...", "type": "image|video" }`
  - 출력: 로컬 파일 경로
  - 필요 이유: 외부 미디어를 AE가 바로 읽을 수 있게 만들기 위해

---

## 이 코드가 필요한 이유(전체 요약)
- 제품 URL에서 정보를 자동으로 수집하기 위해 (crawler)
- 이미지를 AE용으로 정리하고 저장하기 위해 (media_utils)
- CEP 패널과 통신할 API를 제공하기 위해 (server)
- AI가 생성한 AE 스크립트를 실행하기 위해 (Gemini)

이렇게 분리하면 각 부분을 독립적으로 테스트/교체할 수 있어 유지보수가 쉬워집니다.
