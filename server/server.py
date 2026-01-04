import os
from flask import Flask, request, jsonify
from flask_cors import CORS
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
CORS(app) # Enable CORS for all routes
gemini_service = GeminiService()
# crawler_service removed
DOWNLOAD_DIR = os.path.join(project_root, 'downloads')
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

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

@app.route('/analyze-url', methods=['POST'])
def analyze_url():
    """URL을 분석하여 텍스트 요약과 이미지를 다운로드"""
    try:
        data = request.json
        url = data.get('url')
        if not url:
            raise ValidationError("URL이 필요합니다.")
        
        set_status(f"URL 분석 시작: {url}")
        
        # 1. 크롤링 실행 (이미지 다운로드 포함)
        result = crawl_product_page(url, DOWNLOAD_DIR)
        
        if result['status'] == 'error':
            raise AppError(f"크롤링 실패: {result.get('message')}")
        
        # 2. 이미지 경로 절대경로 변환
        saved_images = []
        for p in result.get('images', []):
            abs_path = os.path.abspath(p).replace('\\', '/')
            saved_images.append(abs_path)
            
        set_status("URL 분석 완료")
        
        return success_response({
            "title": result['title'],
            "content": result['description'], # crawler.py returns 'description'
            "images": saved_images
        })
        
    except Exception as e:
        return error_response(e)

# 작업 상태 관리 (단일 사용자 로컬 환경 가정)
job_status = {
    "message": "대기 중",
    "step": "idle"
}

def set_status(msg, step="processing"):
    global job_status
    job_status["message"] = msg
    job_status["step"] = step
    print(f"[Status] {msg}")

@app.route('/status', methods=['GET'])
def get_status():
    """현재 작업 상태 반환"""
    return success_response(data=job_status)

@app.route('/test-api-key', methods=['POST'])
def test_api_key():
    """API 키 유효성 검사"""
    data = request.json or {}
    api_key = data.get('apiKey')
    
    if not api_key:
        raise ValidationError("API 키가 필요합니다.")
        
    try:
        set_status("API 키 테스트 중...", "testing")
        gemini_service.process_chat("Hello", [], api_key)
        set_status("대기 중", "idle")
        return success_response(message="API 키가 유효합니다.")
    except Exception as e:
        set_status("오류 발생", "error")
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
    
    if not user_prompt:
        raise ValidationError("프롬프트(prompt)가 비어있습니다.")
    
    if not api_key:
        raise ValidationError("API Key가 설정되지 않았습니다.")

    try:
        # 1. 상태: 분석 중
        set_status("요청을 분석하고 있습니다...", "analyzing")
        
        # 2. URL 감지 및 크롤링 상태 업데이트 (간단한 체크)
        if "http" in user_prompt:
            set_status("웹사이트 정보를 수집하고 있습니다 (이미지 다운로드 중)...", "crawling")
        
        # 클라이언트에서 첨부한 파일 경로 (로컬 절대 경로)
        uploaded_images = data.get('imagePaths', [])
        
        # 실제 서비스 호출 (여기서 로직 수행)
        result = gemini_service.process_chat(user_prompt, history, api_key, image_paths=uploaded_images)
        
        set_status("완료", "idle")
        
        return success_response(
            type=result['type'],
            content=result['content'],
            data=result['data']
        )
    except Exception as e:
        set_status("오류 발생", "error")
        raise e

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
