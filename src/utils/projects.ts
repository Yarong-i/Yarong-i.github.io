import type { CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>;

// Progress state shown on the site. Source visibility is a separate field (`private`).
export const STAGES = {
  live: '공개 운영 중',
  operating: '운영 중',
  'in-use': '사용 중',
  active: '진행 중',
  inquiry: '문의 중',
  finished: '제작 마침',
  paused: '보류',
  ended: '종료',
} as const;
export type Stage = keyof typeof STAGES;
export const STAGE_ORDER = Object.keys(STAGES) as Stage[];

/** Stage label with its optional qualifier, e.g. "제작 마침 · 미출시". Undefined when no stage is set. */
export function stageLabel(project: Project): string | undefined {
  const { stage, stageNote } = project.data;
  if (!stage) return undefined;
  return stageNote ? `${STAGES[stage]} · ${stageNote}` : STAGES[stage];
}

/** The latest short introduction, falling back to the original description. */
export function projectSummary(project: Project): string {
  return project.data.summary ?? project.data.description ?? '';
}

export function reasonLabel(project: Project): string {
  if (project.data.reasonLabel) return project.data.reasonLabel;
  if (project.data.stage === 'paused') return '보류한 이유';
  if (project.data.stage === 'ended') return '종료한 이유';
  return '이유';
}

/** Current work first, then finished, paused and ended; newer years and then titles inside a stage. */
export function sortProjects(projects: readonly Project[]): Project[] {
  const rank = (project: Project) => (project.data.stage ? STAGE_ORDER.indexOf(project.data.stage) : STAGE_ORDER.length);
  return [...projects].sort((a, b) =>
    rank(a) - rank(b)
    || (b.data.year ?? 0) - (a.data.year ?? 0)
    || a.data.title.localeCompare(b.data.title, 'ko-KR'));
}
