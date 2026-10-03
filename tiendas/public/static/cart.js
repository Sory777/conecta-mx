// Carrito en el navegador (por tienda). Solo guarda {id, qty}: los precios y
// el total siempre los calcula el servidor.
(() => {
  const body = document.body;
  const prefix = body.dataset.prefix;
  const KEY = `cart:${body.dataset.store}`;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} updateCount(); };

  function updateCount() {
    const n = read().reduce((s, i) => s + i.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }

  let toastTimer;
  function toast(msg) {
    const el = document.querySelector('.toast');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function add(id, qty) {
    const items = read();
    const found = items.find((i) => i.id === id);
    if (found) found.qty = Math.min(10, found.qty + qty); else items.push({ id, qty });
    write(items);
    toast('Agregado al carrito');
  }

  function setQty(id, qty) {
    write(read().map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0));
    refresh();
  }

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      e.preventDefault();
      let qty = 1;
      if (addBtn.hasAttribute('data-with-qty')) qty = Math.min(10, Math.max(1, parseInt(document.querySelector('[data-qty] input').value, 10) || 1));
      add(Number(addBtn.dataset.add), qty);
      return;
    }
    const q = e.target.closest('[data-qty-inc],[data-qty-dec]');
    if (q) {
      const input = q.closest('[data-qty]').querySelector('input');
      input.value = Math.min(10, Math.max(1, (parseInt(input.value, 10) || 1) + (q.hasAttribute('data-qty-inc') ? 1 : -1)));
      return;
    }
    const line = e.target.closest('[data-line-action]');
    if (line) {
      const id = Number(line.dataset.id);
      const cur = read().find((i) => i.id === id)?.qty || 0;
      const act = line.dataset.lineAction;
      setQty(id, act === 'remove' ? 0 : Math.min(10, cur + (act === 'inc' ? 1 : -1)));
    }
  });

  async function refresh() {
    const lines = document.querySelector('[data-cart-lines]');
    const mini = document.querySelector('[data-cart-mini]');
    if (!lines && !mini) return;
    const res = await fetch(`${prefix}/api/cart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: read() }),
    });
    const data = await res.json();
    // Quita del carrito lo que ya no existe en el catálogo.
    if (data.items.length !== read().length) write(data.items);
    if (lines) lines.innerHTML = data.linesHtml;
    if (mini) mini.innerHTML = data.miniHtml;
    document.querySelectorAll('[data-cart-total]').forEach((el) => { el.textContent = data.totalFmt; });
    document.querySelectorAll('[data-checkout-link]').forEach((el) => { el.hidden = data.count === 0; });
    if (mini && data.count === 0) location.href = `${prefix}/carrito`;
  }

  const form = document.querySelector('[data-checkout-form]');
  if (form) form.addEventListener('submit', () => { form.querySelector('[data-cart-field]').value = JSON.stringify(read()); });

  if (document.querySelector('[data-clear-cart]')) write([]);
  updateCount();
  refresh();
})();
