// Kairuki Pharmaceutical POS — data is stored in the browser's localStorage.

const STORE_KEYS = { products: 'kp_products', sales: 'kp_sales' };

const SEED_PRODUCTS = [
  { code: 'PAR500', name: 'Paracetamol 500mg (10 tabs)', price: 1000, stock: 200 },
  { code: 'AMX250', name: 'Amoxicillin 250mg (10 caps)', price: 3000, stock: 120 },
  { code: 'ALU20', name: 'Artemether/Lumefantrine (ALu) 20/120', price: 6500, stock: 80 },
  { code: 'IBU400', name: 'Ibuprofen 400mg (10 tabs)', price: 1500, stock: 150 },
  { code: 'ORS01', name: 'ORS sachet', price: 500, stock: 300 },
  { code: 'MET500', name: 'Metformin 500mg (30 tabs)', price: 4500, stock: 60 },
  { code: 'CTZ10', name: 'Cetirizine 10mg (10 tabs)', price: 2000, stock: 90 },
  { code: 'VITC', name: 'Vitamin C 500mg (20 tabs)', price: 2500, stock: 8 },
];

const LOW_STOCK = 10;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.) — keep working in memory.
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = (n) => 'TZS ' + Math.round(n).toLocaleString('en-US');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const localDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const $ = (id) => document.getElementById(id);

let products = load(STORE_KEYS.products, null);
if (!products) {
  products = SEED_PRODUCTS.map((p) => ({ id: uid(), ...p }));
  save(STORE_KEYS.products, products);
}
let sales = load(STORE_KEYS.sales, []);
let cart = []; // { productId, qty }

const findProduct = (id) => products.find((p) => p.id === id);

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === 'view-' + btn.dataset.view);
    });
    if (btn.dataset.view === 'products') renderProducts();
    if (btn.dataset.view === 'history') renderHistory();
    if (btn.dataset.view === 'sell') renderResults();
  });
});

// ---------- Sell ----------
function renderResults() {
  const q = $('search').value.trim().toLowerCase();
  const list = products.filter((p) =>
    !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  $('product-results').innerHTML = list.map((p) => `
    <li data-id="${p.id}" class="${p.stock <= 0 ? 'out' : ''}">
      <div>${escapeHtml(p.name)}<small>${escapeHtml(p.code)} · ${p.stock} in stock</small></div>
      <strong>${money(p.price)}</strong>
    </li>`).join('') || '<li class="muted">No products found.</li>';
}

$('search').addEventListener('input', renderResults);
$('product-results').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) addToCart(li.dataset.id);
});

function addToCart(productId) {
  const p = findProduct(productId);
  if (!p || p.stock <= 0) return;
  const line = cart.find((l) => l.productId === productId);
  if (line) {
    if (line.qty >= p.stock) return setMsg(`Only ${p.stock} of ${p.name} in stock.`, 'error');
    line.qty++;
  } else {
    cart.push({ productId, qty: 1 });
  }
  setMsg('');
  renderCart();
}

function cartTotals() {
  const subtotal = cart.reduce((s, l) => s + findProduct(l.productId).price * l.qty, 0);
  const pct = Math.min(100, Math.max(0, Number($('discount').value) || 0));
  const discount = subtotal * pct / 100;
  return { subtotal, pct, discount, total: subtotal - discount };
}

function renderCart() {
  $('cart-body').innerHTML = cart.map((l) => {
    const p = findProduct(l.productId);
    return `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td><input class="qty" type="number" min="1" max="${p.stock}" value="${l.qty}" data-id="${p.id}"></td>
      <td class="num">${money(p.price * l.qty)}</td>
      <td><button class="link danger" data-remove="${p.id}" aria-label="Remove">✕</button></td>
    </tr>`;
  }).join('');
  $('cart-empty').style.display = cart.length ? 'none' : 'block';

  const t = cartTotals();
  $('subtotal').textContent = money(t.subtotal);
  $('discount-amount').textContent = money(t.discount);
  $('total').textContent = money(t.total);
  const paid = Number($('paid').value) || 0;
  $('change').textContent = money(Math.max(0, paid - t.total));
  $('checkout').disabled = cart.length === 0;
}

$('cart-body').addEventListener('change', (e) => {
  if (!e.target.matches('input.qty')) return;
  const p = findProduct(e.target.dataset.id);
  const line = cart.find((l) => l.productId === p.id);
  let qty = Math.floor(Number(e.target.value)) || 1;
  if (qty > p.stock) {
    qty = p.stock;
    setMsg(`Only ${p.stock} of ${p.name} in stock.`, 'error');
  }
  line.qty = Math.max(1, qty);
  renderCart();
});

$('cart-body').addEventListener('click', (e) => {
  const id = e.target.dataset.remove;
  if (!id) return;
  cart = cart.filter((l) => l.productId !== id);
  renderCart();
});

$('discount').addEventListener('input', renderCart);
$('paid').addEventListener('input', renderCart);
$('clear-cart').addEventListener('click', () => {
  cart = [];
  $('discount').value = 0;
  $('paid').value = '';
  setMsg('');
  renderCart();
});

function setMsg(text, kind = '') {
  $('sell-msg').textContent = text;
  $('sell-msg').className = 'msg ' + kind;
}

$('checkout').addEventListener('click', () => {
  if (!cart.length) return;
  const t = cartTotals();
  const payment = $('payment').value;
  const paidInput = $('paid').value;
  const paid = paidInput === '' ? t.total : Number(paidInput);
  if (payment === 'Cash' && paid < t.total) {
    return setMsg('Amount paid is less than the total.', 'error');
  }
  for (const l of cart) {
    const p = findProduct(l.productId);
    if (l.qty > p.stock) return setMsg(`Not enough stock for ${p.name}.`, 'error');
  }

  const now = new Date();
  const sale = {
    id: uid(),
    receiptNo: 'KP-' + String(sales.length + 1).padStart(5, '0'),
    timestamp: now.toISOString(),
    date: localDate(now),
    items: cart.map((l) => {
      const p = findProduct(l.productId);
      return { productId: p.id, code: p.code, name: p.name, price: p.price, qty: l.qty };
    }),
    subtotal: t.subtotal,
    discountPct: t.pct,
    discount: t.discount,
    total: t.total,
    payment,
    paid,
    change: Math.max(0, paid - t.total),
  };

  cart.forEach((l) => { findProduct(l.productId).stock -= l.qty; });
  sales.push(sale);
  save(STORE_KEYS.products, products);
  save(STORE_KEYS.sales, sales);

  cart = [];
  $('discount').value = 0;
  $('paid').value = '';
  renderCart();
  renderResults();
  setMsg(`Sale ${sale.receiptNo} completed.`, 'ok');
  showReceipt(sale);
});

// ---------- Receipt ----------
function showReceipt(sale) {
  const time = new Date(sale.timestamp).toLocaleString();
  $('receipt').innerHTML = `
    <h3>Kairuki Pharmaceutical</h3>
    <p style="text-align:center">Receipt ${sale.receiptNo}<br>${time}</p>
    <hr>
    ${sale.items.map((i) => `
      <div class="line"><span>${escapeHtml(i.name)}</span></div>
      <div class="line"><span>&nbsp;&nbsp;${i.qty} × ${money(i.price)}</span><span>${money(i.qty * i.price)}</span></div>
    `).join('')}
    <hr>
    <div class="line"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
    ${sale.discount ? `<div class="line"><span>Discount (${sale.discountPct}%)</span><span>-${money(sale.discount)}</span></div>` : ''}
    <div class="line"><strong>Total</strong><strong>${money(sale.total)}</strong></div>
    <div class="line"><span>Paid (${escapeHtml(sale.payment)})</span><span>${money(sale.paid)}</span></div>
    <div class="line"><span>Change</span><span>${money(sale.change)}</span></div>
    <hr>
    <p style="text-align:center">Thank you. Get well soon!</p>`;
  $('receipt-dialog').showModal();
}

$('receipt-close').addEventListener('click', () => $('receipt-dialog').close());
$('receipt-print').addEventListener('click', () => window.print());

// ---------- Products ----------
function renderProducts() {
  $('products-body').innerHTML = products.map((p) => `
    <tr class="${p.stock <= LOW_STOCK ? 'low' : ''}">
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${money(p.price)}</td>
      <td class="num">${p.stock}${p.stock <= LOW_STOCK ? ' ⚠' : ''}</td>
      <td class="num">
        <button class="link" data-edit="${p.id}">Edit</button>
        <button class="link danger" data-delete="${p.id}">Delete</button>
      </td>
    </tr>`).join('');
}

function resetProductForm() {
  $('product-form').reset();
  $('p-id').value = '';
}

$('product-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('p-id').value;
  const data = {
    code: $('p-code').value.trim(),
    name: $('p-name').value.trim(),
    price: Number($('p-price').value),
    stock: Math.floor(Number($('p-stock').value)),
  };
  const clash = products.find((p) => p.code.toLowerCase() === data.code.toLowerCase() && p.id !== id);
  if (clash) return alert(`Code "${data.code}" is already used by ${clash.name}.`);

  if (id) Object.assign(findProduct(id), data);
  else products.push({ id: uid(), ...data });
  save(STORE_KEYS.products, products);
  resetProductForm();
  renderProducts();
});

$('p-reset').addEventListener('click', resetProductForm);

$('products-body').addEventListener('click', (e) => {
  const editId = e.target.dataset.edit;
  const deleteId = e.target.dataset.delete;
  if (editId) {
    const p = findProduct(editId);
    $('p-id').value = p.id;
    $('p-code').value = p.code;
    $('p-name').value = p.name;
    $('p-price').value = p.price;
    $('p-stock').value = p.stock;
    $('p-name').focus();
  }
  if (deleteId) {
    const p = findProduct(deleteId);
    if (!confirm(`Delete ${p.name}?`)) return;
    products = products.filter((x) => x.id !== deleteId);
    cart = cart.filter((l) => l.productId !== deleteId);
    save(STORE_KEYS.products, products);
    renderProducts();
    renderCart();
  }
});

// ---------- History ----------
$('history-date').value = localDate(new Date());
$('history-date').addEventListener('change', renderHistory);

function renderHistory() {
  const day = $('history-date').value;
  const list = sales.filter((s) => s.date === day).reverse();
  $('history-body').innerHTML = list.map((s) => `
    <tr>
      <td>${s.receiptNo}</td>
      <td>${new Date(s.timestamp).toLocaleTimeString()}</td>
      <td>${s.items.reduce((n, i) => n + i.qty, 0)}</td>
      <td>${escapeHtml(s.payment)}</td>
      <td class="num">${money(s.total)}</td>
      <td class="num"><button class="link" data-receipt="${s.id}">Receipt</button></td>
    </tr>`).join('');
  $('history-empty').style.display = list.length ? 'none' : 'block';
  $('sum-count').textContent = list.length;
  $('sum-revenue').textContent = money(list.reduce((n, s) => n + s.total, 0));
  $('sum-items').textContent = list.reduce((n, s) => n + s.items.reduce((m, i) => m + i.qty, 0), 0);
}

$('history-body').addEventListener('click', (e) => {
  const id = e.target.dataset.receipt;
  if (id) showReceipt(sales.find((s) => s.id === id));
});

renderResults();
renderCart();
