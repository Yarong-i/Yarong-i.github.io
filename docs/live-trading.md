# 실전 운용 공개 기록 연동

홈페이지의 추천 바로 아래에 실전 운용 기록을 표시한다. 주문을 실행하는 기능은 없다.
서버에서 공개용으로 정제한 snapshot을 빌드 전 `data/live-trading.json`으로 복사한다.
이는 새 연동 계약이며 기존 서버가 이미 출력한다고 가정하지 않는다. 원본 계좌 장부를 복사하지 않는다.
실제 운영 모델은 각 기록의 model로 명시한다. 추천 모델에서 추측하지 않는다.

스키마: `src/utils/live-trading.ts`의 snapshotSchema. version=1, updatedAt은 시간대 포함 ISO 시각,
records는 거래 단위 기록 배열. 각 기록 필수 필드:
- id: 공개용 식별자 (증권사 주문번호 금지)
- model, symbol(6자리), name, status, updatedAt
- requestedQuantity: 매수 주문 수량
- filledQuantity, filledAmount: 누적 매수 체결 수량·금액(원, 수수료 제외)
- heldQuantity, averagePrice: 현재 보유 수량·평균 매수가
- takeProfitPrice, stopLossPrice: 확인된 전략 기준가
- events: { at, text } 배열. 주문 시도, 접수, 일부 체결, 거절, 취소, 미체결 종료,
  매도 시도·체결, 실패와 공개 가능한 이유를 시간순 기록. 체결 수량·가격은 text에 포함.
숫자 미확인은 null. 확인된 0만 0으로 기록. 시각은 원본 이벤트 시각이며 빌드 시각으로 대체하지 않는다.
status 목록은 labels 참조. 보유 중 익절·손절 조건 감시는 실제 매도 주문 접수와 다르다.

전송은 임시 파일을 완성한 후 원자적으로 교체한다. 증권사 응답으로 상태를 대조하고
과거 이력을 보존한 전체 snapshot을 내보낸다. 현재 구현은 빌드 시점에 읽으므로 갱신 시 재빌드가 필요하다.
계좌번호, 주문 식별자, 토큰, 잔고 전체, 내부 주소, 비공개 오류 원문은 포함하지 않는다.
파일 누락은 연동 대기, 형식 오류는 기록 확인 불가, 빈 records는 공개 내역 없음으로 구분한다.
이 연동의 서버 exporter와 자동 배포 주기는 별도 연결이 필요하다.

## 대시보드 추가 필드

기존 version 1에 선택 필드를 추가했다. 기존 snapshot도 읽지만 운영 모델과 성과는 추측하지 않는다.
`operators` 배열: model, since/through(YYYY-MM-DD), updatedAt(시간대 포함),
realizedPnl/ unrealizedPnl(원, 음수 허용 또는 null), returnPct(% 또는 null),
closedTrades/ winningTrades(정수 또는 null), costBasis(net/gross/unknown), returnMethod(산식 설명 또는 null).
성과는 서버 장부에서 계산한 실거래 값만 내보낸다. 입출금을 수익으로 계산하지 않으며
수익률 분모·기간·비용 반영 기준을 returnMethod에 적는다. 익절가로 평가손익을 계산하지 않는다.
`operators`는 현재 운용 주체의 명시적 목록이며 과거 거래의 model 값에서 역추론하지 않는다.
records[].statusSince는 현재 상태 시작 시각(선택); updatedAt은 마지막 확인 시각이다.
추가 상태: take_profit_waiting / stop_loss_waiting / exit_waiting,
take_profit_submitted / stop_loss_submitted. 조건 대기와 증권사 주문 접수를 반드시 구분한다.
events[].status는 해당 이벤트 발생 당시 상태(선택). 현재 상태를 과거 이벤트에 소급 적용하지 않는다.
홈페이지는 모델별 성과·종목별 상태·전체 거래의 시간순 이력을 표시한다.

## 바로 연결하기 (브라우저 자동 갱신)

1. `src/data/live-trading-config.ts`의 endpoint에 공개 읽기 전용 HTTPS JSON 주소를 설정한다.
2. 위 snapshotSchema에 맞는 JSON을 응답한다. 다른 도메인이면 `Access-Control-Allow-Origin: https://yarong.kr`을 허용하고 `Cache-Control: no-store`와 `Content-Type: application/json`을 설정한다.
3. 주소 설정 후 홈페이지를 한 번 배포한다. 이후 데이터 갱신에는 홈페이지 재빌드가 필요 없다.

10초 간격, 요청 제한 8초, 원본 updatedAt이 60초 넘게 오래되면 업데이트 지연으로 표시한다.
비활성 탭에서는 조회를 쉬고 돌아오면 즉시 조회한다. 실패·형식 오류·시간 역행 시 마지막 정상 기록을 유지한다.
수신 시각과 원본 확인 시각은 다르다. updatedAt은 서버가 원본 상태를 실제 확인한 시각이며 단순 응답 시각으로 갱신하면 안 된다.
휴장/정지 중에도 이전 기록을 현재 상태로 단정하지 않는다. 갱신 주기에 맞춰 staleMs를 조정할 수 있다.
브라우저에서 인증정보 없이 조회하므로 공개를 허용한 항목만 반환해야 한다.
endpoint가 빈 문자열이면 요청하지 않고 기존 빌드 기록 또는 연동 대기 화면을 유지한다.
정적 GitHub Pages의 JSON만 바꿔서는 서버 상태가 자동 갱신되지 않는다. 별도 exporter/API 연결은 아직 필요하다.

## 현재 연결 상태 (2026-11-27)

- 화면: `LiveTrading.astro`는 오늘의 추천과 같은 2열 격자·글꼴·괘선을 쓰고, 운영 모델 → 실전 성적 → 현재 상태 → 시각별 이력 순서로 보인다.
  빌드와 브라우저 갱신이 같은 렌더러(`src/utils/live-trading-view.ts`)를 쓴다. 상태는 색이 아니라 글자 라벨로 구분한다.
- 서버 exporter: 투자 서버에 읽기 전용(sqlite `mode=ro`) exporter가 있다. 실행기 원장을 snapshotSchema로 바꿔 원자적으로 쓴다.
  updatedAt은 실행기 서비스가 동작 중일 때 원장을 읽은 시각이며, 서비스가 멈추면 이전 파일을 그대로 둔다(홈페이지에 지연 표시).
  주문 전송 OFF의 모의 행(DRY)은 내보내지 않는다. operators는 주문 전송 ON이고 시작일이 지난 뒤에만 넣는다.
  이 전략은 −1.5%/+3%를 관찰만 하고 익절·손절 주문을 내지 않으므로 takeProfitPrice/stopLossPrice는 null이다.
  체결 이벤트 시각은 증권사 체결 시각이 아니라 실행기가 체결을 확인한 시각이며, 이벤트 문구에 그렇게 적는다.
- 공개 HTTPS 주소: 아직 없다. 투자 서버에는 공개 웹 포트가 없어 DNS·인증서·방화벽 설정이 필요하다. 그 전까지 endpoint는 빈 문자열이다.
