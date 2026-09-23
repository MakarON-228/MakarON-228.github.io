// Весь текст сайта — SPEC.md §6. Любое изменение фактов — сначала в SPEC.md, потом здесь.
// Разметка в строках: **…** — выделенная цифра/факт, *…* — название (курсив). См. src/lib/rich.ts.

export type Line = 'rail' | 'science' | 'agents' | 'craft';

export interface Link {
  label: string;
  href: string;
}

export interface Entry {
  /** Якорь записи: на него ведут станции карты и строки табло. */
  id: string;
  line: Line;
  title: string;
  /** Короткое имя станции на карте — SPEC.md §4. */
  station: string;
  /** Короткое уточнение после заголовка: «Winner», «sheet music editor». */
  result?: string;
  role?: string;
  place?: string;
  stack?: readonly string[];
  date: string;
  intro?: string;
  body?: string;
  bullets?: readonly string[];
  repo?: Link;
}

export interface Section {
  id: string;
  label: string;
}

const gh = (path: string): Link => ({ label: `github.com/${path}`, href: `https://github.com/${path}` });

export const sections = [
  { id: 'experience', label: 'Experience' },
  { id: 'hackathons', label: 'Hackathons' },
  { id: 'projects', label: 'Projects' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
] as const satisfies readonly Section[];

export const header = {
  name: 'Makar Glazachev',
  role: 'Backend, Data & ML Engineer',
  summary:
    'Works across the whole of a data product — the pipeline underneath, the service on top, the model in between — and ships it tested, containerised and documented.',
  email: 'makarglaza4ev@gmail.com',
  telegram: { label: 't.me/MaKaRollo', href: 'https://t.me/MaKaRollo' },
  github: gh('MakarON-228'),
  location: 'Sirius, Russia',
  languages: ['English B2', 'Russian native'],
  cv: '/Makar_Glazachev_CV.pdf',
} as const;

export const experience: readonly Entry[] = [
  {
    id: 'tmh-internship',
    line: 'rail',
    title: 'Transmashholding (TMH)',
    station: 'TMH Internship',
    role: 'Data Engineering Intern',
    place: 'Moscow',
    date: 'Jul 2026',
    intro: "Russia's largest rail rolling-stock manufacturer; joined after winning its hackathon.",
    bullets: [
      'Built a **4,400-line ETL pipeline** turning raw Excel exports — locomotive movements, depot equipment, station coordinates — into **16 analysis-ready Parquet tables** on a versioned, documented schema (DuckDB, PyArrow, RapidFuzz).',
      'Modelled **30,146 movement events**, **20,866 locomotives** and 369 enterprises, and built a **209,638-row search index** resolving locomotive numbers with or without leading zeros and down to individual sections.',
      'Shipped an interactive map visualiser: stations plotted and filterable by railway, visit frequency per period, locomotives traced over time.',
      'Backed it with 12 pytest tests, ruff gates, Docker Compose packaging and written data-model and validation docs.',
    ],
    repo: gh('MakarON-228/rzd_data_preparation_v2'),
  },
];

export const hackathons = {
  tally: '3 entered · 3 won',
  items: [
    {
      id: 'yandex',
      line: 'agents',
      title: 'Yandex Vibe Coding Hackathon',
      station: 'Yandex',
      result: 'Winner',
      role: 'captain & sole developer',
      date: 'Apr 2026',
      body: 'Platform taking a project proposal from intake to a public showcase, run by **16 agents** on YandexGPT: a review panel of four personas scoring in parallel and a moderator issuing a weighted 0–100 verdict, a **nine-agent** deep-research chain through architecture, roadmap, staffing and risk, and two MCP agents turning the result into Yandex Tracker and SourceCraft work.',
    },
    {
      id: 'tmh-hackathon',
      line: 'rail',
      title: 'TMH Hackathon, Sirius',
      station: 'TMH Hackathon',
      result: 'Winner',
      role: 'ML engineer, team Ascent',
      date: 'Feb 2026',
      body: "Wheel-life track, one of three contested by **14 teams**. Owned the prediction model: CatBoostRegressor over **407,669 wheel-wear records** in two variants — baseline hypotheses and the team's full feature set — blended with fitted weights, as per-decile error showed neither held the full range. **MSE 0.12**, served over a REST API.",
      repo: gh('Astal2307/TMHackathon_Ascent'),
    },
    {
      id: 'young-scientists',
      line: 'science',
      title: 'Young Scientists Hackathon, Sirius',
      station: 'Young Scientists',
      result: 'Winner, international field',
      date: 'Nov 2025',
      body: "*Academic Profile* — publication records harvested from Scopus, Web of Science, Google Scholar and Crossref, turned into h-index and citation metrics, a knowledge graph and collaborator recommendations. **Sole backend engineer** — FastAPI, 15 REST endpoints, JWT auth and SQLAlchemy models, serving the team's TF-IDF + KNN recommender over **194,849 researchers**.",
      repo: gh('brainstorm-sirius/academic-profile'),
    },
  ] satisfies readonly Entry[],
} as const;

export const projects: readonly Entry[] = [
  {
    id: 'sibur',
    line: 'craft',
    title: 'Chemical Feedstock Selection System',
    station: 'SIBUR',
    result: 'built with SIBUR experts',
    stack: ['Python'],
    date: 'Jul 2025',
    body: 'From warehouse stock and a reaction graph — substance transitions under given operations — the system enumerates **every** route to a target compound by solving the corresponding linear systems, then ranks them by difficulty.',
  },
  {
    id: 'score-editor',
    line: 'craft',
    title: 'Score Editor',
    station: 'Score Editor',
    result: 'sheet music editor',
    stack: ['C++17', 'Qt6'],
    date: 'Mar 2026',
    body: 'Desktop score editor — notes, rests, accidentals, barlines and multi-staff layout under strict positioning rules, PNG/PDF export, JSON projects. Live pitch input: a **hand-implemented YIN detector** places each note played into the right staff position.',
    repo: gh('MakarON-228/Note_redactor'),
  },
];

/** Все записи с датой — станции карты линий. */
export const entries: readonly Entry[] = [...experience, ...hackathons.items, ...projects];

export interface BoardRow {
  value: string;
  label: string;
  /** id записи, из текста которой взята цифра. */
  entry: string;
}

/** Табло — SPEC.md §7.2. Каждое значение обязано встречаться в тексте своей записи (см. resume.test.ts). */
export const board: readonly BoardRow[] = [
  { value: '4,400', label: 'line ETL pipeline', entry: 'tmh-internship' },
  { value: '16', label: 'Parquet tables', entry: 'tmh-internship' },
  { value: '209,638', label: 'row search index', entry: 'tmh-internship' },
  { value: '407,669', label: 'wear records', entry: 'tmh-hackathon' },
  { value: '0.12', label: 'MSE', entry: 'tmh-hackathon' },
  { value: '194,849', label: 'researchers served', entry: 'young-scientists' },
  { value: '16', label: 'AI agents', entry: 'yandex' },
];

export const education = {
  institution: 'Sirius University of Science and Technology',
  date: '2024 – 2029',
  programme: 'Design, Development and Management of Complex Information Systems',
  programmeNote: 'five-year integrated programme',
  bullets: [
    "Russia's first degree to combine secondary and higher education, admitting students straight after 9th grade, under an experimental legal regime in the Sirius Federal Territory.",
    'Core track: software architecture for critical infrastructure, systems analysis, enterprise systems, process automation.',
    'Industry projects from year one with Yandex, VK, Rosatom and Russian Railways; the final year is a full placement.',
  ],
} as const;

export const skills = [
  { group: 'Languages', items: ['Python', 'C++17', 'SQL'] },
  { group: 'Backend', items: ['FastAPI', 'SQLAlchemy', 'Pydantic', 'REST API design', 'JWT authentication'] },
  {
    group: 'Data',
    items: ['DuckDB', 'Parquet / PyArrow', 'pandas', 'NumPy', 'SciPy', 'RapidFuzz', 'ETL design'],
  },
  { group: 'ML & AI', items: ['CatBoost', 'scikit-learn', 'model serving', 'multi-agent LLM systems', 'MCP'] },
  { group: 'Tooling', items: ['Docker & Compose', 'Git', 'pytest', 'ruff', 'Qt6', 'CMake'] },
] as const;

/** Подписи интерфейса — тоже только отсюда. */
export const ui = {
  skip: 'Skip to content',
  sectionsMenu: 'Sections',
  navLabel: 'Sections',
  downloadCv: 'Download CV',
  copy: 'Copy',
  copied: 'Email copied',
  copyFailed: 'Copy failed — select the address instead',
  email: 'Email',
  telegram: 'Telegram',
  github: 'GitHub',
  repo: 'Repository',
  contactLead: 'Get in touch',
  source: gh('MakarON-228/MakarON-228.github.io'),
  sourceLabel: 'Site source',
  map: {
    title: 'Projects as transit lines',
    desc: 'Time runs from 2024 to 2026 along the lines; each project is a station in the month it happened. All lines pass through Sirius University.',
    hub: 'Sirius University',
    lines: { rail: 'Rail', science: 'Science', agents: 'Agents', craft: 'Craft' } satisfies Record<Line, string>,
    legend: 'Lines',
  },
  board: {
    title: 'Departures',
    figure: 'Figure',
    what: 'What',
    from: 'From',
    flip: 'Flip the board',
  },
} as const;
