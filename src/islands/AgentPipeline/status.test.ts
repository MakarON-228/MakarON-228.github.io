// Переходы статусов — как в src/app/api/projects.py платформы: разрешённые и запрещённые (400) для каждого действия.
import { describe, expect, it } from 'vitest';
import {
  BRANCHES,
  MAIN_LINE,
  edit,
  finishDeepResearch,
  publish,
  review,
  startDeepResearch,
  startEvaluation,
  submit,
  type ProjectStatus,
} from './status';

const ALL: ProjectStatus[] = [...MAIN_LINE, ...BRANCHES];
const allowed = (fn: (s: ProjectStatus) => ProjectStatus | null) => ALL.filter((s) => fn(s) !== null);

describe('project status transitions', () => {
  it('submits drafts and revised proposals only', () => {
    expect(allowed(submit)).toEqual(['draft', 'revision_requested']);
    expect(submit('revision_requested')).toBe('submitted');
  });

  it('editing a proposal sent back for revision makes it a draft again', () => {
    expect(allowed(edit)).toEqual(['draft', 'revision_requested']);
    expect(edit('revision_requested')).toBe('draft');
  });

  it('starting the evaluation moves a submitted proposal under review, other statuses stay', () => {
    expect(allowed(startEvaluation)).toEqual(['submitted', 'under_review', 'accepted_for_research', 'revision_requested']);
    expect(startEvaluation('submitted')).toBe('under_review');
    expect(startEvaluation('accepted_for_research')).toBe('accepted_for_research');
  });

  it('the human decision is accepted while the proposal is reviewable', () => {
    expect(allowed((s) => review(s, 'approve'))).toEqual(['submitted', 'under_review', 'revision_requested']);
    expect(review('under_review', 'approve')).toBe('accepted_for_research');
    expect(review('under_review', 'reject')).toBe('rejected');
    expect(review('submitted', 'request_revision')).toBe('revision_requested');
    expect(review('rejected', 'approve')).toBeNull();
  });

  it('deep research starts from accepted, completed or showcased projects', () => {
    expect(allowed(startDeepResearch)).toEqual(['accepted_for_research', 'deep_research_completed', 'on_showcase']);
    expect(startDeepResearch('on_showcase')).toBe('deep_research_running');
  });

  it('a failed deep research returns the project to accepted, so it can be rerun', () => {
    expect(finishDeepResearch('deep_research_running', true)).toBe('deep_research_completed');
    expect(finishDeepResearch('deep_research_running', false)).toBe('accepted_for_research');
    expect(finishDeepResearch('accepted_for_research', true)).toBeNull();
  });

  it('only a completed research can be published', () => {
    expect(allowed(publish)).toEqual(['deep_research_completed']);
    expect(publish('deep_research_completed')).toBe('on_showcase');
  });
});
