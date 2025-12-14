# AfterEffectsMCP 설치 가이드

이 문서는 AfterEffectsMCP를 처음 설치하는 사용자를 위한 상세 가이드입니다.

## 📋 사전 요구사항 체크리스트

설치를 시작하기 전에 다음 항목들을 확인하세요:

- [ ] Adobe After Effects CC 2019 이상 설치됨
- [ ] Python 3.8 이상 설치됨
- [ ] 인터넷 연결 확인
- [ ] Google Gemini API Key 발급 (무료)

---

## 1단계: Python 설치 및 확인

### Windows

1. [Python 공식 웹사이트](https://www.python.org/downloads/) 접속
2. "Download Python" 버튼 클릭
3. 설치 프로그램 실행
4. **⚠️ 중요**: "Add Python to PATH" 체크박스 선택!
5. "Install Now" 클릭

### macOS

```bash
# Homebrew가 설치되어 있다면
brew install python3

# 또는 공식 웹사이트에서 설치 프로그램 다운로드
```

### 설치 확인

터미널(Windows: PowerShell, macOS: Terminal)을 열고:

```bash
python --version
# 또는
python3 --version
```

출력 예시:
```
Python 3.11.5
```

---

## 2단계: Google Gemini API Key 발급

1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. Google 계정으로 로그인
3. "Create API Key" 버튼 클릭
4. API Key를 복사하여 안전한 곳에 보관

> **💡 팁**: API Key는 나중에 AfterEffectsMCP 패널에서 입력하게 됩니다.

---

## 3단계: AfterEffectsMCP 다운로드

### 방법 1: Git Clone (권장)

```bash
git clone https://github.com/CHO-YOUN-SIK/AfterEffectsMCP.git
cd AfterEffectsMCP
```

### 방법 2: ZIP 다운로드

1. [GitHub 저장소](https://github.com/CHO-YOUN-SIK/AfterEffectsMCP) 접속
2. "Code" → "Download ZIP" 클릭
3. 압축 해제

---

## 4단계: Python 패키지 설치

프로젝트 폴더에서:

```bash
cd server
pip install -r requirements.txt
```

**설치 중 오류 발생 시:**

```bash
# Python 3를 명시적으로 사용
pip3 install -r requirements.txt

# 또는 관리자 권한으로 실행 (Windows)
```

**설치 확인:**
```bash
pip list
```

다음 패키지들이 표시되어야 합니다:
- flask
- google-generativeai
- requests
- pillow

---

## 5단계: CEP 확장 프로그램 설치

### Windows 설치 경로

```
C:\Program Files\Common Files\Adobe\CEP\extensions\
```

### macOS 설치 경로

```
/Library/Application Support/Adobe/CEP/extensions/
```

### 설치 방법

#### 방법 1: 폴더 복사 (간단함)

1. `AfterEffectsMCP` 폴더 전체를 복사
2. 위 CEP 경로에 붙여넣기

#### 방법 2: 심볼릭 링크 (권장, 개발에 유용)

**Windows (관리자 PowerShell):**

```powershell
New-Item -ItemType SymbolicLink -Path "C:\Program Files\Common Files\Adobe\CEP\extensions\AfterEffectsMCP" -Target "C:\경로\AfterEffectsMCP"
```

**macOS/Linux:**

```bash
sudo ln -s /절대경로/AfterEffectsMCP "/Library/Application Support/Adobe/CEP/extensions/AfterEffectsMCP"
```

> **💡 팁**: 심볼릭 링크를 사용하면 원본 폴더를 수정할 때마다 자동으로 반영됩니다.

---

## 6단계: CEP 디버그 모드 활성화

After Effects가 서명되지 않은 확장 프로그램을 실행할 수 있도록 설정합니다.

### Windows 레지스트리 편집

1. `Win + R` → `regedit` 입력 → 엔터
2. 다음 경로로 이동:
   ```
   HKEY_CURRENT_USER\Software\Adobe\CSXS.9
   ```
   > **참고**: After Effects 버전에 따라 CSXS.9, CSXS.10, CSXS.11 등이 다를 수 있습니다.
   
3. 우클릭 → 새로 만들기 → 문자열 값
4. 이름: `PlayerDebugMode`
5. 값: `1`

### macOS Terminal

```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
```

> After Effects CC 2020 이상:
> ```bash
> defaults write com.adobe.CSXS.10 PlayerDebugMode 1
> ```

---

## 7단계: After Effects 재시작 및 확인

1. After Effects를 **완전히 종료**
2. After Effects 재시작
3. `Window` → `Extensions` 메뉴 확인
4. `AfterEffectsMCP` 항목이 보이면 클릭

### 패널이 보이지 않나요?

**문제 해결:**

1. CEP 경로가 올바른지 확인
2. 폴더 이름이 `AfterEffectsMCP`인지 확인 (대소문자 구분)
3. `manifest.xml` 파일이 `CSXS/manifest.xml` 경로에 있는지 확인
4. After Effects를 완전히 종료했다가 다시 시작

---

## 8단계: 첫 실행 및 API 키 설정

1. AfterEffectsMCP 패널 열기
2. 상단 "Gemini API Key" 입력란에 발급받은 API 키 붙여넣기
3. API 키는 자동으로 저장됩니다 (로컬스토리지)

### 테스트

프롬프트 입력란에 다음을 입력하고 전송:

```
새 텍스트 레이어 만들어줘
```

**정상 작동 시:**
1. "AE 상태 확인 중..." 메시지
2. "Gemini에게 요청 전송 중..." 메시지
3. 생성된 코드 미리보기
4. "✅ 실행" 버튼 클릭
5. After Effects에 텍스트 레이어 생성!

---

## 문제 해결

### Python 서버가 시작되지 않아요

**증상**: 패널이 열리지만 "Python 명령어를 찾을 수 없습니다" 메시지

**해결책**:
1. Python이 올바르게 설치되었는지 확인
2. 환경 변수 PATH에 Python이 추가되었는지 확인
3. After Effects 재시작

**수동 테스트**:
```bash
cd AfterEffectsMCP/server
python server.py
```

서버가 정상 실행되면 다음과 같은 메시지가 나타납니다:
```
[INFO] AfterEffectsMCP 서버 시작 (포트: 5000)
[INFO] 임시 파일 경로: ...
[INFO] Pillow 사용 가능: True
```

### API 오류가 계속 발생해요

**해결책**:
1. API 키를 다시 복사해서 붙여넣기 (공백 제거)
2. [Google AI Studio](https://makersuite.google.com/)에서 API 할당량 확인
3. 인터넷 연결 확인

### Windows에서 관리자 권한 오류

**해결책**:
```powershell
# PowerShell을 관리자 권한으로 실행 후:
Set-ExecutionPolicy RemoteSigned
```

---

## 다음 단계

설치가 완료되었습니다! 🎉

- [사용 가이드](../README.md#-사용-방법) 읽기
- [API 문서](API.md)에서 가능한 작업 확인
- 직접 명령어 실험해보기

**즐거운 After Effects 자동화 되세요!** ✨
