import { useRef } from 'react';

interface DragOptions {
  /** Llamado con el desplazamiento en píxeles desde el inicio del gesto. */
  onDrag: (dx: number, dy: number, fine: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onDoubleTap?: () => void;
}

/**
 * Arrastre con Pointer Events + pointer capture: funciona con ratón y con
 * varios dedos a la vez (cada control captura su propio puntero), algo
 * imprescindible para mezclar en pantalla táctil.
 */
export function useDrag({ onDrag, onStart, onEnd, onDoubleTap }: DragOptions) {
  const st = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement | SVGElement>) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        onDoubleTap?.();
        return;
      }
      lastTap.current = now;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      st.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      onStart?.();
    },
    onPointerMove(e: React.PointerEvent<HTMLElement | SVGElement>) {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      onDrag(e.clientX - s.x, e.clientY - s.y, e.shiftKey);
    },
    onPointerUp(e: React.PointerEvent<HTMLElement | SVGElement>) {
      if (st.current?.id !== e.pointerId) return;
      st.current = null;
      onEnd?.();
    },
    onPointerCancel(e: React.PointerEvent<HTMLElement | SVGElement>) {
      if (st.current?.id !== e.pointerId) return;
      st.current = null;
      onEnd?.();
    },
  };
}
