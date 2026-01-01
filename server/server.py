import os
import json
import re
import time
import requests
from flask import Flask, request, jsonify
import google.generativeai as genai

from crawler import crawl_product_page
from media_utils import (
    PILLOW_AVAILABLE,
    cleanup_old_images,
    download_and_prepare_media,
    ensure_temp_dir,
)

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Server is running"})


# 임시 파일(이미지/영상)을 저장할 폴더를 준비합니다.
TEMP_IMG_DIR = ensure_temp_dir(os.path.dirname(__file__))

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
    cleanup_old_images(TEMP_IMG_DIR)
    
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
    
    # Get conversation context
    context = data.get('context', {})
    history = data.get('history', [])
    state = data.get('state', 'idle')
    
    # Conversational System Instruction
    system_instruction = """
    You are an AI assistant that helps users create After Effects projects through natural conversation.
    
    CONVERSATIONAL WORKFLOW:
    1. CLARIFICATION: If the user's request is unclear or missing details, ask clarifying questions.
       - Response type: "clarification"
       - Ask about specific parameters needed (text content, position, color, size, duration, etc.)
    
    2. CONFIRMATION: Once you understand the requirements, present them for confirmation.
       - Response type: "confirmation"
       - Summarize all parameters in a structured format
       - Mark any parameters that still need user input
    
    3. CODE GENERATION: After user confirms, generate ExtendScript code.
       - Response type: "code"
       - Generate clean, executable ExtendScript
       - Wrap in app.beginUndoGroup() and app.endUndoGroup()
    
    RESPONSE FORMAT:
    Return JSON in this format:
    {
        "type": "clarification" | "confirmation" | "code",
        "content": "Your message to the user",
        "data": {
            "parameters": {"param1": "value1", ...},  // For confirmation
            "needsInput": ["param1", ...],              // For confirmation
            "code": "...",                               // For code type
            "codeType": "extendscript"                   // For code type
        }
    }
    
    EXTENDSCRIPT RULES:
    - Always wrap code in app.beginUndoGroup() and app.endUndoGroup()
    - Check for active composition before creating layers
    - Use proper coordinate system (composition width/height)
    - Handle errors gracefully
    - RGB colors are in 0-1 range, not 0-255
    
    EXAMPLE 1 - Clarification needed:
    User: "빨간 텍스트 만들어줘"
    Response:
    {
        "type": "clarification",
        "content": "텍스트 레이어를 만들어드리겠습니다. 몇 가지만 확인할게요:\\n- 텍스트 내용은 무엇인가요?\\n- 위치는 어디로 할까요? (중앙, 상단, 하단 등)",
        "data": {
            "parameters": {"color": "red", "type": "text layer"},
            "needsInput": ["text content", "position"]
        }
    }
    
    EXAMPLE 2 - Confirmation:
    User: "중앙에 '안녕하세요'로 해줘"
    Response:
    {
        "type": "confirmation",
        "content": "다음 설정으로 텍스트 레이어를 만들까요?",
        "data": {
            "parameters": {
                "text": "안녕하세요",
                "color": "red (#FF0000)",
                "position": "center",
                "fontSize": "72px"
            },
            "needsInput": []
        }
    }
    
    EXAMPLE 3 - Code generation:
    Response:
    {
        "type": "code",
        "content": "텍스트 레이어 생성 코드입니다.",
        "data": {
            "code": "app.beginUndoGroup('Create Text Layer');\\nvar comp = app.project.activeItem;\\nif (comp && comp instanceof CompItem) {\\n    var textLayer = comp.layers.addText('안녕하세요');\\n    var textProp = textLayer.property('Source Text');\\n    var textDoc = textProp.value;\\n    textDoc.fillColor = [1, 0, 0];\\n    textDoc.fontSize = 72;\\n    textProp.setValue(textDoc);\\n    textLayer.position.setValue([comp.width/2, comp.height/2]);\\n}\\napp.endUndoGroup();",
            "codeType": "extendscript"
        }
    }
    
    Remember: Be conversational, helpful, and always confirm before generating code.
    """

    # Build conversation history for Gemini
    gemini_history = []
    for msg in history[-10:]:  # Keep last 10 messages for context
        role = "user" if msg.get('role') == 'user' else "model"
        gemini_history.append({
            "role": role,
            "parts": [msg.get('content', '')]
        })
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp', system_instruction=system_instruction)
        chat = model.start_chat(history=gemini_history)
        
        # Include AE context if available
        full_prompt = user_prompt
        if context:
            full_prompt = f"[After Effects Context]\n{json.dumps(context, indent=2)}\n\n[User Request]\n{user_prompt}"
        
        response = chat.send_message(full_prompt)
        text_response = response.text.strip()
        
        # Try to parse as JSON first (conversational response)
        if text_response.startswith('{'):
            try:
                response_data = json.loads(text_response)
                
                # Return structured response
                return jsonify({
                    "status": "success",
                    "type": response_data.get('type', 'clarification'),
                    "content": response_data.get('content', ''),
                    "data": response_data.get('data', {})
                })
                
            except json.JSONDecodeError:
                # If not valid JSON, treat as plain text response
                pass
        
        # Fallback: treat as plain text or code
        if '```' in text_response or 'app.beginUndoGroup' in text_response:
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

@app.route('/crawl-product', methods=['POST'])
def crawl_product():
    """제품 상세 페이지 URL을 받아 핵심 정보를 수집합니다."""
    data = request.json or {}
    url = data.get('url')

    if not url:
        # URL이 없으면 400 에러로 응답합니다.
        return jsonify({"error": "Missing product URL"}), 400

    try:
        # 크롤러가 HTML을 다운로드하고 제품 정보를 추출합니다.
        product = crawl_product_page(url)
        return jsonify({"status": "success", "product": product})
    except requests.exceptions.RequestException as exc:
        # 네트워크/요청 오류(페이지 접근 실패 등)
        return jsonify({
            "status": "error",
            "message": "Failed to fetch product page",
            "details": str(exc)
        }), 500
    except Exception as exc:
        # HTML 파싱/데이터 추출 단계에서 발생한 오류
        return jsonify({
            "status": "error",
            "message": "Failed to parse product page",
            "details": str(exc)
        }), 500


@app.route('/generate-code', methods=['POST'])
def generate_code():
    """사용자가 확인한 파라미터로 ExtendScript 코드를 생성합니다."""
    data = request.json or {}
    api_key = data.get('apiKey')
    context = data.get('context', {})
    history = data.get('history', [])
    
    if not api_key:
        return jsonify({"error": "API Key가 필요합니다"}), 400
    
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        return jsonify({"error": "API Key 설정 실패", "details": str(e)}), 400
    
    # Build prompt for code generation
    code_gen_prompt = """
    Based on the confirmed parameters, generate executable ExtendScript code for After Effects.
    
    RULES:
    - Return ONLY valid JSON with this structure:
    {
        "type": "code",
        "content": "Brief description",
        "data": {
            "code": "... ExtendScript code here ...",
            "codeType": "extendscript"
        }
    }
    - The code must be complete and executable
    - Wrap in app.beginUndoGroup() and app.endUndoGroup()
    - Check for active composition before creating layers
    - Handle errors gracefully
    """
    
    # Get parameters from context
    params_str = json.dumps(context.get('parameters', {}), indent=2, ensure_ascii=False)
    full_prompt = f"{code_gen_prompt}\n\nConfirmed Parameters:\n{params_str}\n\nGenerate the code now."
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(full_prompt)
        text_response = response.text.strip()
        
        # Try to parse JSON
        if text_response.startswith('{'):
            try:
                response_data = json.loads(text_response)
                return jsonify({
                    "status": "success",
                    "type": response_data.get('type', 'code'),
                    "content": response_data.get('content', ''),
                    "data": response_data.get('data', {})
                })
            except json.JSONDecodeError:
                pass
        
        # Fallback: extract code from markdown
        clean_code = extract_code_from_markdown(text_response)
        if 'app.beginUndoGroup' not in clean_code:
            clean_code = f'app.beginUndoGroup("AI Action");\n{clean_code}\napp.endUndoGroup();'
        
        return jsonify({
            "status": "success",
            "code": clean_code,
            "type": "extendscript"
        })
        
    except Exception as e:
        return jsonify({"error": "코드 생성 중 오류 발생", "details": str(e)}), 500

@app.route('/generate-media', methods=['POST'])
def generate_media():
    """미디어 생성 요청을 받아 현재는 스텁 응답을 반환합니다."""
    data = request.json or {}
    media_type = data.get('type', 'image')
    prompt = data.get('prompt', '')
    resolution = data.get('resolution', '1080x1920')

    if not prompt:
        return jsonify({
            "status": "error",
            "message": "Missing prompt for generation"
        }), 400

    return jsonify({
        "status": "success",
        "type": media_type,
        "resolution": resolution,
        "mediaUrl": "",
        "message": "Generation stub (media output not implemented yet)."
    })

if __name__ == '__main__':
    port = int(os.environ.get('SERVER_PORT', 5000))
    print(f"[INFO] AfterEffectsMCP 서버 시작 (포트: {port})")
    print(f"[INFO] 임시 파일 경로: {TEMP_IMG_DIR}")
    print(f"[INFO] Pillow 사용 가능: {PILLOW_AVAILABLE}")
    app.run(host='127.0.0.1', port=port, debug=False)
