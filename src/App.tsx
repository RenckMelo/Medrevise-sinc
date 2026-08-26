// MedRevise Core Application - Updated
import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, signInWithPopup, signOut, doc, updateDoc, signInAnonymously } from './firebase';
import InternatoApp from './internato/InternatoApp';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar as CalendarIcon, 
  LogOut, 
  BarChart3, 
  Clock, 
  User as UserIcon, 
  Menu, 
  X as CloseIcon, 
  Award, 
  Shield, 
  Scale,
  Sparkles,
  Link2,
  HelpCircle,
  Lightbulb,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from './contexts/AuthContext';

// Components
import Dashboard from './components/Dashboard';
import SubjectList from './components/SubjectList';
import CalendarView from './components/CalendarView';
import ProfileView from './components/ProfileView';
import CollegeSchedule from './components/CollegeSchedule';
import PerformanceStats from './components/PerformanceStats';
import WeeklyView from './components/WeeklyView';
import ExamsView from './components/ExamsView';
import AdminPanel from './components/AdminPanel';
import LegalTerms from './components/LegalTerms';
import LandingPage from './components/LandingPage';
import OnboardingTour from './components/OnboardingTour';
import SubjectLinkerInterface from './components/SubjectLinkerInterface';
import FaqModal from './components/FaqModal';
import SuggestionsBox from './internato/components/SuggestionsBox';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStudyData } from './hooks/useStudyData';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { user, profile, loading, globalStats } = useAuth();
  const { sessions, subjects, topics, mockExams } = useStudyData();
  
  const isAdmin = user?.email === 'lucas1renck2melo@gmail.com' || 
                  user?.email === 'ysabelleosaraiva@gmail.com' || 
                  user?.email === 'yasabelleosaraiva@gmail.com' || 
                  user?.email === '1111@admin.com' || 
                  profile?.role === 'admin';

  const [appMode, setAppMode] = useState<'revise' | 'internato'>(() => {
    return (localStorage.getItem('app_mode') as 'revise' | 'internato') || 'revise';
  });

  useEffect(() => {
    if (appMode === 'internato') {
      document.body.classList.add('internato-mode');
      document.body.classList.remove('revise-mode');
      document.body.style.backgroundColor = '#E4E3E0';
    } else {
      document.body.classList.add('revise-mode');
      document.body.classList.remove('internato-mode');
      document.body.style.backgroundColor = '#E4E3E0';
    }
  }, [appMode]);

  const totalCombinedQuestions = globalStats.questions + (mockExams || []).reduce((acc, e) => acc + (e.totalQuestions || 0), 0);
  const totalCombinedTime = globalStats.time + (mockExams || []).reduce((acc, e) => acc + (e.timeSpentMinutes || 0), 0);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'calendar' | 'profile' | 'schedule' | 'stats' | 'weekly' | 'exams' | 'admin' | 'terms' | 'linker'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auto-launch tour on first load if not completed
  useEffect(() => {
    if (user && !loading) {
      const tourCompleted = localStorage.getItem('medrevise_tour_completed');
      if (!tourCompleted) {
        setIsTourOpen(true);
      }
    }
  }, [user, loading]);

  // Redirect to Profile page and select plan if clicked from Landing Page
  useEffect(() => {
    if (user && !loading) {
      const targetPlan = localStorage.getItem('redirect_target_plan');
      if (targetPlan) {
        localStorage.removeItem('redirect_target_plan');
        if (!profile?.isPremium) {
          localStorage.setItem('profile_auto_select_plan', targetPlan);
          setActiveTab('profile');
          window.dispatchEvent(new CustomEvent('auto-select-plan', { detail: targetPlan }));
        }
      }
    }
  }, [user, loading, profile]);

  // Listener to start tour manually at any point
  useEffect(() => {
    const handleStartTour = () => {
      setIsTourOpen(true);
    };
    window.addEventListener('start-onboarding-tour', handleStartTour);
    return () => window.removeEventListener('start-onboarding-tour', handleStartTour);
  }, []);

  // Cross-App navigation mode switch listener
  useEffect(() => {
    const handleSwitchMode = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (customEvent.detail && (customEvent.detail === 'revise' || customEvent.detail === 'internato')) {
        setAppMode(customEvent.detail);
        localStorage.setItem('app_mode', customEvent.detail);
      }
    };
    window.addEventListener('switch-mode', handleSwitchMode);
    return () => window.removeEventListener('switch-mode', handleSwitchMode);
  }, []);

  // Tab router for incoming cross-app navigation from Internato to Revise
  useEffect(() => {
    const targetTopicId = localStorage.getItem('cross_app_nav_topic_id');
    const wasFromInternato = localStorage.getItem('was_navigated_from_internato') === 'true';
    if (targetTopicId && wasFromInternato && appMode === 'revise') {
      setActiveTab('subjects');
    }
  }, [appMode]);

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Detect iOS and standalone status
  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
  }, []);

  // Listen to beforeinstallprompt event for PWA installation
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Do not call e.preventDefault() to let standard browser install button appear autonomously in the browser's address bar
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install choice: ${outcome}`);
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    }
  };

  // Set browser tab title
  useEffect(() => {
    document.title = 'MedRevise';
  }, []);

  // Handle Mercado Pago callback status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const sandboxUpgrade = params.get('sandbox_upgrade');
    const uid = params.get('uid');

    if (user && status === 'success') {
      if (sandboxUpgrade && uid === user.uid) {
        const triggerUpgrade = async () => {
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              isPremium: true,
              premiumProvider: 'MercadoPago_Sandbox_Simulator',
              updatedAt: new Date().toISOString()
            });
            alert('Parabéns! Sua assinatura MedRevise Pro foi ativada com sucesso!');
            const cleanPath = window.location.pathname.startsWith('//') ? '/' + window.location.pathname.replace(/^\/+/, '') : window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
            window.location.reload();
          } catch (err) {
            console.error('Sandbox upgrade trigger failure:', err);
          }
        };
        triggerUpgrade();
      } else {
        alert('Pagamento processado! Seu plano MedRevise Pro será ativado em instantes via webhook.');
        const cleanPath = window.location.pathname.startsWith('//') ? '/' + window.location.pathname.replace(/^\/+/, '') : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      }
    } else if (status === 'failure') {
      alert('O pagamento foi recusado ou cancelado no Mercado Pago. Por favor, tente novamente.');
      const cleanPath = window.location.pathname.startsWith('//') ? '/' + window.location.pathname.replace(/^\/+/, '') : window.location.pathname;
      window.history.replaceState({}, document.title, cleanPath);
    }
  }, [user]);

  // Listen for tab switching events (e.g., redirect to checkout)
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, []);

  console.log("App Render - Loading:", loading, "User:", user?.uid);

  const handleLogin = async (targetPlan?: string) => {
    if (targetPlan) {
      localStorage.setItem('redirect_target_plan', targetPlan);
    }
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.warn('Authentication feedback:', error);
      const errorCode = error?.code || '';
      if (errorCode === 'auth/popup-closed-by-user') {
        setLoginError('A janela de autenticação foi fechada antes de concluir o acesso.');
      } else if (errorCode === 'auth/cancelled-popup-request') {
        setLoginError('A requisição do login foi cancelada devido a múltiplas tentativas simultadas.');
      } else if (errorCode === 'auth/network-request-failed') {
        setLoginError('Falha no sinal de rede ou conexão. Verifique sua rota.');
      } else if (errorCode === 'auth/popup-blocked') {
        setLoginError('O pop-up de conexões foi bloqueado pelo seu browser. Por favor, libere pop-ups deste app.');
      } else {
        setLoginError(error?.message || 'Erro inesperado na sincronização ou autenticação.');
      }
    }
  };

  const handleGuestLogin = async () => {
    setLoginError(null);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.warn('Authentication feedback (guest):', error);
      setLoginError(error?.message || 'Erro inesperado na autenticação de visitante.');
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="font-mono text-sm animate-pulse">CARREGANDO SISTEMA...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage 
        onLogin={handleLogin} 
        loginError={loginError} 
        onClearError={() => setLoginError(null)} 
      />
    );
  }

  if (appMode === 'internato') {
    return (
      <ErrorBoundary>
        <InternatoApp onToggleAppMode={() => {
          setAppMode('revise');
          localStorage.setItem('app_mode', 'revise');
        }} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-full bg-[#E4E3E0] flex text-[#141414] relative overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-[#141414]/40 backdrop-blur-sm z-40 2xl:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-[#141414] flex flex-col bg-white transition-transform duration-300 2xl:relative 2xl:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-[#141414] flex items-center justify-between">
          <div>
            <h2 className="font-serif italic text-2xl">MedRevise</h2>
            <p className="text-[10px] font-mono opacity-50 uppercase mt-1">v1.0.0-stable</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="2xl:hidden p-2">
            <CloseIcon size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            icon={<LayoutDashboard size={18} />}
            label="DASHBOARD"
          />
          <NavButton 
            active={activeTab === 'subjects'} 
            onClick={() => { setActiveTab('subjects'); setIsSidebarOpen(false); }}
            icon={<BookOpen size={18} />}
            label="MATÉRIAS"
          />
          <NavButton 
            active={activeTab === 'linker'} 
            onClick={() => { setActiveTab('linker'); setIsSidebarOpen(false); }}
            icon={<Link2 size={18} className="text-emerald-600" />}
            label="VÍNCULO & INTEGRAÇÃO"
          />
          <NavButton 
            active={activeTab === 'calendar'} 
            onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); }}
            icon={<CalendarIcon size={18} />}
            label="CALENDÁRIO"
          />
          <NavButton 
            active={activeTab === 'weekly'} 
            onClick={() => { setActiveTab('weekly'); setIsSidebarOpen(false); }}
            icon={<Clock size={18} />}
            label="SEMANAL"
          />
          <NavButton 
            active={activeTab === 'exams'} 
            onClick={() => { setActiveTab('exams'); setIsSidebarOpen(false); }}
            icon={<Award size={18} />}
            label="SIMULADOS"
          />
          <NavButton 
            active={activeTab === 'schedule'} 
            onClick={() => { setActiveTab('schedule'); setIsSidebarOpen(false); }}
            icon={<LayoutDashboard size={18} />}
            label="FACULDADE"
          />
          <NavButton 
            active={activeTab === 'stats'} 
            onClick={() => { setActiveTab('stats'); setIsSidebarOpen(false); }}
            icon={<BarChart3 size={18} />}
            label="DESEMPENHO"
          />
          <NavButton 
            active={activeTab === 'profile'} 
            onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
            icon={<UserIcon size={18} />}
            label="PERFIL"
          />
          {isAdmin && (
            <NavButton 
              active={activeTab === 'admin'} 
              onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }}
              icon={<Shield size={18} className="text-indigo-600" />}
              label="ADMIN PANEL"
            />
          )}
          <NavButton 
            active={activeTab === 'terms'} 
            onClick={() => { setActiveTab('terms'); setIsSidebarOpen(false); }}
            icon={<Scale size={18} />}
            label="AVISOS LEGAIS"
          />
          <button
            onClick={() => { setIsFaqModalOpen(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 p-3 text-[11px] font-mono transition-all border border-dashed border-[#D44E3D]/50 bg-rose-50/50 hover:bg-rose-100/80 text-[#D44E3D] font-bold cursor-pointer rounded-lg mt-2"
          >
            <HelpCircle size={18} className="text-[#D44E3D] shrink-0" />
            <span className="tracking-widest">COMO USAR & DÚVIDAS</span>
          </button>

          <button
            onClick={() => { setIsSuggestionsOpen(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 p-3 text-[11px] font-mono transition-all border border-dashed border-amber-500/50 bg-amber-50/50 hover:bg-amber-100/80 text-amber-900 font-bold cursor-pointer rounded-lg mt-1"
          >
            <Lightbulb size={18} className="text-amber-600 fill-amber-500 shrink-0" />
            <span className="tracking-widest">DICAS & SUGESTÕES</span>
          </button>
        </nav>

        <div className="p-4 border-t border-[#141414]">
          <div className="flex items-center gap-3 mb-4 p-2 cursor-pointer hover:bg-[#141414]/5 transition-colors" onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-[#141414]" />
            ) : (
              <div className="w-8 h-8 rounded-full border border-[#141414] bg-neutral-100 flex items-center justify-center text-[10px] font-bold">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user.displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className={`px-1 py-0.5 text-[7px] font-mono font-bold leading-none uppercase border shrink-0 ${
                  profile?.isPremium || isAdmin
                    ? 'bg-yellow-50 border-yellow-250 text-yellow-800'
                    : 'bg-neutral-50 border-neutral-250 text-neutral-450'
                }`}>
                  {profile?.isPremium || isAdmin ? '★ PRO' : 'FREE'}
                </span>
                <p className="text-[10px] opacity-50 truncate font-mono">{user.email}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-2 text-[10px] font-mono hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-pointer border border-transparent"
          >
            <LogOut size={14} />
            SAIR DO SISTEMA
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full min-w-0">
        <header className="h-16 border-b border-[#141414] bg-white flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 border border-[#141414]">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest hidden sm:inline">SESSÃO ATIVA:</span>
              <span className="text-[10px] font-mono font-bold uppercase">{activeTab}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 sm:gap-4 mr-1" title="Total Acumulado de Estudos + Simulados">
              <StatItem 
                icon={<BarChart3 size={14} />} 
                label="QUESTÕES" 
                value={totalCombinedQuestions >= 1000 ? `${(totalCombinedQuestions / 1000).toFixed(1)}k` : totalCombinedQuestions.toString()} 
              />
              <StatItem 
                icon={<Clock size={14} />} 
                label="TEMPO" 
                value={`${Math.floor(totalCombinedTime / 60)}h`} 
              />
            </div>
            <button 
              onClick={() => {
                setAppMode('internato');
                localStorage.setItem('app_mode', 'internato');
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all text-[10px] sm:text-[11px] font-mono font-bold tracking-wider cursor-pointer shrink-0 rounded-md"
            >
              <ArrowLeftRight size={12} />
              <span className="hidden xs:inline">INTERNATO</span>
              <span className="xs:hidden">INT</span>
            </button>
            <button 
              onClick={handleLogout}
              className="p-1.5 border border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-[10px] font-mono font-bold cursor-pointer shrink-0 rounded-md flex items-center gap-1"
              title="Sair do Sistema"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">SAIR</span>
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 pb-28 2xl:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'subjects' && <SubjectList onSwitchMode={setAppMode} />}
              {activeTab === 'calendar' && <CalendarView />}
              {activeTab === 'weekly' && <WeeklyView />}
              {activeTab === 'exams' && <ExamsView />}
              {activeTab === 'schedule' && <CollegeSchedule />}
              {activeTab === 'stats' && <PerformanceStats sessions={sessions} subjects={subjects} mockExams={mockExams} />}
              {activeTab === 'profile' && <ProfileView />}
              {activeTab === 'admin' && isAdmin && <AdminPanel />}
              {activeTab === 'terms' && <LegalTerms />}
              {activeTab === 'linker' && <SubjectLinkerInterface onSwitchMode={setAppMode} />}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Footer Section */}
          <footer className="mt-12 pt-6 pb-4 border-t-2 border-[#141414]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 font-mono text-stone-500 text-[11px]">
              <span>MedRevise & MedInternato © 2026</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsFaqModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-[#D44E3D] border border-rose-200/90 rounded-xl font-mono text-[11px] font-bold cursor-pointer transition-all shadow-xs"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Como Usar & Dúvidas</span>
              </button>

              <button
                onClick={() => setIsSuggestionsOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl font-mono text-[11px] font-bold cursor-pointer transition-all shadow-xs"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>Dicas & Sugestões</span>
              </button>
            </div>
          </footer>
        </div>
      </main>

      <OnboardingTour 
        isOpen={isTourOpen} 
        onClose={() => setIsTourOpen(false)} 
        activeTab={activeTab} 
        onSwitchTab={(tab) => setActiveTab(tab)} 
      />

      <FaqModal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
      />

      <SuggestionsBox
        isOpen={isSuggestionsOpen}
        onClose={() => setIsSuggestionsOpen(false)}
        userEmail={user?.email}
        userId={user?.uid}
      />

      {/* Mobile & Tablet Bottom Navigation Bar (< 2xl) */}
      <div className="2xl:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#141414] z-50 px-1 sm:px-4 py-1.5 sm:py-2 flex items-center justify-around shadow-xl pb-safe">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono",
            activeTab === 'dashboard' ? "text-[#141414] font-bold" : "text-stone-500 hover:text-[#141414]"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Painel</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono",
            activeTab === 'subjects' ? "text-[#141414] font-bold" : "text-stone-500 hover:text-[#141414]"
          )}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Matérias</span>
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono",
            activeTab === 'exams' ? "text-[#141414] font-bold" : "text-stone-500 hover:text-[#141414]"
          )}
        >
          <Award className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Simulados</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono",
            activeTab === 'calendar' ? "text-[#141414] font-bold" : "text-stone-500 hover:text-[#141414]"
          )}
        >
          <CalendarIcon className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Agenda</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono",
            activeTab === 'stats' ? "text-[#141414] font-bold" : "text-stone-500 hover:text-[#141414]"
          )}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Métricas</span>
        </button>

        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-lg transition-all font-mono text-stone-500 hover:text-[#141414]"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] sm:text-[11px] font-bold mt-0.5 tracking-tight uppercase">Menu</span>
        </button>
      </div>
    </div>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 text-[11px] font-mono transition-all border border-transparent cursor-pointer",
        active 
          ? "bg-[#141414] text-[#E4E3E0] border-[#141414]" 
          : "hover:bg-[#141414]/5 text-[#141414]/80"
      )}
    >
      {icon}
      <span className="tracking-widest">{label}</span>
    </button>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="opacity-40">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[8px] font-mono opacity-50 leading-none">{label}</span>
        <span className="text-xs font-mono font-bold leading-none mt-0.5">{value}</span>
      </div>
    </div>
  );
}
