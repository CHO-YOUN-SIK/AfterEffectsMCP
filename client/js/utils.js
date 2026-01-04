// ==================== Utility Functions ====================

// 로그 창에 시스템 메시지 기록
function addLog(message) {
    const logBox = document.getElementById('server-log-box');
    if (logBox) {
        const timestamp = new Date().toLocaleTimeString();
        logBox.innerHTML += `\n[${timestamp}] ${message}`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    // 로딩 화면에도 상태 표시
    const splashStatus = document.getElementById('splash-status');
    if (splashStatus) {
        splashStatus.textContent = message.length > 50 ? message.substring(0, 50) + '...' : message;
        // 에러 메시지면 빨간색
        if (message.includes('Error') || message.includes('실패') || message.includes('failed')) {
            splashStatus.style.color = '#f85149';
        } else {
            splashStatus.style.color = '#888';
        }
    }

    // 🆕 파일 로깅 (디버그용)
    try {
        const fs = require('fs');
        const logPath = 'C:/ae_panel_debug.txt';
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
    } catch (fileErr) {
        // 파일 쓰기 실패해도 패널은 멈추지 않음
    }

    // console.log에도 남김
    console.log(`[Log] ${message}`);
}

// 스크롤을 최하단으로 이동
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        // 즉시는 안될 때가 있어 약간 지연
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }
}

// HTML 특수문자 이스케이프 (보안)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
