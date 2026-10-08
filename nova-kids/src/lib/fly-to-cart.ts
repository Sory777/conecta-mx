// Pequeña animación: una copia de la imagen del producto vuela hasta el icono del carrito.

export function flyToCart(source: HTMLElement | null) {
  if (!source || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  const target = targets.find((t) => t.offsetParent !== null);
  if (!target) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const img = source instanceof HTMLImageElement ? source : source.querySelector("img");
  const ghost = document.createElement("img");
  ghost.src = img?.currentSrc || img?.src || "";
  ghost.alt = "";
  ghost.className = "fly-to-cart";
  const size = Math.min(from.width, from.height, 220);
  Object.assign(ghost.style, {
    width: `${size}px`,
    height: `${size}px`,
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
  });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 0.95 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(0.5) rotate(-8deg)`, opacity: 0.9, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.2 },
    ],
    { duration: 650, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
  );
  anim.onfinish = () => {
    ghost.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 300 });
  };
}
