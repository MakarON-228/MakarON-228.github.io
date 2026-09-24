// Запуски AgentPipeline: состав и порядок агентов из кода, параллельность оценки, цепочка deep research и итоги.
// Ожидаемые итоги по заявкам получены разбором тех же ответов оригинальными Python-функциями team-ai-bolid.
import { describe, expect, it } from 'vitest';
import { evaluation, exporters, research } from '../../data/demo/yandex-agents';
import { proposals } from '../../data/demo/yandex-proposals';
import {
  AGENTS,
  MODERATOR,
  PANEL,
  agentById,
  doneAt,
  evaluationResult,
  evaluationSteps,
  inputsOf,
  lengthOf,
  researchResult,
  researchSteps,
  stepsOf,
} from './run';

describe('agent roster', () => {
  it('has 16 agents: 5 evaluation, 9 research, 2 export', () => {
    expect([evaluation.length, research.length, exporters.length, AGENTS.length]).toEqual([5, 9, 2, 16]);
  });

  it('keeps the order from the code', () => {
    expect(PANEL.map((a) => a.id)).toEqual(['technical_analyst', 'market_researcher', 'innovator', 'risk_assessor']);
    expect(research.map((a) => a.id)).toEqual([
      'project_analyst',
      'research_strategist',
      'technical_researcher',
      'architect',
      'roadmap_manager',
      'hr_specialist',
      'risk_analyst',
      'quality_reviewer',
      'synthesis_manager',
    ]);
  });

  it('every proposal has an answer and a duration for each agent', () => {
    for (const p of proposals) {
      for (const a of AGENTS) {
        expect(p.seconds[a.id], `${p.id}/${a.id}`).toBeGreaterThan(0);
        if (a.id !== 'tracker_mcp') expect(p.outputs[a.id], `${p.id}/${a.id}`).toBeTruthy();
      }
      expect(p.tracker('Q')).toContain('queue Q');
    }
  });
});

describe('evaluation run', () => {
  it.each(proposals.map((p) => [p.id, p] as const))('%s: four experts in parallel, then the moderator', (_, p) => {
    const steps = evaluationSteps(p);
    const panel = steps.slice(0, 4);
    const moderator = steps[4]!;
    expect(panel.every((s) => s.start === 0)).toBe(true);
    // Все четверо стартуют раньше, чем кто-то из них закончит
    expect(Math.max(...panel.map((s) => s.start))).toBeLessThan(Math.min(...panel.map((s) => s.end)));
    expect(moderator.agent).toBe(MODERATOR.id);
    expect(moderator.start).toBe(Math.max(...panel.map((s) => s.end)));
    expect(doneAt(steps, moderator.start)).toBe(4);
    expect(doneAt(steps, lengthOf(steps))).toBe(5);
  });

  it('finishing order follows the durations (as_completed)', () => {
    const order = evaluationSteps(proposals[0]!)
      .slice(0, 4)
      .sort((a, b) => a.end - b.end)
      .map((s) => s.agent);
    expect(order).toEqual(['market_researcher', 'risk_assessor', 'technical_analyst', 'innovator']);
  });
});

describe('deep research run', () => {
  it('runs the nine agents one after another', () => {
    const steps = researchSteps(proposals[0]!);
    expect(steps.map((s) => s.agent)).toEqual(research.map((a) => a.id));
    steps.slice(1).forEach((s, i) => expect(s.start).toBe(steps[i]!.end));
    expect(doneAt(steps, steps[2]!.end)).toBe(3);
  });

  it('exports run one agent each', () => {
    expect(stepsOf('tracker', proposals[0]!).map((s) => s.agent)).toEqual(['tracker_mcp']);
    expect(stepsOf('source_craft', proposals[0]!).map((s) => s.agent)).toEqual(['source_craft_mcp']);
  });
});

describe('inputs', () => {
  const outputs = proposals[0]!.outputs;

  it('passes earlier outputs through compact_text with the limits from the code', () => {
    const roadmap = inputsOf(agentById.get('roadmap_manager')!, outputs);
    expect(roadmap.map((i) => [i.from, i.limit])).toEqual([
      ['project_analyst', 2000],
      ['architect', 6000],
      ['technical_researcher', 2500],
    ]);
    expect(roadmap[1]).toMatchObject({ chars: outputs.architect!.length, truncated: false });
    expect(inputsOf(agentById.get('synthesis_manager')!, outputs)).toHaveLength(8);
  });

  it('the moderator reads the four reviews in full', () => {
    expect(inputsOf(MODERATOR, outputs).map((i) => [i.from, i.limit])).toEqual(PANEL.map((a) => [a.id, null]));
  });

  it('marks an input that compact_text cut', () => {
    const [input] = inputsOf(agentById.get('research_strategist')!, { project_analyst: 'x'.repeat(6000) });
    expect(input).toMatchObject({ limit: 5000, chars: 4989, truncated: true });
  });
});

describe('results parsed from the scripted answers', () => {
  const expected = {
    clinic: { verdict: 'APPROVE', confidence: 78, decision: 'GO WITH CONDITIONS', feasibility: 72, quality: 81, completeness: 76 },
    seeds: { verdict: 'UNDECIDED', confidence: 55, decision: 'GO', feasibility: 74, quality: 77, completeness: 70 },
    essays: { verdict: 'REJECT', confidence: 31, decision: 'NO-GO', feasibility: 38, quality: 74, completeness: 68 },
  } as const;

  it.each(proposals.map((p) => [p.id, p] as const))('%s', (id, p) => {
    const e = expected[id as keyof typeof expected];
    expect(evaluationResult(p.outputs)).toEqual({ verdict: e.verdict, confidence: e.confidence });
    const r = researchResult(p.outputs);
    expect(r).toMatchObject({ decision: e.decision, feasibility: e.feasibility, quality: e.quality, completeness: e.completeness });
    expect(r.summary).toMatch(/^[A-Z].*\.$/s);
    expect(r.summary).not.toContain('##');
  });
});
