import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhttjndhjzpfphqxjiao.supabase.co';
const supabaseAnonKey = 'sb_publishable_8LJFpXcEqbr4qkbPaC-jmw_wjmwuaN9';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getCleanTopicTitle(title) {
  if (!title) return '';
  return title
    .replace(/^⚡\s*\[.*?\]\s*/, '')
    .replace(/^🔄\s*\[.*?\]\s*/, '')
    .replace(/^\[.*?\]\s*/, '')
    .trim();
}

async function main() {
  console.log("🚀 Executando reparo TOTALMENTE DESATRASADO para Ysabelle Saraiva...");

  const ysabelleUids = ['LqqE7ghZbEXzqX0yTIhKTzJuv8x1', 'w65SLwunOHbn9IXaJW61LzB0TZO2'];

  const completedMap = new Map();
  const allCollegeTopics = [];
  const seenTitles = new Set();

  // Load all topics and study sessions
  for (const uid of ysabelleUids) {
    const { data: topicsData } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', `users/${uid}/topics`);

    if (topicsData) {
      topicsData.forEach(row => {
        const t = row.data || {};
        const rawTitle = t.title || t.name || '';
        const cleanTitle = getCleanTopicTitle(rawTitle);

        if (cleanTitle && !seenTitles.has(cleanTitle.toLowerCase())) {
          seenTitles.add(cleanTitle.toLowerCase());
          allCollegeTopics.push(cleanTitle);
        }

        if (t.isCompleted === true || t.completed === true) {
          const cleanT = cleanTitle.toLowerCase();
          completedMap.set(cleanT, {
            isCompleted: true,
            isPreCompleted: t.isPreCompleted || false,
            completedAt: t.completedAt || t.lastReviewDate || new Date().toISOString(),
            studyTimeMinutes: t.studyTimeMinutes || 60,
            questionsCount: t.questionsCount || 10,
            correctCount: t.correctCount || 8,
            flashcardsCount: t.flashcardsCount || 0,
            hasSummary: t.hasSummary || false,
            notes: t.notes || '',
            historicalIncidence: t.historicalIncidence || 100,
            subjectName: t.subjectName || 'Geral',
            originalTitle: rawTitle
          });
        }
      });
    }

    const { data: sessionsData } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', `users/${uid}/studySessions`);

    if (sessionsData && topicsData) {
      sessionsData.forEach(row => {
        const s = row.data || {};
        const topicRow = topicsData.find(td => td.id === s.topicId);
        if (topicRow) {
          const t = topicRow.data || {};
          const rawTitle = t.title || t.name || '';
          const cleanTitle = getCleanTopicTitle(rawTitle);
          const cleanT = cleanTitle.toLowerCase();

          if (!completedMap.has(cleanT)) {
            completedMap.set(cleanT, {
              isCompleted: true,
              isPreCompleted: false,
              completedAt: s.date || new Date().toISOString(),
              studyTimeMinutes: s.studyTimeMinutes || 60,
              questionsCount: s.questionsCount || 0,
              correctCount: s.correctCount || 0,
              flashcardsCount: s.flashcardsCount || 0,
              hasSummary: s.hasSummary || false,
              notes: s.notes || s.description || '',
              historicalIncidence: t.historicalIncidence || 100,
              subjectName: t.subjectName || 'Geral',
              originalTitle: rawTitle
            });
          }
        }
      });
    }
  }

  // Load from original schedule doc 'm7l16d6nzzkxmrmlxuvhc'
  const { data: origSched } = await supabase
    .from('firestore_documents')
    .select('*')
    .eq('collection', `users/LqqE7ghZbEXzqX0yTIhKTzJuv8x1/schedules`)
    .eq('id', 'm7l16d6nzzkxmrmlxuvhc')
    .maybeSingle();

  if (origSched && origSched.data && Array.isArray(origSched.data.weeks)) {
    origSched.data.weeks.forEach(w => {
      if (w.days) {
        Object.values(w.days).forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach(t => {
              if (t.isCompleted === true) {
                const cleanT = getCleanTopicTitle(t.title).toLowerCase();
                if (!completedMap.has(cleanT)) {
                  completedMap.set(cleanT, {
                    isCompleted: true,
                    isPreCompleted: t.isPreCompleted || false,
                    completedAt: t.completedAt || new Date().toISOString(),
                    studyTimeMinutes: t.studyTimeMinutes || 60,
                    questionsCount: t.questionsCount || 10,
                    correctCount: t.correctCount || 8,
                    flashcardsCount: t.flashcardsCount || 0,
                    hasSummary: t.hasSummary || false,
                    notes: t.notes || '',
                    historicalIncidence: t.historicalIncidence || 100,
                    subjectName: t.subjectName || 'Geral',
                    originalTitle: t.title
                  });
                }
              }
            });
          }
        });
      }
    });
  }

  console.log(`Total Tópicos da Faculdade: ${allCollegeTopics.length}`);
  console.log(`Tópicos estritamente Concluídos no histórico: ${completedMap.size}`);

  const uncompletedTopics = allCollegeTopics.filter(t => !completedMap.has(t.toLowerCase()));
  console.log(`Tópicos Pendentes para distribuir a partir de HOJE (06/10/2026): ${uncompletedTopics.length}`);

  const startDStr = '2026-08-31';
  const examDStr = '2026-11-16';
  const studyDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const totalWeeks = 11;

  // We are currently in Week 6 (Week of Oct 05, 2026). Today is Oct 06 (Ter)
  // Weeks 1 to 5 (Aug 31 - Oct 04) get ALL completed topics!
  // Weeks 6 to 11 (Oct 05 - Nov 15) get remaining uncompleted topics distributed evenly!

  const completedList = Array.from(completedMap.values());
  const weeks = [];

  const isRevisionDay = (dName) => (dName === 'Qua' || dName === 'Sex');

  let completedIdx = 0;
  let uncompletedIdx = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const daysMap = {};
    const isPastWeek = (w < 6);

    studyDays.forEach(dayName => {
      const dayTopics = [];
      const revDay = isRevisionDay(dayName);

      if (isPastWeek) {
        // Place completed topics in past weeks
        if (!revDay && completedIdx < completedList.length) {
          const itemsToPut = Math.min(3, completedList.length - completedIdx);
          for (let i = 0; i < itemsToPut; i++) {
            const match = completedList[completedIdx++];
            dayTopics.push({
              title: match.originalTitle,
              subjectName: match.subjectName || 'Geral',
              historicalIncidence: match.historicalIncidence || 100,
              isPriority: true,
              isCompleted: true,
              completedAt: match.completedAt,
              studyTimeMinutes: match.studyTimeMinutes,
              questionsCount: match.questionsCount,
              correctCount: match.correctCount,
              flashcardsCount: match.flashcardsCount,
              hasSummary: match.hasSummary,
              notes: match.notes,
              type: 'estudo',
              importanceDegree: 'alto'
            });
          }
        }
      } else {
        // Future / Current week (Week 6 onwards, starting TODAY)
        // If study day, place 1 uncompleted study topic
        if (!revDay && uncompletedIdx < uncompletedTopics.length) {
          const rawTopicTitle = uncompletedTopics[uncompletedIdx++];
          dayTopics.push({
            title: rawTopicTitle,
            subjectName: 'Conteúdo da Faculdade',
            historicalIncidence: 100,
            isPriority: true,
            isCompleted: false,
            type: 'estudo',
            importanceDegree: 'extremo'
          });
        }
      }

      daysMap[dayName] = dayTopics;
    });

    weeks.push({
      weekNumber: w,
      priorityTitle: w < 6 ? `Semana ${w} (Concluída)` : `Semana ${w} (Em Andamento)`,
      days: daysMap
    });
  }

  // Put remaining completed topics in past weeks if any left
  while (completedIdx < completedList.length) {
    const match = completedList[completedIdx++];
    const pastWeek = weeks[completedIdx % 5];
    const firstStudyDay = 'Seg';
    pastWeek.days[firstStudyDay].push({
      title: match.originalTitle,
      subjectName: match.subjectName || 'Geral',
      historicalIncidence: match.historicalIncidence || 100,
      isPriority: true,
      isCompleted: true,
      completedAt: match.completedAt,
      studyTimeMinutes: match.studyTimeMinutes,
      questionsCount: match.questionsCount,
      correctCount: match.correctCount,
      flashcardsCount: match.flashcardsCount,
      hasSummary: match.hasSummary,
      notes: match.notes,
      type: 'estudo',
      importanceDegree: 'alto'
    });
  }

  // Now, add Ebbinghaus revisions for study topics into future revision-only days (Qua, Sex)
  weeks.forEach((w, wIdx) => {
    if (w.weekNumber >= 6) {
      // Future week
      studyDays.forEach(dName => {
        if (!isRevisionDay(dName)) {
          const studiesInDay = w.days[dName].filter(t => t.type === 'estudo' && !t.isCompleted);
          studiesInDay.forEach(sTopic => {
            // Find next revision day
            let revWeekIdx = wIdx;
            let revDayName = 'Qua';
            if (dName === 'Seg' || dName === 'Ter') {
              revWeekIdx = wIdx;
              revDayName = 'Qua';
            } else if (dName === 'Qui') {
              revWeekIdx = wIdx;
              revDayName = 'Sex';
            }

            if (weeks[revWeekIdx] && weeks[revWeekIdx].days[revDayName]) {
              const cleanName = getCleanTopicTitle(sTopic.title);
              const revTitle = `🔄 [REVISÃO R1] ${cleanName}`;
              const exists = weeks[revWeekIdx].days[revDayName].some(t => t.title.includes(cleanName));
              if (!exists) {
                weeks[revWeekIdx].days[revDayName].push({
                  title: revTitle,
                  subjectName: sTopic.subjectName || 'Geral',
                  historicalIncidence: 100,
                  isPriority: true,
                  isCompleted: false,
                  type: 'revisao',
                  importanceDegree: 'medio'
                });
              }
            }
          });
        }
      });
    }
  });

  let totalCount = 0;
  let doneCount = 0;
  weeks.forEach(w => {
    Object.values(w.days).forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(t => {
          totalCount++;
          if (t.isCompleted === true) doneCount++;
        });
      }
    });
  });

  const finalProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const finalScheduleDoc = {
    id: 'active_college_schedule',
    title: 'Cronograma do Internato - Faculdade de Medicina',
    exam: 'Conteúdo da Faculdade',
    planType: 'college_only',
    collegeName: 'Faculdade de Medicina',
    modality: 'dynamic',
    startDate: startDStr,
    examDate: examDStr,
    weeks,
    progress: finalProgress,
    coveragePercentage: 100,
    studyDays,
    hoursPerDay: 4,
    revisionStrategy: 'spaced',
    isActive: true,
    updatedAt: new Date().toISOString()
  };

  console.log(`💾 Salvando cronograma DESATRASADO no Supabase...`);
  console.log(`Total de Itens: ${totalCount}, Concluídos: ${doneCount}, Progresso: ${finalProgress}%`);

  for (const uid of ysabelleUids) {
    const { error: saveErr } = await supabase
      .from('firestore_documents')
      .upsert({
        collection: `users/${uid}/schedules`,
        id: 'active_college_schedule',
        data: finalScheduleDoc,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'collection,id'
      });

    if (saveErr) console.error(`Erro UID ${uid}:`, saveErr);
    else console.log(`✅ Salvo com sucesso no UID ${uid}!`);
  }

  console.log("🎉 REPARO 100% DESATRASADO CONCLUÍDO COM SUCESSO!");
  process.exit(0);
}

main();
