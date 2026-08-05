import React, { useEffect, useRef, useState } from 'react';
import { db, doc, getDoc, updateDoc } from '../firebase';

import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../utils/storageUtils';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  thickness: number;
  type: 'highlight' | 'pen';
}

interface SmartPenCanvasProps {
  topicId: string;
  isPenModeActive: boolean;
  penColor: string;
  penThickness: number;
  brushType: 'highlight' | 'pen' | 'eraser';
  containerRef: React.RefObject<HTMLDivElement | null>;
  userId?: string;
  isVisible?: boolean;
}

export const SmartPenCanvas: React.FC<SmartPenCanvasProps> = ({
  topicId,
  isPenModeActive,
  penColor,
  penThickness,
  brushType,
  containerRef,
  userId = '',
  isVisible = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [onlyStylusMode, setOnlyStylusMode] = useState(true); // Restrict drawing to active Stylus/Apple Pencil/S-Pen by default
  const isDrawingRef = useRef(false);
  const currentStrokePointsRef = useRef<Point[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Dummy helper for full-screen render context
  const isExpandedViewOpen = containerRef.current?.classList.contains('flex-1') || false;

  const storageKey = userId ? `smart_pen_drawings_${userId}_${topicId}` : `smart_pen_drawings_${topicId}`;

  // Load strokes from localStorage
  useEffect(() => {
    try {
      const saved = safeLocalStorageGet(storageKey);
      if (saved) {
        setStrokes(JSON.parse(saved));
      } else {
        setStrokes([]);
      }
    } catch (e) {
      console.warn('Failed to load local drawings:', e);
      setStrokes([]);
    }
  }, [storageKey]);

  // Synchronize with cloud (Firestore/Firebase) on mount / userId change
  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    const loadFromCloud = async () => {
      try {
        const progressRef = doc(db, 'userProgress', userId);
        const docSnap = await getDoc(progressRef);
        if (docSnap.exists() && isMounted) {
          const data = docSnap.data();
          const cloudStrokes = data.smartPenDrawings?.[topicId];
          if (cloudStrokes && Array.isArray(cloudStrokes) && cloudStrokes.length > 0) {
            // Check if different from local
            const savedLocal = safeLocalStorageGet(storageKey);
            if (!savedLocal || JSON.stringify(cloudStrokes) !== savedLocal) {
              setStrokes(cloudStrokes);
              safeLocalStorageSet(storageKey, JSON.stringify(cloudStrokes));
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load cloud drawings:', err);
      }
    };
    
    loadFromCloud();
    return () => {
      isMounted = false;
    };
  }, [userId, topicId, storageKey]);

  // Save strokes to localStorage and Firestore
  const saveStrokes = async (updatedStrokes: Stroke[]) => {
    try {
      safeLocalStorageSet(storageKey, JSON.stringify(updatedStrokes));
      
      if (userId) {
        const progressRef = doc(db, 'userProgress', userId);
        await updateDoc(progressRef, {
          [`smartPenDrawings.${topicId}`]: updatedStrokes
        });
      }
    } catch (e) {
      console.warn('Failed to save drawings local/cloud:', e);
    }
  };

  // Resize canvas to match the parent container size perfectly
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const updateSize = () => {
      const width = parent.scrollWidth;
      const height = parent.scrollHeight;
      setDimensions({ width, height });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(parent);

    return () => {
      observer.disconnect();
    };
  }, [containerRef, isExpandedViewOpen]);

  // Beautiful render routine for individual strokes
  const drawStrokeOnContext = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set blend layer
    if (stroke.type === 'highlight') {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.globalAlpha = 0.95;
      ctx.globalCompositeOperation = 'source-over';
    }

    if (stroke.points.length < 3) {
      ctx.beginPath();
      const point = stroke.points[0];
      ctx.arc(point.x, point.y, stroke.thickness / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      return;
    }

    if (stroke.type === 'highlight') {
      // Highlighters are uniform to prevent overlaps from showing unevenly
      ctx.beginPath();
      ctx.lineWidth = stroke.thickness;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }
      ctx.lineTo(
        stroke.points[stroke.points.length - 1].x,
        stroke.points[stroke.points.length - 1].y
      );
      ctx.stroke();
    } else {
      // Elegant calligraphy script with fluid bezier calculations and smooth width transitions
      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        ctx.beginPath();
        // Calculate mid-points to draw pristine curves instead of disjointed lines
        const xc = (p1.x + p2.x) / 2;
        const yc = (p1.y + p2.y) / 2;
        
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        
        const p1P = p1.pressure !== undefined ? p1.pressure : 0.6;
        const p2P = p2.pressure !== undefined ? p2.pressure : 0.6;
        const currentPressure = (p1P + p2P) / 2;
        
        // Emulate pressure and ink-spread elegantly
        ctx.lineWidth = stroke.thickness * (0.35 + currentPressure * 1.0);
        ctx.stroke();
      }
    }

    // Reset default composition mode
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  // Pre-render static historical strokes onto offscreen caching canvas to eliminate lagging
  const updateCacheCanvas = () => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    if (!cacheCanvasRef.current) {
      cacheCanvasRef.current = document.createElement('canvas');
    }
    const cache = cacheCanvasRef.current;
    cache.width = dimensions.width;
    cache.height = dimensions.height;

    const ctx = cache.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cache.width, cache.height);

    // Draw all completed static strokes
    strokes.forEach(stroke => {
      drawStrokeOnContext(ctx, stroke);
    });
  };

  // Re-render cache canvas only when completed strokes or canvas dimensions change
  useEffect(() => {
    updateCacheCanvas();
    drawCanvas();
  }, [strokes, dimensions]);

  // Main draw canvas routine (Super fast, runs at 120fps by using the pre-cached static image!)
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw cached completed historical drawings instantly!
    if (cacheCanvasRef.current) {
      ctx.drawImage(cacheCanvasRef.current, 0, 0);
    }

    // 2. Draw current active stroke segments on top in real-time
    if (isDrawingRef.current && currentStrokePointsRef.current.length > 0) {
      const activeType = brushType === 'eraser' ? 'pen' : brushType;
      drawStrokeOnContext(ctx, {
        id: 'active',
        points: currentStrokePointsRef.current,
        color: brushType === 'eraser' ? '#FFFFFF' : penColor,
        thickness: penThickness,
        type: activeType as 'highlight' | 'pen'
      });
    }
  };

  // Redraw canvas on configuration modifications
  useEffect(() => {
    drawCanvas();
  }, [penColor, penThickness, brushType]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenModeActive) return;
    
    // Check for stylus type filter
    if (onlyStylusMode && e.pointerType !== 'pen') {
      return;
    }

    e.preventDefault();

    canvasRef.current?.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const coords = getCanvasCoords(e);
    const newPoint: Point = {
      x: coords.x,
      y: coords.y,
      pressure: (e.pressure > 0 && e.pressure !== 0.5) ? e.pressure : 0.75
    };

    currentStrokePointsRef.current = [newPoint];
    
    if (brushType === 'eraser') {
      eraseStrokesAt(coords.x, coords.y);
    } else {
      drawCanvas();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenModeActive || !isDrawingRef.current) return;
    
    // Check for stylus type filter
    if (onlyStylusMode && e.pointerType !== 'pen') {
      return;
    }

    e.preventDefault();

    const coords = getCanvasCoords(e);
    
    if (brushType === 'eraser') {
      eraseStrokesAt(coords.x, coords.y);
    } else {
      const pts = currentStrokePointsRef.current;
      if (pts.length > 0) {
        const lastPoint = pts[pts.length - 1];
        
        // Minor anti-jitter filtering so drawing curves are polished
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.6) return;

        // Smart lag-reduction low-pass smoothing filter
        const filterFactor = dist > 4 ? 0.7 : 0.45;
        const smoothedX = lastPoint.x + dx * filterFactor;
        const smoothedY = lastPoint.y + dy * filterFactor;

        // Elegant pressure emulation based on pen trailing speed
        let dynamicPressure = 0.55;
        if (dist > 0) {
          const maxSpeed = 16;
          const speed = Math.min(dist, maxSpeed);
          // Faster stroke speed = slightly thinner premium calligraphic ink trail
          dynamicPressure = 0.95 - (speed / maxSpeed) * 0.65;
        }

        const actualPressure = (e.pressure > 0 && e.pressure !== 0.5) ? e.pressure : dynamicPressure;

        const newPoint: Point = {
          x: smoothedX,
          y: smoothedY,
          pressure: actualPressure
        };
        pts.push(newPoint);
      } else {
        const newPoint: Point = {
          x: coords.x,
          y: coords.y,
          pressure: (e.pressure > 0 && e.pressure !== 0.5) ? e.pressure : 0.75
        };
        pts.push(newPoint);
      }
      drawCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenModeActive) return;
    
    if (onlyStylusMode && e.pointerType !== 'pen') {
      return;
    }

    e.preventDefault();

    if (isDrawingRef.current) {
      canvasRef.current?.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (brushType !== 'eraser' && currentStrokePointsRef.current.length > 0) {
        const newStroke: Stroke = {
          id: Math.random().toString(36).substring(2, 9),
          points: [...currentStrokePointsRef.current],
          color: penColor,
          thickness: penThickness,
          type: brushType as 'highlight' | 'pen'
        };

        const updated = [...strokes, newStroke];
        setStrokes(updated);
        saveStrokes(updated);
      }
      currentStrokePointsRef.current = [];
    }
  };

  const eraseStrokesAt = (x: number, y: number) => {
    const eraseRadius = penThickness * 1.5;
    
    const filtered = strokes.filter(stroke => {
      return !stroke.points.some(p => {
        const distance = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        return distance <= eraseRadius;
      });
    });

    if (filtered.length !== strokes.length) {
      setStrokes(filtered);
      saveStrokes(filtered);
    }
  };

  // Expose clear mechanism
  useEffect(() => {
    const handleClearEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.topicId === topicId) {
        setStrokes([]);
        safeLocalStorageRemove(storageKey);
        
        // Also clear from cloud if userId is set
        if (userId) {
          const progressRef = doc(db, 'userProgress', userId);
          updateDoc(progressRef, {
            [`smartPenDrawings.${topicId}`]: []
          }).catch(err => console.warn('Failed to delete cloud drawing on clear:', err));
        }
      }
    };

    window.addEventListener('clear-smart-pen-drawings', handleClearEvent);
    return () => window.removeEventListener('clear-smart-pen-drawings', handleClearEvent);
  }, [topicId, storageKey, userId]);

  return (
    <div 
      className="absolute inset-0 select-none pointer-events-none"
      style={{ zIndex: isPenModeActive ? 15 : 5 }}
    >
      {/* Interactive Stylus Status Overlay badge to control palm rejection */}
      {isPenModeActive && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2 bg-[#1E293B]/90 backdrop-blur-md border border-[#334155]/65 px-3 py-1.5 rounded-full shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">{onlyStylusMode ? '🖊️' : '🖐️'}</span>
            <span className="text-[9.5px] text-[#F8FAFC] font-bold uppercase tracking-widest leading-none">
              {onlyStylusMode ? 'Caneta Ativa' : 'Caneta + Touch'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyStylusMode(!onlyStylusMode)}
            className="text-[9px] font-bold text-[#E2E8F0] hover:text-white bg-[#334155] hover:bg-[#475569] border border-white/10 px-2 py-0.5 rounded transition-all cursor-pointer"
            title="Alternar entre permitir escrita com dedo/mouse ou ignorar toques de palma"
          >
            {onlyStylusMode ? 'Usar Dedo' : 'Apenas Caneta'}
          </button>
        </div>
      )}

      <canvas
        id={`smart-pen-canvas-${topicId}`}
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          pointerEvents: isPenModeActive ? 'auto' : 'none',
          touchAction: isPenModeActive ? 'none' : 'auto',
          display: isVisible ? 'block' : 'none'
        }}
        className="select-none"
      />
    </div>
  );
};
