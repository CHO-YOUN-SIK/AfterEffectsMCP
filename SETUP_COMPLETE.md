# After Effects 연결 완료! 🎉

## ✅ 설치된 내용

1. **CEP 확장 프로그램 설치 완료**
   - 위치: `C:\Users\kksu1\AppData\Roaming\Adobe\CEP\extensions\AfterEffectsMCP`
   
2. **디버그 모드 활성화 완료**
   - CSXS.9, CSXS.10, CSXS.11, CSXS.12 모두 활성화됨
   - 서명되지 않은 확장 프로그램 실행 가능

---

## 🚀 사용 방법

### 1단계: 서버 시작하기

**옵션 A - 배치 파일 사용 (권장)**
1. 프로젝트 폴더를 엽니다: `C:\Users\kksu1\AfterEffectsMCP`
2. `start_server.bat` 파일을 더블 클릭합니다
3. 검은색 콘솔 창이 열리면 서버가 실행된 것입니다

**옵션 B - 수동 실행**
```bash
cd C:\Users\kksu1\AfterEffectsMCP\server
python server.py
```

### 2단계: After Effects에서 패널 열기

1. After Effects를 **재시작**합니다 (이미 실행 중이었다면)
2. 메뉴에서 선택: **Window > Extensions > AfterEffects MCP**
3. 패널이 화면에 나타납니다

### 3단계: 초기 설정

1. 패널이 열리면 **설정 모달**이 자동으로 나타납니다
2. **Gemini API Key** 입력:
   - [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급
   - API 키를 복사하여 붙여넣기
3. (선택사항) **참고 URL** 입력:
   - 뉴스 기사, 블로그, 쇼핑몰 링크 등
   - 자동으로 콘텐츠를 분석하고 이미지를 다운로드합니다
4. **등록 및 시작** 버튼 클릭

### 4단계: 사용하기!

**채팅으로 After Effects 제어:**
```
User: 빨간색 공이 위에서 아래로 떨어지는 애니메이션 만들어줘

AI: [코드 생성 및 자동 실행]

After Effects: [애니메이션이 자동으로 생성됩니다!]
```

**이미지 첨부하기:**
1. 📎 버튼을 클릭하여 이미지 선택
2. "이 이미지를 배경으로 사용해서 영상 만들어줘" 입력
3. AI가 이미지를 분석하고 작업을 생성합니다

---

## 🔧 문제 해결

### 문제 1: 패널이 보이지 않음

**해결 방법:**
1. After Effects를 완전히 종료하고 재시작
2. Window > Extensions 메뉴 확인
3. 여전히 안 보이면 레지스트리 확인:
   ```
   regedit 실행 > HKEY_CURRENT_USER\Software\Adobe\CSXS.11
   > PlayerDebugMode = "1" 확인
   ```

### 문제 2: 서버 연결 실패

**패널 상단의 상태 점이 빨간색인 경우:**

1. **서버가 실행 중인지 확인:**
   - `start_server.bat`이 열려있는지 확인
   - 콘솔 창에 `Running on http://127.0.0.1:5000` 메시지 확인

2. **포트 충돌 확인:**
   - 다른 프로그램이 5000번 포트를 사용 중일 수 있음
   - 패널의 "🔄 강제 재시작" 버튼 클릭

3. **수동으로 서버 재시작:**
   - 콘솔 창 닫기
   - `start_server.bat` 다시 실행

### 문제 3: API 키 오류

**"API 키가 유효하지 않습니다" 메시지:**

1. API 키 재확인:
   - [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 새 API 키 생성 또는 기존 키 복사

2. `.env` 파일 수정:
   ```
   C:\Users\kksu1\AfterEffectsMCP\.env
   
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### 문제 4: 코드 실행 실패

**스크립트가 실행되지 않는 경우:**

1. After Effects에서 컴포지션이 열려있는지 확인
2. 패널 하단의 로그 확인 (🖥️ 서버 상태 로그)
3. After Effects 환경설정 > 스크립팅 및 표현식 > "스크립트의 파일 및 네트워크 액세스 허용" 체크

---

## 💡 사용 팁

### 효과적인 프롬프트 작성법:

✅ **좋은 예시:**
```
"1920x1080 컴포지션을 만들고, 중앙에 200px 크기의 빨간색 원 레이어를 추가한 다음,
2초 동안 위에서 아래로 부드럽게 떨어지는 애니메이션을 만들어줘.
ease in-out 이징을 사용해줘."
```

❌ **나쁜 예시:**
```
"애니메이션 만들어줘"
```

### 고급 기능:

1. **URL 분석 활용:**
   - 제품 페이지 URL → 자동으로 상품 영상 생성
   - 뉴스 기사 URL → 자동으로 뉴스 영상 생성

2. **이미지 멀티모달:**
   - 여러 이미지 첨부 가능
   - "첫 번째 이미지는 배경, 두 번째는 로고로 사용해줘"

3. **대화 컨텍스트:**
   - 이전 대화 내용을 기억합니다
   - "방금 만든 애니메이션에 텍스트 레이어를 추가해줘"

---

## 📚 추가 정보

- **프로젝트 폴더**: `C:\Users\kksu1\AfterEffectsMCP`
- **서버 로그**: 패널 내 "🖥️ 서버 상태 로그" 섹션
- **캡처 이미지**: `C:\Users\kksu1\AfterEffectsMCP\captures`

---

## 🎉 이제 사용할 준비가 되었습니다!

1. ✅ CEP 확장 프로그램 설치 완료
2. ✅ 디버그 모드 활성화 완료
3. ⏳ **다음 단계**: `start_server.bat` 실행 → After Effects 열기 → 패널 열기

질문이 있으시면 언제든지 물어보세요! 🚀
