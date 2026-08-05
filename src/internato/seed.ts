import { db, auth, collection, addDoc, getDocs, query, limit, where, doc, setDoc, getDoc } from './firebase';


const semesters = [
  { number: 9, name: '9º Período' },
  { number: 10, name: '10º Período' },
  { number: 11, name: '11º Período' },
  { number: 12, name: '12º Período' }
];

const subjects = [
  { name: 'Pediatria', icon: 'Baby', color: 'bg-pink-100 text-pink-600', semesterNumber: 9 },
  { name: 'Ginecologia e Obstetrícia', icon: 'Stethoscope', color: 'bg-purple-100 text-purple-600', semesterNumber: 9 },
  { name: 'Medicina de Família e Comunidade', icon: 'Users', color: 'bg-green-100 text-green-600', semesterNumber: 10 },
  { name: 'Saúde Coletiva', icon: 'Globe', color: 'bg-blue-100 text-blue-600', semesterNumber: 10 },
  { name: 'Ortopedia', icon: 'Activity', color: 'bg-orange-100 text-orange-600', semesterNumber: 9 }
];

const topics = [
  {
    subjectName: 'Pediatria',
    title: 'Crescimento e Desenvolvimento Infantil',
    content: `
# Crescimento e Desenvolvimento Infantil

O acompanhamento do crescimento e desenvolvimento é o eixo central da puericultura.

## Crescimento
Refere-se ao aumento do tamanho corporal (hiperplasia e hipertrofia).
- **Peso**: RN perde até 10% na 1ª semana. Dobra aos 4-5 meses, triplica com 1 ano.
- **Estatura**: Aumenta 25cm no 1º ano.
- **Perímetro Cefálico**: 35cm ao nascimento. Aumenta 12cm no 1º ano.

## Desenvolvimento (Marcos do Desenvolvimento)
- **2 meses**: Sorriso social, sustenta a cabeça momentaneamente.
- **4 meses**: Pega objetos, sustenta a cabeça.
- **6 meses**: Senta com apoio, transfere objetos entre as mãos.
- **9 meses**: Senta sem apoio, engatinha, pinça incompleta.
- **12 meses**: Anda com apoio, algumas palavras, pinça completa.

## Diagnóstico de Desvios
Utilizar as curvas da OMS (Z-score).
- Z < -2: Baixo peso/estatura.
- Z > +2: Sobrepeso/Obesidade.
`,
    references: ['Tratado de Pediatria Nelson, 21ª Edição', 'SBP - Manual de Puericultura']
  },
  {
    subjectName: 'Ginecologia e Obstetrícia',
    title: 'DHEG - Doença Hipertensiva Específica da Gestação',
    content: `
# Pré-eclâmpsia e Eclâmpsia

A pré-eclâmpsia é definida como hipertensão (PA ≥ 140/90 mmHg) surgida após 20 semanas de gestação, associada a proteinúria ou sinais de disfunção orgânica.

## Critérios de Gravidade
- PA ≥ 160/110 mmHg.
- Iminência de eclâmpsia (cefaleia, distúrbios visuais, dor epigástrica).
- Edema agudo de pulmão.
- Síndrome HELLP (Hemólise, Enzimas hepáticas elevadas, Plaquetopenia).

## Manejo
- **Prevenção de Convulsões**: Sulfato de Magnésio (Esquema de Zuspan ou Pritchard).
- **Controle Pressórico**: Hidralazina (agudo), Metildopa (crônico).
- **Parto**: É a única cura definitiva. A idade gestacional e a gravidade guiam a decisão.
`,
    references: ['Zugaib Obstetrícia, 4ª Edição', 'Protocolos FEBRASGO']
  },
  {
    subjectName: 'Ortopedia',
    title: 'Fraturas e Luxações: Princípios Gerais',
    content: `
# Fraturas e Luxações: Princípios Gerais

## Definições
- **Fratura**: Solução de continuidade do tecido ósseo.
- **Luxação**: Perda total do contato entre as superfícies articulares.
- **Entorse**: Lesão ligamentar sem perda de contato articular.

## Classificação das Fraturas
- **Exposta vs Fechada**: Presença ou não de comunicação com o meio externo.
- **Traço de Fratura**: Transverso, oblíquo, espiral, cominutivo.
- **Desvio**: Angulação, encurtamento, rotação.

## Atendimento Inicial (ATLS)
1. Estabilização hemodinâmica.
2. Avaliação neurovascular (pulso, sensibilidade, motricidade).
3. Imobilização provisória.
4. Radiografia (pelo menos duas incidências perpendiculares).

## Tratamento
- **Conservador**: Gesso, talas, tração.
- **Cirúrgico**: Osteossíntese (placas, parafusos, hastes), fixadores externos.
`,
    references: ['Rockwood and Green\'s Fractures in Adults', 'Manual de Ortopedia SBOT']
  },
  {
    subjectName: 'Ortopedia',
    title: 'Lombalgia e Lombociatalgia',
    content: `
# Lombalgia e Lombociatalgia

## Definição
- **Lombalgia**: Dor na região lombar.
- **Lombociatalgia**: Dor lombar que irradia para o território do nervo isquiático (ciático).

## Red Flags (Sinais de Alerta)
- Idade > 50 ou < 20 anos.
- História de câncer.
- Perda de peso inexplicada.
- Febre ou calafrios.
- Trauma recente.
- Déficit neurológico progressivo (ex: Síndrome da Cauda Equina).

## Diagnóstico
- Clínico na maioria dos casos agudos.
- **Exames de Imagem**: Reservados para casos crônicos (> 6 semanas) ou com Red Flags.

## Tratamento
- **Agudo**: Repouso relativo (não absoluto), AINEs, analgésicos, relaxantes musculares.
- **Crônico**: Fisioterapia, exercícios, correção postural.
`,
    references: ['Harrison Medicina Interna', 'Diretrizes da Sociedade Brasileira de Ortopedia']
  }
];

const questions = [
  {
    topicTitle: 'Crescimento e Desenvolvimento Infantil',
    text: 'Um lactente de 6 meses de idade, durante consulta de puericultura, apresenta-se sentando com apoio, mas ainda não transfere objetos de uma mão para outra. Qual a conduta adequada?',
    options: [
      'Encaminhar imediatamente para neuropediatra.',
      'Considerar desenvolvimento normal para a idade.',
      'Solicitar ressonância magnética de crânio.',
      'Aguardar 2 meses e reavaliar.'
    ],
    correctOptionIndex: 1,
    explanation: 'Aos 6 meses, espera-se que o lactente sente com apoio. A transferência de objetos entre as mãos é um marco que se consolida por volta dos 6-7 meses, portanto, o quadro descrito está dentro do esperado.',
    source: 'SUS-SP 2022'
  },
  {
    topicTitle: 'Fraturas e Luxações: Princípios Gerais',
    text: 'Qual a conduta prioritária no atendimento de uma fratura exposta de tíbia no pronto-socorro?',
    options: [
      'Redução imediata da fratura.',
      'Antibioticoterapia e limpeza exaustiva da ferida.',
      'Aplicação de gesso circular.',
      'Encaminhamento para fisioterapia.'
    ],
    correctOptionIndex: 1,
    explanation: 'Em fraturas expostas, a prioridade é a prevenção de infecção através de antibioticoterapia precoce e limpeza cirúrgica.',
    source: 'Revalida 2021'
  }
];

export async function seedDatabase() {
  if (!auth.currentUser) return;

  // READ OPTIMIZATION: Check if seed was already done to avoid 100s of reads every reload
  const seedFlagRef = doc(db, 'global', 'seed_flag');
  const seedFlagSnap = await getDoc(seedFlagRef);
  if (seedFlagSnap.exists() && seedFlagSnap.data().version >= 2) {
    return;
  }

  console.log('Starting seed process (Version 2)...');
  
  // Check if semesters exist
  const semestersSnap = await getDocs(query(collection(db, 'semesters'), limit(1)));
  let semesterIds: Record<number, string> = {};

  if (semestersSnap.empty) {
    console.log('Seeding semesters...');
    for (const s of semesters) {
      const docRef = await addDoc(collection(db, 'semesters'), s);
      semesterIds[s.number] = docRef.id;
    }
  } else {
    // Map existing semesters
    const allSemesters = await getDocs(collection(db, 'semesters'));
    allSemesters.forEach(doc => {
      const data = doc.data();
      semesterIds[data.number] = doc.id;
    });
  }

  // Check if subjects exist
  const subjectsSnap = await getDocs(query(collection(db, 'subjects'), limit(1)));
  const subjectIds: Record<string, string> = {};

  if (subjectsSnap.empty) {
    console.log('Seeding subjects...');
    for (const s of subjects) {
      const { semesterNumber, ...subjectData } = s;
      const docRef = await addDoc(collection(db, 'subjects'), {
        ...subjectData,
        semesterId: semesterIds[semesterNumber] || ''
      });
      subjectIds[s.name] = docRef.id;
    }
  } else {
    // Check if Ortopedia exists specifically
    const ortoSnap = await getDocs(query(collection(db, 'subjects'), where('name', '==', 'Ortopedia')));
    if (ortoSnap.empty) {
      console.log('Adding Ortopedia subject...');
      const orto = subjects.find(s => s.name === 'Ortopedia')!;
      const { semesterNumber, ...subjectData } = orto;
      const docRef = await addDoc(collection(db, 'subjects'), {
        ...subjectData,
        semesterId: semesterIds[semesterNumber] || ''
      });
      subjectIds['Ortopedia'] = docRef.id;
    }

    // Map existing subjects
    const allSubjects = await getDocs(collection(db, 'subjects'));
    allSubjects.forEach(doc => {
      const data = doc.data();
      subjectIds[data.name] = doc.id;
    });
  }

  // Check if topics exist
  const topicsSnap = await getDocs(query(collection(db, 'topics'), limit(1)));
  const topicIds: Record<string, string> = {};

  if (topicsSnap.empty) {
    console.log('Seeding topics...');
    for (const t of topics) {
      const { subjectName, ...topicData } = t;
      const docRef = await addDoc(collection(db, 'topics'), {
        ...topicData,
        subjectId: subjectIds[subjectName],
        semesterId: subjects.find(s => s.name === subjectName)?.semesterNumber ? semesterIds[subjects.find(s => s.name === subjectName)!.semesterNumber] : '',
        lastUpdated: new Date().toISOString(),
        title_search: t.title.toLowerCase()
      });
      topicIds[t.title] = docRef.id;
    }
  } else {
    // Add missing topics
    for (const t of topics) {
      const topicSnap = await getDocs(query(collection(db, 'topics'), where('title', '==', t.title)));
      if (topicSnap.empty) {
        console.log(`Adding missing topic: ${t.title}`);
        const { subjectName, ...topicData } = t;
        const docRef = await addDoc(collection(db, 'topics'), {
          ...topicData,
          subjectId: subjectIds[subjectName],
          semesterId: subjects.find(s => s.name === subjectName)?.semesterNumber ? semesterIds[subjects.find(s => s.name === subjectName)!.semesterNumber] : '',
          lastUpdated: new Date().toISOString(),
          title_search: t.title.toLowerCase()
        });
        topicIds[t.title] = docRef.id;
      }
    }
  }

  // Add missing questions
  for (const q of questions) {
    const qSnap = await getDocs(query(collection(db, 'questions'), where('text', '==', q.text)));
    if (qSnap.empty) {
      console.log(`Adding missing question for topic: ${q.topicTitle}`);
      const { topicTitle, ...questionData } = q;
      
      // Find topic ID
      const tSnap = await getDocs(query(collection(db, 'topics'), where('title', '==', topicTitle)));
      if (!tSnap.empty) {
        await addDoc(collection(db, 'questions'), {
          ...questionData,
          topicId: tSnap.docs[0].id
        });
      }
    }
  }

  console.log('Seeding check complete!');
  
  // Mark seed as complete to save reads next time
  await setDoc(doc(db, 'global', 'seed_flag'), { version: 2, lastRun: new Date().toISOString() }, { merge: true });

  // Initialize Global Stats
  const globalStatsRef = doc(db, 'global', 'stats');
  const globalStatsSnap = await getDoc(globalStatsRef);
  if (!globalStatsSnap.exists()) {
    console.log('Initializing global stats...');
    await setDoc(globalStatsRef, {
      aiUsage: {
        date: new Date().toISOString().split('T')[0],
        count: 0
      }
    });
  }
}

export async function cloneGlobalToUser(userId: string) {
  try {
    console.log(`[Clone] Starting clone of global curriculum to user: ${userId}`);
    
    // 1. Semesters
    const semestersSnap = await getDocs(collection(db, 'semesters'));
    for (const d of semestersSnap.docs) {
      await setDoc(doc(db, 'users', userId, 'semesters', d.id), d.data());
    }
    
    // 2. Subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    for (const d of subjectsSnap.docs) {
      await setDoc(doc(db, 'users', userId, 'subjects', d.id), d.data());
    }
    
    // 3. Topics
    const topicsSnap = await getDocs(collection(db, 'topics'));
    for (const d of topicsSnap.docs) {
      await setDoc(doc(db, 'users', userId, 'topics', d.id), d.data());
    }
    
    console.log(`[Clone] Curriculum cloned successfully to user: ${userId}`);
  } catch (err) {
    console.error('[Clone] Error cloning global curriculum to user:', err);
  }
}
