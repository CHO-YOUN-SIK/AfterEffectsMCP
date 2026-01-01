/**
 * ae-functions.jsx
 * After Effects 조작 함수 라이브러리
 * 
 * Dakkshin/after-effects-mcp 프로젝트에서 가져온 함수들
 * https://github.com/Dakkshin/after-effects-mcp
 * 
 * 이 파일에는 After Effects를 조작하는 핵심 함수들이 포함되어 있습니다.
 */

// =============================================================================
// 컴포지션 관리
// =============================================================================

/**
 * 시스템에 설치된 폰트 중 우선순위 폰트를 찾고, 없으면 기본 폰트로 대체합니다.
 *
 * @param {string} preferred - 우선 사용하고 싶은 폰트명 (예: "Montserrat")
 * @param {string} fallback - 대체 폰트명 (예: "Arial")
 * @returns {string} 실제 사용 가능한 폰트명
 */
function resolveFontFamily(preferred, fallback) {
    var preferredName = preferred || "";
    var fallbackName = fallback || "Arial";

    try {
        if (app && app.fonts && app.fonts.length > 0 && preferredName) {
            for (var i = 0; i < app.fonts.length; i++) {
                var font = app.fonts[i];
                if (!font) {
                    continue;
                }
                // 폰트의 이름(name) 또는 패밀리(family)가 일치하면 사용합니다.
                if (font.name === preferredName || font.family === preferredName) {
                    return font.name;
                }
            }
        }
    } catch (e) {
        // 폰트 조회 중 오류가 나더라도 기본 폰트로 계속 진행합니다.
    }

    return fallbackName;
}

/**
 * 새로운 컴포지션을 생성합니다.
 * 
 * @param {Object} args - 컴포지션 설정
 * @param {string} args.name - 컴포지션 이름 (기본값: "New Composition")
 * @param {number} args.width - 너비 (기본값: 1920)
 * @param {number} args.height - 높이 (기본값: 1080)
 * @param {number} args.pixelAspect - 픽셀 비율 (기본값: 1.0)
 * @param {number} args.duration - 지속시간 (초) (기본값: 10.0)
 * @param {number} args.frameRate - 프레임레이트 (기본값: 30.0)
 * @param {Object} args.backgroundColor - 배경색 {r, g, b} (0-255)
 * @returns {string} JSON 결과
 */
function createComposition(args) {
    try {
        var name = args.name || "New Composition";
        var width = parseInt(args.width) || 1920;
        var height = parseInt(args.height) || 1080;
        var pixelAspect = parseFloat(args.pixelAspect) || 1.0;
        var duration = parseFloat(args.duration) || 10.0;
        var frameRate = parseFloat(args.frameRate) || 30.0;
        var bgColor = args.backgroundColor ? 
            [args.backgroundColor.r/255, args.backgroundColor.g/255, args.backgroundColor.b/255] : 
            [0, 0, 0];
        
        var newComp = app.project.items.addComp(name, width, height, pixelAspect, duration, frameRate);
        
        if (args.backgroundColor) {
            newComp.bgColor = bgColor;
        }
        
        return JSON.stringify({
            status: "success",
            message: "Composition created successfully",
            composition: {
                name: newComp.name,
                id: newComp.id,
                width: newComp.width,
                height: newComp.height,
                pixelAspect: newComp.pixelAspect,
                duration: newComp.duration,
                frameRate: newComp.frameRate,
                bgColor: newComp.bgColor
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// =============================================================================
// 레이어 생성
// =============================================================================

/**
 * 텍스트 레이어를 생성합니다.
 * 
 * @param {Object} args - 텍스트 레이어 설정
 * @param {string} args.compName - 컴포지션 이름 (비어있으면 활성 컴포지션 사용)
 * @param {string} args.text - 텍스트 내용 (기본값: "Text Layer")
 * @param {Array} args.position - 위치 [x, y] (기본값: [960, 540])
 * @param {number} args.fontSize - 폰트 크기 (기본값: 72)
 * @param {Array} args.color - 색상 [r, g, b] (0-1) (기본값: [1, 1, 1])
 * @param {number} args.startTime - 시작 시간 (기본값: 0)
 * @param {number} args.duration - 지속시간 (기본값: 5)
 * @param {string} args.fontFamily - 폰트 이름 (기본값: "Arial")
 * @param {string} args.alignment - 정렬 "left", "center", "right" (기본값: "center")
 * @returns {string} JSON 결과
 */
function createTextLayer(args) {
    try {
        var compName = args.compName || "";
        var text = args.text || "Text Layer";
        var position = args.position || [960, 540];
        var fontSize = args.fontSize || 72;
        var color = args.color || [1, 1, 1];
        var startTime = args.startTime || 0;
        var duration = args.duration || 5;
        // 사이트 기본 폰트(Montserrat)를 우선 사용하고, 없으면 Arial로 대체합니다.
        var fontFamily = resolveFontFamily(args.fontFamily || "Montserrat", "Arial");
        var alignment = args.alignment || "center";
        
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        var textLayer = comp.layers.addText(text);
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDocument = textProp.value;
        
        textDocument.fontSize = fontSize;
        textDocument.fillColor = color;
        textDocument.font = fontFamily;
        
        if (alignment === "left") {
            textDocument.justification = ParagraphJustification.LEFT_JUSTIFY;
        } else if (alignment === "center") {
            textDocument.justification = ParagraphJustification.CENTER_JUSTIFY;
        } else if (alignment === "right") {
            textDocument.justification = ParagraphJustification.RIGHT_JUSTIFY;
        }
        
        textProp.setValue(textDocument);
        textLayer.property("Position").setValue(position);
        textLayer.startTime = startTime;
        
        if (duration > 0) {
            textLayer.outPoint = startTime + duration;
        }
        
        return JSON.stringify({
            status: "success",
            message: "Text layer created successfully",
            layer: {
                name: textLayer.name,
                index: textLayer.index,
                type: "text",
                inPoint: textLayer.inPoint,
                outPoint: textLayer.outPoint,
                position: textLayer.property("Position").value
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

/**
 * 도형 레이어를 생성합니다.
 * 
 * @param {Object} args - 도형 레이어 설정
 * @param {string} args.compName - 컴포지션 이름
 * @param {string} args.shapeType - 도형 타입 "rectangle", "ellipse", "polygon", "star"
 * @param {Array} args.position - 위치 [x, y] (기본값: [960, 540])
 * @param {Array} args.size - 크기 [width, height] (기본값: [200, 200])
 * @param {Array} args.fillColor - 채우기 색상 [r, g, b] (0-1) (기본값: [1, 0, 0])
 * @param {Array} args.strokeColor - 선 색상 [r, g, b] (0-1) (기본값: [0, 0, 0])
 * @param {number} args.strokeWidth - 선 두께 (기본값: 0)
 * @param {number} args.startTime - 시작 시간 (기본값: 0)
 * @param {number} args.duration - 지속시간 (기본값: 5)
 * @param {string} args.name - 레이어 이름 (기본값: "Shape Layer")
 * @param {number} args.points - 다각형/별의 점 개수 (기본값: 5)
 * @returns {string} JSON 결과
 */
function createShapeLayer(args) {
    try {
        var compName = args.compName || "";
        var shapeType = args.shapeType || "rectangle";
        var position = args.position || [960, 540];
        var size = args.size || [200, 200];
        var fillColor = args.fillColor || [1, 0, 0];
        var strokeColor = args.strokeColor || [0, 0, 0];
        var strokeWidth = args.strokeWidth || 0;
        var startTime = args.startTime || 0;
        var duration = args.duration || 5;
        var name = args.name || "Shape Layer";
        var points = args.points || 5;
        
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = name;
        
        var contents = shapeLayer.property("Contents");
        var shapeGroup = contents.addProperty("ADBE Vector Group");
        var groupContents = shapeGroup.property("Contents");
        
        var shapePathProperty;
        if (shapeType === "rectangle") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Rect");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "ellipse") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Ellipse");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "polygon" || shapeType === "star") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Star");
            shapePathProperty.property("Type").setValue(shapeType === "polygon" ? 1 : 2);
            shapePathProperty.property("Points").setValue(points);
            shapePathProperty.property("Outer Radius").setValue(size[0] / 2);
            if (shapeType === "star") {
                shapePathProperty.property("Inner Radius").setValue(size[0] / 3);
            }
        }
        
        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(fillColor);
        fill.property("Opacity").setValue(100);
        
        if (strokeWidth > 0) {
            var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue(strokeColor);
            stroke.property("Stroke Width").setValue(strokeWidth);
            stroke.property("Opacity").setValue(100);
        }
        
        shapeLayer.property("Position").setValue(position);
        shapeLayer.startTime = startTime;
        
        if (duration > 0) {
            shapeLayer.outPoint = startTime + duration;
        }
        
        return JSON.stringify({
            status: "success",
            message: "Shape layer created successfully",
            layer: {
                name: shapeLayer.name,
                index: shapeLayer.index,
                type: "shape",
                shapeType: shapeType,
                inPoint: shapeLayer.inPoint,
                outPoint: shapeLayer.outPoint,
                position: shapeLayer.property("Position").value
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

/**
 * Solid 또는 Adjustment 레이어를 생성합니다.
 * 
 * @param {Object} args - Solid 레이어 설정
 * @param {string} args.compName - 컴포지션 이름
 * @param {Array} args.color - 색상 [r, g, b] (0-1) (기본값: [1, 1, 1])
 * @param {string} args.name - 레이어 이름 (기본값: "Solid Layer")
 * @param {Array} args.position - 위치 [x, y] (기본값: [960, 540])
 * @param {Array} args.size - 크기 [width, height] (기본값: comp 크기)
 * @param {number} args.startTime - 시작 시간 (기본값: 0)
 * @param {number} args.duration - 지속시간 (기본값: 5)
 * @param {boolean} args.isAdjustment - Adjustment Layer 여부 (기본값: false)
 * @returns {string} JSON 결과
 */
function createSolidLayer(args) {
    try {
        var compName = args.compName || "";
        var color = args.color || [1, 1, 1];
        var name = args.name || "Solid Layer";
        var position = args.position || [960, 540];
        var size = args.size;
        var startTime = args.startTime || 0;
        var duration = args.duration || 5;
        var isAdjustment = args.isAdjustment || false;
        
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        if (!size) {
            size = [comp.width, comp.height];
        }
        
        var solidLayer;
        if (isAdjustment) {
            solidLayer = comp.layers.addSolid([0, 0, 0], name, size[0], size[1], 1);
            solidLayer.adjustmentLayer = true;
        } else {
            solidLayer = comp.layers.addSolid(color, name, size[0], size[1], 1);
        }
        
        solidLayer.property("Position").setValue(position);
        solidLayer.startTime = startTime;
        
        if (duration > 0) {
            solidLayer.outPoint = startTime + duration;
        }
        
        return JSON.stringify({
            status: "success",
            message: isAdjustment ? "Adjustment layer created successfully" : "Solid layer created successfully",
            layer: {
                name: solidLayer.name,
                index: solidLayer.index,
                type: isAdjustment ? "adjustment" : "solid",
                inPoint: solidLayer.inPoint,
                outPoint: solidLayer.outPoint,
                position: solidLayer.property("Position").value,
                isAdjustment: solidLayer.adjustmentLayer
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// =============================================================================
// 레이어 속성 제어
// =============================================================================

/**
 * 레이어의 속성을 일괄 변경합니다.
 * 
 * @param {Object} args - 속성 설정
 * @param {string} args.compName - 컴포지션 이름
 * @param {string} args.layerName - 레이어 이름
 * @param {number} args.layerIndex - 레이어 인덱스
 * @param {Array} args.position - 위치 [x, y]
 * @param {Array} args.scale - 크기 [x, y]
 * @param {number} args.rotation - 회전 (도)
 * @param {number} args.opacity - 투명도 (0-100)
 * @param {number} args.startTime - 시작 시간
 * @param {number} args.duration - 지속시간
 * @param {string} args.text - 텍스트 내용 (텍스트 레이어용)
 * @param {string} args.fontFamily - 폰트 (텍스트 레이어용)
 * @param {number} args.fontSize - 폰트 크기 (텍스트 레이어용)
 * @param {Array} args.fillColor - 텍스트 색상 (텍스트 레이어용)
 * @returns {string} JSON 결과
 */
function setLayerProperties(args) {
    try {
        var compName = args.compName || "";
        var layerName = args.layerName || "";
        var layerIndex = args.layerIndex;
        
        var position = args.position;
        var scale = args.scale;
        var rotation = args.rotation;
        var opacity = args.opacity;
        var startTime = args.startTime;
        var duration = args.duration;
        
        var textContent = args.text;
        var fontFamily = args.fontFamily;
        var fontSize = args.fontSize;
        var fillColor = args.fillColor;
        
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) {
                layer = comp.layer(layerIndex);
            } else {
                throw new Error("Layer index out of bounds: " + layerIndex);
            }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) {
                    layer = comp.layer(j);
                    break;
                }
            }
        }
        
        if (!layer) {
            throw new Error("Layer not found: " + (layerName || "index " + layerIndex));
        }
        
        var changedProperties = [];
        var textDocument = null;
        
        if (layer instanceof TextLayer && (textContent !== undefined || fontFamily !== undefined || fontSize !== undefined || fillColor !== undefined)) {
            var sourceTextProp = layer.property("Source Text");
            if (sourceTextProp && sourceTextProp.value) {
                var currentTextDocument = sourceTextProp.value;
                var updated = false;
                
                if (textContent !== undefined && textContent !== null && currentTextDocument.text !== textContent) {
                    currentTextDocument.text = textContent;
                    changedProperties.push("text");
                    updated = true;
                }
                
                if (fontFamily !== undefined && fontFamily !== null) {
                    var resolvedFont = resolveFontFamily(fontFamily, "Arial");
                    if (currentTextDocument.font !== resolvedFont) {
                        currentTextDocument.font = resolvedFont;
                    }
                    changedProperties.push("fontFamily");
                    updated = true;
                }
                
                if (fontSize !== undefined && fontSize !== null && currentTextDocument.fontSize !== fontSize) {
                    currentTextDocument.fontSize = fontSize;
                    changedProperties.push("fontSize");
                    updated = true;
                }
                
                if (fillColor !== undefined && fillColor !== null &&
                    (currentTextDocument.fillColor[0] !== fillColor[0] ||
                     currentTextDocument.fillColor[1] !== fillColor[1] ||
                     currentTextDocument.fillColor[2] !== fillColor[2])) {
                    currentTextDocument.fillColor = fillColor;
                    changedProperties.push("fillColor");
                    updated = true;
                }
                
                if (updated) {
                    sourceTextProp.setValue(currentTextDocument);
                }
                
                textDocument = currentTextDocument;
            }
        }
        
        if (position !== undefined && position !== null) {
            layer.property("Position").setValue(position);
            changedProperties.push("position");
        }
        
        if (scale !== undefined && scale !== null) {
            layer.property("Scale").setValue(scale);
            changedProperties.push("scale");
        }
        
        if (rotation !== undefined && rotation !== null) {
            if (layer.threeDLayer) {
                layer.property("Z Rotation").setValue(rotation);
            } else {
                layer.property("Rotation").setValue(rotation);
            }
            changedProperties.push("rotation");
        }
        
        if (opacity !== undefined && opacity !== null) {
            layer.property("Opacity").setValue(opacity);
            changedProperties.push("opacity");
        }
        
        if (startTime !== undefined && startTime !== null) {
            layer.startTime = startTime;
            changedProperties.push("startTime");
        }
        
        if (duration !== undefined && duration !== null && duration > 0) {
            var actualStartTime = (startTime !== undefined && startTime !== null) ? startTime : layer.startTime;
            layer.outPoint = actualStartTime + duration;
            changedProperties.push("duration");
        }
        
        var returnLayerInfo = {
            name: layer.name,
            index: layer.index,
            position: layer.property("Position").value,
            scale: layer.property("Scale").value,
            rotation: layer.threeDLayer ? layer.property("Z Rotation").value : layer.property("Rotation").value,
            opacity: layer.property("Opacity").value,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            changedProperties: changedProperties
        };
        
        if (layer instanceof TextLayer && textDocument) {
            returnLayerInfo.text = textDocument.text;
            returnLayerInfo.fontFamily = textDocument.font;
            returnLayerInfo.fontSize = textDocument.fontSize;
            returnLayerInfo.fillColor = textDocument.fillColor;
        }
        
        return JSON.stringify({
            status: "success",
            message: "Layer properties updated successfully",
            layer: returnLayerInfo
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

/**
 * 레이어 속성에 키프레임을 설정합니다.
 * 
 * @param {number} compIndex - 컴포지션 인덱스 (1-based)
 * @param {number} layerIndex - 레이어 인덱스 (1-based)
 * @param {string} propertyName - 속성 이름 ("Position", "Scale", "Rotation", "Opacity")
 * @param {number} timeInSeconds - 시간 (초)
 * @param {any} value - 값 (예: [x, y] for Position)
 * @returns {string} JSON 결과
 */
function setLayerKeyframe(compIndex, layerIndex, propertyName, timeInSeconds, value) {
    try {
        var comp = app.project.items[compIndex];
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({
                success: false,
                message: "Composition not found at index " + compIndex
            });
        }
        
        var layer = comp.layers[layerIndex];
        if (!layer) {
            return JSON.stringify({
                success: false,
                message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"
            });
        }
        
        var transformGroup = layer.property("Transform");
        if (!transformGroup) {
            return JSON.stringify({
                success: false,
                message: "Transform properties not found for layer '" + layer.name + "'"
            });
        }
        
        var property = transformGroup.property(propertyName);
        if (!property) {
            if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                property = layer.property("Effects").property(propertyName);
            } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                property = layer.property("Text").property(propertyName);
            }
            
            if (!property) {
                return JSON.stringify({
                    success: false,
                    message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'"
                });
            }
        }
        
        if (!property.canVaryOverTime) {
            return JSON.stringify({
                success: false,
                message: "Property '" + propertyName + "' cannot be keyframed"
            });
        }
        
        if (property.numKeys === 0 && !property.isTimeVarying) {
            property.setValueAtTime(comp.time, property.value);
        }
        
        property.setValueAtTime(timeInSeconds, value);
        
        return JSON.stringify({
            success: true,
            message: "Keyframe set for '" + propertyName + "' on layer '" + layer.name + "' at " + timeInSeconds + "s"
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            message: "Error setting keyframe: " + e.toString()
        });
    }
}

/**
 * 레이어 속성에 Expression을 설정합니다.
 * 
 * @param {number} compIndex - 컴포지션 인덱스 (1-based)
 * @param {number} layerIndex - 레이어 인덱스 (1-based)
 * @param {string} propertyName - 속성 이름
 * @param {string} expressionString - Expression 코드 (빈 문자열이면 제거)
 * @returns {string} JSON 결과
 */
function setLayerExpression(compIndex, layerIndex, propertyName, expressionString) {
    try {
        var comp = app.project.items[compIndex];
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({
                success: false,
                message: "Composition not found at index " + compIndex
            });
        }
        
        var layer = comp.layers[layerIndex];
        if (!layer) {
            return JSON.stringify({
                success: false,
                message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"
            });
        }
        
        var transformGroup = layer.property("Transform");
        var property = transformGroup ? transformGroup.property(propertyName) : null;
        
        if (!property) {
            if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                property = layer.property("Effects").property(propertyName);
            } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                property = layer.property("Text").property(propertyName);
            }
            
            if (!property) {
                return JSON.stringify({
                    success: false,
                    message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'"
                });
            }
        }
        
        if (!property.canSetExpression) {
            return JSON.stringify({
                success: false,
                message: "Property '" + propertyName + "' does not support expressions"
            });
        }
        
        property.expression = expressionString;
        
        var action = expressionString === "" ? "removed" : "set";
        return JSON.stringify({
            success: true,
            message: "Expression " + action + " for '" + propertyName + "' on layer '" + layer.name + "'"
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            message: "Error setting expression: " + e.toString()
        });
    }
}

// =============================================================================
// 이펙트
// =============================================================================

/**
 * 레이어에 이펙트를 적용합니다.
 * 
 * @param {Object} args - 이펙트 설정
 * @param {number} args.compIndex - 컴포지션 인덱스 (기본값: 1)
 * @param {number} args.layerIndex - 레이어 인덱스 (기본값: 1)
 * @param {string} args.effectName - 이펙트 표시 이름
 * @param {string} args.effectMatchName - 이펙트 내부 이름 (더 안정적)
 * @param {Object} args.effectSettings - 이펙트 설정값
 * @returns {string} JSON 결과
 */
function applyEffect(args) {
    try {
        var compIndex = args.compIndex || 1;
        var layerIndex = args.layerIndex || 1;
        var effectName = args.effectName;
        var effectMatchName = args.effectMatchName;
        var effectSettings = args.effectSettings || {};
        
        if (!effectName && !effectMatchName) {
            throw new Error("You must specify either effectName or effectMatchName");
        }
        
        var comp = app.project.item(compIndex);
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Composition not found at index " + compIndex);
        }
        
        var layer = comp.layer(layerIndex);
        if (!layer) {
            throw new Error("Layer not found at index " + layerIndex + " in composition '" + comp.name + "'");
        }
        
        var effect = effectMatchName ? 
            layer.Effects.addProperty(effectMatchName) : 
            layer.Effects.addProperty(effectName);
        
        applyEffectSettings(effect, effectSettings);
        
        return JSON.stringify({
            status: "success",
            message: "Effect applied successfully",
            effect: {
                type: "effect",
                name: effect.name,
                matchName: effect.matchName,
                index: effect.propertyIndex
            },
            layer: {
                name: layer.name,
                index: layerIndex
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

/**
 * 이펙트 설정을 적용합니다 (헬퍼 함수).
 * 
 * @param {Property} effect - 이펙트 속성
 * @param {Object} settings - 설정값 객체
 */
function applyEffectSettings(effect, settings) {
    if (!settings || Object.keys(settings).length === 0) {
        return;
    }
    
    for (var propName in settings) {
        if (settings.hasOwnProperty(propName)) {
            try {
                var property = null;
                
                try {
                    property = effect.property(propName);
                } catch (e) {
                    for (var i = 1; i <= effect.numProperties; i++) {
                        var prop = effect.property(i);
                        if (prop.name === propName) {
                            property = prop;
                            break;
                        }
                    }
                }
                
                if (property && property.setValue) {
                    property.setValue(settings[propName]);
                }
            } catch (e) {
                $.writeln("Error setting effect property '" + propName + "': " + e.toString());
            }
        }
    }
}

/**
 * 미리 정의된 이펙트 템플릿을 적용합니다.
 * 
 * @param {Object} args - 템플릿 설정
 * @param {number} args.compIndex - 컴포지션 인덱스 (기본값: 1)
 * @param {number} args.layerIndex - 레이어 인덱스 (기본값: 1)
 * @param {string} args.templateName - 템플릿 이름
 * @param {Object} args.customSettings - 커스텀 설정값
 * @returns {string} JSON 결과
 */
function applyEffectTemplate(args) {
    try {
        var compIndex = args.compIndex || 1;
        var layerIndex = args.layerIndex || 1;
        var templateName = args.templateName;
        var customSettings = args.customSettings || {};
        
        if (!templateName) {
            throw new Error("You must specify a templateName");
        }
        
        var comp = app.project.item(compIndex);
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Composition not found at index " + compIndex);
        }
        
        var layer = comp.layer(layerIndex);
        if (!layer) {
            throw new Error("Layer not found at index " + layerIndex + " in composition '" + comp.name + "'");
        }
        
        var templates = {
            "gaussian-blur": {
                effectMatchName: "ADBE Gaussian Blur 2",
                settings: {
                    "Blurriness": customSettings.blurriness || 20
                }
            },
            "directional-blur": {
                effectMatchName: "ADBE Directional Blur",
                settings: {
                    "Direction": customSettings.direction || 0,
                    "Blur Length": customSettings.length || 10
                }
            },
            "color-balance": {
                effectMatchName: "ADBE Color Balance (HLS)",
                settings: {
                    "Hue": customSettings.hue || 0,
                    "Lightness": customSettings.lightness || 0,
                    "Saturation": customSettings.saturation || 0
                }
            },
            "brightness-contrast": {
                effectMatchName: "ADBE Brightness & Contrast 2",
                settings: {
                    "Brightness": customSettings.brightness || 0,
                    "Contrast": customSettings.contrast || 0,
                    "Use Legacy": false
                }
            },
            "glow": {
                effectMatchName: "ADBE Glow",
                settings: {
                    "Glow Threshold": customSettings.threshold || 50,
                    "Glow Radius": customSettings.radius || 15,
                    "Glow Intensity": customSettings.intensity || 1
                }
            },
            "drop-shadow": {
                effectMatchName: "ADBE Drop Shadow",
                settings: {
                    "Shadow Color": customSettings.color || [0, 0, 0, 1],
                    "Opacity": customSettings.opacity || 50,
                    "Direction": customSettings.direction || 135,
                    "Distance": customSettings.distance || 10,
                    "Softness": customSettings.softness || 10
                }
            },
            "cinematic-look": {
                effects: [
                    {
                        effectMatchName: "ADBE CurvesCustom",
                        settings: {}
                    },
                    {
                        effectMatchName: "ADBE Vibrance",
                        settings: {
                            "Vibrance": 15,
                            "Saturation": -5
                        }
                    }
                ]
            },
            "text-pop": {
                effects: [
                    {
                        effectMatchName: "ADBE Drop Shadow",
                        settings: {
                            "Shadow Color": [0, 0, 0, 1],
                            "Opacity": 75,
                            "Distance": 5,
                            "Softness": 10
                        }
                    },
                    {
                        effectMatchName: "ADBE Glow",
                        settings: {
                            "Glow Threshold": 50,
                            "Glow Radius": 10,
                            "Glow Intensity": 1.5
                        }
                    }
                ]
            }
        };
        
        var template = templates[templateName];
        if (!template) {
            var availableTemplates = Object.keys(templates).join(", ");
            throw new Error("Template '" + templateName + "' not found. Available templates: " + availableTemplates);
        }
        
        var appliedEffects = [];
        
        if (template.effectMatchName) {
            var effect = layer.Effects.addProperty(template.effectMatchName);
            
            for (var propName in template.settings) {
                try {
                    var property = effect.property(propName);
                    if (property) {
                        property.setValue(template.settings[propName]);
                    }
                } catch (e) {
                    $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                }
            }
            
            appliedEffects.push({
                name: effect.name,
                matchName: effect.matchName
            });
        } else if (template.effects) {
            for (var i = 0; i < template.effects.length; i++) {
                var effectData = template.effects[i];
                var effect = layer.Effects.addProperty(effectData.effectMatchName);
                
                for (var propName in effectData.settings) {
                    try {
                        var property = effect.property(propName);
                        if (property) {
                            property.setValue(effectData.settings[propName]);
                        }
                    } catch (e) {
                        $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
                    }
                }
                
                appliedEffects.push({
                    name: effect.name,
                    matchName: effect.matchName
                });
            }
        }
        
        return JSON.stringify({
            status: "success",
            message: "Effect template '" + templateName + "' applied successfully",
            appliedEffects: appliedEffects,
            layer: {
                name: layer.name,
                index: layerIndex
            },
            composition: {
                name: comp.name,
                index: compIndex
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}
