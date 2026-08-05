import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from '../firebase';
import { CollegeClass } from '../types';
import { Plus, Trash2, Clock, MapPin, Calendar, GripVertical, Edit2, AlertTriangle } from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  TouchSensor,
  DragStartEvent, 
  DragEndEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PRESET_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEEAD', '#D4A5A5', '#9B59B6', '#34495E',
  '#141414'
];

export default function CollegeSchedule() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<CollegeClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<CollegeClass | null>(null);
  const [newClass, setNewClass] = useState<Partial<CollegeClass>>({
    title: '',
    location: '',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    color: PRESET_COLORS[0]
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'danger' | 'default';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirmar',
    confirmStyle: 'default'
  });

  const handleOpenAddForm = () => {
    setEditingClass(null);
    setNewClass({
      title: '',
      location: '',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      color: PRESET_COLORS[0]
    });
    setShowAddForm(true);
  };

  const handleOpenEditForm = (c: CollegeClass) => {
    setEditingClass(c);
    setNewClass({
      title: c.title,
      location: c.location || '',
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      color: c.color
    });
    setShowAddForm(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'collegeSchedule'), orderBy('dayOfWeek'), orderBy('startTime'));
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollegeClass)));
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const saveClass = async () => {
    if (!user || !newClass.title || !newClass.startTime || !newClass.endTime) return;
    
    if (editingClass) {
      // Update existing
      const classRef = doc(db, 'users', user.uid, 'collegeSchedule', editingClass.id);
      await updateDoc(classRef, {
        title: newClass.title,
        location: newClass.location || '',
        dayOfWeek: newClass.dayOfWeek,
        startTime: newClass.startTime,
        endTime: newClass.endTime,
        color: newClass.color
      });
    } else {
      // Add new
      await addDoc(collection(db, 'users', user.uid, 'collegeSchedule'), {
        ...newClass,
        createdAt: new Date().toISOString()
      });
    }

    setNewClass({
      title: '',
      location: '',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      color: PRESET_COLORS[0]
    });
    setEditingClass(null);
    setShowAddForm(false);
  };

  const deleteClass = (id: string, title: string) => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Disciplina',
      message: `Deseja realmente excluir a aula de "${title}" do seu cronograma acadêmico? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      confirmStyle: 'danger',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'users', user.uid, 'collegeSchedule', id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const clearDay = (dayIdx: number, dayName: string) => {
    if (!user) return;
    const dayClasses = classes.filter(c => c.dayOfWeek === dayIdx);
    if (dayClasses.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: `Limpar tudo de ${dayName}`,
      message: `Deseja realmente excluir todas as ${dayClasses.length} aulas de ${dayName}? Esta ação removerá tudo de uma vez.`,
      confirmText: 'Excluir Tudo',
      confirmStyle: 'danger',
      onConfirm: async () => {
        for (const c of dayClasses) {
          await deleteDoc(doc(db, 'users', user.uid, 'collegeSchedule', c.id));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const classId = active.id as string;
      const newDay = parseInt(over.id as string);
      
      if (!user) return;
      const classRef = doc(db, 'users', user.uid, 'collegeSchedule', classId);
      await updateDoc(classRef, {
        dayOfWeek: newDay
      });
    }
  };

  if (loading) return <div className="font-mono text-xs opacity-50">CARREGANDO CRONOGRAMA...</div>;

  const activeClass = activeId ? classes.find(c => c.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-serif italic text-3xl sm:text-4xl text-[#141414]">Cronograma Faculdade</h2>
          <button 
            onClick={handleOpenAddForm}
            className="bg-[#141414] text-[#E4E3E0] px-6 py-3 sm:py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Plus size={14} />
            ADICIONAR AULA
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-w-2xl mb-6">
            <h3 className="font-serif italic text-lg text-[#141414] mb-4 pb-2 border-b border-dashed border-[#141414]/15 font-bold uppercase tracking-wide">
              {editingClass ? '✏️ Editar Disciplina no Cronograma' : '⚡ Adicionar Aula Acadêmica'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Título da Disciplina</label>
                  <input 
                    type="text" 
                    value={newClass.title}
                    onChange={(e) => setNewClass({...newClass, title: e.target.value})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                    placeholder="Ex: Anatomia I"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Local / Sala</label>
                  <input 
                    type="text" 
                    value={newClass.location}
                    onChange={(e) => setNewClass({...newClass, location: e.target.value})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                    placeholder="Ex: Laboratório 4"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Dia da Semana</label>
                  <select 
                    value={newClass.dayOfWeek}
                    onChange={(e) => setNewClass({...newClass, dayOfWeek: parseInt(e.target.value)})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                  >
                    {DAYS.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Início</label>
                    <input 
                      type="time" 
                      value={newClass.startTime}
                      onChange={(e) => setNewClass({...newClass, startTime: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Fim</label>
                    <input 
                      type="time" 
                      value={newClass.endTime}
                      onChange={(e) => setNewClass({...newClass, endTime: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Cor</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewClass({...newClass, color})}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${newClass.color === color ? 'border-[#141414] scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => { setShowAddForm(false); setEditingClass(null); }}
                className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/5 cursor-pointer transition-colors"
              >
                CANCELAR
              </button>
              <button 
                onClick={saveClass}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90 cursor-pointer transition-colors"
              >
                {editingClass ? 'ATUALIZAR AULA' : 'SALVAR AULA'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto pb-4">
          <div className="min-w-[1000px] grid grid-cols-7 gap-4">
            {DAYS.map((day, dayIdx) => (
              <DayColumn 
                key={dayIdx} 
                day={day} 
                dayIdx={dayIdx} 
                classes={classes.filter(c => c.dayOfWeek === dayIdx)} 
                onDelete={deleteClass}
                onEdit={handleOpenEditForm}
                onClearDay={clearDay}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeClass ? (
          <div 
            className="bg-white border border-[#141414] p-3 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] opacity-80 cursor-grabbing w-40"
            style={{ borderLeft: `4px solid ${activeClass.color}` }}
          >
            <h5 className="font-serif italic text-sm mb-1">{activeClass.title}</h5>
            <div className="text-[9px] font-mono opacity-60">
              {activeClass.startTime} - {activeClass.endTime}
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#141414] p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 text-amber-600 mb-3 font-serif italic text-lg font-bold">
              <AlertTriangle size={20} />
              <span>{confirmModal.title}</span>
            </div>
            <p className="text-xs font-mono text-gray-650 leading-relaxed mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 border border-[#141414] py-2.5 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2.5 font-mono text-[10px] uppercase text-white cursor-pointer transition-colors ${
                  confirmModal.confirmStyle === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#141414] hover:bg-[#141414]/90'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function DayColumn({ 
  day, 
  dayIdx, 
  classes, 
  onDelete, 
  onEdit, 
  onClearDay 
}: { 
  day: string; 
  dayIdx: number; 
  classes: CollegeClass[]; 
  onDelete: (id: string, title: string) => void; 
  onEdit: (c: CollegeClass) => void; 
  onClearDay: (dayIdx: number, dayName: string) => void; 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayIdx.toString(),
  });

  return (
    <div 
      ref={setNodeRef}
      className={`space-y-4 min-h-[200px] transition-colors ${isOver ? 'bg-[#141414]/5' : ''}`}
    >
      <div className="flex items-center justify-between border-b border-[#141414] pb-2 px-1">
        <h4 className="font-mono text-[10px] font-bold uppercase">{day}</h4>
        {classes.length > 0 && (
          <button
            type="button"
            onClick={() => onClearDay(dayIdx, day)}
            className="text-neutral-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
            title={`Limpar todas as aulas de ${day}`}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {classes.map(c => (
          <DraggableClass key={c.id} c={c} onDelete={onDelete} onEdit={onEdit} />
        ))}
        {classes.length === 0 && (
          <div className="h-20 flex items-center justify-center border border-dashed border-[#141414]/10 rounded bg-[#141414]/[0.01]">
            <span className="font-mono text-[8.5px] opacity-25 uppercase tracking-wider text-neutral-400">Sem aulas</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableClass({ 
  c, 
  onDelete, 
  onEdit 
}: { 
  c: CollegeClass; 
  onDelete: (id: string, title: string) => void; 
  onEdit: (c: CollegeClass) => void; 
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: c.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      style={{ ...style, borderLeft: `4px solid ${c.color}` }}
      {...attributes}
      className={`group relative bg-white border border-[#141414] p-3 pl-8 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all select-none touch-none ${isDragging ? 'opacity-0' : ''}`}
    >
      <div 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-6 bg-[#141414]/5 flex items-center justify-center border-r border-[#141414]/10 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="opacity-40" />
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(c); }}
          className="md:opacity-0 md:group-hover:opacity-100 text-neutral-400 hover:text-indigo-600 p-1 transition-opacity cursor-pointer duration-150"
          title="Editar aula"
        >
          <Edit2 size={12} />
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(c.id, c.title); }}
          className="md:opacity-0 md:group-hover:opacity-100 text-neutral-400 hover:text-red-500 p-1 transition-opacity cursor-pointer duration-150"
          title="Excluir aula"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <h5 className="font-serif italic text-sm mb-2 pr-12 truncate" title={c.title}>{c.title}</h5>
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-[9px] font-mono opacity-60">
          <Clock size={10} />
          <span>{c.startTime} - {c.endTime}</span>
        </div>
        {c.location && (
          <div className="flex items-center gap-1 text-[9px] font-mono opacity-60">
            <MapPin size={10} />
            <span>{c.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
