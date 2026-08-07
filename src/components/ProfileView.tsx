import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, doc, updateDoc, collection, getDocs, deleteDoc, serverTimestamp, getDoc, query, where, addDoc } from '../firebase';
import { safeLocalStorageSet } from '../internato/utils/storageUtils';
import { 
  User, 
  Mail, 
  Calendar, 
  Target, 
  Shield, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  Scale, 
  Cpu, 
  Brain, 
  AlertCircle,
  QrCode,
  Copy,
  Check,
  CreditCard,
  Zap,
  CheckCircle2,
  Hourglass,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfileView() {
  const { user, profile } = useAuth();
  const isLucas = profile?.email === 'lucas1renck2melo@gmail.com' || profile?.role === 'admin';
  const [dailyGoal, setDailyGoal] = useState(profile?.settings?.dailyGoalMinutes || 60);
  const [residencyFocusType, setResidencyFocusType] = useState<string>(profile?.settings?.residencyFocusType || 'standard');
  const [residencyFocus, setResidencyFocus] = useState<string>(profile?.settings?.residencyFocus || 'Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Selective subjects cleanup state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupManager, setShowCleanupManager] = useState(false);

  // Load subjects
  useEffect(() => {
    if (user) {
      const loadSubjects = async () => {
        setLoadingSubjects(true);
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'subjects'));
          setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
          console.error('[ProfileView] Error loading subjects:', err);
        } finally {
          setLoadingSubjects(false);
        }
      };
      loadSubjects();
    }
  }, [user]);

  const handleToggleSubjectSelect = (subId: string) => {
    setSelectedSubjectIds(prev => 
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  const handleSelectAllSubjects = () => {
    if (selectedSubjectIds.length === subjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(subjects.map(s => s.id));
    }
  };

  const handleCleanSelectedSubjects = async () => {
    if (!user || selectedSubjectIds.length === 0) return;
    
    const count = selectedSubjectIds.length;
    if (!confirm(`ATENÇÃO: Isso excluirá permanentemente as ${count} matérias selecionadas, junto com todos os seus tópicos, sessões de estudo, histórico de revisão e acertos de questões associados. Esta ação não pode ser desfeita. Tem certeza?`)) {
      return;
    }

    setIsCleaning(true);
    try {
      // 1. Load all topics and studySessions for the user to filter in memory and delete
      const topicsSnap = await getDocs(collection(db, 'users', user.uid, 'topics'));
      const sessionsSnap = await getDocs(collection(db, 'users', user.uid, 'studySessions'));

      const userTopics = topicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const userSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Delete associated topics
      const topicsToDelete = userTopics.filter(t => selectedSubjectIds.includes(t.subjectId));
      for (const topic of topicsToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'topics', topic.id));
      }

      // 3. Delete associated sessions
      const sessionsToDelete = userSessions.filter(s => selectedSubjectIds.includes(s.subjectId));
      for (const session of sessionsToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'studySessions', session.id));
      }

      // 4. Delete the subjects
      for (const subId of selectedSubjectIds) {
        await deleteDoc(doc(db, 'users', user.uid, 'subjects', subId));
      }

      alert(`Sucesso! ${count} matérias e todo o seu respectivo histórico de revisões e acertos foram completamente excluídos.`);
      
      // Update local state
      setSubjects(prev => prev.filter(s => !selectedSubjectIds.includes(s.id)));
      setSelectedSubjectIds([]);
    } catch (err) {
      console.error('[ProfileView] Error cleaning subjects:', err);
      alert('Erro ao realizar a limpeza das matérias selecionadas.');
    } finally {
      setIsCleaning(false);
    }
  };

  // Mercado Pago & Pix checkouts state variables
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');

  const [activeTab, setActiveTab] = useState<'pix' | 'mercadopago'>('pix');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes (900s)

  // Real Pix generation state
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');
  const [pixGenerated, setPixGenerated] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);

  // Form info
  const [cpf, setCpf] = useState('');
  const [firstName, setFirstName] = useState(profile && profile.displayName ? profile.displayName.split(' ')[0] : '');
  const [lastName, setLastName] = useState(profile && profile.displayName ? profile.displayName.split(' ').slice(1).join(' ') : '');

  useEffect(() => {
    if (profile) {
      if (profile.displayName) {
        setFirstName(prev => prev || profile.displayName?.split(' ')[0] || '');
        setLastName(prev => prev || profile.displayName?.split(' ').slice(1).join(' ') || '');
      }
      if (profile.settings?.dailyGoalMinutes) {
        setDailyGoal(profile.settings.dailyGoalMinutes);
      }
      if (profile.settings?.residencyFocusType) {
        setResidencyFocusType(profile.settings.residencyFocusType);
      }
      if (profile.settings?.residencyFocus) {
        setResidencyFocus(profile.settings.residencyFocus);
      }
    }
  }, [profile]);

  // Live status checker states
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkingStatusMessage, setCheckingStatusMessage] = useState('');

  // Referral / Share Key System States
  const [enteredReferralKey, setEnteredReferralKey] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [referralFeedback, setReferralFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  // Auto-generate Referral Key if missing
  useEffect(() => {
    if (user && profile && !profile.referralKey) {
      const generateKey = async () => {
        try {
          const cleanEmail = (profile.email || '').split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const generatedKey = `MR-${cleanEmail || 'USER'}-${randomSuffix}`;
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { referralKey: generatedKey });
          console.log('[Referral] Auto-generated and saved key:', generatedKey);
        } catch (e) {
          console.error('[Referral] Error saving auto-generated key:', e);
        }
      };
      generateKey();
    }
  }, [user, profile]);

  // Hook to watch for when isPremium changes to true and trigger referral reward if applicable
  useEffect(() => {
    if (user && profile && profile.isPremium && profile.usedReferralKey && !profile.referralRewardGranted) {
      const grantPendingReferralReward = async () => {
        try {
          console.log('[Referral] User is premium, attempting to grant reward for key:', profile.usedReferralKey);
          
          // Find the key owner
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('referralKey', '==', profile.usedReferralKey.trim().toUpperCase()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const friendDoc = querySnapshot.docs[0];
            const friendUid = friendDoc.id;
            const friendData = friendDoc.data();
            
            if (friendUid !== user.uid) {
              // Calculate new expiration date (+5 days bonus added to current plan)
              let newUntilDate: Date;
              const nowMs = Date.now();
              
              if (friendData.premiumUntil) {
                const currentUntilMs = new Date(friendData.premiumUntil).getTime();
                const baseMs = currentUntilMs > nowMs ? currentUntilMs : nowMs;
                newUntilDate = new Date(baseMs + 5 * 24 * 60 * 60 * 1000);
              } else {
                newUntilDate = new Date(nowMs + 5 * 24 * 60 * 60 * 1000);
              }
              
              const friendRef = doc(db, 'users', friendUid);
              
              // Build notification array
              const currentNotifications = Array.isArray(friendData.referralNotifications) ? friendData.referralNotifications : [];
              const newNotification = {
                id: Math.random().toString(36).substring(2, 9),
                fromName: profile.displayName || 'Um usuário indicado',
                date: new Date().toISOString(),
                type: 'bonus_received',
                daysGranted: 5
              };
              
              await updateDoc(friendRef, {
                isPremium: true,
                premiumUntil: newUntilDate.toISOString(),
                referralNotifications: [...currentNotifications, newNotification]
              });
              
              console.log('[Referral] Friend updated successfully with +5 days bonus and notification.');
              
              // Log to referralLogs collection
              try {
                const logsRef = collection(db, 'referralLogs');
                await addDoc(logsRef, {
                  usedByUid: user.uid,
                  usedByName: profile.displayName || 'Usuário Desconhecido',
                  usedByEmail: profile.email || 'N/A',
                  friendUid: friendUid,
                  friendName: friendData.displayName || 'Amigo Desconhecido',
                  friendEmail: friendData.email || 'N/A',
                  referralKey: profile.usedReferralKey.trim().toUpperCase(),
                  createdAt: serverTimestamp(),
                  status: 'reward_granted',
                  type: 'premium_activation',
                  daysGranted: 5
                });
              } catch (logErr) {
                console.error('[Referral] Error creating referral log:', logErr);
              }
            }
          }
          
          // Mark as granted for current user
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { referralRewardGranted: true });
          console.log('[Referral] Current user referral reward marked as GRANTED.');
        } catch (err) {
          console.error('[Referral] Error granting referral bonus on premium state detect:', err);
        }
      };
      
      grantPendingReferralReward();
    }
  }, [user, profile]);

  const handleApplyReferralKey = async () => {
    if (!enteredReferralKey.trim()) return;
    setIsApplyingReferral(true);
    setReferralFeedback(null);
    try {
      const cleanKey = enteredReferralKey.trim().toUpperCase();
      
      if (profile.referralKey && cleanKey === profile.referralKey.toUpperCase()) {
        setReferralFeedback({ type: 'error', message: 'Você não pode utilizar a sua própria chave de compartilhamento.' });
        setIsApplyingReferral(false);
        return;
      }
      
      if (profile.usedReferralKey) {
        setReferralFeedback({ type: 'error', message: 'Você já utilizou uma chave de indicação nesta conta.' });
        setIsApplyingReferral(false);
        return;
      }
      
      // Query to find if key owner exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('referralKey', '==', cleanKey));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setReferralFeedback({ type: 'error', message: 'Chave de indicação inválida ou não encontrada. Verifique se digitou corretamente.' });
        setIsApplyingReferral(false);
        return;
      }
      
      const friendDoc = querySnapshot.docs[0];
      const friendUid = friendDoc.id;
      const friendData = friendDoc.data();
      
      if (friendUid === user.uid) {
        setReferralFeedback({ type: 'error', message: 'Você não pode utilizar a sua própria chave.' });
        setIsApplyingReferral(false);
        return;
      }
      
      // Validated! Let's save key link on current user's profile as pending payment
      const userRef = doc(db, 'users', user.uid);
      
      await updateDoc(userRef, {
        usedReferralKey: cleanKey,
        referralOwnerUid: friendUid,
        referralRewardGranted: false
      });
      
      setReferralFeedback({
        type: 'success',
        message: `Chave ${cleanKey} vinculada com sucesso! O dono da chave (${friendData.displayName || 'Usuário'}) receberá +5 dias adicionais no plano atual assim que o seu pagamento for confirmado.`
      });
      
      setEnteredReferralKey('');
    } catch (err: any) {
      console.error('[Referral] Error applying referral key:', err);
      setReferralFeedback({ type: 'error', message: 'Erro ao processar ativação de chave. Tente novamente mais tarde.' });
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleClearNotifications = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { referralNotifications: [] });
    } catch (err) {
      console.error('Error clearing referral notifications:', err);
    }
  };

  const getRemainingDays = () => {
    if (isLucas || profile.isLifetimePremium) return 'ilimitado';
    
    let expiryDate: Date | null = null;
    
    if (profile.premiumUntil) {
      expiryDate = new Date(profile.premiumUntil);
    } else if (profile.premiumSince) {
      let premiumSinceDate: Date | null = null;
      if (profile.premiumSince instanceof Date) {
        premiumSinceDate = profile.premiumSince;
      } else if (profile.premiumSince && typeof profile.premiumSince.toDate === 'function') {
        premiumSinceDate = profile.premiumSince.toDate();
      } else if (profile.premiumSince && typeof profile.premiumSince.seconds === 'number') {
        premiumSinceDate = new Date(profile.premiumSince.seconds * 1000);
      } else {
        premiumSinceDate = new Date(profile.premiumSince);
      }
      
      if (premiumSinceDate && !isNaN(premiumSinceDate.getTime())) {
        expiryDate = new Date(premiumSinceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }
    
    if (expiryDate && !isNaN(expiryDate.getTime())) {
      const diffTime = expiryDate.getTime() - Date.now();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    
    return 0;
  };
  
  const remainingDays = getRemainingDays();

  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    return localStorage.getItem('profile_auto_select_plan') || 'med_revise_pro';
  });

  useEffect(() => {
    const autoSelect = localStorage.getItem('profile_auto_select_plan');
    if (autoSelect) {
      setSelectedPlanId(autoSelect);
      localStorage.removeItem('profile_auto_select_plan');
    }
  }, []);

  useEffect(() => {
    const handleAutoSelect = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSelectedPlanId(customEvent.detail);
        localStorage.removeItem('profile_auto_select_plan');
      }
    };
    window.addEventListener('auto-select-plan', handleAutoSelect);
    return () => window.removeEventListener('auto-select-plan', handleAutoSelect);
  }, []);

  const PLANS = [
    {
      id: 'med_revise_pro',
      name: 'MedRevise Pro',
      price: 19.90,
      priceStr: 'R$ 19,90/mês',
      desc: 'SRS ilimitado, matérias, tópicos, simulações de estudos e gráficos no MedRevise (10 créditos/dia de IA, igual ao Gratuito).',
      badge: 'Foco em Fixação'
    },
    {
      id: 'med_internato_premium',
      name: 'Internato Premium',
      price: 39.90,
      priceStr: 'R$ 39,90/mês',
      desc: 'Banco de questões clínicas, casos práticos simulados e mentor de conduta no MedInternato.',
      badge: 'Clínico e Prático'
    },
    {
      id: 'combo_ouro',
      name: 'Combo Ouro 👑',
      price: 49.90,
      priceStr: 'R$ 49,90/mês',
      desc: 'Acesso Pro INTEGRADO a AMBAS as plataformas. Melhor custo-benefício (Poupe 20%!).',
      badge: 'Completo / Recomendado'
    }
  ];

  const currentPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];

  if (!user || !profile) return null;

  const isPremiumUser = profile.isPremium || profile.email === 'lucas1renck2melo@gmail.com';

  // Countdown timer logic
  useEffect(() => {
    if (!pixGenerated || isPremiumUser) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPixGenerated(false);
          setPixQrCode('');
          setPixQrBase64('');
          return 900;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pixGenerated, isPremiumUser]);

  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRealPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingPix(true);
    setPaymentError('');
    try {
      const targetEmail = profile.email || user.email || 'usuario@medrevise.com.br';
      const cleanCpf = cpf.replace(/\D/g, '');
      if (!cleanCpf || cleanCpf.length !== 11) {
        throw new Error('O CPF do titular é obrigatório para a emissão do Pix e deve conter exatamente 11 números.');
      }

      console.log('[MercadoPago Pix] Dispatching payload to Backend...');
      const res = await fetch('/api/mercadopago/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: targetEmail,
          cpf: cleanCpf,
          firstName: firstName,
          lastName: lastName,
          planType: selectedPlanId
        })
      });

      if (!res.ok) {
        let errMsg = 'Erro na comunicação do servidor de faturamento Pix.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.qr_code) {
        setPixQrCode(data.qr_code);
        setPixQrBase64(data.qr_code_base64 || '');
        setPixPaymentId(data.id || '');
        setPixGenerated(true);
        setTimeLeft(900); // Reset countdown
      } else {
        throw new Error('Retorno da transação inválido pelo Mercado Pago.');
      }
    } catch (err: any) {
      console.error('[Pix Payment Creation Error]', err);
      setPaymentError(err?.message || 'Erro ao gerar Pix de cobrança. Verifique as credenciais ou dados.');
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCheckPixStatus = async () => {
    setCheckingStatus(true);
    setCheckingStatusMessage('Consultando compensação bancária em tempo real...');
    try {
      if (pixPaymentId) {
        console.log('[Check Pix Status] Querying backend check-payment endpoint for paymentId:', pixPaymentId);
        const res = await fetch(`/api/mercadopago/check-payment/${pixPaymentId}?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isPremium || data.status === 'approved') {
            try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                isPremium: true,
                premiumPlan: selectedPlanId,
                premiumPaymentId: String(pixPaymentId),
                premiumProvider: 'MercadoPago',
                premiumSince: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              console.log('[Check Pix Status] Updated user doc on client side successfully.');
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ai-credits-updated'));
              }
            } catch (clientErr) {
              console.error('[Check Pix Status] Client-side Firestore update error:', clientErr);
            }
            setCheckingStatusMessage('✓ Sucesso de compensação detectado! Conta atualizada para Pro.');
            setCheckingStatus(false);
            return;
          }
        }
      }

      // Fallback
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data()?.isPremium) {
        setCheckingStatusMessage('✓ Sucesso de compensação detectado! Conta atualizada para Pro.');
      } else {
        setCheckingStatusMessage('✗ Recebimento pendente ou em análise. Tente novamente em alguns segundos.');
      }
    } catch (err) {
      console.error('[Check status error]', err);
      setCheckingStatusMessage('Erro de conexão ao verificar recebimento.');
    } finally {
      setCheckingStatus(false);
      setTimeout(() => setCheckingStatusMessage(''), 8000);
    }
  };

  const handleRealCheckout = async () => {
    setProcessingPayment(true);
    setPaymentError('');
    setCheckoutUrl('');
    try {
      const targetEmail = profile.email || user.email || 'usuario@medrevise.com.br';
      console.log('[MercadoPago] Initiating preference creation via endpoint...');
      const res = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: targetEmail,
          planType: selectedPlanId
        })
      });

      if (!res.ok) {
        let errMsg = 'Não foi possível registrar a preferência de pagamento no servidor.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.init_point) {
        console.log('[MercadoPago] Redirecting user to:', data.init_point);
        setCheckoutUrl(data.init_point);
        
        const mpWindow = window.open(data.init_point, '_blank');
        if (!mpWindow || mpWindow.closed || typeof mpWindow.closed === 'undefined') {
          console.warn('[MercadoPago] Popup blocker detected or active sandbox restriction.');
        }
      } else {
        throw new Error('Endpoint de pagamento não retornou um link de checkout válido.');
      }
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      setPaymentError(err?.message || 'Erro de comunicação ao contactar Mercado Pago. Tente novamente.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResetData = async () => {
    if (!user) return;
    if (!confirm('ATENÇÃO: Isso excluirá permanentemente TODAS as suas matérias, tópicos, sessões de estudo, cronograma e eventos. Esta ação NÃO pode ser desfeita. Deseja continuar?')) {
      return;
    }

    setIsResetting(true);
    try {
      const collections = ['subjects', 'topics', 'studySessions', 'calendarEvents', 'collegeSchedule'];
      
      for (const collName of collections) {
        const querySnapshot = await getDocs(collection(db, 'users', user.uid, collName));
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      alert('Todos os dados foram resetados com sucesso. O sistema começará do zero.');
      window.location.reload();
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('Erro ao resetar dados.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'settings.dailyGoalMinutes': dailyGoal,
        'settings.residencyFocusType': residencyFocusType,
        'settings.residencyFocus': residencyFocus
      });
      safeLocalStorageSet('user_residency_focus', residencyFocus);
      safeLocalStorageSet('user_residency_focus_type', residencyFocusType);
      alert('Configurações salvas com sucesso! Seus novos resumos e questões gerados a partir de agora utilizarão o seu foco personalizado.');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  let validUntilString = 'Mensal / Renovação ativa';
  
  if (isLucas || profile.isLifetimePremium) {
    validUntilString = 'Vitalício / Sincronia ativa';
  } else if (profile.premiumSince) {
    let premiumSinceDate: Date | null = null;
    
    if (profile.premiumSince instanceof Date) {
      premiumSinceDate = profile.premiumSince;
    } else if (profile.premiumSince && typeof profile.premiumSince.toDate === 'function') {
      premiumSinceDate = profile.premiumSince.toDate();
    } else if (profile.premiumSince && typeof profile.premiumSince.seconds === 'number') {
      premiumSinceDate = new Date(profile.premiumSince.seconds * 1000);
    } else if (typeof profile.premiumSince === 'string') {
      premiumSinceDate = new Date(profile.premiumSince);
    } else if (typeof profile.premiumSince === 'number') {
      premiumSinceDate = new Date(profile.premiumSince);
    }

    if (premiumSinceDate && !isNaN(premiumSinceDate.getTime())) {
      const expiryDate = new Date(premiumSinceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      validUntilString = `Mensal (Ativo até ${format(expiryDate, 'dd/MM/yyyy')})`;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/50 font-bold">Painel do Estudante & Faturamento Coesivo</span>
          <h2 className="font-serif italic text-3xl font-extrabold text-[#141414] mt-1">Sua Conta & Assinatura</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-400 uppercase font-bold">Status do Perfil:</span>
          <span className={`px-2.5 py-1 border font-mono text-[10px] font-bold uppercase tracking-wider ${
            isPremiumUser 
              ? 'bg-yellow-50 border-yellow-300 text-yellow-800' 
              : 'bg-neutral-50 border-neutral-300 text-neutral-400'
          }`}>
            {isPremiumUser ? '★ MEDREVISE PRO' : 'USUÁRIO FREE'}
          </span>
        </div>
      </div>

      {/* Referral notifications received banner/alert */}
      {profile.referralNotifications && profile.referralNotifications.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border-2 border-[#141414] p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] text-[#141414] space-y-4 rounded-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-1 bg-[#141414] text-[#FFC72C] font-mono text-[7px] uppercase font-bold px-2">NOTIFICAÇÃO PREMIADA</div>
          <div className="flex gap-4 items-start">
            <Sparkles className="text-yellow-600 shrink-0 mt-1 animate-bounce" size={28} />
            <div className="space-y-1">
              <h4 className="font-serif italic text-lg font-bold">Parabéns! Sua Chave de Compartilhamento foi Utilizada! 🌟</h4>
              <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                Seu colega utilizou sua chave de acesso e assinou a plataforma. Como recompensa, <strong>você acaba de receber +5 dias de extensão no seu plano cadastrado</strong>! Seu acesso foi estendido com sucesso na nuvem.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleClearNotifications}
                  className="bg-[#141414] hover:bg-neutral-850 text-white px-4 py-2 font-mono text-[9.5px] uppercase font-bold tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
                >
                  Entendi, Obrigado! ✓
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Profile Card & Goals */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Profile Info Banner */}
          <div className="bg-white border border-[#141414] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {profile.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.displayName || ''} 
                  className="w-24 h-24 sm:w-28 sm:h-28 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] bg-neutral-100 object-cover"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] bg-neutral-100 flex items-center justify-center font-bold text-3xl">
                  {profile.displayName ? profile.displayName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="flex-1 space-y-4 min-w-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif italic text-2xl sm:text-3xl font-extrabold truncate">{profile.displayName}</h2>
                    <span className={`px-2 py-0.5 border font-mono text-[8.5px] font-bold uppercase ${
                      isPremiumUser 
                        ? 'bg-yellow-50 border-yellow-250 text-yellow-800' 
                        : 'bg-neutral-50 border-neutral-250 text-neutral-400'
                    }`}>
                      {isPremiumUser ? '★ PRO' : 'FREE'}
                    </span>
                  </div>
                  <p className="font-mono text-xs opacity-50 uppercase tracking-widest mt-1">Estudante MedRevise</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoItem icon={<Mail size={13} />} label="EMAIL" value={profile.email || 'N/A'} />
                  <InfoItem icon={<Calendar size={13} />} label="MEMBRO DESDE" value={profile.createdAt ? format(parseISO(profile.createdAt), 'dd/MM/yyyy') : 'N/A'} />
                </div>
              </div>
            </div>
          </div>

          {/* Goals Settings Card */}
          <div className="bg-white border border-[#141414] p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#141414]/10 pb-3">
              <Target size={18} className="text-neutral-700" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">Metas Diárias de Estudo</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block font-mono text-[9.5px] opacity-65 uppercase mb-2">Meta Diária de Estudos (Minutos/dia)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="10"
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="w-full border border-[#141414] p-3 font-mono text-sm focus:outline-none focus:bg-[#141414]/5"
                  />
                </div>
                <p className="text-[10px] font-sans text-neutral-400 mt-2">Personalize sua meta de revisão diária de acordo com o seu cronograma.</p>
              </div>
              
              <button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full bg-[#141414] text-[#E4E3E0] py-3.5 font-mono text-[10px] uppercase tracking-widest hover:bg-neutral-900 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] font-bold active:translate-y-0.5 active:shadow-none"
              >
                <Save size={14} />
                {isSaving ? 'SALVANDO CONFIGURAÇÕES...' : 'SALVAR META DIÁRIA'}
              </button>
            </div>
          </div>

          {/* Residency Focus Settings Card */}
          <div className="bg-white border border-[#141414] p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#141414]/10 pb-3">
              <Brain size={18} className="text-neutral-700" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">Foco em Residências e Hospitais</h3>
            </div>
            
            <div className="space-y-6">
              <p className="text-xs text-neutral-650 leading-relaxed font-sans">
                Seus resumos acadêmicos, flashcards e questões gerados por Inteligência Artificial serão direcionados especificamente para as provas e hospitais selecionados abaixo.
              </p>

              <div className="space-y-3">
                <label className="block font-mono text-[9.5px] opacity-65 uppercase font-bold">Tipo de Direcionamento</label>
                
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 border border-[#141414] bg-neutral-50/50 cursor-pointer hover:bg-neutral-50 select-none">
                    <input 
                      type="radio" 
                      name="residencyFocusType" 
                      value="standard" 
                      checked={residencyFocusType === 'standard'}
                      onChange={() => {
                        setResidencyFocusType('standard');
                        setResidencyFocus('Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)');
                      }}
                      className="mt-1"
                    />
                    <div>
                      <span className="block font-serif italic text-xs font-bold text-[#141414]">Foco Padrão (Centro-Oeste)</span>
                      <span className="block text-[10px] text-neutral-500 font-sans mt-0.5">UFG, SES-GO, SES-DF, UnB, ENARE</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 border border-[#141414] bg-neutral-50/50 cursor-pointer hover:bg-neutral-50 select-none">
                    <input 
                      type="radio" 
                      name="residencyFocusType" 
                      value="custom" 
                      checked={residencyFocusType === 'custom'}
                      onChange={() => {
                        setResidencyFocusType('custom');
                        if (residencyFocus === 'Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)') {
                          setResidencyFocus('ENARE, USP-SP, SUS-SP');
                        }
                      }}
                      className="mt-1"
                    />
                    <div>
                      <span className="block font-serif italic text-xs font-bold text-[#141414]">Foco Personalizado (Escolha as Bancas & Hospitais)</span>
                      <span className="block text-[10px] text-neutral-500 font-sans mt-0.5">Selecione ou escreva seus próprios hospitais de destino</span>
                    </div>
                  </label>
                </div>
              </div>

              {residencyFocusType === 'custom' && (
                <div className="space-y-4 border-l-2 border-[#141414] pl-4 py-1">
                  <div className="space-y-2">
                    <label className="block font-mono text-[9px] opacity-65 uppercase font-bold">Selecione Bancas Populares para Adicionar:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['ENARE', 'USP-SP', 'SUS-SP', 'UNICAMP', 'UNIFESP', 'UFRJ', 'PSU-MG', 'SURCE', 'AMRIGS', 'UFG', 'UnB', 'SES-DF', 'SES-GO', 'Albert Einstein', 'Sírio-Libanês'].map((inst) => {
                        const items = residencyFocus.split(',').map(s => s.trim()).filter(Boolean);
                        const isSelected = items.includes(inst);
                        
                        const handleToggle = () => {
                          let newItems;
                          if (isSelected) {
                            newItems = items.filter(x => x !== inst);
                          } else {
                            newItems = [...items, inst];
                          }
                          setResidencyFocus(newItems.join(', '));
                        };

                        return (
                          <button
                            key={inst}
                            type="button"
                            onClick={handleToggle}
                            className={`px-2 py-1 text-[10px] font-mono border transition-all ${
                              isSelected 
                                ? 'bg-[#141414] text-white border-black font-bold' 
                                : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{inst}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-mono text-[9px] opacity-65 uppercase font-bold">Escreva/Ajuste Seu Foco de Residência (Seus Alvos):</label>
                    <input 
                      type="text" 
                      value={residencyFocus}
                      onChange={(e) => setResidencyFocus(e.target.value)}
                      placeholder="Ex: USP-SP, ENARE, Hospital Albert Einstein"
                      className="w-full border border-[#141414] p-3 font-mono text-sm focus:outline-none focus:bg-[#141414]/5"
                    />
                    <p className="text-[10px] font-sans text-neutral-400">
                      Você pode escrever livremente os nomes de hospitais, provas ou estados, separados por vírgula. A Inteligência Artificial fará o alinhamento total do conteúdo com base neste texto.
                    </p>
                  </div>
                </div>
              )}

              <button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full bg-[#141414] text-[#E4E3E0] py-3.5 font-mono text-[10px] uppercase tracking-widest hover:bg-neutral-900 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] font-bold active:translate-y-0.5 active:shadow-none"
              >
                <Save size={14} />
                {isSaving ? 'SALVANDO CONFIGURAÇÕES...' : 'SALVAR META E FOCO'}
              </button>
            </div>
          </div>

          {/* Interactive Walkthrough Tour Card */}
          <div className="bg-cyan-50 border-2 border-dashed border-cyan-300 p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] text-[#141414]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-[#141414] shrink-0 animate-pulse" size={20} />
              <h3 className="font-serif italic text-xl font-bold">Aprenda a Usar o MedRevise 🎓</h3>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed font-sans mb-5">
              Fizemos um tour rápido interativo para você compreender a dinâmica científica de repetições espaçadas, cadastrar suas matérias e bater suas metas diárias. Deseja reatar essa introdução guiada?
            </p>
            <button 
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('start-onboarding-tour'));
              }}
              className="bg-[#141414] text-white py-3 px-5 font-mono text-[10px] uppercase font-bold tracking-widest hover:bg-neutral-850 hover:shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none transition-all shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] cursor-pointer"
            >
              Reatar Tutorial do Site ➔
            </button>
          </div>

          {/* Referral & Share Key System Card */}
          <div className="bg-white border border-[#141414] p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-6">
            <div className="flex items-center gap-2 mb-2 border-b border-[#141414]/10 pb-3">
              <QrCode size={18} className="text-neutral-700" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#141414]">Compartilhamento & Indicações</h3>
            </div>
            
            <p className="text-xs text-neutral-600 leading-relaxed font-sans">
              Compartilhe o MedRevise com seus amigos e colegas de internato! Se algum colega assinar qualquer plano utilizando a sua chave exclusiva de acesso, <strong>você receberá +5 dias adicionais no seu plano atual</strong> por cada indicação!
            </p>

            {/* User's own key */}
            <div className="p-4 bg-yellow-50/30 border border-yellow-200 space-y-2 rounded">
              <span className="block text-[8.5px] font-mono text-yellow-800 uppercase font-bold tracking-wider">Sua Chave de Compartilhamento Exclusiva:</span>
              <div className="flex gap-2">
                <span className="flex-1 font-mono text-sm font-bold bg-white border border-neutral-300 px-3 py-2 text-neutral-800 rounded flex items-center tracking-wider select-all">
                  {profile.referralKey || 'Gerando sua chave...'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (profile.referralKey) {
                      navigator.clipboard.writeText(profile.referralKey);
                      setReferralCopied(true);
                      setTimeout(() => setReferralCopied(false), 2000);
                    }
                  }}
                  className="px-4 bg-[#141414] hover:bg-neutral-850 text-white font-mono text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
                >
                  {referralCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {referralCopied ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Enter a friend's key */}
            <div className="space-y-3 pt-2">
              <label className="block text-[9px] font-mono text-neutral-450 uppercase font-bold tracking-wider">Inserir Chave de Indicação recebida:</label>
              {profile.usedReferralKey ? (
                <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-850 text-xs flex items-center gap-2 rounded">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Você utilizou a chave <strong className="font-mono">{profile.usedReferralKey}</strong>. Apoio registrado!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: MR-LUCAS-ABCD"
                      value={enteredReferralKey}
                      onChange={(e) => setEnteredReferralKey(e.target.value)}
                      className="flex-1 border border-[#141414] p-2.5 font-mono text-xs uppercase tracking-wider focus:outline-none focus:bg-[#141414]/5 rounded"
                    />
                    <button
                      type="button"
                      onClick={handleApplyReferralKey}
                      disabled={isApplyingReferral || !enteredReferralKey.trim()}
                      className="px-4 bg-[#141414] hover:bg-neutral-850 disabled:opacity-40 text-white font-mono text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] font-bold flex items-center justify-center"
                    >
                      {isApplyingReferral ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                  {referralFeedback && (
                    <div className={`p-2.5 border text-xs font-sans rounded ${
                      referralFeedback.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-850' 
                        : 'bg-rose-50 border-rose-250 text-rose-850'
                    }`}>
                      {referralFeedback.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Embedded Subscription / Billing Gateways */}
        <div className="lg:col-span-5 space-y-8">
          <AnimatePresence mode="wait">
            {isPremiumUser ? (
              /* Active Premium banner */
              <motion.div 
                key="active-premium"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white border-2 border-[#141414] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6"
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-[#141414]/10">
                    <ShieldCheck className="text-yellow-600 shrink-0" size={32} />
                    <div>
                      <h4 className="font-serif italic text-lg font-bold">Sua Assinatura: Pro</h4>
                      <p className="text-[10px] font-mono text-neutral-400 uppercase font-bold text-[8px]">SINCERIDADE & ACESSO LIBERADO</p>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-250 rounded">
                    <span className="block text-[8px] font-mono text-emerald-600 uppercase font-bold">Status da Conta</span>
                    <span className="block font-serif text-lg font-bold text-emerald-950 mt-1">Acesso Pro Habilitado</span>
                    <span className="block text-[11px] font-sans text-neutral-650 mt-2 leading-relaxed">
                      Sua conta possui matérias, assuntos/tópicos, relatórios estendidos e calendários científicos 100% integrados e ilimitados.
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-neutral-650 font-sans">
                    <div className="flex justify-between font-mono py-1.5 border-b border-dashed border-[#141414]/10">
                      <span>Plano Técnico:</span>
                      <span className="text-neutral-900 font-bold">MedRevise Pro</span>
                    </div>
                    <div className="flex justify-between font-mono py-1.5 border-b border-dashed border-[#141414]/10">
                      <span>Valor Estimado:</span>
                      <span className="text-neutral-900 font-bold">R$ 19,90 / mês</span>
                    </div>
                    <div className="flex justify-between font-mono py-1.5 border-b border-dashed border-[#141414]/10">
                      <span>Validade:</span>
                      <span className="text-neutral-900 font-bold">{validUntilString}</span>
                    </div>
                    <div className="flex justify-between font-mono py-1.5 border-b border-dashed border-[#141414]/10 bg-yellow-500/10 px-2 rounded font-bold text-yellow-950">
                      <span>Dias Restantes:</span>
                      <span className="font-mono uppercase tracking-wider">
                        {remainingDays === 'ilimitado' ? 'Vitalício ♾️' : `${remainingDays} dias`}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono py-1.5">
                      <span>Provedor:</span>
                      <span className="text-sky-700 font-bold font-mono">Mercado Pago</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed border-neutral-200">
                  <p className="text-[10px] text-neutral-400 font-mono leading-relaxed text-center uppercase tracking-wider">
                    Assinatura gerenciada e sincronizada de forma estável na nuvem.
                  </p>
                </div>
              </motion.div>
            ) : (
              /* Checkout form widget directly on billing column */
              <motion.div 
                key="checkout-selector"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white border-2 border-[#141414] p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#141414]/10">
                    <Sparkles className="text-[#141414] shrink-0 animate-pulse" size={24} />
                    <div>
                      <h4 className="font-serif italic text-lg font-bold">Assinar {currentPlan.name}</h4>
                      <p className="text-[10px] font-mono text-indigo-750 font-bold uppercase">VALOR: {currentPlan.priceStr}</p>
                    </div>
                  </div>

                  {/* Dynamic Interactive Plan Selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block font-bold">Selecione o plano desejado:</span>
                    <div className="space-y-1.5">
                      {PLANS.map((p) => {
                        const isSelected = selectedPlanId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPlanId(p.id);
                              // Reset generated checkouts on plan shift so they generate the correct amount
                              setPixGenerated(false);
                              setCheckoutUrl('');
                            }}
                            className={`border-2 p-2.5 cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected 
                                ? 'border-[#141414] bg-indigo-50/25 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)]' 
                                : 'border-neutral-200 hover:border-neutral-350 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="font-serif italic text-xs font-bold text-[#141414]">{p.name}</span>
                                  {p.badge && (
                                    <span className="px-1 py-0.5 bg-[#141414]/5 text-[7px] font-mono font-bold uppercase border border-[#141414]/20 rounded-none">
                                      {p.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9.5px] text-neutral-500 font-sans mt-0.5 leading-tight">{p.desc}</p>
                              </div>
                              <span className="font-mono text-[10.5px] font-bold text-neutral-800 shrink-0">{p.priceStr}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-1 border-2 border-[#141414]">
                    <button
                      type="button"
                      onClick={() => setActiveTab('pix')}
                      className={`py-1.5 text-[9.5px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'pix'
                          ? 'bg-[#FFC72C] text-[#141414] border-b-2 border-[#141414]'
                          : 'text-neutral-500 hover:text-neutral-900 bg-transparent'
                      }`}
                    >
                      <QrCode size={12} />
                      Pix Instantâneo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('mercadopago')}
                      className={`py-1.5 text-[9.5px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'mercadopago'
                          ? 'bg-[#FFC72C] text-[#141414] border-b-2 border-[#141414]'
                          : 'text-neutral-500 hover:text-neutral-900 bg-transparent'
                      }`}
                    >
                      <CreditCard size={12} />
                      Mercado Pago
                    </button>
                  </div>

                  {activeTab === 'pix' ? (
                    <div className="space-y-4">
                      {pixGenerated ? (
                        <div className="space-y-4 animate-fade-in">
                          <div className="p-3 bg-yellow-50 border border-yellow-250 text-[11px] leading-relaxed text-neutral-700 font-sans">
                            Escaneie o QR Code ou use a chave copia/cola. Atualização de conta automática em tempo real.
                          </div>

                          <div className="border border-[#141414] p-4 bg-white flex flex-col items-center justify-center space-y-3 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-emerald-500 opacity-60 animate-bounce" style={{ animationDuration: '3.3s' }} />

                            {pixQrBase64 ? (
                              <div className="p-1 bg-neutral-50 border border-neutral-250">
                                <img 
                                  src={`data:image/png;base64,${pixQrBase64}`} 
                                  alt="Mercado Pago QR Code PIX" 
                                  className="w-36 h-36 select-none pointer-events-none"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="w-36 h-36 border border-neutral-300 bg-neutral-50 flex items-center justify-center font-mono text-[9px] text-neutral-400">
                                QR Code Indisponível
                              </div>
                            )}

                            <div className="text-center space-y-1 w-full">
                              <div className="flex items-center justify-center gap-1.5 text-amber-600 font-mono text-[10px] font-bold">
                                <Hourglass size={12} className="animate-spin" />
                                <span>Vence em: {formatTime(timeLeft)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">Código Pix Copia e Cola:</span>
                            <div className="flex gap-1">
                              <input 
                                type="text" 
                                readOnly 
                                value={pixQrCode}
                                className="flex-1 text-[9px] font-mono bg-neutral-50 border border-neutral-300 p-2 truncate outline-none select-all"
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(pixQrCode)}
                                className="px-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-[10.5px] font-mono font-bold flex items-center gap-1"
                              >
                                {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                                {copied ? 'Copiado' : 'Copiar'}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCheckPixStatus}
                              disabled={checkingStatus}
                              className="py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-[10px] font-bold uppercase border border-[#141414] shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {checkingStatus ? <Cpu className="animate-spin" size={12} /> : <Check size={12} />}
                              Verificar Status
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPixGenerated(false);
                                setPixQrCode('');
                                setPixQrBase64('');
                              }}
                              className="py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-mono text-[10px] font-bold uppercase border border-neutral-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Voltar
                            </button>
                          </div>

                          {checkingStatusMessage && (
                            <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[9.5px] font-mono text-center rounded animate-pulse">
                              {checkingStatusMessage}
                            </div>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleCreateRealPix} className="space-y-4 animate-fade-in">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-[#141414] uppercase font-bold">Primeiro Nome:</label>
                                <input 
                                  type="text"
                                  required
                                  value={firstName}
                                  onChange={(e) => setFirstName(e.target.value)}
                                  placeholder="Lucas"
                                  className="w-full text-xs font-mono bg-white border border-[#141414] p-2 outline-none focus:bg-yellow-50/10 transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-[#141414] uppercase font-bold">Sobrenome:</label>
                                <input 
                                  type="text"
                                  required
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  placeholder="Melo"
                                  className="w-full text-xs font-mono bg-white border border-[#141414] p-2 outline-none focus:bg-yellow-50/10 transition-all"
                                />
                              </div>
                            </div>

                             <div className="space-y-1">
                              <label className="text-[10px] font-mono text-[#141414] uppercase font-bold">CPF do Titular (Obrigatório para o Pix):</label>
                              <input 
                                type="text"
                                required
                                value={cpf}
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(/\D/g, '');
                                  if (rawVal.length <= 11) setCpf(rawVal);
                                }}
                                placeholder="00000000000 (Apenas números)"
                                className="w-full text-xs font-mono bg-white border border-[#141414] p-2 outline-none focus:bg-yellow-50/10 transition-all"
                              />
                            </div>

                            {/* Referral / User Code Field */}
                            <div className="space-y-1.5 p-2.5 bg-neutral-50 border border-[#141414]">
                              <label className="text-[9.5px] font-mono uppercase tracking-wider font-bold text-neutral-700 block">
                                Código de Indicação / Cupom do Usuário (Opcional):
                              </label>
                              {profile.usedReferralKey ? (
                                <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold flex items-center justify-between">
                                  <span>✓ Código ativado: <strong>{profile.usedReferralKey}</strong></span>
                                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Ativo</span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex gap-1">
                                    <input 
                                      type="text"
                                      value={enteredReferralKey}
                                      onChange={(e) => setEnteredReferralKey(e.target.value.toUpperCase())}
                                      placeholder="Ex: CÓDIGO-DO-AMIGO"
                                      className="flex-1 text-xs font-mono uppercase bg-white border border-[#141414] p-1.5 outline-none focus:bg-yellow-50/10"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleApplyReferralKey}
                                      disabled={isApplyingReferral || !enteredReferralKey.trim()}
                                      className="px-3 py-1.5 bg-[#141414] hover:bg-neutral-800 text-white font-mono text-[10px] font-bold uppercase transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                      {isApplyingReferral ? 'Aplicando...' : 'Aplicar'}
                                    </button>
                                  </div>
                                  {referralFeedback && (
                                    <p className={`text-[9.5px] font-mono font-bold mt-1 ${referralFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                      {referralFeedback.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={generatingPix}
                            className="w-full text-center py-3.5 bg-[#141414] hover:bg-neutral-800 disabled:opacity-50 text-white font-mono text-[11px] font-bold uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer font-extrabold"
                          >
                            {generatingPix ? (
                              <>
                                <Cpu className="animate-spin text-yellow-500" size={13} />
                                GERANDO INFRAESTRUTURA PIX...
                              </>
                            ) : (
                              <>
                                <Zap size={13} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                                GERAR COBRANÇA PIX DE {currentPlan.priceStr}
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[11px] text-neutral-600 font-sans leading-relaxed">
                        Abra de forma segura seu faturamento via Mercado Pago. Transação real e segura com suporte a cartões e boleto.
                      </p>

                      {checkoutUrl ? (
                        <div className="p-3.5 bg-yellow-50 border-2 border-[#141414] text-xs space-y-3 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] text-[#141414]">
                          <span className="font-mono text-amber-955 font-bold uppercase text-[9px] block">⚡ FATURAMENTO AGENDADO COM SUCESSO:</span>
                          
                          <a 
                            href={checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-center py-3.5 bg-[#FFC72C] hover:bg-[#E5B224] text-black font-mono text-[10.5px] uppercase cursor-pointer border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] flex items-center justify-center gap-2 font-black"
                          >
                            <Sparkles size={13} className="text-[#141414] animate-pulse" />
                            ABRIR CHECKOUT SEGURO ↗
                          </a>
                        </div>
                      ) : (
                        <button 
                          onClick={handleRealCheckout}
                          disabled={processingPayment}
                          className="w-full text-center py-3.5 bg-[#141414] text-white font-mono text-[11px] font-bold uppercase tracking-widest cursor-pointer disabled:opacity-50 transition-all shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] flex items-center justify-center gap-2"
                        >
                          {processingPayment ? (
                            <>
                              <Cpu className="animate-spin text-yellow-500" size={13} />
                              ABRINDO PLATAFORMA...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} className="text-yellow-400 animate-pulse" />
                              PROSSEGUIR PARA CHECKOUT SEGURO
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {paymentError && (
                    <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[9.5px] font-mono rounded">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Selective Data Cleanup Tool */}
      <div className="bg-white border-2 border-[#141414] p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] rounded-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#141414]/15 pb-3">
          <div className="text-left">
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 font-bold">Autonomia & Governança de Dados</span>
            <h3 className="font-serif italic text-lg font-bold text-[#141414] mt-0.5">Limpeza Seletiva de Matérias & Histórico</h3>
            <p className="text-xs text-neutral-500 font-sans mt-0.5">
              Utilize esta ferramenta para excluir rapidamente matérias duplicadas ou importadas por engano, junto com todo o seu histórico de revisões.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCleanupManager(!showCleanupManager)}
            className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-[#141414] border-2 border-[#141414] font-mono text-[10px] font-bold uppercase transition-all shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none shrink-0"
          >
            {showCleanupManager ? 'Ocultar Painel ✕' : 'Abrir Painel ⚙'}
          </button>
        </div>

        {showCleanupManager && (
          <div className="space-y-4 pt-2 animate-fade-in text-left">
            {loadingSubjects ? (
              <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 py-4 justify-center">
                <RefreshCw size={14} className="animate-spin text-[#141414]" />
                <span>Carregando suas matérias...</span>
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-neutral-300 rounded text-xs text-neutral-500">
                Nenhuma matéria cadastrada no seu perfil de estudos.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-mono">
                  <button
                    type="button"
                    onClick={handleSelectAllSubjects}
                    className="hover:underline text-indigo-600 font-bold bg-transparent border-none p-0 cursor-pointer"
                  >
                    {selectedSubjectIds.length === subjects.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-neutral-500 font-bold">
                    {selectedSubjectIds.length} de {subjects.length} selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1.5 border border-neutral-200 bg-neutral-50 rounded">
                  {subjects.map((sub) => {
                    const isSelected = selectedSubjectIds.includes(sub.id);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubjectSelect(sub.id)}
                        className={`p-3 border-2 rounded cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-2xs'
                            : 'bg-white border-neutral-200 hover:border-[#141414] text-neutral-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2 text-left">
                          <p className="font-serif italic text-sm font-extrabold truncate">{sub.name}</p>
                          <p className="text-[9px] font-mono text-neutral-400 uppercase mt-0.5">ID: {sub.id.substring(0, 8)}...</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by div click
                          className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleCleanSelectedSubjects}
                    disabled={selectedSubjectIds.length === 0 || isCleaning}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-mono text-[10.5px] font-black uppercase tracking-wider border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isCleaning ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        Excluir Selecionadas e Limpar Histórico ({selectedSubjectIds.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle bottom disclaimers/actions section (pushing legal disclaimers down) */}
      <div className="pt-12 border-t border-dashed border-neutral-350 flex flex-col items-center justify-center space-y-4 text-center">
        <p className="text-[11px] text-neutral-500 max-w-xl leading-relaxed font-sans">
          O MedRevise é comprometido com a segurança e a integridade de seus dados médicos de estudo. Nosso backend é sincronizado com criptografia SSL sob as diretrizes vigentes da LGPD (Lei Geral de Proteção de Dados).
        </p>
        <div className="flex flex-wrap items-center justify-center gap-5 text-[10px] font-mono uppercase tracking-wider text-neutral-450">
          <span 
            onClick={() => window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'terms' }))}
            className="hover:underline hover:text-indigo-600 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Scale size={13} /> LGPD & Termos de Uso
          </span>
          <span>•</span>
          <button 
            onClick={handleResetData}
            disabled={isResetting}
            className="hover:underline text-rose-600 hover:text-rose-700 transition-all cursor-pointer flex items-center gap-1.5 bg-transparent border-0 font-bold"
          >
            <RefreshCw size={13} className={isResetting ? 'animate-spin' : ''} />
            {isResetting ? 'RESETANDO DADOS...' : 'RESETAR MEUS DADOS'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#141414]/5 border border-transparent hover:border-[#141414]/10 transition-all">
      <div className="opacity-40">{icon}</div>
      <div className="min-w-0">
        <p className="text-[8px] font-mono opacity-50 leading-none uppercase">{label}</p>
        <p className="text-xs font-mono font-bold mt-1 truncate">{value}</p>
      </div>
    </div>
  );
}
