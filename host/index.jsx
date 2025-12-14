/**
 * After Effects 프로젝트의 현재 상태 정보를 수집하는 함수
 * 활성화된 컴포지션과 선택된 레이어 정보를 JSON 형태로 반환
 * 
 * @returns {string} JSON 문자열 형태의 컨텍스트 정보
 */
function getProjectContext() {
    var context = {
        hasActiveComp: false,
        compName: "",
        width: 0,
        height: 0,
        frameRate: 0,
        currentTime: 0,
        selectedLayers: []
    };

    var comp = app.project.activeItem;

    // 활성화된 컴포지션이 있는지 확인
    if (comp && comp instanceof CompItem) {
        context.hasActiveComp = true;
        context.compName = comp.name;
        context.width = comp.width;
        context.height = comp.height;
        context.frameRate = comp.frameRate;
        context.currentTime = comp.time;

        // 선택된 레이어 정보 수집
        var sel = comp.selectedLayers;
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            context.selectedLayers.push({
                index: layer.index,
                name: layer.name,
                type: getLayerType(layer),
                width: layer.width,
                height: layer.height,
                position: layer.transform.position.value.toString(),
                rotation: layer.transform.rotation.value
            });
        }
    }

    // 객체를 JSON 문자열로 변환하여 반환
    return JSON.stringify(context);
}

/**
 * 레이어의 타입을 구분하는 헬퍼 함수
 * 
 * @param {Layer} layer - After Effects 레이어 객체
 * @returns {string} 레이어 타입 문자열
 */
function getLayerType(layer) {
    if (layer instanceof TextLayer) return "TextLayer";
    if (layer instanceof CameraLayer) return "CameraLayer";
    if (layer instanceof LightLayer) return "LightLayer";
    if (layer instanceof ShapeLayer) return "ShapeLayer";
    if (layer.nullLayer) return "NullLayer";
    return "AVLayer"; // Audio/Video Layer
}

/**
 * 클라이언트로부터 받은 스크립트 코드를 실행하는 함수
 * 
 * @param {string} code - 실행할 ExtendScript 코드
 * @returns {string} 실행 결과 ("Success" 또는 "Error")
 */
function runScript(code) {
    try {
        // 전달받은 문자열 코드를 실행
        eval(code);
        return "Success";
    } catch (e) {
        // 에러 발생 시 사용자에게 알림
        alert("Script Error: " + e.toString());
        return "Error";
    }
}

