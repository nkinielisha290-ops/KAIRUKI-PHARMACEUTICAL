// Kairuki Pharmaceutical POS — data lives in Supabase; access is enforced by RLS.

const db = window.supabase.createClient(window.KP_CONFIG.supabaseUrl, window.KP_CONFIG.supabaseKey);

const LOW_STOCK = 10;

const money = (n) => 'TZS ' + Math.round(Number(n)).toLocaleString('en-US');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const localDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const $ = (id) => document.getElementById(id);

let user = null;
let role = null;
let products = [];
let cart = []; // { productId, qty }
let historySales = [];

const findProduct = (id) => products.find((p) => p.id === id);
const isAdmin = () => role === 'admin';

function setMsg(el, text, kind = '') {
  $(el).textContent = text;
  $(el).className = 'msg ' + kind;
}

// ---------- Screens & auth ----------
function show(screen) {
  for (const id of ['loading-screen', 'auth-screen', 'denied-screen', 'app']) {
    $(id).hidden = id !== screen;
  }
}

let signUpMode = false;
$('auth-toggle').addEventListener('click', () => {
  signUpMode = !signUpMode;
  $('auth-submit').textContent = signUpMode ? 'Create account' : 'Sign in';
  $('auth-toggle-text').textContent = signUpMode ? 'Already have an account?' : 'New staff member?';
  $('auth-toggle').textContent = signUpMode ? 'Sign in' : 'Create an account';
  $('auth-password').autocomplete = signUpMode ? 'new-password' : 'current-password';
  setMsg('auth-msg', '');
});

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  $('auth-submit').disabled = true;
  setMsg('auth-msg', '');
  try {
    if (signUpMode) {
      const { data, error } = await db.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      if (!data.session) setMsg('auth-msg', 'Check your email to confirm your account, then sign in.', 'ok');
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    setMsg('auth-msg', err.message, 'error');
  } finally {
    $('auth-submit').disabled = false;
  }
});

document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', () => db.auth.signOut()));

async function onSession(session) {
  user = session?.user ?? null;
  if (!user) {
    role = null;
    cart = [];
    show('auth-screen');
    return;
  }
  show('loading-screen');
  const { data } = await db.rpc('staff_role');
  role = data;
  if (!role) {
    $('denied-email').textContent = user.email;
    show('denied-screen');
    return;
  }
  document.body.classList.toggle('is-admin', isAdmin());
  $('user-email').textContent = user.email;
  $('user-role').textContent = role;
  show('app');
  switchView('sell');
  await loadProducts();
  renderCart();
}

let lastUserId;
db.auth.onAuthStateChange((event, session) => {
  // Token refreshes fire this too; only rebuild when the signed-in user changes.
  const id = session?.user?.id ?? null;
  if (id === lastUserId && event !== 'SIGNED_OUT') return;
  lastUserId = id;
  // Defer so Supabase isn't called from inside its own auth callback.
  setTimeout(() => onSession(session), 0);
});

// ---------- Tabs ----------
function switchView(view) {
  document.querySelectorAll('.tab[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'products') loadProducts();
  if (view === 'history') loadHistory();
  if (view === 'staff') loadStaff();
  if (view === 'sell') loadProducts();
}
document.querySelectorAll('.tab[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ---------- Products ----------
async function loadProducts() {
  const { data, error } = await db.from('products').select('*').order('name');
  if (error) return setMsg('sell-msg', 'Could not load products: ' + error.message, 'error');
  products = data.map((p) => ({ ...p, price: Number(p.price) }));
  cart = cart.filter((l) => findProduct(l.productId));
  renderResults();
  renderProducts();
  renderCart();
}

function renderProducts() {
  $('products-body').innerHTML = products.map((p) => `
    <tr class="${p.stock <= LOW_STOCK ? 'low' : ''}">
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${money(p.price)}</td>
      <td class="num">${p.stock}${p.stock <= LOW_STOCK ? ' ⚠' : ''}</td>
      <td class="num admin-only">
        <button class="link" data-edit="${p.id}">Edit</button>
        <button class="link danger" data-delete="${p.id}">Delete</button>
      </td>
    </tr>`).join('');
}

function resetProductForm() {
  $('product-form').reset();
  $('p-id').value = '';
}

$('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('p-id').value;
  const row = {
    code: $('p-code').value.trim(),
    name: $('p-name').value.trim(),
    price: Number($('p-price').value),
    stock: Math.floor(Number($('p-stock').value)),
  };
  const { error } = id
    ? await db.from('products').update(row).eq('id', id)
    : await db.from('products').insert(row);
  if (error) {
    const text = error.code === '23505' ? `Code "${row.code}" is already used.` : error.message;
    return setMsg('product-msg', text, 'error');
  }
  setMsg('product-msg', 'Saved.', 'ok');
  resetProductForm();
  loadProducts();
});

$('p-reset').addEventListener('click', () => { resetProductForm(); setMsg('product-msg', ''); });

$('products-body').addEventListener('click', async (e) => {
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
    if (!confirm(`Delete ${p.name}? Past receipts keep its name and price.`)) return;
    const { error } = await db.from('products').delete().eq('id', deleteId);
    if (error) return setMsg('product-msg', error.message, 'error');
    loadProducts();
  }
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
    if (line.qty >= p.stock) return setMsg('sell-msg', `Only ${p.stock} of ${p.name} in stock.`, 'error');
    line.qty++;
  } else {
    cart.push({ productId, qty: 1 });
  }
  setMsg('sell-msg', '');
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
    setMsg('sell-msg', `Only ${p.stock} of ${p.name} in stock.`, 'error');
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

function resetSale() {
  cart = [];
  $('discount').value = 0;
  $('paid').value = '';
  renderCart();
}
$('clear-cart').addEventListener('click', () => { resetSale(); setMsg('sell-msg', ''); });

$('checkout').addEventListener('click', async () => {
  if (!cart.length) return;
  const t = cartTotals();
  const payment = $('payment').value;
  const paidInput = $('paid').value;
  const paid = paidInput === '' ? t.total : Number(paidInput);
  if (payment === 'Cash' && paid < t.total) {
    return setMsg('sell-msg', 'Amount paid is less than the total.', 'error');
  }

  $('checkout').disabled = true;
  setMsg('sell-msg', 'Saving sale…');
  // The database recalculates totals from its own prices and checks stock.
  const { data: sale, error } = await db.rpc('complete_sale', {
    p_items: cart.map((l) => ({ product_id: l.productId, qty: l.qty })),
    p_discount_pct: t.pct,
    p_payment: payment,
    p_paid: paid,
  });
  if (error) {
    setMsg('sell-msg', error.message, 'error');
    $('checkout').disabled = false;
    loadProducts();
    return;
  }

  const { data: items } = await db.from('sale_items').select('*').eq('sale_id', sale.id);
  resetSale();
  await loadProducts();
  setMsg('sell-msg', `Sale ${sale.receipt_no} completed.`, 'ok');
  showReceipt({ ...sale, sale_items: items || [] });
});

// ---------- Receipt ----------
function showReceipt(sale) {
  const time = new Date(sale.created_at).toLocaleString();
  const discountPct = Number(sale.discount_pct);
  $('receipt').innerHTML = `
    <h3>Kairuki Pharmaceutical</h3>
    <p style="text-align:center">Receipt ${escapeHtml(sale.receipt_no)}<br>${time}</p>
    <p style="text-align:center">Served by ${escapeHtml(sale.cashier_email || '—')}</p>
    <hr>
    ${sale.sale_items.map((i) => `
      <div class="line"><span>${escapeHtml(i.name)}</span></div>
      <div class="line"><span>&nbsp;&nbsp;${i.qty} × ${money(i.price)}</span><span>${money(i.qty * i.price)}</span></div>
    `).join('')}
    <hr>
    <div class="line"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
    ${Number(sale.discount) ? `<div class="line"><span>Discount (${discountPct}%)</span><span>-${money(sale.discount)}</span></div>` : ''}
    <div class="line"><strong>Total</strong><strong>${money(sale.total)}</strong></div>
    <div class="line"><span>Paid (${escapeHtml(sale.payment)})</span><span>${money(sale.paid)}</span></div>
    <div class="line"><span>Change</span><span>${money(sale.change)}</span></div>
    <hr>
    <p style="text-align:center">Thank you. Get well soon!</p>`;
  $('receipt-dialog').showModal();
}

$('receipt-close').addEventListener('click', () => $('receipt-dialog').close());
$('receipt-print').addEventListener('click', () => window.print());

// ---------- History ----------
$('history-date').value = localDate(new Date());
$('history-date').addEventListener('change', loadHistory);

async function loadHistory() {
  const [y, m, d] = $('history-date').value.split('-').map(Number);
  if (!y) return;
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  const { data, error } = await db.from('sales')
    .select('*, sale_items(*)')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    $('history-empty').textContent = 'Could not load sales: ' + error.message;
    $('history-empty').style.display = 'block';
    return;
  }
  historySales = data;
  const itemCount = (s) => s.sale_items.reduce((n, i) => n + i.qty, 0);
  $('history-body').innerHTML = data.map((s) => `
    <tr>
      <td>${escapeHtml(s.receipt_no)}</td>
      <td>${new Date(s.created_at).toLocaleTimeString()}</td>
      <td>${escapeHtml(s.cashier_email || '—')}</td>
      <td>${itemCount(s)}</td>
      <td>${escapeHtml(s.payment)}</td>
      <td class="num">${money(s.total)}</td>
      <td class="num"><button class="link" data-receipt="${s.id}">Receipt</button></td>
    </tr>`).join('');
  $('history-empty').textContent = 'No sales on this date.';
  $('history-empty').style.display = data.length ? 'none' : 'block';
  $('sum-count').textContent = data.length;
  $('sum-revenue').textContent = money(data.reduce((n, s) => n + Number(s.total), 0));
  $('sum-items').textContent = data.reduce((n, s) => n + itemCount(s), 0);
}

$('history-body').addEventListener('click', (e) => {
  const id = e.target.dataset.receipt;
  if (id) showReceipt(historySales.find((s) => s.id === id));
});

// ---------- Staff (admin) ----------
async function loadStaff() {
  const { data, error } = await db.from('staff').select('*').order('email');
  if (error) return setMsg('staff-msg', error.message, 'error');
  $('staff-body').innerHTML = data.map((s) => {
    const self = s.email === user.email.toLowerCase();
    return `<tr>
      <td>${escapeHtml(s.email)}${self ? ' <span class="muted">(you)</span>' : ''}</td>
      <td>
        <select data-role="${escapeHtml(s.email)}" ${self ? 'disabled' : ''}>
          <option value="cashier" ${s.role === 'cashier' ? 'selected' : ''}>Cashier</option>
          <option value="admin" ${s.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td class="num">${self ? '' : `<button class="link danger" data-remove-staff="${escapeHtml(s.email)}">Remove</button>`}</td>
    </tr>`;
  }).join('');
}

$('staff-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('s-email').value.trim().toLowerCase();
  const { error } = await db.from('staff').insert({ email, role: $('s-role').value });
  if (error) {
    const text = error.code === '23505' ? `${email} is already on the staff list.` : error.message;
    return setMsg('staff-msg', text, 'error');
  }
  setMsg('staff-msg', `Added ${email}. They can now create an account with this email.`, 'ok');
  $('staff-form').reset();
  loadStaff();
});

$('staff-body').addEventListener('change', async (e) => {
  const email = e.target.dataset.role;
  if (!email) return;
  const { error } = await db.from('staff').update({ role: e.target.value }).eq('email', email);
  setMsg('staff-msg', error ? error.message : `Updated ${email}.`, error ? 'error' : 'ok');
  loadStaff();
});

$('staff-body').addEventListener('click', async (e) => {
  const email = e.target.dataset.removeStaff;
  if (!email || !confirm(`Remove ${email} from staff? They will lose access.`)) return;
  const { error } = await db.from('staff').delete().eq('email', email);
  setMsg('staff-msg', error ? error.message : `Removed ${email}.`, error ? 'error' : 'ok');
  loadStaff();
});
