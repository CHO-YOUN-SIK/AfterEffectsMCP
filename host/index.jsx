// After Effects 조작 함수 라이브러리 불러오기
#include "ae-functions.jsx";

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

/**
 * 구조화된 명령을 실행하는 함수 (ae-functions.jsx의 함수 호출)
 * Gemini가 JSON 형태로 명령을 전달하면 해당 함수를 실행
 * 
 * @param {string} command - 실행할 명령 이름
 * @param {Object} args - 명령에 필요한 인자들
 * @returns {string} JSON 형태의 실행 결과
 */
function executeCommand(command, args) {
    app.beginUndoGroup(command);

    try {
        var result;

        switch (command) {
            // 컴포지션 생성
            case "createComposition":
                result = createComposition(args);
                break;

            // 레이어 생성
            case "createTextLayer":
                result = createTextLayer(args);
                break;

            case "createShapeLayer":
                result = createShapeLayer(args);
                break;

            case "createSolidLayer":
                result = createSolidLayer(args);
                break;

            // 레이어 속성 제어
            case "setLayerProperties":
                result = setLayerProperties(args);
                break;

            case "setLayerKeyframe":
                // args에서 값 추출
                result = setLayerKeyframe(
                    args.compIndex,
                    args.layerIndex,
                    args.propertyName,
                    args.timeInSeconds,
                    args.value
                );
                break;

            case "setLayerExpression":
                result = setLayerExpression(
                    args.compIndex,
                    args.layerIndex,
                    args.propertyName,
                    args.expressionString
                );
                break;

            // 이펙트
            case "applyEffect":
                result = applyEffect(args);
                break;

            case "applyEffectTemplate":
                result = applyEffectTemplate(args);
                break;

            case "saveCurrentFrame":
                result = saveCurrentFrame(args.savePath);
                break;

            default:
                result = JSON.stringify({
                    status: "error",
                    message: "Unknown command: " + command + ". Available commands: createComposition, createTextLayer, createShapeLayer, createSolidLayer, setLayerProperties, setLayerKeyframe, setLayerExpression, applyEffect, applyEffectTemplate"
                });
        }

        app.endUndoGroup();
        return result;

    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({
            status: "error",
            message: "Error executing command '" + command + "': " + e.toString()
        });
    }
}

/**
 * 현재 컴포지션의 현재 시간을 PNG로 렌더링하여 저장합니다.
 * @param {string} savePath - 저장할 전체 파일 경로
 * @returns {string} JSON 결과
 */
function saveCurrentFrame(savePath) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return JSON.stringify({ status: "error", message: "No active composition" });
    }

    try {
        var rq = app.project.renderQueue;
        var renderItem = rq.items.add(comp);

        // 현재 시간의 1프레임만 렌더링
        renderItem.timeSpanStart = comp.time;
        renderItem.timeSpanDuration = 0;

        var outputModule = renderItem.outputModule(1);
        outputModule.file = new File(savePath);

        rq.render();

        if (rq.numItems > 0) {
            rq.item(rq.numItems).remove();
        }

        return JSON.stringify({
            status: "success",
            message: "Saved frame to " + savePath,
            path: savePath
        });

    } catch (e) {
        return JSON.stringify({ status: "error", message: e.toString() });
    }
}
}


