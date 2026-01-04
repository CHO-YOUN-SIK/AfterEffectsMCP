# AfterEffects MCP (Model Context Protocol) Assistant

**AfterEffects MCP**는 Google Gemini 2.0 Flash AI 모델을 활용하여 After Effects 작업을 혁신적으로 자동화하는 CEP 확장 프로그램입니다. 사용자는 자연어로 명령을 내리거나, 웹 기사/쇼핑몰 URL을 분석하여 자동으로 영상을 제작할 수 있습니다.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-blue)
![After Effects](https://img.shields.io/badge/Host-After%20Effects-purple)

## 🚀 주요 기능 (Key Features)

### 1. 💬 AI 기반 자연어 제어
- "빨간색 공이 튀어오르는 애니메이션 만들어줘", "모든 레이어의 투명도를 50%로 줄여줘" 등 자연어로 명령하면, AI가 즉시 실행 가능한 **ExtendScript(.jsx)** 코드를 생성하고 실행합니다.
- 복잡한 표현식(Expression)이나 키프레임 제어도 손쉽게 처리합니다.

### 2. 🌐 스마트 URL 분석 & 소스화 (Smart Crawling)
- 뉴스 기사, 블로그, 쇼핑몰 상세 페이지 URL을 입력하면, 자동으로 **본문 내용을 요약**하고 **이미지를 다운로드**합니다.
- 다운로드된 이미지는 즉시 패널에 로드되어, "이 상품 정보로 광고 영상 만들어줘" 같은 복합 명령 수행이 가능합니다.

### 3. 🛠️ 강력한 서버 관리 (Robust Server Management)
- **Deadlock-Free Startup**: 서버 시작 시 발생할 수 있는 포트 충돌이나 무한 로딩 문제를 해결하기 위한 자체적인 헬스 체크 및 교착 상태 방지 로직이 탑재되어 있습니다.
- **Background Flask Server**: 별도의 터미널 작업 없이 패널 실행 시 Python 백엔드 서버가 자동으로 구동됩니다.

### 4. ⚡ 사용자 중심 워크플로우 (Setup-First Workflow)
- **초기 설정 모달**: 앱 실행 시 API Key와 초기 URL을 입력받는 직관적인 모달 인터페이스를 제공하여 빠른 작업 시작을 돕습니다.
- **실시간 로그 및 상태 표시**: 서버 연결 상태와 작업 진행 상황을 시각적으로 명확하게 보여줍니다.

---

## 🏗️ 프로젝트 구조 (Architecture)

```
AfterEffectsMCP/
├── client/                 # CEP 패널 프론트엔드
│   ├── index.html         # 메인 UI
│   ├── main.js            # 메인 로직 (이벤트 핸들링, 초기화)
│   ├── css/               # 스타일 (Glassmorphism 디자인)
│   └── js/                # 모듈화된 로직
│       ├── server_manager.js  # Python 서버 생명주기 관리
│       ├── ui_manager.js      # UI 렌더링 및 모달 제어
│       └── utils.js           # 유틸리티 함수
├── server/                 # Python 백엔드 (Flask)
│   ├── server.py          # 메인 API 서버
│   ├── gemini_service.py  # Gemini AI 연동 로직
│   ├── crawler.py         # 웹 크롤링 및 이미지 처리
│   └── enhanced_prompt.txt # 시스템 프롬프트
├── host/                   # After Effects 호스트 스크립트
│   └── index.jsx          # AE 내부 실행용 헬퍼 스크립트
└── CSXS/                   # CEP 매니페스트 설정
    └── manifest.xml
```

---

##  설치 및 실행 (Installation)

### 전제 조건
- Adobe After Effects 2024 이상
- Node.js & npm
- Python 3.10 이상

### 1. 패키지 설치
프로젝트 루트에서 의존성을 설치합니다. (가상환경 권장)

```bash
# Python 가상환경 생성 및 패키지 설치 (Windows)
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt  # (flask, google-generativeai, requests, bs4 등)

# 필수 라이브러리 직접 설치 예시
pip install flask flask-cors google-generativeai python-dotenv requests beautifulsoup4
```

### 2. 확장 프로그램 배치
이 폴더 전체를 Adobe CEP Extensions 경로에 복사하거나 심볼릭 링크를 생성합니다.
- **Windows**: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\AfterEffectsMCP`
- **Mac**: `/Library/Application Support/Adobe/CEP/extensions/AfterEffectsMCP`

### 3. 레지스트리 설정 (디버그 모드)
서명되지 않은 확장을 실행하려면 PlayerDebugMode를 활성화해야 합니다.
- **Windows (Regedit)**: `HKEY_CURRENT_USER\Software\Adobe\CSXS.11` (버전에 맞게) -> `PlayerDebugMode` (String) = `1`

### 4. 실행
After Effects를 실행하고 **Window > Extensions > AfterEffects MCP**를 클릭합니다.
- 패널이 열리면 자동으로 Python 서버가 시작됩니다.
- 초기 설정 모달에 Gemini API Key를 입력하고 시작하세요.

---

## 📄 라이선스
This project is for educational and productivity purposes.
Designed by **Antigravity**.

