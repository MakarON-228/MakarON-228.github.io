/**
 * SIMULATION — заявки и ответы агентов для демо AgentPipeline (SPEC.md §7.5) выдуманы. Настоящие здесь только
 * поля заявки (title, description, task, stage, deadlines — модель Project платформы) и формат ответов, которые
 * разбирает код: вердикт и «Confidence: N/100» модератора, «Overall feasibility» и GO / NO-GO у Risk Analyst,
 * «Quality» и «Completeness» у Quality Reviewer, «## Executive Summary» у Synthesis Manager.
 * Длительности — секунды симуляции (настоящие агенты работают минутами, таймауты — в yandex-agents.ts).
 * Тексты согласованы с причудами парсеров: например, «no good» парсер прочтёт как NO-GO — проверяет run.test.ts.
 */

export interface Proposal {
  id: string;
  title: string;
  description: string;
  task: string;
  stage: string;
  deadlines: string;
  /** Секунды симуляции на агента (id агента из yandex-agents.ts). */
  seconds: Record<string, number>;
  /** Ответ каждого из 16 агентов; ответ Tracker Agent зависит от очереди, которую ввёл ревьюер. */
  outputs: Record<string, string>;
  tracker: (queue: string) => string;
}

const sourceCraft =
  "Updated the project repository in SourceCraft: README.md from the synthesis report, docs/architecture.md from the architect's output.";

export const proposals: Proposal[] = [
  {
    id: 'clinic',
    title: 'Clinic queue forecast',
    description:
      'A city outpatient clinic loses hours every morning to queues at registration and outside the GP offices. We want a service that forecasts the load per office and hour a week ahead and suggests how to shift staff.',
    task: "Forecast visits per office and hour from the clinic's appointment logs; show the forecast and a suggested staff plan in a web dashboard for the head nurse.",
    stage: 'Idea; anonymised appointment logs for 2024–2025 are available.',
    deadlines: 'MVP in 3 months, pilot in one clinic by month 6.',
    seconds: {
      technical_analyst: 2.2, market_researcher: 1.6, innovator: 2.8, risk_assessor: 1.9, moderator: 1.8,
      project_analyst: 1.2, research_strategist: 1.1, technical_researcher: 1.6, architect: 1.5, roadmap_manager: 1.3,
      hr_specialist: 0.9, risk_analyst: 1.2, quality_reviewer: 1.0, synthesis_manager: 1.7,
      tracker_mcp: 2.0, source_craft_mcp: 1.6,
    },
    outputs: {
      technical_analyst:
        '## Technical assessment\nHourly visit forecasting from appointment logs is a well-studied time-series task; gradient boosting over calendar features is a sound baseline. The logs are anonymised, which keeps the data work simple.\n\n**Gap:** no plan for how the forecast reaches the schedule.\n\nScore: 80/100',
      market_researcher:
        "## Market\nEvery city clinic has the same morning peak. The buyer is the head physician, the daily user is the head nurse. Forecasting exists inside large hospital information systems, but not as a small tool a single clinic can adopt.\n\nScore: 72/100",
      innovator:
        '## Novelty\nThe forecast itself is not new; turning it into a staff plan the head nurse accepts in one click is. Worth trying a plain-words explanation next to each forecast.\n\nScore: 68/100',
      risk_assessor:
        '## Risks\n- Medical data: even anonymised logs need a data processing agreement with the clinic.\n- Adoption: nurses will ignore a plan they do not trust.\n\n**Mitigation:** forecasts only at first, staff plans after a month of checked accuracy.\n\nScore: 70/100',
      moderator:
        '## Moderator summary\nAll four reviews find the task feasible and useful; the two main risks — the data agreement and trust — both have clear mitigations.\n\n**Verdict: APPROVE**\nConfidence: 78/100\n\nFor the reviewer: accept for deep research, with the data agreement as the first milestone.',
      project_analyst:
        '## Business goals\n- Cut the morning registration queue by a third during the pilot.\n- Give the head nurse a staff plan a week ahead.\n\n## Audience\nHead nurse (daily user), head physician (buyer), registrars.\n\n## Requirements\n- Functional: hourly forecast per office, weekly staff plan, manual override.\n- Non-functional: runs inside the clinic network; no personal data leaves it.\n- Business: pilot in one clinic, then the city network.',
      research_strategist:
        '## Hypotheses\n1. Calendar and seasonal features explain most of the hourly load — metric: error under 15 % on a held-out month.\n2. A plan shown a week ahead is followed at least half the time — metric: share of accepted shifts.\n\n## Research plan\nBacktest on the 2024 logs, test on 2025; interview three head nurses.\n\n## Competitors\nForecast modules inside large hospital information systems; none sold separately to small clinics.',
      technical_researcher:
        "## Technologies\n- Forecast: CatBoost on calendar, weather and holiday features — robust on small tabular data.\n- Service: FastAPI and PostgreSQL.\n- Dashboard: React.\n- Deployment: Docker Compose on the clinic's own server.\n\n## Hypothesis check\nHypothesis 1 needs the backtest; two seasons of logs are enough to run it.",
      architect:
        "## Architecture\nModular monolith: nightly log export → features in PostgreSQL → forecast job → staffing rules → API → dashboard.\n\n## Data flow\nExport at 02:00, forecast at 03:00, the plan is ready before the morning shift.\n\n## Security\nEverything stays inside the clinic network; the dashboard sits behind the clinic's sign-on.\n\n## Observability\nForecast error is tracked daily against the real visits.",
      roadmap_manager:
        '## Roadmap\n- Month 1: data agreement, log ingestion, baseline forecast.\n- Month 2: backtest; dashboard with forecasts only.\n- Month 3: staff plan suggestions; MVP handed to the pilot clinic.\n- Months 4–6: pilot with a weekly accuracy review, then the decision on the city network.',
      hr_specialist:
        '## Team\n- ML engineer (forecast, backtests) — 1.\n- Backend developer (ingestion, API) — 1.\n- Frontend developer (dashboard) — 0.5.\n- Product owner from the clinic — 0.2.\n\n## Hiring priority\nThe ML engineer first: the backtest decides the rest.',
      risk_analyst:
        "## Project risks\n- Data agreement delayed — 40 %, high impact. Mitigation: build on synthetic logs of the same schema meanwhile.\n- Nurses do not trust the forecast — 30 %, high. Mitigation: a month of forecasts before any plan.\n- The clinic's server is too small — 20 %, medium. Mitigation: the forecast job runs at night.\n\n## Feasibility\n- Technical: 80/100\n- Organisational: 65/100\n- Financial: 75/100\n- Market: 70/100\n\nOverall feasibility: 72/100\n\n## Final recommendation\nGO WITH CONDITIONS: the data agreement is signed in month 1 and the backtest error stays under 15 %.",
      quality_reviewer:
        "## Completeness: 76/100\n- Covered well: data flow, roadmap, team.\n- Thin: the cost of the city-network rollout.\n\n## Quality: 81/100\n- Strong: every hypothesis has a metric.\n- Weak: no fallback if the clinic's server is too small.\n\n## Readiness for development\nCan start once the data agreement is in place.",
      synthesis_manager:
        '# Deep Research Report: Clinic queue forecast\n\n## Executive Summary\nAn hourly load forecast per office and a weekly staff plan for one city clinic. Recommendation: go with conditions — sign the data agreement in month 1 and keep the backtest error under 15 %. A team of 2.5 people, MVP in 3 months, pilot to month 6. Top risks: data access and the nurses’ trust.\n\n## 10. Recommendations\nStart with forecasts only; add the staff plan after a month of checked accuracy.',
      source_craft_mcp: sourceCraft,
    },
    tracker: (q) =>
      `Created 4 issues in queue ${q}: ${q}-1 data agreement and ingestion, ${q}-2 backtest and forecast dashboard, ${q}-3 staff plan suggestions, ${q}-4 pilot and accuracy reviews. Each links the research section it came from.`,
  },
  {
    id: 'seeds',
    title: 'Seed bank photo inventory',
    description:
      'A regional seed bank keeps its samples catalogued on paper. Re-checking species by eye takes a botanist about a week per shelf.',
    task: 'Photograph each sample and suggest the species with a probability, so that the botanist only confirms or corrects.',
    stage: 'Concept; no labelled photos yet.',
    deadlines: 'A prototype by the end of the season.',
    seconds: {
      technical_analyst: 1.7, market_researcher: 2.4, innovator: 2.0, risk_assessor: 1.5, moderator: 1.6,
      project_analyst: 1.1, research_strategist: 1.3, technical_researcher: 1.4, architect: 1.2, roadmap_manager: 1.0,
      hr_specialist: 1.0, risk_analyst: 1.3, quality_reviewer: 1.1, synthesis_manager: 1.5,
      tracker_mcp: 1.8, source_craft_mcp: 1.5,
    },
    outputs: {
      technical_analyst:
        '## Technical assessment\nSeeds differ by millimetres. Off-the-shelf plant classifiers are trained on leaves and flowers, not seeds, so without a labelled set of a few thousand photos the accuracy is unknown.\n\nScore: 55/100',
      market_researcher:
        '## Market\nA narrow audience: seed banks and herbaria. Useful as a public science project rather than as a product.\n\nScore: 50/100',
      innovator:
        '## Novelty\nA seed-level identifier would be genuinely new. A labelling day with students could build the dataset and the community at once.\n\nScore: 74/100',
      risk_assessor:
        '## Risks\n- No dataset: the whole plan depends on labelling first.\n- One botanist is the only expert.\n\n**Mitigation:** a two-week labelling pilot before any model work.\n\nScore: 58/100',
      moderator:
        '## Moderator summary\nThe reviews split: strong novelty, but no data yet and a narrow audience. The four opinions do not settle it either way.\n\n**Verdict: UNDECIDED**\nConfidence: 55/100\n\nFor the reviewer: ask for the labelling pilot results before deciding.',
      project_analyst:
        "## Business goals\n- Re-check the whole collection in one season instead of several.\n- Keep the botanist as the final judge.\n\n## Audience\nThe seed bank's botanist, volunteer students.\n\n## Requirements\n- Functional: photo station, species suggestion with a probability, confirm-or-correct screen.\n- Non-functional: works offline in the storage room.\n- Constraint: no labelled photos yet.",
      research_strategist:
        '## Hypotheses\n1. A labelling day with 20 students yields enough usable photos — metric: photos per hour, share the botanist rejects.\n2. A fine-tuned image model reaches useful top-3 accuracy on the 50 most common species.\n\n## Research plan\nThe labelling pilot first, the model second.\n\n## Competitors\nGeneral plant identification apps work from leaves and flowers, not seeds.',
      technical_researcher:
        '## Technologies\n- Capture: a fixed camera stand with a scale bar and even light.\n- Model: a small pretrained image classifier fine-tuned on the labelled set.\n- App: a tablet web app with an offline cache.\n\n## Hypothesis check\nHypothesis 2 depends on hypothesis 1; the pilot decides both.',
      architect:
        "## Architecture\nTablet app → local server in the storage room → model inference → review queue for the botanist → catalogue export.\n\n## Data model\nSample, photo, suggestion, botanist's decision.\n\n## Scaling\nOne storage room at a time; weekly sync to the seed bank's catalogue.",
      roadmap_manager:
        '## Roadmap\n- Weeks 1–2: camera stand, labelling pilot.\n- Weeks 3–6: first model, review screen.\n- Weeks 7–12: the full inventory run with a weekly accuracy report.',
      hr_specialist:
        "## Team\n- ML engineer — 1.\n- Full-stack developer — 1.\n- The seed bank's botanist — 0.3.\n- Student volunteers for labelling days.\n\n## Hiring priority\nThe botanist's time comes first: every label passes through them.",
      risk_analyst:
        '## Project risks\n- Too few labelled photos — 35 %, high impact. Mitigation: extra labelling days; start with the 50 most common species.\n- The botanist is overloaded — 30 %, medium. Mitigation: the review queue is sorted by model certainty.\n\n## Feasibility\n- Technical: 70/100\n- Organisational: 78/100\n- Financial: 85/100\n- Market: 60/100\n\nOverall feasibility: 74/100\n\n## Final recommendation\nGO. The pilot is cheap, and its result decides the model work.',
      quality_reviewer:
        '## Completeness: 70/100\n- Covered well: the capture process, the roadmap.\n- Thin: rare species outside the top 50.\n\n## Quality: 77/100\n- Strong: the plan starts from data, not from the model.\n- Weak: nothing on how storage-room light affects the photos.\n\n## Readiness for development\nCan start, with the pilot first.',
      synthesis_manager:
        "# Deep Research Report: Seed bank photo inventory\n\n## Executive Summary\nA photo station and a species suggester that let the botanist confirm instead of identify. Recommendation: go — start with a two-week labelling pilot on the 50 most common species. Two developers plus the seed bank's botanist; the full inventory run takes 12 weeks. Top risk: too few labelled photos.\n\n## 10. Recommendations\nRun the pilot, then train; report accuracy weekly.",
      source_craft_mcp: sourceCraft,
    },
    tracker: (q) =>
      `Created 3 issues in queue ${q}: ${q}-1 camera stand and labelling pilot, ${q}-2 first model and review screen, ${q}-3 full inventory run. Each links the research section it came from.`,
  },
  {
    id: 'essays',
    title: 'AI essay grading for schools',
    description:
      'Teachers spend their evenings grading essays. We propose a model that grades school essays on a 5-point scale and writes the feedback, replacing the teacher’s check.',
    task: "Grade the essays of pupils in grades 5–11 automatically and send the marks straight to the school's electronic register.",
    stage: 'Idea.',
    deadlines: 'Launch in all partner schools next September.',
    seconds: {
      technical_analyst: 1.5, market_researcher: 1.9, innovator: 2.5, risk_assessor: 2.6, moderator: 2.0,
      project_analyst: 1.0, research_strategist: 1.2, technical_researcher: 1.3, architect: 1.1, roadmap_manager: 1.2,
      hr_specialist: 0.9, risk_analyst: 1.5, quality_reviewer: 1.1, synthesis_manager: 1.6,
      tracker_mcp: 1.9, source_craft_mcp: 1.4,
    },
    outputs: {
      technical_analyst:
        '## Technical assessment\nDrafting feedback is doable. Grading reliably enough to go straight into the register is not — not without a rubric and a validation set marked by teachers.\n\nScore: 45/100',
      market_researcher:
        '## Market\nHigh demand from teachers, but schools buy through regional tenders; a launch in every partner school by September is unrealistic.\n\nScore: 52/100',
      innovator:
        '## Novelty\nAn assistant that drafts feedback for the teacher to edit would be both more novel and safer than a replacement.\n\nScore: 60/100',
      risk_assessor:
        "## Risks\n- Critical: marks for minors written without a teacher's check.\n- Personal data of children.\n- No pedagogical validation.\n\nThe proposal offers no mitigation for the critical risk.\n\nScore: 25/100",
      moderator:
        "## Moderator summary\nA critical risk — automatic marks for children without a teacher's check — comes with no mitigation, and critical risks may not be set aside without one.\n\n**Verdict: REJECT**\nConfidence: 31/100\n\nFor the reviewer: suggest resubmitting it as a feedback assistant for teachers.",
      project_analyst:
        "## Business goals\n- Save teachers' evening hours on essay checks.\n\n## Audience\nTeachers of grades 5–11, pupils, parents.\n\n## Requirements\n- Functional: a mark on a 5-point scale, written feedback, register export.\n- Non-functional: personal data of minors stays in the region.\n- Constraint: a mark in the register is an official record.",
      research_strategist:
        '## Hypotheses\n1. Model marks match a teacher’s within one point on 90 % of essays — metric: agreement on a teacher-marked set.\n2. Teachers accept drafted feedback with light edits — metric: edit distance.\n\n## Research plan\nCollect 500 teacher-marked essays per grade before any automation.',
      technical_researcher:
        "## Technologies\n- Model: YandexGPT with a grading rubric in the prompt.\n- Service: FastAPI and PostgreSQL.\n- Register export through the register's API.\n\n## Hypothesis check\nHypothesis 1 is unverified: no marked set exists yet.",
      architect:
        '## Architecture\nUpload → grading service → teacher review → register export.\n\n## Security\nEssays and marks of minors: encryption at rest, access by class and teacher.',
      roadmap_manager:
        '## Roadmap\n- Months 1–3: collect a marked set, a rubric per grade.\n- Months 4–6: grading model, agreement study.\n- September: partner schools — only if the agreement study passes.',
      hr_specialist:
        '## Team\n- ML engineer — 1.\n- Backend developer — 1.\n- Methodologist (a literature teacher) — 0.5.\n- Data protection officer — 0.2.',
      risk_analyst:
        "## Project risks\n- Marks without a teacher's check — 70 %, critical. No mitigation fits the stated goal of replacing the teacher.\n- Personal data of minors — 50 %, high.\n- Tender-based purchasing delays the September launch — 60 %, high.\n\n## Feasibility\n- Technical: 45/100\n- Organisational: 30/100\n- Financial: 50/100\n- Market: 40/100\n\nOverall feasibility: 38/100\n\n## Final recommendation\nNO-GO as proposed. A feedback assistant that the teacher edits would pass.",
      quality_reviewer:
        '## Completeness: 68/100\n- Covered well: risks, data protection.\n- Thin: rubric design per grade.\n\n## Quality: 74/100\n- Strong: the research is honest about the blocking risk.\n- Weak: the alternative product is only sketched.\n\n## Readiness for development\nCannot start as proposed.',
      synthesis_manager:
        "# Deep Research Report: AI essay grading for schools\n\n## Executive Summary\nAutomatic grading of school essays straight into the register. Recommendation: do not start as proposed — marks for minors without a teacher's check have no mitigation. A feedback assistant for teachers keeps most of the value: 2.5 people, 6 months to a validated pilot.\n\n## 10. Recommendations\nResubmit as a teacher-facing feedback assistant.",
      source_craft_mcp: sourceCraft,
    },
    tracker: (q) =>
      `Created 3 issues in queue ${q}: ${q}-1 teacher-marked essay set, ${q}-2 rubric per grade, ${q}-3 agreement study. Each links the research section it came from.`,
  },
];
