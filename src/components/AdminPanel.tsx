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
  | 'combo_ouro_lifetime';

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
};

const checkIsLifetime = (type: PlanType) => {
  return type === 'lifetime' || type === 'med_internato_lifetime' || type === 'combo_ouro_lifetime';
};

const getProviderName = (type: PlanType) => {
  switch (type) {
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
  if (type === 'combo_ouro' || type === 'combo_ouro_lifetime') return 'combo_ouro';
  if (type === 'med_internato_premium' || type === 'med_internato_lifetime' || (type as string) === 'internato') return 'med_internato_premium';
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
}

interface PreAuthorizedEmail {
  email: string;
  createdAt: string;
  isLifetimePremium?: boolean;
  planType?: PlanType;
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
      const pPlan = getPremiumPlan(newPlan);
      
      const updateData: any = {
        isPremium: true,
        isLifetimePremium: isLifetime,
        planType: newPlan,
        premiumPlan: pPlan,
        premiumProvider: getProviderName(newPlan)
      };
      if (isLifetime) {
        updateData.premiumSince = null;
      } else if (!targetUser.isPremium) {
        updateData.premiumSince = new Date().toISOString();
      }

      await updateDoc(userRef, updateData);

      setUsers(prev => prev.map(u => 
        u.uid === targetUser.uid ? {
          ...u,
          isPremium: true,
          isLifetimePremium: isLifetime,
          planType: newPlan
        } : u
      ));
      alert(`Plano do usuário ${targetUser.email || targetUser.uid} alterado para: ${PLAN_LABELS[newPlan] || newPlan}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle registered user premium status
  const togglePremium = async (targetUser: RegisteredUser, type: PlanType = 'monthly') => {
    setActionLoading(targetUser.uid);
    const newStatus = !targetUser.isPremium;
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const updateData: any = {
        isPremium: newStatus
      };
      
      if (newStatus) {
        const isLifetime = checkIsLifetime(type);
        const pPlan = getPremiumPlan(type);
        updateData.isLifetimePremium = isLifetime;
        updateData.planType = type;
        updateData.premiumPlan = pPlan;
        updateData.premiumSince = isLifetime ? null : new Date().toISOString();
        updateData.premiumProvider = getProviderName(type);
      } else {
        updateData.isLifetimePremium = false;
        updateData.planType = null;
        updateData.premiumPlan = null;
        updateData.premiumSince = null;
        updateData.premiumProvider = null;
      }
      
      await updateDoc(userRef, updateData);
      
      // Update local state smoothly
      setUsers(prev => prev.map(u => 
        u.uid === targetUser.uid ? { 
          ...u, 
          isPremium: newStatus,
          isLifetimePremium: newStatus ? checkIsLifetime(type) : false,
          planType: newStatus ? type : undefined
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
      const pPlan = getPremiumPlan(preAuthType);
      
      // Check if this user is already registered. If yes, update their profile too!
      const existingUser = users.find(u => u.email?.toLowerCase() === emailToAuthorize);
      if (existingUser) {
        await updateDoc(doc(db, 'users', existingUser.uid), {
          isPremium: true,
          isLifetimePremium: isLifetime,
          planType: preAuthType,
          premiumPlan: pPlan,
          premiumSince: isLifetime ? null : new Date().toISOString(),
          premiumProvider: getProviderName(preAuthType)
        });
        setUsers(prev => prev.map(u => 
          u.uid === existingUser.uid ? { 
            ...u, 
            isPremium: true,
            isLifetimePremium: isLifetime,
            planType: preAuthType
          } : u
        ));
      }

      // Add to pre-authorized list
      await setDoc(doc(db, 'pre_authorized_emails', emailToAuthorize), {
        createdAt: new Date().toISOString(),
        isLifetimePremium: isLifetime,
        planType: preAuthType,
        premiumPlan: pPlan
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        
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

      {/* Main Panel Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Pre-Authorization Dashboard */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card: Authorize New Email */}
          <div className="p-1.5 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl shadow-sm">
            <div className="p-5 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-4">
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
                      <option value="monthly">MedRevise PRO - Mensal (30 dias)</option>
                      <option value="quarterly">MedRevise PRO - Trimestral (90 dias)</option>
                      <option value="semiannual">MedRevise PRO - Semestral (180 dias)</option>
                      <option value="annual">MedRevise PRO - Anual (365 dias)</option>
                      <option value="lifetime">MedRevise PRO - Vitalício (Permanente)</option>
                      <option value="med_internato_premium">Med Internato Premium - Periódico (R$ 39,90)</option>
                      <option value="med_internato_lifetime">Med Internato Premium - Vitalício (Permanente)</option>
                      <option value="combo_ouro">Combo Ouro VIP - Periódico (R$ 49,90)</option>
                      <option value="combo_ouro_lifetime">Combo Ouro VIP - Vitalício (Permanente)</option>
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

          {/* Card: Pre-Authorized emails list */}
          <div className="p-1.5 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl shadow-sm">
            <div className="p-5 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-4">
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
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
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

        {/* Right Column: Registered Users Moderation */}
        <div className="lg:col-span-7 bg-[#FBFBFA] border border-[#E2E0D9] p-1.5 rounded-2xl shadow-sm">
          <div className="p-5 bg-white rounded-xl border border-[#E2E0D9]/60 space-y-6">
            
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

                        {/* Column 3: Badge status */}
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
                            const badgeStyle = 
                              plan === 'lifetime' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                              plan === 'combo_ouro' ? 'bg-amber-100 border-amber-300 text-amber-800 font-black' :
                              plan === 'med_internato_premium' || (plan as string) === 'internato' ? 'bg-teal-50 border-teal-200 text-teal-700 font-black' :
                              plan === 'annual' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              plan === 'semiannual' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                              plan === 'quarterly' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                              'bg-amber-50 border-amber-200 text-amber-700 font-bold';
                            return (
                              <span className={`inline-flex px-2 py-0.5 rounded-full border font-mono text-[8px] font-black uppercase tracking-wider ${badgeStyle}`}>
                                ★ {PLAN_LABELS[plan] || 'PRO'}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Column 4: Controls inline */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              id={`select-plan-${item.uid}`}
                              value={subTypeMap[item.uid] || item.planType || 'monthly'}
                              onChange={(e) => setSubTypeMap(prev => ({ ...prev, [item.uid]: e.target.value as PlanType }))}
                              className="border border-[#E2E0D9] text-[9.5px] font-mono px-2 py-1 rounded-lg focus:outline-none bg-white max-w-[135px] h-8 truncate"
                            >
                              <option value="monthly">PRO Mensal</option>
                              <option value="quarterly">PRO Trimestral</option>
                              <option value="semiannual">PRO Semestral</option>
                              <option value="annual">PRO Anual</option>
                              <option value="lifetime">PRO Vitalício</option>
                              <option value="med_internato_premium">Internato Premium</option>
                              <option value="med_internato_lifetime">Internato Vitalício</option>
                              <option value="combo_ouro">Combo Ouro VIP</option>
                              <option value="combo_ouro_lifetime">Combo Ouro Vitalício</option>
                            </select>

                            {item.isPremium && subTypeMap[item.uid] && subTypeMap[item.uid] !== item.planType && (
                              <button
                                id={`btn-change-plan-${item.uid}`}
                                onClick={() => changeUserPlan(item, subTypeMap[item.uid])}
                                disabled={actionLoading === item.uid}
                                className="h-8 px-2.5 rounded-lg font-mono text-[9px] uppercase tracking-wider font-bold transition-all border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shrink-0 cursor-pointer"
                              >
                                Alterar
                              </button>
                            )}

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
                              onClick={() => togglePremium(item, subTypeMap[item.uid] || 'monthly')}
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

      </div>

    </div>
  );
}

