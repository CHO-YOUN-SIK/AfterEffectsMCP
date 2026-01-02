import requests
import os
import json
import time
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv(override=True)
API_KEY = os.getenv('GEMINI_API_KEY')
BASE_URL = 'http://127.0.0.1:5000'

if API_KEY:
    print(f"🔑 Loaded API Key prefix: {API_KEY[:5]}...")
else:
    print("❌ API Key not found in .env")

def print_result(step, success, message):
    icon = "✅" if success else "❌"
    print(f"\n{icon} [Step {step}] {message}")
    if not success:
        print("   -> 중단됨. 서버 로그를 확인해주세요.")
        exit(1)

print("🔍 After Effects MCP 서버 통합 테스트 시작...\n")

# 1. 서버 실행 확인 (Health Check)
try:
    response = requests.get(f"{BASE_URL}/health")
    if response.status_code == 200:
        print_result(1, True, "서버 실행 확인 (/health) - 성공")
    else:
        print_result(1, False, f"서버 응답 오류: {response.status_code}")
except Exception as e:
    print_result(1, False, f"서버에 연결할 수 없습니다: {e}")

# 2. API 키 검증 테스트
print("\n... API 키 검증 시도 중 ...")
try:
    payload = {"apiKey": API_KEY}
    response = requests.post(f"{BASE_URL}/test-api-key", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print_result(2, True, f"API 키 검증 (/test-api-key) - 성공\n   -> 메시지: {data.get('message')}")
    else:
        print_result(2, False, f"API 키 검증 실패: {response.text}")
except Exception as e:
    print_result(2, False, f"요청 실패: {e}")

# 3. 대화 기능 테스트 (일반 대화)
print("\n... 일반 대화 테스트 시도 중 ...")
try:
    payload = {
        "prompt": "안녕하세요! 짧게 인사해주세요.",
        "apiKey": API_KEY,
        "history": []
    }
    response = requests.post(f"{BASE_URL}/chat", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        # JSON 응답 구조 확인
        if data.get('type') == 'clarification' and data.get('content'):
            print_result(3, True, f"일반 대화 테스트 (/chat) - 성공\n   -> 응답: {data['content'][:50]}...")
        else:
            print_result(3, False, f"응답 형식 불일치: {data}")
    elif response.status_code == 429:
        print_result(3, False, "API 사용량 한도 초과 (429). 잠시 후 다시 시도하세요.")
    else:
        print_result(3, False, f"대화 요청 실패: {response.text}")
except Exception as e:
    print_result(3, False, f"요청 실패: {e}")

# 4. 코드 생성 테스트
print("\n... 코드 생성 테스트 시도 중 ...")
try:
    payload = {
        "prompt": "10초짜리 빨간색 텍스트 레이어를 만들어주는 스크립트를 짜줘. 되묻지 말고 바로 코드 줘.",
        "apiKey": API_KEY,
        "history": []
    }
    response = requests.post(f"{BASE_URL}/chat", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        # 코드 응답 구조 확인 (type: code, data.code 존재 여부)
        if data.get('type') == 'code' and data.get('data', {}).get('code'):
            print_result(4, True, "코드 생성 테스트 (/chat) - 성공")
            print(f"   -> 생성된 코드 길이: {len(data['data']['code'])} 자")
            print(f"   -> 코드 미리보기:\n{data['data']['code'][:100]}...")
        else:
            print_result(4, False, f"코드 생성 실패 (응답 형식이 코드가 아님): {data}")
    else:
        print_result(4, False, f"코드 생성 요청 실패: {response.text}")
except Exception as e:
    print_result(4, False, f"요청 실패: {e}")

print("\n✨ 모든 테스트가 완료되었습니다!")
