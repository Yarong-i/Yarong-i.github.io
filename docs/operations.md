# 운영 안내 — 자주 고치는 곳

| 바꿀 내용 | 편집 위치 | 표시되는 곳 |
|---|---|---|
| 공개 이메일, 문의 문구, GitHub 주소·라벨 | `src/data/site.ts` (`CONTACT`) | 문의 페이지, 소개(Contact), 포트폴리오 하단, 푸터 |
| 메인 "개발·연구 중" (이름·상태·소개·현재 작업·핵심 질문·이미지·순서, 수정일) | `src/content/projects/<id>.md`의 `wip` | 메인, 프로젝트 목록·소개 |
| 프로젝트 소개·상태·플레이 링크·화면 사진 | `src/content/projects/<id>.md` | 메인 카드, 프로젝트 목록·소개 |
| 프로젝트 포트폴리오 | `src/content/portfolios/<id>.md` | `/projects/<id>/portfolio/`, 포트폴리오 목록 |
| 주식 연구 기록 | 공개 데이터 저장소 `Yarong-i/yarong-research-data` (자동 게시) | 메인 주식 연구, `/research/` |

- `wip.updated`는 손으로 고친 날짜입니다. 내용을 바꿀 때 함께 바꿉니다(빌드 날짜가 아님).
- 이메일을 바꾸면 `site.ts` 한 줄만 고치면 됩니다. 다른 파일에 주소를 직접 적지 않습니다.
- 변경 뒤 `npm run build`(타입 검사·빌드·출력 검사)를 통과하면 main에 push합니다. 배포는 GitHub Actions가 합니다.
- 개인 글(`/writings`)은 일반 탐색에 노출하지 않고 소개 페이지의 접힌 "개인 기록"에서만 연결합니다. 글 페이지는
  `noindex`입니다. 이는 노출을 줄이는 방식이며 접근 제한이 아닙니다.

## 메인 "개발·연구 중" 고치기

지금 만들거나 연구하는 프로젝트(현재 `2d-action-game` 2D 액션 게임, `coin-research` 코인 연구)는
`src/content/projects/<id>.md` 한 파일에서 고칩니다. 메인 영역, 프로젝트 목록의 상태, 소개 페이지가 함께 바뀝니다.

```
---
title: 2D 액션 게임                 # 이름 (메인·목록·소개 페이지)
summary: "한 문장 소개"              # 메인과 목록에 나오는 소개
tagline: "한 문장 소개"              # 소개 페이지 맨 위 문장 (보통 summary와 같게)
stage: active
wip:
  order: 1                          # 메인 순서 (1 = PC 왼쪽, 모바일 위)
  status: 프로토타입 제작 중          # 상태 (메인·목록·소개 페이지)
  now: "현재 작업 한 문장"            # 없으면 줄을 지웁니다
  question: "핵심 질문"              # 연구 프로젝트만. 이미지가 없을 때 크게 나옵니다
  image: /media/2d-action/forest-combat.webp   # 아래 screens 중 하나. 없으면 줄을 지웁니다
  updated: 2026-11-22               # 이 내용을 고친 날짜
screens:                            # 소개 페이지 "실제 화면" (실제 화면만, 목업 금지)
  - src: /media/2d-action/forest-combat.webp
    width: 1280
    height: 720
    caption: "보이는 것만 적은 짧은 설명"
    alt: "화면을 글로 설명"
---
```

- 이미지 파일은 `public/media/<폴더>/`에 넣고 `/media/<폴더>/<파일>`로 적습니다. 이미지가 없으면 `image` 줄을
  지우면 됩니다. 빈 자리 없이 글로만 표시됩니다.
- 진행률·수익률·출시일처럼 확인하지 않은 숫자는 적지 않습니다.
- 프로젝트를 메인 영역에서 빼려면 `wip:` 묶음을 통째로 지우고, 필요하면 `stage`를 바꿉니다
  (`wip`이 있는 프로젝트는 메인 "다른 프로젝트"에 다시 나오지 않습니다).
- 새 프로젝트를 추가할 때는 기존 파일을 복사해 이름을 바꿉니다. 파일 이름이 주소(`/projects/<id>/`)가 됩니다.

## 업데이트 기록 한 건 추가하기

이미 공개 서버나 홈페이지에 반영된 변경만 적습니다. 지금 진행 중인 일은 프로젝트 파일의 `wip`(메인 "개발·연구 중")에 적습니다.

1. `src/content/news/` 폴더에 새 파일을 만듭니다. 이름은 `날짜-짧은영문.md` 형식입니다.
   예: `src/content/news/2026-11-25-junk-pet-fix.md`
2. 아래 내용을 붙여 넣고 고칩니다. `---` 두 줄 사이만 쓰면 됩니다.

   ```
   ---
   date: 2026-11-25
   kind: game
   project: junk-factory
   title: 펫 도감 표시 오류 수정
   change: "무엇을 바꿨는지 한두 문장"
   reason: "왜 바꿨는지 한두 문장"
   result: "직접 확인한 결과 한 문장 (확인하지 않았다면 이 줄을 지웁니다)"
   ---
   ```

   - `kind`: `game`(게임) · `bot`(봇) · `site`(홈페이지) 중 하나
   - `project`: 연결할 프로젝트 파일 이름 — `junk-factory`(폐품 공장), `discord-economy-bot`(롱야봇),
     `yarong-homepage`(홈페이지), `2d-action-game`(2D 액션 게임), `coin-research`(코인 연구). 그 프로젝트 페이지의 "업데이트 기록"에 나옵니다.
   - `result`는 실제로 확인한 내용만 씁니다. 수치나 성과를 추측해 채우지 않습니다.
   - 문장에 큰따옴표(`"`)를 쓰려면 바깥 따옴표를 작은따옴표(`'`)로 바꿉니다.
3. `npm run build`가 통과하면 커밋하고 main에 push합니다. 메인 "최근 소식"에는 최신 3건이 자동으로 나옵니다.

## 포트폴리오 PDF 교체하기

1. 새 PDF 파일 이름을 `yarong-portfolio.pdf`로 바꿉니다.
2. `public/files/yarong-portfolio.pdf` 자리에 덮어씁니다. (다른 이름으로 추가하지 않습니다.)
3. `npm run build` 후 커밋·push합니다. 공개 주소 `https://yarong.kr/files/yarong-portfolio.pdf`는 그대로이고,
   포트폴리오 페이지의 용량 표시는 빌드할 때 새 파일 크기로 자동으로 바뀝니다.
4. 페이지의 "9쪽 문서" 설명이 달라졌다면 `src/pages/portfolio.astro`의 `pdf-text` 문장을 함께 고칩니다.
- PDF를 지우면 다운로드 버튼도 자동으로 사라집니다(빈 버튼이 공개되지 않습니다).
- 이 PDF는 공개 저장소에 올라가므로 공개해도 되는 내용만 넣습니다.
