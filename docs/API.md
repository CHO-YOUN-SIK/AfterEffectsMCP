# After Effects ExtendScript & Server API 문서

이 문서는 AfterEffectsMCP 개발에 참고되는 ExtendScript API와 서버 API를 정리한 문서입니다.

## 목차

- [기본 개념](#기본-개념)
- [프로젝트/컴포지션](#프로젝트-컴포지션)
- [레이어 조작](#레이어-조작)
- [속성/키프레임](#속성-키프레임)
- [텍스트 레이어](#텍스트-레이어)
- [도형 레이어](#도형-레이어)
- [Undo Group](#undo-group)
- [서버 API](#서버-api)
- [참고 문서](#참고-문서)

---

## 기본 개념

### ExtendScript란?
Adobe After Effects 자동화를 위한 스크립트 언어 (JavaScript ES3 기반)

### Undo Group
작업 결과를 Ctrl+Z로 되돌릴 수 있도록 묶는 단위입니다.

```javascript
app.beginUndoGroup("작업 이름");
// 여기에 코드 작성
app.endUndoGroup();
```

---

## 프로젝트/컴포지션

### 활성 컴포지션 확인

```javascript
var comp = app.project.activeItem;

if (comp && comp instanceof CompItem) {
    // comp는 활성 컴포지션
    alert("컴포지션 이름: " + comp.name);
}
```

### 컴포지션 속성

```javascript
comp.name          // 컴포지션 이름
comp.width         // 너비 (픽셀)
comp.height        // 높이 (픽셀)
comp.frameRate     // 프레임레이트
comp.duration      // 길이 (초)
comp.time          // 현재 시간 (초)
```

### 새 컴포지션 생성

```javascript
var newComp = app.project.items.addComp("New Comp", 1920, 1080, 1.0, 10, 30);
// (이름, 너비, 높이, 픽셀 비율, 길이(초), 프레임레이트)
```

---

## 레이어 조작

### 선택된 레이어 가져오기

```javascript
var selectedLayers = comp.selectedLayers;

for (var i = 0; i < selectedLayers.length; i++) {
    var layer = selectedLayers[i];
    alert("레이어 이름: " + layer.name);
}
```

### 레이어 인덱스로 접근

```javascript
var layer = comp.layer(1); // 1번 레이어 (1부터 시작)
```

### 새 레이어 생성

#### Solid 레이어
```javascript
var solidLayer = comp.layers.addSolid([1, 0, 0], "Red Solid", 1920, 1080, 1.0);
// (RGB 색상, 이름, 너비, 높이, 픽셀 비율)
```

#### Null 레이어
```javascript
var nullLayer = comp.layers.addNull();
nullLayer.name = "Control Null";
```

#### 텍스트 레이어
```javascript
var textLayer = comp.layers.addText("Hello World");
```

### 레이어 삭제
```javascript
layer.remove();
```

---

## 속성/키프레임

### Transform 속성 접근

```javascript
layer.transform.position         // 위치
layer.transform.scale            // 크기
layer.transform.rotation         // 회전
layer.transform.opacity          // 불투명도
layer.transform.anchorPoint      // 앵커 포인트
```

### 속성 값 설정

```javascript
layer.transform.position.setValue([960, 540]);     // 중앙
layer.transform.opacity.setValue(50);              // 50% 불투명도
layer.transform.rotation.setValue(45);             // 45도 회전
```

### 키프레임 추가

```javascript
// 현재 시간에 키프레임 추가
layer.transform.position.setValueAtTime(comp.time, [960, 540]);

// 0초 → 2초 키프레임
layer.transform.opacity.setValueAtTime(0, 0);
layer.transform.opacity.setValueAtTime(2, 100);
```

### 키프레임 보간 설정

```javascript
// Linear
layer.transform.position.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);

// Bezier (Easy Ease)
layer.transform.position.setTemporalEaseAtKey(1, [new KeyframeEase(0, 33.33)], [new KeyframeEase(0, 33.33)]);
```

---

## 텍스트 레이어

### 텍스트 속성 변경

```javascript
var textLayer = comp.layers.addText("Hello World");
var textProp = textLayer.property("Source Text");
var textDocument = textProp.value;

textDocument.text = "새로운 텍스트";
textDocument.fontSize = 72;
textDocument.fillColor = [1, 0, 0];  // 빨간색 (RGB 0-1)
textDocument.font = "Arial";
textDocument.applyStroke = true;
textDocument.strokeColor = [0, 0, 0];
textDocument.strokeWidth = 5;

textProp.setValue(textDocument);
```

### 텍스트 정렬

```javascript
textDocument.justification = ParagraphJustification.CENTER_JUSTIFY;  // 중앙
// LEFT_JUSTIFY, RIGHT_JUSTIFY도 가능
```

---

## 도형 레이어

### Shape Layer 생성

```javascript
var shapeLayer = comp.layers.addShape();
shapeLayer.name = "My Shape";
```

### 도형 추가

```javascript
var shapeGroup = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
var rect = shapeGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
var fill = shapeGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
var stroke = shapeGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");

rect.property("Size").setValue([200, 100]);
fill.property("Color").setValue([0, 0.5, 1]);  // 파란색
stroke.property("Color").setValue([1, 1, 1]);
stroke.property("Stroke Width").setValue(5);
```

---

## Undo Group

모든 스크립트는 Undo Group으로 감싸는 것이 권장됩니다.

```javascript
app.beginUndoGroup("My Script Action");

try {
    var comp = app.project.activeItem;
    var layer = comp.layers.addText("Test");
    layer.transform.position.setValue([960, 540]);

} catch (e) {
    alert("Error: " + e.toString());
}

app.endUndoGroup();
```

---

## 사용 패턴

### 컴포지션 존재 확인

```javascript
app.beginUndoGroup("Safe Script");

var comp = app.project.activeItem;

if (!comp || !(comp instanceof CompItem)) {
    alert("활성 컴포지션이 없습니다!");
    app.endUndoGroup();
    // 스크립트 종료
}

comp.layers.addText("Hello");

app.endUndoGroup();
```

### 선택 레이어 확인

```javascript
var selectedLayers = comp.selectedLayers;

if (selectedLayers.length === 0) {
    alert("레이어를 선택해주세요!");
} else {
    for (var i = 0; i < selectedLayers.length; i++) {
        selectedLayers[i].transform.opacity.setValue(50);
    }
}
```

---

## 서버 API

### POST /crawl-product
제품 상세 페이지에서 정보를 수집합니다.

**Request**
```json
{
  "url": "https://global.amoremall.com/products/..."
}
```

**Response (success)**
```json
{
  "status": "success",
  "product": {
    "url": "...",
    "name": "...",
    "description": "...",
    "price": "...",
    "currency": "...",
    "brand": "...",
    "sku": "...",
    "benefits": ["...", "..."],
    "images": ["...", "..."]
  }
}
```

**Response (error)**
```json
{
  "status": "error",
  "message": "Failed to fetch product page",
  "details": "..."
}
```

### POST /chat
자연어 프롬프트를 ExtendScript 코드로 변환합니다.

---

## 참고 문서

- [Adobe ExtendScript Toolkit](https://www.adobe.com/devnet/scripting.html)
- [After Effects Scripting Guide](https://ae-scripting.docsforadobe.dev/)
- [Scripting Reference (PDF)](https://www.adobe.com/content/dam/acom/en/devnet/pdf/after-effects-scripting-guide-2024.pdf)

---

이 문서는 AfterEffectsMCP 프로젝트의 참고 문서입니다.

