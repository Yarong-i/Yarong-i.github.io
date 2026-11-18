# 운영 안내 — 자주 고치는 곳

| 바꿀 내용 | 편집 위치 | 표시되는 곳 |
|---|---|---|
| 공개 이메일, 문의 문구, GitHub 주소·라벨 | `src/data/site.ts` (`CONTACT`) | 문의 페이지, 소개(Contact), 포트폴리오 하단, 푸터 |
| 메인 "지금 하는 일" (프로젝트·상태·한 줄 설명·링크·순서, 수정일) | `src/data/now.ts` (`NOW`) | 메인 |
| 프로젝트 소개·상태·플레이 링크·화면 사진 | `src/content/projects/<id>.md` | 메인 카드, 프로젝트 목록·소개 |
| 프로젝트 포트폴리오 | `src/content/portfolios/<id>.md` | `/projects/<id>/portfolio/`, 포트폴리오 목록 |
| 주식 연구 기록 | 공개 데이터 저장소 `Yarong-i/yarong-research-data` (자동 게시) | 메인 주식 연구, `/research/` |

- `now.ts`의 `updated`는 손으로 고친 날짜입니다. 항목을 바꿀 때 함께 바꿉니다(빌드 날짜가 아님).
- 이메일을 바꾸면 `site.ts` 한 줄만 고치면 됩니다. 다른 파일에 주소를 직접 적지 않습니다.
- 변경 뒤 `npm run build`(타입 검사·빌드·출력 검사)를 통과하면 main에 push합니다. 배포는 GitHub Actions가 합니다.
- 개인 글(`/writings`)은 일반 탐색에 노출하지 않고 소개 페이지의 접힌 "개인 기록"에서만 연결합니다. 글 페이지는
  `noindex`입니다. 이는 노출을 줄이는 방식이며 접근 제한이 아닙니다.
