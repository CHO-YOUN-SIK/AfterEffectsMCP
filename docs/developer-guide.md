# 🛠️ After Effects MCP 개발자 가이드

이 문서는 프로젝트의 구조와 핵심 로직을 설명합니다. 기여하거나 기능을 확장할 때 참고하세요.

## 1. 프로젝트 구조 (Project Structure)

```
AfterEffectsMCP/
├── client/                 # CEP 패널 (Frontend)
│   ├── index.html          # UI 구조
│   ├── main.js             # 핵심 로직 (서버 통신, CSInterface, DOM 조작)
│   ├── style.css           # 스타일링 (다크 모드, 채팅 UI)
│   └── CSXS/manifest.xml   # 패널 설정 (확장 ID, 버전, 크기)
│
├── server/                 # Python 백엔드 (Backend)
│   ├── server.py           # Flask 서버 (Gemini API 통신, 프롬프트 관리)
│   ├── verify_workflow.py  # 통합 테스트 스크립트
│   └── requirements.txt    # 의존성 목록
│
├── host/                   # ExtendScript (After Effects 내부)
│   └── index.jsx           # AE 제어용 스크립트 (현재는 직접 evalScript 사용)
│
└── docs/                   # 문서
```

## 2. 핵심 로직 설명

### 🔄 서버 자동 실행 (Auto-Start)
- **위치:** `client/main.js` -> `startPythonServer()`
- **동작:** 패널이 로드될 때 Node.js `child_process.spawn`을 사용하여 `server/server.py`를 백그라운드에서 실행합니다.
- **특징:** 사용자의 환경별 Python 경로(`python`, `python3`, `win store python` 등)를 순차적으로 시도하며, 포트 충돌 시 자동으로 다음 포트(5000 -> 5001...)를 할당합니다.

### 🔑 API 키 관리 (Security)
- **위치:** `client/main.js` -> `loadApiKey()`
- **동작:** 보안을 위해 로컬 파일(`config.json`)을 사용하지 않습니다. 오직 패널 내부 브라우저의 `localStorage`에만 저장합니다.
- **우선순위:** `Client Input (사용자 입력)` > `Server .env (개발용 백업)`

### 🤖 Gemini 통신 및 코드 생성
1. **Request:** 사용자가 메시지를 보내면 `server.py/chat`으로 전송됩니다.
2. **System Prompt:** `server.py`의 전역 변수 `system_instruction`이 AI에게 역할을 부여합니다.
   - 가독성 있는 마크다운 출력
   - `type: code` JSON 포맷 강제
   - `app.beginUndoGroup()` 포함 필수
3. **Execution:** 클라이언트는 받은 코드를 `csInterface.evalScript()`를 통해 AE로 전달합니다. (중복 래핑 없이 Raw 코드 실행)

## 3. 개발 워크플로우

### 디버깅 모드 (Debug Mode)
- **클라이언트:** `localhost:8088` (Chrome DevTools)
  - `.debug` 파일을 생성하여 디버깅 포트를 열 수 있습니다.
- **서버:** 터미널 로그 확인
  - `python server.py`를 직접 실행하면 실시간 로그를 볼 수 있습니다.

### 통합 테스트
서버 기능 변경 후에는 반드시 자동 테스트를 수행하세요.
```bash
cd server
python verify_workflow.py
```
-> 서버 실행, API 키 인증, 대화 및 코드 생성을 자동으로 검증합니다.

## 4. 확장 가이드
- **새로운 AI 모델 적용:** `server.py`의 `genai.GenerativeModel('gemini-1.5-flash')` 부분 수정.
- **UI 디자인 변경:** `client/style.css` 수정.
- **기능 추가:** `client/main.js`에서 새 명령어 처리 로직 추가 후 `server.py` 프롬프트 튜닝.
