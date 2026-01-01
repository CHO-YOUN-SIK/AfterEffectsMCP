const csInterface = new CSInterface();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess = null;
const SERVER_URL = 'http://127.0.0.1:5000';

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
    // If we already tried starting recently or have a process, verify it first
    if (pythonProcess) return;

    const platformPaths = {
        win32: path.join(csInterface.getSystemPath('extension'), '..', '..', '..', '..', 'server'),
        darwin: path.join(csInterface.getSystemPath('extension'), '../../../../server'),
        default: path.join(csInterface.getSystemPath('extension'), '../../../../server')
    };

    const serverPath = platformPaths[process.platform] || platformPaths.default;
    const pythonCommands = [
        'python',
        'python3',
        'py',
        // Windows Store Python path
        'C:\\Users\\kksu1\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\python.exe',
        // Common default paths
        'C:\\Python313\\python.exe',
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe'
    ];

    let cmdIndex = 0;

    function tryStartServer(cmdIndex) {
        if (cmdIndex >= pythonCommands.length) {
            console.log('Automated server start failed. Waiting for manual start.');
            return;
        }

        const pythonCmd = pythonCommands[cmdIndex];
        const serverScript = path.join(serverPath, 'server.py');

        try {
            const proc = spawn(pythonCmd, [serverScript], {
                cwd: serverPath,
                windowsHide: true
            });

            proc.on('error', (err) => {
                tryStartServer(cmdIndex + 1);
            });

            // If process spawns successfully, we set it
            pythonProcess = proc;

            // But we don't declare success until /health check passes
            // Just log output for debugging
            proc.stdout.on('data', (data) => console.log(`[Py] ${data}`));
            proc.stderr.on('data', (data) => console.log(`[Py Err] ${data}`));

            proc.on('close', (code) => {
                pythonProcess = null;
                if (code !== 0) tryStartServer(cmdIndex + 1);
            });

        } catch (e) {
            tryStartServer(cmdIndex + 1);
        }
    }

    tryStartServer(0);
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

// API Key localStorage
apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
});

// ==================== Message Rendering Functions ====================

function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-msg';
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    conversationState.history.push({ role: 'user', content: text });
}

function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-msg';
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();

    conversationState.history.push({ role: 'assistant', content: text });
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-msg';
    messageDiv.textContent = text;
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

function renderConfirmationMessage(data) {
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'message bot-confirmation';

    let paramsHTML = '';
    if (data.parameters && Object.keys(data.parameters).length > 0) {
        paramsHTML = '<div class="confirmation-params">';
        for (const [key, value] of Object.entries(data.parameters)) {
            const valueClass = value.modified ? 'param-value modified' :
                value.needsInput ? 'param-value needs-input' :
                    'param-value';
            const displayValue = value.value || value;
            paramsHTML += `
                <div class="param-item">
                    <span class="param-label">${key}:</span>
                    <span class="${valueClass}">${displayValue}</span>
                </div>
            `;
        }
        paramsHTML += '</div>';
    }

    let needsInputHTML = '';
    if (data.needsInput && data.needsInput.length > 0) {
        needsInputHTML = `<div class="text-small">⚠️ 입력 필요: ${data.needsInput.join(', ')}</div>`;
    }

    confirmDiv.innerHTML = `
        <div class="confirmation-title">${data.title || '📝 설정을 확인해주세요'}</div>
        ${data.message ? `<div style="margin-bottom: 12px;">${data.message}</div>` : ''}
        ${paramsHTML}
        ${needsInputHTML}
        <div class="action-buttons">
            <button class="btn-warning" onclick="handleModifyRequest()">수정하기</button>
            <button class="btn-primary" onclick="handleConfirmRequest()">이대로 진행</button>
        </div>
    `;

    chatContainer.appendChild(confirmDiv);
    scrollToBottom();

    conversationState.status = ConversationState.CONFIRMING;
    conversationState.context = data;
}

function renderCodePreview(code, type = 'extendscript') {
    const codeDiv = document.createElement('div');
    codeDiv.className = 'message bot-confirmation';

    codeDiv.innerHTML = `
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
        <div class="action-buttons">
            <button class="btn-danger" onclick="handleCancelExecution()">취소</button>
            <button class="btn-success" onclick="handleExecuteCode('${escapeHtml(code).replace(/'/g, "\\'")}')">실행</button>
        </div>
    `;

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
    if (!conversationState.pendingCode) {
        addSystemMessage('❌ 실행할 코드가 없습니다.');
        return;
    }

    addSystemMessage('⚙️ After Effects에서 코드 실행 중...');

    const wrappedCode = `
    app.beginUndoGroup("AI Generated Action");
    try {
        ${conversationState.pendingCode}
    } catch (err) {
        alert("스크립트 실행 오류:\\n" + err.toString());
    } finally {
        app.endUndoGroup();
    }
    `;

    csInterface.evalScript(wrappedCode, (result) => {
        if (result === 'undefined' || result === '') {
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
    const prompt = promptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!prompt) return;

    if (!apiKey) {
        alert('API Key를 먼저 설정해주세요.');
        document.getElementById('api-section').classList.remove('collapsed');
        apiKeyInput.focus();
        return;
    }

    // Disable input while processing
    sendBtn.disabled = true;
    promptInput.disabled = true;

    addUserMessage(prompt);
    promptInput.value = '';

    showTypingIndicator();

    // Get After Effects context
    csInterface.evalScript('getProjectContext()', async (contextResult) => {
        let contextJson = {};
        try {
            contextJson = JSON.parse(contextResult);
        } catch (e) {
            console.warn('Context parse error:', e);
        }

        try {
            const response = await fetch(`${SERVER_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    apiKey: apiKey,
                    context: contextJson,
                    history: conversationState.history,
                    state: conversationState.status
                })
            });

            hideTypingIndicator();

            if (!response.ok) {
                addBotMessage('❌ 서버 오류가 발생했습니다.');
                sendBtn.disabled = false;
                promptInput.disabled = false;
                return;
            }

            const data = await response.json();

            if (data.status === 'error') {
                addBotMessage(`❌ 오류: ${data.message}`);
                if (data.details) addBotMessage(`상세: ${data.details}`);
                sendBtn.disabled = false;
                promptInput.disabled = false;
                return;
            }

            // Handle different response types
            switch (data.type) {
                case 'clarification':
                    addBotMessage(data.content);
                    conversationState.status = ConversationState.CLARIFYING;
                    break;

                case 'confirmation':
                    renderConfirmationMessage({
                        title: data.title || '설정 확인',
                        message: data.content,
                        parameters: data.data?.parameters || {},
                        needsInput: data.data?.needsInput || []
                    });
                    break;

                case 'code':
                    renderCodePreview(data.data.code, data.data.type);
                    break;

                default:
                    addBotMessage(data.content || '처리되었습니다.');
            }

        } catch (error) {
            hideTypingIndicator();
            addBotMessage(`❌ 네트워크 오류: ${error.message}`);
            addSystemMessage('Python 서버가 실행 중인지 확인해주세요.');
        } finally {
            sendBtn.disabled = false;
            promptInput.disabled = false;
        }
    });
});

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
