const csInterface = new CSInterface();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess = null;
const SERVER_URL = 'http://127.0.0.1:5000';

// 1. 패널 열리면 로컬 파이썬 서버 자동 실행
function startPythonServer() {
    const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION);
    const serverPath = path.join(extensionRoot, 'server', 'server.py');

    // Python 명령어 후보들 (시스템별로 다를 수 있음)
    const pythonCommands = ['python', 'python3', 'py'];
    let serverStarted = false;

    function tryStartServer(cmdIndex) {
        if (cmdIndex >= pythonCommands.length) {
            // 모든 시도 실패
            addStatus('❌ Python 서버 시작 실패');
            addMessage('Python이 설치되어 있는지 확인해주세요. (python, python3, py 명령어를 찾을 수 없습니다)', false);
            return;
        }

        const cmd = pythonCommands[cmdIndex];
        console.log(`[INFO] Python 서버 시작 시도: ${cmd}`);

        pythonProcess = spawn(cmd, [serverPath]);

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString();
            console.log(`Python Server: ${message}`);

            // 서버 시작 성공 메시지 확인
            if (message.includes('Running on') || message.includes('서버 시작')) {
                serverStarted = true;
                addStatus('✅ Python 서버 연결 완료');
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            console.error(`Python Error: ${errorMsg}`);

            // 명령어를 찾을 수 없는 경우 다음 시도
            if (!serverStarted && (errorMsg.includes('not found') || errorMsg.includes('not recognized'))) {
                console.log(`[INFO] ${cmd} 명령어 실패, 다음 시도...`);
                pythonProcess = null;
                tryStartServer(cmdIndex + 1);
            }
        });

        pythonProcess.on('error', (err) => {
            console.error(`[ERROR] Python 프로세스 오류: ${err}`);
            if (!serverStarted) {
                tryStartServer(cmdIndex + 1);
            }
        });
    }

    tryStartServer(0);
}

// 패널 종료 시 서버도 종료
window.onbeforeunload = () => {
    if (pythonProcess) pythonProcess.kill();
};

startPythonServer();

// UI 로직
const sendBtn = document.getElementById('sendBtn');
const promptInput = document.getElementById('promptInput');
const chatContainer = document.getElementById('chat-container');
const apiKeyInput = document.getElementById('apiKeyInput');

// API 키 로컬 스토리지 저장/로드
apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
apiKeyInput.addEventListener('change', () => localStorage.setItem('gemini_api_key', apiKeyInput.value));

function addMessage(text, isUser = false) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-msg' : 'bot-msg'}`;
    div.innerText = text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addStatus(text) {
    const div = document.createElement('div');
    div.className = 'status-log';
    div.innerText = `⚙️ ${text}`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// client/main.js

sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value;
    const apiKey = apiKeyInput.value;

    if (!prompt) return;
    if (!apiKey) {
        alert("API Key를 입력해주세요.");
        return;
    }

    // 1. 사용자 메시지 UI에 표시
    addMessage(prompt, true);
    promptInput.value = '';
    addStatus("AE 상태 확인 중...");

    // 2. AE에서 현재 상태 정보(Context) 가져오기
    csInterface.evalScript('getProjectContext()', async (contextResult) => {

        // AE에서 가져온 JSON 정보를 파싱 (디버깅용)
        let contextJson = {};
        try {
            contextJson = JSON.parse(contextResult);
            console.log("Collected Context:", contextJson);
        } catch (e) {
            console.error("Context parsing error", e);
        }

        // 3. 프롬프트 결합 (사용자 질문 + AE 상태 데이터)
        // Gemini가 이해하기 쉽게 시스템 메시지처럼 감싸줍니다.
        const fullPrompt = `
        [Current AE Context JSON]
        ${contextResult}
        
        [User Request]
        ${prompt}
        
        (위 Context JSON을 참고하여, 만약 사용자가 '이 레이어'라고 하면 selectedLayers를 참조하고, 
        '화면 크기'를 언급하면 width/height를 참조해서 코드를 작성해.)
        `;

        addStatus("Gemini에게 요청 전송 중...");

        try {
            // 4. 파이썬 서버로 '결합된 프롬프트' 전송
            const response = await fetch(`${SERVER_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fullPrompt, apiKey: apiKey }) // prompt 대신 fullPrompt 전송
            });

            const data = await response.json();

            // --- 에러 처리 로직 개선 ---
            // 1. 서버 전체 에러 (예: API 키 오류 등)
            if (data.error) {
                addMessage(`❌ 서버 오류: ${data.error}`, false);
                if (data.details) {
                    addMessage(`상세: ${data.details}`, false);
                }
                if (data.suggestion) {
                    addMessage(`💡 제안: ${data.suggestion}`, false);
                }
                return;
            }

            // 2. 작업 수행 중 에러 (예: 이미지 생성 실패, 라이브러리 미설치 등)
            if (data.status === 'error') {
                addMessage(`❌ 작업 오류: ${data.message}`, false);
                if (data.details) {
                    addMessage(`상세: ${data.details}`, false);
                }
                return;
            }
            // ---------------------------

            addStatus(data.log);

            if (data.code) {
                // 코드 실행 전 사용자 확인
                showCodeConfirmation(data.code, data.type);
            }

        } catch (e) {
            addMessage(`❌ 네트워크 오류: ${e}`, false);
            addMessage('Python 서버가 실행 중인지 확인해주세요.', false);
        }
    });
});

// 코드 실행 확인 UI
function showCodeConfirmation(code, type) {
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'code-confirmation';
    confirmDiv.innerHTML = `
        <div class="code-preview">
            <strong>🤖 생성된 코드:</strong>
            <pre>${escapeHtml(code)}</pre>
        </div>
        <div class="confirm-buttons">
            <button class="btn-confirm" id="confirmRun">✅ 실행</button>
            <button class="btn-cancel" id="confirmCancel">❌ 취소</button>
        </div>
    `;
    chatContainer.appendChild(confirmDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    document.getElementById('confirmRun').addEventListener('click', () => {
        addStatus("스크립트 실행 중...");
        csInterface.evalScript(code, (result) => {
            if (result === "EvalScript error.") {
                addMessage("⚠️ 스크립트 실행 중 오류가 발생했습니다.", false);
            } else {
                addMessage("✅ 스크립트 실행 완료!", false);
            }
        });
        confirmDiv.remove();
    });

    document.getElementById('confirmCancel').addEventListener('click', () => {
        addStatus("스크립트 실행 취소됨");
        confirmDiv.remove();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}