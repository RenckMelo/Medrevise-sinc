import React, { useState, useEffect } from 'react';
import { Subject, Topic, Question, Semester } from '../types';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Book, Plus, HelpCircle, ShieldAlert, Sparkles, Database, AlertTriangle, LayoutDashboard, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { db, supabase, collection, addDoc, deleteDoc, doc, updateDoc, query, setDoc, getDocs, where, limit } from '../firebase';
import { seedDatabase } from '../seed';
import firebaseConfig from '../../../firebase-applet-config.json';
// @ts-ignore
import { initializeApp as initRealApp, getApps as getRealApps } from '../../../node_modules/firebase/app/dist/index.mjs';
// @ts-ignore
import { getFirestore as getRealFirestore, collection as realCollection, getDocs as realGetDocs } from '../../../node_modules/firebase/firestore/dist/index.mjs';
// @ts-ignore
import { getAuth as getRealAuth, signInAnonymously as realSignInAnonymously, signInWithPopup as realSignInWithPopup, GoogleAuthProvider as RealGoogleAuthProvider } from '../../../node_modules/firebase/auth/dist/index.mjs';

import { generateTopicContent } from '../services/geminiService';
import { safeLocalStorageSet } from '../utils/storageUtils';
import { 
  SemesterManager, 
  SubjectManager, 
  TopicManager, 
  QuestionManager, 
  ModerationManager,
  AdminDashboard,
  ReferralLogsManager
} from './admin/AdminComponents';

interface AdminPanelProps {
  subjects: Subject[];
  topics: Topic[];
  semesters: Semester[];
  userId: string;
  setSubjects?: React.Dispatch<React.SetStateAction<Subject[]>>;
  setSemesters?: React.Dispatch<React.SetStateAction<Semester[]>>;
  setTopics?: React.Dispatch<React.SetStateAction<Topic[]>>;
  isAdmin: boolean;
}

export default function AdminPanel({ 
  subjects, 
  topics, 
  semesters, 
  userId,
  setSubjects,
  setSemesters,
  setTopics,
  isAdmin
}: AdminPanelProps) {
  const [newSemester, setNewSemester] = useState({ number: '', name: '' });
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  const [newSubject, setNewSubject] = useState({ name: '', icon: 'BookOpen', color: 'bg-blue-100 text-blue-600', semesterId: '' });
  const [newTopic, setNewTopic] = useState({ 
    subjectId: '', 
    title: '', 
    content: '# Conteúdo em desenvolvimento\n\nUse o botão de IA para gerar um novo resumo.', 
    references: '', 
    semesterId: '' 
  });
  const [newQuestion, setNewQuestion] = useState({ 
    topicId: '', 
    text: '', 
    options: ['', '', '', ''], 
    correctOptionIndex: 0, 
    explanation: '', 
    source: '' 
  });
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'semester' | 'subject' | 'topic' | 'content' } | null>(null);
  
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'dashboard' : 'semesters');
  
  // Search query states for the list view
  const [subjectSearch, setSubjectSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  // States and actions for managing existing questions
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);
  const [selectedTopicForManage, setSelectedTopicForManage] = useState<string>('');
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsSubTab, setQuestionsSubTab] = useState<'manage' | 'create'>('manage');

  // User Moderation States
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchEmail.trim()) return;
    setIsSearchingUser(true);
    setUserSearchError(null);
    setFoundUser(null);
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', searchEmail.toLowerCase().trim()),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setUserSearchError('Nenhum usuário encontrado com este e-mail.');
      }
    } catch (err: any) {
      console.error('Error searching user:', err);
      setUserSearchError(`Erro na busca: ${err.message}`);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const fetchRecentUsers = async () => {
    try {
      const q = query(collection(db, 'users'), limit(15));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentUsers(list);
    } catch (err) {
      console.error('Error fetching recent users:', err);
    }
  };

  useEffect(() => {
    fetchRecentUsers();
  }, []);

  const handleToggleUserPremium = async (targetUser: any) => {
    setUpdatingUser(true);
    try {
      const nextPremiumState = !targetUser.isPremium;
      const defaultPlan = nextPremiumState ? 'med_internato_premium' : '';
      
      const userDocRef = doc(db, 'users', targetUser.id);
      await updateDoc(userDocRef, {
        isPremium: nextPremiumState,
        premiumPlan: defaultPlan,
        updatedAt: new Date().toISOString()
      });

      const updatedUser = { ...targetUser, isPremium: nextPremiumState, premiumPlan: defaultPlan };
      if (foundUser && foundUser.id === targetUser.id) {
        setFoundUser(updatedUser);
      }
      setRecentUsers(prev => prev.map(u => u.id === targetUser.id ? updatedUser : u));
      alert(`Status premium do usuário atualizado para: ${nextPremiumState ? 'Premium (med_internato_premium)' : 'Gratuito'}`);
    } catch (err: any) {
      console.error('Error updating premium status:', err);
      alert(`Erro ao atualizar premium: ${err.message}`);
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleChangeUserPlan = async (targetUser: any, plan: string) => {
    setUpdatingUser(true);
    try {
      const userDocRef = doc(db, 'users', targetUser.id);
      await updateDoc(userDocRef, {
        premiumPlan: plan,
        isPremium: true,
        updatedAt: new Date().toISOString()
      });

      const updatedUser = { ...targetUser, isPremium: true, premiumPlan: plan };
      if (foundUser && foundUser.id === targetUser.id) {
        setFoundUser(updatedUser);
      }
      setRecentUsers(prev => prev.map(u => u.id === targetUser.id ? updatedUser : u));
      alert(`Plano do usuário atualizado para: ${plan}`);
    } catch (err: any) {
      console.error('Error updating premium plan:', err);
      alert(`Erro ao atualizar plano: ${err.message}`);
    } finally {
      setUpdatingUser(false);
    }
  };

  const fetchAdminQuestions = async (topicId?: string) => {
    setLoadingQuestions(true);
    try {
      let q;
      if (topicId) {
        q = query(collection(db, 'questions'), where('topicId', '==', topicId), limit(50));
      } else {
        q = query(collection(db, 'questions'), limit(30));
      }
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Question));
      setAdminQuestions(fetched);
    } catch (e) {
      console.error('Error fetching admin questions:', e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchAdminQuestions(selectedTopicForManage);
  }, [selectedTopicForManage]);

  const handleDeleteAdminQuestion = async (id: string) => {
    const confirmDelete = window.confirm("Deseja realmente excluir permanentemente esta questão do banco de dados?");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'questions', id));
      setAdminQuestions(prev => prev.filter(q => q.id !== id));
      alert('Questão excluída com sucesso!');
    } catch (e) {
      console.error('Error deleting question:', e);
      alert('Erro ao excluir a questão. Verifique as regras de segurança ou conexão.');
    }
  };

  const handleAddSemester = async () => {
    if (!newSemester.number || !newSemester.name) return;
    const semData = {
      number: Number(newSemester.number),
      name: newSemester.name
    };

    if (editingSemesterId) {
      await updateDoc(doc(db, 'semesters', editingSemesterId), semData);
      if (userId) {
        await updateDoc(doc(db, 'users', userId, 'semesters', editingSemesterId), semData);
      }
      if (setSemesters) {
        setSemesters(prev => {
          const updated = prev.map(s => s.id === editingSemesterId ? { ...s, ...semData } : s);
          safeLocalStorageSet('cache_semesters', JSON.stringify(updated));
          return updated;
        });
      }
      setEditingSemesterId(null);
    } else {
      const docRef = await addDoc(collection(db, 'semesters'), semData);
      if (userId) {
        await setDoc(doc(db, 'users', userId, 'semesters', docRef.id), semData);
      }
      if (setSemesters) {
        setSemesters(prev => {
          const updated = [...prev, { id: docRef.id, ...semData }].sort((a, b) => a.number - b.number);
          safeLocalStorageSet('cache_semesters', JSON.stringify(updated));
          return updated;
        });
      }
    }
    setNewSemester({ number: '', name: '' });
  };

  const handleDeleteSemester = async (id: string) => {
    await deleteDoc(doc(db, 'semesters', id));
    if (userId) {
      await deleteDoc(doc(db, 'users', userId, 'semesters', id));
    }
    if (setSemesters) {
      setSemesters(prev => {
        const updated = prev.filter(s => s.id !== id);
        safeLocalStorageSet('cache_semesters', JSON.stringify(updated));
        return updated;
      });
    }
    setConfirmDelete(null);
  };

  const handleAddSubject = async () => {
    if (!newSubject.name || !newSubject.semesterId) return;
    const subData = { ...newSubject };

    if (editingSubjectId) {
      if (userId) {
        await updateDoc(doc(db, 'users', userId, 'subjects', editingSubjectId), subData);
      }
      await updateDoc(doc(db, 'subjects', editingSubjectId), subData);
      if (setSubjects) {
        setSubjects(prev => {
          const updated = prev.map(s => s.id === editingSubjectId ? { ...s, ...subData } : s);
          safeLocalStorageSet('cache_subjects', JSON.stringify(updated));
          return updated;
        });
      }
      setEditingSubjectId(null);
    } else {
      const docRef = await addDoc(collection(db, 'subjects'), subData);
      if (userId) {
        await setDoc(doc(db, 'users', userId, 'subjects', docRef.id), subData);
      }
      if (setSubjects) {
        setSubjects(prev => {
          const updated = [...prev, { id: docRef.id, ...subData }].sort((a, b) => a.name.localeCompare(b.name));
          safeLocalStorageSet('cache_subjects', JSON.stringify(updated));
          return updated;
        });
      }
    }
    setNewSubject({ name: '', icon: 'BookOpen', color: 'bg-blue-100 text-blue-600', semesterId: '' });
  };

  const handleDeleteSubject = async (id: string) => {
    if (userId) {
      await deleteDoc(doc(db, 'users', userId, 'subjects', id));
    }
    await deleteDoc(doc(db, 'subjects', id));
    if (setSubjects) {
      setSubjects(prev => {
        const updated = prev.filter(s => s.id !== id);
        safeLocalStorageSet('cache_subjects', JSON.stringify(updated));
        return updated;
      });
    }
    setConfirmDelete(null);
  };

  const handleAddTopic = async () => {
    if (!newTopic.subjectId || !newTopic.title) return;
    const topicData = {
      ...newTopic,
      name: newTopic.title.trim(), // Save both name and title to satisfy security rules and keep compatible with MedRevise
      references: newTopic.references.split('\n').filter(r => r.trim()),
      lastUpdated: new Date().toISOString(),
      title_search: newTopic.title.toLowerCase()
    };

    if (editingTopicId) {
      if (userId) {
        await updateDoc(doc(db, 'users', userId, 'topics', editingTopicId), topicData);
      }
      await updateDoc(doc(db, 'topics', editingTopicId), topicData);
      if (setTopics) {
        setTopics(prev => {
          const updated = prev.map(t => t.id === editingTopicId ? { ...t, ...topicData } : t);
          return updated;
        });
      }
      setEditingTopicId(null);
    } else {
      const docRef = await addDoc(collection(db, 'topics'), topicData);
      if (userId) {
        await setDoc(doc(db, 'users', userId, 'topics', docRef.id), topicData);
      }
      if (setTopics) {
        setTopics(prev => {
          const updated = [{ id: docRef.id, ...topicData }, ...prev];
          return updated;
        });
      }
    }
    setNewTopic({ 
      subjectId: '', 
      title: '', 
      content: '# Conteúdo em desenvolvimento\n\nUse o botão de IA para gerar um novo resumo.', 
      references: '', 
      semesterId: '' 
    });
  };

  const handleDeleteTopic = async (id: string) => {
    if (userId) {
      await deleteDoc(doc(db, 'users', userId, 'topics', id));
    }
    await deleteDoc(doc(db, 'topics', id));
    if (setTopics) {
      setTopics(prev => prev.filter(t => t.id !== id));
    }
    setConfirmDelete(null);
  };

  const handleDeleteContent = async (topicId: string) => {
    const resetData = {
      content: '# Conteúdo em desenvolvimento\n\nUse o botão de IA para gerar um novo resumo.',
      lastUpdated: new Date().toISOString()
    };
    const docRef = userId ? doc(db, 'users', userId, 'topics', topicId) : doc(db, 'topics', topicId);
    await updateDoc(docRef, resetData);
    if (setTopics) {
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, ...resetData } : t));
    }
    setConfirmDelete(null);
  };

  const handleGenerateAI = async (force = false) => {
    if (!newTopic.title) return;
    
    // Check if content is already present (not placeholder)
    const isPlaceholder = newTopic.content.includes('Conteúdo em desenvolvimento') || newTopic.content.length < 100;
    if (!isPlaceholder && !force) {
      setShowOverwriteConfirm(true);
      return;
    }

    setIsGenerating(true);
    setShowOverwriteConfirm(false);
    try {
      const content = await generateTopicContent(newTopic.title, '', userId);
      setNewTopic(prev => ({ ...prev, content }));
    } catch (error) {
      console.error(error);
    }
    setIsGenerating(false);
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.text || !newQuestion.options[0]) {
      alert('Certifique-se de preencher o enunciado e pelo menos uma alternativa.');
      return;
    }
    try {
      await addDoc(collection(db, 'questions'), newQuestion);
      alert('Questão adicionada com sucesso!');
      setNewQuestion({ 
        topicId: '', 
        text: '', 
        options: ['', '', '', ''], 
        correctOptionIndex: 0, 
        explanation: '', 
        source: '' 
      });
      fetchAdminQuestions(selectedTopicForManage);
    } catch (e) {
      console.error('Error adding question:', e);
      alert('Erro ao criar questão no Firebase.');
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedMessage('Iniciando sincronização...');
    try {
      // Force version refresh in flag
      await setDoc(doc(db, 'global', 'seed_flag'), { version: 0 }, { merge: true });
      await seedDatabase();
      setSeedMessage('Banco de dados sincronizado com sucesso!');
      setTimeout(() => setSeedMessage(null), 5000);
    } catch (err: any) {
      setSeedMessage(`Erro na sincronização: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAuthAndMigrate = async () => {
    setIsMigrating(true);
    setMigrationMessage('Conectando ao Firebase Firestore original...');
    try {
      let appReal;
      const apps = getRealApps();
      if (!apps.length) {
        appReal = initRealApp(firebaseConfig);
      } else {
        appReal = apps[0];
      }
      
      const authReal = getRealAuth(appReal);
      let currentUser = authReal.currentUser;
      
      if (!currentUser) {
        setMigrationMessage('Tentando autenticação silenciosa no Firebase (Sem popups)...');
        try {
          const result = await realSignInAnonymously(authReal);
          currentUser = result.user;
          console.log('Autenticado anonimamente com sucesso para migração.');
        } catch (anonErr: any) {
          console.warn('Login anônimo não disponível ou desativado. Tentando login com Google...', anonErr);
          setMigrationMessage('Aviso: Login silencioso desativado. Tentando autenticação do Google (por favor, permita popups se solicitado)...');
          try {
            const provider = new RealGoogleAuthProvider();
            const result = await realSignInWithPopup(authReal, provider);
            currentUser = result.user;
          } catch (popupErr: any) {
            if (popupErr.code === 'auth/popup-blocked' || popupErr.message?.includes('popup')) {
              throw new Error('O seu navegador bloqueou a janela de login (popup). Para resolver: \n\n1. Ative a permissão de popups para este site nas configurações do seu navegador.\n2. OU clique no botão "Abrir em nova aba" no canto superior direito para executar a migração em tela cheia.\n3. OU ative o provedor "Anônimo" nas configurações de Authentication do console do seu Firebase.');
            }
            throw popupErr;
          }
        }
      }
      
      if (!currentUser) {
        throw new Error('Não foi possível autenticar no Firebase. Verifique se o serviço está configurado corretamente.');
      }
      
      const userIdent = currentUser.isAnonymous ? 'Sessão Segura Anônima' : currentUser.email;
      setMigrationMessage(`Autenticado com sucesso (${userIdent})! Iniciando leitura das coleções do Firebase Firestore antigo...`);
      
      const dbReal = getRealFirestore(appReal, (firebaseConfig as any).firestoreDatabaseId);
      const dbDefault = getRealFirestore(appReal);
      
      const fetchCol = async (name: string) => {
        setMigrationMessage(`Lendo coleção "${name}" do Firebase...`);
        const documentsMap = new Map<string, any>();

        // 1. Fetch from named database
        try {
          const snap = await realGetDocs(realCollection(dbReal, name));
          snap.docs.forEach(doc => {
            documentsMap.set(doc.id, doc.data());
          });
          console.log(`Coleção "${name}" lida da named database. Encontrados: ${snap.docs.length}`);
        } catch (error: any) {
          console.warn(`Aviso: não foi possível ler a coleção "${name}" da named database:`, error.message);
        }

        // 2. Fetch from default database
        try {
          const snap = await realGetDocs(realCollection(dbDefault, name));
          snap.docs.forEach(doc => {
            documentsMap.set(doc.id, doc.data());
          });
          console.log(`Coleção "${name}" lida da default database. Encontrados: ${snap.docs.length}`);
        } catch (error: any) {
          console.warn(`Aviso: não foi possível ler a coleção "${name}" da default database:`, error.message);
        }

        return Array.from(documentsMap.entries()).map(([id, data]) => ({ id, data }));
      };
      
      const semestersCol = await fetchCol('semesters');
      const subjectsCol = await fetchCol('subjects');
      const topicsCol = await fetchCol('topics');
      const questionsCol = await fetchCol('questions');
      const flashcardsCol = await fetchCol('flashcards');
      
      const totalDocsRaw = semestersCol.length + subjectsCol.length + topicsCol.length + questionsCol.length + flashcardsCol.length;
      if (totalDocsRaw === 0) {
        throw new Error('Nenhum dado encontrado no seu Firebase Firestore antigo para migrar. Verifique se as coleções existem no banco do Firebase configurado.');
      }
      
      setMigrationMessage(`Extração concluída! Encontrados ${totalDocsRaw} registros brutos. Iniciando mapeamento e deduplicação inteligente para garantir integridade...`);

      // 1. Unified and deduplicated Semesters
      const uniqueSemesters: Array<{ id: string, data: any }> = [];
      const semesterIdMap: Record<string, string> = {}; // oldSemId -> uniqueSemId

      for (const sem of semestersCol) {
        const semName = (sem.data?.name || '').trim().toLowerCase();
        const semNum = Number(sem.data?.number);
        // Look for an existing semester in our unique list
        const existingSem = uniqueSemesters.find(s => 
          (s.data?.name || '').trim().toLowerCase() === semName || 
          Number(s.data?.number) === semNum
        );

        if (existingSem) {
          semesterIdMap[sem.id] = existingSem.id;
        } else {
          uniqueSemesters.push(sem);
          semesterIdMap[sem.id] = sem.id;
        }
      }

      // 2. Unified and deduplicated Subjects
      const uniqueSubjects: Array<{ id: string, data: any }> = [];
      const subjectIdMap: Record<string, string> = {}; // oldSubId -> uniqueSubId

      for (const sub of subjectsCol) {
        // Map its semesterId
        const oldSemId = sub.data?.semesterId;
        const mappedSemId = semesterIdMap[oldSemId] || oldSemId;
        if (sub.data) {
          sub.data.semesterId = mappedSemId;
        }

        const subName = (sub.data?.name || '').trim().toLowerCase();
        // Look for an existing subject in our unique list with same name and mapped semesterId
        const existingSub = uniqueSubjects.find(s => 
          (s.data?.name || '').trim().toLowerCase() === subName && 
          s.data?.semesterId === mappedSemId
        );

        if (existingSub) {
          subjectIdMap[sub.id] = existingSub.id;
        } else {
          uniqueSubjects.push(sub);
          subjectIdMap[sub.id] = sub.id;
        }
      }

      // 3. Map Topics
      const resolvedTopics: Array<{ id: string, data: any }> = [];
      const topicIdMap: Record<string, string> = {}; // oldTopicId -> uniqueTopicId

      for (const top of topicsCol) {
        if (top.data) {
          // Map its subjectId
          const oldSubId = top.data.subjectId;
          const mappedSubId = subjectIdMap[oldSubId] || oldSubId;
          top.data.subjectId = mappedSubId;

          // Map its semesterId
          if (top.data.semesterId) {
            top.data.semesterId = semesterIdMap[top.data.semesterId] || top.data.semesterId;
          }
        }
        
        // Deduplicate topics if they have the exact same title and subjectId
        const topTitle = (top.data?.title || '').trim().toLowerCase();
        const existingTop = resolvedTopics.find(t => 
          (t.data?.title || '').trim().toLowerCase() === topTitle && 
          t.data?.subjectId === top.data?.subjectId
        );

        if (existingTop) {
          topicIdMap[top.id] = existingTop.id;
        } else {
          resolvedTopics.push(top);
          topicIdMap[top.id] = top.id;
        }
      }

      // 4. Map Questions
      const resolvedQuestions = questionsCol.map(q => {
        if (q.data) {
          if (q.data.subjectId) {
            q.data.subjectId = subjectIdMap[q.data.subjectId] || q.data.subjectId;
          }
          if (q.data.topicId) {
            q.data.topicId = topicIdMap[q.data.topicId] || q.data.topicId;
          }
        }
        return q;
      });

      // 5. Map Flashcards
      const resolvedFlashcards = flashcardsCol.map(f => {
        if (f.data) {
          if (f.data.subjectId) {
            f.data.subjectId = subjectIdMap[f.data.subjectId] || f.data.subjectId;
          }
          if (f.data.topicId) {
            f.data.topicId = topicIdMap[f.data.topicId] || f.data.topicId;
          }
        }
        return f;
      });

      const totalDocs = uniqueSemesters.length + uniqueSubjects.length + resolvedTopics.length + resolvedQuestions.length + resolvedFlashcards.length;
      
      setMigrationMessage(`Extração concluída! Encontrados ${totalDocs} registros totais. Iniciando mesclagem segura no Supabase (apenas adicionando/atualizando excedentes sem apagar nada)...`);
      
      let countSuccess = 0;
      const saveToSupabase = async (collectionName: string, id: string, data: any) => {
        const { error } = await supabase
          .from('firestore_documents')
          .upsert({
            collection: collectionName,
            id: id,
            data: data,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'collection,id'
          });
        if (error) {
          console.error(`Erro ao salvar no Supabase [${collectionName}/${id}]:`, error.message);
        } else {
          countSuccess++;
          setMigrationMessage(`Migrando para o Supabase: ${countSuccess}/${totalDocs} documentos salvos...`);
        }
      };
      
      // Salvar todos os semestres
      for (const sem of uniqueSemesters) {
        await saveToSupabase('semesters', sem.id, sem.data);
      }
      
      // Salvar todas as matérias
      for (const sub of uniqueSubjects) {
        await saveToSupabase('subjects', sub.id, sub.data);
      }
      
      // Salvar todos os tópicos
      for (const top of resolvedTopics) {
        await saveToSupabase('topics', top.id, top.data);
      }
      
      // Salvar todas as questões
      for (const q of resolvedQuestions) {
        await saveToSupabase('questions', q.id, q.data);
      }
      
      // Salvar todos os flashcards
      for (const f of resolvedFlashcards) {
        await saveToSupabase('flashcards', f.id, f.data);
      }
      
      // Limpar todos os caches locais para forçar o download dos novos dados migrados do Supabase
      if (typeof window !== 'undefined' && window.localStorage) {
        const storage = window.localStorage;
        Object.keys(storage).forEach(k => {
          if (
            k.startsWith('local_cache_') || 
            k.startsWith('cache_') || 
            k.includes('_cache_') || 
            k === 'cache_subjects' ||
            k === 'cache_semesters' ||
            k === 'cache_total_topics' ||
            k === 'cache_topics_initial'
          ) {
            storage.removeItem(k);
          }
        });
      }
      
      setMigrationMessage(`MIGRAÇÃO DE SUCESSO! ${countSuccess} de ${totalDocs} documentos foram importados perfeitamente para o seu Supabase atual (incluindo todos os semestres, matérias e tópicos cadastrados)!`);
      alert('Seus dados de todos os semestres, matérias e tópicos cadastrados foram migrados com sucesso do Firebase para o Supabase! O aplicativo será recarregado automaticamente agora para aplicar as alterações.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setMigrationMessage(`Erro durante a migração: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-10 min-h-screen pb-16 bg-[#FDFDFD]">
      <AnimatePresence>
        {showOverwriteConfirm && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full"
            >
              <Card className="p-6 space-y-5 bg-white rounded-2xl shadow-xl border border-[#E2E0D9]">
                <div className="flex items-center gap-2.5 text-amber-600">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <CardTitle className="text-base font-black text-neutral-900">Confirmar Sobrescrita</CardTitle>
                </div>
                <p className="text-xs text-[#8E8A82] leading-relaxed">
                  Este tópico já contém um resumo estruturado. Gerar novamente com Inteligência Artificial irá substituir o texto atual e consumir sua cota. Deseja prosseguir com a alteração?
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 text-[10px] uppercase tracking-widest font-black h-10 rounded-xl" onClick={() => setShowOverwriteConfirm(false)}>Cancelar</Button>
                  <Button 
                    className="flex-1 bg-neutral-900 hover:bg-black text-white text-[10px] uppercase tracking-widest font-black h-10 rounded-xl transition-all" 
                    onClick={() => handleGenerateAI(true)}
                  >
                    Sim, Substituir
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full"
            >
              <Card className="p-6 space-y-5 bg-white rounded-2xl shadow-xl border border-[#E2E0D9]">
                <div className="flex items-center gap-2.5 text-red-600">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <CardTitle className="text-base font-black text-neutral-900">Confirmar Exclusão</CardTitle>
                </div>
                <p className="text-xs text-[#8E8A82] leading-relaxed">
                  {confirmDelete.type === 'semester' && 'Excluir este semestre acadêmico? Isso removerá a ordenação estrutural, embora as matérias vinculadas permaneçam intactas.'}
                  {confirmDelete.type === 'subject' && 'Excluir esta matéria médica? Esta alteração é permanente e desvinculará todos os tópicos de estudo relacionados.'}
                  {confirmDelete.type === 'topic' && 'Deseja excluir este tópico teórico permanentemente? O resumo clínico e as referências associadas serão perdidos.'}
                  {confirmDelete.type === 'content' && 'Deseja limpar o resumo clínico deste tópico? O conteúdo textual será redefinido para o padrão em desenvolvimento.'}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 text-[10px] uppercase tracking-widest font-black h-10 rounded-xl" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 text-[10px] uppercase tracking-widest font-black h-10 rounded-xl transition-all font-bold" 
                    onClick={() => {
                      if (confirmDelete.type === 'semester') handleDeleteSemester(confirmDelete.id);
                      if (confirmDelete.type === 'subject') handleDeleteSubject(confirmDelete.id);
                      if (confirmDelete.type === 'topic') handleDeleteTopic(confirmDelete.id);
                      if (confirmDelete.type === 'content') handleDeleteContent(confirmDelete.id);
                    }}
                  >
                    Confirmar Exclusão
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto w-full px-4 pt-10 space-y-8 animate-fade-in">
        {/* Main Header Display Section */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto mb-4 select-none">
          <span className="text-[9px] uppercase tracking-widest text-[#8E8A82] font-mono bg-[#F0EEE9] px-3.5 py-1 rounded-full font-black border border-[#E2E0D9]/30">
            {isAdmin ? 'Painel Administrativo' : 'Painel de Controle'}
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900 tracking-tight">
            Gestão MedInternato
          </h2>
          <p className="text-[#8E8A82] text-sm leading-relaxed font-medium">
            {isAdmin 
              ? "Gerenciamento global de ciclos, ementas de disciplinas, banco de questões comentadas e liberação de acessos premium aos alunos."
              : "Gerenciamento pessoal de semestres, disciplinas, tópicos de estudo e banco de questões comentadas."}
          </p>
        </div>

        {/* Sync & Dev Tools Block - ONLY for actual admins */}
        {isAdmin && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto p-4 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl shadow-xs">
            <div className="flex items-center gap-3 text-xs text-neutral-700 font-medium select-none">
              <div className="p-2 bg-neutral-900 rounded-lg text-white">
                <Database className="w-4 h-4 shrink-0" />
              </div>
              <div>
                <p className="font-bold text-neutral-900">Sincronização de Banco de Dados</p>
                <p className="text-[10px] text-[#8E8A82]">Utilize para redefinir as cargas iniciais de dados.</p>
              </div>
            </div>
            
            <div className="flex gap-2.5 w-full md:w-auto shrink-0">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleSeed}
                disabled={isSeeding}
                className="flex-1 md:flex-initial text-[9px] uppercase tracking-widest font-black border-[#E2E0D9] hover:bg-neutral-100 hover:text-neutral-900 transition-all cursor-pointer h-9 px-4 rounded-xl"
              >
                {isSeeding ? 'Sincronizando...' : 'Recarregar Seed'}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleAuthAndMigrate}
                disabled={isMigrating}
                className="flex-1 md:flex-initial text-[9px] uppercase tracking-widest font-black text-neutral-900 border-neutral-900/25 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer h-9 px-4 rounded-xl"
              >
                {isMigrating ? 'Migrando...' : 'Migrar Supabase'}
              </Button>
            </div>
            
            {(seedMessage || migrationMessage) && (
              <div className="w-full text-center text-[10px] font-mono text-neutral-900 font-black bg-white border border-[#E2E0D9] p-3 rounded-xl mt-2 animate-pulse">
                {seedMessage || migrationMessage}
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Centered Premium Tabs Switcher */}
          <div className="flex justify-center mb-8">
            <TabsList className="w-full max-w-7xl h-12 flex bg-[#F0EEE9]/75 p-1 rounded-xl gap-1 border border-[#E2E0D9]/50 shadow-xs select-none">
              {isAdmin && (
                <TabsTrigger 
                  value="dashboard" 
                  className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" /> Painel Geral
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="semesters" 
                className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
              >
                <Calendar className="w-4 h-4 shrink-0" /> Semestres
              </TabsTrigger>
              <TabsTrigger 
                value="subjects" 
                className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
              >
                <Book className="w-4 h-4 shrink-0" /> Matérias
              </TabsTrigger>
              <TabsTrigger 
                value="topics" 
                className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
              >
                <Plus className="w-4 h-4 shrink-0" /> Tópicos
              </TabsTrigger>
              <TabsTrigger 
                value="questions" 
                className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
              >
                <HelpCircle className="w-4 h-4 shrink-0" /> Questões
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger 
                    value="moderation" 
                    className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0" /> Moderação (Pro)
                  </TabsTrigger>
                  <TabsTrigger 
                    value="referrals" 
                    className="flex-1 flex items-center justify-center gap-2 text-[9.5px] md:text-[10px] uppercase tracking-widest font-black rounded-lg text-[#8E8A82] data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm transition-all cursor-pointer hover:text-neutral-950"
                  >
                    <Users className="w-4 h-4 shrink-0" /> Indicações
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {isAdmin && (
            <TabsContent value="dashboard" className="focus-visible:outline-none">
              <AdminDashboard
                semesters={semesters}
                subjects={subjects}
                topics={topics}
                recentUsers={recentUsers}
                setActiveTab={setActiveTab}
                handleToggleUserPremium={handleToggleUserPremium}
                updatingUser={updatingUser}
              />
            </TabsContent>
          )}

          <TabsContent value="semesters" className="focus-visible:outline-none">
            <SemesterManager
              semesters={semesters}
              subjects={subjects}
              editingSemesterId={editingSemesterId}
              setEditingSemesterId={setEditingSemesterId}
              newSemester={newSemester}
              setNewSemester={setNewSemester}
              handleAddSemester={handleAddSemester}
              setConfirmDelete={setConfirmDelete}
            />
          </TabsContent>

          <TabsContent value="subjects" className="focus-visible:outline-none">
            <SubjectManager
              subjects={subjects}
              semesters={semesters}
              topics={topics}
              editingSubjectId={editingSubjectId}
              setEditingSubjectId={setEditingSubjectId}
              newSubject={newSubject}
              setNewSubject={setNewSubject}
              handleAddSubject={handleAddSubject}
              setConfirmDelete={setConfirmDelete}
              subjectSearch={subjectSearch}
              setSubjectSearch={setSubjectSearch}
            />
          </TabsContent>

          <TabsContent value="topics" className="focus-visible:outline-none">
            <TopicManager
              topics={topics}
              subjects={subjects}
              semesters={semesters}
              editingTopicId={editingTopicId}
              setEditingTopicId={setEditingTopicId}
              newTopic={newTopic}
              setNewTopic={setNewTopic}
              handleAddTopic={handleAddTopic}
              setConfirmDelete={setConfirmDelete}
              topicSearch={topicSearch}
              setTopicSearch={setTopicSearch}
              handleGenerateAI={handleGenerateAI}
              isGenerating={isGenerating}
            />
          </TabsContent>

          <TabsContent value="questions" className="focus-visible:outline-none">
            <QuestionManager
              topics={topics}
              adminQuestions={adminQuestions}
              loadingQuestions={loadingQuestions}
              newQuestion={newQuestion}
              setNewQuestion={setNewQuestion}
              handleAddQuestion={handleAddQuestion}
              selectedTopicForManage={selectedTopicForManage}
              setSelectedTopicForManage={setSelectedTopicForManage}
              handleDeleteAdminQuestion={handleDeleteAdminQuestion}
              questionsSubTab={questionsSubTab}
              setQuestionsSubTab={setQuestionsSubTab}
            />
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="moderation" className="focus-visible:outline-none">
                <ModerationManager
                  searchEmail={searchEmail}
                  setSearchEmail={setSearchEmail}
                  isSearchingUser={isSearchingUser}
                  userSearchError={userSearchError}
                  foundUser={foundUser}
                  updatingUser={updatingUser}
                  handleSearchUser={handleSearchUser}
                  handleToggleUserPremium={handleToggleUserPremium}
                  handleChangeUserPlan={handleChangeUserPlan}
                  recentUsers={recentUsers}
                />
              </TabsContent>
              <TabsContent value="referrals" className="focus-visible:outline-none">
                <ReferralLogsManager />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
