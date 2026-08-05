import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, doc, updateDoc, deleteDoc } from '../firebase';
import { Topic, CalendarEvent, CollegeClass } from '../types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO,
  addWeeks,
  subWeeks,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical, Trash2, X, BookOpen } from 'lucide-react';
import { useStudyData } from '../hooks/useStudyData';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

// Ebbinghaus Forgetting Curve formula:
// F = 1 - e^(-t / (S * EF))
const calculateForgettingIndex = (topic: Topic, targetDate: Date) => {
  if (topic.completed) return 0;
  
  // Use lastReviewDate if available, or fall back to Topic creation time
  const lastReviewTime = topic.lastReviewDate 
    ? new Date(topic.lastReviewDate).getTime() 
    : new Date(topic.createdAt).getTime();
  
  const diffTime = targetDate.getTime() - lastReviewTime;
  const elapsedDays = Math.max(0.01, diffTime / (1000 * 60 * 60 * 24));
  
  const interval = Math.max(1, topic.interval || 1);
  const ef = Math.max(1.3, topic.easinessFactor || 2.5);
  
  // Exponential decay curve prediction
  const forgettingProbability = 1 - Math.exp(-elapsedDays / (interval * ef));
  return Math.min(0.99, Math.max(0, forgettingProbability));
};
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

export default function WeeklyView() {
  const { user } = useAuth();
  const { topics, subjects, events, collegeSchedule } = useStudyData();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastNavTime = useRef<number>(0);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);

  const [eventData, setEventData] = useState({
    title: '',
    start: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    completed: false
  });

  const [topicData, setTopicData] = useState({
    name: '',
    nextReviewDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    completed: false
  });

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

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });

  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: weekEnd
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragMove = (event: any) => {
    const { active } = event;
    if (!active || !active.rect.current.translated) return;

    const now = Date.now();
    if (now - lastNavTime.current < 1500) return; // 1.5s cooldown

    const rect = active.rect.current.translated;
    const centerX = rect.left + rect.width / 2;
    const width = window.innerWidth;
    const threshold = 60; // Slightly larger threshold for better detection

    if (centerX < threshold) {
      setCurrentWeek(prev => subWeeks(prev, 1));
      lastNavTime.current = now;
    } else if (centerX > width - threshold) {
      setCurrentWeek(prev => addWeeks(prev, 1));
      lastNavTime.current = now;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const draggedId = active.id as string;
      const newDateStr = over.id as string; // "yyyy-MM-dd"
      
      if (!user) return;
      
      const calendarEvent = events.find(e => e.id === draggedId);
      if (calendarEvent) {
        const oldStartDate = parseISO(calendarEvent.start);
        const oldEndDate = parseISO(calendarEvent.end);
        const duration = oldEndDate.getTime() - oldStartDate.getTime();
        
        const newStartDate = parseISO(newDateStr);
        newStartDate.setHours(oldStartDate.getHours());
        newStartDate.setMinutes(oldStartDate.getMinutes());
        
        const newEndDate = new Date(newStartDate.getTime() + duration);

        try {
          const eventRef = doc(db, 'users', user.uid, 'calendarEvents', draggedId);
          await updateDoc(eventRef, {
            start: newStartDate.toISOString(),
            end: newEndDate.toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/calendarEvents/${draggedId}`);
        }
        return;
      }

      const topic = topics.find(t => t.id === draggedId);
      if (topic) {
        try {
          const topicRef = doc(db, 'users', user.uid, 'topics', draggedId);
          await updateDoc(topicRef, {
            nextReviewDate: new Date(newDateStr + 'T12:00:00').toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics/${draggedId}`);
        }
      }
    }
  };

  const updateEvent = async () => {
    if (!user || !editingEvent || !eventData.title.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', editingEvent.id), {
        ...eventData
      });
      setEditingEvent(null);
      setShowEventForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/calendarEvents/${editingEvent.id}`);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user || !confirm('Excluir este compromisso?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'calendarEvents', id));
      setEditingEvent(null);
      setShowEventForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/calendarEvents/${id}`);
    }
  };

  const updateTopic = async () => {
    if (!user || !editingTopic || !topicData.name.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'topics', editingTopic.id), {
        name: topicData.name,
        nextReviewDate: topicData.nextReviewDate,
        description: topicData.description,
        completed: topicData.completed,
        ...(topicData.completed ? { wasRescheduledOverdue: false } : {})
      });
      setEditingTopic(null);
      setShowTopicForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics/${editingTopic.id}`);
    }
  };

  const activeTopic = activeId ? topics.find(t => t.id === activeId) : null;
  const activeEvent = activeId ? events.find(e => e.id === activeId) : null;
  const activeSubject = activeTopic ? subjects.find(s => s.id === activeTopic.subjectId) : null;

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Week Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#141414] p-4 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#141414] p-2 text-[#E4E3E0]">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 className="font-serif italic text-xl sm:text-2xl">Cronograma Semanal</h2>
              <p className="font-mono text-[9px] sm:text-[10px] uppercase opacity-50">
                {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} - {format(weekEnd, "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex gap-1 justify-end">
            <button 
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              className="p-2 border border-[#141414] hover:bg-[#141414]/5 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentWeek(new Date())}
              className="px-4 py-2 border border-[#141414] font-mono text-[10px] uppercase hover:bg-[#141414]/5 transition-colors"
            >
              Hoje
            </button>
            <button 
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              className="p-2 border border-[#141414] hover:bg-[#141414]/5 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[1000px] grid grid-cols-7 gap-4">
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTopics = topics.filter(t => {
                if (t.noMoreReviews || t.repetitions === 0) return false;
                return t.nextReviewDate && isSameDay(parseISO(t.nextReviewDate), day);
              });
              const dayEvents = events.filter(e => isSameDay(parseISO(e.start), day));
              
              return (
                <WeeklyDayColumn 
                  key={dateKey}
                  day={day}
                  dateKey={dateKey}
                  dayTopics={dayTopics}
                  dayEvents={dayEvents}
                  subjects={subjects}
                  onEditEvent={(e) => {
                    setEditingEvent(e);
                    setEventData({
                      title: e.title,
                      start: e.start.substring(0, 16),
                      end: e.end.substring(0, 16),
                      description: e.description || '',
                      completed: e.completed || false
                    });
                    setShowEventForm(true);
                  }}
                  onEditTopic={(t) => {
                    setEditingTopic(t);
                    setTopicData({
                      name: t.name,
                      nextReviewDate: t.nextReviewDate?.substring(0, 16) || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                      description: t.description || '',
                      completed: t.completed || false
                    });
                    setShowTopicForm(true);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Event Edit Modal */}
        {showEventForm && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-[#141414]">
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-[#141414]/15">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={18} className="text-[#141414]" />
                  <h3 className="font-serif italic text-xl font-bold">Editar Compromisso</h3>
                </div>
                <button 
                  onClick={() => deleteEvent(editingEvent!.id)} 
                  title="Excluir compromisso"
                  className="text-red-650 hover:text-red-700 hover:bg-red-50 p-1.5 border border-red-200 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Título do Compromisso</label>
                  <input 
                    type="text" 
                    value={eventData.title}
                    onChange={(e) => setEventData({...eventData, title: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] bg-neutral-50/50"
                  />
                </div>

                {/* Styled Toggle for Event Status */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500">Status do Compromisso</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEventData({...eventData, completed: false})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        !eventData.completed 
                          ? 'bg-[#141414] text-white border-[#141414] font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Pendente ⏳
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventData({...eventData, completed: true})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        eventData.completed 
                          ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Concluído ✓
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold">Início</label>
                    <input 
                      type="datetime-local" 
                      value={eventData.start}
                      onChange={(e) => setEventData({...eventData, start: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold">Fim</label>
                    <input 
                      type="datetime-local" 
                      value={eventData.end}
                      onChange={(e) => setEventData({...eventData, end: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Notas / Descrição</label>
                  <textarea 
                    value={eventData.description}
                    onChange={(e) => setEventData({...eventData, description: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none h-20 resize-none bg-neutral-50/50"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => { setShowEventForm(false); setEditingEvent(null); }} 
                  className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button 
                  onClick={updateEvent} 
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 cursor-pointer text-center font-bold"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Topic Edit Modal */}
        {showTopicForm && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-[#141414]">
              <div className="flex justify-between items-center mb-4 border-b pb-3 border-[#141414]/15">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#141414]" />
                  <h3 className="font-serif italic text-xl font-bold">Editar Revisão (SRS)</h3>
                </div>
              </div>

              {/* Colorful Context badge summary */}
              {editingTopic && (
                <div className="flex flex-wrap gap-2 mb-4 bg-neutral-50 border border-neutral-200 p-2.5">
                  {subjects.find(s => s.id === editingTopic.subjectId) && (
                    <span 
                      className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border"
                      style={{ 
                        borderColor: subjects.find(s => s.id === editingTopic.subjectId)?.color, 
                        color: subjects.find(s => s.id === editingTopic.subjectId)?.color, 
                        backgroundColor: `${subjects.find(s => s.id === editingTopic.subjectId)?.color}08` 
                      }}
                    >
                      {subjects.find(s => s.id === editingTopic.subjectId)?.name}
                    </span>
                  )}
                  <span className="text-[8px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 border border-neutral-200 uppercase font-semibold">
                    Risco de Esquecimento: {(calculateForgettingIndex(editingTopic, new Date()) * 100).toFixed(0)}%
                  </span>
                  {(() => {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const isOverdueNow = editingTopic.nextReviewDate && new Date(editingTopic.nextReviewDate).getTime() < todayStart.getTime();
                    if (isOverdueNow) {
                      return (
                        <span className="text-[8px] font-mono bg-amber-50 border border-amber-300 text-amber-850 px-1.5 py-0.5 font-bold uppercase tracking-wider animate-pulse">
                          Atrasado ⏳
                        </span>
                      );
                    }
                    if (editingTopic.wasRescheduledOverdue) {
                      return (
                        <span className="text-[8px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 font-bold uppercase tracking-wider animate-pulse">
                          Ex-Atrasado ⏱️
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Nome do Tópico</label>
                  <input 
                    type="text" 
                    value={topicData.name}
                    onChange={(e) => setTopicData({...topicData, name: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] bg-neutral-50/50"
                  />
                </div>

                {/* Styled Segmented toggle for topic completion */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500">Status do Tópico</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTopicData({...topicData, completed: false})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        !topicData.completed 
                          ? 'bg-[#141414] text-white border-[#141414] font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Revisão Pendente 📚
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopicData({...topicData, completed: true})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        topicData.completed 
                          ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Concluído hoje ✓
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold">Data Agendada</label>
                  <input 
                    type="datetime-local" 
                    value={topicData.nextReviewDate}
                    onChange={(e) => setTopicData({...topicData, nextReviewDate: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Anotações da Matéria</label>
                  <textarea 
                    value={topicData.description}
                    onChange={(e) => setTopicData({...topicData, description: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none h-20 resize-none bg-neutral-50/50"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => { setShowTopicForm(false); setEditingTopic(null); }} 
                  className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button 
                  onClick={updateTopic} 
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 cursor-pointer text-center font-bold"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        )}

        <DragOverlay>
          {activeTopic ? (
            <div className="p-3 bg-[#141414] border border-[#141414] shadow-xl w-64 opacity-90">
              <div className="text-[10px] font-mono uppercase text-[#E4E3E0]/50 mb-1">
                {activeSubject?.name || 'Matéria'}
              </div>
              <div className="font-serif italic text-[#E4E3E0] text-sm">
                {activeTopic.name}
              </div>
            </div>
          ) : activeEvent ? (
            <div className="p-3 bg-[#141414] border border-[#141414] shadow-xl w-64 opacity-90">
              <div className="text-[10px] font-mono uppercase text-[#E4E3E0]/50 mb-1">
                Compromisso
              </div>
              <div className="font-serif italic text-[#E4E3E0] text-sm">
                {activeEvent.title}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

function WeeklyDayColumn({ 
  day, 
  dateKey, 
  dayTopics, 
  dayEvents, 
  subjects, 
  onEditEvent, 
  onEditTopic 
}: { 
  day: Date, 
  dateKey: string, 
  dayTopics: Topic[], 
  dayEvents: CalendarEvent[], 
  subjects: any[], 
  onEditEvent: (e: CalendarEvent) => void, 
  onEditTopic: (t: Topic) => void 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col border border-[#141414] bg-white min-h-[400px] transition-colors",
        isToday(day) && "ring-2 ring-[#141414] ring-inset",
        isOver && "bg-[#141414]/5"
      )}
    >
      <div className={cn(
        "p-3 border-bottom border-[#141414] text-center",
        isToday(day) ? "bg-[#141414] text-[#E4E3E0]" : "bg-[#141414]/5"
      )}>
        <p className="font-mono text-[10px] uppercase font-bold tracking-tighter">
          {format(day, 'EEEE', { locale: ptBR })}
        </p>
        <p className="font-serif italic text-xl">
          {format(day, 'dd')}
        </p>
      </div>

      <div className="p-2 space-y-2 flex-1">
        {dayTopics.length === 0 && dayEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center opacity-20 py-8">
            <p className="font-mono text-[8px] uppercase [writing-mode:vertical-rl]">Vazio</p>
          </div>
        ) : (
          <>
            {dayEvents.map((event, eIdx) => (
              <DraggableEvent key={`w-event-${event.id}-${eIdx}`} event={event} onEdit={() => onEditEvent(event)} />
            ))}
            {dayTopics.map((topic, tIdx) => {
              const isCompletedOnDay = !!(topic.lastReviewDate && isSameDay(parseISO(topic.lastReviewDate), day) && (!topic.nextReviewDate || !isSameDay(parseISO(topic.nextReviewDate), day)));
              return (
                <DraggableTopic 
                  key={`w-topic-${topic.id}-${tIdx}`} 
                  topic={topic} 
                  subjects={subjects} 
                  onEdit={() => onEditTopic(topic)} 
                  isCompletedOnSpecDay={isCompletedOnDay}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function DraggableEvent({ event, onEdit }: { event: CalendarEvent, onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group relative p-3 pl-8 border border-[#141414] bg-[#141414] text-[#E4E3E0] transition-all cursor-pointer select-none touch-none",
        isDragging && "opacity-0",
        event.completed && "opacity-50 line-through decoration-white/50"
      )}
    >
      <div 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-6 bg-white/10 flex items-center justify-center border-r border-white/5 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="opacity-50" />
      </div>
      <div onClick={onEdit} className="w-full">
        <div className="text-[9px] font-mono uppercase opacity-50 mb-1 truncate">
          Compromisso
        </div>
        <div className="font-serif italic text-xs leading-tight">
          {event.title}
        </div>
      </div>
    </div>
  );
}

function DraggableTopic({ 
  topic, 
  subjects, 
  onEdit,
  isCompletedOnSpecDay
}: { 
  topic: Topic, 
  subjects: any[], 
  onEdit: () => void,
  isCompletedOnSpecDay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: topic.id,
  });

  const subject = subjects.find(s => s.id === topic.subjectId);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const score = calculateForgettingIndex(topic, new Date());
  
  let isOverdue = false;
  if (!(topic.completed || isCompletedOnSpecDay) && topic.nextReviewDate) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    isOverdue = new Date(topic.nextReviewDate).getTime() < todayStart.getTime();
  }

  const getScoreStyles = () => {
    if (topic.completed || isCompletedOnSpecDay) {
      return "bg-neutral-50/70 border-neutral-200 text-neutral-400 line-through decoration-neutral-300";
    }
    if (isOverdue) {
      return "bg-amber-50/70 border-amber-300 hover:bg-amber-100/65 text-amber-955 shadow-xs";
    }
    if (topic.wasRescheduledOverdue) {
      return "bg-indigo-50/90 border-indigo-200 hover:bg-indigo-100/60 text-indigo-950 shadow-xs border-dashed";
    }
    if (score >= 0.85) {
      return "bg-red-50/85 border-red-200 hover:bg-red-100/60 text-red-955";
    }
    if (score >= 0.60) {
      return "bg-amber-50/85 border-amber-250 hover:bg-amber-100/60 text-amber-955";
    }
    if (score >= 0.35) {
      return "bg-stone-55 border-stone-200 hover:bg-stone-100/65 text-stone-850";
    }
    return "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50/50 shadow-xs";
  };

  const getDotColor = () => {
    if (topic.completed || isCompletedOnSpecDay) return "bg-neutral-300";
    if (isOverdue) return "bg-amber-500 animate-pulse";
    if (topic.wasRescheduledOverdue) return "bg-indigo-500";
    if (score >= 0.85) return "bg-red-500 animate-pulse";
    if (score >= 0.60) return "bg-amber-500";
    if (score >= 0.35) return "bg-amber-400";
    return "bg-[#10b981]";
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group relative p-2.5 pl-7 border transition-all cursor-pointer select-none touch-none text-[11px] font-mono",
        isDragging && "opacity-0",
        getScoreStyles()
      )}
    >
      <div 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-5.5 bg-[#141414]/2 group-hover:bg-[#141414]/5 flex items-center justify-center border-r border-neutral-200 cursor-grab active:cursor-grabbing text-neutral-400"
      >
        <GripVertical size={11} />
      </div>
      <div onClick={onEdit} className="w-full space-y-1">
        <div className="flex flex-wrap items-center gap-1">
          {/* Muted matter label with color border indicator */}
          <span 
            className="text-[7.5px] uppercase font-bold px-1 py-0.2 border shrink-0 bg-white/40 font-mono"
            style={{ 
              borderColor: subject?.color || '#e5e7eb', 
              color: subject?.color || '#374151',
            }}
          >
            {subject?.name || 'Matéria'}
          </span>

          {/* Overdue / Rescheduled Badges */}
          {!(topic.completed || isCompletedOnSpecDay) && (
            <>
              {isOverdue && (
                <span className="bg-amber-500 text-white border border-amber-600 text-[6.5px] px-0.5 font-bold uppercase tracking-wider shrink-0">
                  Atrasado ⏳
                </span>
              )}
              {topic.wasRescheduledOverdue && !isOverdue && (
                <span className="bg-indigo-600 text-white border border-indigo-700 text-[6.5px] px-0.5 font-bold uppercase tracking-wider shrink-0">
                  Ex-Atrasado ⏱️
                </span>
              )}
              {score >= 0.85 && !topic.wasRescheduledOverdue ? (
                <span className="bg-red-100 text-red-800 border border-red-200 text-[6.5px] px-0.5 font-bold uppercase tracking-wider shrink-0">
                  Crítico
                </span>
              ) : score >= 0.60 && !topic.wasRescheduledOverdue ? (
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[6.5px] px-0.5 font-bold uppercase tracking-wider shrink-0">
                  Urgente
                </span>
              ) : score >= 0.35 && !topic.wasRescheduledOverdue ? (
                <span className="bg-stone-200 text-stone-700 border border-stone-300 text-[6.5px] px-0.5 font-bold uppercase tracking-wider shrink-0">
                  Atenção
                </span>
              ) : null}
              {score > 0 && (
                <span className="text-[6.5px] text-neutral-500 font-bold shrink-0">
                  {(score * 100).toFixed(0)}% risco
                </span>
              )}
            </>
          )}
        </div>

        <div className="font-serif italic text-xs leading-tight font-semibold text-[#141414] group-hover:text-black">
          {topic.name}
        </div>

        {topic.description && (
          <div className="text-[8px] font-mono text-neutral-500 line-clamp-1 italic">
            {topic.description}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1 text-[7.5px] uppercase font-bold text-neutral-500">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            getDotColor()
          )}></div>
          <span>
            {(topic.completed || isCompletedOnSpecDay) ? 'Concluído' : isOverdue ? 'Atrasado' : topic.wasRescheduledOverdue ? 'Ex-Atrasado' : 'Pendente'}
          </span>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
