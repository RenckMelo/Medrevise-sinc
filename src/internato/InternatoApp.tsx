import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../firebase';
import { 
  auth,
  db, 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc
} from './firebase';
import { Subject, Topic, UserProgress, Semester } from './types';
import { getGlobalUsage } from './services/geminiService';

// Components
import Dashboard from './components/Dashboard';
import Cronograma from './components/Cronograma';
import SubjectList from './components/SubjectList';
import TopicDetail from './components/TopicDetail';
import QuestionModule from './components/QuestionModule';
import FlashcardModule from './components/FlashcardModule';
import AdminPanel from './components/AdminPanel';
import QuestionReview from './components/QuestionReview';
import OnboardingTour from './components/OnboardingTour';
import AiProviderStatusModal from './components/AiProviderStatusModal';
import FloatingPreceptorChat from './components/FloatingPreceptorChat';
import SuggestionsBox from './components/SuggestionsBox';
import FaqModal from '../components/FaqModal';

import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Brain, 
  HelpCircle, 
  Shield, 
  ArrowLeftRight,
  LogOut,
  Sparkles,
  Award,
  Cpu,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InternatoAppProps {
  onToggleAppMode?: () => void;
}

export default function InternatoApp({ onToggleAppMode }: InternatoAppProps) {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';

  const [currentView, setCurrentView] = useState<'dashboard' | 'cronograma' | 'subjects' | 'topicDetail' | 'questions' | 'flashcards' | 'admin' | 'review'>('dashboard');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedQuestionAttempt, setSelectedQuestionAttempt] = useState<any>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);

  // Cronograma parameters for QuestionModule
  const [cronogramaFilterTopics, setCronogramaFilterTopics] = useState<string[]>([]);
  const [cronogramaQuestionsCount, setCronogramaQuestionsCount] = useState<number>(30);
  const [cronogramaMode, setCronogramaMode] = useState<'study' | 'exam'>('study');
  const [availableCredits, setAvailableCredits] = useState<number>(100);

  // Tour, Provider Modal, FAQ Modal and Suggestions Box
  const [showTour, setShowTour] = useState(false);
  const [showProviderStatusModal, setShowProviderStatusModal] = useState(false);
  const [showSuggestionsBox, setShowSuggestionsBox] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);

  const isSpecialUser = user?.email?.toLowerCase() === 'lucas1renck2melo@gmail.com' || user?.email?.toLowerCase() === 'ysabelleosaraiva@gmail.com' || user?.email?.toLowerCase() === 'yasabelleosaraiva@gmail.com';

  // Load real available AI credits
  useEffect(() => {
    const loadCredits = async () => {
      try {
        const usage = await getGlobalUsage();
        const available = Math.max(0, usage.limit - usage.count);
        setAvailableCredits(available);
      } catch (err) {
        console.warn('Error loading credits in InternatoApp:', err);
      }
    };
    loadCredits();

    const handleCreditsUpdated = () => {
      loadCredits();
    };
    window.addEventListener('ai-credits-updated', handleCreditsUpdated);

    const interval = setInterval(loadCredits, 20000);
    return () => {
      window.removeEventListener('ai-credits-updated', handleCreditsUpdated);
      clearInterval(interval);
    };
  }, [user]);

  // Listen to subjects
  useEffect(() => {
    if (!userId) return;
    const subColRef = collection(db, 'users', userId, 'subjects');
    const unsub = onSnapshot(subColRef, (snapshot) => {
      const list: Subject[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Subject);
      });
      setSubjects(list);
    }, (err) => {
      console.warn('Error listening to subjects:', err);
    });
    return () => unsub();
  }, [userId]);

  // Listen to topics
  useEffect(() => {
    if (!userId) return;
    const topColRef = collection(db, 'users', userId, 'topics');
    const unsub = onSnapshot(topColRef, (snapshot) => {
      const list: Topic[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Topic);
      });
      setTopics(list);
    }, (err) => {
      console.warn('Error listening to topics:', err);
    });
    return () => unsub();
  }, [userId]);

  // Listen to semesters
  useEffect(() => {
    if (!userId) return;
    const semColRef = collection(db, 'users', userId, 'semesters');
    const unsub = onSnapshot(semColRef, (snapshot) => {
      const list: Semester[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Semester);
      });
      // Sort semesters by number
      list.sort((a, b) => (a.number || 0) - (b.number || 0));
      setSemesters(list);
    }, (err) => {
      console.warn('Error listening to semesters:', err);
    });
    return () => unsub();
  }, [userId]);

  // Listen to user progress
  useEffect(() => {
    if (!userId) return;
    const progressRef = doc(db, 'users', userId, 'progress', 'main');
    const unsub = onSnapshot(progressRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() || {};
        setUserProgress({
          ...data,
          userId: userId,
          completedTopicIds: Array.isArray(data.completedTopicIds) ? data.completedTopicIds : [],
          answeredQuestionIds: Array.isArray(data.answeredQuestionIds) ? data.answeredQuestionIds : [],
          correctQuestionIds: Array.isArray(data.correctQuestionIds) ? data.correctQuestionIds : [],
          flaggedQuestionIds: Array.isArray(data.flaggedQuestionIds) ? data.flaggedQuestionIds : [],
          flashcardReviews: data.flashcardReviews && typeof data.flashcardReviews === 'object' ? data.flashcardReviews : {},
          quizHistory: Array.isArray(data.quizHistory) ? data.quizHistory : [],
          studySessions: Array.isArray(data.studySessions) ? data.studySessions : [],
          attempts: data.attempts && typeof data.attempts === 'object' ? data.attempts : {},
        } as UserProgress);
      } else {
        setUserProgress({
          userId: userId,
          completedTopicIds: [],
          answeredQuestionIds: [],
          correctQuestionIds: [],
          flaggedQuestionIds: [],
          flashcardReviews: {},
          quizHistory: [],
          studySessions: [],
          attempts: {}
        });
      }
    }, (err) => {
      console.warn('Error listening to user progress:', err);
    });
    return () => unsub();
  }, [userId]);

  const loadUserProgress = async () => {
    if (!userId) return;
    try {
      const progressRef = doc(db, 'users', userId, 'progress', 'main');
      const snapshot = await getDoc(progressRef);
      if (snapshot.exists()) {
        const data = snapshot.data() || {};
        setUserProgress({
          ...data,
          userId: userId,
          completedTopicIds: Array.isArray(data.completedTopicIds) ? data.completedTopicIds : [],
          answeredQuestionIds: Array.isArray(data.answeredQuestionIds) ? data.answeredQuestionIds : [],
          correctQuestionIds: Array.isArray(data.correctQuestionIds) ? data.correctQuestionIds : [],
          flaggedQuestionIds: Array.isArray(data.flaggedQuestionIds) ? data.flaggedQuestionIds : [],
          flashcardReviews: data.flashcardReviews && typeof data.flashcardReviews === 'object' ? data.flashcardReviews : {},
          quizHistory: Array.isArray(data.quizHistory) ? data.quizHistory : [],
          studySessions: Array.isArray(data.studySessions) ? data.studySessions : [],
          attempts: data.attempts && typeof data.attempts === 'object' ? data.attempts : {},
        } as UserProgress);
      }
    } catch (err) {
      console.warn('Error loading user progress:', err);
    }
  };

  // Reset scroll to top on any view transit
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    const scrollContainers = document.querySelectorAll('main, .overflow-y-auto');
    scrollContainers.forEach(container => {
      container.scrollTop = 0;
    });
  }, [currentView]);

  const handleAddSubject = async (name: string, semesterId: string) => {
    if (!userId || !name.trim()) return;
    const newSubject = {
      name: name.trim(),
      semesterId: semesterId || 'sem_9',
      color: '#D44E3D',
      icon: 'BookOpen',
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'users', userId, 'subjects'), newSubject);
    return { id: docRef.id, ...newSubject };
  };

  const handleUpdateSubject = async (subjectId: string, name: string, semesterId: string) => {
    if (!userId || !subjectId) return;
    try {
      await updateDoc(doc(db, 'users', userId, 'subjects', subjectId), {
        name: name.trim(),
        semesterId,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      try {
        await setDoc(doc(db, 'users', userId, 'subjects', subjectId), {
          name: name.trim(),
          semesterId,
          color: '#D44E3D',
          icon: 'BookOpen',
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error('Error updating subject:', e);
      }
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!userId || !subjectId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'subjects', subjectId));
    } catch (err) {
      console.error('Error deleting subject:', err);
    }
  };

  const handleCreateSemester = async (number: number, name: string) => {
    if (!userId) return;
    const newSem = {
      number,
      name: name.trim() || `${number}º Semestre`,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'users', userId, 'semesters'), newSem);
    return { id: docRef.id, ...newSem };
  };

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setCurrentView('topicDetail');
  };

  const handleSelectSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setCurrentView('subjects');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="h-full bg-[#F4F3EF] flex flex-col text-[#1A1A1A] overflow-hidden">
      {/* Header / Navigation */}
      <header className="bg-white border-b border-[#E2E0D9] shrink-0 sticky top-0 z-30 px-2.5 sm:px-6 py-2 sm:py-3 flex items-center justify-between shadow-sm gap-2 sm:gap-4 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#D44E3D] to-amber-600 flex items-center justify-center text-white font-black text-xs sm:text-lg shadow-sm shrink-0">
            M
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-xs sm:text-base text-[#1A1A1A] tracking-tight leading-none flex items-center gap-1 sm:gap-2 truncate">
              <span className="truncate">MedInternato</span>
              <span className="hidden sm:inline-block text-[8px] sm:text-[10px] bg-[#D44E3D]/10 text-[#D44E3D] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                Resi
              </span>
            </h1>
            <p className="hidden sm:block text-[11px] text-[#8E8A82] font-medium mt-0.5 truncate">
              Plataforma Médica de Alto Desempenho
            </p>
          </div>
        </div>

        {/* Navigation Tabs for Desktop (2xl+) */}
        <nav className="hidden 2xl:flex items-center gap-1 bg-[#F4F3EF] p-1 rounded-xl border border-[#E2E0D9] shrink-0">
          <button
            onClick={() => setCurrentView('cronograma')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              currentView === 'cronograma' 
                ? 'bg-white text-[#D44E3D] shadow-sm' 
                : 'text-[#6E6A62] hover:text-[#1A1A1A]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Planejamento</span>
          </button>

          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              currentView === 'dashboard' 
                ? 'bg-white text-[#D44E3D] shadow-sm' 
                : 'text-[#6E6A62] hover:text-[#1A1A1A]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Painel</span>
          </button>

          <button
            onClick={() => setCurrentView('subjects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              currentView === 'subjects' || currentView === 'topicDetail'
                ? 'bg-white text-[#D44E3D] shadow-sm' 
                : 'text-[#6E6A62] hover:text-[#1A1A1A]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Especialidades</span>
          </button>

          <button
            onClick={() => {
              setCronogramaFilterTopics([]);
              setCronogramaMode('study');
              setCurrentView('questions');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              currentView === 'questions' 
                ? 'bg-white text-[#D44E3D] shadow-sm' 
                : 'text-[#6E6A62] hover:text-[#1A1A1A]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Questões</span>
          </button>

          <button
            onClick={() => setCurrentView('flashcards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              currentView === 'flashcards' 
                ? 'bg-white text-[#D44E3D] shadow-sm' 
                : 'text-[#6E6A62] hover:text-[#1A1A1A]'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Flashcards</span>
          </button>

          {isSpecialUser && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                currentView === 'admin' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-indigo-600 hover:text-indigo-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* AI Credits Badge */}
          <div 
            onClick={() => setShowProviderStatusModal(true)}
            className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/90 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold shadow-xs shrink-0 cursor-pointer hover:bg-amber-100 transition-all"
            title="Clique para ver seus créditos e horário de renovação"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 fill-amber-500 animate-pulse" />
            <span>{availableCredits} cr</span>
          </div>

          {/* AI Provider Status Button for Special User / Admin */}
          {isSpecialUser && (
            <button
              onClick={() => setShowProviderStatusModal(true)}
              className="hidden md:flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all cursor-pointer shadow-xs shrink-0"
              title="Ver status e limites do DeepSeek V3, OpenAI e Gemini"
            >
              <Cpu className="w-3 h-3 text-blue-600 animate-pulse" />
              <span>Provedores IA</span>
            </button>
          )}

          {onToggleAppMode && (
            <Button
              variant="default"
              size="sm"
              onClick={onToggleAppMode}
              className="text-[10px] sm:text-xs font-black text-white bg-[#D44E3D] border-[#D44E3D] hover:bg-[#b83c2c] hover:text-white flex items-center gap-1 cursor-pointer px-2 sm:px-3 py-1 h-7 sm:h-8 rounded-lg shadow-sm shrink-0 transition-colors"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden xs:inline">MedRevise</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-rose-600 border-rose-200 bg-rose-50/80 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 p-1 sm:p-1.5 h-7 sm:h-8 px-2 flex items-center gap-1 rounded-lg shrink-0 font-bold shadow-2xs"
            title="Sair do Sistema"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 pb-28 2xl:pb-8 max-w-7xl w-full mx-auto overflow-x-hidden min-w-0">
        {currentView === 'cronograma' && (
          <Cronograma
            user={user}
            subjects={subjects}
            topics={topics}
            setView={setCurrentView}
            setSelectedTopic={setSelectedTopic}
            setSelectedSubject={setSelectedSubject}
            setCronogramaFilterTopics={setCronogramaFilterTopics}
            setCronogramaQuestionsCount={setCronogramaQuestionsCount}
            setCronogramaMode={setCronogramaMode}
            availableCredits={availableCredits}
            setAvailableCredits={setAvailableCredits}
            setSubjects={setSubjects}
            setTopics={setTopics}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard
            userProgress={userProgress}
            subjects={subjects}
            topics={topics}
            onSelectTopic={handleSelectTopic}
            onSelectQuestion={(attempt) => {
              setSelectedQuestionAttempt(attempt);
              setCurrentView('review');
            }}
            userId={userId}
            onOpenTour={() => setShowTour(true)}
          />
        )}

        {currentView === 'subjects' && (
          <SubjectList
            subjects={subjects}
            semesters={semesters}
            userProgress={userProgress}
            onSelect={handleSelectSubject}
            onSelectTopic={handleSelectTopic}
            selectedSubject={selectedSubject}
            onClearSelectedSubject={() => setSelectedSubject(null)}
            onAddSubject={handleAddSubject}
            onUpdateSubject={handleUpdateSubject}
            onDeleteSubject={handleDeleteSubject}
            onCreateSemester={handleCreateSemester}
            userId={userId}
          />
        )}

        {currentView === 'topicDetail' && selectedTopic && (
          <TopicDetail
            topic={selectedTopic}
            userProgress={userProgress}
            onBack={() => setCurrentView('subjects')}
            onComplete={() => setCurrentView('subjects')}
            subjects={subjects}
            userId={userId}
            userEmail={user?.email || ''}
            onTopicUpdate={(updated) => {
              setSelectedTopic(updated);
              setTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
            }}
            onStartPractice={() => {
              setCronogramaFilterTopics([selectedTopic.id]);
              setCurrentView('questions');
            }}
            onStartFlashcards={() => {
              setCurrentView('flashcards');
            }}
            onToggleAppMode={onToggleAppMode}
            availableCredits={availableCredits}
            setAvailableCredits={setAvailableCredits}
          />
        )}

        {currentView === 'questions' && (
          <QuestionModule
            subjects={subjects}
            topics={topics}
            userProgress={userProgress}
            userId={userId}
            initialTopicIds={cronogramaFilterTopics}
            initialQuestionsCount={cronogramaQuestionsCount}
            initialMode={cronogramaMode}
          />
        )}

        {currentView === 'flashcards' && (
          <FlashcardModule
            subjects={subjects}
            topics={topics}
            userProgress={userProgress}
            userId={userId}
            initialTopicIds={selectedTopic ? [selectedTopic.id] : (cronogramaFilterTopics.length > 0 ? cronogramaFilterTopics : undefined)}
            onProgressUpdate={loadUserProgress}
            availableCredits={availableCredits}
            setAvailableCredits={setAvailableCredits}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel
            subjects={subjects}
            topics={topics}
            semesters={semesters}
            userId={userId}
            isAdmin={true}
          />
        )}

        {currentView === 'review' && selectedQuestionAttempt && (
          <QuestionReview
            attempt={selectedQuestionAttempt}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {/* Bottom Footer Section */}
        <footer className="pt-8 pb-12 mt-12 border-t-2 border-[#141414]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-[#6E6A62] font-mono text-[11px]">
            <span>MedInternato & MedRevise © 2026</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFaqModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-[#D44E3D] border border-rose-200/90 rounded-xl font-mono text-[11px] font-bold cursor-pointer transition-all shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Como Usar & Dúvidas</span>
            </button>

            <button
              onClick={() => setShowSuggestionsBox(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl font-mono text-[11px] font-bold cursor-pointer transition-all shadow-xs"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Dicas & Sugestões</span>
            </button>
          </div>
        </footer>
      </main>

      {/* Onboarding Tour */}
      {showTour && (
        <OnboardingTour
          isOpen={showTour}
          onClose={() => setShowTour(false)}
          activeTab={currentView}
          onSwitchTab={(tab) => {
            if (tab === 'home') setCurrentView('dashboard');
            else if (tab === 'subject') setCurrentView('subjects');
            else if (tab === 'questions') setCurrentView('questions');
            else if (tab === 'flashcards') setCurrentView('flashcards');
            else if (tab === 'cronograma') setCurrentView('cronograma');
            else if (tab === 'admin') setCurrentView('admin');
          }}
        />
      )}

      {/* AI Provider Status / Credits Modal */}
      <AiProviderStatusModal
        isOpen={showProviderStatusModal}
        onClose={() => setShowProviderStatusModal(false)}
        userEmail={user?.email || ''}
      />

      {/* Dicas & Sugestões Box */}
      <SuggestionsBox
        isOpen={showSuggestionsBox}
        onClose={() => setShowSuggestionsBox(false)}
        userEmail={user?.email}
        userId={userId}
      />

      {/* FAQ / Como Usar Pop-up */}
      <FaqModal
        isOpen={showFaqModal}
        onClose={() => setShowFaqModal(false)}
      />

      {/* Floating Preceptor Tira-Dúvidas Chat */}
      <FloatingPreceptorChat 
        availableCredits={availableCredits}
        topics={topics}
        subjects={subjects}
        selectedTopic={currentView === 'topicDetail' ? selectedTopic : null}
        userId={userId}
        onTopicUpdate={(updatedTopic) => {
          if (selectedTopic && selectedTopic.id === updatedTopic.id) {
            setSelectedTopic(updatedTopic);
          }
          setTopics(prev => prev.map(t => t.id === updatedTopic.id ? updatedTopic : t));
        }}
      />

      {/* Mobile & Tablet Bottom Navigation Bar (< 2xl) */}
      <div className="2xl:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E2E0D9] z-50 px-1 sm:px-4 py-1.5 sm:py-2 flex items-center justify-around shadow-xl pb-safe">
        <button
          onClick={() => setCurrentView('cronograma')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
            currentView === 'cronograma' ? 'text-[#D44E3D] font-extrabold' : 'text-[#6E6A62] hover:text-[#1A1A1A]'
          }`}
        >
          <CalendarIcon className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Planejamento</span>
        </button>

        <button
          onClick={() => setCurrentView('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
            currentView === 'dashboard' ? 'text-[#D44E3D] font-extrabold' : 'text-[#6E6A62] hover:text-[#1A1A1A]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Painel</span>
        </button>

        <button
          onClick={() => setCurrentView('subjects')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
            currentView === 'subjects' || currentView === 'topicDetail' ? 'text-[#D44E3D] font-extrabold' : 'text-[#6E6A62] hover:text-[#1A1A1A]'
          }`}
        >
          <BookOpen className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Especialidades</span>
        </button>

        <button
          onClick={() => {
            setCronogramaFilterTopics([]);
            setCronogramaMode('study');
            setCurrentView('questions');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
            currentView === 'questions' ? 'text-[#D44E3D] font-extrabold' : 'text-[#6E6A62] hover:text-[#1A1A1A]'
          }`}
        >
          <HelpCircle className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Questões</span>
        </button>

        <button
          onClick={() => setCurrentView('flashcards')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
            currentView === 'flashcards' ? 'text-[#D44E3D] font-extrabold' : 'text-[#6E6A62] hover:text-[#1A1A1A]'
          }`}
        >
          <Brain className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Cards</span>
        </button>

        {isSpecialUser && (
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all ${
              currentView === 'admin' ? 'text-indigo-700 font-extrabold' : 'text-indigo-500 hover:text-indigo-900'
            }`}
          >
            <Shield className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight">Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
