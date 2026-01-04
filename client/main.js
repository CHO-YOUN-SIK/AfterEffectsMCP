const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ==================== Global State ====================
// (SERVER_PORT, SERVER_URL 등은 server_manager.js에서 관리)

const csInterface = new CSInterface();
const extensionPath = csInterface.getSystemPath('extension');

// 대화 상태
const ConversationState = {
    IDLE: 'IDLE',
    AWAITING_RESPONSE: 'AWAITING_RESPONSE',
    CLARIFYING: 'CLARIFYING',   // 추가 정보 요청 중
    CONFIRMING: 'CONFIRMING'    // 실행 확인 중
};

let conversationState = {
    status: ConversationState.IDLE,
    history: []
};

let selectedImagePaths = [];
let currentApiKey = '';
let isThinking = false;
let abortController = null;

// ==================== Initialization ====================

window.onload = function () {
    console.log('AfterEffectsMCP Initializing...');

    // 0. 강제 모달 오픈 (패널 켜자마자)
    if (window.openSetupModal) {
        window.openSetupModal();
    } else {
        setTimeout(() => { if (window.openSetupModal) window.openSetupModal(); }, 100);
    }

    // UI 요소 참조
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');

    // 모달 버튼 리스너 바인딩 (안전장치)
    const modalStartBtn = document.getElementById('modal-start-btn');
    if (modalStartBtn) {
        modalStartBtn.onclick = handleSetupComplete; // 명시적 바인딩
    }

    // 이벤트 리스너: 전송
    sendBtn.addEventListener('click', handleSendMessage);

    // 이벤트 리스너: 엔터키
    promptInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 이벤트 리스너: 파일 첨부
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // .env 파일에서 API 키 로드 시도 (옵션)
    loadApiKeyFromEnv();

    // 초기 서버 연결 시작 (즉시)
    setTimeout(() => {
        addLog('System: 초기화 완료. 서버 연결 루프 시작.');
        checkServerConnection();
    }, 100);
};

// ==================== Event Handlers ====================

// 파일 선택 핸들러
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        selectedImagePaths.push(files[i].path);
    }
    updateFilePreview();
    document.getElementById('fileInput').value = '';
}

function updateFilePreview() {
    const previewArea = document.getElementById('file-preview-area');
    if (!previewArea) return;

    previewArea.innerHTML = '';

    if (selectedImagePaths.length > 0) {
        previewArea.style.display = 'flex';
        selectedImagePaths.forEach((path, index) => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.width = '60px';
            div.style.height = '60px';

            const img = document.createElement('img');
            img.src = path;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.border = '1px solid #444';

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.style.position = 'absolute';
            delBtn.style.top = '-5px';
            delBtn.style.right = '-5px';
            delBtn.style.background = '#d32f2f';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '50%';
            delBtn.style.width = '18px';
            delBtn.style.height = '18px';
            delBtn.style.fontSize = '14px';
            delBtn.style.lineHeight = '14px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.display = 'flex';
            delBtn.style.justifyContent = 'center';
            delBtn.style.alignItems = 'center';
            delBtn.onclick = () => {
                selectedImagePaths.splice(index, 1);
                updateFilePreview();
            };

            div.appendChild(img);
            div.appendChild(delBtn);
            previewArea.appendChild(div);
        });
    } else {
        previewArea.style.display = 'none';
    }
}

async function handleAnalyzeUrl() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    if (!url) {
        addSystemMessage('분석할 URL을 입력해주세요.');
        return;
    }

    addLog(`🌐 URL 분석 요청: ${url}`);
    const btn = document.getElementById('analyzeUrlBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled = true;

    try {
        const response = await fetch(`${SERVER_URL}/analyze-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        const result = data.data;

        addSystemMessage(`✅ 분석 완료: ${result.title}`);

        const summary = `[URL Source Analysis]\nTitle: ${result.title}\nContent Summary:\n${result.content.substring(0, 500)}...\n(Full content loaded internally)`;

        const promptInput = document.getElementById('promptInput');
        const existing = promptInput.value;
        promptInput.value = (existing ? existing + '\n\n' : '') + `참고 URL: ${url}\n${summary}\n\n위 내용을 바탕으로 영상을 만들어줘.`;

        if (result.images && result.images.length > 0) {
            let addedCount = 0;
            result.images.forEach(path => {
                if (!selectedImagePaths.includes(path)) {
                    selectedImagePaths.push(path);
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                updateFilePreview();
                addLog(`📸 이미지 ${addedCount}장 로드됨.`);
            }
        }

    } catch (e) {
        addLog(`❌ 분석 실패: ${e.message}`);
        addSystemMessage(`URL 분석 실패: ${e.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        urlInput.value = '';
    }
}

// 메시지 전송 핸들러
async function handleSendMessage() {
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.getElementById('sendBtn');
    const prompt = promptInput.value.trim();

    if (!prompt && selectedImagePaths.length === 0) return;
    if (isThinking) return;

    // UI 업데이트
    addUserMessage(prompt, selectedImagePaths);
    promptInput.value = '';

    isThinking = true;
    showTypingIndicator();
    sendBtn.disabled = true;

    try {
        // 컨텍스트 수집 (선택된 레이어 등)
        const contextJson = await getAfterEffectsContext();

        // 요청 준비
        abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 300000); // 5분 타임아웃

        // requestBody 구성
        const requestBody = {
            prompt: prompt,
            apiKey: currentApiKey || process.env.GEMINI_API_KEY || '', // .env 키가 있다면 사용
            context: contextJson,
            imagePaths: selectedImagePaths,
            history: conversationState.history,
            state: conversationState.status
        };

        const response = await fetch(`${SERVER_URL}/chat`, { // server_manager.js에서 정의된 SERVER_URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        clearTimeout(timeoutId);
        selectedImagePaths = []; // 전송 후 초기화

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Server Error ${response.status}`);
        }

        const data = await response.json();
        handleServerResponse(data);

    } catch (error) {
        console.error('Send Error:', error);
        addBotMessage(`❌ 오류 발생: ${error.message}`);
        addSystemMessage('서버가 응답하지 않거나 연결이 끊어졌습니다.');
    } finally {
        isThinking = false;
        hideTypingIndicator();
        sendBtn.disabled = false;
        promptInput.focus();
    }
}

// 서버 응답 처리
function handleServerResponse(data) {
    // 히스토리 업데이트 (서버가 갱신된 히스토리를 주면 좋겠지만, 일단 로컬 상태 관리 필요할 수도)
    // 여기서는 단순화.

    if (data.status === 'error') {
        addBotMessage(`❌ ${data.message}`);
        return;
    }

    switch (data.type) {
        case 'code':
            if (data.data && data.data.code) {
                renderCodePreview(data.data.code, data.data.type);
                addBotMessage('🚀 코드를 실행합니다...');
                handleExecuteCode(data.data.code);
            } else {
                addBotMessage(data.content || '코드가 생성되었습니다.');
            }
            break;

        case 'confirmation':
            renderConfirmationMessage(data.data || data); // ui_manager
            break;

        case 'clarification':
        default:
            addBotMessage(data.content);
            break;
    }
}
// Setup Complete Handler
async function handleSetupComplete() {
    const keyInput = document.getElementById('modal-api-key');
    const urlInput = document.getElementById('modal-url-input');
    const btn = document.getElementById('modal-start-btn');

    const apiKey = keyInput.value.trim();
    if (!apiKey) {
        alert('API Key는 필수입니다.');
        return;
    }

    localStorage.setItem('gemini_api_key', apiKey);

    const url = urlInput.value.trim();
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '설정 적용 중...';

    try {
        // URL이 있으면 분석 수행
        if (url) {
            btn.textContent = 'URL 분석 및 다운로드 중...';
            addLog(`🌐 초기 URL 분석 시작: ${url}`);

            const response = await fetch(`${SERVER_URL}/analyze-url`, { // SERVER_URL은 전역변수
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();

            if (data.status === 'success') {
                const result = data.data;
                addSystemMessage(`✅ 분석 완료: ${result.title}`);
                const summary = `[Initial Source]\nTitle: ${result.title}\nContent:\n${result.content.substring(0, 800)}...`;

                const promptInput = document.getElementById('promptInput');
                promptInput.value = `참고 URL: ${url}\n${summary}\n\n위 내용을 바탕으로 영상을 만들어줘.`;

                if (result.images) {
                    result.images.forEach(p => {
                        if (!selectedImagePaths.includes(p)) selectedImagePaths.push(p);
                    });
                    updateFilePreview();
                }
            } else {
                throw new Error(data.message);
            }
        }

        closeSetupModal();
        addLog('✅ 작업 준비 완료!');

    } catch (e) {
        alert(`오류 발생: ${e.message}`);
        addLog(`❌ 설정 실패: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
window.handleSetupComplete = handleSetupComplete;
// ==================== After Effects Logic ====================

function getAfterEffectsContext() {
    return new Promise((resolve) => {
        // 간단한 컨텍스트 수집 스크립트 실행
        const script = `
            (function() {
                var ctx = { compositions: [], selectedLayers: [] };
                if (app.project) {
                    for (var i = 1; i <= app.project.numItems; i++) {
                        if (app.project.item(i) instanceof CompItem) {
                            ctx.compositions.push(app.project.item(i).name);
                        }
                    }
                }
                return JSON.stringify(ctx);
            })();
        `;
        csInterface.evalScript(script, (result) => {
            try {
                resolve(JSON.parse(result));
            } catch (e) {
                resolve({});
            }
        });
    });
}

// 코드 실행 (핵심)
function handleExecuteCode(code) {
    addLog('📜 ExtendScript 실행 요청...');

    // 코드 래핑 (Undo Group 등은 AI가 해주지만, 안전장치 추가 가능)
    // 여기서는 그대로 실행
    csInterface.evalScript(code, (result) => {
        if (result === 'EvalScript error.') {
            addLog('❌ 스크립트 실행 실패 (EvalScript error)');
            addBotMessage('스크립트 실행 중 알 수 없는 오류가 발생했습니다.');
        } else {
            addLog('✅ 스크립트 실행 완료');
            // 실행 후 결과 캡처
            setTimeout(captureAndShowResult, 500);
        }
    });
}

// 결과 캡처 및 표시
async function captureAndShowResult() {
    addLog('📷 결과 캡처 중...');

    const capturesDir = path.join(extensionPath, 'captures');
    if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir);

    const fileName = `capture_${Date.now()}.jpg`;
    const filePath = path.join(capturesDir, fileName).replace(/\\/g, '/'); // AE는 슬래시 선호

    // AE에 캡처 명령 (saveFrameToPng 같은 함수가 host/index.jsx에 있어야 함. 없다면 임시 구현)
    // 지난 세션에서 window.saveCurrentFrame 같은 걸 만들었는지 확인 필요.
    // 여기서는 host/index.jsx에 정의된 saveCurrentFrame(path) 호출.

    const script = `saveCurrentFrame("${filePath}");`;

    csInterface.evalScript(script, (result) => {
        if (result && result.toString().toLowerCase() !== 'false') {
            // 성공 시 미리보기 추가
            const container = document.getElementById('chat-container');
            const imgDiv = document.createElement('div');
            imgDiv.style.marginTop = '10px';
            imgDiv.innerHTML = `<span style="font-size:10px; color:#aaa;">Result Check:</span><br><img src="${filePath}" style="max-width:100%; border-radius:5px; border:1px solid #555;">`;
            container.appendChild(imgDiv);
            scrollToBottom();

            // 다음 프롬프트에 자동 첨부 (선택 사항)
            window.autoAttachPath = filePath;
            selectedImagePaths.push(filePath);
        } else {
            addLog('⚠️ 캡처 실패 또는 지원되지 않음.');
        }
    });
}

// ==================== Toggles & Helpers ====================

window.toggleServerLog = function () {
    const content = document.getElementById('server-log-content');
    const toggle = document.getElementById('server-log-toggle');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
};

window.toggleApiSection = function () {
    const section = document.getElementById('api-section');
    section.classList.toggle('collapsed');
};

function loadApiKeyFromEnv() {
    // .env 로드 로직 (간단 구현)
    const envPath = path.join(extensionPath, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/GEMINI_API_KEY=(.*)/);
        if (match && match[1]) {
            currentApiKey = match[1].trim();
            const input = document.getElementById('apiKeyInput');
            if (input) input.value = currentApiKey;
            addLog('🔑 API Key loaded from .env');
        }
    }
}
