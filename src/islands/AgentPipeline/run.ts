// Запуски агентов в демо: порядок и параллельность — как в коде платформы (team-ai-bolid). Оценка — четыре эксперта
// в ThreadPoolExecutor на четыре потока, модератор после всех (proposal_evaluator.py); deep research — девять агентов
// по очереди (deep_research.py); экспорт — по агенту на кнопку (task_export_agent.py). Длительности — из симуляции.
// Итоги разбираются теми же функциями и в том же порядке, что в коде: решение — из ответа Risk Analyst, а если там
// его нет — из синтеза.
import type { Proposal } from '../../data/demo/yandex-proposals';
import { evaluation, exporters, research, type Agent } from '../../data/demo/yandex-agents';
import { LABELS, compactText, extractDecision, extractExecutiveSummary, extractScore, extractVerdict } from './parse';

export type RunKind = 'evaluation' | 'research' | 'tracker' | 'source_craft';
/** idle — не запускался; waiting — его запуск идёт, но очередь не дошла; running; done. */
export type AgentState = 'idle' | 'waiting' | 'running' | 'done';

export interface Step {
  agent: string;
  start: number;
  end: number;
}

export const PANEL = evaluation.slice(0, 4);
export const MODERATOR = evaluation[4]!;
export const TRACKER = exporters[0]!;
export const SOURCE_CRAFT = exporters[1]!;
export const AGENTS: readonly Agent[] = [...evaluation, ...research, ...exporters];
export const agentById = new Map(AGENTS.map((a) => [a.id, a]));

export function kindOf(agent: Agent): RunKind {
  if (agent.group !== 'export') return agent.group;
  return agent === TRACKER ? 'tracker' : 'source_craft';
}

/** Четыре эксперта стартуют вместе и заканчиваются кто когда (as_completed); модератор — после последнего. */
export function evaluationSteps(p: Proposal): Step[] {
  const panel = PANEL.map((a) => ({ agent: a.id, start: 0, end: p.seconds[a.id]! }));
  const start = Math.max(...panel.map((s) => s.end));
  return [...panel, { agent: MODERATOR.id, start, end: start + p.seconds[MODERATOR.id]! }];
}

/** Цепочка deep research: каждый следующий — когда закончил предыдущий. */
export function researchSteps(p: Proposal): Step[] {
  let t = 0;
  return research.map((a) => {
    const step = { agent: a.id, start: t, end: t + p.seconds[a.id]! };
    t = step.end;
    return step;
  });
}

export function stepsOf(kind: RunKind, p: Proposal): Step[] {
  if (kind === 'evaluation') return evaluationSteps(p);
  if (kind === 'research') return researchSteps(p);
  const agent = kind === 'tracker' ? TRACKER : SOURCE_CRAFT;
  return [{ agent: agent.id, start: 0, end: p.seconds[agent.id]! }];
}

export const lengthOf = (steps: readonly Step[]) => Math.max(...steps.map((s) => s.end));
export const doneAt = (steps: readonly Step[], t: number) => steps.filter((s) => s.end <= t).length;

/** _proposal_body (projects.py): что получают эксперты оценки; подписи полей переведены. */
export function proposalBody(p: Proposal): string {
  return (
    `**Project description:**\n${p.description}\n\n` +
    `**Project task:**\n${p.task}\n\n` +
    `**Stage:**\n${p.stage}\n\n` +
    `**Deadlines:**\n${p.deadlines}`
  );
}

/** _deep_project_description: deep research получает ещё и название. */
export const deepProjectDescription = (p: Proposal) => `${p.title}\n\n${proposalBody(p)}`;

export interface Input {
  from: string;
  /** Лимит compact_text из кода; null — текст целиком. */
  limit: number | null;
  /** Сколько символов агент получил в этом запуске. */
  chars: number;
  truncated: boolean;
}

/** Что агент читает из выводов других: полный текст или compact_text с лимитом из промпт-билдера. */
export function inputsOf(agent: Agent, outputs: Record<string, string>): Input[] {
  return (agent.reads ?? []).map(({ from, chars }) => {
    const raw = outputs[from] ?? '';
    if (chars < 0) return { from, limit: null, chars: raw.length, truncated: false };
    return { from, limit: chars, chars: compactText(raw, chars).length, truncated: raw.trim().length > chars };
  });
}

export interface EvaluationResult {
  verdict: ReturnType<typeof extractVerdict>;
  confidence: number | null;
}

export function evaluationResult(outputs: Record<string, string>): EvaluationResult {
  const text = outputs[MODERATOR.id] ?? '';
  return { verdict: extractVerdict(text), confidence: extractScore(text, LABELS.confidence) };
}

export interface ResearchResult {
  decision: ReturnType<typeof extractDecision>;
  feasibility: number | null;
  quality: number | null;
  completeness: number | null;
  summary: string;
}

export function researchResult(outputs: Record<string, string>): ResearchResult {
  const risk = outputs.risk_analyst ?? '';
  const review = outputs.quality_reviewer ?? '';
  const synthesis = outputs.synthesis_manager ?? '';
  let decision = extractDecision(risk);
  if (decision === 'UNKNOWN') decision = extractDecision(synthesis);
  return {
    decision,
    feasibility: extractScore(risk, LABELS.feasibility),
    quality: extractScore(review, LABELS.quality),
    completeness: extractScore(review, LABELS.completeness),
    summary: extractExecutiveSummary(synthesis),
  };
}
