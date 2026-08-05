import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, doc, getDoc, setDoc, onSnapshot, collection, query, updateDoc, serverTimestamp, onAuthStateChanged, User, checkAndMigrateUser } from '../firebase';
import { StudySession } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  isPremium?: boolean;
  isLifetimePremium?: boolean;
  role?: 'admin' | 'user';
  premiumSince?: any;
  premiumPaymentId?: string;
  premiumProvider?: string;
  planType?: string;
  referralKey?: string;
  usedReferralKey?: string;
  referralRewardGranted?: boolean;
  premiumUntil?: string;
  referralNotifications?: any[];
  premiumPlan?: string;
  settings?: {
    dailyGoalMinutes: number;
    theme: 'light' | 'dark';
    residencyFocusType?: string;
    residencyFocus?: string;
  };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  globalStats: { questions: number; time: number };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ questions: 0, time: 0 });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubStats: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? "User logged in" : "No user");
      // Clean up previous listeners if any
      if (unsubProfile) unsubProfile();
      if (unsubStats) unsubStats();

      if (firebaseUser) {
        setUser(firebaseUser);
        
        const userRef = doc(db, 'users', firebaseUser.uid);
        console.log("Fetching profile for:", firebaseUser.uid);
        
        unsubProfile = onSnapshot(userRef, async (docSnap) => {
          console.log("Profile snapshot received. Exists:", docSnap.exists());
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            // Check if they are pre-authorized but not marked premium yet
            const normalizedEmail = (firebaseUser.email || '').toLowerCase().trim();
            const isLucas = normalizedEmail === 'lucas1renck2melo@gmail.com';
            const isYsa = normalizedEmail === 'ysabelleosaraiva@gmail.com' || normalizedEmail === 'yasabelleosaraiva@gmail.com';
            const isSpecialAdmin = isLucas || isYsa;
            
            if (isSpecialAdmin && (!data.isPremium || data.role !== 'admin' || !data.isLifetimePremium)) {
              console.log("Auto-upgrading admin Lucas or Ysa to premium, lifetime and admin role...");
              try {
                await updateDoc(userRef, { 
                  isPremium: true,
                  isLifetimePremium: true,
                  premiumProvider: 'Admin (Vitalício)',
                  role: 'admin'
                });
                return;
              } catch (e) {
                console.error("Error upgrading admin:", e);
              }
            } else if (!data.isPremium && firebaseUser.email && !isSpecialAdmin) {
              try {
                const preAuthRef = doc(db, 'pre_authorized_emails', firebaseUser.email.toLowerCase());
                const preAuthSnap = await getDoc(preAuthRef);
                if (preAuthSnap.exists()) {
                  console.log("Auto-upgrading pre-authorized user to premium...");
                  const preAuthData = preAuthSnap.data();
                  const earnsLifetime = !!preAuthData?.isLifetimePremium;
                  const planType = preAuthData?.planType || (earnsLifetime ? 'lifetime' : 'monthly');
                  const premiumPlan = preAuthData?.premiumPlan || (planType === 'combo_ouro' ? 'combo_ouro' : planType === 'med_internato_premium' || planType === 'internato' ? 'med_internato_premium' : 'med_revise_pro');
                  
                  await updateDoc(userRef, { 
                    isPremium: true,
                    isLifetimePremium: earnsLifetime,
                    planType: planType,
                    premiumPlan: premiumPlan,
                    premiumSince: earnsLifetime ? null : serverTimestamp(),
                    premiumProvider: earnsLifetime ? 'Admin (Vitalício)' : `Admin (${planType})`,
                    role: data.role || 'user'
                  });
                  return;
                }
              } catch (e) {
                console.error("Error auto-matching pre-authorized email:", e);
              }
            }

            setProfile(data);
          } else {
            console.log("No profile found in Supabase yet. Checking and migrating Firestore data first...");
            try {
              await checkAndMigrateUser(firebaseUser.uid, false);
            } catch (migErr) {
              console.warn("Error running checkAndMigrateUser in AuthContext:", migErr);
            }

            // Re-check profile after migration
            const recheckSnap = await getDoc(userRef);
            if (recheckSnap.exists()) {
              setProfile(recheckSnap.data() as UserProfile);
              return;
            }

            console.log("Creating new profile after migration check...");
            const normEmail = (firebaseUser.email || '').toLowerCase().trim();
            const isLucas = normEmail === 'lucas1renck2melo@gmail.com';
            const isYsa = normEmail === 'ysabelleosaraiva@gmail.com' || normEmail === 'yasabelleosaraiva@gmail.com';
            const isSpecialAdmin = isLucas || isYsa;
            
            let isInitialPremium = isSpecialAdmin;
            let isInitialLifetime = isSpecialAdmin;
            let initialPremiumSince = null;
            let initialPremiumProvider = isSpecialAdmin ? 'Admin (Vitalício)' : '';
            let initialPlanType = isSpecialAdmin ? 'lifetime' : undefined;
            let initialPremiumPlan = isSpecialAdmin ? 'med_revise_pro' : undefined;
            
            if (!isSpecialAdmin && firebaseUser.email) {
              try {
                const preAuthRef = doc(db, 'pre_authorized_emails', firebaseUser.email.toLowerCase());
                const preAuthSnap = await getDoc(preAuthRef);
                if (preAuthSnap.exists()) {
                  const preAuthData = preAuthSnap.data();
                  isInitialPremium = true;
                  isInitialLifetime = !!preAuthData?.isLifetimePremium;
                  initialPlanType = preAuthData?.planType || (isInitialLifetime ? 'lifetime' : 'monthly');
                  initialPremiumPlan = preAuthData?.premiumPlan || (initialPlanType === 'combo_ouro' ? 'combo_ouro' : initialPlanType === 'med_internato_premium' || initialPlanType === 'internato' ? 'med_internato_premium' : 'med_revise_pro');
                  initialPremiumSince = isInitialLifetime ? null : new Date().toISOString();
                  initialPremiumProvider = isInitialLifetime ? 'Admin (Vitalício)' : `Admin (${initialPlanType})`;
                  console.log("Pre-authorized email detected during setup. Granting Premium.");
                }
              } catch (e) {
                console.error("Error matching pre-authorization on signup:", e);
              }
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              createdAt: new Date().toISOString(),
              isPremium: isInitialPremium,
              isLifetimePremium: isInitialLifetime,
              planType: initialPlanType,
              premiumPlan: initialPremiumPlan,
              premiumSince: initialPremiumSince,
              premiumProvider: initialPremiumProvider,
              role: isSpecialAdmin ? 'admin' : 'user',
              settings: {
                dailyGoalMinutes: 60,
                theme: 'light',
                residencyFocusType: 'standard',
                residencyFocus: 'Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)'
              }
            };
            try {
              await setDoc(userRef, newProfile);
              console.log("Profile created successfully");
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        const q = query(collection(db, 'users', firebaseUser.uid, 'studySessions'));
        unsubStats = onSnapshot(q, (snap) => {
          console.log("Stats snapshot received. Count:", snap.size);
          const sessions = snap.docs.map(d => d.data() as StudySession);
          const totalQuestions = sessions.reduce((acc, s) => acc + s.questionsCount, 0);
          const totalTime = sessions.reduce((acc, s) => acc + s.studyTimeMinutes, 0);
          setGlobalStats({ questions: totalQuestions, time: totalTime });
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${firebaseUser.uid}/studySessions`);
        });

        setLoading(false);
      } else {
        setUser(null);
        setProfile(null);
        setGlobalStats({ questions: 0, time: 0 });
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      if (unsubStats) unsubStats();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, globalStats }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
