const csInterface = new CSInterface();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess = null;
let SERVER_PORT = 5000;
let SERVER_URL = 'http://127.0.0.1:5000';
let serverStartAttempts = 0;
const MAX_START_ATTEMPTS = 3;
const PORT_RANGE_START = 5000;
const PORT_RANGE_END = 5010;

// ==================== Conversation State Management ====================
const ConversationState = {
    IDLE: 'idle',
    CLARIFYING: 'clarifying',
    CONFIRMING: 'confirming',
    EXECUTING: 'executing'
};

let conversationState = {
    status: ConversationState.IDLE,
    context: {},
    pendingCode: null,
    history: []
};

// ==================== Python Server Management ====================
// ==================== Python Server Management ====================
// ==================== Python Server Management ====================
let isServerConnected = false;
let isStartingServer = false; // 중복 실행 방지 플래그
let connectionCheckInterval = null;

function updateConnectionStatus(connected) {
    // 상태 표시기 업데이트
    const statusDot = document.getElementById('server-status-dot');
    if (statusDot) {
        statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
        statusDot.title = connected ? '서버 연결됨' : '서버 연결 끊김';
    }

    if (isServerConnected === connected) return;

    isServerConnected = connected;
    const existingError = document.getElementById('server-error-msg');

    if (connected) {
        if (existingError) existingError.remove();
        console.log(`✅ Connected to Python server at ${SERVER_URL}`);

        // 최초 연결 시에만 환영 메시지 업데이트 (선택 사항)
        const welcomeMsg = document.querySelector('.system-msg');
        if (welcomeMsg && welcomeMsg.textContent.includes('준비가 되었습니다')) {
            welcomeMsg.innerHTML = '👋 안녕하세요! After Effects 작업을 도와드릴 준비가 되었습니다.<br><small style="color:#4caf50">✅ 서버 연결됨</small>';
        }

        isStartingServer = false;
        serverStartAttempts = 0;
    } else {
        // ... 기존 에러 메시지 로직 유지 ...
        if (!existingError && !document.querySelector('.server-connecting')) {
            const msgDiv = document.createElement('div');
            msgDiv.id = 'server-error-msg';
            msgDiv.className = 'message system-msg';
            msgDiv.style.color = '#ff6b6b';
            msgDiv.innerHTML = `
                ⚠️ 서버 연결 끊김<br>
                자동 실행을 시도 중입니다...
            `;
            chatContainer.appendChild(msgDiv);
            scrollToBottom();
        }
    }
}

// 연결 시도 중 상태 표시
function setConnectingStatus() {
    const statusDot = document.getElementById('server-status-dot');
    if (statusDot) {
        statusDot.className = 'status-dot connecting';
        statusDot.title = '서버 연결/시작 중...';
    }
}

// 헬스 체크 함수 (타임아웃 단축: 200ms)
async function checkHealth(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200); // 0.2초 타임아웃

    try {
        const response = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e) {
        clearTimeout(timeoutId);
        console.log(`Health check failed for ${url}:`, e.message); // 디버깅용 로그
        return false;
    }
}

function checkServerConnection() {
    // 서버 시작 중이거나 이미 연결된 경우 체크 스킵 (단, 연결 끊김 감지를 위해 연결 상태면 체크)
    if (isStartingServer) return;

    checkHealth(SERVER_URL).then(isOk => {
        if (isOk) {
            updateConnectionStatus(true);
        } else {
            updateConnectionStatus(false);
            // 프로세스가 없는데 연결도 안되면 시작 시도
            if (!pythonProcess && !isStartingServer) {
                findOrStartServer();
            }
        }
    });
}

// 활성 서버 찾기 또는 시작
async function findOrStartServer() {
    if (pythonProcess || isStartingServer) return; // 이미 우리가 띄운 프로세스가 있거나 시작 중이면 패스
    isStartingServer = true;
    setConnectingStatus(); // 상태 표시기: 연결/시작 중

    // console.log('Searching for active Python server...');

    // 1. 활성 서버 병렬 스캔 (모든 포트 동시 검사)
    const scanPromises = [];
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
        scanPromises.push(
            checkHealth(`http://127.0.0.1:${port}`).then(isAlive => ({ port, isAlive }))
        );
    }

    // 모든 포트 검사를 동시에 진행하여 시간 단축
    const results = await Promise.all(scanPromises);
    const activeServer = results.find(r => r.isAlive);

    if (activeServer) {
        console.log(`✅ Found active server on port ${activeServer.port}`);
        SERVER_PORT = activeServer.port;
        SERVER_URL = `http://127.0.0.1:${activeServer.port}`;
        updateConnectionStatus(true);
        // isStartingServer = false; // updateConnectionStatus 내부에서 처리됨
        return;
    }

    console.log('No active server found. Starting new instance...');
    startPythonServer();
}

function startPythonServer() {
    if (pythonProcess) {
        isStartingServer = false;
        return;
    }

    // 중복 시도 방지: 이미 MAX에 도달했으면 더 이상 시도하지 않음
    if (serverStartAttempts > MAX_START_ATTEMPTS) {
        console.log('Max server start attempts reached.');
        // 이미 에러 메시지가 있는지 확인 후 없으면 추가
        if (!document.getElementById('server-start-failed-msg')) {
            const msgDiv = document.createElement('div');
            msgDiv.id = 'server-start-failed-msg';
            msgDiv.className = 'message system-msg';
            msgDiv.style.color = '#ff6b6b';
            msgDiv.innerHTML = '⚠️ 서버 자동 시작 실패. 수동으로 서버를 시작해주세요.';
            chatContainer.appendChild(msgDiv);
            scrollToBottom();
        }
        isStartingServer = false; // 플래그 해제하여 나중에 다시 시도 가능하게 함 (선택 사항)
        return;
    }

    serverStartAttempts++;

    const extensionPath = csInterface.getSystemPath('extension');
    const serverPath = path.join(extensionPath, 'server');
    const batchFile = path.join(extensionPath, 'start_server.bat');

    // 배치 파일 존재 확인
    if (!fs.existsSync(batchFile)) {
        console.error(`Batch file not found: ${batchFile}`);
        addSystemMessage('❌ start_server.bat 파일이 없습니다.');
        isStartingServer = false;
        return;
    }

    let port = SERVER_PORT;

    function tryStartServer(port) {
        if (port > PORT_RANGE_END) {
            addSystemMessage('❌ 사용 가능한 포트를 찾을 수 없습니다.');
            isStartingServer = false;
            return;
        }

        console.log(`Starting server via batch file on port ${port}...`);

        try {
            const proc = spawn('cmd.exe', ['/c', batchFile], {
                cwd: extensionPath,
                windowsHide: true,
                env: { ...process.env, SERVER_PORT: port.toString() }
            });

            let serverStarted = false;

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Server] ${output.trim()}`);

                if (output.includes('Running on') && !serverStarted) {
                    serverStarted = true;
                    console.log(`✅ Server started on port ${port}`);
                    SERVER_PORT = port;
                    SERVER_URL = `http://127.0.0.1:${port}`;
                    updateConnectionStatus(true);
                }
            });

            proc.stderr.on('data', (data) => {
                const errorOutput = data.toString();
                console.log(`[Server Err] ${errorOutput.trim()}`);

                // 포트 충돌 감지
                if (errorOutput.includes('Address already in use') ||
                    errorOutput.includes('port is already allocated')) {
                    console.log(`Port ${port} in use, trying ${port + 1}`);
                    proc.kill();
                    setTimeout(() => tryStartServer(port + 1), 500);
                }
            });

            proc.on('error', (err) => {
                console.error(`Failed to start server: ${err.message}`);
                isStartingServer = false;
                addSystemMessage(`❌ 서버 시작 실패: ${err.message}`);
            });

            pythonProcess = proc;

            proc.on('close', (code) => {
                pythonProcess = null;
                if (code !== 0 && code !== null && !serverStarted) {
                    console.log(`Server exited with code ${code}, trying next port`);
                    setTimeout(() => tryStartServer(port + 1), 500);
                }
            });

        } catch (e) {
            console.error(`Exception starting server: ${e.message}`);
            isStartingServer = false;
            addSystemMessage(`❌ 서버 시작 오류: ${e.message}`);
        }
    }

    tryStartServer(port);

}

// Start polling for connection
setInterval(checkServerConnection, 3000);
checkServerConnection();

// Cleanup on panel close
window.onbeforeunload = function () {
    if (pythonProcess) pythonProcess.kill();
};

// ==================== UI Elements ====================
const sendBtn = document.getElementById('sendBtn');
const promptInput = document.getElementById('promptInput');
const chatContainer = document.getElementById('chat-container');
const apiKeyInput = document.getElementById('apiKeyInput');

// API Key Management - Load from config file or localStorage
function loadApiKey() {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    const apiSection = document.getElementById('api-section');

    if (savedApiKey && savedApiKey.trim() !== '') {
        apiKeyInput.value = savedApiKey;
        console.log(`✅ API key loaded from localStorage (Starts with: ${savedApiKey.substring(0, 4)}...)`);

        // API 키가 있으면 섹션을 접음
        if (apiSection) {
            apiSection.classList.add('collapsed');
        }
    } else {
        console.log('⚠️ No API key found. Please enter your Gemini API key.');

        // API 키가 없으면 섹션을 펼침
        if (apiSection) {
            apiSection.classList.remove('collapsed');
        }

        // 입력창에 포커스
        setTimeout(() => {
            if (apiKeyInput) apiKeyInput.focus();
        }, 200);
    }
}

// DOM이 완전히 로드된 후 API 키 로드
setTimeout(() => {
    loadApiKey();
}, 100);

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    console.log('API key updated in localStorage');
});

// API 키 테스트 함수
window.testApiKey = async function () {
    const apiKey = apiKeyInput.value.trim();
    const testBtn = document.getElementById('testApiBtn');
    const statusDiv = document.getElementById('apiStatus');

    if (!apiKey) {
        statusDiv.className = 'api-status show error';
        statusDiv.textContent = '❌ API 키를 먼저 입력해주세요';
        return;
    }

    // 테스트 시작
    testBtn.disabled = true;
    testBtn.textContent = '테스트 중...';
    statusDiv.className = 'api-status show loading';
    statusDiv.textContent = '🔄 Gemini API 연결 테스트 중...';

    try {
        const response = await fetch(`${SERVER_URL}/test-api-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKey }),
            timeout: 15000
        });

        const data = await response.json();

        if (data.status === 'success') {
            // 성공: localStorage에 저장
            localStorage.setItem('gemini_api_key', apiKey);
            statusDiv.className = 'api-status show success';
            statusDiv.innerHTML = `${data.message}<br><small>${data.details || ''}</small>`;

            // 3초 후 API 섹션 자동 닫기
            setTimeout(() => {
                document.getElementById('api-section').classList.add('collapsed');
            }, 3000);
        } else {
            // 실패
            statusDiv.className = 'api-status show error';
            statusDiv.innerHTML = `${data.message}<br><small>${data.details || ''}</small>`;
        }
    } catch (error) {
        statusDiv.className = 'api-status show error';
        statusDiv.innerHTML = `❌ 서버 연결 실패<br><small>${error.message}</small>`;
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '테스트';
    }
};

// ==================== Message Rendering Functions ====================

// 간단한 마크다운 파서 (Bold, Italic, Header, List, Line break)
function parseMarkdown(text) {
    if (!text) return '';

    // 1. HTML 이스케이프 (보안)
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Headers (먼저 처리 - 줄 단위)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 3. Horizontal Rule
    html = html.replace(/^---$/gm, '<hr>');

    // 4. Bold (**text**) - 이스케이프된 `*`가 아닌지 확인
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

    // 5. Italic (*text*) - Bold와 겹치지 않도록 주의
    // Bold 이후에 처리하되, **로 둘러싸이지 않은 단일 *만 매칭
    html = html.replace(/(?<!\*)\*([^\*]+)\*(?!\*)/g, '<em>$1</em>');

    // 6. Unordered List (- item 또는 * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '• $1');

    // 7. Code inline (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 8. Line breaks (\n)
    html = html.replace(/\n/g, '<br>');

    return html;
}

function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-msg';
    // 사용자는 줄바꿈만 처리
    messageDiv.innerHTML = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    conversationState.history.push({ role: 'user', content: text });
}

function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-msg';

    // 마크다운 파싱 적용
    const contentDiv = document.createElement('div');
    contentDiv.className = 'msg-content'; // 스타일 적용을 위해 클래스 추가
    contentDiv.innerHTML = parseMarkdown(text);

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    conversationState.history.push({ role: 'assistant', content: text });
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-msg';
    messageDiv.innerHTML = text.replace(/\n/g, '<br>'); // 시스템 메시지도 줄바꿈 지원
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

// ==================== Keyboard & Input Handling ====================

// Textarea Auto-Resize
promptInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Shift+Enter Logic
promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // 기본 줄바꿈 방지
        sendBtn.click();    // 전송

        // 전송 후 높이 초기화
        this.style.height = 'auto';
    }
});

function renderConfirmationMessage(data) {
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'message bot-confirmation';

    // 파라미터 리스트 생성
    let paramsHTML = '';
    if (Object.keys(data.parameters).length > 0) {
        paramsHTML = '<div class="confirm-params">';
        for (const [key, value] of Object.entries(data.parameters)) {
            paramsHTML += `<div class="param-item">
                <span class="param-label">${key}:</span>
                <span class="param-value">${value}</span>
            </div>`;
        }
        paramsHTML += '</div>';
    }

    // 추가 입력 필요 항목
    let needsInputHTML = '';
    if (data.needsInput && data.needsInput.length > 0) {
        needsInputHTML = '<div class="needs-input-alert">⚠️ 추가 정보 필요: ' +
            data.needsInput.join(', ') + '</div>';
    }

    // 1. 내용 HTML
    const contentHtml = `
        <div class="confirmation-title">${data.title || '📝 설정을 확인해주세요'}</div>
        ${data.message ? `<div style="margin-bottom: 12px;">${data.message}</div>` : ''}
        ${paramsHTML}
        ${needsInputHTML}
    `;

    // 2. 버튼 생성
    const actionButtonsDiv = document.createElement('div');
    actionButtonsDiv.className = 'action-buttons';

    const modifyBtn = document.createElement('button');
    modifyBtn.className = 'btn-warning';
    modifyBtn.textContent = '수정하기';
    modifyBtn.onclick = function () {
        this.disabled = true;
        this.nextElementSibling.disabled = true;
        handleModifyRequest();
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-primary';
    confirmBtn.textContent = '이대로 진행';
    confirmBtn.onclick = function () {
        this.disabled = true;
        this.textContent = '진행 중...';
        this.previousElementSibling.disabled = true;
        handleConfirmRequest();
    };

    actionButtonsDiv.appendChild(modifyBtn);
    actionButtonsDiv.appendChild(confirmBtn);

    // 3. 조립
    confirmDiv.innerHTML = contentHtml;
    confirmDiv.appendChild(actionButtonsDiv);

    chatContainer.appendChild(confirmDiv);
    scrollToBottom();

    conversationState.status = ConversationState.CONFIRMING;
    conversationState.context = data;
}

function renderCodePreview(code, type = 'extendscript') {
    const codeDiv = document.createElement('div');
    codeDiv.className = 'message bot-confirmation';

    // 1. 헤더 및 코드 미리보기 영역
    const headerHtml = `
        <div class="confirmation-title">✅ 코드 생성 완료</div>
        <div class="code-preview-container">
            <div class="code-header" onclick="toggleCodePreview(this)">
                <span class="code-title">📄 코드 미리보기 (${type})</span>
                <span class="code-toggle">▼</span>
            </div>
            <div class="code-content">
                <pre>${escapeHtml(code)}</pre>
            </div>
        </div>
    `;

    // 2. 버튼 영역 컨테이너 생성
    const actionButtonsDiv = document.createElement('div');
    actionButtonsDiv.className = 'action-buttons';

    // 3. 취소 버튼
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-danger';
    cancelBtn.textContent = '취소';
    cancelBtn.onclick = function () {
        this.disabled = true;
        this.textContent = '취소됨';
        const execBtn = this.nextElementSibling;
        if (execBtn) execBtn.disabled = true;
        handleCancelExecution();
    };

    // 4. 실행 버튼
    const executeBtn = document.createElement('button');
    executeBtn.className = 'btn-success';
    executeBtn.textContent = '실행';
    executeBtn.onclick = function () {
        this.disabled = true;
        this.textContent = '실행 중...';
        const cnclBtn = this.previousElementSibling;
        if (cnclBtn) cnclBtn.disabled = true;
        handleExecuteCode(code); // 클로저로 코드 전달
    };

    actionButtonsDiv.appendChild(cancelBtn);
    actionButtonsDiv.appendChild(executeBtn);

    // 5. 조립
    codeDiv.innerHTML = headerHtml;
    codeDiv.appendChild(actionButtonsDiv);

    chatContainer.appendChild(codeDiv);
    scrollToBottom();

    conversationState.status = ConversationState.CONFIRMING;
    conversationState.pendingCode = code;
}

// ==================== Action Handlers (Global for onclick) ====================

window.handleModifyRequest = function () {
    conversationState.status = ConversationState.CLARIFYING;
    promptInput.focus();
    addSystemMessage('💬 수정 사항을 입력해주세요');
};

window.handleConfirmRequest = async function () {
    addSystemMessage('✅ 확인되었습니다. 코드를 생성합니다...');
    conversationState.status = ConversationState.EXECUTING;

    showTypingIndicator();

    // Request code generation from server
    try {
        const apiKey = apiKeyInput.value;
        const response = await fetch(`${SERVER_URL}/generate-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: apiKey,
                context: conversationState.context,
                history: conversationState.history
            })
        });

        hideTypingIndicator();

        if (!response.ok) {
            addBotMessage('❌ 코드 생성에 실패했습니다.');
            conversationState.status = ConversationState.IDLE;
            return;
        }

        const data = await response.json();

        if (data.code) {
            renderCodePreview(data.code, data.type || 'extendscript');
        } else {
            addBotMessage('❌ 코드가 생성되지 않았습니다.');
            conversationState.status = ConversationState.IDLE;
        }

    } catch (error) {
        hideTypingIndicator();
        addBotMessage(`❌ 오류: ${error.message}`);
        conversationState.status = ConversationState.IDLE;
    }
};

window.handleCancelExecution = function () {
    addSystemMessage('❌ 실행이 취소되었습니다.');
    conversationState.status = ConversationState.IDLE;
    conversationState.pendingCode = null;
};

window.handleExecuteCode = function (code) {
    // 1. 실행할 코드 결정 (인자 우선, 없으면 상태값 사용)
    const scriptToRun = code || conversationState.pendingCode;

    if (!scriptToRun) {
        addSystemMessage('❌ 실행할 코드가 없습니다.');
        return;
    }

    addSystemMessage('⚙️ After Effects에서 코드 실행 중...');

    // 2. 코드 실행 (래핑 없이 그대로 전달)
    // 주석: AI가 이미 try-catch와 undoGroup을 포함한 코드를 생성하므로 중복 래핑을 제거함.
    csInterface.evalScript(scriptToRun, (result) => {
        // ExtendScript 오류 체크
        if (result && result.toString().startsWith('EvalScript error')) {
            addBotMessage(`❌ 스크립트 실행 오류가 발생했습니다.`);
            addSystemMessage(`상세: ${result}`);
            return;
        }

        if (result === 'undefined' || result === '' || result === 'null') {
            addSystemMessage('✅ 코드 실행 완료! (Ctrl+Z로 되돌릴 수 있습니다)');
        } else {
            addSystemMessage(`✅ 실행 결과: ${result}`);
        }

        conversationState.status = ConversationState.IDLE;
        conversationState.pendingCode = null;
    });
};

window.toggleCodePreview = function (headerElement) {
    const content = headerElement.nextElementSibling;
    const toggle = headerElement.querySelector('.code-toggle');

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggle.textContent = '▼';
    } else {
        content.classList.add('collapsed');
        toggle.textContent = '▶';
    }
};

// ==================== Main Chat Handler ====================

sendBtn.addEventListener('click', async () => {
    // 1. 서버 연결 확인
    if (!isServerConnected) {
        // 이미 경고 메시지가 있거나 시작 중이면 추가 메시지 띄우지 않음
        if (!document.querySelector('.server-connecting') && !isStartingServer) {
            addSystemMessage('⚠️ Python 서버와 연결되지 않았습니다. 잠시만 기다려주세요.');
        }
        checkServerConnection(); // 즉시 재확인
        return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // 2. API Key 확인
    const currentApiKey = apiKeyInput.value.trim() || localStorage.getItem('gemini_api_key');
    if (!currentApiKey && !loadApiKey()) { // loadApiKey tries to find key
        alert('API Key를 먼저 설정해주세요.');
        document.getElementById('api-section').classList.remove('collapsed');
        apiKeyInput.focus();
        return;
    }

    // 3. UI 상태 변경
    addUserMessage(prompt);
    promptInput.value = '';
    sendBtn.disabled = true;
    promptInput.disabled = true;
    showTypingIndicator();

    // 4. AE 컨텍스트 가져오기
    csInterface.evalScript('getProjectContext()', async (contextResult) => {
        let contextJson = {};
        try {
            contextJson = JSON.parse(contextResult);
        } catch (e) {
            console.warn('Context parse error:', e);
        }

        try {
            // 5. 서버에 요청 전송
            const response = await fetch(`${SERVER_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    apiKey: currentApiKey,
                    context: contextJson,
                    history: conversationState.history,
                    state: conversationState.status
                })
            });

            hideTypingIndicator();

            // 6. 오류 응답 처리
            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    let errorMsg = '❌ 서버 오류가 발생했습니다';
                    if (errorData.error) errorMsg = `❌ ${errorData.error}`;
                    if (errorData.message) errorMsg += `\n${errorData.message}`;

                    addBotMessage(errorMsg);

                    if (errorData.details) {
                        addSystemMessage(`상세: ${errorData.details}`);
                    }
                    if (errorData.stack) {
                        console.error('Server error stack:', errorData.stack);
                    }
                } catch (e) {
                    addBotMessage(`❌ 서버 오류 (${response.status})`);
                    addSystemMessage('서버에서 예상치 못한 응답을 받았습니다.');
                }
                return;
            }

            // 7. 성공 응답 처리
            const data = await response.json();
            console.log('Server response:', data);

            if (data.status === 'error') {
                addBotMessage(`❌ 오류: ${data.message || '알 수 없는 오류'}`);
                if (data.details) addSystemMessage(data.details);
                return;
            }

            // 응답 타입별 처리
            switch (data.type) {
                case 'clarification':
                    addBotMessage(data.content);
                    conversationState.status = ConversationState.CLARIFYING;
                    break;

                case 'confirmation':
                    const params = (data.data && data.data.parameters) ? data.data.parameters : {};
                    const needsInput = (data.data && data.data.needsInput) ? data.data.needsInput : [];
                    renderConfirmationMessage({
                        title: data.title || '설정 확인',
                        message: data.content,
                        parameters: params,
                        needsInput: needsInput
                    });
                    break;

                case 'code':
                    if (data.data && data.data.code) {
                        renderCodePreview(data.data.code, data.data.type || 'javascript');
                    } else {
                        addBotMessage('코드가 생성되었지만 표시할 내용이 없습니다.');
                        console.error('Invalid code response:', data);
                    }
                    break;

                default:
                    addBotMessage(data.content || '처리되었습니다.');
            }

        } catch (error) {
            hideTypingIndicator();
            console.error('Network/Client error:', error);
            addBotMessage(`❌ 네트워크 오류: ${error.message}`);
            addSystemMessage('Python 서버 연결 상태를 확인해주세요.');
        } finally {
            sendBtn.disabled = false;
            promptInput.disabled = false;
            // 입력창 포커스
            setTimeout(() => promptInput.focus(), 100);
        }
    }); // end of csInterface.evalScript
}); // end of sendBtn.addEventListener

// ==================== Utility Functions ====================

function scrollToBottom() {
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

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

// ==================== Keyboard Shortcuts ====================

promptInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

console.log('AfterEffectsMCP Client Loaded');
