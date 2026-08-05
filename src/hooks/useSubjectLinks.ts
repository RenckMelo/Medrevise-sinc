import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from '../firebase';
import { Subject } from '../types';

export interface SubjectLink {
  id: string; // e.g. reviseSubjectId + '_' + internatoSubjectId
  reviseSubjectId: string;
  internatoSubjectId: string;
  createdAt: string;
  autoLinked?: boolean;
}

export function useSubjectLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<SubjectLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLinks([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'subjectLinks'),
      (snap) => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectLink));
        setLinks(loaded);
        setLoading(false);
      },
      (err) => {
        console.warn('Subject links listener fallback:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const linkSubjects = async (
    reviseSubjectId: string, 
    internatoSubjectId: string, 
    autoLinked = false,
    reviseSubjectName = '',
    internatoSubjectName = ''
  ) => {
    if (!user || !reviseSubjectId || !internatoSubjectId) return;
    const linkId = `${reviseSubjectId}_${internatoSubjectId}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'subjectLinks', linkId), {
        reviseSubjectId,
        internatoSubjectId,
        reviseSubjectName,
        internatoSubjectName,
        createdAt: new Date().toISOString(),
        autoLinked
      });
    } catch (err) {
      console.error('Failed to create subject link:', err);
    }
  };

  const unlinkSubjects = async (linkId: string) => {
    if (!user || !linkId) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'subjectLinks', linkId));
    } catch (err) {
      console.error('Failed to delete subject link:', err);
    }
  };

  const autoLinkMatchingSubjects = async (reviseSubjects: Subject[], internatoSubjects: Subject[]) => {
    if (!user) return 0;
    let count = 0;

    const normalize = (str: string) => 
      (str || '').toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(internato|pratica|rodizio|modulo|ciclo|clinico|clinica|de|da|do|e)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();

    for (const rSub of reviseSubjects) {
      if (!rSub || !rSub.name) continue;
      const rNameNorm = normalize(rSub.name);
      if (!rNameNorm) continue;

      // Check if already linked
      const exists = links.some(l => l.reviseSubjectId === rSub.id);
      if (exists) continue;

      for (const iSub of internatoSubjects) {
        if (!iSub || !iSub.name) continue;
        if (rSub.id === iSub.id || rNameNorm === normalize(iSub.name)) {
          await linkSubjects(rSub.id, iSub.id, true, rSub.name, iSub.name);
          count++;
          break;
        }
      }
    }

    return count;
  };

  const isSubjectLinked = (subjectId: string) => {
    return links.some(l => l.reviseSubjectId === subjectId || l.internatoSubjectId === subjectId);
  };

  const getLinkedSubjectId = (subjectId: string) => {
    const found = links.find(l => l.reviseSubjectId === subjectId || l.internatoSubjectId === subjectId);
    if (!found) return null;
    return found.reviseSubjectId === subjectId ? found.internatoSubjectId : found.reviseSubjectId;
  };

  return {
    links,
    loading,
    linkSubjects,
    unlinkSubjects,
    autoLinkMatchingSubjects,
    isSubjectLinked,
    getLinkedSubjectId
  };
}
