# 영상 템플릿 규격 (Gemini용)

이 문서는 **Gemini가 읽고 그대로 행동하도록** 작성된 템플릿 규격입니다.
템플릿은 모든 제품에 공통으로 적용되며, 컷 구성/텍스트 슬롯/미디어 슬롯이 고정됩니다.

---

## 1) 템플릿 기본 규칙
- 컷 수: 5컷 고정 (15~20초 기준)
- 해상도 기본: 1920x1080, 30fps
- 컷당 메시지 1개만 전달
- 텍스트는 2~3줄 이내
- 전환은 1~2가지 스타일만 반복

---

## 2) 컷 구성 규격 (5컷)
1. **컷1 오프닝 (0~2s)**
   - 텍스트: 브랜드명 + 제품명
   - 미디어: 제품 히어로 이미지
2. **컷2 베네핏 1 (2~6s)**
   - 텍스트: 베네핏 1
   - 미디어: 제품 이미지 또는 텍스처
3. **컷3 베네핏 2 (6~10s)**
   - 텍스트: 베네핏 2
   - 미디어: 제품 이미지 또는 모델 컷
4. **컷4 사용감/텍스처 (10~14s)**
   - 텍스트: 사용감 키워드
   - 미디어: 텍스처/스와치/클로즈업
5. **컷5 CTA (14~18s)**
   - 텍스트: 구매 유도/프로모션
   - 미디어: 제품 이미지

---

## 3) 텍스트 슬롯
- `title`: 제품명/브랜드
- `benefit_1`: 핵심 베네핏 1
- `benefit_2`: 핵심 베네핏 2
- `usage`: 사용감/질감 키워드
- `cta`: 구매 유도 문구

---

## 4) 미디어 슬롯
- `hero`: 제품 메인 이미지
- `benefit_media_1`: 베네핏용 이미지
- `benefit_media_2`: 베네핏용 이미지
- `texture`: 질감/텍스처
- `cta_media`: 마지막 컷 이미지

---

## 5) Gemini 출력 규칙
- 반드시 ExtendScript 코드만 출력
- `app.beginUndoGroup("Gemini Action");`로 시작
- `app.endUndoGroup();`로 종료
- 존재하지 않는 레이어/컴프 참조 금지
- 필요한 경우 새 컴프 생성(1920x1080, 30fps)

---

## 6) 의사 코드 (Flow)
```
INPUT: product_data, template_spec, user_request(optional)

1) if active_comp exists:
       use active_comp
   else:
       create 1920x1080 comp (duration 18s, 30fps)

2) choose text slots:
       title = brand + product name
       benefit_1/benefit_2 from product_data
       usage from texture/description keywords
       cta = promo or generic CTA

3) choose media slots:
       hero, benefit_media_1, benefit_media_2, texture, cta_media

4) for each cut in 5 cuts:
       add media layer
       add text layer
       set timing (start/out)
       apply simple transition or keyframe

5) wrap in Undo Group and return ExtendScript
```
