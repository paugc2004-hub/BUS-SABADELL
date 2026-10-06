import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bottom sheet arrastrable en móvil, panel lateral en escritorio.
 * Altura con dvh y safe areas (bug 12.4-31). Escape cierra.
 */
export function Sheet({ children, onClose, label, className = '' }: { children: ReactNode; onClose: () => void; label: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(-40, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current === null) return;
    if (drag > 140) onClose();
    else if (drag > 50) setCollapsed(true);
    else if (drag < -20) setCollapsed(false);
    start.current = null;
    setDrag(0);
  };

  return (
    <section
      ref={ref}
      className={`sheet ${collapsed ? 'collapsed' : ''} ${className}`}
      role="dialog"
      aria-label={label}
      style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
    >
      <div
        className="sheet-grip"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => collapsed && setCollapsed(false)}
        aria-hidden
      >
        <span />
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
