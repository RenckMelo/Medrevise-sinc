// Master database of Brazilian Medical Residency Exams and Global Topics

export interface ExamStat {
  weight: number;
  description: string;
}

export interface SuggestedTopic {
  title: string;
  subject: string;
  incidence: number;
  priority: boolean;
}

export interface MedicalExam {
  id: string;
  name: string;
  region: 'Centro-Oeste' | 'Sudeste' | 'Sul' | 'Nordeste' | 'Norte' | 'Nacional';
  description: string;
  color: string;
  stats: {
    [subjectName: string]: ExamStat;
  };
  suggestedTopics: SuggestedTopic[];
}

export const MEDICAL_EXAMS_DB: MedicalExam[] = [
  // --- CENTRO-OESTE ---
  {
    id: 'combo-centro-oeste',
    name: '🌵 COMBO CENTRO-OESTE COMPLETO (SUS-GO, SES-GO, SES-DF, UFG, HBDF, ENARE)',
    region: 'Centro-Oeste',
    description: 'Estudo integrado absoluto do Centro-Oeste brasileiro. Este combo abrange todas as recorrências do Distrito Federal e de Goiás (SES-DF, SES-GO, UFG, UnB e Hospital de Base) alinhado com o ENARE.',
    color: 'border-amber-600 bg-amber-50/20 text-amber-950 font-black',
    stats: {
      'Saúde Coletiva': { weight: 0.23, description: 'Alta ênfase em vigilância epidemiológica regional, atenção básica e leis do SUS/DF/GO.' },
      'Pediatria': { weight: 0.22, description: 'Calendário de vacinação infantil, desidratação e puericultura de marcos do desenvolvimento.' },
      'Ginecologia e Obstetrícia': { weight: 0.21, description: 'Enfoque em doença hipertensiva gestacional (DHEG), corrimentos e ginecologia preventiva.' },
      'Clínica Médica': { weight: 0.17, description: 'Cardiologia clínica (HAS, ICC, IAM) e emergências por animais peçonhentos.' },
      'Cirurgia Geral': { weight: 0.17, description: 'Manejo inicial do trauma (ATLS) e abdome agudo inflamatório (apendicite).' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', subject: 'Pediatria', incidence: 24, priority: true }
    ]
  },
  {
    id: 'ses-df',
    name: 'SES-DF (Distrito Federal)',
    region: 'Centro-Oeste',
    description: 'Alta concorrência na capital federal. Foco histórico massivo em Saúde Coletiva/Medicina Preventiva, Ginecologia e Obstetrícia de alto risco e Pediatria do desenvolvimento.',
    color: 'border-amber-400 bg-amber-50/10 text-amber-900',
    stats: {
      'Ginecologia e Obstetrícia': { weight: 0.25, description: 'Doença Hipertensiva na Gestação (DHEG) e Hemorragia de Terceiro Trimestre representam 40% das questões de Obstetrícia.' },
      'Pediatria': { weight: 0.25, description: 'Crescimento, Marcos do Desenvolvimento (Puericultura) e Infecções Respiratórias são cobrados em todas as edições.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Princípios do SUS, Financiamento e Estudos Epidemiológicos (Ensaios Clínicos, Coorte) dominam a prova.' },
      'Clínica Médica': { weight: 0.15, description: 'Foco em Hipertensão Arterial, Diabetes Mellitus e Infarto Agudo do Miocárdio.' },
      'Cirurgia Geral': { weight: 0.15, description: 'Atendimento Inicial ao Politraumatizado (ATLS) e Abdome Agudo Inflamatório (Apendicite).' }
    },
    suggestedTopics: [
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Crescimento e Desenvolvimento Infantil', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Hipertensão Arterial Sistêmica (HAS)', subject: 'Clínica Médica', incidence: 22, priority: false },
      { title: 'Diabetes Mellitus: Diagnóstico e Manejo', subject: 'Clínica Médica', incidence: 25, priority: false },
      { title: 'Apendicite Aguda e Complicações', subject: 'Cirurgia Geral', incidence: 25, priority: false },
      { title: 'Aleitamento Materno e Benefícios', subject: 'Pediatria', incidence: 18, priority: false },
      { title: 'Sangramento de Terceiro Trimestre: DPP e Placenta Prévia', subject: 'Ginecologia e Obstetrícia', incidence: 21, priority: false }
    ]
  },
  {
    id: 'ses-go',
    name: 'SES-GO (Goiás)',
    region: 'Centro-Oeste',
    description: 'Prova robusta com perfil epidemiológico focado no interior do estado. Foco em Medicina de Família, Saúde Pública regional, Dengue e outras Arboviroses.',
    color: 'border-emerald-400 bg-emerald-50/10 text-emerald-900',
    stats: {
      'Saúde Coletiva': { weight: 0.25, description: 'Forte peso em atenção básica, Saúde da Família e vigilância de arboviroses endêmicas do Centro-Oeste.' },
      'Pediatria': { weight: 0.20, description: 'Calendário de vacinação infantil, reidratação oral em diarreia e desnutrição.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Corrimentos, pré-natal habitual e DSTs/ISTs.' },
      'Clínica Médica': { weight: 0.18, description: 'Hipertensão, Diabetes e Pneumonias de comunidade.' },
      'Cirurgia Geral': { weight: 0.17, description: 'Colecistite aguda, hérnias da parede abdominal e apendicite.' }
    },
    suggestedTopics: [
      { title: 'Atenção Primária à Saúde (APS) e Saúde da Família (ESF)', subject: 'Saúde Coletiva', incidence: 26, priority: true },
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true },
      { title: 'Corrimentos Vaginais e Cervicites (Vaginose, Candidíase)', subject: 'Ginecologia e Obstetrícia', incidence: 19, priority: true },
      { title: 'Calendário de Vacinação da Criança (SBP/MS)', subject: 'Pediatria', incidence: 22, priority: false },
      { title: 'Colecistite Aguda e Colelitíase', subject: 'Cirurgia Geral', incidence: 23, priority: false }
    ]
  },
  {
    id: 'unb',
    name: 'UnB (Universidade de Brasília)',
    region: 'Centro-Oeste',
    description: 'Foco acadêmico rigoroso com questões baseadas em casos clínicos complexos de nível terciário, exames complementares elaborados e medicina baseada em evidências.',
    color: 'border-cyan-400 bg-cyan-50/10 text-cyan-900',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Insuficiência renal, infarto agudo do miocárdio, sepse e distúrbios de eletrólitos.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Atendimento inicial ao trauma (ATLS) e complicações pós-operatórias.' },
      'Pediatria': { weight: 0.20, description: 'Reanimação neonatal, doenças exantemáticas e asma na infância.' },
      'Ginecologia e Obstetrícia': { weight: 0.18, description: 'DHEG, pré-natal de alto risco e climatério/menopausa.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Bioestatística detalhada, estudos epidemiológicos e medicina baseada em evidências.' }
    },
    suggestedTopics: [
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true },
      { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', subject: 'Pediatria', incidence: 24, priority: true },
      { title: 'Sepse, Choque Séptico e Disfunção de Órgãos', subject: 'Clínica Médica', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Insuficiência Renal Aguda (IRA) e Crônica (IRC)', subject: 'Clínica Médica', incidence: 16, priority: false }
    ]
  },
  {
    id: 'ufg',
    name: 'UFG (Universidade Federal de Goiás)',
    region: 'Centro-Oeste',
    description: 'Prova tradicional do estado de Goiás. Questões objetivas e diretas focadas em consensos nacionais e diretrizes das sociedades brasileiras.',
    color: 'border-indigo-400 bg-indigo-50/10 text-indigo-900',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Foco em cardiologia, diabetes e pneumologia clínica.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Urgências abdominais não traumáticas, abdome agudo.' },
      'Pediatria': { weight: 0.20, description: 'Puericultura e infecções respiratórias comuns.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Anticoncepção, rastreamento de câncer ginecológico.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Princípios do SUS e indicadores de saúde.' }
    },
    suggestedTopics: [
      { title: 'Apendicite Aguda e Complicações', subject: 'Cirurgia Geral', incidence: 25, priority: true },
      { title: 'Rastreamento de Câncer de Colo Uterino e Lesões Precursoras', subject: 'Ginecologia e Obstetrícia', incidence: 24, priority: true },
      { title: 'Infecções Respiratórias Agudas na Infância (Pneumonia, OMA)', subject: 'Pediatria', incidence: 23, priority: true },
      { title: 'Hipertensão Arterial Sistêmica (HAS)', subject: 'Clínica Médica', incidence: 22, priority: false }
    ]
  },
  {
    id: 'ufms',
    name: 'UFMS (Universidade Federal de Mato Grosso do Sul)',
    region: 'Centro-Oeste',
    description: 'Aborda de forma incisiva a infectologia e doenças endêmicas do pantanal e Centro-Oeste, além de atenção básica de saúde integrada.',
    color: 'border-yellow-400 bg-yellow-50/10 text-yellow-900',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Doenças tropicais, tuberculose, hanseníase e infectologia geral.' },
      'Saúde Coletiva': { weight: 0.23, description: 'Vigilância de vetores, zoonoses e epidemiologia das infecções.' },
      'Pediatria': { weight: 0.18, description: 'Diarreia aguda, parasitoses e crescimento.' },
      'Ginecologia e Obstetrícia': { weight: 0.17, description: 'Obstetrícia básica, pré-natal e ISTs.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Trauma abdominal, ATLS e hérnias.' }
    },
    suggestedTopics: [
      { title: 'Tuberculose Pulmonar e Hanseníase', subject: 'Clínica Médica', incidence: 19, priority: true },
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true }
    ]
  },
  {
    id: 'ufmt',
    name: 'UFMT (Universidade Federal de Mato Grosso)',
    region: 'Centro-Oeste',
    description: 'Forte enfoque em traumas regionais, acidentes ofídicos, urgências cirúrgicas e o Programa Nacional de Imunização.',
    color: 'border-orange-400 bg-orange-50/10 text-orange-900',
    stats: {
      'Cirurgia Geral': { weight: 0.25, description: 'Manejo inicial do trauma (ATLS), queimaduras e ferimentos por arma branca/fogo.' },
      'Clínica Médica': { weight: 0.20, description: 'Acidentes por animais peçonhentos (ofidismo), sepse e pneumonia.' },
      'Pediatria': { weight: 0.18, description: 'Calendário de vacinação nacional e infecções respiratórias.' },
      'Ginecologia e Obstetrícia': { weight: 0.17, description: 'Parto vaginal, sangramento de primeiro trimestre.' },
      'Saúde Coletiva': { weight: 0.20, description: 'SUS, bioestatística básica e saúde ambiental.' }
    },
    suggestedTopics: [
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Trauma Abdominal Aberto e Fechado', subject: 'Cirurgia Geral', incidence: 22, priority: true },
      { title: 'Calendário de Vacinação da Criança (SBP/MS)', subject: 'Pediatria', incidence: 22, priority: true }
    ]
  },

  // --- NACIONAL ---
  {
    id: 'combo-nacional',
    name: '🇧🇷 COMBO NACIONAL UNIFICADO (ENARE, AMRIGS, REVALIDA)',
    region: 'Nacional',
    description: 'A unificação completa das maiores provas nacionais do Brasil. Ideal para quem vai prestar o ENARE, AMRIGS ou Revalida INEP, com uma distribuição milimetricamente homogênea de 20% por área.',
    color: 'border-blue-500 bg-blue-50/20 text-blue-950 font-black',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Prepara para as diretrizes atualizadas de ICC, HAS, Diabetes e Infecções Clínicas.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Atendimento de trauma (ATLS), hérnias de parede e abdome agudo geral.' },
      'Pediatria': { weight: 0.20, description: 'Puericultura de base, aleitamento materno e calendário nacional do PNI.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Trabalho de parto, DHEG e rastreamentos de câncer ginecológico.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Estudos epidemiológicos, SUS, bioestatística e vigilância de agravos.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true }
    ]
  },
  {
    id: 'enare',
    name: 'ENARE (Exame Nacional de Residência)',
    region: 'Nacional',
    description: 'O maior exame unificado do país. Distribuição extremamente homogênea de matérias (exatamente 20% para cada uma das 5 grandes áreas da medicina), cobrando diretrizes nacionais atualizadas.',
    color: 'border-blue-400 bg-blue-50/10 text-blue-900',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Insuficiência Cardíaca, Asma/DPOC e Emergências Endocrinológicas.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Atendimento Inicial ao Politraumatizado (ATLS), Obstrução Intestinal e Queimaduras.' },
      'Pediatria': { weight: 0.20, description: 'Calendário de Vacinas (SBP), Neonatologia (Reanimação de RN na sala de parto) e Alergias.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Rastreamento de Câncer de Colo e Mama, Pré-natal e Assistência ao Trabalho de Parto.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Vigilância Epidemiológica, Doenças de Notificação Compulsória e Indicadores de Saúde.' }
    },
    suggestedTopics: [
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', subject: 'Pediatria', incidence: 24, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: false },
      { title: 'Insuficiência Cardíaca Congestiva (ICC)', subject: 'Clínica Médica', incidence: 20, priority: false }
    ]
  },
  {
    id: 'amrigs',
    name: 'AMRIGS (Associação Médica do Rio Grande do Sul - Nacional)',
    region: 'Nacional',
    description: 'Prova amplamente utilizada em várias regiões do Brasil. Enunciados objetivos, muito focados em diagnósticos práticos, epidemiologia nacional e medicina familiar.',
    color: 'border-purple-400 bg-purple-50/10 text-purple-900',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Pneumonias, hipertensão, diabetes, geriatria.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Apendicite, hérnias, cicatrização e anestesia local.' },
      'Pediatria': { weight: 0.20, description: 'Puericultura, aleitamento e vacinação.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Corrimentos, pré-natal e anticoncepção.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Saúde da família, bioestatística, atenção primária.' }
    },
    suggestedTopics: [
      { title: 'Atenção Primária à Saúde (APS) e Saúde da Família (ESF)', subject: 'Saúde Coletiva', incidence: 26, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Corrimentos Vaginais e Cervicites (Vaginose, Candidíase)', subject: 'Ginecologia e Obstetrícia', incidence: 19, priority: true }
    ]
  },

  // --- SUDESTE ---
  {
    id: 'combo-paulistas',
    name: '🏙️ COMBO PAULISTA COMPLETO (USP-SP, UNICAMP, SUS-SP, ENARE-SP)',
    region: 'Sudeste',
    description: 'Estudo focado na elite acadêmica e nos maiores concursos de São Paulo. Enfoque massivo em subespecialidades, interpretação profunda de imagens/casos clínicos e medicina terciária.',
    color: 'border-red-600 bg-red-50/20 text-red-955 font-black',
    stats: {
      'Clínica Médica': { weight: 0.24, description: 'Foco profundo em emergências oncológicas, IAM complexo, nefrologia e sepse.' },
      'Cirurgia Geral': { weight: 0.22, description: 'Hérnias, trauma grave, cuidados perioperatórios e obstruções complexas.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Epidemiologia avançada, bioestatística aplicada, e ética profissional médica.' },
      'Ginecologia e Obstetrícia': { weight: 0.17, description: 'Ginecologia oncológica, mastologia preventiva, DHEG e distocias.' },
      'Pediatria': { weight: 0.17, description: 'Emergências em pediatria, neonatologia terciária, asma aguda e reanimação.' }
    },
    suggestedTopics: [
      { title: 'Sepse, Choque Séptico e Disfunção de Órgãos', subject: 'Clínica Médica', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Bioestatística: Sensibilidade, Especificidade e VPP/VPN', subject: 'Saúde Coletiva', incidence: 21, priority: true },
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Infarto Agudo do Miocárdio (IAM)', subject: 'Clínica Médica', incidence: 24, priority: true }
    ]
  },
  {
    id: 'combo-sudeste',
    name: '☕ COMBO SUDESTE INTEGRADO (PSU-MG, UFRJ, ENARE-SUDESTE)',
    region: 'Sudeste',
    description: 'Fusão das grandes bancas de Minas Gerais e do Rio de Janeiro. Equilíbrio estratégico focado em raciocínio propedêutico clássico e atenção secundária e hospitalar.',
    color: 'border-teal-600 bg-teal-50/20 text-teal-950 font-black',
    stats: {
      'Clínica Médica': { weight: 0.21, description: 'Nefrologia, cardiologia acadêmica clássica, diabetes e pneumonias.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Urgências traumáticas, cirurgia reconstrutiva básica e parede abdominal.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Políticas de saúde, vigilância epidemiológica e indicadores de mortalidade.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Pré-natal de alto risco, parto vaginal normal e DST/ISTs.' },
      'Pediatria': { weight: 0.19, description: 'Reanimação neonatal, aleitamento materno e doenças exantemáticas.' }
    },
    suggestedTopics: [
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true },
      { title: 'Calendário de Vacinação da Criança (SBP/MS)', subject: 'Pediatria', incidence: 22, priority: true },
      { title: 'Rastreamento de Câncer de Colo Uterino e Lesões Precursoras', subject: 'Ginecologia e Obstetrícia', incidence: 24, priority: true }
    ]
  },
  {
    id: 'usp-sp',
    name: 'USP-SP (Universidade de São Paulo)',
    region: 'Sudeste',
    description: 'Uma das provas mais concorridas e complexas da América Latina. Questões de alto nível conceitual, cobrando subespecialidades, interpretação de imagens e patologia.',
    color: 'border-red-400 bg-red-50/10 text-red-900',
    stats: {
      'Clínica Médica': { weight: 0.25, description: 'Infarto agudo do miocárdio, emergências oncológicas e nefrologia.' },
      'Cirurgia Geral': { weight: 0.25, description: 'Oncocirurgia, cirurgia torácica de emergência e trauma complexo.' },
      'Pediatria': { weight: 0.15, description: 'Neonatologia complexa e emergências pediátricas.' },
      'Ginecologia e Obstetrícia': { weight: 0.15, description: 'Ginecologia oncológica, mastologia e obstetrícia de alto risco.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Epidemiologia avançada, taxas, riscos e bioestatística de ensaios.' }
    },
    suggestedTopics: [
      { title: 'Sepse, Choque Séptico e Disfunção de Órgãos', subject: 'Clínica Médica', incidence: 26, priority: true },
      { title: 'Infarto Agudo do Miocárdio (IAM)', subject: 'Clínica Médica', incidence: 24, priority: true },
      { title: 'Rastreamento e Diagnóstico de Câncer de Mama', subject: 'Ginecologia e Obstetrícia', incidence: 23, priority: true },
      { title: 'Bioestatística: Sensibilidade, Especificidade e VPP/VPN', subject: 'Saúde Coletiva', incidence: 21, priority: true }
    ]
  },
  {
    id: 'unicamp',
    name: 'UNICAMP (Universidade Estadual de Campinas)',
    region: 'Sudeste',
    description: 'Excelente elaboração das questões, focada no raciocínio clínico pragmático, atitudes éticas médicas e semiologia primorosa.',
    color: 'border-teal-400 bg-teal-50/10 text-teal-900',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Manejo de asma, DPOC, diabetes crônico.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Colecistite, colangite, abdome agudo geral.' },
      'Pediatria': { weight: 0.20, description: 'Asma na infância, desidratação e aleitamento.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Trabalho de parto e parto normal.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Saúde coletiva, declaração de óbito, ética médica.' }
    },
    suggestedTopics: [
      { title: 'Sibilância no Lactente e Asma Pediátrica', subject: 'Pediatria', incidence: 17, priority: true },
      { title: 'Assistência ao Parto Vaginal e Distocias', subject: 'Ginecologia e Obstetrícia', incidence: 20, priority: true },
      { title: 'Colecistite Aguda e Colelitíase', subject: 'Cirurgia Geral', incidence: 23, priority: true }
    ]
  },
  {
    id: 'sus-sp',
    name: 'SUS-SP (Sistema Único de Saúde de São Paulo)',
    region: 'Sudeste',
    description: 'O maior concurso unificado do estado de SP. Questões objetivas cobrando do clínico o feijão com arroz bem feito e seguindo à risca as diretrizes nacionais do Ministério da Saúde.',
    color: 'border-blue-500 bg-blue-50/10 text-blue-900',
    stats: {
      'Saúde Coletiva': { weight: 0.20, description: 'Princípios do SUS, Portaria de Consolidação, doenças compulsórias.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Anticoncepção, ginecologia geral.' },
      'Pediatria': { weight: 0.20, description: 'Puericultura e vacinas.' },
      'Clínica Médica': { weight: 0.20, description: 'Manejo de HAS, Diabetes, Dislipidemias.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Apendicite e hérnias da parede abdominal.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Anticoncepção Hormonal e Métodos de Barreira', subject: 'Ginecologia e Obstetrícia', incidence: 18, priority: true },
      { title: 'Hipertensão Arterial Sistêmica (HAS)', subject: 'Clínica Médica', incidence: 22, priority: true }
    ]
  },
  {
    id: 'psu-mg',
    name: 'PSU-MG (Processo Seletivo Unificado de Minas Gerais)',
    region: 'Sudeste',
    description: 'Unifica praticamente todo o estado de Minas Gerais. Questões diretas, com enunciados objetivos, muito focados em exames preventivos e terapêutica clínica.',
    color: 'border-amber-600 bg-amber-50/10 text-amber-950',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Insuficiência cardíaca, asma crônica, diabetes.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Trauma torácico, abdome agudo, cicatrização.' },
      'Pediatria': { weight: 0.20, description: 'Calendário vacinal, diarreia e desidratação.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Rastreamento ginecológico, corrimentos.' },
      'Saúde Coletiva': { weight: 0.20, description: 'SUS, bioestatística básica.' }
    },
    suggestedTopics: [
      { title: 'Rastreamento de Câncer de Colo Uterino e Lesões Precursoras', subject: 'Ginecologia e Obstetrícia', incidence: 24, priority: true },
      { title: 'Calendário de Vacinação da Criança (SBP/MS)', subject: 'Pediatria', incidence: 22, priority: true }
    ]
  },
  {
    id: 'ufrj',
    name: 'UFRJ (Universidade Federal do Rio de Janeiro)',
    region: 'Sudeste',
    description: 'Forte peso em raciocínio propedêutico, clínica médica com casos clínicos tradicionais acadêmicos e cirurgia geral de emergência.',
    color: 'border-stone-400 bg-stone-50/10 text-stone-900',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Nefrologia, cardiologia acadêmica, endocrinologia.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Procedimentos cirúrgicos de urgência, ATLS.' },
      'Pediatria': { weight: 0.18, description: 'Puericultura de recém-nascidos e reanimação.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'DHEG, parto normal, sangramentos.' },
      'Saúde Coletiva': { weight: 0.20, description: 'SUS, epidemiologia descritiva.' }
    },
    suggestedTopics: [
      { title: 'DHEG - Doença Hipertensiva Específica da Gestação', subject: 'Ginecologia e Obstetrícia', incidence: 26, priority: true },
      { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', subject: 'Cirurgia Geral', incidence: 28, priority: true }
    ]
  },

  // --- SUL ---
  {
    id: 'combo-sul',
    name: '🌲 COMBO SULISTA COMPLETO (UFPR, AMRIGS, HC-UFPR, ENARE-SUL)',
    region: 'Sul',
    description: 'Estudo estratégico unificado para as principais provas do Rio Grande do Sul, Paraná e Santa Catarina. Maior peso em clínica médica, medicina familiar e imunizações.',
    color: 'border-yellow-600 bg-yellow-50/20 text-yellow-950 font-black',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Foco especial em hipertensão, diabetes, infarto e DPOC.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Hérnias, apendicite aguda e cuidados pós-operatórios de enfermaria.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Atenção primária, medicina de família, bioestatística e estudos de coorte.' },
      'Pediatria': { weight: 0.19, description: 'Puericultura de base, infecções respiratórias de inverno e vacinação.' },
      'Ginecologia e Obstetrícia': { weight: 0.19, description: 'Climatério/menopausa, anticoncepção e pré-natal habitual.' }
    },
    suggestedTopics: [
      { title: 'Atenção Primária à Saúde (APS) e Saúde da Família (ESF)', subject: 'Saúde Coletiva', incidence: 26, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true },
      { title: 'Infecções Respiratórias Agudas na Infância (Pneumonia, OMA)', subject: 'Pediatria', incidence: 23, priority: true }
    ]
  },
  {
    id: 'ufpr',
    name: 'UFPR (Universidade Federal do Paraná)',
    region: 'Sul',
    description: 'Prova clássica do Sul do país. Questões ricas em detalhes teóricos, imunizações e farmacologia clínica.',
    color: 'border-yellow-600 bg-yellow-50/10 text-yellow-950',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Hipertensão, diabetes, infarto e DPOC.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Abdome agudo perfurativo e inflamatório.' },
      'Pediatria': { weight: 0.20, description: 'Doenças respiratórias infantis, crescimento.' },
      'Ginecologia e Obstetrícia': { weight: 0.18, description: 'Climatério, anticoncepção e pré-natal.' },
      'Saúde Coletiva': { weight: 0.20, description: 'Estudos epidemiológicos e bioestatística.' }
    },
    suggestedTopics: [
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true },
      { title: 'Infecções Respiratórias Agudas na Infância (Pneumonia, OMA)', subject: 'Pediatria', incidence: 23, priority: true }
    ]
  },

  // --- NORDESTE ---
  {
    id: 'combo-nordeste',
    name: '☀️ COMBO NORDESTE COMPLETO (SURCE, SUS-BA, SES-PE, ENARE-NE)',
    region: 'Nordeste',
    description: 'Focado nos maiores centros do Ceará, Bahia, Pernambuco e Alagoas. Enfoque balanceado entre atenção primária, infectologia, emergências pediátricas e ginecologia preventiva.',
    color: 'border-orange-500 bg-orange-50/20 text-orange-950 font-black',
    stats: {
      'Saúde Coletiva': { weight: 0.22, description: 'Políticas do SUS, medicina preventiva, vigilância de dengue/zika/chikungunya.' },
      'Pediatria': { weight: 0.21, description: 'Terapia de reidratação oral (TRO), desnutrição e imunização.' },
      'Clínica Médica': { weight: 0.19, description: 'Tuberculose, diabetes, hipertensão e pneumonias comunitárias.' },
      'Cirurgia Geral': { weight: 0.19, description: 'Manejo inicial do trauma (ATLS) e urgências de abdome agudo.' },
      'Ginecologia e Obstetrícia': { weight: 0.19, description: 'Corrimentos, ginecologia preventiva e assistência pré-natal.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true },
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', subject: 'Pediatria', incidence: 24, priority: true }
    ]
  },
  {
    id: 'surce',
    name: 'SURCE (Processo Seletivo Unificado do Ceará)',
    region: 'Nordeste',
    description: 'Processo altamente concorrido no Ceará. Questões bem desenhadas, exigindo do candidato o domínio dos protocolos de condutas médicas imediatas.',
    color: 'border-orange-500 bg-orange-50/10 text-orange-950',
    stats: {
      'Clínica Médica': { weight: 0.20, description: 'Sepse, infarto do miocárdio, pneumonia.' },
      'Cirurgia Geral': { weight: 0.20, description: 'ATLS, abdome agudo obstrutivo.' },
      'Pediatria': { weight: 0.20, description: 'TRO, vacinas e reanimação neonatal.' },
      'Ginecologia e Obstetrícia': { weight: 0.20, description: 'Pré-natal, DHEG, sangramentos de gestação.' },
      'Saúde Coletiva': { weight: 0.20, description: 'SUS, indicadores epidemiológicos.' }
    },
    suggestedTopics: [
      { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', subject: 'Pediatria', incidence: 24, priority: true },
      { title: 'Sangramento de Terceiro Trimestre: DPP e Placenta Prévia', subject: 'Ginecologia e Obstetrícia', incidence: 21, priority: true }
    ]
  },
  {
    id: 'sus-ba',
    name: 'SUS-BA (Processo Unificado da Bahia)',
    region: 'Nordeste',
    description: 'Prova com grande representatividade regional na Bahia. Forte peso em saúde pública, arboviroses do Nordeste e atenção básica.',
    color: 'border-red-500 bg-red-50/10 text-red-950',
    stats: {
      'Saúde Coletiva': { weight: 0.25, description: 'Políticas de saúde, vigilância de dengue e zika, atenção primária.' },
      'Clínica Médica': { weight: 0.18, description: 'Infectologia, pneumonia, HAS.' },
      'Pediatria': { weight: 0.19, description: 'Diarreia aguda, desidratação, imunizações.' },
      'Ginecologia e Obstetrícia': { weight: 0.18, description: 'Corrimentos, ginecologia preventiva.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Trauma, apendicite.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true }
    ]
  },
  {
    id: 'ses-pe',
    name: 'SES-PE (Pernambuco)',
    region: 'Nordeste',
    description: 'Tradicional processo de Pernambuco, com destaque para a pediatria de patologias regionais e saúde coletiva.',
    color: 'border-emerald-600 bg-emerald-50/10 text-emerald-950',
    stats: {
      'Pediatria': { weight: 0.23, description: 'Imunização, diarreia aguda, puericultura.' },
      'Saúde Coletiva': { weight: 0.22, description: 'SUS, bioestatística, estudos observacionais.' },
      'Clínica Médica': { weight: 0.18, description: 'Diabetes, hipertensão, tuberculose.' },
      'Ginecologia e Obstetrícia': { weight: 0.17, description: 'Pré-natal de risco, ginecologia preventiva.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Hérnias, ATLS e urgências abdominais.' }
    },
    suggestedTopics: [
      { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', subject: 'Pediatria', incidence: 25, priority: true },
      { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', subject: 'Saúde Coletiva', incidence: 28, priority: true }
    ]
  },

  // --- NORTE ---
  {
    id: 'combo-norte',
    name: '🌴 COMBO NORTE COMPLETO (SES-AM, UFAM, SES-PA, ENARE-NORTE)',
    region: 'Norte',
    description: 'Prepara o médico para os principais certames da região Norte. Forte enfoque em infectologia, medicina tropical (malária, chagas), populações ribeirinhas e trauma cirúrgico.',
    color: 'border-green-600 bg-green-50/20 text-green-955 font-black',
    stats: {
      'Clínica Médica': { weight: 0.24, description: 'Destaque massivo para infectologia, parasitoses intestinais e hepatites virais.' },
      'Saúde Coletiva': { weight: 0.21, description: 'Vigilância em saúde de campo, agravos de notificação compulsória e SUS.' },
      'Cirurgia Geral': { weight: 0.19, description: 'Colecistite, apendicite aguda e transporte/atendimento ao politraumatizado.' },
      'Pediatria': { weight: 0.18, description: 'Desnutrição infantil grave, diarreia, reidratação oral e vacinas.' },
      'Ginecologia e Obstetrícia': { weight: 0.18, description: 'Anticoncepção, ginecologia preventiva de ISTs e assistência ao parto.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true },
      { title: 'Colecistite Aguda e Colelitíase', subject: 'Cirurgia Geral', incidence: 23, priority: true }
    ]
  },
  {
    id: 'ses-am',
    name: 'SES-AM / UFAM (Amazonas)',
    region: 'Norte',
    description: 'Aborda fortemente as particularidades da saúde na região amazônica, doenças de veiculação hídrica, malária e zoonoses regionais.',
    color: 'border-green-400 bg-green-50/10 text-green-900',
    stats: {
      'Clínica Médica': { weight: 0.25, description: 'Doenças parasitárias tropicais (Malária, Leishmaniose), hepatites virais.' },
      'Saúde Coletiva': { weight: 0.22, description: 'Vigilância sanitária, doenças negligenciadas de notificação imediata.' },
      'Pediatria': { weight: 0.18, description: 'Desnutrição grave, diarreia e vacinação.' },
      'Ginecologia e Obstetrícia': { weight: 0.15, description: 'Obstetrícia geral, pré-natal ribeirinho.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Trauma cirúrgico, transporte de politraumatizado.' }
    },
    suggestedTopics: [
      { title: 'Vigilância Epidemiológica e Notificação Compulsória', subject: 'Saúde Coletiva', incidence: 24, priority: true },
      { title: 'Diarreia Aguda, Desidratação e TRO', subject: 'Pediatria', incidence: 21, priority: true }
    ]
  },
  {
    id: 'ses-pa',
    name: 'SES-PA (Pará)',
    region: 'Norte',
    description: 'Prova robusta focada na epidemiologia do estado do Pará, endemias, acidentes ofídicos e atenção básica.',
    color: 'border-yellow-500 bg-yellow-50/10 text-yellow-900',
    stats: {
      'Clínica Médica': { weight: 0.22, description: 'Doenças infectocontagiosas, malária, leptospirose, chagas.' },
      'Saúde Coletiva': { weight: 0.23, description: 'Epidemiologia de campo, princípios do SUS e ESF.' },
      'Pediatria': { weight: 0.18, description: 'Puericultura básica, desnutrição e TRO.' },
      'Ginecologia e Obstetrícia': { weight: 0.17, description: 'Anticoncepção, ISTs.' },
      'Cirurgia Geral': { weight: 0.20, description: 'Colecistite, trauma e apendicite.' }
    },
    suggestedTopics: [
      { title: 'Princípios do SUS, Diretrizes e Financiamento', subject: 'Saúde Coletiva', incidence: 30, priority: true },
      { title: 'Colecistite Aguda e Colelitíase', subject: 'Cirurgia Geral', incidence: 23, priority: true }
    ]
  }
];

export const GLOBAL_RESIDENCY_TOPICS = {
  'Clínica Médica': [
    { title: 'Hipertensão Arterial Sistêmica (HAS)', incidence: 22 },
    { title: 'Diabetes Mellitus: Diagnóstico e Manejo', incidence: 25 },
    { title: 'Insuficiência Cardíaca Congestiva (ICC)', incidence: 20 },
    { title: 'Crise de Asma e DPOC na Emergência', incidence: 18 },
    { title: 'Infarto Agudo do Miocárdio (IAM)', incidence: 24 },
    { title: 'Acidente Vascular Cerebral (AVC) Isquêmico e Hemorrágico', incidence: 21 },
    { title: 'Insuficiência Renal Aguda (IRA) e Crônica (IRC)', incidence: 16 },
    { title: 'Pneumonia Adquirida na Comunidade (PAC)', incidence: 23 },
    { title: 'Sepse, Choque Séptico e Disfunção de Órgãos', incidence: 26 },
    { title: 'Infecção do Trato Urinário (ITU) e Pielonefrite', incidence: 17 },
    { title: 'Anemia Ferropriva, Megaloblástica e de Doença Crônica', incidence: 15 },
    { title: 'Tuberculose Pulmonar e Hanseníase', incidence: 19 },
    { title: 'Manejo Clínico de Hepatopatias e Cirrose', incidence: 14 },
    { title: 'Manejo da Cetoacidose Diabética e Estado Hiperosmolar', incidence: 18 }
  ],
  'Cirurgia Geral': [
    { title: 'Atendimento Inicial ao Politraumatizado (ATLS)', incidence: 28 },
    { title: 'Trauma Abdominal Aberto e Fechado', incidence: 22 },
    { title: 'Apendicite Aguda e Complicações', incidence: 25 },
    { title: 'Colecistite Aguda e Colelitíase', incidence: 23 },
    { title: 'Hérnias Inguinais, Femorais e Incisionais', incidence: 18 },
    { title: 'Queimaduras: Atendimento Inicial e Regra dos Nove', incidence: 19 },
    { title: 'Pré e Pós-Operatório: Risco Cirúrgico e Complicações', incidence: 17 },
    { title: 'Obstrução Intestinal e Volvo de Sigmoide', incidence: 20 },
    { title: 'Anestesia Local, Bloqueios e Geral', incidence: 15 },
    { title: 'Abdomen Agudo Hemorrágico e Vascular', incidence: 16 }
  ],
  'Ginecologia e Obstetrícia': [
    { title: 'Doença Hipertensiva Específica da Gestação (DHEG)', incidence: 26 },
    { title: 'Sangramento de Terceiro Trimestre: DPP e Placenta Prévia', incidence: 21 },
    { title: 'Pré-Natal de Baixo Risco e Calendário de Exames', incidence: 22 },
    { title: 'Assistência ao Parto Vaginal e Distocias', incidence: 20 },
    { title: 'Rastreamento de Câncer de Colo Uterino e Lesões Precursoras', incidence: 24 },
    { title: 'Rastreamento e Diagnóstico de Câncer de Mama', incidence: 23 },
    { title: 'Corrimentos Vaginais e Cervicites (Vaginose, Candidíase)', incidence: 19 },
    { title: 'Anticoncepção Hormonal e Métodos de Barreira', incidence: 18 },
    { title: 'Climatério, Menopausa e Terapia de Reposição Hormonal', incidence: 17 },
    { title: 'Sangramentos de Primeira Metade: Abortamento e Ectópica', incidence: 20 }
  ],
  'Pediatria': [
    { title: 'Crescimento, Marcos do Desenvolvimento e Puericultura', incidence: 25 },
    { title: 'Aleitamento Materno e Benefícios', incidence: 18 },
    { title: 'Calendário de Vacinação da Criança (SBP/MS)', incidence: 22 },
    { title: 'Diarreia Aguda, Desidratação e TRO', incidence: 21 },
    { title: 'Infecções Respiratórias Agudas na Infância (Pneumonia, OMA)', incidence: 23 },
    { title: 'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)', incidence: 24 },
    { title: 'Doenças Exantemáticas: Sarampo, Varicela, Escarlatina', incidence: 19 },
    { title: 'Convulsão Febril na Infância e Conduta', incidence: 15 },
    { title: 'Sibilância no Lactente e Asma Pediátrica', incidence: 17 },
    { title: 'Meningite Bacteriana e Viral na Infância', incidence: 16 }
  ],
  'Saúde Coletiva': [
    { title: 'Princípios do SUS, Diretrizes e Financiamento', incidence: 30 },
    { title: 'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios', incidence: 28 },
    { title: 'Vigilância Epidemiológica e Notificação Compulsória', incidence: 24 },
    { title: 'Indicadores de Saúde: Mortalidade Infantil e Geral', incidence: 22 },
    { title: 'Atenção Primária à Saúde (APS) e Saúde da Família (ESF)', incidence: 26 },
    { title: 'Saúde do Trabalhador: CAT e Doenças Profissionais', incidence: 16 },
    { title: 'Bioestatística: Sensibilidade, Especificidade e VPP/VPN', incidence: 21 },
    { title: 'Declaração de Óbito: Preenchimento e Responsabilidades', incidence: 18 },
    { title: 'Pacto pela Saúde e Financiamento do SUS', incidence: 15 }
  ]
};

export const CANONICAL_SUBTOPICS_MAP: Record<string, string[]> = {
  'Hipertensão Arterial Sistêmica (HAS)': ['Diagnóstico & MAPA/MRPA', 'Metas Pressóricas Diretriz SBC', 'Monoterapia vs Associação', 'Crise Hipertensiva (Urgência vs Emergência)', 'HAS Secundária & Renovascular', 'Hipertensão na Gestação'],
  'Diabetes Mellitus: Diagnóstico e Manejo': ['Critérios Diagnósticos ADA/SBD', 'Metas de HbA1c por Perfil', 'Antidiabéticos Orais (iSGLT2, GLP-1, Metformina)', 'Esquemas de Insulinoterapia (Basal-Bolus)', 'Complicações Crônicas (Nefro, Retino, Neuropatia)', 'Pé Diabético & Prevenção'],
  'Insuficiência Cardíaca Congestiva (ICC)': ['Classificação NYHA & Estágios AHA', 'Diagnóstico (Critérios de Framingham & BNP)', 'Tratamento Quádruplo Redutor de Mortalidade', 'Manejo da ICC Descompensada (Perfil de Stevenson)', 'Fibrilação Atrial na ICC', 'Cardiomiopatia Chagásica & Isquêmica'],
  'Crise de Asma e DPOC na Emergência': ['Fenótipo da Asma & Espirometria', 'Manejo da Crise Aguda de Asma', 'Classificação GOLD do DPOC', 'Exacerbação Aguda do DPOC & Antibioticoterapia', 'Oxigenioterapia & VNI', 'Corticoterapia Inalatória vs Sistêmica'],
  'Infarto Agudo do Miocárdio (IAM)': ['IAM com Supradesnivelamento de ST (IAMSST)', 'IAM sem Supradesnivelamento de ST (IAMSSST)', 'Estratégia de Reperfusão (Angioplastia vs Fibrinolítico)', 'Terapia Antitrombótica e Antiplaquetária Dupla', 'Complicações Mecânicas e Arritmias Pós-IAM', 'Marcadores de Necrose Miocárdica (Troponina I/T)'],
  'Acidente Vascular Cerebral (AVC) Isquêmico e Hemorrágico': ['Escala de NIHSS & TC de Crânio sem Contraste', 'Trombolítico Alteplase (rtPA) & Janela Terapêutica', 'Trombectomia Mecânica em Grandes Vasos', 'AVC Hemorrágico Parenquimatoso & Controle de PA', 'Hemorragia Subaracnóidea (HSA) & Aneurismas', 'Prevenção Secundária Antiagregante vs Anticoagulação'],
  'Insuficiência Renal Aguda (IRA) e Crônica (IRC)': ['Critérios KDIGO para IRA (Pré-renal, Renal, Pós-renal)', 'Indicações de Diálise de Urgência (P.A.S.T.O.)', 'Estadiamento da IRC & Taxa de Filtração Glomerular', 'Complicações da IRC (Anemia, Distúrbio Mineral Ósseo)', 'Manejo da Hipercalemia Grave', 'Glomerulopatias e Síndrome Nefrótica/Nefrítica'],
  'Pneumonia Adquirida na Comunidade (PAC)': ['Critérios de CURB-65 e CRB-65 para Internação', 'Agentes Etiológicos Típicos vs Atípicos', 'Esquema de Antibioticoterapia Ambulatorial vs Hospitalar', 'Derrame Pleural Paraneumônico e Empiema', 'Score de PSI/PORT e UTI', 'Pneumonia Aspiration & Abscesso Pulmonar'],
  'Sepse, Choque Séptico e Disfunção de Órgãos': ['Diretrizes Surviving Sepsis Campaign (Pacote de 1h)', 'Critérios de qSOFA e SOFA Score', 'Ressuscitação Volêmica com Cristaloides (30ml/kg)', 'Vasopressores (Noradrenalina) e Inotrópicos', 'Coleta de Hemoculturas e Lactato Sérico', 'Disfunção Multiorgânica & Síndrome do Desconforto Respiratório'],
  'Infecção do Trato Urinário (ITU) e Pielonefrite': ['Cistite Não Complicada em Mulheres', 'Pielonefrite Aguda & Critérios de Internação', 'ITU Complicada e em Homens/Gestantes', 'Bacteriúria Assintomática (Indicações de Tratamento)', 'Agentes Etiológicos (E. coli, Proteus, Klebsiella)', 'ITU de Repetição e Profilaxia Antimicrobiana'],
  'Anemia Ferropriva, Megaloblástica e de Doença Crônica': ['Cinética do Ferro (Ferritina, Transferrina, TIBC)', 'Anemia Megaloblástica (Deficiência de B12 e Folato)', 'Anemia de Doença Crônica vs Ferropriva', 'Anemias Hemolíticas (Falciforme, Esferocitose, AHAI)', 'Índices Hematimétricos (VCM, HCM, RDW)', 'Reposição Oral e Parenteral de Ferro'],
  'Tuberculose Pulmonar e Hanseníase': ['Esquema RIPE (Rifampicina, Isoniazida, Pirazinamida, Etambutol)', 'Diagnóstico: TRM-TB, Baciloscopia e Cultura', 'Tuberculose Extrapulmonar e Pleural', 'Hanseníase Paucibacilar vs Multibacilar (PQT-OMS)', 'Reações Hansênicas Tipo 1 e Tipo 2 (Eritema Noso)', 'Investigação de Contactantes e ILTB'],
  'Manejo Clínico de Hepatopatias e Cirrose': ['Escore de Child-Pugh e MELD', 'Hipertensão Portal & Varizes Esofágicas (Profilaxia/Hemorragia)', 'Ascite e Peritonite Bacteriana Espontânea (PBE)', 'Encefalopatia Hepática e Lactulona', 'Síndrome Hepatorrenal e Hepatopulmonar', 'Hepatites Virais (HBV, HCV) e Autoimunes'],
  'Manejo da Cetoacidose Diabética e Estado Hiperosmolar': ['Critérios Diagnósticos de CAD vs EHH', 'Hidratação Venosa e Reposição de Potássio', 'Insulinoterapia Venosa Contínua (Bomba de Infusão)', 'Critérios de Resolução da Cetoacidose', 'Manejo de Bicarbonato e Fosfato', 'Complicações: Edema Cerebral e Hipoglicemia'],
  'Atendimento Inicial ao Politraumatizado (ATLS)': ['Sequência ABCDE do ATLS 10ª Edição', 'Vias Aéreas Definidas e Crico de Emergência', 'Pneumotórax Hipertensivo e Toracocentese', 'Choque Hemorrágico e Protocolo de Transfusão Massiva', 'Trauma Cranioencefálico (TCE) e Escala de Glasgow', 'Trauma de Pelve e Imobilização com Lençol'],
  'Trauma Abdominal Aberto e Fechado': ['Trauma Penetrante por Arma Branca e Arma de Fogo', 'Trauma Contuso e Órgão Sólido (Braço, Fígado)', 'Protocolo FAST e e-FAST na Sala de Trauma', 'Indicações de Laparotomia Exploradora de Urgência', 'Laparotomia de Controle de Danos', 'Síndrome Compartimental Abdominal'],
  'Apendicite Aguda e Complicações': ['Escore de Alvarado para Apendicite', 'Sinais Físicos Clássicos (Blumberg, Rovsing, Obturador, Psoas)', 'Diagnóstico por Imagem (USG vs TC de Abdome)', 'Apendicite Complicada (Plastron e Abscesso)', 'Apendicectomia Videolaparoscópica vs Aberta', 'Antibioticoterapia Profilática e Terapêutica'],
  'Colecistite Aguda e Colelitíase': ['Sinal de Murphy e Tríade da Colecistite', 'Critérios de Tóquio (Tokyo Guidelines) para Colecistite', 'Colecistectomia Videolaparoscópica Precoce', 'Coledocolitíase e Colangite Aguda (Tríade de Charcot / Pêntade de Reynolds)', 'USG de Abdome Superior e Colangio-TC/CPRE', 'Íleo Biliar e Síndrome de Mirizzi'],
  'Hérnias Inguinais, Femorais e Incisionais': ['Anatomia do Canal Inguinal e Trígono de Hesselbach', 'Classificação de Nyhus para Hérnias Inguinais', 'Hérnia Inguinal Direta vs Indireta', 'Hérnia Femoral e Alto Risco de Encarceramento', 'Técnicas Cirúrgicas (Lichtenstein, Shouldice, Videolaparoscopia)', 'Hérnia Encarcerada vs Estrangulada (Conduta de Emergência)'],
  'Queimaduras: Atendimento Inicial e Regra dos Nove': ['Cálculo de Superfície Corporal Queimada (Regra dos 9 de Wallace)', 'Fórmula de Parkland Modificada para Reposição Volêmica', 'Classificação por Profundidade (1º, 2º e 3º Graus)', 'Lesão por Inalação de Fumaça e Intubação Precoce', 'Indicações de Transferência para Centro de Queimados', 'Escharotomia e Enxertia Cutânea'],
  'Pré e Pós-Operatório: Risco Cirúrgico e Complicações': ['Avaliação do Risco Cirúrgico (ASA, Goldman, ACP, Lee)', 'Jejum Pré-Operatório Atualizado', 'Infecção de Sítio Cirúrgico (ISC) e Profilaxia', 'Febre no Pós-Operatório (Os 5 Ws: Wind, Water, Wound, Walking, Wonder drugs)', 'Atelectasia e Tromboembolismo Venoso (TEV)', 'Complicações Anestésicas e Hipertermia Maligna'],
  'Obstrução Intestinal e Volvo de Sigmoide': ['Causas de Obstrução Alta vs Baixa (Bridas, Hérnias, Neoplasia)', 'Radiografia de Abdome Simples (Níveis Hidroaéreos, Empilhamento de Moedas)', 'Obstrução Mecânica vs Íleo Paralítico (Síndrome de Ogilvie)', 'Volvo de Sigmoide e Sinal do Grão de Café', 'Descompressão Endoscópica vs Laparotomia', 'Manejo Conservador com Sonda Nasogástrica e Hidratação'],
  'Anestesia Local, Bloqueios e Geral': ['Anestésicos Locais (Lidocaína, Bupivacaína com/sem Vasoconstrictor)', 'Toxicidade Sistêmica por Anestésico Local (LAST) e Emulsão Lipídica', 'Raquianestesia vs Anestesia Peridural', 'Anestesia Geral: Indução, Bloqueio Neuromuscular e Manutenção', 'Sequência Rápida de Intubação (SRI) no Paciente de Estômago Cheio', 'Cefaleia Pós-Punção Dural e Blood Patch'],
  'Abdomen Agudo Hemorrágico e Vascular': ['Gravidez Ectópica Rota e Cisto Ovariano Hemorrágico', 'Aneurisma de Aorta Abdominal Roto (Tríade Clássica)', 'Isquemia Mesentérica Aguda (Angina Intestinal / Embolia)', 'Colite Isquêmica e Diagnóstico Diferencial', 'Laparotomia Exploradora e Angiografia', 'Angiotomografia de Abdome e Pélvis'],
  'Doença Hipertensiva Específica da Gestação (DHEG)': ['Classificação: Pré-eclâmpsia, Eclâmpsia, HAS Crônica e Sobreposta', 'Critérios Diagnósticos de Pré-eclâmpsia e Sinais de Gravidade', 'Esquema de Sulfato de Magnésio (Pritchard / Zuspan) e Antídoto (Gluconato)', 'Síndrome HELLP e Conduta Interrompimento', 'Anti-hipertensivos na Gestação (Metildopa, Hidralazina, Nifedipina)', 'Profilaxia com AAS e Cálcio para Pacientes de Risco'],
  'Sangramento de Terceiro Trimestre: DPP e Placenta Prévia': ['Descolamento Prematuro de Placenta (DPP) vs Placenta Prévia', 'Quadro Clínico: Dor / Hipertonia vs Sangramento Indolores', 'Vasa Prévia e Rutura de Seno Marginal', 'Conduta Obstétrica e Via de Parto', 'Rotura Uterina e Sinais de Bandl-Frommel', 'Ultrassonografia Transvaginal e Cuidados'],
  'Pré-Natal de Baixo Risco e Calendário de Exames': ['Consultas Mínimas do Pré-Natal (MS) e Suplementação (Ácido Fólico/Ferro)', 'Rastreamento de Diabetes Gestacional (TOTG 75g)', 'Sorologias Pré-Natais (HIV, Sífilis, Toxoplasmose, Hepatites)', 'Cálculo da Idade Gestacional e Data Provável do Parto (Regra de Naegele)', 'Ultrassonografia Obstétrica (Morfologia e Nucal)', 'Profilaxia para Estreptococo do Grupo B (GBS) com Penicilina'],
  'Assistência ao Parto Vaginal e Distocias': ['Fases Clínicas do Parto (Dilatação, Expulsivo, Secundamento, Greenberg)', 'Partograma: Linha de Alerta e Linha de Ação', 'Distocia de Ombro e Manobras (McRoberts, Suprapúbica)', 'Epitomia e LACERATION perineal', 'Indução do Parto (Índice de Bishop, Misoprostol, Ocitocina)', 'Analgesia de Parto e Parto Humanizado'],
  'Rastreamento de Câncer de Colo Uterino e Lesões Precursoras': ['Diretrizes do INCA para Papanicolau (Faixa Etária e Periodicidade)', 'Nomenclatura do Bethesda (ASC-US, ASC-H, LIEBG, LIEAG)', 'Condutas conforme Resultado da Citologia', 'Colposcopia e Biópsia Dirigida', 'Vacinação contra o HPV no PNI', 'Estadiamento e Tratamento do Câncer de Colo Uterino'],
  'Rastreamento e Diagnóstico de Câncer de Mama': ['Diretrizes de Rastreamento Mamográfico (INCA vs SBM)', 'Classificação BI-RADS Mamográfico e Condutas', 'Nódulos Mamários Benignos (Fibroadenoma, Cistos)', 'Carcinoma Ductal e Lobular In Situ vs Invasivo', 'Biópsia Mamária (Core Biopsy vs PAAF vs Mamotomia)', 'Fatores Prognósticos e Receptores Hormonais (HER2, RE, RP)'],
  'Corrimentos Vaginais e Cervicites (Vaginose, Candidíase)': ['Vaginose Bacteriana (Critérios de Amsel e Gardnerella)', 'Candidíase Vulvovaginal e Tratamento Oral/Tópico', 'Tricomoníase Vaginal e Tratamento do Casal', 'Cervicite por Clamídia e Gonococo', 'Doença Inflamatória Pélvica (DIP) e Critérios de Monif', 'Síndrome da Úlcera Genital (Sífilis, Herpes, Cancro Mole)'],
  'Anticoncepção Hormonal e Métodos de Barreira': ['Critérios Elegibilidade da OMS para Métodos Contraceptivos (1 a 4)', 'Contraceptivos Orais Combinados e Risco de Trombose', 'Métodos Progestágenos Isolados (Injetável, Implante, Pílula de Amamentação)', 'DIU de Cobre vs DIU de Levonorgestrel (Mirena/Kyleena)', 'Contracepção de Emergência (Levonorgestrel)', 'Laqueadura Tubária e Vasectomia (Legislação Atual)'],
  'Climatério, Menopausa e Terapia de Reposição Hormonal': ['Diagnóstico do Climatério e Menopausa (FSH)', 'Indicações e Contraindicações Absolutas da TRH', 'Esquema de TRH Estrogênio Isolado vs Combinado com Progestágeno', 'Manejo de Sintomas Vasomotores e Atrofia Urogenital', 'Osteoporose na Pós-Menopausa e Densitometria Óssea', 'Opções Não Hormonais para Ondas de Calor (ISRS)'],
  'Sangramentos de Primeira Metade: Abortamento e Ectópica': ['Formas Clínicas de Abortamento (Ameaça, Inevitável, Incompleto, Retido)', 'Condutas: Esvaziamento Uterino (AMIU vs Curetagem vs Misoprostol)', 'Gravidez Ectópica Não Rota vs Rota e Manejo com Metotrexato', 'Doença Trofoblástica Gestacional (Mola Hidatidiforme) e hCG', 'Incompatibilidade Rh e Profilaxia com Imunoglobulina Anti-D', 'Incompetência Istmocervical e Cerclagem Uterina'],
  'Crescimento, Marcos do Desenvolvimento e Puericultura': ['Gráficos de Crescimento da OMS (Escore Z e Percentis de Peso/Estatura)', 'Marcos do Desenvolvimento Motor, Cognitivo e Social', 'Avaliação do Perímetro Cefálico e Microcefalia', 'Triagem Neonatal (Teste do Pezinho, Olhinho, Orelhinha, Coraçãozinho)', 'Desnutrição Infantil (Kwashiorkor vs Marasmo)', 'Obesidade Infantil e Abordagem Nutricional'],
  'Aleitamento Materno e Benefícios': ['Anatomia e Fisiologia da Lactação (Prolactina e Ocitocina)', 'Técnica Correta de Pega e Posicionamento', 'Fissuras Mamilares, Ingurgitamento Mamário e Mastite', 'Contraindicações Absolutas ao Aleitamento Materno (HIV, HTLV)', 'Rede de Bancos de Leite Humano e Ordenha', 'Alimentação Complementar Saudável aos 6 Meses'],
  'Calendário de Vacinação da Criança (SBP/MS)': ['Vacinas ao Nascimento (BCG e Hepatite B)', 'Vacinas de 2, 4 e 6 Meses (Penta, VIP, Rotavírus, Pneumo 10)', 'Vacina Tríplice Viral, Varicela e Febre Amarela aos 12/15 Meses', 'Vacinas de Bactérias Vivas Atenuadas e Contraindicações', 'Eventos Adversos Pós-Vacinação', 'Atualizações Recentes do PNI e Vacina da Gripe/COVID'],
  'Diarreia Aguda, Desidratação e TRO': ['Avaliação do Estado de Hidratação (Planos A, B e C da OMS)', 'Terapia de Reidratação Oral (TRO) no Plano B', 'Ressuscitação Volêmica Venosa no Plano C (Soro Fisiológico / Ringer Lactato)', 'Uso de Zinco, Racecadotril e Probióticos', 'Indicações Restritas de Antibioticoterapia na Diarreia', 'Disenteria por Shigella / Salmonella e Síndrome Hemolítico-Urêmica'],
  'Infecções Respiratórias Agudas na Infância (Pneumonia, OMA)': ['Otite Média Aguda (OMA) e Critérios para Amoxicilina', 'Pneumonia Bacteriana vs Viral na Infância', 'Tratamento Ambulatorial da PAC Pediátrica (Amoxicilina)', 'Sinais de Desconforto Respiratório (Tiragem Subcostal, Batimento de Asa de Nariz)', 'Laringite Aguda (Crupe) e Nebulização com Adrenalina / Dexametasona', 'Sinusite Aguda Pediátrica e Indicações Terapêuticas'],
  'Reanimação Neonatal na Sala de Parto (Diretrizes SBP)': ['Perguntas Iniciais ao Nascimento (Gestações a Termo? Respirando/Chorando? Tônus em Flexão?)', 'Passos Iniciais (Aquecer, Posicionar, Secar, Aspirar se Necessário)', 'Ventilação com Pressão Positiva (VPP) em 60 Segundos (Minuto de Ouro)', 'Indicações e Técnica de Massagem Cardíaca Neonatal', 'Uso de Adrenalina e Expansor de Volume', 'Manejo do Recém-Nascido Banhado em Líquido Meconial'],
  'Doenças Exantemáticas: Sarampo, Varicela, Escarlatina': ['Sarampo: Manchas de Koplik, Exantema Mf-Cefalocaudal e Vitamina A', 'Varicela: Pleomorfismo Regional e Complicações Secundárias', 'Escarlatina: Lingua em Framboesa e Sinal de Pastia/Filatov', 'Eritema Infectioso (Parvovírus B19) e Roséola Infantil (HHV-6)', 'Doença de Kawasaki: Critérios Diagnósticos e Imunoglobulina Venosa', 'Diagnóstico Diferencial dos Exantemas Pediátricos'],
  'Convulsão Febril na Infância e Conduta': ['Convulsão Febril Simples vs Complexa', 'Faixa Etária Típica (6 meses a 5 anos)', 'Manejo da Crise Aguda (Benzodiazepínico Retal/Venoso)', 'Orientação Familiar e Investigação de Foco Infeccioso', 'Indicações de Punção Lombar na Suspeita de Meningite', 'Prognóstico e Ausência de Risco Elevado para Epilepsia'],
  'Sibilância no Lactente e Asma Pediátrica': ['Bronquiolite Viral Aguda (BVA por VSR) e Suporte', 'Manejo da BVA (Salina Hipertônica, Oxigênio, Não Usar BD/Corticoides)', 'Bebê Sibilante e Índice Preditivo de Asma (IPA)', 'Diagnóstico de Asma em Maiores de 5 Anos (Espirometria)', 'Tratamento de Manutenção da Asma Pediátrica (GINA Pediátrico)', 'Manejo da Crise Astmática Infantil'],
  'Meningite Bacteriana e Viral na Infância': ['Tríade Clássica de Meningite (Febre, Rigidez de Nuca, Alteração do Sensorio)', 'Sinais Físicos de Irritação Meníngea (Kernig e Brudzinski)', 'Análise do Líquido Cefalorraquidiano (LCR) - Bacteriano vs Viral', 'Antibioticoterapia Empírica de Emergência (Ceftriaxona + Ampicilina)', 'Uso de Dexametasona Pré-Antibiótico em Meningite por Pneumococo', 'Quimioprofilaxia de Contactantes (Rifampicina / Ceftriaxona)'],
  'Princípios do SUS, Diretrizes e Financiamento': ['Doutrinas do SUS: Universalidade, Equidade e Integralidade', 'Princípios Organizativos: Descentralização, Regionalização, Hierarquização', 'Participação Social no SUS (Lei 8.142/90 - Conferências e Conselhos)', 'Financiamento do SUS (Emenda Constitucional 95 e Bloco de Custeio)', 'Lei Orgânica da Saúde (Lei 8.080/90)', 'Redes de Atenção à Saúde (RAS) e Teto Financeiro'],
  'Estudos Epidemiológicos: Coorte, Caso-Controle, Ensaios': ['Estudos Observacionais Analíticos (Coorte vs Caso-Controle)', 'Medidas de Associação: Risco Relativo (RR) vs Odds Ratio (OR)', 'Ensaio Clínico Controlado Randomizado (ECCR) e Cegamento', 'Estudos Transversais e Medida de Prevalência', 'Estudos Ecológicos e Falácia Ecológica', 'Vieses Epidemiológicos (Seleção, Aferição, Confusão)'],
  'Vigilância Epidemiológica e Notificação Compulsória': ['Lista Nacional de Notificação Compulsória de Doenças e Agravos', 'Notificação Imediata (24h) vs Semanal', 'Unidades Sentinela e Vigilância Ativa vs Passiva', 'Investigação Epidemiológica de Surtos e Epidemias', 'Conceitos de Endemia, Epidemia, Pandemia e Surto', 'Sistema de Informação de Agravos de Notificação (SINAN)'],
  'Indicadores de Saúde: Mortalidade Infantil e Geral': ['Taxa de Mortalidade Infantil (Componentes Neonatal Precoce, Tardio e Pós-Neonatal)', 'Razão de Mortalidade Materna e Principais Causas no Brasil', 'Curva de Nelson Moraes e Nível de Vida da População', 'Anos Potenciais de Vida Perdidos (APVP)', 'Taxa de Letalidade vs Taxa de Mortalidade', 'Sistemas de Informação em Saúde (SIM, SINASC, SIAB)'],
  'Atenção Primária à Saúde (APS) e Saúde da Família (ESF)': ['Atributos Essenciais da APS (Acesso de Primeiro Contato, Longitudinalidade, Integralidade, Coordenação)', 'Atributos Derivados (Orientação Familiar, Comunitária, Competência Cultural)', 'Política Nacional de Atenção Básica (PNAB)', 'Atribuições da Equipe de Saúde da Família (Médico, Enf, ACS, Tec)', 'Territorialização e Mapeamento de Risco (Escore de Coelho-Savassi)', 'Prontuário Eletrônico (e-SUS APS) e Consultas de Rotina'],
  'Saúde do Trabalhador: CAT e Doenças Profissionais': ['Comunicação de Acidente de Trabalho (CAT) e Prazos', 'Doenças Profissionais (Ergostasia) vs Doenças do Trabalho', 'Classificação de Schilling para Doenças Relacionadas ao Trabalho', 'Pneumoconioses (Silicose, Asbestose) e Exposição Ocupacional', 'LER/DORT e Perda Auditiva Induzida por Ruído (PAIR)', 'Perfil Profissiográfico Previdenciário (PPP)'],
  'Bioestatística: Sensibilidade, Especificidade e VPP/VPN': ['Sensibilidade e Especificidade de Exames Diagnósticos', 'Valores Preditivos Positivo (VPP) e Negativo (VPN)', 'Influência da Prevalência da Doença nos Valores Preditivos', 'Razão de Verossimilhança (Likelihood Ratio) Positiva e Negativa', 'Curva ROC e Ponto de Corte Ótimo', 'Intervalo de Confiança de 95% e P-valor em Testes de Hipótese'],
  'Declaração de Óbito: Preenchimento e Responsabilidades': ['Regras Legais para Preenchimento do Atestado de Óbito', 'Causa Básica, Intermediária e Terminal da Morte', 'Óbito por Causas Naturais com vs sem Assistência Médica', 'Serviço de Verificação de Óbito (SVO) vs Instituto Médico Legal (IML)', 'Óbito Fetal e Critérios de Peso/Idade Gestacional para DO', 'Proibição de Cobrança e Responsabilidade Ética do Médico'],
  'Pacto pela Saúde e Financiamento do SUS': ['Pacto Pela Vida, Em Defesa do SUS e de Gestão (2006)', 'Decreto 7.508/2011 (Contrato Organizativo da Ação Pública - COAP)', 'Contratualização de Hospitais de Ensino e Filantrópicos', 'Transferências Fundo a Fundo no SUS', 'Previne Brasil e Indicadores de Desempenho na Atenção Primária', 'Programas de Qualificação do Acesso e da Atenção Básica']
};

