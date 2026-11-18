// Public contact details. Edit here only: the contact page, About, the portfolio page and the footer read
// these values. (Operations guide: docs/operations.md)
export const CONTACT = {
  email: 'yarong0821@gmail.com',
  message: '게임 이용 문의, 피드백, 협업·채용 제안은 이메일로 보내 주세요.',
  github: 'https://github.com/Yarong-i',
  githubLabel: '코드·프로젝트 보기',
} as const;

export const mailto = (address: string = CONTACT.email) => `mailto:${address}`;
