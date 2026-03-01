/* ============================================================
   new-app.js  –  Shared auth / storage / helpers
   ============================================================ */

(function (window) {
  'use strict';

  /* ── Demo Users ─────────────────────────────────────────── */
  const DEMO_USERS = {
    '1111': { name: 'Admin',          role: 'admin',         password: '1234' },
    '2222': { name: 'مشتريات1',       role: 'procurement',   password: '1234' },
    '3333': { name: 'مشتريات2',       role: 'procurement',   password: '1234' },
    '4444': { name: 'مدير مشتريات',  role: 'proc_manager',  password: '1234' },
    '5555': { name: 'مبيعات1',        role: 'sales',         password: '1234' },
    '6666': { name: 'مدير مبيعات',   role: 'sales_manager', password: '1234' },
    '7777': { name: 'مدير عام',      role: 'gm',            password: '1234' },
    '8888': { name: 'تشغيل',         role: 'operations',    password: '1234' },
  };

  /* ── Role helpers ────────────────────────────────────────── */
  const MANAGER_ROLES = ['gm', 'proc_manager', 'sales_manager', 'admin'];
  const GM_ROLES      = ['gm'];

  function isManager(role) { return MANAGER_ROLES.includes(role); }
  function isGM(role)      { return GM_ROLES.includes(role); }
  function canApprove(role){ return ['gm', 'proc_manager', 'admin'].includes(role); }
  function canArchive(role){ return ['gm', 'proc_manager', 'admin'].includes(role); }

  function homeUrl(role) {
    const map = {
      admin:         'new-admin-users.html',
      proc_manager:  'new-home.html',
      gm:            'new-home.html',
      sales_manager: 'new-sales-manager.html',
      operations:    'new-operations.html',
    };
    return map[role] || null;
  }

  /* ── Session (sessionStorage) ────────────────────────────── */
  const SESSION_KEY = 'new_app_session';

  function login(username, password) {
    const u = DEMO_USERS[username];
    if (!u || u.password !== password) return null;
    const session = { username, name: u.name, role: u.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'new-login.html';
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (_e) { return null; }
  }

  /**
   * Call on protected pages. If not logged in, redirect to login.
   * Optionally pass allowed roles array.
   */
  function requireAuth(allowedRoles) {
    const s = getSession();
    if (!s) { window.location.href = 'new-login.html'; return null; }
    if (allowedRoles && !allowedRoles.includes(s.role)) {
      window.location.href = 'new-login.html';
      return null;
    }
    return s;
  }

  /* ── Role-based redirect after login ─────────────────────── */
  function redirectByRole(role) {
    const map = {
      admin:         'new-admin-users.html',
      sales:         'new-sales-report.html',
      sales_manager: 'new-sales-manager.html',
      procurement:   'new-proc-report.html',
      proc_manager:  'new-home.html',
      gm:            'new-home.html',
      operations:    'new-operations.html',
    };
    window.location.href = map[role] || 'new-login.html';
  }

  /* ── Server Date ─────────────────────────────────────────── */
  async function fetchServerDate() {
    try {
      const r = await fetch('/api/date');
      const j = await r.json();
      return j.date ? j.date.substring(0, 10) : todayLocal();
    } catch {
      return todayLocal();
    }
  }

  function todayLocal() {
    return new Date().toISOString().substring(0, 10);
  }

  function currentPeriod() {
    return todayLocal().substring(0, 7); // YYYY-MM
  }

  /* ── localStorage helpers ────────────────────────────────── */
  function lsGet(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch (_e) { return def; }
  }

  function lsSet(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  /* ── ID generator ─────────────────────────────────────────── */
  let _idCounter = 0;
  function generateId() {
    return Date.now() * 1000 + (_idCounter++ % 1000);
  }

  /* ── Rows storage (per sheet) ─────────────────────────────── */
  function getRows(sheet, period) {
    const all = lsGet('rows_' + sheet, {});
    return all[period] || [];
  }

  function saveRows(sheet, period, rows) {
    const all = lsGet('rows_' + sheet, {});
    all[period] = rows;
    lsSet('rows_' + sheet, all);
  }

  function addRow(sheet, period, row) {
    const rows = getRows(sheet, period);
    row.id = generateId();
    rows.push(row);
    saveRows(sheet, period, rows);
    return row;
  }

  function updateRow(sheet, period, id, updates) {
    const rows = getRows(sheet, period);
    const idx = rows.findIndex(r => r.id === id);
    if (idx !== -1) { Object.assign(rows[idx], updates); saveRows(sheet, period, rows); }
  }

  function deleteRow(sheet, period, id) {
    const rows = getRows(sheet, period).filter(r => r.id !== id);
    saveRows(sheet, period, rows);
  }

  /* ── Materials storage ────────────────────────────────────── */
  const MAT_KEY = 'new_materials';

  function getMaterials() { return lsGet(MAT_KEY, []); }

  function saveMaterials(mats) { lsSet(MAT_KEY, mats); }

  function addMaterialRequest(name, nameEn, unit, requestedBy) {
    const mats = getMaterials();
    const mat = {
      id: generateId(),
      name,
      nameEn,
      unit: unit || 'طن',
      status: 'pending',
      requestedBy,
      createdAt: todayLocal(),
    };
    mats.push(mat);
    saveMaterials(mats);
    return mat;
  }

  function approveMaterial(id, unit) {
    const mats = getMaterials();
    const m = mats.find(x => x.id === id);
    if (m) { m.status = 'approved'; if (unit) m.unit = unit; }
    saveMaterials(mats);
  }

  function rejectMaterial(id) {
    const mats = getMaterials();
    const m = mats.find(x => x.id === id);
    if (m) m.status = 'rejected';
    saveMaterials(mats);
  }

  function getApprovedMaterials() {
    return getMaterials().filter(m => m.status === 'approved');
  }

  /* ── Customers storage ────────────────────────────────────── */
  const CUSTOMERS_KEY = 'new_customers';

  function getCustomers() { return lsGet(CUSTOMERS_KEY, []); }
  function saveCustomers(list) { lsSet(CUSTOMERS_KEY, list); }

  function addCustomer(data, requestedBy) {
    const list = getCustomers();
    const c = Object.assign({}, data, { id: generateId(), status: 'pending', requestedBy, createdAt: todayLocal() });
    list.push(c);
    saveCustomers(list);
    return c;
  }

  function updateCustomer(id, updates) {
    const list = getCustomers();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) { Object.assign(list[idx], updates); saveCustomers(list); }
  }

  function approveCustomer(id) { updateCustomer(id, { status: 'active' }); }
  function rejectCustomer(id)  { updateCustomer(id, { status: 'rejected' }); }

  function requestCustomerDeactivate(id, requestedBy) {
    updateCustomer(id, { deactivateRequest: true, deactivateRequestedBy: requestedBy });
  }
  function approveCustomerDeactivate(id) {
    updateCustomer(id, { status: 'inactive', deactivateRequest: false });
  }
  function rejectCustomerDeactivate(id) {
    updateCustomer(id, { deactivateRequest: false });
  }

  function getActiveCustomers() { return getCustomers().filter(c => c.status === 'active'); }

  /* ── Suppliers storage ────────────────────────────────────── */
  const SUPPLIERS_KEY = 'new_suppliers';

  function getSuppliers() { return lsGet(SUPPLIERS_KEY, []); }
  function saveSuppliers(list) { lsSet(SUPPLIERS_KEY, list); }

  function addSupplier(data, requestedBy) {
    const list = getSuppliers();
    const s = Object.assign({}, data, { id: generateId(), status: 'pending', requestedBy, createdAt: todayLocal() });
    list.push(s);
    saveSuppliers(list);
    return s;
  }

  function updateSupplier(id, updates) {
    const list = getSuppliers();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) { Object.assign(list[idx], updates); saveSuppliers(list); }
  }

  function approveSupplier(id) { updateSupplier(id, { status: 'active' }); }
  function rejectSupplier(id)  { updateSupplier(id, { status: 'rejected' }); }

  function requestSupplierDeactivate(id, requestedBy) {
    updateSupplier(id, { deactivateRequest: true, deactivateRequestedBy: requestedBy });
  }
  function approveSupplierDeactivate(id) {
    updateSupplier(id, { status: 'inactive', deactivateRequest: false });
  }
  function rejectSupplierDeactivate(id) {
    updateSupplier(id, { deactivateRequest: false });
  }

  function getActiveSuppliers() { return getSuppliers().filter(s => s.status === 'active'); }

  /* ── Navbar helper ────────────────────────────────────────── */
  function renderNavbar(container, session, extraLinks) {
    const role = session.role;
    let links = '';
    if (extraLinks) {
      links = extraLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    }
    container.innerHTML = `
      <span class="brand">النظام الداخلي</span>
      <div class="nav-links">
        ${links}
        <span class="user-info">👤 ${session.name} (${roleLabel(role)})</span>
        <button class="btn-logout" onclick="App.logout()">تسجيل الخروج</button>
      </div>`;
  }

  function roleLabel(role) {
    const m = { admin:'مدير النظام', sales:'مبيعات', sales_manager:'مدير مبيعات',
                 procurement:'مشتريات', proc_manager:'مدير مشتريات',
                 gm:'مدير عام', operations:'تشغيل' };
    return m[role] || role;
  }

  /* ── Period select helper ─────────────────────────────────── */
  function buildPeriodOptions(currentOnly) {
    const now = currentPeriod();
    if (currentOnly) return `<option value="${now}">${now}</option>`;
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      opts.push(`<option value="${val}"${val === now ? ' selected' : ''}>${val}</option>`);
      d.setMonth(d.getMonth() - 1);
    }
    return opts.join('');
  }

  /* ── HTML escaping ───────────────────────────────────────── */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Export public API ────────────────────────────────────── */
  window.App = {
    login, logout, getSession, requireAuth, redirectByRole, homeUrl,
    fetchServerDate, todayLocal, currentPeriod,
    getRows, saveRows, addRow, updateRow, deleteRow,
    getMaterials, saveMaterials, addMaterialRequest,
    approveMaterial, rejectMaterial, getApprovedMaterials,
    getCustomers, saveCustomers, addCustomer, updateCustomer,
    approveCustomer, rejectCustomer, requestCustomerDeactivate,
    approveCustomerDeactivate, rejectCustomerDeactivate, getActiveCustomers,
    getSuppliers, saveSuppliers, addSupplier, updateSupplier,
    approveSupplier, rejectSupplier, requestSupplierDeactivate,
    approveSupplierDeactivate, rejectSupplierDeactivate, getActiveSuppliers,
    renderNavbar, roleLabel, buildPeriodOptions,
    isManager, isGM, canApprove, canArchive,
    escHtml,
    DEMO_USERS,
  };

}(window));
