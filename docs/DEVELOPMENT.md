# AfterEffectsMCP 보안 및 개발 가이드

## 🔒 보안 고려사항

### 1. API 키 관리

#### ✅ 안전한 방법
- 로컬스토리지에 저장 (브라우저 내부, 외부 접근 불가)
- `.env` 파일 사용 (Git에 커밋하지 않음)

#### ❌ 위험한 방법
- 코드에 하드코딩 금지
- GitHub에 API 키 업로드 금지
- 다른 사람과 API 키 공유 금지

### 2. 코드 실행 전 확인

AfterEffectsMCP는 AI가 생성한 코드를 실행하기 전에 반드시 사용자 확인을 거칩니다.

**보안 기능:**
- 코드 미리보기 창
- 실행 / 취소 선택권
- Undo Group 래핑 (되돌리기 가능)

### 3. 서버 보안

**로컬 서버만 허용:**
```python
app.run(host='127.0.0.1', port=port, debug=False)
```

외부 접근을 차단하여 안전성을 보장합니다.

---

## 🛠️ 개발 가이드

### 프로젝트 구조 이해

```
AfterEffectsMCP/
│
├── client/              # CEP 패널 (사용자 UI)
│   ├── index.html       # HTML 구조
│   └── main.js          # 클라이언트 로직
│
├── host/               # ExtendScript (After Effects 제어)
│   └── index.jsx       # AE API 호출 함수
│
├── server/             # Python 백엔드
│   ├── server.py       # Flask 서버 + Gemini 연동
│   └── requirements.txt
│
└── CSXS/               # CEP 메타데이터
    └── manifest.xml    # 확장 프로그램 설정
```

### 데이터 흐름

```
1. [User Input] → client/main.js
                   ↓
2. [Get Context] → csInterface.evalScript('getProjectContext()')
                   ↓
3. [Call Server] → http://127.0.0.1:5000/chat
                   ↓
4. [Gemini API] → server.py (Flask)
                   ↓
5. [Code Gen]   → Gemini 응답 파싱
                   ↓
6. [Preview]    → showCodeConfirmation()
                   ↓
7. [Execute]    → csInterface.evalScript(code)
                   ↓
8. [AE Action]  → After Effects에서 스크립트 실행
```

---

## 🧪 개발 환경 설정

### 1. 개발자 도구 활성화

#### Chrome DevTools
- After Effects에서 패널 열기
- `F12` 또는 우클릭 → Inspect
- Console, Network 탭 활용

### 2. 서버 직접 실행 (디버깅)

```bash
cd server
python server.py
```

**로그 확인:**
```
[INFO] AfterEffectsMCP 서버 시작 (포트: 5000)
[INFO] 임시 파일 경로: ...
```

### 3. 코드 수정 후 리로드

- **클라이언트 코드 수정 시**: `Ctrl+R` / `Cmd+R` (DevTools 열린 상태)
- **서버 코드 수정 시**: 서버 재시작 필요

---

## 🎨 커스터마이징

### UI 스타일 변경

`client/index.html` 수정:

```css
/* 메시지 색상 변경 */
.user-msg { background: #ff6b6b; }
.bot-msg { background: #4ecdc4; }

/* 버튼 색상 */
button { background: #6c5ce7; }
```

### Gemini 프롬프트 수정

`server/server.py`의 `system_instruction` 변경:

```python
system_instruction = """
당신은 After Effects 전문가입니다.
(여기에 원하는 지시사항 추가)
"""
```

### 포트 변경

`.env` 파일 생성:
```
SERVER_PORT=8000
```

`client/main.js`에서:
```javascript
const SERVER_URL = 'http://127.0.0.1:8000';
```

---

## 🐛 디버깅 팁

### 서버 로그 확인

```python
# server.py에 로그 추가
print(f"[DEBUG] Received prompt: {user_prompt}")
```

### 클라이언트 로그 확인

```javascript
// client/main.js
console.log("Context JSON:", contextJson);
```

### ExtendScript 디버깅

```jsx
// host/index.jsx
alert("Debug: " + JSON.stringify(context));
```

---

## 📚 참고 자료

- [Adobe CEP 공식 문서](https://github.com/Adobe-CEP/CEP-Resources)
- [ExtendScript 가이드](https://ae-scripting.docsforadobe.dev/)
- [Flask 문서](https://flask.palletsprojects.com/)
- [Gemini API 문서](https://ai.google.dev/docs)

---

## 🤝 기여 가이드라인

### Pull Request 제출 전 체크리스트

- [ ] 코드가 정상 작동하는지 테스트
- [ ] 주석 추가 (복잡한 로직)
- [ ] 에러 처리 추가
- [ ] README.md 업데이트 (필요시)

### 코드 스타일

- **Python**: PEP 8 준수
- **JavaScript**: 세미콜론 사용, 2-space 들여쓰기
- **주석**: 한글 또는 영어 (명확하게)

---

이 문서는 AfterEffectsMCP 프로젝트의 개발자를 위한 가이드입니다.
