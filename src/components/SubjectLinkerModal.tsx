import React from 'react';
import { Subject } from '../types';
import SubjectLinkerInterface from './SubjectLinkerInterface';
import { motion, AnimatePresence } from 'motion/react';

interface SubjectLinkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviseSubjects: Subject[];
  internatoSubjects: Subject[];
  onSwitchMode?: (mode: 'revise' | 'internato') => void;
}

export default function SubjectLinkerModal({
  isOpen,
  onClose,
  reviseSubjects,
  internatoSubjects,
  onSwitchMode
}: SubjectLinkerModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="bg-[#E4E3E0] border-2 border-[#141414] rounded-3xl w-full max-w-5xl shadow-[10px_10px_0px_0px_rgba(20,20,20,1)] overflow-hidden flex flex-col max-h-[92vh] my-auto"
        >
          <div className="p-6 overflow-y-auto space-y-4">
            <SubjectLinkerInterface
              onSwitchMode={(mode) => {
                onClose();
                if (onSwitchMode) onSwitchMode(mode);
              }}
              customReviseSubjects={reviseSubjects}
              customInternatoSubjects={internatoSubjects}
              isEmbeddedModal={true}
              onCloseModal={onClose}
            />
          </div>

          <div className="p-4 bg-white border-t-2 border-[#141414] flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#141414] hover:bg-black text-white font-mono text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(212,78,61,1)]"
            >
              Concluir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
