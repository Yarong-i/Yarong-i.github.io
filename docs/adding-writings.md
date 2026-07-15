# 글 추가 가이드

## 새 글 파일 생성

프로젝트 루트에서 다음 명령을 실행합니다.

```bash
npm run writing:new
```

제목, 파일명으로 사용할 slug, 작성일, 분류, 태그, draft 여부를 차례로 입력합니다. slug에는 소문자 영문, 숫자, 하이픈만 사용할 수 있습니다. 같은 이름의 Markdown 파일이 이미 있으면 기존 파일을 덮어쓰지 않고 중단합니다.

생성된 파일은 `src/content/writings/<slug>.md`에 있습니다. 파일의 frontmatter 아래에 있는 다음 주석을 실제 원문으로 교체합니다.

```markdown
<!-- 여기에 원문을 입력하세요. -->
```

시의 줄바꿈을 보존하려면 각 행을 Markdown에서도 별도 행으로 입력합니다.

## 날짜의 의미

- `writtenAt`: 실제 작성일입니다. 정확한 날짜를 모르면 생략합니다. Archive의 연도와 Writings의 기본 정렬에 사용됩니다.
- `publishedAt`: 홈페이지에 글을 등록하거나 공개한 날짜입니다. 생성 명령을 실행한 날짜가 기본값으로 입력됩니다.
- `updatedAt`: 공개 후 내용을 수정한 날짜입니다. 수정 이력을 표시할 필요가 있을 때만 추가합니다.

작성일을 추정해서 입력하지 마세요. `writtenAt`이 없는 글은 Archive의 `DATE UNKNOWN` 그룹과 Writings 목록의 날짜가 있는 글 뒤에 표시됩니다.

## Draft와 공개 저장소 주의사항

`draft: true`인 글은 홈페이지 목록, 검색, 랜덤 글, 상세 정적 페이지에서 제외됩니다. 하지만 GitHub 저장소가 공개 상태라면 Markdown 원문 자체는 저장소 방문자에게 보일 수 있습니다. 공개하면 안 되는 초안이나 민감한 내용은 공개 저장소에 commit하거나 push하지 마세요.

## 검증과 게시 순서

원문과 frontmatter를 확인한 뒤 다음 순서로 진행합니다.

```bash
npm run build
git diff --check
git status
git add -- src/content/writings/<slug>.md
git commit -m "content: add <title>"
git push
```

`git add .` 대신 검토한 파일 경로를 명시합니다.

## 여러 글을 한 번에 추가하기

글마다 `npm run writing:new`을 한 번씩 실행합니다. 모든 Markdown 파일에 원문을 입력한 후 `npm run build`를 한 번 실행해 함께 검증할 수 있습니다. 이후 검토가 끝난 파일만 경로를 나열해 stage합니다.

```bash
git add -- \
  src/content/writings/first-writing.md \
  src/content/writings/second-writing.md
```

각 글의 `writtenAt`, `publishedAt`, `draft` 값을 개별적으로 확인한 뒤 commit과 push를 진행합니다.
