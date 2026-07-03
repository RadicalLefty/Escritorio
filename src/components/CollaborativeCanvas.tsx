import React, { useRef, useState, useEffect } from 'react';
import { Palette, Eraser, Trash2, PenTool, RotateCcw } from 'lucide-react';
import { DrawingStroke, Point } from '../types';

interface CollaborativeCanvasProps {
  id: string; // ID of the storyboard frame or sketch
  strokes: DrawingStroke[];
  onStrokeAdded?: (stroke: DrawingStroke) => void;
  onClear?: () => void;
  className?: string;
  readOnly?: boolean;
}

const COLORS = [
  { hex: '#1C1917', name: 'Charcoal' },
  { hex: '#78716C', name: 'Stone' },
  { hex: '#DC2626', name: 'Ink Red' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#2563EB', name: 'Ink Blue' },
  { hex: '#16A34A', name: 'Ink Green' },
  { hex: '#B45309', name: 'Sepia' }
];

const WIDTHS = [2, 8, 16, 32, 64];

export default function CollaborativeCanvas({
  id,
  strokes,
  onStrokeAdded,
  onClear,
  className = '',
  readOnly = false
}: CollaborativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState('#1C1917');
  const [width, setWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  
  const currentPointsRef = useRef<Point[]>([]);

  // Function to redraw the entire canvas based on the strokes list
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw background (White paper look)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!readOnly) {
      // Draw storyboard borders or guidelines
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth = 1;
      // Simple light grid for sketching guides
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let x = 40; x < canvas.width; x += 40) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 40; y < canvas.height; y += 40) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    }

    // Calculate dynamic scaling for readOnly preview
    let s = 1.0;
    let dx = 0;
    let dy = 0;

    if (readOnly && strokes.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      strokes.forEach(stroke => {
        stroke.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });

      if (minX !== Infinity) {
        const drawW = maxX - minX;
        const drawH = maxY - minY;
        const pad = 12; // padding in pixels
        const targetW = canvas.width - pad * 2;
        const targetH = canvas.height - pad * 2;

        if (drawW > 0 && drawH > 0) {
          s = Math.min(targetW / drawW, targetH / drawH);
        }
        // Limit max scale to 1.5 to avoid pixelating tiny drawings
        if (s > 1.5) s = 1.5;

        // Center scaled drawing
        dx = pad + (targetW - drawW * s) / 2 - minX * s;
        dy = pad + (targetH - drawH * s) / 2 - minY * s;
      }
    }

    // Draw all strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width * s;
      
      if (stroke.isEraser) {
        ctx.strokeStyle = '#FFFFFF'; // Erase with white
      } else {
        ctx.strokeStyle = stroke.color;
      }

      const getScaledPoint = (p: Point) => {
        if (readOnly) {
          return {
            x: p.x * s + dx,
            y: p.y * s + dy
          };
        }
        return p;
      };

      if (stroke.points.length === 1) {
        const p = getScaledPoint(stroke.points[0]);
        ctx.arc(p.x, p.y, (stroke.width * s) / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.isEraser ? '#FFFFFF' : stroke.color;
        ctx.fill();
      } else {
        const p0 = getScaledPoint(stroke.points[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pi = getScaledPoint(stroke.points[i]);
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.stroke();
      }
    });
  };

  // Adjust canvas size to fit container on mount / resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Maintain internal high-res width
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || 600;
      canvas.height = rect.height || 360;
      redraw();
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Redraw when strokes list updates
  useEffect(() => {
    redraw();
  }, [strokes]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const startPoint = { x, y };
    currentPointsRef.current = [startPoint];

    // Start drawing local trace immediately
    ctx.beginPath();
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? '#FFFFFF' : color;
    ctx.fill();

    setCursorPos({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Always update cursor position for cursor-none visualization
    setCursorPos({ x, y });

    if (!isDrawing) return;

    const newPoint = { x, y };
    const points = currentPointsRef.current;
    
    if (points.length > 0) {
      const prevPoint = points[points.length - 1];
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isEraser ? '#FFFFFF' : color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    points.push(newPoint);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);

    if (e.pointerType === 'touch') {
      setCursorPos(null);
    }

    const finalPoints = [...currentPointsRef.current];
    if (finalPoints.length === 0) return;

    // Create stroke object
    const newStroke: DrawingStroke = {
      id: crypto.randomUUID(),
      points: finalPoints,
      color: isEraser ? '#FFFFFF' : color,
      width,
      isEraser: isEraser ? true : undefined
    };

    onStrokeAdded(newStroke);
    currentPointsRef.current = [];
  };

  return (
    <div className={`flex flex-col rounded overflow-hidden bg-white ${readOnly ? 'w-full h-full border-0' : 'border border-[#E5E5E1] shadow-xs ' + className}`} id={`canvas-container-${id}`}>
      {/* Canvas Toolbars */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-[#E5E5E1] bg-[#FAFAFA] text-[#718096] gap-2 select-none">
          <div className="flex items-center gap-3">
            {/* Tool Modes */}
            <div className="flex items-center bg-white rounded border border-[#E5E5E1] p-0.5">
              <button
                onClick={() => setIsEraser(false)}
                className={`p-1.5 rounded transition-all cursor-pointer ${!isEraser ? 'bg-[#F1F1F1] text-[#1A1A1A] font-medium' : 'hover:bg-[#FAFAFA] text-[#A0AEC0]'}`}
                title="Pen Tool"
                id="tool-pen"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEraser(true)}
                className={`p-1.5 rounded transition-all cursor-pointer ${isEraser ? 'bg-[#F1F1F1] text-[#1A1A1A] font-medium' : 'hover:bg-[#FAFAFA] text-[#A0AEC0]'}`}
                title="Eraser Tool"
                id="tool-eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            {/* Color Select (Hidden if Eraser) */}
            {!isEraser && (
              <div className="flex items-center gap-1.5 border-l border-[#E5E5E1] pl-3">
                {COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setColor(c.hex)}
                    className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${color === c.hex ? 'scale-110 border-[#1A1A1A] shadow-sm' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}

                {/* Custom Color Picker */}
                <label className="relative w-5 h-5 rounded-full border border-dashed border-[#A0AEC0] hover:border-[#1A1A1A] flex items-center justify-center cursor-pointer transition-transform hover:scale-105" title="Custom Color">
                  <div 
                    className="w-3.5 h-3.5 rounded-full" 
                    style={{ 
                      backgroundColor: !COLORS.some(c => c.hex.toLowerCase() === color.toLowerCase()) ? color : '#CBD5E1',
                      backgroundImage: COLORS.some(c => c.hex.toLowerCase() === color.toLowerCase()) ? 'none' : 'linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)'
                    }} 
                  />
                  <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Thickness Select - Range Slider and Quick Presets */}
            <div className="flex items-center gap-2 bg-white rounded border border-[#E5E5E1] px-2 py-1 h-8">
              <span className="text-[10px] font-mono font-medium text-[#718096] whitespace-nowrap min-w-[34px]">
                {width}px
              </span>
              <input
                type="range"
                min="2"
                max="100"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-16 sm:w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
                title="Brush/Eraser Size Slider"
              />
              <div className="hidden md:flex items-center gap-0.5 border-l border-gray-200 pl-1.5">
                {WIDTHS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWidth(w)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer ${width === w ? 'bg-[#F1F1F1] text-[#1A1A1A] font-semibold' : 'hover:bg-[#FAFAFA] text-[#A0AEC0]'}`}
                    title={`Set size ${w}px`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Canvas */}
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-[#718096] hover:text-red-600 bg-white border border-[#E5E5E1] px-2 py-1 rounded transition-colors shadow-xs cursor-pointer"
              title="Clear canvas sketches"
              id="btn-clear-canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-light">Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Canvas Drawing Workspace */}
      <div 
        ref={containerRef} 
        className={readOnly ? "relative w-full h-full bg-[#FFFFFF]" : `flex-grow bg-[#FFFFFF] relative cursor-none min-h-[300px] overflow-hidden ${className}`}
        onPointerLeave={() => setCursorPos(null)}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={readOnly ? undefined : handlePointerDown}
          onPointerMove={readOnly ? undefined : handlePointerMove}
          onPointerUp={readOnly ? undefined : handlePointerUp}
          className={`absolute inset-0 w-full h-full block ${readOnly ? 'pointer-events-none' : 'touch-none select-none'}`}
        />
        {/* Dynamic Visual Circle Cursor for Eraser or Brush Width representation */}
        {cursorPos && !readOnly && (
          <div
            className="absolute pointer-events-none rounded-full"
            style={{
              left: cursorPos.x - width / 2,
              top: cursorPos.y - width / 2,
              width: `${width}px`,
              height: `${width}px`,
              border: isEraser ? '1.5px dashed #4B5563' : `1.5px solid ${color}`,
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8)',
              backgroundColor: isEraser ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.05)',
              transform: 'translate3d(0, 0, 0)',
              zIndex: 40,
            }}
          />
        )}
      </div>
    </div>
  );
}
