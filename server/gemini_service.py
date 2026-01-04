import google.generativeai as genai
import json
import re
from custom_exceptions import GeminiAPIError, QuotaExceededError, AuthenticationError

import os

# 전역 시스템 프롬프트 정의 (파일에서 로드)
SYSTEM_INSTRUCTION = ""
PROMPT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'enhanced_prompt.txt')

try:
    if os.path.exists(PROMPT_FILE):
        with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
            SYSTEM_INSTRUCTION = f.read()
            print(f"[Gemini] Loaded Enhanced Prompt ({len(SYSTEM_INSTRUCTION)} chars)")
    else:
        print("[Gemini] Warning: enhanced_prompt.txt not found. Using minimal fallback.")
        SYSTEM_INSTRUCTION = "당신은 After Effects 전문가입니다. ExtendScript 코드를 생성하세요."
except Exception as e:
    print(f"[Gemini] Error loading prompt: {e}")
    SYSTEM_INSTRUCTION = "당신은 After Effects 전문가입니다. ExtendScript 코드를 생성하세요."

class GeminiService:
    def __init__(self):
        self.default_model_name = 'gemini-2.0-flash-exp' 
        self.fallback_model_name = 'gemini-1.5-flash'
        
    def configure(self, api_key):
        """Gemini API 설정"""
        if not api_key:
            raise AuthenticationError("API 키가 제공되지 않았습니다.")
        try:
            genai.configure(api_key=api_key)
        except Exception as e:
            raise AuthenticationError(f"API 키 설정 실패: {str(e)}")

    def extract_code_from_markdown(self, text):
        """마크다운에서 코드 블록 추출"""
        # 1. ```javascript ... ``` 패턴
        match = re.search(r'```(?:javascript|extendscript|js)?\n(.*?)```', text, re.DOTALL)
        if match:
            return match.group(1).strip()
        
        # 2. 코드 블록 없는 경우: app.beginUndoGroup 부터 끝까지
        if 'app.beginUndoGroup' in text:
            start = text.find('app.beginUndoGroup')
            return text[start:].strip()
            
        return text.strip()

    def _sanitize_code(self, code):
        """코드가 중간에 잘리거나 괄호가 맞지 않는 경우 보정"""
        if not code: return code

        # 1. 괄호 짝 맞추기
        open_braces = code.count('{')
        close_braces = code.count('}')
        
        if open_braces > close_braces:
            missing = open_braces - close_braces
            code += '\n' + ('}' * missing)
            
        # 2. UndoGroup 짝 맞추기
        if 'app.beginUndoGroup' in code and 'app.endUndoGroup' not in code:
            code += '\napp.endUndoGroup();'
            
        return code

import PIL.Image

# ... (기존 import 유지)

    def process_chat(self, user_prompt, history, api_key, image_paths=None):
        """채팅 요청 처리 및 응답 포맷팅 (멀티모달 지원)"""
        self.configure(api_key)
        
        try:
            # 모델 초기화
            try:
                model = genai.GenerativeModel(
                    self.default_model_name,
                    system_instruction=SYSTEM_INSTRUCTION
                )
            except TypeError:
                model = genai.GenerativeModel(self.default_model_name)
                user_prompt = f"{SYSTEM_INSTRUCTION}\n\n[User]: {user_prompt}"

            # 히스토리 변환
            gemini_history = []
            for msg in history[-10:]:
                role = "user" if msg.get('role') == 'user' else "model"
                gemini_history.append({
                    "role": role,
                    "parts": [msg.get('content', '')]
                })

            chat_session = model.start_chat(history=gemini_history)
            
            # 멀티모달 메시지 구성
            message_parts = [user_prompt]
            if image_paths:
                print(f"[Gemini] Loading {len(image_paths)} images...")
                for path in image_paths:
                    try:
                        img = PIL.Image.open(path)
                        message_parts.append(img)
                        print(f"  - Loaded: {path}")
                    except Exception as e:
                        print(f"  - Failed to load image {path}: {e}")

            response = chat_session.send_message(message_parts)
            
            return self._parse_response(response.text)

        except Exception as e:
            error_str = str(e)
            if 'quota' in error_str.lower() or '429' in error_str:
                raise QuotaExceededError(details=error_str)
            if 'API key' in error_str:
                raise AuthenticationError(details=error_str)
            raise GeminiAPIError(f"Gemini API 호출 오류: {error_str}")

    def _parse_response(self, text_response):
        """모델의 텍스트 응답을 구조화된 딕셔너리로 변환"""
        text_response = text_response.strip()

        # 1. 순수 JSON 시도
        try:
            data = json.loads(text_response)
            if 'type' in data:
                if data.get('type') == 'code' and 'data' in data and 'code' in data['data']:
                    data['data']['code'] = self._sanitize_code(data['data']['code'])
                return data
        except json.JSONDecodeError:
            pass

        # 2. Markdown 코드 블록 내 JSON 추출
        json_match = re.search(r'```json\s*\n(.*?)\n```', text_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                if 'type' in data:
                    if data.get('type') == 'code' and 'data' in data and 'code' in data['data']:
                        data['data']['code'] = self._sanitize_code(data['data']['code'])
                    return data
            except json.JSONDecodeError:
                pass

        # 3. 텍스트 내의 JSON 객체 패턴 찾기
        json_pattern_match = re.search(r'(\{.*"type"\s*:\s*"code".*\})', text_response, re.DOTALL)
        if json_pattern_match:
             try:
                data = json.loads(json_pattern_match.group(1))
                if 'data' in data and 'code' in data['data']:
                    data['data']['code'] = self._sanitize_code(data['data']['code'])
                return data
             except json.JSONDecodeError:
                pass

        # 4. Fallback: 코드 블록이 있으면 코드로 간주
        if '```' in text_response or 'app.beginUndoGroup' in text_response:
            clean_code = self.extract_code_from_markdown(text_response)
            clean_code = self._sanitize_code(clean_code)
            
            if 'app.beginUndoGroup' not in clean_code:
                clean_code = f'app.beginUndoGroup("Gemini Action");\n{clean_code}\napp.endUndoGroup();'
                
            return {
                "type": "code",
                "content": text_response.split('```')[0].strip() or "코드를 생성했습니다.",
                "data": {
                    "type": "javascript",
                    "code": clean_code
                }
            }

        # 5. 일반 대화
        return {
            "type": "clarification",
            "content": text_response,
            "data": {}
        }
