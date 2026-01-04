// ==================== UI Manager ====================
let isFirstConnection = true;

// 전역 UI 요소 참조 헬퍼
function getChatContainer() {
    return document.getElementById('chat-container');
}

function updateConnectionStatus(isConnected) {
    const statusDot = document.getElementById('server-status-dot');
    const modalDot = document.getElementById('modal-server-status');
    const statusText = document.getElementById('server-status-text'); // May be null

    const className = isConnected ? 'status-dot connected' : 'status-dot disconnected';
    const title = isConnected ? '서버 연결됨' : '서버 연결 끊김';

    if (statusDot) {
        statusDot.className = className;
        statusDot.title = title;
    }

    if (modalDot) {
        modalDot.className = className;
        modalDot.title = title;
    }

    if (statusText) {
        statusText.textContent = isConnected ? '연결됨' : '연결 끊김';
        statusText.style.color = isConnected ? '#4caf50' : '#666';
    }

    // [New] 최초 연결 시 로딩 화면 제거 -> 설정창 오픈
    if (isConnected && isFirstConnection) {
        isFirstConnection = false;

        const splash = document.getElementById('splash-screen');
        if (splash) {
            // 성공 메시지로 변경 후 잠시 대기
            const h3 = splash.querySelector('h3');
            if (h3) {
                h3.innerText = '✅ 서버 연결 성공!';
                h3.style.color = '#4caf50';
            }
            const statusDiv = document.getElementById('splash-status');
            if (statusDiv) statusDiv.innerText = '설정 화면으로 이동합니다...';

            setTimeout(() => {
                splash.style.opacity = '0';
                splash.style.transition = 'opacity 0.6s ease';

                setTimeout(() => {
                    splash.style.display = 'none';
                    // 여기서 모달 오픈!
                    if (window.openSetupModal) window.openSetupModal();
                }, 600);
            }, 800);
        }
    }
}

function addSystemMessage(text) {
    const chatContainer = getChatContainer();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system-msg';
    msgDiv.innerHTML = `🔔 ${text}`; // 아이콘 추가
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function addBotMessage(text) {
    const chatContainer = getChatContainer();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message';

    // 마크다운 파싱 (marked 라이브러리 가정)
    if (typeof marked !== 'undefined') {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }

    chatContainer.appendChild(msgDiv);

    // 코드 블록 하이라이팅
    msgDiv.querySelectorAll('pre code').forEach((block) => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });

    scrollToBottom();
}

function addUserMessage(text, imagePaths = []) {
    const chatContainer = getChatContainer();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user-message';

    let contentHtml = `<div class="message-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;

    if (imagePaths && imagePaths.length > 0) {
        contentHtml += `<div class="image-preview-container" style="margin-top:8px; display:flex; gap:5px; flex-wrap:wrap;">`;
        imagePaths.forEach(path => {
            contentHtml += `<img src="${path}" style="max-width:100px; max-height:100px; border-radius:4px; border:1px solid #444;">`;
        });
        contentHtml += `</div>`;
    }

    msgDiv.innerHTML = contentHtml;
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'block';
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.style.display = 'none';
}

function renderCodePreview(code, language = 'javascript') {
    const chatContainer = getChatContainer();
    const previewId = 'code-preview-' + Date.now();

    const container = document.createElement('div');
    container.className = 'code-preview-container';
    container.style.marginTop = '10px';
    container.style.marginBottom = '10px';
    container.style.border = '1px solid #333';
    container.style.borderRadius = '6px';
    container.style.background = '#1e1e1e';

    const header = document.createElement('div');
    header.style.padding = '8px 12px';
    header.style.background = '#252526';
    header.style.borderBottom = '1px solid #333';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    header.innerHTML = `
        <span style="font-size:12px; color:#cccccc;">📄 Generated Code (${language})</span>
        <button onclick="toggleCodePreview('${previewId}')" style="background:none; border:none; color:#0078d4; cursor:pointer; font-size:12px;">
            Show/Hide
        </button>
    `;

    const content = document.createElement('div');
    content.id = previewId;
    content.style.display = 'block'; // 기본으로 펼침
    content.style.padding = '10px';
    content.style.overflowX = 'auto';

    content.innerHTML = `
        <pre style="margin:0;"><code class="language-${language}">${escapeHtml(code)}</code></pre>
    `;

    container.appendChild(header);
    container.appendChild(content);
    chatContainer.appendChild(container); // insertBefore 대신 append

    if (typeof hljs !== 'undefined') {
        hljs.highlightElement(content.querySelector('code'));
    }

    scrollToBottom();
}

function toggleCodePreview(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = (el.style.display === 'none') ? 'block' : 'none';
    }
}

function renderConfirmationMessage(data) {
    const chatContainer = getChatContainer();

    const container = document.createElement('div');
    container.className = 'message bot-message confirmation-box';
    container.style.border = '1px solid #0078d4';
    container.style.background = '#1b2a38';

    let html = `<div style="font-weight:bold; margin-bottom:8px; color:#61dafb;">${data.title}</div>`; // escapeHtml(data.title)
    html += `<div style="margin-bottom:10px;">${data.message || data.content}</div>`;

    // 파라미터 (읽기 전용 표시)
    if (data.parameters && Object.keys(data.parameters).length > 0) {
        html += `<div style="background:#000; padding:8px; border-radius:4px; margin-bottom:10px; font-family:monospace; font-size:0.9em;">`;
        for (const [key, val] of Object.entries(data.parameters)) {
            html += `<div style="display:flex; justify-content:space-between;">
                <span style="color:#aaa;">${key}:</span>
                <span style="color:#fff;">${val}</span>
             </div>`;
        }
        html += `</div>`;
    }

    // 입력 필드 (Needs Input)
    if (data.needsInput && data.needsInput.length > 0) {
        html += `<div style="margin-bottom:10px;">`;
        data.needsInput.forEach(field => {
            html += `<div style="margin-bottom:5px;">
                <label style="display:block; font-size:0.8em; color:#aaa;">${field.label || field.name}</label>
                <input type="text" id="input-${field.name}" class="param-input" placeholder="${field.description || ''}" 
                       style="width:100%; padding:5px; background:#333; border:1px solid #555; color:white; border-radius:3px;">
            </div>`;
        });
        html += `</div>`;
    }

    // 버튼
    html += `
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button class="confirm-btn" onclick="handleConfirm()" style="flex:1; padding:6px; background:#0078d4; color:white; border:none; border-radius:3px; cursor:pointer;">실행 (Yes)</button>
            <button class="modify-btn" onclick="handleModifyRequest()" style="flex:1; padding:6px; background:#444; color:white; border:none; border-radius:3px; cursor:pointer;">수정 (Modify)</button>
             <button class="cancel-btn" onclick="handleCancel()" style="flex:1; padding:6px; background:#d32f2f; color:white; border:none; border-radius:3px; cursor:pointer;">취소 (No)</button>
        </div>
    `;

    container.innerHTML = html;
    chatContainer.appendChild(container);
    scrollToBottom();
}

// ==================== Modal Controls ====================

window.openSetupModal = function () {
    const modal = document.getElementById('setup-modal');
    modal.classList.add('active');

    // 저장된 키 로드
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        document.getElementById('modal-api-key').value = savedKey;
    }

    setTimeout(() => document.getElementById('modal-api-key').focus(), 100);
};

window.closeSetupModal = function () {
    const modal = document.getElementById('setup-modal');
    modal.classList.remove('active');
};

// 로그 토글 (전역)
window.toggleServerLog = function () {
    const content = document.getElementById('server-log-content');
    const toggle = document.getElementById('server-log-toggle');
    if (content && toggle) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        toggle.textContent = isHidden ? '▲' : '▼';
    }
};
