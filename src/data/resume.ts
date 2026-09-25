// Весь текст сайта — SPEC.md §6. Любое изменение фактов — сначала в SPEC.md, потом здесь.
// Разметка в строках: **…** — выделенная цифра/факт, *…* — название (курсив). См. src/lib/rich.ts.

export type Line = 'rail' | 'science' | 'agents' | 'craft';

export interface Link {
  label: string;
  href: string;
}

export interface Entry {
  /** Якорь записи: на него ведут станции карты. */
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
      body: "Wheel-life track, one of three contested by **14 teams**. Built the baseline-hypotheses model — a CatBoostRegressor over **407,669 wheel-wear records** — and blended it 0.6 / 0.4 with a teammate's per-series ensemble on the team's full feature set, weights picked by hand, as per-decile error showed neither held the full range. **MSE 0.12**, served over a REST API.",
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
  /** Демо RailMap под записью TMH (SPEC.md §7.4). Названия дорог и станций — из данных OSM. */
  railMap: {
    title: 'Every railway station in Russia, by railway',
    badge: 'Open data',
    mapLabel: 'Map of railway stations in Russia coloured by railway',
    search: 'Find a station',
    searchHint: 'Cyrillic or Latin, e.g. Rostov',
    noMatches: 'No station matches',
    matches: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'station' : 'stations'} found`,
    halts: 'Show halts',
    railways: 'Railways',
    sort: 'Sort',
    bySize: 'By size',
    byName: 'A–Z',
    all: 'All railways',
    stations: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'station' : 'stations'}`,
    haltsCount: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'halt' : 'halts'}`,
    showing: (what: string, count: string) => `${what}: ${count}`,
    selected: (n: number) => `${n} railways`,
    card: { railway: 'Railway', esr: 'ESR code', esrShort: 'ESR', type: 'Type', operator: 'Operator', station: 'Station', halt: 'Halt' },
    loading: 'Loading the interactive map…',
    failed: 'The interactive map could not load; the static view stays.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    gestures: {
      windows: 'Use Ctrl + scroll to zoom the map',
      mac: 'Use ⌘ + scroll to zoom the map',
      mobile: 'Use two fingers to move the map',
    },
    attribution: '© OpenStreetMap contributors · Natural Earth',
    caption: (date: string) =>
      `Station data © OpenStreetMap contributors, extracted ${date}. Railway assignment derived from OSM tags and Wikidata; the original TMH visualiser worked on the company's internal data.`,
  },
  /** Демо PitchStaff под записью Score Editor (SPEC.md §7.9). */
  pitchStaff: {
    title: 'The Score Editor staff, in the browser',
    badge: 'Ported from C++',
    staffLabel: 'Staff',
    hint: 'Click the staff to place a quarter note — it snaps to the nearest slot and line; click a note to remove it. Press Record and sing or play: each steady pitch lands in the next free slot.',
    keys: 'Arrow keys move the cursor, Enter places a quarter note, Delete removes the note under the cursor.',
    legendRecorded: 'Recorded: pitch only, no duration',
    record: 'Record',
    stop: 'Stop',
    undo: 'Undo',
    clear: 'Clear',
    starting: 'Waiting for the microphone…',
    listening: 'Listening…',
    hz: (f: number) => `${f.toFixed(1)} Hz`,
    skipped: 'skipped: sharp',
    outside: 'skipped: off the staff',
    full: 'The staff is full — undo or clear to record more.',
    recordingOn: 'Recording',
    recordingOff: 'Recording stopped',
    errors: {
      denied: 'Microphone access was denied. You can still place notes by clicking the staff.',
      missing: 'No microphone found. You can still place notes by clicking the staff.',
      insecure: 'Recording needs a secure (HTTPS) page. You can still place notes by clicking the staff.',
      failed: 'The microphone could not start. You can still place notes by clicking the staff.',
    },
    position: (name: string, staff: number, slot: number) => `${name}, staff ${staff}, slot ${slot}`,
    placed: (where: string) => `Quarter note ${where}`,
    removed: (where: string) => `Removed ${where}`,
    recorded: (where: string) => `Recorded ${where}`,
    undone: 'Undone',
    cleared: 'Staff cleared',
    summary: (names: readonly string[]) => (names.length ? `Notes on the staff: ${names.join(', ')}` : 'The staff is empty'),
    caption:
      "Slot grid, staff steps and the YIN pitch detector are ported from the desktop app's C++: a note lands after three matching 4,096-sample frames, naturals only. Audio stays in your browser.",
  },
  /** Демо RouteFinder под записью SIBUR (SPEC.md §7.8). Формулы и условия реакций — из данных демо. */
  routeFinder: {
    title: 'Synthesis routes from the warehouse',
    badge: 'Illustrative data',
    target: 'Target',
    mass: 'Mass, kg',
    spec: 'Product spec, %',
    specHint: 'Written as the pipeline read it: >98, <0.015 or 0.1-0.3.',
    components: {
      main_percent: 'Main',
      fe_percent: 'Fe',
      si_percent: 'Si',
      k_percent: 'K',
      ca_percent: 'Ca',
      mg_percent: 'Mg',
      na_percent: 'Na',
    },
    presets: 'Presets',
    notebookSpec: 'Notebook spec',
    lowIron: 'Low iron',
    invalidSpec: 'Use >x, <x or a-b, in percent.',
    invalidMass: 'Enter a mass above 0 kg.',
    stale: 'Showing the last valid input.',
    graph: 'Reaction graph',
    legendStock: 'raw material in stock',
    legendTarget: 'target',
    ranked: (n: number) => `Routes, easiest first (${n})`,
    complexity: 'Complexity',
    complexityNote: 'CatBoost score per reaction, summed over the route',
    mix: (kg: string, target: string) => `Batch mix for ${kg} kg of ${target}`,
    batch: (id: number) => `Batch ${id}`,
    total: 'Total',
    product: 'Product',
    allowed: 'Allowed',
    details: 'Details',
    dropped: (n: number) => `Dropped — no feasible mix under this spec (${n})`,
    noRoutes: 'No route has a feasible mix under this spec.',
    summary: (routes: number, target: string, dropped: number, best: string | null) =>
      `${routes} ${routes === 1 ? 'route' : 'routes'} to ${target} with a feasible mix` +
      (dropped ? `, ${dropped} dropped` : '') +
      (best ? `. Easiest: ${best}.` : '.'),
    caption:
      "Reaction graph, route search, LP batch mix and CatBoost complexity scores are ported from the project's code and database; warehouse batches are the team's test data.",
  },
  /** Демо TwoModels под записью TMH Hackathon (SPEC.md §7.6). Всё на синтетике, без данных и моделей команды. */
  twoModels: {
    title: 'Where each model errs',
    badge: 'Synthetic data',
    chart: 'Mean absolute error by decile of true wear',
    axisX: 'Decile of true wear intensity, low → high',
    axisY: 'MAE',
    modelA: 'Model A',
    modelB: 'Model B',
    blend: 'Blend',
    hintA: 'accurate on typical wheels, pulls the extremes towards the mean',
    hintB: 'keeps the extremes, noisier in the middle',
    weight: 'Weight of model A',
    formula: (w: string, rest: string) => `${w} × A + ${rest} × B`,
    mse: 'MSE',
    decile: 'Decile',
    table: 'Show the numbers',
    describe: (middle: string, edges: string, blend: string) =>
      `Model A has the lower error in deciles ${middle}, model B in deciles ${edges}. ${blend}`,
    blendNow: (formula: string, mse: string, a: string, b: string) => `Blend ${formula}: MSE ${mse}; model A ${a}, model B ${b}.`,
    caption:
      'Synthetic data — made-up wear values and two made-up models, to show the idea: per-decile error reveals where each model fails, and a weighted blend covers both.',
  },
  /** Демо ApiExplorer под записью Young Scientists (SPEC.md §7.7). Эндпоинты — из academic-endpoints.ts. */
  apiExplorer: {
    title: 'The API, running in your browser',
    badge: 'Illustrative data',
    endpoints: 'Endpoints',
    endpoint: 'Endpoint',
    notAuthorized: 'Not authorized: endpoints with a lock need a bearer token. Log in as',
    goLogin: 'Open /auth/login',
    authorizedAs: 'Authorized as',
    logout: 'Log out',
    locked: 'requires a bearer token',
    parameters: 'Parameters',
    required: 'required',
    body: 'Request body',
    resetExample: 'Reset example',
    useSample: (name: string) => `Use sample ${name}`,
    chooseFile: 'Choose a .csv file',
    showSample: 'Show the sample file',
    execute: 'Execute',
    executeHint: 'Ctrl + Enter in a field also sends',
    notSent: 'Press Execute: the request goes to the backend running in this page.',
    example: 'Response to the example request, computed when the site was built.',
    curl: 'Curl',
    url: 'Request URL',
    response: 'Response body',
    headers: 'Response headers',
    ms: (ms: number) => `${ms < 1 ? '<1' : Math.round(ms)} ms`,
    resetData: 'Reset data',
    resetDone: 'The in-browser database is back to its seed; logged out.',
    announce: (status: number, text: string, method: string, path: string) => `${status} ${text}: ${method} ${path}`,
    authorized: (login: string) => `Authorized as ${login}`,
    loggedOut: 'Logged out',
    graph: {
      title: (login: string) => `Knowledge graph from GET /knowledge-graph as ${login}`,
      label: (interests: number, scientists: number) => `Knowledge graph: ${interests} interests and ${scientists} scientists`,
      hint: 'Pick a scientist to call POST /recommend with their interests; arrow keys move between scientists.',
      node: (name: string, interests: string) => `${name}: ${interests || 'no interests'}`,
      interest: 'interest',
      author: 'author',
      user: 'registered user',
      recommended: 'recommended',
      forScientist: (name: string, names: string) => `Recommended for ${name}: ${names}`,
      forQuery: (names: string) => `Recommended: ${names}`,
      none: (name: string) => `${name}: no recommendations`,
    },
    caption:
      "Illustrative data — 30 made-up researchers. Endpoints, validation and errors are ported from the FastAPI backend and answer inside this page; nothing leaves your browser. Recommender model by the team; the API serving it is Makar's.",
  },
  /** Демо AgentPipeline под записью Yandex (SPEC.md §7.5). Имена и роли агентов — из yandex-agents.ts. */
  agentPipeline: {
    title: 'The platform, with you as the reviewer',
    badge: 'Simulation',
    proposal: 'Proposal',
    proposalBody: 'The proposal as the agents read it',
    status: 'Project status',
    statuses: {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under review',
      revision_requested: 'Revision requested',
      rejected: 'Rejected',
      accepted_for_research: 'Accepted for research',
      deep_research_running: 'Deep research running',
      deep_research_completed: 'Research ready',
      on_showcase: 'On showcase',
    },
    actions: 'Reviewer actions',
    runEvaluation: 'Run evaluation',
    approve: 'Approve',
    requestRevision: 'Request revision',
    reject: 'Reject',
    resubmit: 'Submitter revises and resubmits',
    runResearch: 'Run deep research',
    publish: 'Publish to showcase',
    skip: 'Skip to result',
    restart: 'Start over',
    advice: 'The agents only advise: approving, rejecting or sending back is the reviewer’s call.',
    stages: { review: 'Review', research: 'Deep research', export: 'Export & showcase' },
    stagesLabel: 'Pipeline stages',
    panelNote: 'Four experts run in parallel, then the moderator reads all four.',
    chainNote: 'Nine agents run one after another; each reads trimmed outputs of the earlier ones.',
    arcsNote: (agent: string) => `Arcs: what ${agent} reads — the thicker, the larger its character limit.`,
    progress: (done: number, total: number) => `${done} / ${total}`,
    confidence: (n: number) => `confidence ${n}/100`,
    feasibility: (n: number) => `feasibility ${n}/100`,
    quality: (n: number) => `quality ${n}/100`,
    completeness: (n: number) => `completeness ${n}/100`,
    summary: 'Executive summary',
    queue: 'Tracker queue',
    exportTracker: 'Export to Tracker',
    exportSourceCraft: 'Export to SourceCraft',
    exportNote: 'Available once a deep research run has completed; each MCP agent works in the target system itself.',
    showcase: 'Showcase',
    showcaseEmpty: 'Publish the project once its research is ready.',
    pick: 'Select an agent to see what it reads and what it answered.',
    timeout: (s: number) => `timeout ${s} s`,
    reads: 'Reads',
    readsProposal: 'the proposal',
    readsResult: 'the whole deep-research result',
    inFull: 'in full',
    upTo: (limit: number) => `up to ${limit.toLocaleString('en-US')} chars`,
    got: (chars: number, limit: number) => `${chars.toLocaleString('en-US')} of ${limit.toLocaleString('en-US')} chars`,
    cut: 'trimmed by compact_text',
    parsed: 'Parsed by the platform',
    answer: 'Answer',
    notRun: 'Not run yet.',
    running: 'Running…',
    states: { idle: 'not run', waiting: 'waiting', running: 'running', done: 'done' },
    started: {
      evaluation: 'Evaluation started: four experts in parallel.',
      research: 'Deep research started.',
      tracker: 'Tracker export started.',
      source_craft: 'SourceCraft export started.',
    },
    finished: (agent: string, done: number, total: number) => `${agent} done, ${done} / ${total}.`,
    evaluated: (result: string) => `Moderator: ${result}. The decision is yours.`,
    researched: (result: string) => `Deep research completed: ${result}.`,
    exported: (agent: string) => `${agent} done.`,
    statusNow: (status: string) => `Status: ${status}.`,
    caption:
      "Simulation — the proposals and agent answers are scripted. Agent roster, order, parallelism and context limits, the status transitions and the parsers that read verdicts and scores are taken from the team's code. Models: YandexGPT 5.1 Pro, DeepSeek V3.2 as an alternative profile.",
  },
  /** Терминал-пасхалка (SPEC.md §7.11). Факты команды берут из объектов выше, здесь только подписи и сообщения. */
  terminal: {
    title: 'Terminal',
    open: 'Open terminal',
    close: 'Close terminal',
    hint: 'Tab completes · ↑ ↓ history · Esc closes',
    input: 'Command',
    output: 'Terminal output',
    user: 'guest',
    host: 'makaron-228',
    cwd: '~',
    welcome: 'Type help and press Enter to see the commands.',
    commands: {
      help: { usage: 'help', about: 'list the commands' },
      whoami: { usage: 'whoami', about: 'who Makar is' },
      ls: { usage: 'ls', about: 'sections and entries of this page' },
      cat: { usage: 'cat <name>', about: 'print a section or an entry' },
      open: { usage: 'open <name>', about: 'scroll the page to it' },
      cv: { usage: 'cv', about: 'download the CV as PDF' },
      contact: { usage: 'contact', about: 'email, Telegram and GitHub' },
      theme: { usage: 'theme light|dark', about: 'switch the colour theme' },
      clear: { usage: 'clear', about: 'clear the screen' },
      exit: { usage: 'exit', about: 'close the terminal' },
    },
    notFound: (cmd: string) => `command not found: ${cmd} — type help`,
    missing: (cmd: string, usage: string) => `${cmd}: missing operand — usage: ${usage}`,
    noSuch: (cmd: string, name: string) => `${cmd}: ${name}: no such section or entry — try ls`,
    opening: (title: string) => `Opening ${title}`,
    downloading: 'Downloading',
    themeNow: (theme: string, usage: string) => `theme: ${theme} — usage: ${usage}`,
    themeSet: (theme: string) => `Theme: ${theme}`,
    themeBad: (value: string) => `theme: ${value}: use light or dark`,
    sudo: {
      password: (user: string) => `[sudo] password for ${user}:`,
      granted: 'Access granted. Next step:',
      denied: (user: string) => `${user} is not in the sudoers file. This incident will be reported.`,
    },
  },
} as const;
