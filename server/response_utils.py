from flask import jsonify
from custom_exceptions import AppError

def success_response(data=None, message="Success", type=None, content=None):
    """성공 응답 표준 포맷"""
    response = {
        "status": "success",
        "message": message
    }
    if data is not None:
        response["data"] = data
    if type is not None:
        response["type"] = type
    if content is not None:
        response["content"] = content
        
    return jsonify(response), 200

def error_response(exception):
    """에러 응답 표준 포맷"""
    status_code = 500
    error_message = "서버 내부 오류 발생"
    details = str(exception)
    
    # 커스텀 예외인 경우 정보 추출
    if isinstance(exception, AppError):
        status_code = exception.status_code
        error_message = exception.message
        details = exception.details
        
    return jsonify({
        "status": "error",
        "error": exception.__class__.__name__,
        "message": error_message,
        "details": details
    }), status_code
