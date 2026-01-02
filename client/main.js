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
let isServerConnected = false;
let connectionCheckInterval = null;

function updateConnectionStatus(connected) {
    if (isServerConnected === connected) return;

    isServerConnected = connected;
    const existingError = document.getElementById('server-error-msg');

    if (connected) {
        if (existingError) existingError.remove();
        addSystemMessage('✅ Python 서버에 연결되었습니다.');
    } else {
        // Only show error if not already showing
        if (!existingError && !document.querySelector('.server-connecting')) {
            const msgDiv = document.createElement('div');
            msgDiv.id = 'server-error-msg';
            msgDiv.className = 'message system-msg';
            msgDiv.style.color = '#ff6b6b';
            msgDiv.innerHTML = `
                ⚠️ 서버 연결 끊김<br>
                자동 실행을 시도 중입니다...<br>
                연결되지 않으면 터미널에서 직접 실행해주세요:<br>
                <code style="background:#333;padding:2px 4px;border-radius:3px;">python server.py</code>
            `;
            chatContainer.appendChild(msgDiv);
            scrollToBottom();
        }
    }
}

function checkServerConnection() {
    fetch(`${SERVER_URL}/health`)
        .then(response => {
            if (response.ok) {
                updateConnectionStatus(true);
            } else {
                updateConnectionStatus(false);
            }
        })
        .catch(() => {
            updateConnectionStatus(false);
            // If connection fails, try to start the server again if not already running
            if (!pythonProcess) {
                startPythonServer();
            }
        });
}

function startPythonServer() {
    // If we already have a running process, don't start another
    if (pythonProcess) {
        console.log('Python process already running, skipping start');
        return;
    }

    serverStartAttempts++;
    if (serverStartAttempts > MAX_START_ATTEMPTS) {
        console.log('Max server start attempts reached. Please start server manually.');
        addSystemMessage('⚠️ 서버 자동 시작 실패. 수동으로 서버를 시작해주세요.');
        return;
    }

    // 서버 경로 설정 (CSInterface 기준)
    const extensionPath = csInterface.getSystemPath('extension');
    const serverPath = path.join(extensionPath, 'server');

    // Python 실행 명령어 우선순위
    const pythonCommands = [
        // 1. 사용자 환경별 특정 경로 (필요시 추가)
        'C:\\Users\\kksu1\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
        // 2. 일반적인 시스템 PATH
        'python',
        'python3',
        'py'
    ];

    let cmdIndex = 0;
    let portIndex = SERVER_PORT;

    function tryStartServer(cmdIndex, port) {
        if (cmdIndex >= pythonCommands.length) {
            // Try next port if available
            if (port < PORT_RANGE_END) {
                console.log(`All Python commands failed on port ${port}, trying port ${port + 1}`);
                SERVER_PORT = port + 1;
                SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
                addSystemMessage(`🔄 포트 ${port}가 사용 중입니다. 포트 ${SERVER_PORT}로 재시도...`);
                setTimeout(() => tryStartServer(0, SERVER_PORT), 1000);
            } else {
                console.log('All ports exhausted. Waiting for manual start.');
                addSystemMessage('❌ 사용 가능한 포트를 찾을 수 없습니다. 수동으로 서버를 시작해주세요.');
            }
            return;
        }

        const pythonCmd = pythonCommands[cmdIndex];
        const serverScript = path.join(serverPath, 'server.py');

        console.log(`Attempting to start server with ${pythonCmd} on port ${port} (attempt ${serverStartAttempts}/${MAX_START_ATTEMPTS})`);

        try {
            const proc = spawn(pythonCmd, [serverScript], {
                cwd: serverPath,
                windowsHide: true,
                env: { ...process.env, SERVER_PORT: port.toString() }
            });

            let stdoutData = '';
            let stderrData = '';
            let hasError = false;

            proc.stdout.on('data', (data) => {
                stdoutData += data.toString();
                console.log(`[Python Server ${port}] ${data}`);

                // Check if server started successfully
                if (stdoutData.includes('Running on') || stdoutData.includes('서버 시작')) {
                    console.log(`✅ Server successfully started on port ${port}`);
                    addSystemMessage(`✅ Python 서버가 포트 ${port}에서 시작되었습니다.`);
                    serverStartAttempts = 0; // Reset attempts on success
                }
            });

            proc.stderr.on('data', (data) => {
                stderrData += data.toString();
                console.log(`[Python Server ${port} Err] ${data}`);

                // Check for port conflict
                if (stderrData.includes('Address already in use') ||
                    stderrData.includes('port is already allocated') ||
                    stderrData.includes('포트') && stderrData.includes('사용')) {
                    hasError = true;
                    console.log(`Port ${port} is in use, will try next port`);
                }
            });

            proc.on('error', (err) => {
                console.log(`Failed to start with ${pythonCmd}: ${err.message}`);
                tryStartServer(cmdIndex + 1, port);
            });

            // Set the process reference immediately if spawn succeeds
            pythonProcess = proc;

            proc.on('close', (code) => {
                pythonProcess = null;

                if (code !== 0) {
                    if (hasError || stderrData.includes('Address already in use')) {
                        // Port conflict, try next port
                        if (port < PORT_RANGE_END) {
                            SERVER_PORT = port + 1;
                            SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
                            console.log(`Port conflict detected, trying port ${SERVER_PORT}`);
                            setTimeout(() => tryStartServer(0, SERVER_PORT), 500);
                        } else {
                            console.log('All ports exhausted');
                            addSystemMessage('❌ 사용 가능한 포트를 찾을 수 없습니다.');
                        }
                    } else {
                        // Other error, try next Python command
                        console.log(`Python command exited with code ${code}, trying next command`);
                        tryStartServer(cmdIndex + 1, port);
                    }
                } else {
                    // Server exited cleanly, might need restart
                    console.log('Server process exited cleanly');
                    setTimeout(() => {
                        if (!pythonProcess) startPythonServer();
                    }, 2000);
                }
            });

        } catch (e) {
            console.log(`Exception starting with ${pythonCmd}: ${e.message}`);
            tryStartServer(cmdIndex + 1, port);
        }
    }

    tryStartServer(0, SERVER_PORT);
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
    // config.json 로드 로직 제거 (보안 강화)
    // 오직 localStorage에 저장된 키만 사용합니다.
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey && savedApiKey.trim() !== '') {
        apiKeyInput.value = savedApiKey;
        // 마스킹 처리된 키 로그 (보안)
        console.log(`✅ API key loaded from localStorage (Starts with: ${savedApiKey.substring(0, 4)}...)`);
    } else {
        console.log('⚠️ No API key found. Please enter your Gemini API key.');
        // 키가 없으면 입력창을 펼쳐서 보여줌
        document.getElementById('api-section').classList.remove('collapsed');
        apiKeyInput.focus();
    }
}

loadApiKey();

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

    // 2. Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 3. Italic (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 4. Headers (### text)
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // 5. Unordered List (- item)
    // 간단하게 - 로 시작하는 줄을 감지하되, 리스트 태그(ul)로 감싸는 건 복잡하므로 
    // 그냥 bullet point 문자로 치환하고 줄바꿈 처리
    html = html.replace(/^- (.*$)/gm, '• $1');

    // 6. Horizontal Rule (---)
    html = html.replace(/^---$/gm, '<hr>');

    // 7. Line breaks (\n)
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
        addSystemMessage('⚠️ Python 서버와 연결되지 않았습니다. 잠시만 기다려주세요.');
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
