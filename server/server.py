import os
import json
import re
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

# 이미지 저장 경로 설정
TEMP_IMG_DIR = os.path.join(os.path.dirname(__file__), 'temp_images')
if not os.path.exists(TEMP_IMG_DIR):
    os.makedirs(TEMP_IMG_DIR)

# Pillow 선택적 import (이미지 생성 기능용)
try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    print("[WARNING] Pillow가 설치되지 않았습니다. 이미지 생성 기능이 비활성화됩니다.")

def cleanup_old_images():
    """24시간이 지난 임시 이미지 파일 삭제"""
    try:
        now = datetime.now()
        for filename in os.listdir(TEMP_IMG_DIR):
            filepath = os.path.join(TEMP_IMG_DIR, filename)
            if os.path.isfile(filepath):
                file_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                if now - file_modified > timedelta(hours=24):
                    os.remove(filepath)
                    print(f"[INFO] 오래된 임시 파일 삭제: {filename}")
    except Exception as e:
        print(f"[ERROR] 임시 파일 정리 실패: {e}")

def extract_code_from_markdown(text):
    """마크다운 코드 블록에서 실제 코드만 추출"""
    # ```javascript, ```jsx, ```extendscript 등의 코드 블록 찾기
    code_pattern = r'```(?:javascript|jsx|extendscript)?\s*\n(.*?)\n```'
    matches = re.findall(code_pattern, text, re.DOTALL)
    
    if matches:
        return matches[0].strip()
    
    # 코드 블록이 없으면 원본 반환 (전처리)
    return text.replace("```javascript", "").replace("```jsx", "").replace("```", "").strip()

@app.route('/chat', methods=['POST'])
def chat():
    """Gemini API를 사용한 채팅 엔드포인트"""
    # 임시 파일 정리 (매 요청마다 실행하되 부담이 적음)
    cleanup_old_images()
    
    data = request.json
    api_key = data.get('apiKey')
    user_prompt = data.get('prompt')
    
    if not api_key:
        return jsonify({
            "error": "API Key가 필요합니다",
            "details": "https://makersuite.google.com/app/apikey 에서 발급받을 수 있습니다"
        }), 400
    
    if not user_prompt:
        return jsonify({"error": "프롬프트가 비어있습니다"}), 400

    # Gemini 설정
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        return jsonify({
            "error": "API Key 설정 실패",
            "details": str(e)
        }), 400
    
    # 시스템 프롬프트: Gemini에게 AE 스크립트를 짜거나 이미지를 생성하라고 지시
    system_instruction = """
    당신은 After Effects 스크립팅 전문가입니다.
    
    [입력 데이터 처리]
    사용자의 요청에는 'Current AE Context JSON'이라는 현재 프로젝트 상태 정보가 포함되어 있습니다.
    1. 사용자가 "선택한 레이어"를 언급하면 JSON의 'selectedLayers' 배열에 있는 'index'를 사용해 코드를 작성하세요. (예: layer(1) 대신 layer(index))
    2. 컴포지션 크기를 언급하면 JSON의 width, height 값을 사용하세요.
    
    [출력 규칙]
    1. 이미지 생성 요청 시: {"action": "image", "prompt": "..."} JSON 반환.
    2. 스크립트 요청 시: 실행 가능한 ExtendScript 코드만 반환 (마크다운, 설명 금지).
    3. 모든 코드는 app.beginUndoGroup("Gemini Action"); 으로 시작하고 app.endUndoGroup(); 으로 끝나야 함.
    """

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        chat = model.start_chat(history=[])
        response = chat.send_message(f"{system_instruction}\n\nUser Request: {user_prompt}")
        
        text_response = response.text.strip()
        
        # 1. JSON (이미지 생성 요청)인지 확인
        if text_response.startswith('{') and '"action": "image"' in text_response:
            try:
                if not PILLOW_AVAILABLE:
                    return jsonify({
                        "status": "error",
                        "message": "이미지 생성 기능을 사용하려면 Pillow 라이브러리가 필요합니다",
                        "details": "pip install pillow 명령어로 설치해주세요"
                    })
                
                import random
                img_req = json.loads(text_response)
                
                img_prompt = img_req.get('prompt', 'default image')
                img_filename = f"gen_{int(time.time())}_{random.randint(1000,9999)}.png"
                save_path = os.path.join(TEMP_IMG_DIR, img_filename)
                
                # 더미 이미지 생성 (랜덤 색상 배경)
                # 실제 구현 시 DALL-E, Stable Diffusion 등의 API 호출로 대체
                img = Image.new('RGB', (500, 500), color=(
                    random.randint(0, 255),
                    random.randint(0, 255),
                    random.randint(0, 255)
                ))
                img.save(save_path)
                
                # AE에서 이 이미지를 불러오는 스크립트 작성
                # 중요: 경로의 역슬래시를 슬래시로 변경해야 AE가 인식함
                js_path = save_path.replace("\\", "/")
                jsx_code = f'''app.beginUndoGroup("Import Generated Image");
var importOptions = new ImportOptions(File("{js_path}"));
var importedItem = app.project.importFile(importOptions);
app.endUndoGroup();'''
                
                return jsonify({
                    "status": "success", 
                    "type": "image", 
                    "log": f"이미지 생성 완료: {img_prompt} (파일: {img_filename})", 
                    "code": jsx_code
                })

            except json.JSONDecodeError as e:
                return jsonify({
                    "status": "error",
                    "message": "이미지 요청 JSON 파싱 실패",
                    "details": str(e)
                })
            except Exception as e:
                return jsonify({
                    "status": "error",
                    "message": f"이미지 생성 중 오류 발생: {str(e)}",
                    "details": "서버 로그를 확인해주세요"
                })

        # 2. 일반 ExtendScript 코드인 경우
        else:
            # 정규식을 사용한 정확한 코드 추출
            clean_code = extract_code_from_markdown(text_response)
            
            # Undo Group 확인 및 추가
            if 'app.beginUndoGroup' not in clean_code:
                clean_code = f'app.beginUndoGroup("Gemini Action");\n{clean_code}\napp.endUndoGroup();'
            
            return jsonify({
                "status": "success", 
                "type": "code", 
                "log": "AE 스크립트 작성 완료", 
                "code": clean_code
            })

    except genai.types.GoogleGenerativeAIError as e:
        return jsonify({
            "error": "Gemini API 오류",
            "details": str(e),
            "suggestion": "API 키를 확인하거나 잠시 후 다시 시도해주세요"
        }), 500
    except Exception as e:
        return jsonify({
            "error": "서버 내부 오류",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('SERVER_PORT', 5000))
    print(f"[INFO] AfterEffectsMCP 서버 시작 (포트: {port})")
    print(f"[INFO] 임시 파일 경로: {TEMP_IMG_DIR}")
    print(f"[INFO] Pillow 사용 가능: {PILLOW_AVAILABLE}")
    app.run(host='127.0.0.1', port=port, debug=False)