// "지금 하는 일" on Home. Edit this file only: the order of `items` is the display order.
// `updated` is the date this list was last changed by hand - change it together with the items.
// It is not a build date, and nothing here implies being online right now.
export interface NowItem {
  project: string;   // project name as shown elsewhere on the site
  status: string;    // short work state, e.g. 운영·개선
  text: string;      // one sentence about the current work
  href: string;      // where the item links
}

export const NOW: { updated: string; items: NowItem[] } = {
  updated: '2026-11-18',
  items: [
    {
      project: '주식 연구',
      status: '자동 게시 검증',
      text: '모델별 추천과 장후 성과가 날짜별로 자동 기록되는 흐름을 확인하고 있습니다.',
      href: '/research/',
    },
    {
      project: '폐품 공장',
      status: '운영·개선',
      text: '자동화 이후의 성장 속도와 반복 플레이 경험을 확인하고 있습니다.',
      href: '/projects/junk-factory/',
    },
    {
      project: '롱야봇',
      status: '운영·검증',
      text: '기업 활동 공개와 자동 상장이 실제 운영에서 이어지는지 확인하고 있습니다.',
      href: '/projects/discord-economy-bot/',
    },
  ],
};
