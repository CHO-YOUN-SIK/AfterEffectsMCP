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
                type: getLayerType(layer), // 아래 헬퍼 함수 참고
                width: layer.width,
                height: layer.height,
                position: layer.transform.position.value.toString(),
                rotation: layer.transform.rotation.value
            });
        }
    }

    // 객체를 문자열(JSON)로 변환하여 리턴
    return JSON.stringify(context);
}

// 레이어 타입을 구분하는 헬퍼 함수
function getLayerType(layer) {
    if (layer instanceof TextLayer) return "TextLayer";
    if (layer instanceof CameraLayer) return "CameraLayer";
    if (layer instanceof LightLayer) return "LightLayer";
    if (layer instanceof ShapeLayer) return "ShapeLayer";
    if (layer.nullLayer) return "NullLayer";
    return "AVLayer";
}

function runScript(code) {
    try {
        // 전달받은 문자열 코드를 실행
        eval(code);
        return "Success";
    } catch (e) {
        alert("Script Error: " + e.toString());
        return "Error";
    }
}
