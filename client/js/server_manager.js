const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// CSInterface 인스턴스 초기화 (AE 경로 통신용)
const csInterface = new CSInterface();

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

    addLog('활성 서버 없음. 새로 시작합니다.');
    startPythonServer(); // await 없이 호출 (비동기 처리)
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

    const pythonPath = path.join(extensionPath, '.venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(extensionPath, 'server', 'server.py');

    if (!fs.existsSync(pythonPath)) {
        addLog(`❌ Python 실행 파일을 찾을 수 없습니다.`);
        addLog(`경로: ${pythonPath}`);
        addSystemMessage('Python 가상환경(.venv)이 손상되었거나 없습니다.');
        isStartingServer = false;
        lastServerStartTime = 0;
        return;
    }

    // 2. 서버 실행
    const port = initialPort || 5000;

    if (port > PORT_RANGE_END) {
        addLog(`❌ 모든 포트 스캔 실패 (${PORT_RANGE_START}~${PORT_RANGE_END}).`);
        addSystemMessage('사용 가능한 포트가 없습니다. 프로세스를 확인해주세요.');
        isStartingServer = false;
        return;
    }

    addLog(`🔥 서버 프로세스 시작 (Port ${port})...`);

    let checkInterval = null;

    try {
        const serverProcess = spawn(pythonPath, [scriptPath], {
            cwd: extensionPath,
            env: { ...process.env, SERVER_PORT: port.toString(), PYTHONUNBUFFERED: '1' }
        });

        pythonProcess = serverProcess;

        const handlePortConflict = (msg) => {
            if (msg.includes('Address already in use') || msg.includes('port is already allocated')) {
                addLog(`⚠️ 포트 ${port} 사용 중. 500ms 후 포트 ${port + 1} 시도...`);

                if (checkInterval) clearInterval(checkInterval);

                try { serverProcess.kill(); } catch (e) { }
                setTimeout(() => startPythonServer(port + 1), 500);
                return true;
            }
            return false;
        };

        serverProcess.stdout.on('data', (data) => {
            const str = data.toString();
            if (handlePortConflict(str)) return;

            if (str.includes('Running on') || str.includes('Starting') || str.includes('Error')) {
                addLog(`[Server] ${str.trim()}`);
            }
        });

        serverProcess.stderr.on('data', (data) => {
            const str = data.toString();
            if (handlePortConflict(str)) return;
            addLog(`[Error] ${str.trim()}`);
        });

        serverProcess.on('close', (code) => {
            if (pythonProcess === serverProcess) {
                pythonProcess = null;
                // 마지막 비상구: 포트 범위 끝이면 시작 상태 해제
                if (port >= PORT_RANGE_END) {
                    isStartingServer = false;
                    lastServerStartTime = 0;
                }
            }
        });

        serverProcess.on('error', (err) => {
            addLog(`❌ 프로세스 실행 에러: ${err.message}`);
            isStartingServer = false;
            lastServerStartTime = 0;
        });

        // 3. 서버 생존 확인 폴링
        let attempts = 0;
        const maxAttempts = 30;

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
                addLog(`❌ 포트 ${port} 연결 시간 초과 (15초).`);

                if (port < PORT_RANGE_END) {
                    addLog(`➡️ 다음 포트(${port + 1})로 넘어갑니다...`);
                    try { serverProcess.kill(); } catch (e) { }
                    startPythonServer(port + 1);
                } else {
                    addSystemMessage('서버 실행에 실패했습니다.');
                    isStartingServer = false;
                    lastServerStartTime = 0;
                }
            }
        }, 500);

    } catch (e) {
        addLog(`❌ 프로세스 스폰 에러: ${e.message}`);
        isStartingServer = false;
        lastServerStartTime = 0;
    }
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
