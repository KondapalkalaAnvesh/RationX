// Smart Ration Shop client-side logic (customers + shopkeepers)
(function(){
  const storage = {
    get(k, d) { try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch(e){return d} },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
  }

  // default data
  const defaultState = {
    inventory: [
      {id:'rice', name:'Rice (80kg)', stock:100, uom:'pack'},
      {id:'wheat', name:'Wheat (5kg)', stock:80, uom:'pack'},
      {id:'sugar', name:'Sugar (1kg)', stock:50, uom:'pack'}
    ],
    queue: [],
    nextToken: 1,
    sales: [],
    currentShop: null
  }
  const defaultUsers = { customers: [], shops: [] }

  let state = storage.get('ration_state', defaultState);
  state.announcements = state.announcements || [];
  let users = storage.get('ration_users', defaultUsers);

  // helpers
  function formatToken(n){ return `T-${String(n).padStart(3,'0')}` }
  function nowPlusMinutes(min){ const d=new Date(); d.setMinutes(d.getMinutes()+min); return d }
  function formatTime(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }

  // map inventory items to display labels for public/admin stock views
  function bagDisplayName(item){
    if(!item) return '';
    if(item.id === 'rice') return '🌾 Rice (80 kg bags)';
    if(item.id === 'wheat') return '🍞 Wheat (50 kg bags)';
    if(item.id === 'sugar') return '🧂 Sugar (30 kg bags)';
    return item.name;
  }

  function getKgPerBag(itemId) {
    if (itemId === 'rice') return 80;
    if (itemId === 'wheat') return 50;
    if (itemId === 'sugar') return 30;
    return 1;
  }

  function formatStock(item) {
    const kgPerBag = getKgPerBag(item.id);
    if (kgPerBag > 1) {
      const totalKgs = Math.round(item.stock * kgPerBag);
      const bags = Math.floor(totalKgs / kgPerBag);
      const looseKgs = totalKgs % kgPerBag;
      if (looseKgs === 0) return `${bags} bags`;
      return `${bags} bags, ${looseKgs} kg`;
    }
    return `${Number(item.stock.toFixed(2))}`;
  }

  // thresholds for warnings (low vs urgent)
  const stockThresholds = {
    rice: { low: 3, urgent: 2 },
    wheat: { low: 2, urgent: 1 },
    sugar: { low: 1, urgent: 0 }
  };

  // DOM refs
  // Customer
  const rcInput = document.getElementById('rc-number');
  const custNameInput = document.getElementById('cust-name');
  const mobileInput = document.getElementById('mobile');
  const custMembersInput = document.getElementById('cust-members');
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
  const btnAutoEntitlement = document.getElementById('btn-auto-entitlement');
  const btnSell = document.getElementById('btn-sell');
  const salesItemsContainer = document.getElementById('sales-items');
  const btnAddSaleItem = document.getElementById('btn-add-sale-item');
  // We'll render select+qty rows inside salesItemsContainer
  const salesLog = document.getElementById('sales-log');
  const announceText = document.getElementById('announce-text');
  const announceType = document.getElementById('announce-type');
  const btnPostAnnouncement = document.getElementById('btn-post-announcement');
  const announcementsList = document.getElementById('announcements-list');

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
  const btnSaveTimes = document.getElementById('btn-save-times');
  const openTimeInput = document.getElementById('open-time');
  const closeTimeInput = document.getElementById('close-time');
  const lunchStartInput = document.getElementById('lunch-start');
  const lunchEndInput = document.getElementById('lunch-end');
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
    const members = Number(custMembersInput && custMembersInput.value) || 1;
    if(!rc || !/^\d{10}$/.test(mobile)){ alert('Please enter ration card and valid 10 digit mobile number.'); return }
    if(!pass || pass.length < 4){ alert('Password min 4 chars'); return }
    if(users.customers.find(c=>c.rc===rc)){ alert('Ration card already registered. Please login.'); return }
    users.customers.push({rc,mobile,pass, name: cname, members}); saveUsers();
    alert('Customer account created — now login to request token');
    rcInput.value=''; mobileInput.value=''; custPass.value=''; 
    if (custMembersInput) custMembersInput.value='';
  })

  function calculateNextTokenTime() {
    let baseTime = new Date();
    const uncalled = state.queue.filter(q=>!q.called);
    if (uncalled.length > 0) {
      const lastPickup = new Date(uncalled[uncalled.length-1].pickupAt);
      if (lastPickup > baseTime) {
        baseTime = lastPickup;
      }
    }
    
    // Add 5 minutes per person
    let pickupAt = new Date(baseTime.getTime() + 5 * 60000);
    
    let pMin = pickupAt.getHours() * 60 + pickupAt.getMinutes();
    
    const morningStart = 8 * 60;
    const morningEnd = 11 * 60;
    const eveningStart = 17 * 60;
    const eveningEnd = 20 * 60;
    
    // If before 8 AM, move to 8 AM
    if (pMin < morningStart) {
      pickupAt.setHours(8, 0, 0, 0);
    } 
    // If between 11 AM and 5 PM, move to 5 PM
    else if (pMin >= morningEnd && pMin < eveningStart) {
      pickupAt.setHours(17, 0, 0, 0);
    } 
    // If after 8 PM, move to 8 AM next day
    else if (pMin >= eveningEnd) {
      pickupAt.setDate(pickupAt.getDate() + 1);
      pickupAt.setHours(8, 0, 0, 0);
    }
    
    return pickupAt;
  }

  function isCurrentTimeInShopHours() {
    const now = new Date();
    const pMin = now.getHours() * 60 + now.getMinutes();
    
    // 8 AM to 11 AM
    const morningStart = 8 * 60;
    const morningEnd = 11 * 60;
    
    // 5 PM to 8 PM (17:00 to 20:00)
    const eveningStart = 17 * 60;
    const eveningEnd = 20 * 60;
    
    const isMorning = pMin >= morningStart && pMin <= morningEnd;
    const isEvening = pMin >= eveningStart && pMin <= eveningEnd;
    
    return isMorning || isEvening;
  }

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

    if(!isCurrentTimeInShopHours()) {
      alert('Tokens can only be requested between 8 AM to 11 AM and 5 PM to 8 PM.');
      return;
    }

    const token = state.nextToken++;
    const pickupAt = calculateNextTokenTime();
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
      const name = document.createElement('div'); name.style.minWidth='160px';
      // show bag-size labels in the inventory edit module per user request
      const displayName = (item.id === 'rice') ? '🌾 Rice (80 kg bags)'
                        : (item.id === 'wheat') ? '🍞 Wheat (50 kg bags)'
                        : (item.id === 'sugar') ? '🧂 Sugar (30 kg bags)'
                        : item.name;
      name.textContent = displayName;
      const input = document.createElement('input'); input.type='number'; input.step='0.001'; input.value = Number(item.stock.toFixed(3)); input.min=0; input.dataset.itemId = item.id; input.style.width='80px';
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
  // Sales cart helpers
  function salesDisplayName(item){
    if(!item) return '';
    const nameOnly = item.id === 'rice' ? '🌾 Rice' : item.id === 'wheat' ? '🍞 Wheat' : item.id === 'sugar' ? '🧂 Sugar' : item.name;
    return `${nameOnly} (kg)`;
  }
  function createSaleRow(itemId, qty){
    const row = document.createElement('div'); row.className='sale-row form-row';
    const select = document.createElement('select'); select.className='sale-item-select';
    state.inventory.forEach(it=>{ 
      const opt = document.createElement('option'); opt.value = it.id; 
      const nameOnly = it.id === 'rice' ? '🌾 Rice' : it.id === 'wheat' ? '🍞 Wheat' : it.id === 'sugar' ? '🧂 Sugar' : it.name;
      opt.textContent = `${nameOnly} (Enter KGs)`; 
      if(it.id===itemId) opt.selected=true; select.appendChild(opt); 
    })
    const inputQty = document.createElement('input'); inputQty.type='number'; inputQty.step='any'; inputQty.min=0.1; inputQty.value = qty||1; inputQty.className='sale-item-qty'; inputQty.style.width='80px';
    const btnRem = document.createElement('button'); btnRem.textContent='Remove'; btnRem.type='button'; btnRem.addEventListener('click', ()=>{ row.remove(); });
    row.appendChild(select); row.appendChild(inputQty); row.appendChild(btnRem);
    return row;
  }

  btnAddSaleItem && btnAddSaleItem.addEventListener('click', ()=>{ const r = createSaleRow(); salesItemsContainer.appendChild(r); })

  btnAutoEntitlement && btnAutoEntitlement.addEventListener('click', ()=>{
    const rc = (sellRC.value||'').trim();
    if (!rc) { alert('Enter ration card to calculate entitlement'); return }
    const customer = users.customers.find(c=>c.rc===rc);
    if (!customer) { alert('Customer not found or not registered.'); return }
    
    const members = customer.members || 1;
    salesItemsContainer.innerHTML = '';
    
    // Auto-fill: Rice (6kg/member), Wheat (5kg/member), Sugar (1kg/member)
    const entitlements = [
      { id: 'rice', qty: members * 6 },
      { id: 'wheat', qty: members * 5 },
      { id: 'sugar', qty: members * 1 }
    ];
    
    entitlements.forEach(ent => {
      const it = state.inventory.find(i => i.id === ent.id);
      if (it) {
        const row = createSaleRow(ent.id, ent.qty);
        salesItemsContainer.appendChild(row);
      }
    });
  })

  // keep sale-item selects in sync with inventory stock numbers
  function refreshSaleSelectOptions(){
    const selects = document.querySelectorAll('.sale-item-select');
    selects.forEach(sel=>{
      const current = sel.value;
      sel.innerHTML = '';
      state.inventory.forEach(it=>{ 
        const opt = document.createElement('option'); opt.value = it.id; 
        const nameOnly = it.id === 'rice' ? '🌾 Rice' : it.id === 'wheat' ? '🍞 Wheat' : it.id === 'sugar' ? '🧂 Sugar' : it.name;
        opt.textContent = `${nameOnly} (Enter KGs)`;
        if(it.id === current) opt.selected = true;
        sel.appendChild(opt);
      })
    })
  }

  // Record sale: gather rows, validate, update inventory and sales array
  btnSell.addEventListener('click', ()=>{
    const rc = (sellRC.value||'').trim();
    if(!rc){ alert('Enter ration card for sale'); return }
    if(!state.currentShop){ alert('Shopkeeper must be logged in to record sales'); return }
    const rows = salesItemsContainer.querySelectorAll('.sale-row');
    const saleItems = [];
    
    if(rows.length===0){
      // Auto-record entitlement if cart is empty
      const customer = users.customers.find(c=>c.rc===rc);
      if(!customer) { alert('Customer not found. Please add items manually or register the customer.'); return }
      
      const members = customer.members || 1;
      const entitlements = [
        { id: 'rice', qty: members * 6 },
        { id: 'wheat', qty: members * 5 },
        { id: 'sugar', qty: members * 1 }
      ];
      
      for (const ent of entitlements) {
        const it = state.inventory.find(i=>i.id===ent.id);
        if(!it) continue;
        const kgPerBag = getKgPerBag(ent.id);
        if(it.stock * kgPerBag < ent.qty) {
          alert(`Not enough stock for ${it.name}. Available ${formatStock(it)}`);
          return;
        }
        saleItems.push({ itemId: ent.id, qty: ent.qty, name: salesDisplayName(it) });
      }
    } else {
      for(const row of rows){
        const sel = row.querySelector('.sale-item-select');
        const qin = row.querySelector('.sale-item-qty');
        if(!sel || !qin) continue;
        const id = sel.value; const qty = Number(qin.value) || 0;
        if(qty<=0){ alert('Quantity must be > 0'); return }
        const it = state.inventory.find(i=>i.id===id);
        if(!it){ alert('Invalid item selected'); return }
        
        const kgPerBag = getKgPerBag(id);
        const availableKgs = it.stock * kgPerBag;
        if(availableKgs < qty){ alert(`Not enough stock for ${it.name}. Available ${formatStock(it)}`); return }
        // record sale item with sales-specific display name (e.g. Rice (kg))
        saleItems.push({ itemId:id, qty, name: salesDisplayName(it) });
      }
    }

    // Everything validated — apply changes
    saleItems.forEach(si=>{ 
      const it = state.inventory.find(i=>i.id===si.itemId); 
      if(it) {
        const kgPerBag = getKgPerBag(si.itemId);
        it.stock -= (si.qty / kgPerBag); 
      }
    })
    // include customer name if available
    const customer = users.customers.find(c=>c.rc===rc);
    const saleRecord = { id: state.sales.length+1, rc, customerName: customer ? customer.name : null, items: saleItems, at: Date.now(), shop: state.currentShop };
    state.sales.push(saleRecord);
    // clear sales items UI
    salesItemsContainer.innerHTML=''; sellRC.value='';
    save();
    alert('Sale recorded');
  })

  // queue functions
  function renderQueue(){ queueList.innerHTML=''; state.queue.forEach(q=>{ const li = document.createElement('li'); li.textContent = `${formatToken(q.token)} — RC:${q.rc} — ${q.called? 'CALLED':'Waiting'} — ETA ${formatTime(new Date(q.pickupAt))}`; queueList.appendChild(li); }) }
  btnNext.addEventListener('click', ()=>{ const next = state.queue.find(q=>!q.called); if(!next){ alert('Queue empty'); return } next.called = true; next.calledAt = Date.now(); save(); alert(`Calling ${formatToken(next.token)} — RC:${next.rc}`); })
  btnReset.addEventListener('click', ()=>{ if(!confirm('Reset queue and tokens?')) return; state.queue=[]; state.nextToken=1; save(); })

  // inventory and sales
  function renderInventory(){ inventoryList.innerHTML=''; state.inventory.forEach(item=>{ const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.padding='6px 0'; const display = bagDisplayName(item); row.innerHTML = `<div>${display}</div><div><strong>${formatStock(item)}</strong></div>`; inventoryList.appendChild(row); }) }

  

  function renderSales(){
    salesLog.innerHTML='';
    state.sales.slice().reverse().forEach(s=>{
      const li = document.createElement('li');
      const header = document.createElement('div'); header.textContent = `${new Date(s.at).toLocaleString()} — RC:${s.rc}` + (s.customerName? ` — ${s.customerName}` : '');
      li.appendChild(header);
      const ul = document.createElement('ul'); ul.style.margin='6px 0 0 14px'; ul.style.padding='0';
      (s.items||[]).forEach(itm=>{ const itemLi = document.createElement('li'); itemLi.textContent = `${itm.name} x ${itm.qty}`; ul.appendChild(itemLi); })
      li.appendChild(ul);
      salesLog.appendChild(li);
    })
  }

  // Announcements
  function renderAnnouncements(){
    if(!announcementsList) return;
    announcementsList.innerHTML = '';
    state.announcements.slice().reverse().forEach(a=>{
      const div = document.createElement('div'); div.className='announce'; div.style.padding='6px 0';
      const h = document.createElement('div'); h.textContent = `[${new Date(a.at).toLocaleString()}] ${a.type.toUpperCase()}`;
      const p = document.createElement('div'); p.textContent = a.text;
      div.appendChild(h); div.appendChild(p);
      announcementsList.appendChild(div);
    })
  }

  btnPostAnnouncement && btnPostAnnouncement.addEventListener('click', ()=>{
    if(!state.currentShop){ alert('Only logged-in shopkeepers can post announcements'); return }
    const text = (announceText.value||'').trim(); const type = (announceType.value||'info');
    if(!text){ alert('Enter announcement text'); return }
    state.announcements.push({ text, type, shop: state.currentShop, at: Date.now() }); save(); announceText.value='';
    alert('Announcement posted');
  })

  // Public render for announcements (a simple copy of admin list)
  function renderPublicAnnouncements(){
    const container = document.getElementById('announcements-list'); if(!container) return; container.innerHTML='';
    state.announcements.slice().reverse().forEach(a=>{
      const el = document.createElement('div'); el.className='announce-public'; el.style.padding='6px 0';
      const head = document.createElement('div'); head.textContent = `${new Date(a.at).toLocaleString()} — ${a.type.toUpperCase()}`;
      const body = document.createElement('div'); body.textContent = a.text;
      el.appendChild(head); el.appendChild(body);
      container.appendChild(el);
    })
  }

  // public dashboard
  function renderPublic(){
    stockStatus.innerHTML = '<h4>Stock Availability</h4>';
    const list = document.createElement('div');
    let urgentItems = [];
    state.inventory.forEach(i=>{
      const p = document.createElement('div');
      const display = bagDisplayName(i);
      p.textContent = `${display}: ${formatStock(i)}`;
      list.appendChild(p);
      const th = stockThresholds[i.id];
      if(th){
        if(i.stock <= th.urgent){
          urgentItems.push({id:i.id, name:display, stock:i.stock});
        } else if(i.stock <= th.low){
          const note = document.createElement('small'); note.style.color='crimson'; note.textContent = ' — Low stock — please restock soon'; p.appendChild(note);
        }
      }
    });
    stockStatus.appendChild(list);
    // If any urgent items exist, show a prominent banner
    const existingBanner = document.getElementById('urgent-stock-banner');
    if(existingBanner) existingBanner.remove();
    if(urgentItems.length > 0){
      const banner = document.createElement('div'); banner.id = 'urgent-stock-banner'; banner.style.background = '#ffdddd'; banner.style.padding = '10px'; banner.style.marginTop='8px'; banner.style.border = '1px solid #ffaaaa'; banner.style.color = '#a00';
      const names = urgentItems.map(it=>`${it.name}: ${formatStock(it)}`).join(' — ');
      banner.textContent = `HURRY UP — stock will be completed soon: ${names}`;
      stockStatus.appendChild(banner);
    }
    // render schedules for all shops (publicly visible)
    const scheduleArea = document.createElement('div'); scheduleArea.style.marginTop='8px';
    const shHeader = document.createElement('h4'); shHeader.textContent = 'Shop Timings'; scheduleArea.appendChild(shHeader);
    users.shops.forEach(s=>{
      const line = document.createElement('div');
      const sched = s.schedule || {};
      line.textContent = `${s.name || s.shopId}: Open ${sched.open || '-'} — Close ${sched.close || '-'}; Lunch ${sched.lunchStart || '-'} to ${sched.lunchEnd || '-'}`;
      scheduleArea.appendChild(line);
    })
    stockStatus.appendChild(scheduleArea);
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
    if(custStockList){ custStockList.innerHTML = ''; state.inventory.forEach(i=>{ const d = document.createElement('div'); d.textContent = `${bagDisplayName(i)}: ${formatStock(i)}`; custStockList.appendChild(d); }) }
  }

  // When customer logs in, hide register/login buttons and show logout
  function onCustomerLoggedIn(){
    if(custAuthControls) custAuthControls.querySelectorAll('button').forEach(b=>b.classList.add('hidden'));
    if(btnCustLogout) btnCustLogout.classList.remove('hidden');
  }

  // Save time slots for current shop
  btnSaveTimes && btnSaveTimes.addEventListener('click', ()=>{
    if(!state.currentShop){ alert('Shopkeeper not logged in'); return }
    const shop = users.shops.find(s=>s.shopId===state.currentShop);
    if(!shop) return;
    shop.schedule = shop.schedule || {};
    shop.schedule.open = openTimeInput.value || null;
    shop.schedule.close = closeTimeInput.value || null;
    shop.schedule.lunchStart = lunchStartInput.value || null;
    shop.schedule.lunchEnd = lunchEndInput.value || null;
    saveUsers(); save(); alert('Shop timings saved');
  })

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
  // ensure announcements are rendered along with other UI pieces
  const _origRenderAll = renderAll;
  function renderAll(){ renderQueue(); renderInventory(); renderSales(); renderPublic(); renderStockTimestamp(); renderCustomerDashboard(); renderInventoryEdit(); renderAnnouncements(); renderPublicAnnouncements(); }

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
