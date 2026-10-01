import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, getDocs, doc, updateDoc, setDoc, deleteDoc, query, onSnapshot, syncSurplusFirestoreToSupabase } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { 
  User, 
  Shield, 
  Search, 
  Sparkles, 
  UserPlus, 
  Trash2, 
  Mail, 
  Check, 
  X,
  Users,
  Award,
  ShieldCheck,
  Calendar,
  Zap,
  Lock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

export type PlanType = 
  | 'monthly' 
  | 'quarterly' 
  | 'semiannual' 
  | 'annual' 
  | 'lifetime' 
  | 'med_internato_premium' 
  | 'med_internato_lifetime'
  | 'combo_ouro'
  | 'combo_ouro_lifetime'
  | 'trial_1week_pro'
  | 'trial_1week_internato'
  | 'trial_1week_combo';

const PLAN_LABELS: Record<string, string> = {
  monthly: 'MedRevise PRO Mensal',
  quarterly: 'MedRevise PRO Trimestral',
  semiannual: 'MedRevise PRO Semestral',
  annual: 'MedRevise PRO Anual',
  lifetime: 'MedRevise PRO Vitalício',
  med_internato_premium: 'Med Internato Premium',
  med_internato_lifetime: 'Med Internato Vitalício',
  combo_ouro: 'Combo Ouro (PRO + Internato)',
  combo_ouro_lifetime: 'Combo Ouro Vitalício (PRO + Internato)',
  internato: 'Med Internato Premium',
  trial_1week_pro: '⚡ Teste 1 Sem (MedRevise PRO)',
  trial_1week_internato: '⚡ Teste 1 Sem (Med Internato)',
  trial_1week_combo: '⚡ Teste 1 Sem (Combo Ouro VIP)',
};

const checkIsLifetime = (type: PlanType) => {
  return type === 'lifetime' || type === 'med_internato_lifetime' || type === 'combo_ouro_lifetime';
};

const checkIsTrial = (type: PlanType) => {
  return type === 'trial_1week_pro' || type === 'trial_1week_internato' || type === 'trial_1week_combo';
};

const getProviderName = (type: PlanType) => {
  switch (type) {
    case 'trial_1week_pro': return 'Admin (Teste 1 Semana - PRO)';
    case 'trial_1week_internato': return 'Admin (Teste 1 Semana - Internato)';
    case 'trial_1week_combo': return 'Admin (Teste 1 Semana - Combo Ouro)';
    case 'lifetime': return 'Admin (PRO Vitalício)';
    case 'med_internato_lifetime': return 'Admin (Med Internato Vitalício)';
    case 'combo_ouro_lifetime': return 'Admin (Combo Ouro Vitalício)';
    case 'combo_ouro': return 'Admin (Combo Ouro)';
    case 'med_internato_premium': return 'Admin (Med Internato Premium)';
    case 'annual': return 'Admin (Anual)';
    case 'semiannual': return 'Admin (Semestral)';
    case 'quarterly': return 'Admin (Trimestral)';
    case 'monthly': default: return 'Admin (Mensal)';
  }
};

const getPremiumPlan = (type: PlanType) => {
  if (type === 'combo_ouro' || type === 'combo_ouro_lifetime' || type === 'trial_1week_combo') return 'combo_ouro';
  if (type === 'med_internato_premium' || type === 'med_internato_lifetime' || type === 'trial_1week_internato' || (type as string) === 'internato') return 'med_internato_premium';
  return 'med_revise_pro';
};

interface RegisteredUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  isPremium?: boolean;
  isLifetimePremium?: boolean;
  planType?: PlanType;
  premiumUntil?: string;
  premiumPlan?: string;
  premiumProvider?: string;
}

interface PreAuthorizedEmail {
  email: string;
  createdAt: string;
  isLifetimePremium?: boolean;
  planType?: PlanType;
  premiumPlan?: string;
  premiumUntil?: string;
}

export default function AdminPanel() {
  const { user } = useAuth();
  
  // States
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [preAuthEmails, setPreAuthEmails] = useState<PreAuthorizedEmail[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [preAuthLoading, setPreAuthLoading] = useState(true);
  
  const [userSearchText, setUserSearchText] = useState('');
  const [newPreAuthEmail, setNewPreAuthEmail] = useState('');
  const [preAuthType, setPreAuthType] = useState<PlanType>('monthly');
  const [subTypeMap, setSubTypeMap] = useState<Record<string, PlanType>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load registered users
  useEffect(() => {
    if (!user) return;
    
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const userList = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as RegisteredUser));
        setUsers(userList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  // Sync pre-authorized emails
  useEffect(() => {
    if (!user) return;
    
    const q = collection(db, 'pre_authorized_emails');
    const unsub = onSnapshot(q, (snap) => {
      setPreAuthEmails(snap.docs.map(d => ({
        email: d.id,
        ...d.data()
      }) as PreAuthorizedEmail));
      setPreAuthLoading(false);
    }, (error) => {
      console.error("Error loading pre-authorized emails:", error);
      setPreAuthLoading(false);
    });

    return unsub;
  }, [user]);

  // Change plan for an existing user
  const changeUserPlan = async (targetUser: RegisteredUser, newPlan: PlanType) => {
    setActionLoading(targetUser.uid);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const isLifetime = checkIsLifetime(newPlan);
      const isTrial = checkIsTrial(newPlan);
      const pPlan = getPremiumPlan(newPlan);
      
      let newUntilIso: string | null = null;
      if (isLifetime) {
        newUntilIso = null;
      } else if (isTrial) {
        newUntilIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        let durationDays = 30;
        if (newPlan === 'quarterly') durationDays = 90;
        else if (newPlan === 'semiannual') durationDays = 180;
        else if (newPlan === 'annual') durationDays = 365;
        newUntilIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }
      
      const updateData: any = {
        isPremium: true,
        isLifetimePremium: isLifetime,
        planType: newPlan,
        premiumPlan: pPlan,
        premiumProvider: getProviderName(newPlan),
        premiumSince: isLifetime ? null : new Date().toISOString(),
        premiumUntil: newUntilIso
      };

      await updateDoc(userRef, updateData);

      setUsers(prev => prev.map(u => 
        u.uid === targetUser.uid ? {
          ...u,
          isPremium: true,
          isLifetimePremium: isLifetime,
          planType: newPlan,
          premiumPlan: pPlan,
          premiumUntil: newUntilIso || undefined
        } : u
      ));
      alert(`Plano do usuário ${targetUser.email || targetUser.uid} alterado para: ${PLAN_LABELS[newPlan] || newPlan}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Adjust remaining days (+30d, +7d, -7d, etc.) for a user
  const adjustUserDays = async (targetUser: RegisteredUser, daysToAdd: number) => {
    setActionLoading(`days-${targetUser.uid}`);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const nowMs = Date.now();
      let currentUntilMs = nowMs;
      
      if (targetUser.premiumUntil) {
        const parsed = new Date(targetUser.premiumUntil).getTime();
        if (!isNaN(parsed) && parsed > nowMs) {
          currentUntilMs = parsed;
        }
      }
      
      const newUntilMs = Math.max(nowMs, currentUntilMs + daysToAdd * 24 * 60 * 60 * 1000);
      const newUntilIso = new Date(newUntilMs).toISOString();
      
      await updateDoc(userRef, {
        isPremium: true,
        premiumUntil: newUntilIso,
        planType: targetUser.planType || 'combo_ouro',
        premiumPlan: targetUser.premiumPlan || 'combo_ouro'
      });

      setUsers(prev => prev.map(u => 
        u.uid === targetUser.uid ? {
          ...u,
          isPremium: true,
          premiumUntil: newUntilIso
        } : u
      ));
      alert(`Validade estendida em ${daysToAdd > 0 ? `+${daysToAdd}` : daysToAdd} dias para ${targetUser.email || targetUser.uid}! Nova data: ${new Date(newUntilIso).toLocaleDateString('pt-BR')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Quick helper to grant 1 week trial to any user for any model/combo
  const grantOneWeekTrial = async (targetUser: RegisteredUser, trialType: PlanType = 'trial_1week_combo') => {
    await changeUserPlan(targetUser, trialType);
  };

  // Selected user for detailed plan modal
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<RegisteredUser | null>(null);
  const [modalPlanType, setModalPlanType] = useState<PlanType>('combo_ouro');
  const [modalDurationDays, setModalDurationDays] = useState<number>(30);
  const [modalIsLifetime, setModalIsLifetime] = useState<boolean>(false);
  const [modalCustomDate, setModalCustomDate] = useState<string>('');

  const openPlanModal = (targetUser: RegisteredUser) => {
    setSelectedUserForPlan(targetUser);
    const plan = targetUser.planType || (targetUser.isLifetimePremium ? 'combo_ouro_lifetime' : 'combo_ouro');
    setModalPlanType(plan);
    const isLife = targetUser.isLifetimePremium || checkIsLifetime(plan);
    setModalIsLifetime(isLife);

    let daysLeft = 30;
    if (targetUser.premiumUntil && !isLife) {
      const untilMs = new Date(targetUser.premiumUntil).getTime();
      const diff = Math.ceil((untilMs - Date.now()) / (1000 * 60 * 60 * 24));
      daysLeft = Math.max(1, diff);
    }
    setModalDurationDays(daysLeft);

    const defaultTargetDate = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
    setModalCustomDate(defaultTargetDate.toISOString().split('T')[0]);
  };

  const handleSaveModalPlan = async () => {
    if (!selectedUserForPlan) return;
    setActionLoading(selectedUserForPlan.uid);
    try {
      const userRef = doc(db, 'users', selectedUserForPlan.uid);
      const pPlan = getPremiumPlan(modalPlanType);
      
      let newUntilIso: string | null = null;
      if (modalIsLifetime) {
        newUntilIso = null;
      } else if (modalCustomDate) {
        const customDateObj = new Date(`${modalCustomDate}T23:59:59`);
        newUntilIso = customDateObj.toISOString();
      } else {
        newUntilIso = new Date(Date.now() + modalDurationDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const updateData: any = {
        isPremium: true,
        isLifetimePremium: modalIsLifetime,
        planType: modalPlanType,
        premiumPlan: pPlan,
        premiumProvider: getProviderName(modalPlanType),
        premiumSince: modalIsLifetime ? null : new Date().toISOString(),
        premiumUntil: newUntilIso
      };

      await updateDoc(userRef, updateData);

      setUsers(prev => prev.map(u => 
        u.uid === selectedUserForPlan.uid ? {
          ...u,
          isPremium: true,
          isLifetimePremium: modalIsLifetime,
          planType: modalPlanType,
          premiumPlan: pPlan,
          premiumUntil: newUntilIso || undefined
        } : u
      ));

      alert(`✅ Plano do estudante ${selectedUserForPlan.email || selectedUserForPlan.displayName || selectedUserForPlan.uid} atualizado com sucesso!`);
      setSelectedUserForPlan(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${selectedUserForPlan.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle registered user premium status
  const togglePremium = async (targetUser: RegisteredUser, type: PlanType = 'combo_ouro') => {
    setActionLoading(targetUser.uid);
    const newStatus = !targetUser.isPremium;
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const updateData: any = {
        isPremium: newStatus
      };
      
      if (newStatus) {
        const isLifetime = checkIsLifetime(type);
        const isTrial = checkIsTrial(type);
        const pPlan = getPremiumPlan(type);
        
        let untilIso: string | null = null;
        if (isLifetime) {
          untilIso = null;
        } else if (isTrial) {
          untilIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          untilIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        updateData.isLifetimePremium = isLifetime;
        updateData.planType = type;
        updateData.premiumPlan = pPlan;
        updateData.premiumSince = isLifetime ? null : new Date().toISOString();
        updateData.premiumUntil = untilIso;
        updateData.premiumProvider = getProviderName(type);
      } else {
        updateData.isLifetimePremium = false;
        updateData.planType = null;
        updateData.premiumPlan = null;
        updateData.premiumSince = null;
        updateData.premiumUntil = null;
        updateData.premiumProvider = null;
      }
      
      await updateDoc(userRef, updateData);
      
      // Update local state smoothly
      setUsers(prev => prev.map(u => 
        u.uid === targetUser.uid ? { 
          ...u, 
          isPremium: newStatus,
          isLifetimePremium: newStatus ? checkIsLifetime(type) : false,
          planType: newStatus ? type : undefined,
          premiumPlan: newStatus ? getPremiumPlan(type) : undefined,
          premiumUntil: newStatus && !checkIsLifetime(type) ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
        } : u
      ));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Force re-sync Firestore data to Supabase for a user
  const handleSyncUserData = async (targetUser: RegisteredUser) => {
    setActionLoading(`sync-${targetUser.uid}`);
    try {
      await syncSurplusFirestoreToSupabase(targetUser.uid);
      alert(`Dados do Firestore sincronizados e restaurados para ${targetUser.email || targetUser.uid}!`);
    } catch (err) {
      console.error('Sync error:', err);
      alert('Erro ao sincronizar dados. Veja o console para detalhes.');
    } finally {
      setActionLoading(null);
    }
  };

  // Add pre-authorized email
  const addPreAuthEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAuthorize = newPreAuthEmail.trim().toLowerCase();
    if (!emailToAuthorize) return;

    setActionLoading('preauth-add');
    try {
      const isLifetime = checkIsLifetime(preAuthType);
      const isTrial = checkIsTrial(preAuthType);
      const pPlan = getPremiumPlan(preAuthType);
      const oneWeekLater = isTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
      
      // Check if this user is already registered. If yes, update their profile too!
      const existingUser = users.find(u => u.email?.toLowerCase() === emailToAuthorize);
      if (existingUser) {
        await updateDoc(doc(db, 'users', existingUser.uid), {
          isPremium: true,
          isLifetimePremium: isLifetime,
          planType: preAuthType,
          premiumPlan: pPlan,
          premiumSince: isLifetime ? null : new Date().toISOString(),
          premiumUntil: oneWeekLater,
          premiumProvider: getProviderName(preAuthType)
        });
        setUsers(prev => prev.map(u => 
          u.uid === existingUser.uid ? { 
            ...u, 
            isPremium: true,
            isLifetimePremium: isLifetime,
            planType: preAuthType,
            premiumPlan: pPlan,
            premiumUntil: oneWeekLater || undefined
          } : u
        ));
      }

      // Add to pre-authorized list
      await setDoc(doc(db, 'pre_authorized_emails', emailToAuthorize), {
        createdAt: new Date().toISOString(),
        isLifetimePremium: isLifetime,
        planType: preAuthType,
        premiumPlan: pPlan,
        premiumUntil: oneWeekLater
      });

      setNewPreAuthEmail('');
      alert(`Email "${emailToAuthorize}" pré-autorizado como Premium (${PLAN_LABELS[preAuthType]}) com sucesso!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pre_authorized_emails/${emailToAuthorize}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Remove pre-authorized email
  const removePreAuthEmail = async (emailToRemove: string) => {
    if (!confirm(`Deseja revogar a pré-autorização premium para "${emailToRemove}"?`)) return;
    
    setActionLoading(`preauth-del-${emailToRemove}`);
    try {
      await deleteDoc(doc(db, 'pre_authorized_emails', emailToRemove));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `pre_authorized_emails/${emailToRemove}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filters
  const filteredUsers = users.filter(u => {
    const search = userSearchText.toLowerCase();
    return (
      (u.displayName?.toLowerCase().includes(search) || false) ||
      (u.email?.toLowerCase().includes(search) || false) ||
      u.uid.toLowerCase().includes(search)
    );
  });

  // Counters for the bento boxes
  const premiumUsersCount = users.filter(u => u.isPremium).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      
      {/* Premium Header Banner */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="text-[10px] uppercase tracking-widest text-[#8E8A82] font-mono bg-[#F0EEE9] px-3.5 py-1 rounded-full font-black border border-[#E2E0D9]/30 inline-flex items-center gap-1.5 shadow-sm">
          <Shield className="w-3 h-3 text-primary animate-pulse" /> Console de Segurança
        </span>
        <h2 className="text-4xl md:text-5xl font-display font-black text-neutral-900 tracking-tight">
          Painel de Controle
        </h2>
        <p className="text-[#8E8A82] italic font-display text-sm leading-relaxed">
          Gerenciamento centralizado de acessos acadêmicos, pré-autorizações de emails para compras manuais e moderação de assinantes.
        </p>
      </div>

      {/* Bento Grid Analytics Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        
        {/* Stat 1: Total Registered */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div className="space-y-1">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#8E8A82] font-black">Estudantes Registrados</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-neutral-900">{usersLoading ? '...' : users.length}</span>
              <span className="text-xs text-emerald-600 font-mono font-bold">ativos</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-neutral-800 border border-slate-100">
            <Users className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Stat 2: Active Premium */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow border-l-4 border-l-amber-500"
        >
          <div className="space-y-1">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#8E8A82] font-black">Assinantes Premium</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-neutral-900">{usersLoading ? '...' : premiumUsersCount}</span>
              <span className="text-xs text-amber-600 font-mono font-bold">
                {users.length > 0 ? `${Math.round((premiumUsersCount / users.length) * 100)}%` : '0%'}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100/50">
            <Award className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Stat 3: Pre-Authorized */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-5 bg-white border border-[#E2E0D9] rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div className="space-y-1">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#8E8A82] font-black">Pré-Autorizações</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-black text-neutral-900">{preAuthLoading ? '...' : preAuthEmails.length}</span>
              <span className="text-xs text-indigo-600 font-mono font-bold">emails</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </motion.div>

      </div>

      {/* Row 1: Pre-Authorization Modules (2 Columns Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
        
        {/* Card 1: Authorize New Email */}
        <div className="p-1.5 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl shadow-sm h-full">
          <div className="p-5 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-4 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E2E0D9]/60">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 border border-neutral-200">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[#8E8A82] font-black">Autorizar Novo Email</h4>
                  <p className="text-[9px] text-[#8E8A82] font-mono mt-0.5">Permissão premium automática</p>
                </div>
              </div>
              
              <p className="text-[11px] text-[#8E8A82] leading-relaxed font-sans">
                Insira o email de um estudante para conceder Premium imediato. Mesmo que ele ainda <strong>não tenha criado uma conta</strong>, ele começará automaticamente no plano Pro ao fazer seu primeiro login com esse email.
              </p>

              <form onSubmit={addPreAuthEmail} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="student-email" className="block text-[9px] uppercase font-bold text-[#8E8A82] tracking-wider">Email do Estudante</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#8E8A82]">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      id="student-email"
                      type="email"
                      required
                      placeholder="estudante@medrevise.com"
                      value={newPreAuthEmail}
                      onChange={(e) => setNewPreAuthEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 h-11 bg-white border border-[#E2E0D9] rounded-xl font-mono text-xs focus:outline-none focus:border-primary transition-colors placeholder:text-[#8E8A82]/50 text-neutral-900"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-8 space-y-1.5">
                    <label htmlFor="access-duration" className="block text-[9px] uppercase font-bold text-[#8E8A82] tracking-wider">Plano e Validade do Acesso</label>
                    <select
                      id="access-duration"
                      value={preAuthType}
                      onChange={(e) => setPreAuthType(e.target.value as PlanType)}
                      className="w-full h-11 px-3 border border-[#E2E0D9] rounded-xl bg-white focus:outline-none focus:border-primary text-xs font-mono"
                    >
                      <optgroup label="⚡ Conceder Teste Gratuito (1 Semana / 7 Dias)">
                        <option value="trial_1week_combo">⚡ 1 Semana Teste - Combo Ouro VIP (Tudo Liberado)</option>
                        <option value="trial_1week_internato">⚡ 1 Semana Teste - Med Internato Premium</option>
                        <option value="trial_1week_pro">⚡ 1 Semana Teste - MedRevise PRO</option>
                      </optgroup>
                      <optgroup label="Assinaturas Regulares">
                        <option value="monthly">MedRevise PRO - Mensal (30 dias)</option>
                        <option value="quarterly">MedRevise PRO - Trimestral (90 dias)</option>
                        <option value="semiannual">MedRevise PRO - Semestral (180 dias)</option>
                        <option value="annual">MedRevise PRO - Anual (365 dias)</option>
                        <option value="lifetime">MedRevise PRO - Vitalício (Permanente)</option>
                        <option value="med_internato_premium">Med Internato Premium - Periódico (R$ 39,90)</option>
                        <option value="med_internato_lifetime">Med Internato Premium - Vitalício (Permanente)</option>
                        <option value="combo_ouro">Combo Ouro VIP - Periódico (R$ 49,90)</option>
                        <option value="combo_ouro_lifetime">Combo Ouro VIP - Vitalício (Permanente)</option>
                      </optgroup>
                    </select>
                  </div>
                  
                  <button 
                    id="btn-preauth-submit"
                    type="submit"
                    disabled={actionLoading === 'preauth-add'}
                    className="sm:col-span-4 h-11 bg-[#1A1A1A] hover:bg-black text-white px-4 font-mono text-[10px] font-black tracking-widest uppercase rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {actionLoading === 'preauth-add' ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Conceder</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Card 2: Pre-Authorized emails list */}
        <div className="p-1.5 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl shadow-sm h-full">
          <div className="p-5 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-4 h-full">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E0D9]/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/40">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-[#8E8A82] font-black">Pendentes de Registro</h4>
                  <p className="text-[9px] text-[#8E8A82] font-mono mt-0.5">{preAuthEmails.length} autorizações ativas</p>
                </div>
              </div>
            </div>

            {preAuthLoading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-[9px] font-mono text-[#8E8A82] uppercase tracking-wider">Carregando lista...</p>
              </div>
            ) : preAuthEmails.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/50 border border-dashed border-[#E2E0D9] rounded-xl space-y-1.5">
                <p className="text-xs text-[#8E8A82] italic">Nenhuma autorização pendente.</p>
                <p className="text-[10px] text-neutral-400 font-mono">Todos os emails cadastrados já possuem contas associadas.</p>
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {preAuthEmails.map((item) => (
                  <div 
                    key={item.email} 
                    className="flex items-center justify-between p-3 bg-[#FBFBFA] border border-[#E2E0D9]/85 rounded-xl hover:border-slate-300 transition-colors text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-mono text-[11px] font-bold text-neutral-800 truncate">{item.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`text-[7.5px] font-mono px-1.5 py-0.2 rounded font-black uppercase ${
                          item.isLifetimePremium || item.planType === 'lifetime'
                            ? 'bg-purple-100 text-purple-700' 
                            : (item.planType as string) === 'internato' || item.planType === 'med_internato_premium'
                            ? 'bg-teal-100 text-teal-700'
                            : item.planType === 'annual'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.planType ? PLAN_LABELS[item.planType] : (item.isLifetimePremium ? 'PRO Vitalício' : 'PRO Mensal')}
                        </span>
                        <span className="text-[8px] font-mono text-neutral-400">
                          Adicionado: {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button 
                      id={`btn-revoke-${item.email}`}
                      onClick={() => removePreAuthEmail(item.email)}
                      disabled={actionLoading === `preauth-del-${item.email}`}
                      className="w-8 h-8 rounded-lg bg-white border border-[#E2E0D9] hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-neutral-400 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                      title="Revogar Pré-Autorização"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row 2: Registered Users Moderation Directory (FULL WIDTH 100%) */}
      <div className="w-full bg-[#FBFBFA] border border-[#E2E0D9] p-1.5 rounded-2xl shadow-sm">
        <div className="p-6 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E2E0D9]/60">
              <div className="space-y-1">
                <h4 className="text-sm font-display font-black text-neutral-900 uppercase tracking-wide">Diretório de Estudantes</h4>
                <p className="text-[10px] font-mono text-[#8E8A82] uppercase">Gerencie os acessos de usuários ativos na plataforma</p>
              </div>

              {/* Search input bar */}
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8E8A82]">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  id="user-search-input"
                  type="text" 
                  placeholder="Buscar estudante..."
                  value={userSearchText}
                  onChange={(e) => setUserSearchText(e.target.value)}
                  className="w-full bg-white border border-[#E2E0D9] pl-10 pr-3.5 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-primary transition-colors text-neutral-900"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-xs font-mono text-[#8E8A82] uppercase tracking-widest animate-pulse">Sincronizando banco de perfis...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 border border-dashed border-[#E2E0D9] rounded-2xl">
                <p className="text-xs text-[#8E8A82] italic">Nenhum estudante correspondente encontrado.</p>
                {userSearchText && (
                  <p className="text-[10px] text-neutral-400 font-mono mt-1">Busque por outro nome ou e-mail cadastrado.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto select-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E0D9] bg-slate-50/50">
                      <th className="p-3 font-mono text-[9px] uppercase tracking-widest text-[#8E8A82] font-black">Estudante</th>
                      <th className="p-3 font-mono text-[9px] uppercase tracking-widest text-[#8E8A82] font-black">Cadastro</th>
                      <th className="p-3 font-mono text-[9px] uppercase tracking-widest text-[#8E8A82] font-black">Status de Acesso</th>
                      <th className="p-3 font-mono text-[9px] uppercase tracking-widest text-[#8E8A82] font-black text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredUsers.map((item, uIdx) => (
                      <tr key={`adm-user-${item.uid || 'id'}-${uIdx}`} className="hover:bg-[#FBFBFA]/50 transition-colors">
                        
                        {/* Column 1: Info */}
                        <td className="p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {item.photoURL ? (
                              <img 
                                src={item.photoURL} 
                                alt="" 
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full border border-[#E2E0D9] shrink-0" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#F0EEE9] border border-[#E2E0D9] flex items-center justify-center font-black text-xs text-[#8E8A82] shrink-0">
                                {((item as any).displayName || (item as any).name || (item as any).nome || ((item as any).email || (item as any).emailAddress || '').split('@')[0] || 'V').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h5 className="font-display font-bold text-xs text-neutral-800 truncate">
                                {(item as any).displayName || (item as any).name || (item as any).nome || ((item as any).email || (item as any).emailAddress || '').split('@')[0] || 'Aluno Visitante (Anônimo)'}
                              </h5>
                              <p className="text-[9.5px] font-mono text-[#8E8A82] truncate flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3 text-[#8E8A82]/70" />
                                {(item as any).email || (item as any).emailAddress || (item as any).email_address || (item as any).userEmail || 'Acesso de Visitante (Sem e-mail)'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Date */}
                        <td className="p-3 font-mono text-[10px] text-neutral-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>

                        {/* Column 3: Badge status & Days Remaining */}
                        <td className="p-3">
                          {(() => {
                            if (!item.isPremium) {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-400 font-mono text-[8px] font-black uppercase tracking-wider">
                                  Plano Gratuito
                                </span>
                              );
                            }
                            const plan = item.planType || (item.isLifetimePremium ? 'lifetime' : 'monthly');
                            const isTrialPlan = plan?.startsWith('trial_1week');
                            const badgeStyle = 
                              isTrialPlan ? 'bg-amber-100 border-amber-300 text-amber-900 font-black' :
                              plan === 'lifetime' || item.isLifetimePremium ? 'bg-purple-50 border-purple-200 text-purple-700 font-black' :
                              plan === 'combo_ouro' || plan === 'combo_ouro_lifetime' ? 'bg-amber-100 border-amber-300 text-amber-800 font-black' :
                              plan === 'med_internato_premium' || (plan as string) === 'internato' ? 'bg-teal-50 border-teal-200 text-teal-700 font-black' :
                              plan === 'annual' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              'bg-amber-50 border-amber-200 text-amber-700 font-bold';
                            
                            let daysLeftStr = 'Vitalício ♾️';
                            let isExpired = false;
                            if (!item.isLifetimePremium && item.premiumUntil) {
                              const untilMs = new Date(item.premiumUntil).getTime();
                              const diffDays = Math.ceil((untilMs - Date.now()) / (1000 * 60 * 60 * 24));
                              if (diffDays <= 0) {
                                isExpired = true;
                                daysLeftStr = `Expirado (${Math.abs(diffDays)}d atrás)`;
                              } else {
                                daysLeftStr = `${diffDays} dias restantes`;
                              }
                            } else if (!item.isLifetimePremium && item.createdAt) {
                              daysLeftStr = '30 dias (padrão)';
                            }

                            return (
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex px-2 py-0.5 rounded-full border font-mono text-[8px] font-black uppercase tracking-wider ${badgeStyle}`}>
                                  ★ {PLAN_LABELS[plan] || 'PRO'}
                                </span>
                                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap border ${
                                  item.isLifetimePremium ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  isExpired ? 'bg-rose-100 text-rose-800 border-rose-300 font-black' :
                                  'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                                }`}>
                                  ⏳ {daysLeftStr}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Column 4: Controls inline */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`btn-open-modal-${item.uid}`}
                              onClick={() => openPlanModal(item)}
                              disabled={actionLoading === item.uid}
                              className="h-8 px-3 rounded-lg font-mono text-[9px] uppercase tracking-wider font-extrabold transition-all border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              title="Abrir seletor avançado de planos e dias de validade"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>⚙️ Gerenciar Plano</span>
                            </button>

                            <button
                              id={`btn-sync-data-${item.uid}`}
                              onClick={() => handleSyncUserData(item)}
                              disabled={actionLoading === `sync-${item.uid}`}
                              title="Restaurar e Sincronizar dados do Firestore para este usuário"
                              className="h-8 px-2.5 rounded-lg font-mono text-[9px] uppercase tracking-wider font-bold transition-all border border-[#E2E0D9] bg-white text-neutral-600 hover:bg-neutral-50 shrink-0 cursor-pointer flex items-center gap-1.5"
                            >
                              {actionLoading === `sync-${item.uid}` ? (
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  <span>Restaurar</span>
                                </>
                              )}
                            </button>

                            <button
                              id={`btn-premium-toggle-${item.uid}`}
                              onClick={() => togglePremium(item, 'combo_ouro')}
                              disabled={actionLoading === item.uid}
                              className={`h-8 px-3 rounded-lg font-mono text-[9px] uppercase tracking-widest font-black transition-all border shrink-0 cursor-pointer flex items-center justify-center ${
                                item.isPremium
                                  ? 'bg-neutral-50 text-neutral-400 border-[#E2E0D9] hover:bg-red-50 hover:border-red-100 hover:text-red-500'
                                  : 'bg-[#1A1A1A] text-white border-transparent hover:bg-black'
                              }`}
                            >
                              {actionLoading === item.uid ? (
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : item.isPremium ? (
                                'Revogar'
                              ) : (
                                'Ativar'
                              )}
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {/* SOPHISTICATED PLAN MANAGEMENT MODAL */}
      {selectedUserForPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-white border-2 border-[#1A1A1A] shadow-2xl rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 text-[#1A1A1A] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E2E0D9] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-amber-400 flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                  {selectedUserForPlan.photoURL ? (
                    <img src={selectedUserForPlan.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    (selectedUserForPlan.displayName || selectedUserForPlan.email || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black font-display text-neutral-900">
                    Gerenciar Plano & Validade
                  </h3>
                  <p className="text-xs text-[#8E8A82] font-mono mt-0.5">
                    Estudante: <strong className="text-neutral-900 font-bold">{selectedUserForPlan.displayName || 'Sem nome'}</strong> ({selectedUserForPlan.email || 'Sem e-mail'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUserForPlan(null)}
                className="w-8 h-8 rounded-xl bg-stone-100 text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Status Informativo Bar */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" /> Status Atual na Nuvem:
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-black uppercase bg-amber-200/80 text-amber-950 border border-amber-300">
                  {selectedUserForPlan.isPremium ? (selectedUserForPlan.isLifetimePremium ? 'Vitalício ♾️' : 'Assinante Ativo') : 'Conta Gratuita'}
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-sans">
                {selectedUserForPlan.isLifetimePremium ? (
                  <>Este usuário tem <strong>Acesso Vitalício Permanente</strong> habilitado.</>
                ) : selectedUserForPlan.premiumUntil ? (
                  <>Validade atual registrada até <strong>{new Date(selectedUserForPlan.premiumUntil).toLocaleDateString('pt-BR')} às {new Date(selectedUserForPlan.premiumUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>.</>
                ) : (
                  <>Atualmente no <strong>Plano Gratuito</strong> sem período pago ativo.</>
                )}
              </p>
            </div>

            {/* 1. Escolha do Produto / Tipo do Plano */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest font-black text-[#8E8A82] block">
                1. Selecione o Tipo do Plano (Produto)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: 'combo_ouro', name: '👑 Combo Ouro VIP', desc: 'MedRevise PRO + Med Internato Premium (Tudo Liberado)', badge: 'RECOMENDADO' },
                  { id: 'med_internato_premium', name: '🩺 Med Internato Premium', desc: 'Banco de questões clínicas e rodízios de internato', badge: 'PRÁTICO' },
                  { id: 'med_revise_pro', name: '📚 MedRevise PRO', desc: 'SRS de repetição espaçada, matérias e resumos de estudo', badge: 'FIXAÇÃO' },
                  { id: 'trial_1week_combo', name: '⚡ Teste 1 Semana (Combo)', desc: 'Degustação temporária de 7 dias com acesso total', badge: 'DEGUSTAÇÃO' },
                  { id: 'combo_ouro_lifetime', name: '♾️ Combo Ouro Vitalício', desc: 'Acesso permanente vitalício para sempre na plataforma', badge: 'PERMANENTE' }
                ].map((p) => {
                  const isSelected = modalPlanType === p.id;
                  return (
                    <button
                      key={`modal-p-${p.id}`}
                      type="button"
                      onClick={() => {
                        setModalPlanType(p.id as PlanType);
                        if (p.id.includes('lifetime')) {
                          setModalIsLifetime(true);
                        } else {
                          setModalIsLifetime(false);
                          if (p.id.startsWith('trial_1week')) {
                            setModalDurationDays(7);
                          }
                        }
                      }}
                      className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                        isSelected 
                          ? 'border-[#1A1A1A] bg-amber-50/20 ring-2 ring-[#1A1A1A]/20 shadow-xs' 
                          : 'border-[#E2E0D9] bg-white hover:border-stone-400'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black uppercase text-[#1A1A1A]">{p.name}</span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-black uppercase ${isSelected ? 'bg-[#1A1A1A] text-white' : 'bg-stone-100 text-stone-600'}`}>
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-600 leading-tight font-medium">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Escolha da Duração / Quantidade de Dias (Se não for vitalício) */}
            {!modalIsLifetime && (
              <div className="p-4 rounded-2xl bg-[#FBFBFA] border border-[#E2E0D9] space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#1A1A1A] block">2. Quantidade de Dias de Acesso</span>
                    <span className="text-[10px] text-[#666] block">Ajuste o tempo de validade do plano para este aluno.</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-300">
                    <span className="text-xs font-black text-amber-900 font-mono">{modalDurationDays} dias</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '7 Dias (1 Sem)', days: 7 },
                    { label: '15 Dias', days: 15 },
                    { label: '30 Dias (Mensal)', days: 30 },
                    { label: '60 Dias (2M)', days: 60 },
                    { label: '90 Dias (Trimestral)', days: 90 },
                    { label: '180 Dias (Semestral)', days: 180 },
                    { label: '365 Dias (1 Anual)', days: 365 }
                  ].map((preset) => (
                    <button
                      key={`preset-d-${preset.days}`}
                      type="button"
                      onClick={() => {
                        setModalDurationDays(preset.days);
                        const targetDate = new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000);
                        setModalCustomDate(targetDate.toISOString().split('T')[0]);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                        modalDurationDays === preset.days
                          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Manual Custom Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono uppercase font-bold text-stone-500">Ou Digite a Qtd de Dias Exacta:</label>
                    <input 
                      type="number" 
                      min="1"
                      max="3650"
                      value={modalDurationDays}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setModalDurationDays(val);
                        const targetDate = new Date(Date.now() + val * 24 * 60 * 60 * 1000);
                        setModalCustomDate(targetDate.toISOString().split('T')[0]);
                      }}
                      className="w-full h-10 px-3 bg-white border border-stone-300 rounded-xl font-mono text-xs font-bold text-stone-900 focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono uppercase font-bold text-stone-500">Ou Escolha a Data no Calendário:</label>
                    <input 
                      type="date"
                      value={modalCustomDate}
                      onChange={(e) => {
                        const valDate = e.target.value;
                        setModalCustomDate(valDate);
                        if (valDate) {
                          const targetMs = new Date(`${valDate}T23:59:59`).getTime();
                          const diffDays = Math.max(1, Math.ceil((targetMs - Date.now()) / (1000 * 60 * 60 * 24)));
                          setModalDurationDays(diffDays);
                        }
                      }}
                      className="w-full h-10 px-3 bg-white border border-stone-300 rounded-xl font-mono text-xs font-bold text-stone-900 focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Informativo do Tempo Restante em Tempo Real */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-1 text-emerald-950 font-mono text-xs">
              <span className="font-extrabold uppercase text-[10px] text-emerald-800 tracking-wider block">
                3. Previsão da Nova Validade do Estudante:
              </span>
              <p className="font-bold text-sm">
                {modalIsLifetime ? (
                  <>♾️ Plano Vitalício Permanente (Nunca expira)</>
                ) : (
                  <>📅 Expira em: {new Date(Date.now() + modalDurationDays * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')} ({modalDurationDays} dias a partir de hoje)</>
                )}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E0D9]">
              <button
                type="button"
                onClick={() => setSelectedUserForPlan(null)}
                className="px-5 h-11 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModalPlan}
                disabled={actionLoading === selectedUserForPlan.uid}
                className="px-6 h-11 bg-[#1A1A1A] hover:bg-black text-white font-mono text-xs uppercase tracking-widest font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                {actionLoading === selectedUserForPlan.uid ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Salvar e Atualizar Plano</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

