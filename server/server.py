import os
from flask import Flask, request
from dotenv import load_dotenv

from custom_exceptions import AppError, ValidationError
from response_utils import success_response, error_response
from gemini_service import GeminiService
from media_utils import ensure_temp_dir, cleanup_old_images
from crawler import crawl_product_page

# 프로젝트 루트 및 .env 설정
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(dotenv_path=env_path)

# 앱 초기화
app = Flask(__name__)
gemini_service = GeminiService()

# 임시 폴더 설정
TEMP_IMG_DIR = ensure_temp_dir(os.path.dirname(__file__))
DEFAULT_API_KEY = os.getenv('GEMINI_API_KEY')

# --- 전역 에러 핸들러 ---
@app.errorhandler(Exception)
def handle_exception(e):
    """모든 예외를 잡아 표준 JSON 포맷으로 반환"""
    if app.debug:
        app.logger.error(f"Unhandled Exception: {e}", exc_info=True)
    return error_response(e)

# --- 기본 라우트 ---
@app.route('/health', methods=['GET'])
def health_check():
    return success_response(message="Server is running")

@app.route('/test-api-key', methods=['POST'])
def test_api_key():
    """API 키 유효성 검사"""
    data = request.json or {}
    api_key = data.get('apiKey')
    
    if not api_key:
        raise ValidationError("API 키가 필요합니다.")
        
    try:
        gemini_service.process_chat("Hello", [], api_key)
        return success_response(message="API 키가 유효합니다.")
    except Exception as e:
        return error_response(e)

@app.route('/chat', methods=['POST'])
def chat():
    """메인 채팅 엔드포인트"""
    cleanup_old_images(TEMP_IMG_DIR)
    
    data = request.json or {}
    user_prompt = data.get('prompt')
    history = data.get('history', [])
    
    # API 키 우선순위: 클라이언트 > 서버 .env
    client_key = data.get('apiKey')
    api_key = client_key or DEFAULT_API_KEY
    
    # 로그
    key_source = "Client Input" if client_key else "Server .env"
    if api_key:
        print(f"[INFO] Chat Request using API Key from: {key_source} ({api_key[:4]}...)")
    
    if not user_prompt:
        raise ValidationError("프롬프트(prompt)가 비어있습니다.")
    
    if not api_key:
        raise ValidationError("API Key가 설정되지 않았습니다. 패널 설정에서 키를 입력해주세요.")
        
    # 서비스 로직 호출
    result = gemini_service.process_chat(user_prompt, history, api_key)
    
    return success_response(
        type=result['type'],
        content=result['content'],
        data=result['data']
    )

@app.route('/generate-code', methods=['POST'])
def generate_code():
    """코드 생성 전용 엔드포인트 (기존 호환성 유지)"""
    return chat()

@app.route('/crawl-product', methods=['POST'])
def crawl_product():
    """제품 페이지 크롤링 및 정보 복구"""
    data = request.json or {}
    url = data.get('url')
    
    if not url:
        raise ValidationError("URL이 필요합니다.")
        
    # 크롤링 수행
    result = crawl_product_page(url, TEMP_IMG_DIR)
    
    if result.get("status") == "error":
        raise AppError(result.get("message", "크롤링 실패"))
        
    return success_response(data=result, message="제품 정보 수집 완료")

if __name__ == '__main__':
    port = int(os.environ.get('SERVER_PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"\n🚀 AfterEffectsMCP Server Starting on Port {port}")
    if DEFAULT_API_KEY:
        print(f"🔑 Server .env Key Loaded: {DEFAULT_API_KEY[:4]}...")
    else:
        print("⚠️ No Server API Key found (Client keys will be required)")
        
    # Werkzeug 로거 필터링 (health check 로그 숨김)
    import logging
    log = logging.getLogger('werkzeug')
    class HealthCheckFilter(logging.Filter):
        def filter(self, record):
            return '/health' not in record.getMessage()
    log.addFilter(HealthCheckFilter())

    app.run(host='0.0.0.0', port=port, debug=debug_mode)
