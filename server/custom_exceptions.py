class AppError(Exception):
    """애플리케이션 기본 에러 클래스"""
    def __init__(self, message, details=None, status_code=500):
        super().__init__(message)
        self.message = message
        self.details = details
        self.status_code = status_code

class GeminiAPIError(AppError):
    """Gemini API 호출 중 발생하는 일반적인 에러"""
    def __init__(self, message, details=None, status_code=502):
        super().__init__(message, details, status_code=status_code)

class QuotaExceededError(GeminiAPIError):
    """API 사용량 한도 초과 (429)"""
    def __init__(self, message="API 사용량 한도를 초과했습니다.", details=None, status_code=429):
        super().__init__(
            message, 
            details=details or "잠시 후 다시 시도해주세요. (약 30초~1분 대기)",
            status_code=status_code
        )

class AuthenticationError(AppError):
    """API 키 인증 실패"""
    def __init__(self, message="인증에 실패했습니다.", details=None):
        super().__init__(message, details, status_code=401)

class ValidationError(AppError):
    """잘못된 요청 데이터"""
    def __init__(self, message, details=None):
        super().__init__(message, details, status_code=400)
