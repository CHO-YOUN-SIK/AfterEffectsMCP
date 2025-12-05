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
    
    // python 또는 python3 명령어로 실행
    pythonProcess = spawn('python', [serverPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Server: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
    });
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

            if (data.error) {
                addMessage(`Error: ${data.error}`);
                return;
            }

            addStatus(data.log);

            if (data.code) {
                addStatus("스크립트 실행 중...");
                csInterface.evalScript(data.code); // Gemini가 짠 코드 실행
            }

        } catch (e) {
            addMessage(`Server Error: ${e}`);
        }
    });
});