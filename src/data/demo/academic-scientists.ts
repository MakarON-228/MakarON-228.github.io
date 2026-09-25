/**
 * ILLUSTRATIVE — база демо ApiExplorer (SPEC.md §7.7). Учёные, публикации, журналы и пользователи выдуманы.
 * Настоящие только форма строк (таблицы users / authors / author_interests / user_publications из `models.py`
 * бэкенда Academic Profile) и метки интересов — это названия тем из датасета команды, по которым обучен её TF-IDF.
 * Main_Interest и Cluster — из тех же десяти пар, что в датасете (Radiology — 1, Machine Learning — 3 …).
 * Keywords_List собирается из названий статей, как в датасете: слова в нижнем регистре через запятую.
 */

export interface UserRow {
  id: number;
  login: string;
  email: string;
  first_name: string;
  last_name: string;
  google_scholar_id: string | null;
  scopus_id: string | null;
  wos_id: string | null;
  rsci_id: string | null;
  orcid_id: string | null;
  interests_list: string | null;
  /** Пароль открытым текстом — только для засева; бэкенд хранит хэш. */
  password: string;
}

/** Строка таблицы authors: одна публикация одного автора (так её заполнял import_csv.py). */
export interface AuthorRow {
  id: number;
  pmid: string | null;
  title: string | null;
  authors_original: string | null;
  citation: string | null;
  journal_book: string | null;
  publication_year: string | null;
  create_date: string | null;
  pmcid: string | null;
  nihms_id: string | null;
  doi: string | null;
  author_name: string | null;
  author_id: string | null;
}

export interface AuthorInterestRow {
  id: number;
  author_id: string;
  author_name: string | null;
  interests_list: string | null;
  keywords_list: string | null;
  interests_count: number | null;
  articles_count: number | null;
  main_interest: string | null;
  cluster: number | null;
}

export interface UserPublicationRow {
  id: number;
  user_id: number;
  title: string;
  coauthors: string | null;
  citations: string | null;
  journal: string | null;
  publication_year: string | null;
  author_name: string | null;
}

// Пары Main_Interest → Cluster из датасета команды
const CLUSTERS: Record<string, number> = {
  Other: 0,
  Radiology: 1,
  'Machine Learning': 3,
  'Clinical Research': 5,
  'Global Health': 6,
  'Computational Biology': 7,
  'Data Science': 8,
};
const MAIN_ORDER = ['Radiology', 'Machine Learning', 'Computational Biology', 'Clinical Research', 'Data Science', 'Global Health'];

type Paper = readonly [title: string, journal: string, year: string, coauthors?: string];
type Researcher = readonly [name: string, id: string, interests: string, papers: readonly Paper[]];

const RESEARCHERS: readonly Researcher[] = [
  ['Varga LT.', 'ff03d4271348', 'Radiology,Machine Learning', [
    ['Deep learning triage of chest radiographs in emergency care', 'Imaging Methods Review', '2023', 'Varga LT, Zhou Y'],
    ['Uncertainty estimates for lung nodule detection models', 'Imaging Methods Review', '2024'],
  ]],
  ['Okafor CN.', 'da359a4dcc9d', 'Global Health,Public Health,Epidemiology', [
    ['Measles vaccination coverage after community health worker visits', 'Global Health Field Notes', '2022'],
  ]],
  ['Lindqvist AE.', '8fdf7dab3e8d', 'Computational Biology,Genomics,Bioinformatics', [
    ['Alignment-free clustering of bacterial genomes', 'Genome Methods Reports', '2023'],
    ['Pangenome graphs for antibiotic resistance genes', 'Genome Methods Reports', '2024', 'Lindqvist AE, Ortega JC'],
  ]],
  ['Moreau LA.', 'aadc2baaccdb', 'Machine Learning,Data Science', [
    ['Gradient boosting for hospital readmission forecasting', 'Computational Health Letters', '2021'],
    ['Calibration of clinical risk scores across hospitals', 'Computational Health Letters', '2023'],
    ['Feature drift in electronic health records', 'Clinical Data Review', '2024', 'Moreau LA, Richter FW'],
  ]],
  ['Takeda R.', '30b3e65b03ec', 'Neurology,Radiology', [
    ['Diffusion imaging markers of early Parkinson disease', 'Neurology Methods Review', '2022'],
  ]],
  ['Haddad YF.', '97cc6d0f643d', 'Drug Discovery,Pharmacology', [
    ['Fragment screening against a viral protease', 'Molecular Therapeutics Letters', '2023'],
    ['Kinase inhibitor selectivity profiles from public assays', 'Molecular Therapeutics Letters', '2024'],
  ]],
  ['Ferreira IC.', 'b605731d10c2', 'Cancer Research,Immunology', [
    ['Tumour infiltrating lymphocytes in triple negative breast cancer', 'Oncology Practice Notes', '2022'],
    ['Checkpoint inhibitor response and the gut microbiome', 'Immune Response Reports', '2024'],
  ]],
  ['Kowalczyk B.', 'd5895002d82f', 'Pediatrics,Clinical Research', [
    ['Oral dexamethasone for croup in primary care', 'Paediatric Practice Notes', '2021'],
  ]],
  ['Brennan SO.', 'cc5c0387cd8b', 'Public Health,Data Science', [
    ['Air quality alerts and asthma admissions', 'Public Health Data Review', '2023'],
    ['Open dashboards for regional mortality data', 'Public Health Data Review', '2024'],
  ]],
  ['Iyer AK.', '05b352afa2cb', 'Machine Learning,Computational Biology', [
    ['Protein language models for enzyme function prediction', 'Computational Health Letters', '2024'],
    ['Graph neural networks on metabolic pathways', 'Genome Methods Reports', '2023'],
  ]],
  ['Castellano GM.', '0874fc5aa1e4', 'Clinical Research,Drug Discovery', [
    ['Adaptive trial designs for rare metabolic disorders', 'Clinical Trials Practice', '2022'],
  ]],
  ['Petrova DV.', 'c41cc3fdd176', 'Radiology,Cancer Research', [
    ['Radiomic signatures of glioma progression', 'Imaging Methods Review', '2023'],
    ['Low dose CT screening adherence among smokers', 'Oncology Practice Notes', '2021'],
  ]],
  ['Nakamura H.', '84426fdf4ae5', 'Genomics,Epidemiology', [
    ['Polygenic risk and type 2 diabetes in East Asian cohorts', 'Epidemiology Data Reports', '2022'],
  ]],
  ['Mensah KO.', '1875835737d4', 'Global Health,Immunology', [
    ['Malaria antibody responses in schoolchildren', 'Global Health Field Notes', '2023'],
    ['Seasonal patterns of malaria transmission', 'Global Health Field Notes', '2021'],
  ]],
  ['Richter FW.', '354001b546c1', 'Data Science,Epidemiology', [
    ['Nowcasting influenza with delayed surveillance reports', 'Epidemiology Data Reports', '2024'],
  ]],
  ['Duarte MP.', '3c89bcda0a44', 'Bioinformatics,Immunology', [
    ['T cell receptor repertoire analysis pipelines', 'Immune Response Reports', '2022'],
    ['Benchmarking single cell clustering methods', 'Genome Methods Reports', '2023'],
  ]],
  ['Holm EK.', '7f697378650f', 'Neurology,Machine Learning', [
    ['Seizure detection from wearable sensor data', 'Neurology Methods Review', '2023'],
    ['Sleep staging with convolutional networks', 'Computational Health Letters', '2024'],
  ]],
  ['Qureshi NA.', '38560a8f0743', 'Pharmacology,Pediatrics', [
    ['Paediatric dosing of antiepileptic drugs', 'Paediatric Practice Notes', '2022'],
  ]],
  ['Laurent CB.', '6e0716b856d6', 'Radiology', [
    ['Contrast agent reactions in outpatient imaging', 'Imaging Methods Review', '2021'],
    ['MRI protocol shortening for knee injuries', 'Imaging Methods Review', '2023'],
  ]],
  ['Zhou Y.', 'f20eae610ef8', 'Machine Learning,Radiology,Data Science', [
    ['Federated learning for mammography screening', 'Imaging Methods Review', '2024'],
    ['Label noise in radiology report mining', 'Computational Health Letters', '2023'],
    ['Self supervised pretraining on chest CT', 'Imaging Methods Review', '2022', 'Zhou Y, Varga LT'],
  ]],
  ['Eze UC.', 'e5bd1a29ba85', 'Public Health,Pediatrics', [
    ['Childhood obesity and school meal programmes', 'Public Health Data Review', '2022'],
  ]],
  ['Novak MS.', 'e50fd9bd9f55', 'Computational Biology,Drug Discovery', [
    ['Molecular docking of natural products against tuberculosis targets', 'Molecular Therapeutics Letters', '2023'],
    ['Free energy calculations for ligand ranking', 'Molecular Therapeutics Letters', '2024'],
  ]],
  ['Rahman T.', 'a7e868ac3baa', 'Epidemiology,Global Health,Data Science', [
    ['Cholera outbreak detection from mobile phone data', 'Epidemiology Data Reports', '2023'],
  ]],
  ['Olsen JH.', '606361074aa6', 'Cancer Research,Genomics', [
    ['Somatic mutation signatures in colorectal tumours', 'Oncology Practice Notes', '2022'],
    ['Liquid biopsy monitoring of minimal residual disease', 'Oncology Practice Notes', '2024'],
  ]],
  ['Silva RM.', 'ecf1c6721fd6', 'Clinical Research,Neurology', [
    ['Stroke rehabilitation with home based telemedicine', 'Clinical Trials Practice', '2021'],
  ]],
  ['Kaur P.', '48a935f04d2c', 'Machine Learning,Drug Discovery', [
    ['Generative models for antibiotic candidate design', 'Molecular Therapeutics Letters', '2024'],
  ]],
  ['Weber AL.', '652c179ef130', 'Immunology,Clinical Research', [
    ['Vaccine responses in kidney transplant recipients', 'Clinical Trials Practice', '2023'],
  ]],
  ['Ortega JC.', '8a956f87155f', 'Bioinformatics,Computational Biology', [
    ['Workflow managers for reproducible genomics', 'Genome Methods Reports', '2022'],
    ['Variant calling accuracy on long reads', 'Genome Methods Reports', '2023'],
  ]],
  ['Hakimi S.', 'b537f80cf850', 'Radiology,Pediatrics', [
    ['Ultrasound first imaging for paediatric appendicitis', 'Paediatric Practice Notes', '2022'],
  ]],
  ['Grant EJ.', '87301786c66f', 'Public Health,Epidemiology', [
    ['Smoking cessation after tobacco tax increases', 'Public Health Data Review', '2021'],
    ['Mortality trends in rural counties', 'Epidemiology Data Reports', '2023'],
  ]],
];

/** Слова названий в нижнем регистре без коротких служебных, через запятую — как Keywords_List в датасете. */
function keywordsOf(titles: readonly string[]): string {
  const skip = new Set(['the', 'and', 'for', 'with', 'from', 'on', 'of', 'in', 'a', 'an', 'to', 'at', 'by']);
  const words = titles.flatMap((t) => t.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !skip.has(w));
  return [...new Set(words)].join(',');
}

let paperId = 0;
export const authors: readonly AuthorRow[] = RESEARCHERS.flatMap(([name, id, , papers]) =>
  papers.map(([title, journal, year, coauthors]) => {
    paperId++;
    return {
      id: paperId,
      pmid: null,
      title,
      authors_original: coauthors ?? name.replace(/\.$/, ''),
      citation: null,
      journal_book: journal,
      publication_year: year,
      create_date: `${year}/0${1 + (paperId % 9)}/1${paperId % 10}`,
      pmcid: null,
      nihms_id: null,
      // 10.5555 — префикс DOI для примеров, настоящих статей за ним нет
      doi: `10.5555/demo.${year}.${String(paperId).padStart(3, '0')}`,
      author_name: name,
      author_id: id,
    };
  }),
);

export const authorInterests: readonly AuthorInterestRow[] = RESEARCHERS.map(([name, id, interests, papers], i) => {
  const list = interests.split(',');
  const main = MAIN_ORDER.find((m) => list.includes(m)) ?? 'Other';
  return {
    id: i + 1,
    author_id: id,
    author_name: name,
    interests_list: interests,
    keywords_list: keywordsOf(papers.map((p) => p[0])),
    interests_count: list.length,
    articles_count: papers.length,
    main_interest: main,
    cluster: CLUSTERS[main]!,
  };
});

/** Демо-пользователь: логин и пароль показаны в панели, чтобы войти в два клика. */
export const DEMO_LOGIN = { login_or_email: 'demo', password: 'demo-password' } as const;

const blank = { google_scholar_id: null, scopus_id: null, wos_id: null, rsci_id: null, orcid_id: null };

export const users: readonly UserRow[] = [
  {
    id: 1,
    login: DEMO_LOGIN.login_or_email,
    email: 'demo@example.org',
    first_name: 'Demo',
    last_name: 'User',
    ...blank,
    interests_list: 'Machine Learning, Radiology, Data Science',
    password: DEMO_LOGIN.password,
  },
  {
    id: 2,
    login: 'l.moreau',
    email: 'lea.moreau@example.org',
    first_name: 'Lea',
    last_name: 'Moreau',
    ...blank,
    // Scopus ID совпадает с Author_ID автора Moreau LA. — профиль автора покажет её логин
    scopus_id: 'aadc2baaccdb',
    orcid_id: '0000-0002-5555-0001',
    interests_list: 'Machine Learning, Data Science',
    password: 'moreau-pass-2025',
  },
  {
    id: 3,
    login: 'r.silva',
    email: 'rita.silva@example.org',
    first_name: 'Rita',
    last_name: 'Silva',
    ...blank,
    interests_list: 'Clinical Research, Neurology',
    password: 'silva-pass-2025',
  },
];

export const userPublications: readonly UserPublicationRow[] = [
  {
    id: 1,
    user_id: 1,
    title: 'Weak labels from radiology reports for chest X-ray triage',
    coauthors: 'Moreau L, Zhou Y',
    citations: '4',
    journal: 'Imaging Methods Review',
    publication_year: '2024',
    author_name: 'Demo User',
  },
  {
    id: 2,
    user_id: 1,
    title: 'A reproducible benchmark for readmission models',
    coauthors: 'Moreau L',
    citations: '1',
    journal: 'Computational Health Letters',
    publication_year: '2025',
    author_name: 'Demo User',
  },
];

/** Пример файла для upload — колонки, которые читает обработчик (title, coauthors, citations, journal, year, author_name). */
export const SAMPLE_CSV = {
  name: 'publications.csv',
  text:
    'title,coauthors,citations,journal,year,author_name\n' +
    'Transformer summaries of radiology reports,"Zhou Y, Varga LT",3,Imaging Methods Review,2025,Demo User\n' +
    'Active learning for rare findings on chest X-rays,Moreau L,0,Computational Health Letters,2024,Demo User\n',
};
