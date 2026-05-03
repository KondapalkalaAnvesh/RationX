// Smart Ration Shop client-side logic (customers + shopkeepers)
(function(){
  const storage = {
    get(k, d) { try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch(e){return d} },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
  }

  // default data
  const defaultState = {
    inventory: [
      {id:'rice', name:'Rice (kg)', stock:100, uom:'pack'},
      {id:'wheat', name:'Wheat (kg)', stock:80, uom:'pack'},
      {id:'sugar', name:'Sugar (kg)', stock:50, uom:'pack'}
    ],
    queue: [],
    nextToken: 1,
    sales: [],
    currentShop: null
  }
  const defaultUsers = { customers: [], shops: [] }

  let state = storage.get('ration_state', defaultState);
  let users = storage.get('ration_users', defaultUsers);

  // helpers
  function formatToken(n){ return `T-${String(n).padStart(3,'0')}` }
  function nowPlusMinutes(min){ const d=new Date(); d.setMinutes(d.getMinutes()+min); return d }
  function formatTime(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }

  // DOM refs
  // Customer
  const rcInput = document.getElementById('rc-number');
  const custNameInput = document.getElementById('cust-name');
  const mobileInput = document.getElementById('mobile');
  const btnRegister = document.getElementById('btn-register');
  const customerTokenBox = document.getElementById('customer-token');
  const tokenNumber = document.getElementById('token-number');
  const tokenTime = document.getElementById('token-time');
  const tokenName = document.getElementById('token-name');
  const custPass = document.getElementById('cust-pass');
  const loginRc = document.getElementById('login-rc');
  const loginPass = document.getElementById('login-pass');
  const btnLoginCust = document.getElementById('btn-login-cust');

  // Shopkeeper
  const btnRegisterShop = document.getElementById('btn-register-shop');
  const shopIdInput = document.getElementById('shop-id');
  const govIdInput = document.getElementById('gov-id');
  const shopNameInput = document.getElementById('shop-name');
  const shopContactInput = document.getElementById('shop-contact');
  const shopPassInput = document.getElementById('shop-pass');
  const btnLoginShop = document.getElementById('btn-login-shop');
  const loginShopId = document.getElementById('login-shopid');
  const loginShopPass = document.getElementById('login-shop-pass');

  // Admin panel controls
  const adminPanel = document.getElementById('admin-panel');
  const queueList = document.getElementById('queue-list');
  const btnNext = document.getElementById('btn-next');
  const btnReset = document.getElementById('btn-reset');
  const btnUpdateStockNow = document.getElementById('btn-update-stock-now');
  const inventoryList = document.getElementById('inventory-list');
  const stockLastUpdated = document.getElementById('stock-last-updated');

  // Sales
  const sellRC = document.getElementById('sell-rc');
  const sellItem = document.getElementById('sell-item');
  const sellQty = document.getElementById('sell-qty');
  const btnSell = document.getElementById('btn-sell');
  const salesLog = document.getElementById('sales-log');

  // Public
  const stockStatus = document.getElementById('stock-status');
  const upcomingTokens = document.getElementById('upcoming-tokens');
  // Role selection and sections
  const btnShowCustomer = document.getElementById('btn-show-customer');
  const btnShowShop = document.getElementById('btn-show-shop');
  const roleSelect = document.getElementById('role-select');
  const customerSection = document.getElementById('customer-section');
  const shopSection = document.getElementById('shop-section');
  const customerDashboard = document.getElementById('customer-dashboard');
  const custStockList = document.getElementById('cust-stock-list');
  const distStartInput = document.getElementById('dist-start');
  const distEndInput = document.getElementById('dist-end');
  const btnSetDates = document.getElementById('btn-set-dates');
  const btnSaveInventory = document.getElementById('btn-save-inventory');
  const inventoryEdit = document.getElementById('inventory-edit');
  // new subview buttons
  const btnCustShowRegister = document.getElementById('btn-cust-show-register');
  const btnCustShowLogin = document.getElementById('btn-cust-show-login');
  const btnBackCustomer = document.getElementById('btn-back-customer');
  const custRegisterView = document.getElementById('customer-register');
  const custLoginView = document.getElementById('customer-login');
  const btnCustLogout = document.getElementById('btn-cust-logout');
  const custAuthControls = document.getElementById('cust-auth-controls');

  const btnShopShowRegister = document.getElementById('btn-shop-show-register');
  const btnShopShowLogin = document.getElementById('btn-shop-show-login');
  const btnBackShop = document.getElementById('btn-back-shop');
  const shopRegisterView = document.getElementById('shop-register');
  const shopLoginView = document.getElementById('shop-login');
  const btnShopLogout = document.getElementById('btn-shop-logout');
  const shopAuthControls = document.getElementById('shop-auth-controls');

  // persist
  function save(){ storage.set('ration_state', state); renderAll(); }
  function saveUsers(){ storage.set('ration_users', users); }

  // Distribution dates stored in state
  state.distribution = state.distribution || { start: null, end: null };

  // Customer registration
  btnRegister.addEventListener('click', ()=>{
    const rc = (rcInput.value||'').trim();
    const cname = (custNameInput && custNameInput.value||'').trim();
    const mobile = (mobileInput.value||'').trim();
    const pass = (custPass.value||'').trim();
    if(!rc || !/^\d{10}$/.test(mobile)){ alert('Please enter ration card and valid 10 digit mobile number.'); return }
    if(!pass || pass.length < 4){ alert('Password min 4 chars'); return }
    if(users.customers.find(c=>c.rc===rc)){ alert('Ration card already registered. Please login.'); return }
    users.customers.push({rc,mobile,pass, name: cname}); saveUsers();
    alert('Customer account created — now login to request token');
    rcInput.value=''; mobileInput.value=''; custPass.value='';
  })

  // Customer login & token request
  btnLoginCust.addEventListener('click', ()=>{
    const rc = (loginRc.value||'').trim();
    const pass = (loginPass.value||'').trim();
    if(!rc || !pass){ alert('Enter credentials'); return }
    const user = users.customers.find(c=>c.rc===rc && c.pass===pass);
    if(!user){ alert('Invalid customer credentials'); return }

    // existing token check
    const existing = state.queue.find(q=>q.rc===rc && !q.called);
    if(existing){ showToken(existing); return }

    const token = state.nextToken++;
    const estimatedMinutes = state.queue.filter(q=>!q.called).length * 5 + 5; // 5 min per person
    const pickupAt = nowPlusMinutes(estimatedMinutes);
    const entry = { token, rc, mobile: user.mobile, name: user.name || '', issuedAt: Date.now(), pickupAt: pickupAt.getTime(), called:false };
    state.queue.push(entry);
    // mark this session as the current logged-in customer so public dashboard can highlight
    state.currentCustomer = rc;
    save(); showToken(entry);
    onCustomerLoggedIn();
  })

  function showToken(entry){ tokenNumber.textContent = `#${formatToken(entry.token)}`; tokenName && (tokenName.textContent = `Name: ${entry.name || '-'}`); tokenTime.textContent = `Estimated pickup: ${formatTime(new Date(entry.pickupAt))}`; customerTokenBox.classList.remove('hidden'); }

  // Role selection handlers
  btnShowCustomer && btnShowCustomer.addEventListener('click', ()=>{
    roleSelect.classList.add('hidden');
    customerSection.classList.remove('hidden');
  })
  btnShowShop && btnShowShop.addEventListener('click', ()=>{
    roleSelect.classList.add('hidden');
    shopSection.classList.remove('hidden');
  })

  // customer subviews
  btnCustShowRegister && btnCustShowRegister.addEventListener('click', ()=>{ custRegisterView.classList.remove('hidden'); custLoginView.classList.add('hidden'); btnBackCustomer.classList.remove('hidden'); })
  btnCustShowLogin && btnCustShowLogin.addEventListener('click', ()=>{ custRegisterView.classList.add('hidden'); custLoginView.classList.remove('hidden'); btnBackCustomer.classList.remove('hidden'); })
  btnBackCustomer && btnBackCustomer.addEventListener('click', ()=>{ customerSection.classList.add('hidden'); roleSelect.classList.remove('hidden'); custRegisterView.classList.add('hidden'); custLoginView.classList.add('hidden'); btnBackCustomer.classList.add('hidden'); })

  // shopkeeper subviews
  btnShopShowRegister && btnShopShowRegister.addEventListener('click', ()=>{ shopRegisterView.classList.remove('hidden'); shopLoginView.classList.add('hidden'); btnBackShop.classList.remove('hidden'); })
  btnShopShowLogin && btnShopShowLogin.addEventListener('click', ()=>{ shopRegisterView.classList.add('hidden'); shopLoginView.classList.remove('hidden'); btnBackShop.classList.remove('hidden'); })
  btnBackShop && btnBackShop.addEventListener('click', ()=>{ shopSection.classList.add('hidden'); roleSelect.classList.remove('hidden'); shopRegisterView.classList.add('hidden'); shopLoginView.classList.add('hidden'); btnBackShop.classList.add('hidden'); })

  // Shopkeeper registration
  btnRegisterShop.addEventListener('click', ()=>{
    const shopId = (shopIdInput.value||'').trim();
    const govId = (govIdInput.value||'').trim();
    const name = (shopNameInput.value||'').trim();
    const contact = (shopContactInput.value||'').trim();
    const pass = (shopPassInput.value||'').trim();
    if(!shopId || !govId || !name || !pass){ alert('Fill required shop details'); return }
    if(users.shops.find(s=>s.shopId===shopId)){ alert('Shop already registered'); return }
    users.shops.push({shopId, govId, name, contact, pass, lastStockUpdate: Date.now()}); saveUsers();
    alert('Shop registered. Login to access admin panel.');
    shopIdInput.value=''; govIdInput.value=''; shopNameInput.value=''; shopContactInput.value=''; shopPassInput.value='';
  })

  // Shopkeeper login
  btnLoginShop.addEventListener('click', ()=>{
    const shopId = (loginShopId.value||'').trim();
    const pass = (loginShopPass.value||'').trim();
    if(!shopId || !pass){ alert('Enter credentials'); return }
    const shop = users.shops.find(s=>s.shopId===shopId && s.pass===pass);
    if(!shop){ alert('Invalid shop credentials'); return }
    state.currentShop = shopId; save();
    adminPanel.classList.remove('hidden');
    btnLoginShop.disabled = true; loginShopId.disabled = true; loginShopPass.disabled = true;
    // hide auth toggles and show logout for shop
    if(shopAuthControls) shopAuthControls.querySelectorAll('button').forEach(b=>b.classList.add('hidden'));
    if(btnShopLogout) btnShopLogout.classList.remove('hidden');
    renderAll();
    ensureHourlyStockUpdater();
  })

  // Set distribution dates
  btnSetDates && btnSetDates.addEventListener('click', ()=>{
    const s = distStartInput.value || null;
    const e = distEndInput.value || null;
    state.distribution = { start: s, end: e };
    save();
    alert('Distribution dates saved');
  })

  // Inventory edit UI
  function renderInventoryEdit(){
    if(!inventoryEdit) return;
    inventoryEdit.innerHTML = '';
    state.inventory.forEach(item=>{
      const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center'; row.style.marginBottom='6px';
      const name = document.createElement('div'); name.style.minWidth='160px'; name.textContent = item.name;
      const input = document.createElement('input'); input.type='number'; input.value = item.stock; input.min=0; input.dataset.itemId = item.id; input.style.width='80px';
      row.appendChild(name); row.appendChild(input);
      inventoryEdit.appendChild(row);
    })
  }

  btnSaveInventory && btnSaveInventory.addEventListener('click', ()=>{
    if(!inventoryEdit) return;
    const inputs = inventoryEdit.querySelectorAll('input[data-item-id]');
    inputs.forEach(inp=>{
      const id = inp.dataset.itemId; const val = Number(inp.value) || 0;
      const it = state.inventory.find(i=>i.id===id); if(it) it.stock = val;
    });
    save();
    alert('Inventory updated');
  })

  // queue functions
  function renderQueue(){ queueList.innerHTML=''; state.queue.forEach(q=>{ const li = document.createElement('li'); li.textContent = `${formatToken(q.token)} — RC:${q.rc} — ${q.called? 'CALLED':'Waiting'} — ETA ${formatTime(new Date(q.pickupAt))}`; queueList.appendChild(li); }) }
  btnNext.addEventListener('click', ()=>{ const next = state.queue.find(q=>!q.called); if(!next){ alert('Queue empty'); return } next.called = true; next.calledAt = Date.now(); save(); alert(`Calling ${formatToken(next.token)} — RC:${next.rc}`); })
  btnReset.addEventListener('click', ()=>{ if(!confirm('Reset queue and tokens?')) return; state.queue=[]; state.nextToken=1; save(); })

  // inventory and sales
  function renderInventory(){ inventoryList.innerHTML=''; sellItem.innerHTML=''; state.inventory.forEach(item=>{ const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.padding='6px 0'; row.innerHTML = `<div>${item.name}</div><div><strong>${item.stock}</strong></div>`; inventoryList.appendChild(row); const opt = document.createElement('option'); opt.value = item.id; opt.textContent = item.name; sellItem.appendChild(opt); }) }

  btnSell.addEventListener('click', ()=>{ const rc = (sellRC.value||'').trim(); const itemId = sellItem.value; const qty = Number(sellQty.value) || 0; if(!rc || !itemId || qty<=0){ alert('Please fill sale details'); return } const it = state.inventory.find(i=>i.id===itemId); if(!it){ alert('Invalid item'); return } if(it.stock < qty){ alert('Not enough stock'); return } it.stock -= qty; const sale = { id: state.sales.length+1, rc, itemId, qty, at: Date.now() }; state.sales.push(sale); save(); alert('Sale recorded'); })

  function renderSales(){ salesLog.innerHTML=''; state.sales.slice().reverse().forEach(s=>{ const it = state.inventory.find(i=>i.id===s.itemId) || {name:s.itemId}; const li = document.createElement('li'); li.textContent = `${new Date(s.at).toLocaleString()} — RC:${s.rc} — ${it.name} x ${s.qty}`; salesLog.appendChild(li); }) }

  // public dashboard
  function renderPublic(){ stockStatus.innerHTML = '<h4>Stock Availability</h4>'; const list = document.createElement('div'); state.inventory.forEach(i=>{ const p = document.createElement('div'); p.textContent = `${i.name}: ${i.stock}`; list.appendChild(p); if(i.stock < 10){ const note = document.createElement('small'); note.style.color='crimson'; note.textContent = ' — Low stock — please restock soon'; list.appendChild(note); } }); stockStatus.appendChild(list);
    // show pending tokens (public)
    upcomingTokens.innerHTML = '<h4>Pending Tokens</h4>';
    const up = document.createElement('div');
    const nextOnes = state.queue.filter(q=>!q.called);
    if(nextOnes.length===0) up.textContent='No pending customers';
    nextOnes.forEach(q=>{
      const d = new Date(q.pickupAt);
      const p = document.createElement('div');
      p.className = 'pending-token';
      p.dataset.rc = q.rc;
      p.textContent = `${formatToken(q.token)} — ${q.name || q.rc} — ETA ${formatTime(d)}`;
      if(state.currentCustomer && q.rc === state.currentCustomer){ p.classList.add('my-token'); p.textContent = `>> ${p.textContent} <<`; }
      up.appendChild(p);
    })
    upcomingTokens.appendChild(up);
  }

  // customer dashboard: show distribution dates and stock
  function renderCustomerDashboard(){
    if(!customerDashboard) return;
    if(state.distribution && (state.distribution.start || state.distribution.end)){
      customerDashboard.classList.remove('hidden');
      const s = state.distribution.start || '-';
      const e = state.distribution.end || '-';
      const p = document.getElementById('dist-dates'); if(p) p.textContent = `Start: ${s}  End: ${e}`;
    } else {
      // hide if not set
      const p = document.getElementById('dist-dates'); if(p) p.textContent = `Start: -  End: -`;
      customerDashboard.classList.remove('hidden');
    }
    if(custStockList){ custStockList.innerHTML = ''; state.inventory.forEach(i=>{ const d = document.createElement('div'); d.textContent = `${i.name}: ${i.stock}`; custStockList.appendChild(d); }) }
  }

  // When customer logs in, hide register/login buttons and show logout
  function onCustomerLoggedIn(){
    if(custAuthControls) custAuthControls.querySelectorAll('button').forEach(b=>b.classList.add('hidden'));
    if(btnCustLogout) btnCustLogout.classList.remove('hidden');
  }

  // Logout handlers
  btnCustLogout && btnCustLogout.addEventListener('click', ()=>{
    // clear session customer marker
    state.currentCustomer = null; save();
    // show auth controls again
    if(custAuthControls) custAuthControls.querySelectorAll('button').forEach(b=>b.classList.remove('hidden'));
    // hide logout and any token/dashboard
    if(btnCustLogout) btnCustLogout.classList.add('hidden');
    customerTokenBox.classList.add('hidden');
    customerSection.classList.add('hidden');
    roleSelect.classList.remove('hidden');
  })

  btnShopLogout && btnShopLogout.addEventListener('click', ()=>{
    state.currentShop = null; save();
    if(shopAuthControls) shopAuthControls.querySelectorAll('button').forEach(b=>b.classList.remove('hidden'));
    if(btnShopLogout) btnShopLogout.classList.add('hidden');
    adminPanel.classList.add('hidden');
    shopSection.classList.add('hidden');
    roleSelect.classList.remove('hidden');
    if(window._stockInterval) clearInterval(window._stockInterval);
  })

  function renderAll(){ renderQueue(); renderInventory(); renderSales(); renderPublic(); renderStockTimestamp(); renderCustomerDashboard(); renderInventoryEdit(); }

  // update auth control visibility based on current sessions
  function refreshAuthControls(){
    if(state.currentCustomer){ if(custAuthControls) custAuthControls.querySelectorAll('button').forEach(b=>b.classList.add('hidden')); if(btnCustLogout) btnCustLogout.classList.remove('hidden'); }
    if(state.currentShop){ if(shopAuthControls) shopAuthControls.querySelectorAll('button').forEach(b=>b.classList.add('hidden')); if(btnShopLogout) btnShopLogout.classList.remove('hidden'); }
  }

  // call refresh once at startup
  refreshAuthControls();


  // stock update: manual and hourly
  btnUpdateStockNow && btnUpdateStockNow.addEventListener('click', ()=>{ if(!state.currentShop){ alert('Shopkeeper not logged in'); return } const shop = users.shops.find(s=>s.shopId===state.currentShop); if(!shop) return; shop.lastStockUpdate = Date.now(); saveUsers(); renderAll(); alert('Stock timestamp updated'); })

  function ensureHourlyStockUpdater(){ if(window._stockInterval) clearInterval(window._stockInterval); window._stockInterval = setInterval(()=>{ if(!state.currentShop) return; const shop = users.shops.find(s=>s.shopId===state.currentShop); if(!shop) return; shop.lastStockUpdate = Date.now(); saveUsers(); renderAll(); }, 1000*60*60); }

  function renderStockTimestamp(){ if(!stockLastUpdated) return; if(!state.currentShop){ stockLastUpdated.textContent='Shopkeeper not logged in'; return } const shop = users.shops.find(s=>s.shopId===state.currentShop); if(!shop){ stockLastUpdated.textContent='No shop data'; return } stockLastUpdated.textContent = `Last stock update: ${new Date(shop.lastStockUpdate).toLocaleString()}` }

  // initial render
  renderAll();

  // expose for debugging
  window._ration_state = state; window._ration_users = users;
})();
