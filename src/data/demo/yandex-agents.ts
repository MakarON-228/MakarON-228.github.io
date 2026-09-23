/**
 * Платформа команды «AI Болид» (Yandex Vibe Coding Hackathon, Apr 2026) — НАСТОЯЩАЯ структура,
 * извлечена из кода репозитория `team-ai-bolid`:
 *   src/proposal_evaluator.py   — панель оценки заявки
 *   src/deep_research.py        — цепочка deep research
 *   src/task_export_agent.py    — MCP-агенты экспорта
 *   src/app/models/project.py   — статусы проекта
 *   docs/how_we_solwed_3rd_task.md — описание решения
 *
 * Всего агентов: 5 (оценка) + 9 (deep research) + 2 (экспорт) = 16.
 * Модели: YandexGPT 5.1 Pro по умолчанию, профиль DeepSeek V3.2 — через Yandex AI Studio.
 * Промпты агентов хранятся в AI Studio и подключаются по id (AGENT_*_ID в .env).
 */

export type Group = 'evaluation' | 'research' | 'export';

export interface Agent {
  id: string;            // имя в коде
  title: string;         // как в UI платформы
  group: Group;
  role: string;          // одна строка для сайта, по промпту/коду
  reads?: { from: string; chars: number }[]; // чьи выводы получает на вход и сколько символов (compact_text)
  extracts?: string[];   // что код вытаскивает из ответа
  timeoutSec: number;
}

/** Этап 1. Оценка заявки: четыре эксперта ПАРАЛЛЕЛЬНО (ThreadPoolExecutor, 4 потока), затем модератор. */
export const evaluation: Agent[] = [
  { id: 'technical_analyst', title: 'Technical Analyst', group: 'evaluation', timeoutSec: 180,
    role: 'Judges technical depth and feasibility of the proposal.' },
  { id: 'market_researcher', title: 'Market Researcher', group: 'evaluation', timeoutSec: 180,
    role: 'Judges market potential and audience.' },
  { id: 'innovator', title: 'Innovator', group: 'evaluation', timeoutSec: 300,
    role: 'Judges novelty; the most exploratory persona.' },
  { id: 'risk_assessor', title: 'Risk Assessor', group: 'evaluation', timeoutSec: 180,
    role: 'Judges risks and what would mitigate them.' },
  { id: 'moderator', title: 'Moderator', group: 'evaluation', timeoutSec: 300,
    role: 'Synthesises the four opinions into a weighted 0–100 score and a verdict; may not ignore critical risks without mitigations.',
    reads: [
      { from: 'technical_analyst', chars: -1 }, { from: 'market_researcher', chars: -1 },
      { from: 'innovator', chars: -1 }, { from: 'risk_assessor', chars: -1 },
    ],
    extracts: ['verdict: APPROVE | REJECT | UNDECIDED'] },
];

/**
 * Этап 2. Deep research — ПОСЛЕДОВАТЕЛЬНАЯ цепочка из 9 агентов. Каждый получает сжатые выводы предыдущих;
 * `chars` — лимит compact_text из кода. Прогресс «completed / 9» пушится в UI.
 */
export const research: Agent[] = [
  { id: 'project_analyst', title: 'Project Analyst', group: 'research', timeoutSec: 180,
    role: 'Business goals, audience, measurable functional / non-functional / business requirements.' },
  { id: 'research_strategist', title: 'Research Strategist', group: 'research', timeoutSec: 180,
    role: 'Testable growth hypotheses with metrics, research plan, competitor scan (web search).',
    reads: [{ from: 'project_analyst', chars: 5000 }] },
  { id: 'technical_researcher', title: 'Technical Researcher', group: 'research', timeoutSec: 300,
    role: 'Concrete technologies with versions, pros and cons, sources; checks the hypotheses (web search).',
    reads: [{ from: 'project_analyst', chars: 3000 }, { from: 'research_strategist', chars: 4000 }] },
  { id: 'architect', title: 'Architect', group: 'research', timeoutSec: 300,
    role: 'System architecture built on the chosen technologies.',
    reads: [{ from: 'project_analyst', chars: 2500 }, { from: 'technical_researcher', chars: 5000 }, { from: 'research_strategist', chars: 2500 }] },
  { id: 'roadmap_manager', title: 'Roadmap Manager', group: 'research', timeoutSec: 300,
    role: 'Development roadmap: stages, milestones, timelines.',
    reads: [{ from: 'project_analyst', chars: 2000 }, { from: 'architect', chars: 6000 }, { from: 'technical_researcher', chars: 2500 }] },
  { id: 'hr_specialist', title: 'HR Specialist', group: 'research', timeoutSec: 180,
    role: 'Team plan: roles and competencies the roadmap needs.',
    reads: [{ from: 'architect', chars: 4000 }, { from: 'roadmap_manager', chars: 6000 }] },
  { id: 'risk_analyst', title: 'Risk Analyst', group: 'research', timeoutSec: 180,
    role: 'Risk assessment of architecture, roadmap and team; gives the go / no-go call.',
    reads: [{ from: 'architect', chars: 3500 }, { from: 'roadmap_manager', chars: 4500 }, { from: 'hr_specialist', chars: 3500 }],
    extracts: ['decision: GO | GO WITH CONDITIONS | NO-GO', 'feasibility score'] },
  { id: 'quality_reviewer', title: 'Quality Reviewer', group: 'research', timeoutSec: 180,
    role: 'Reviews the whole research for quality and completeness.',
    reads: [
      { from: 'project_analyst', chars: 1800 }, { from: 'research_strategist', chars: 1800 },
      { from: 'technical_researcher', chars: 2200 }, { from: 'architect', chars: 2200 },
      { from: 'roadmap_manager', chars: 2200 }, { from: 'hr_specialist', chars: 1800 }, { from: 'risk_analyst', chars: 2200 },
    ],
    extracts: ['quality score', 'completeness score'] },
  { id: 'synthesis_manager', title: 'Synthesis Manager', group: 'research', timeoutSec: 300,
    role: 'Final report and executive summary from all eight outputs plus the scores and the decision.',
    reads: [
      { from: 'project_analyst', chars: 2500 }, { from: 'research_strategist', chars: 2500 },
      { from: 'technical_researcher', chars: 3000 }, { from: 'architect', chars: 4500 },
      { from: 'roadmap_manager', chars: 5000 }, { from: 'hr_specialist', chars: 3500 },
      { from: 'risk_analyst', chars: 3500 }, { from: 'quality_reviewer', chars: 2500 },
    ],
    extracts: ['executive summary'] },
];

/** Этап 3. Экспорт завершённого deep research — агенты сами работают через MCP (без REST из бэкенда). */
export const exporters: Agent[] = [
  { id: 'tracker_mcp', title: 'Tracker Agent', group: 'export', timeoutSec: 600,
    role: 'Turns the research into tasks in a Yandex Tracker queue via MCP.' },
  { id: 'source_craft_mcp', title: 'SourceCraft Agent', group: 'export', timeoutSec: 600,
    role: 'Carries architecture and synthesis into SourceCraft via MCP.',
    reads: [{ from: 'architect', chars: -1 }, { from: 'synthesis_manager', chars: -1 }] },
];

/** Статусы проекта — enum ProjectStatus; переходы сверены с src/app/api/projects.py.
 *  submitted → under_review происходит при запуске оценки агентами. */
export const statuses = {
  main: ['draft', 'submitted', 'under_review', 'accepted_for_research',
         'deep_research_running', 'deep_research_completed', 'on_showcase'],
  branches: {
    revision_requested: 'under_review → revision_requested → submitted again (editing moves it to draft first)',
    rejected: 'under_review → rejected (terminal)',
    archived: 'any → archived (optional)',
    dr_failed: 'deep_research_running → accepted_for_research (on error, so it can be rerun)',
  },
  humanDecision: ['approve', 'reject', 'request_revision'], // решение reviewer-а, агенты только советуют
};

/** Роли пользователей платформы. */
export const userRoles = {
  submitter: 'creates drafts, submits, chats in own projects',
  reviewer: 'review queue, runs evaluation and deep research, decides, publishes to showcase, exports',
  admin: 'reviewer rights plus admin tools (Telegram subscribers)',
};
