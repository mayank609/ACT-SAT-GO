import { useEffect, useRef, useState } from 'react';
import { Calculator, X } from 'lucide-react';

interface DesmosCalculatorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Draggable, resizable Desmos calculator panel (graphing + scientific).
 * Self-contained: manages its own position/size/mode. Render it once per page
 * and toggle via the `open` prop.
 */
export function DesmosCalculator({ open, onClose }: DesmosCalculatorProps) {
  const [calcMode, setCalcMode] = useState<'graphing' | 'scientific'>('graphing');
  const [calcSize, setCalcSize] = useState({ width: 800, height: 550 });
  const [calcPos, setCalcPos] = useState(() => {
    const width = 800;
    const x = Math.max(20, window.innerWidth - width - 40);
    return { x, y: 80 };
  });
  const [isInteracting, setIsInteracting] = useState(false);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 800, height: 550 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setCalcPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      } else if (resizing.current) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        setCalcSize({
          width: Math.max(360, Math.min(1200, resizeStart.current.width + deltaX)),
          height: Math.max(360, Math.min(800, resizeStart.current.height + deltaY)),
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
      setIsInteracting(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed z-[200] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-100 ease-out"
      style={{
        left: calcPos.x,
        top: calcPos.y,
        width: Math.min(calcSize.width, window.innerWidth - 20),
        height: Math.min(calcSize.height, window.innerHeight - 100),
      }}
    >
      {/* Header & drag handle */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-[#1b3d6e] text-white cursor-move select-none flex-shrink-0"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button')) return;
          dragging.current = true;
          dragOffset.current = { x: e.clientX - calcPos.x, y: e.clientY - calcPos.y };
          setIsInteracting(true);
        }}
      >
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Calculator size={14} /> Calculator
          </span>

          {/* Tab selector */}
          <div className="flex items-center bg-[#132d53] p-0.5 rounded-md text-[10px]">
            <button
              onClick={() => {
                setCalcMode('graphing');
                setCalcSize({ width: 800, height: 550 });
                setCalcPos((prev) => ({
                  x: Math.max(10, Math.min(prev.x, window.innerWidth - 820)),
                  y: Math.max(10, Math.min(prev.y, window.innerHeight - 570)),
                }));
              }}
              className={`px-2.5 py-0.5 font-medium rounded-sm cursor-pointer transition-all ${
                calcMode === 'graphing'
                  ? 'bg-[#1b3d6e] text-white shadow-sm font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Graphing
            </button>
            <button
              onClick={() => {
                setCalcMode('scientific');
                setCalcSize({ width: 450, height: 520 });
                setCalcPos((prev) => ({
                  x: Math.max(10, Math.min(prev.x, window.innerWidth - 470)),
                  y: Math.max(10, Math.min(prev.y, window.innerHeight - 540)),
                }));
              }}
              className={`px-2.5 py-0.5 font-medium rounded-sm cursor-pointer transition-all ${
                calcMode === 'scientific'
                  ? 'bg-[#1b3d6e] text-white shadow-sm font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Scientific
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Calculator iframe */}
      <iframe
        src={
          calcMode === 'graphing'
            ? 'https://www.desmos.com/testing/cb-digital-sat/graphing'
            : 'https://www.desmos.com/scientific'
        }
        title={calcMode === 'graphing' ? 'Desmos Graphing Calculator' : 'Desmos Scientific Calculator'}
        className="flex-1 w-full border-0 bg-white"
        style={{ pointerEvents: isInteracting ? 'none' : 'auto' }}
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5 z-50 select-none"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          resizing.current = true;
          resizeStart.current = { x: e.clientX, y: e.clientY, width: calcSize.width, height: calcSize.height };
          setIsInteracting(true);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400 fill-current opacity-70 hover:opacity-100 transition-opacity">
          <circle cx="8" cy="8" r="1" />
          <circle cx="8" cy="5" r="1" />
          <circle cx="5" cy="8" r="1" />
          <circle cx="8" cy="2" r="1" />
          <circle cx="5" cy="5" r="1" />
          <circle cx="2" cy="8" r="1" />
        </svg>
      </div>
    </div>
  );
}
