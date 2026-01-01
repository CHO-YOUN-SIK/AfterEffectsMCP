# 전체 플로우 문서 (운영/디자이너용)

이 문서는 제품 URL 입력부터 AE 합성까지 **전체 흐름**을 설명합니다.
운영자/디자이너가 어떤 순서로 작업해야 하는지, 그리고 각 단계에서
무슨 데이터가 오가는지 이해할 수 있도록 작성했습니다.

---

## 1) 전체 흐름 요약
1. 제품 URL 입력
2. 크롤러가 제품 정보/이미지 수집
3. 디자이너가 텍스트/이미지 선택 및 수정
4. 생성 유형 선택(이미지/영상) + 프롬프트 입력
5. 생성 결과 미리보기 → 승인/재생성
6. 승인된 자산을 AE 템플릿에 합성
7. 최종 렌더/수정 반복

---

## 2) 단계별 상세

### Step A. 제품 크롤링
- 입력: 제품 상세 페이지 URL
- 처리: HTML 다운로드 → 제품명/가격/베네핏/이미지 추출
- 출력: `product` 객체 (name, price, benefits, images 등)

### Step B. 디자이너 선택
- 베네핏 문구 수정
- 사용할 이미지 체크
- 템플릿/비율 선택

### Step C. 생성 요청
- 이미지 생성 또는 영상 생성 선택
- 프롬프트 입력
- 레퍼런스 이미지/영상 첨부(선택)

### Step D. 생성 승인
- 생성 결과 미리보기
- 승인 시 AE 합성 단계로 진행
- 거절 시 재생성

### Step E. AE 합성
- 템플릿 슬롯에 텍스트/미디어 배치
- 컷 타이밍/전환 적용
- 결과 확인 후 최종 렌더

---

## 3) 데이터 흐름 (간단 스키마)

### Product Context
```
product = {
  url,
  name,
  price,
  currency,
  brand,
  benefits: [],
  images: []
}
```

### Generation Request
```
generationRequest = {
  type: "image" | "video",
  prompt,
  resolution,
  references: [],
  referenceNote
}
```

### Generation Result
```
generationResult = {
  status,
  type,
  mediaUrl,
  resolution,
  message
}
```

---

## 4) 의사 코드 (Pseudo-code)
```
INPUT: productUrl, apiKey

// A. 제품 크롤링
product = crawl(productUrl)

// B. 디자이너 선택
selectedBenefits = edit(product.benefits)
selectedImages = pick(product.images)
template = chooseTemplate()

// C. 생성 요청
req = {
  type: image | video,
  prompt,
  resolution,
  references,
  referenceNote
}
generated = generateMedia(req)

// D. 승인
if approve(generated):
    // E. AE 합성
    comp = buildTemplate(template, selectedImages, selectedBenefits, generated)
    render(comp)
else:
    regenerate()
```

---

## 5) 운영 팁
- 이미지가 너무 많으면 3~6장만 선택해도 충분합니다.
- 베네핏 문구는 짧고 단순하게 수정해야 가독성이 높습니다.
- 영상 생성(Veo)은 리드타임이 길 수 있으니 이미지 생성과 병행을 권장합니다.
