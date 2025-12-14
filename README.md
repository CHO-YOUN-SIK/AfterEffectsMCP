# AfterEffectsMCP 🎬🤖

> Adobe After Effects를 AI로 제어하는 스마트 자동화 CEP 확장 프로그램

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시스템 요구사항](#-시스템-요구사항)
- [설치 방법](#-설치-방법)
- [사용 방법](#-사용-방법)
- [프로젝트 구조](#-프로젝트-구조)
- [문제 해결](#-문제-해결)
- [개발 가이드](#-개발-가이드)
- [라이선스](#-라이선스)

---

## 🎯 프로젝트 소개

**AfterEffectsMCP**는 Adobe After Effects와 Google Gemini AI를 결합하여, 자연어로 After Effects를 제어할 수 있게 해주는 혁신적인 확장 프로그램입니다.

### 왜 이 프로젝트를 만들었나요?

After Effects 스크립팅은 강력하지만 ExtendScript 문법을 익히기 어렵습니다. AfterEffectsMCP는 AI의 힘을 빌려 **자연어 명령만으로 복잡한 작업을 자동화**할 수 있게 해줍니다.

### 예시 사용 시나리오

```
사용자: "화면 중앙에 '안녕하세요' 텍스트 레이어 만들어줘"
AI: ✅ 텍스트 레이어 생성 코드 작성 완료
     → 사용자 확인 후 자동 실행
```

---

## ✨ 주요 기능

### 1. 🗣️ 자연어 기반 명령
- "레이어를 빨간색으로 바꿔줘"
- "선택한 레이어를 화면 중앙으로 이동"
- "3초마다 키프레임 추가해줘"

### 2. 🧠 컨텍스트 인식
- 현재 활성화된 컴포지션 정보 자동 수집
- 선택된 레이어 정보 파악
- 프로젝트 상태에 맞는 스크립트 생성

### 3. 🎨 AI 이미지 생성 통합 (실험적)
- "바다 배경 이미지 만들어서 넣어줘"
- 생성된 이미지 자동 임포트

### 4. 🔒 안전한 실행
- 코드 실행 전 미리보기 및 사용자 확인
- Undo Group 자동 래핑 (Ctrl+Z로 되돌리기 가능)
- 상세한 에러 메시지 및 복구 가이드

### 5. 🧹 자동 관리
- 24시간 이상 된 임시 파일 자동 정리
- Python 경로 자동 감지 (python, python3, py)
- 로컬스토리지 기반 API 키 저장

---

## 🛠️ 기술 스택

### Client (After Effects Panel)
- **HTML/CSS/JavaScript**: CEP 패널 UI
- **CEP (Common Extensibility Platform)**: Adobe 확장 프로그램 프레임워크
- **CSInterface.js**: Adobe와의 통신 라이브러리

### Host (After Effects Scripting)
- **ExtendScript (JavaScript ES3)**: After Effects 자동화 스크립트

### Server (AI Backend)
- **Python 3.x**: 백엔드 서버
- **Flask**: 웹 서버 프레임워크
- **Google Gemini API**: AI 코드 생성
- **Pillow**: 이미지 생성 (선택사항)

---

## 💻 시스템 요구사항

### 필수 요구사항
- **Adobe After Effects**: CC 2019 이상
- **Python**: 3.8 이상 (python, python3, 또는 py 명령어 사용 가능)
- **Google Gemini API Key**: [무료 발급 가능](https://makersuite.google.com/app/apikey)

### 권장 사양
- **OS**: Windows 10/11, macOS 10.14+
- **RAM**: 8GB 이상
- **인터넷**: 안정적인 연결 (API 통신용)

---

## 📦 설치 방법

### 1. Python 설치 확인

```bash
python --version
# 또는
python3 --version
```

Python이 없다면 [python.org](https://www.python.org/)에서 다운로드하세요.

### 2. 저장소 클론 또는 다운로드

```bash
git clone https://github.com/YOUR_USERNAME/AfterEffectsMCP.git
cd AfterEffectsMCP
```

### 3. Python 패키지 설치

```bash
cd server
pip install -r requirements.txt
```

**설치되는 패키지:**
- `flask`: 웹 서버
- `google-generativeai`: Gemini API
- `requests`: HTTP 요청
- `pillow`: 이미지 처리 (선택사항)

### 4. After Effects 확장 프로그램 설치

#### Windows
```
C:\Program Files\Common Files\Adobe\CEP\extensions\AfterEffectsMCP
```

#### macOS
```
/Library/Application Support/Adobe/CEP/extensions/AfterEffectsMCP
```

프로젝트 폴더 전체를 위 경로에 복사하거나 심볼릭 링크를 생성하세요.

**심볼릭 링크 생성 (권장):**

Windows (관리자 권한 PowerShell):
```powershell
New-Item -ItemType SymbolicLink -Path "C:\Program Files\Common Files\Adobe\CEP\extensions\AfterEffectsMCP" -Target "경로\AfterEffectsMCP"
```

macOS/Linux:
```bash
ln -s /경로/AfterEffectsMCP "/Library/Application Support/Adobe/CEP/extensions/AfterEffectsMCP"
```

### 5. CEP 디버그 모드 활성화

**Windows 레지스트리 설정:**
```
HKEY_CURRENT_USER\Software\Adobe\CSXS.9
이름: PlayerDebugMode
종류: REG_SZ
값: 1
```

**macOS Terminal:**
```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
```

> **참고**: After Effects 버전에 따라 CSXS.9, CSXS.10, CSXS.11 등이 다를 수 있습니다.

### 6. After Effects 재시작

After Effects를 재시작한 후:
1. `Window` → `Extensions` → `AfterEffectsMCP` 메뉴 클릭
2. 패널이 열리면 설치 완료! 🎉

---

## 🚀 사용 방법

### 1. API 키 설정

1. [Google AI Studio](https://makersuite.google.com/app/apikey)에서 무료 API 키 발급
2. AfterEffectsMCP 패널 상단의 "Gemini API Key" 입력란에 붙여넣기
3. API 키는 자동으로 로컬스토리지에 저장됩니다

### 2. 기본 사용법

#### 간단한 명령
```
"새 텍스트 레이어 만들어줘"
```

#### 선택된 레이어 활용
```
"선택한 레이어를 화면 중앙으로 이동해줘"
```

#### 복잡한 작업
```
"선택한 레이어에 0초부터 2초까지 불투명도 0에서 100으로 애니메이션 만들어줘"
```

#### 이미지 생성 (실험적)
```
"푸른 하늘 배경 이미지 만들어서 프로젝트에 넣어줘"
```

### 3. 코드 실행 흐름

1. 명령어 입력 → 전송 버튼 클릭
2. Python 서버가 Gemini에게 프롬프트 전달
3. AI가 ExtendScript 코드 생성
4. **코드 미리보기 창 표시** (보안 기능)
5. ✅ **실행** 또는 ❌ **취소** 선택
6. 실행 시 After Effects에서 자동으로 코드 실행
7. 결과 확인 (Ctrl+Z로 되돌리기 가능)

---

## 📁 프로젝트 구조

```
AfterEffectsMCP/
├── .debug                    # CEP 디버그 설정
├── .env.example              # 환경 변수 예시
├── .gitignore               # Git 제외 목록
├── CSXS/
│   └── manifest.xml         # CEP 확장 프로그램 매니페스트
├── client/
│   ├── index.html           # 패널 UI
│   └── main.js              # 클라이언트 로직
├── host/
│   └── index.jsx            # ExtendScript (AE와 통신)
├── lib/
│   └── CSInterface.js       # Adobe CEP 라이브러리
├── server/
│   ├── server.py            # Flask 서버 (Gemini API 연동)
│   ├── requirements.txt     # Python 패키지 목록
│   └── temp_images/         # 임시 이미지 저장 (자동 생성)
└── README.md                # 이 문서
```

---

## 🔧 문제 해결

### Python 서버가 시작되지 않아요
**증상**: "Python 명령어를 찾을 수 없습니다" 메시지

**해결책**:
1. Python 설치 확인: `python --version`
2. 환경 변수에 Python 경로 추가
3. After Effects 재시작

### API 오류가 발생해요
**증상**: "API Key 설정 실패" 또는 "Gemini API 오류"

**해결책**:
1. API 키가 정확한지 확인
2. 인터넷 연결 확인
3. [Google AI Studio](https://makersuite.google.com/) 할당량 확인

### 코드가 실행되지 않아요
**증상**: "스크립트 실행 중 오류 발생"

**해결책**:
1. After Effects에 활성화된 컴포지션이 있는지 확인
2. 에러 메시지 확인 (자세한 설명 제공)
3. F12를 눌러 DevTools에서 콘솔 로그 확인

### Pillow 관련 경고가 떠요
**증상**: "[WARNING] Pillow가 설치되지 않았습니다"

**해결책**:
```bash
pip install pillow
```

이미지 생성 기능을 사용하지 않는다면 무시해도 됩니다.

---

## 👨‍💻 개발 가이드

### 로컬 개발 설정

1. **서버 직접 실행 (테스트용)**
```bash
cd server
python server.py
```

2. **Chrome DevTools 열기**
   - After Effects에서 패널 열기
   - `F12` 또는 우클릭 → Inspect

3. **코드 수정 후 리로드**
   - `Ctrl+R` (Windows) / `Cmd+R` (Mac)

### 커스터마이징

#### 시스템 프롬프트 수정
`server/server.py`의 `system_instruction` 변수를 수정하여 AI 동작 방식 변경 가능

#### UI 스타일 변경
`client/index.html`의 `<style>` 섹션 수정

#### 포트 변경
`.env` 파일 생성:
```
SERVER_PORT=8000
```

---

## 📄 라이선스

MIT License

Copyright (c) 2024

자유롭게 사용, 수정, 배포할 수 있습니다.

---

## 🙏 기여하기

버그 리포트, 기능 제안, Pull Request 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🔗 관련 링크

- [Adobe CEP 공식 문서](https://github.com/Adobe-CEP/CEP-Resources)
- [ExtendScript 가이드](https://ae-scripting.docsforadobe.dev/)
- [Google Gemini API](https://ai.google.dev/)

---

## 📞 문의

문제가 있거나 질문이 있으시면 [GitHub Issues](https://github.com/YOUR_USERNAME/AfterEffectsMCP/issues)에 등록해주세요.

**즐거운 After Effects 자동화 되세요! 🎬✨**
