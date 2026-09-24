// Статусы проекта — порт переходов API платформы (team-ai-bolid, src/app/api/projects.py и
// src/app/services/run_jobs_memory.py): те же условия, при которых эндпоинт отвечает 400, здесь возвращают null.
// Статус archived есть в enum, но переходов в него в API нет — в демо его тоже нет.

export type ProjectStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'rejected'
  | 'accepted_for_research'
  | 'deep_research_running'
  | 'deep_research_completed'
  | 'on_showcase';

export type HumanDecision = 'approve' | 'reject' | 'request_revision';

const REVIEWABLE: readonly ProjectStatus[] = ['submitted', 'under_review', 'revision_requested'];
const EVALUABLE: readonly ProjectStatus[] = ['submitted', 'under_review', 'revision_requested', 'accepted_for_research'];
// DEEP_RESEARCH_START_ALLOWED
const RESEARCHABLE: readonly ProjectStatus[] = ['accepted_for_research', 'deep_research_completed', 'on_showcase'];

/** PATCH /projects/{id}: правка заявки после запроса доработки возвращает её в черновик. */
export function edit(s: ProjectStatus): ProjectStatus | null {
  if (s !== 'draft' && s !== 'revision_requested') return null;
  return 'draft';
}

/** POST /projects/{id}/submit */
export function submit(s: ProjectStatus): ProjectStatus | null {
  return s === 'draft' || s === 'revision_requested' ? 'submitted' : null;
}

/** POST /projects/{id}/runs/evaluation: запуск агентов переводит поданную заявку на проверку. */
export function startEvaluation(s: ProjectStatus): ProjectStatus | null {
  if (!EVALUABLE.includes(s)) return null;
  return s === 'submitted' ? 'under_review' : s;
}

/** POST /projects/{id}/review: решает человек-ревьюер, агенты только советуют. */
export function review(s: ProjectStatus, decision: HumanDecision): ProjectStatus | null {
  if (!REVIEWABLE.includes(s)) return null;
  return decision === 'approve' ? 'accepted_for_research' : decision === 'reject' ? 'rejected' : 'revision_requested';
}

/** POST /projects/{id}/runs/deep-research */
export function startDeepResearch(s: ProjectStatus): ProjectStatus | null {
  return RESEARCHABLE.includes(s) ? 'deep_research_running' : null;
}

/** Воркер deep research: успех — исследование готово; ошибка — назад к принятой, чтобы перезапустить. */
export function finishDeepResearch(s: ProjectStatus, ok: boolean): ProjectStatus | null {
  if (s !== 'deep_research_running') return null;
  return ok ? 'deep_research_completed' : 'accepted_for_research';
}

/** POST /projects/{id}/publish-showcase */
export function publish(s: ProjectStatus): ProjectStatus | null {
  return s === 'deep_research_completed' ? 'on_showcase' : null;
}

export const canReview = (s: ProjectStatus) => REVIEWABLE.includes(s);
export const canEvaluate = (s: ProjectStatus) => EVALUABLE.includes(s);
export const canResearch = (s: ProjectStatus) => RESEARCHABLE.includes(s);

/** Основная линия статусов (enum ProjectStatus) и ответвления от проверки. */
export const MAIN_LINE: readonly ProjectStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'accepted_for_research',
  'deep_research_running',
  'deep_research_completed',
  'on_showcase',
];
export const BRANCHES: readonly ProjectStatus[] = ['revision_requested', 'rejected'];
