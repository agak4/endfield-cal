# Walkthrough - 장비 이미지 컨테이너 크기 문제 해결

장비를 선택하지 않았을 때 이미지가 없어 컨테이너가 축소되는 문제를 해결하기 위해 고정 크기를 적용했습니다.

## 변경 사항

### CSS 수정
- **[base.css](file:///c:/workspace/endfield-cal/css/base.css)**: `--gear-img-size: 80px;` 변수를 추가하여 장비 슬롯 크기를 전역적으로 관리합니다.
- **[components.css](file:///c:/workspace/endfield-cal/css/components.css)**: `.gear-image-container`의 너비와 높이를 `var(--gear-img-size)`로 고정하여 내용(이미지) 유무와 상관없이 형태를 유지하도록 했습니다.

## 검증 결과
- 장비를 선택하지 않은 상태(비어 있는 상태)에서도 80x80 크기의 슬롯이 정상적으로 표시됨을 확인했습니다.
- 반응형 레이아웃(1024px 이하)에서도 기존의 80px 크기가 변수를 통해 일관성 있게 적용됩니다.
