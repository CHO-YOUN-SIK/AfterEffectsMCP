import os
import json
import base64
import requests
from flask import Flask, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

# 이미지 저장 경로 설정
TEMP_IMG_DIR = os.path.join(os.path.dirname(__file__), 'temp_images')
if not os.path.exists(TEMP_IMG_DIR):
    os.makedirs(TEMP_IMG_DIR)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    api_key = data.get('apiKey')
    user_prompt = data.get('prompt')
    
    if not api_key:
        return jsonify({"error": "API Key is required"}), 400

    # Gemini 설정
    genai.configure(api_key=api_key)
    
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
                img_req = json.loads(text_response)
                # [실제 구현 시] 여기서 DALL-E나 Stable Diffusion API를 호출하여 이미지를 생성합니다.
                # 현재는 테스트를 위해 랜덤 색상의 더미 이미지를 생성합니다.
                from PIL import Image
                import random
                
                img_prompt = img_req['prompt']
                img_filename = f"gen_{random.randint(1000,9999)}.png"
                save_path = os.path.join(TEMP_IMG_DIR, img_filename)
                
                # 더미 이미지 생성 (빨간색 배경)
                img = Image.new('RGB', (500, 500), color = (random.randint(0,255), random.randint(0,255), random.randint(0,255)))
                img.save(save_path)
                
                # AE에서 이 이미지를 불러오는 스크립트 작성
                # 중요: 경로의 역슬래시를 슬래시로 변경해야 AE가 인식함
                js_path = save_path.replace("\\", "/")
                jsx_code = f'var importOptions = new ImportOptions(File("{js_path}")); app.project.importFile(importOptions);'
                
                return jsonify({
                    "status": "success", 
                    "type": "image", 
                    "log": f"이미지 생성 완료: {img_prompt}", 
                    "code": jsx_code
                })

            except Exception as e:
                return jsonify({"status": "error", "message": str(e)})

        # 2. 일반 ExtendScript 코드인 경우
        else:
            # 마크다운 제거 (```javascript 등)
            clean_code = text_response.replace("```javascript", "").replace("```jsx", "").replace("```", "")
            return jsonify({
                "status": "success", 
                "type": "code", 
                "log": "AE 스크립트 작성 완료", 
                "code": clean_code
            })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)