// ==================== Utility Functions ====================

// 로그 창에 시스템 메시지 기록
function addLog(message) {
    const logBox = document.getElementById('server-log-box');
    if (logBox) {
        const timestamp = new Date().toLocaleTimeString();
        logBox.innerHTML += `\n[${timestamp}] ${message}`;
        logBox.scrollTop = logBox.scrollHeight;
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
