import { useEffect, useRef } from 'react';

/**
 * Un único bucle requestAnimationFrame compartido por todos los elementos
 * que se animan (tiempos, medidores, barras de progreso). Las callbacks
 * escriben directamente en el DOM/canvas: cero renders de React por frame.
 */
const subscribers = new Set<(now: number) => void>();
let rafId = 0;

function loop(now: number) {
  subscribers.forEach((fn) => fn(now));
  rafId = subscribers.size ? requestAnimationFrame(loop) : 0;
}

export function useFrame(fn: (now: number) => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const cb = (now: number) => ref.current(now);
    subscribers.add(cb);
    if (!rafId) rafId = requestAnimationFrame(loop);
    return () => {
      subscribers.delete(cb);
    };
  }, []);
}
