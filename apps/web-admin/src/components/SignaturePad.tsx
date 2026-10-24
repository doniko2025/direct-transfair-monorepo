// apps/web-admin/src/components/SignaturePad.tsx
// Zone de signature manuscrite : se dessine au doigt (téléphone, tablette) ou à la souris. Le résultat est un PNG
// transparent en data URL (640×200). `onChange` reçoit null tant que le tracé est vide ou trop court.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from './ui';

const W = 640;
const H = 200;
const MIN_POINTS = 14; // un simple point ou un trait minuscule n'est pas une signature
const MIN_SPAN = 40; // largeur ou hauteur minimale du tracé, en pixels du canevas

interface Props {
  onChange: (png: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const stats = useRef({ points: 0, minX: W, maxX: 0, minY: H, maxY: 0 });
  const [empty, setEmpty] = useState(true);

  const reset = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    stats.current = { points: 0, minX: W, maxX: 0, minY: H, maxY: 0 };
    setEmpty(true);
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  function pos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  function start(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    track(last.current);
  }

  function track(p: { x: number; y: number }) {
    const s = stats.current;
    s.points += 1;
    s.minX = Math.min(s.minX, p.x);
    s.maxX = Math.max(s.maxX, p.x);
    s.minY = Math.min(s.minY, p.y);
    s.maxY = Math.max(s.maxY, p.y);
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    const p = pos(e);
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
    track(p);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const s = stats.current;
    const enough = s.points >= MIN_POINTS && (s.maxX - s.minX >= MIN_SPAN || s.maxY - s.minY >= MIN_SPAN);
    setEmpty(!enough);
    onChange(enough ? (canvasRef.current?.toDataURL('image/png') ?? null) : null);
  }

  return (
    <div className="sigpad">
      <div className={`sigpad__surface${disabled ? ' is-disabled' : ''}`}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="sigpad__canvas"
          role="img"
          aria-label="Zone de signature : dessinez votre signature au doigt ou à la souris"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {empty ? <span className="sigpad__hint">Signez ici</span> : null}
        <span className="sigpad__line" aria-hidden="true" />
      </div>
      <div className="sigpad__actions">
        <Button variant="ghost" icon="refresh" onClick={reset} disabled={disabled || empty}>
          Effacer et recommencer
        </Button>
      </div>
    </div>
  );
}
