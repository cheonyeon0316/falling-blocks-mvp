# Falling Blocks MVP

Tetris 계열 블록 낙하 퍼즐의 규칙 검증용 브라우저 MVP입니다. 게임 규칙은 UI와 분리된 `GameModel`에 있으며 Node 내장 테스트로 Acceptance를 검증합니다.

## 실행

Node.js 18 이상이 필요합니다.

```powershell
node --test
node scripts/serve.mjs
```

브라우저에서 http://127.0.0.1:4173 을 엽니다.

타이틀 화면에서 **게임 시작**을 누르거나 Enter/Space를 눌러 플레이를 시작합니다. 타이틀 배경은 `assets/generated/title/falling-blocks-title-bg.png`이며, 메뉴와 조작 안내는 반응형 HTML UI로 표시됩니다. 생성 스프라이트는 `assets/generated/normalized/`에 공통 320×320 프레임으로 정규화해 VFX와 게임오버 연출에 연결했습니다.

## 공개 데모

[GitHub Pages에서 Falling Blocks 플레이하기](https://cheonyeon0316.github.io/falling-blocks-mvp/)

`main` 브랜치에 변경을 올리면 GitHub Actions가 정적 게임 파일을 Pages에 배포합니다.

## 검증 명령

- `node --test`: 보드, 이동, 잠금, 줄 삭제, 7-Bag, SRS, Hold, 점수, Pause의 자동 테스트
- `node scripts/check.mjs`: 모든 애플리케이션 모듈 문법 검사
- `node scripts/browser-smoke.mjs`: 설치된 Chrome/Edge에서 Hold·Next, 입력, Pause, 화면 배치를 검증하고 임시 폴더에 1600×900 스크린샷 저장
- `node scripts/serve.mjs`: 정적 브라우저 실행

## 조작

- 이동: 방향키 / A, D
- 소프트 드롭: 아래 방향키 / S
- 하드 드롭: Space
- 회전: 위 방향키 / X, Z
- Hold: C / Shift
- Pause: P / Esc
- 새 게임: R
