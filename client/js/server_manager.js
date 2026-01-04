const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// CSInterface 인스턴스 초기화 (AE 경로 통신용)
// CSInterface 인스턴스 초기화 (안전 모드)
let csInterface;
try {
    if (typeof CSInterface !== 'undefined') {
        csInterface = new CSInterface();
    } else {
        throw new Error("CSInterface globally undefined");
    }
} catch (e) {
    console.warn("CSInterface Init Failed:", e);
    // Fallback Mock for Browser/Debug
    csInterface = {
        getSystemPath: () => {
            // Fallback: 현재 작업 디렉토리 추정 (Node.js) 혹은 임의 경로
            return window.location ? window.location.pathname : '';
        },
        evalScript: (s) => console.log("[EvalScript Mock]", s)
    };
}

// ==================== Configuration & State ====================
let SERVER_PORT = 5000;
let SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const PORT_RANGE_START = 5000;
const PORT_RANGE_END = 5010;

let pythonProcess = null;
let isStartingServer = false;
let lastServerStartTime = 0; // Deadlock 방지용 타임스탬프

// ==================== Server Management Functions ====================

// 서버 헬스 체크
async function checkHealth(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(`${url}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e) {
        return false;
    }
}

// 활성 서버 찾기 또는 시작
async function findOrStartServer() {
    addLog('🔍 활성 서버 검색 중...');

    // 포트 스캔
    for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
        const testUrl = `http://127.0.0.1:${p}`;
        const isAlive = await checkHealth(testUrl);

        if (isAlive) {
            addLog(`✅ 활성 서버 발견 (Port ${p})`);
            SERVER_PORT = p;
            SERVER_URL = testUrl;
            updateConnectionStatus(true);
            return;
        }
    }

    // 서버 못 찾음 → 수동 실행 안내
    addLog('❌ 실행 중인 서버를 찾을 수 없습니다.');
    addLog('📌 해결 방법:');
    addLog('   1. 프로젝트 폴더를 엽니다.');
    addLog('   2. start_server.bat 파일을 더블 클릭합니다.');
    addLog('   3. 서버가 뜨면 이 패널을 새로고침하세요.');
    updateConnectionStatus(false);
}

// 파이썬 서버 시작 (재귀적 포트 탐색 포함)
async function startPythonServer(initialPort) {
    const now = Date.now();
    // Deadlock Breaker: 15초가 지나면 이전 시도를 무시하고 강제 진행 (Stuck 방지)
    const isStuck = (now - lastServerStartTime > 15000) && lastServerStartTime > 0;

    // 최초 호출이고 진행 중이면 (단, Stuck 상태가 아니어야 함)
    if (!initialPort && isStartingServer && !isStuck) {
        addLog('⏳ 이미 서버 시작 시도 중입니다... (대기)');
        return;
    }

    if (isStuck) {
        addLog('⚠️ 이전 시작 시도가 멈춘 것으로 감지됨. 강제 재시도합니다.');
        isStartingServer = false;
    }

    isStartingServer = true;
    lastServerStartTime = now;

    // 1. 경로 설정
    let extensionPath;
    try {
        extensionPath = csInterface.getSystemPath('extension');
    } catch (e) {
        addLog(`❌ CSInterface 오류: ${e.message}`);
        isStartingServer = false;
        return;
    }

    const venvPython = path.join(extensionPath, '.venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(extensionPath, 'server', 'server.py');
    let pythonPath = venvPython;

    if (!fs.existsSync(venvPython)) {
        addLog(`⚠️ 가상환경 Python을 찾지 못했습니다.`);
        addLog(`경로: ${venvPython}`);
        addLog(`🔄 시스템 기본 'python' 명령어로 실행을 시도합니다.`);
        pythonPath = 'python';
    } else {
        addLog(`✅ Python 실행 파일 확인됨.`);
    }

    // 2. 서버 실행
    const port = initialPort || 5000;

    if (port > PORT_RANGE_END) {
        addLog(`❌ 모든 포트 스캔 실패 (${PORT_RANGE_START}~${PORT_RANGE_END}).`);
        addSystemMessage('사용 가능한 포트가 없습니다. 프로세스를 확인해주세요.');
        isStartingServer = false;
        return;
    }

    addLog(`🔥 서버 시작 시도 (Port ${port})...`);

    // Node.js child_process를 사용한 직접 실행 (CEP에서 지원)
    try {
        const batPath = path.join(extensionPath, 'start_server.bat');
        addLog(`📄 배치 파일: ${batPath}`);

        // Node.js child_process로 배치 파일 실행
        const serverProcess = spawn('cmd.exe', ['/c', batPath], {
            detached: true,      // 백그라운드 실행
            stdio: 'ignore',     // 출력 무시
            windowsHide: true    // 콘솔 창 숨김 (Windows만)
        });

        // 패널 종료 시에도 서버 계속 실행
        serverProcess.unref();

        addLog('✅ 서버 시작 명령 전송 완료 (Node.js child_process)');
        addLog('⏱️ 서버가 켜지는 동안 잠시 기다립니다...');

        // Python 프로세스 참조 저장
        pythonProcess = serverProcess;

    } catch (err) {
        addLog(`❌ 서버 시작 실패: ${err.message}`);
        addLog(`👉 수동 해결: start_server.bat 파일을 직접 실행하세요.`);
        isStartingServer = false;
        lastServerStartTime = 0;
        return;
    }

    // 3. 서버 생존 확인 폴링
    let attempts = 0;
    const maxAttempts = 60; // 30초 대기

    checkInterval = setInterval(async () => {
        attempts++;
        const isAlive = await checkHealth(`http://127.0.0.1:${port}`);

        if (isAlive) {
            addLog(`✅ 서버 연결 성공 (Port ${port})!`);
            clearInterval(checkInterval);

            SERVER_PORT = port;
            SERVER_URL = `http://127.0.0.1:${port}`;
            updateConnectionStatus(true);
            // 성공 시 플래그 해제
            isStartingServer = false;
            lastServerStartTime = 0; // 성공했으므로 초기화

        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            addLog(`❌ 포트 ${port} 연결 시간 초과 (30초).`);

            if (port < PORT_RANGE_END) {
                addLog(`➡️ 다음 포트(${port + 1})로 넘어갑니다...`);
                // 다음 포트로 재시도
                startPythonServer(port + 1);
            } else {
                addSystemMessage('서버 실행에 실패했습니다.');
                isStartingServer = false;
                lastServerStartTime = 0;
            }
        }
    }, 500);
}

// 서버 연결 감시 (주기적 실행)
function checkServerConnection() {
    // 시작 중이면 건너뜀 (단, Stuck 상태면 findOrStartServer가 처리하도록 허용할 수도 있지만, findOrStartServer가 Stuck 체크를 안하니 여기서 막힘)
    // 하지만 checkServerConnection은 3초마다 돌므로, startPythonServer가 Stuck을 풀면 다음 텀에 실행됨.
    if (isStartingServer) {
        const now = Date.now();
        // 만약 20초 이상 지났는데 아직도 true면 강제로 뚫어줌 (안전장치 2중)
        if (lastServerStartTime > 0 && (now - lastServerStartTime > 20000)) {
            addLog('⚠️ 서버 시작 프로세스 응답 없음. 강제 초기화.');
            isStartingServer = false;
            lastServerStartTime = 0;
        } else {
            return;
        }
    }

    checkHealth(SERVER_URL).then(isOk => {
        if (isOk) {
            updateConnectionStatus(true);
        } else {
            updateConnectionStatus(false);
            if (!pythonProcess && !isStartingServer) {
                findOrStartServer();
            }
        }
    });
}

// 강제 리셋
function resetServerProcess() {
    addLog('⚠️ 사용자가 서버 강제 리셋을 요청했습니다.');

    // 윈도우 taskkill 명령으로 기존 프로세스 강제 종료
    spawn('taskkill', ['/F', '/IM', 'python.exe']);

    // 상태 변수 초기화
    isStartingServer = false;
    lastServerStartTime = 0;
    pythonProcess = null;
    updateConnectionStatus(false);

    setTimeout(() => {
        addLog('✅ 프로세스 정리 완료. 서버 재시작을 시도합니다.');
        findOrStartServer();
    }, 1500);
}

// 앱 종료 시 정리
window.onbeforeunload = function () {
    if (pythonProcess) {
        try { pythonProcess.kill(); } catch (e) { }
    }
};
