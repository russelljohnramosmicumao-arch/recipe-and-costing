(() => {
  const STORAGE_KEY = 'kbr-costing-data-v9';
  const LEGACY_STORAGE_KEY = 'kbr-costing-data-v8';
  const LEGACY_STORAGE_KEY_V1 = 'kbr-costing-data-v7';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const money = n => Number.isFinite(n) ? `₱${n.toFixed(2)}` : '—';
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const sizeLabels = {'12':'12 oz','16':'16 oz','22':'22 oz'};
  const recipeUnits = ['ml','grams','pc','pump','tbsp','tsp','cup','scoop','spoon','sachet','shot'];
  const unitAliases = {g:'grams',gram:'grams',grams:'grams',ml:'ml',milliliter:'ml',milliliters:'ml',pcs:'pc',piece:'pc',pieces:'pc',pc:'pc'};

  let state = loadState();
  let selectedRecipeId = state.recipes[0]?.id || null;
  let activeRecipeSize = '12';
  let ingredientFilter = '';
  let recipeFilter = '';
  let recipeCategory = '';
  let costFilter = '';
  let costCategory = '';
  let editingIngredientOriginalName = null;

  function pruneUnusedIngredients(data){
    const used = new Set();
    (data.recipes||[]).forEach(r => Object.values(r.sizes||{}).forEach(lines => (lines||[]).forEach(row => {
      if (row.ingredient) used.add(row.ingredient);
    })));
    data.ingredients = (data.ingredients||[]).filter(i => used.has(i.name));
    return data;
  }
  const PACKAGING_SEED = [
    {id:'pkg-12oz-cup',name:'12 oz with logo',price:2810,purchaseQty:1000,unit:'pc'},
    {id:'pkg-16oz-cup',name:'16 oz with logo',price:2390,purchaseQty:1000,unit:'pc'},
    {id:'pkg-22oz-cup',name:'22 oz with logo',price:2080,purchaseQty:1000,unit:'pc'},
    {id:'pkg-flat-lid',name:'Flat lids',price:760,purchaseQty:1000,unit:'pc'},
    {id:'pkg-dome-lid',name:'Dome lids',price:920,purchaseQty:1000,unit:'pc'},
    {id:'pkg-thin-straw',name:'Thin straws',price:450,purchaseQty:1000,unit:'pc'},
    {id:'pkg-boba-straw',name:'Bobba Straws',price:679,purchaseQty:1000,unit:'pc'},
    {id:'pkg-single-bag',name:'Single Bags',price:730,purchaseQty:1000,unit:'pc'},
    {id:'pkg-parchment',name:'Parchment Paper',price:70,purchaseQty:100,unit:'pc'}
  ];
  function migrateV9(data){
    data = data || {ingredients:[],recipes:[]};
    data.ingredients ||= []; data.recipes ||= [];
    // Fresh milk is no longer used. Convert any old generic/fresh-milk recipe references to Milk (Made).
    const freshMilkNames=new Set(['milk','fresh milk','fresh milks']);
    data.recipes.forEach(r=>Object.values(r.sizes||{}).forEach(lines=>(lines||[]).forEach(row=>{
      if(freshMilkNames.has((row.ingredient||'').trim().toLowerCase())) row.ingredient='Milk (Made)';
    })));
    data.ingredients=data.ingredients.filter(i=>!freshMilkNames.has((i.name||'').trim().toLowerCase()));
    const removed = new Set(['strawless lids','Double Bags']);
    data.ingredients = data.ingredients.filter(i=>!removed.has(i.name));
    const byName = new Map(data.ingredients.map(i=>[i.name,i]));
    PACKAGING_SEED.forEach(p=>{
      if(!byName.has(p.name)){
        const item={...p,conversions:{},priceHistory:[],source:'Packaging sheet'};
        data.ingredients.push(item); byName.set(item.name,item);
      }
    });
    const chuckie=byName.get('Chuckie');
    if(chuckie){ chuckie.unit='ml'; chuckie.conversions={}; chuckie.source='Ingredients.xlsx + shop clarification (110 ml small / 180 ml big)'; }
    const dutch=byName.get('Dutch Mill');
    if(dutch){ dutch.unit='ml'; dutch.conversions={}; dutch.source='Ingredients.xlsx + shop clarification (110 ml small / 180 ml big)'; }
    // Shop-standard conversions supplied by owner
    const powderNames=['Taro Milk Tea','Cookies and Cream','Black Forest Choco','Wintermelon','White Bunny','Matcha Powder','Matcha Ceremonial Powder','Avocado Powder'];
    powderNames.forEach(name=>{ const i=byName.get(name); if(i){ i.conversions ||= {}; i.conversions.tbsp=13; }});
    const mango=byName.get('Mango Jam'); if(mango){ mango.unit='grams'; mango.conversions ||= {}; mango.conversions.scoop=40; mango.source=(mango.source||'')+' + shop clarification (1 scoop = 40 g)'; }
    const instant=byName.get('Instant Coffee'); if(instant){ instant.unit='grams'; instant.conversions ||= {}; instant.conversions.sachet=5; instant.source=(instant.source||'')+' + shop clarification (1 sachet = 5 g)'; }
    const beans=byName.get('Coffee Ground') || byName.get('Coffee Beans') || byName.get('Coffee beans');
    if(beans){ beans.unit='grams'; beans.conversions ||= {}; beans.conversions.shot=18; beans.source=(beans.source||'')+' + shop clarification (1 espresso shot = 18 g coffee)'; }
    const espresso=byName.get('Espresso Shot');
    if(espresso){ espresso.unit='grams'; espresso.purchaseQty=espresso.purchaseQty||18; espresso.conversions ||= {}; espresso.conversions.shot=18; espresso.source=(espresso.source||'')+' + shop clarification (1 shot = 18 g coffee)'; }
    const addLine=(lines,name,note='')=>{ if(!lines.some(x=>x.ingredient===name)) lines.push({ingredient:name,qty:1,unit:'pc',optional:false,note}); };
    data.recipes.forEach(r=>{
      ['12','16','22'].forEach(size=>{
        const lines=r.sizes?.[size]||[]; if(!lines.length) return;
        r.sizes[size]=lines.filter(x=>!removed.has(x.ingredient));
        const target=r.sizes[size];
        addLine(target,`${size} oz with logo`,'Packaging');
        addLine(target,r.category==='FRAPPE AND SMOOTHIES'?'Dome lids':'Flat lids','Packaging');
        addLine(target,['MILK TEA (SINGLE FLAVOUR)','MILK TEA FUSION'].includes(r.category)?'Bobba Straws':'Thin straws','Packaging');
        addLine(target,'Single Bags','1 bag allocated per order; if several drinks share one bag, adjust order-level costing.');
        if(!['FLOATS','FRAPPE AND SMOOTHIES'].includes(r.category)) addLine(target,'Parchment Paper','Packaging used by current preparation standard');
      });
      if(r.name==='Chuckie Float'){
        r.notes='Chuckie standardized to 110 ml small and 180 ml big; 22 oz uses one small + one big (290 ml). Choco syrup quantity is still unspecified in the source.';
        r.needsReview=true;
      }
      if(r.name==='Dutchmill Float'){
        const amounts={'12':110,'16':180,'22':290};
        Object.entries(amounts).forEach(([size,qty])=>{
          const row=(r.sizes?.[size]||[]).find(x=>x.ingredient==='Dutch Mill');
          if(row){ row.qty=qty; row.unit='ml'; }
        });
        r.notes='Dutch Mill standardized to 110 ml small and 180 ml big; 22 oz uses one small + one big (290 ml). Strawberry syrup quantity is still unspecified in the source.';
        r.needsReview=true;
      }
    });
    // Shop-standard minimum fill amounts by cup size.
    // Main drinks use the higher of the menu quantity or the shop minimum.
    // Chuckie/Dutch Mill keep their actual pack volume; Milk (Made) tops them up to the minimum.
    const iceBySize={'12':200,'16':250,'22':330};
    const liquidBySize={'12':150,'16':200,'22':300};
    const baseLiquids=new Set(['milk (made)','sprite','coke','water']);
    const packAmounts={
      'chuckie':{'12':110,'16':180,'22':290},
      'dutch mill':{'12':110,'16':180,'22':290},
      'dutchmill':{'12':110,'16':180,'22':290}
    };

    data.recipes.forEach(r=>{
      ['12','16','22'].forEach(size=>{
        const lines=r.sizes?.[size]||[];

        // Ice minimum.
        lines.forEach(row=>{
          const n=(row.ingredient||'').trim().toLowerCase();
          if(n.includes('ice tube') || n==='ice' || n.includes('ice cubes')){
            const current=(row.unit==='grams' || row.unit==='g' || row.unit==='ml') ? Number(row.qty)||0 : 0;
            row.qty=Math.max(current, iceBySize[size]);
            row.unit='grams';
            row.note='Uses the higher of menu quantity or shop minimum ice fill';
          }
        });

        // Special packaged drinks: preserve pack volume and add Milk (Made) only for the shortfall.
        let specialRow=null;
        for(const row of lines){
          const n=(row.ingredient||'').trim().toLowerCase();
          if(packAmounts[n]){ specialRow=row; break; }
        }
        if(specialRow){
          const n=(specialRow.ingredient||'').trim().toLowerCase();
          const packQty=packAmounts[n][size];
          specialRow.qty=packQty;
          specialRow.unit='ml';
          specialRow.note='Actual packaged drink volume; Milk (Made) tops up to cup-size liquid minimum';

          const topup=Math.max(0, liquidBySize[size]-packQty);
          let milkRow=lines.find(row=>(row.ingredient||'').trim().toLowerCase()==='milk (made)');
          if(topup>0){
            if(!milkRow){
              milkRow={ingredient:'Milk (Made)',qty:topup,unit:'ml',optional:false,note:'Top-up for Chuckie/Dutch Mill to reach shop liquid minimum'};
              // Put the top-up immediately after the packaged drink.
              const idx=lines.indexOf(specialRow);
              lines.splice(idx+1,0,milkRow);
            } else {
              milkRow.qty=topup;
              milkRow.unit='ml';
              milkRow.note='Top-up for Chuckie/Dutch Mill to reach shop liquid minimum';
            }
          } else if(milkRow && /top-up for chuckie\/dutch mill/i.test(milkRow.note||'')){
            lines.splice(lines.indexOf(milkRow),1);
          }
        } else {
          // Other main/base liquids use the higher of source amount or shop minimum.
          lines.forEach(row=>{
            const n=(row.ingredient||'').trim().toLowerCase();
            if(baseLiquids.has(n)){
              const current=row.unit==='ml' ? Number(row.qty)||0 : 0;
              row.qty=Math.max(current, liquidBySize[size]);
              row.unit='ml';
              row.note='Uses the higher of menu quantity or shop minimum liquid fill';
            }
          });
        }
      });
    });
    // Current menu selling prices imported from Kape-Bar-Rio-Drink-Prices-and-Variants.csv.
    // Preserve any price the user already edited; fill only blank/null prices during migration.
    const currentMenuPrices={"Fruit Soda": {"12": 39.0, "16": 49.0, "22": 69.0}, "Coke Float": {"12": 49.0, "16": 59.0, "22": 69.0}, "Chuckie Float": {"12": 69.0, "16": 79.0, "22": 89.0}, "Dutchmill Float": {"12": 69.0, "16": 79.0, "22": 89.0}, "Classic Taro": {"12": 49.0, "16": 59.0, "22": 79.0}, "Okinawa": {"12": 59.0, "16": 69.0, "22": 89.0}, "Cookies and Cream Milk Tea": {"12": 59.0, "16": 69.0, "22": 89.0}, "Black Forest Choco": {"12": 59.0, "16": 69.0, "22": 89.0}, "Wintermelon": {"12": 59.0, "16": 69.0, "22": 89.0}, "White Bunny": {"12": 49.0, "16": 59.0, "22": 79.0}, "Matcha Milktea": {"12": 59.0, "16": 69.0, "22": 89.0}, "Strawberry Milk Tea (Syrup)": {"12": 49.0, "16": 59.0, "22": 79.0}, "Blueberry Milk Tea (Syrup)": {"12": 49.0, "16": 59.0, "22": 79.0}, "Brown Sugar Milk Tea (Syrup)": {"12": 49.0, "16": 59.0, "22": 79.0}, "Red Matcha Milk Tea (Strawberry Matcha)": {"12": 69.0, "16": 79.0, "22": 99.0}, "Green Taro Milk Tea (Matcha Taro)": {"12": 69.0, "16": 79.0, "22": 99.0}, "Dirty Taro Milk Tea (Mocha Taro)": {"12": 69.0, "16": 79.0, "22": 99.0}, "Blue-ish Red Milk Tea (Blueberry & Strawberry)": {"12": 69.0, "16": 79.0, "22": 99.0}, "Americano - Budget": {"12": null, "16": 89.0, "22": 109.0}, "Cappuccino - Budget": {"12": null, "16": 99.0, "22": 119.0}, "Vanilla Latte - Budget": {"12": 59.0, "16": 69.0, "22": 89.0}, "Caramel Latte - Budget": {"12": 69.0, "16": 79.0, "22": 99.0}, "Spanish Latte - Budget": {"12": 69.0, "16": 79.0, "22": 99.0}, "Iced Mocha Latte - Budget": {"12": 69.0, "16": 79.0, "22": 99.0}, "Caramel Macchiato Latte - Budget": {"12": 69.0, "16": 79.0, "22": 99.0}, "Vanilla Latte - Premium": {"12": null, "16": 109.0, "22": 129.0}, "Caramel Latte - Premium": {"12": null, "16": 109.0, "22": 129.0}, "Spanish Latte - Premium": {"12": null, "16": 119.0, "22": 139.0}, "Iced Mocha Latte - Premium": {"12": null, "16": 109.0, "22": 129.0}, "Caramel Macchiato Latte - Premium": {"12": null, "16": 119.0, "22": 139.0}, "Frappuccino": {"12": null, "16": 99.0, "22": 119.0}, "Frapmacchiato": {"12": null, "16": 99.0, "22": 119.0}, "Frappe' de Ube (Taro)": {"12": null, "16": 99.0, "22": 119.0}, "Frappe' de Choco": {"12": null, "16": 99.0, "22": 119.0}, "Mekus de Beries": {"12": null, "16": 99.0, "22": 119.0}, "Familia de Verde": {"12": null, "16": 109.0, "22": 129.0}, "Matcha Frappe": {"12": null, "16": 109.0, "22": 129.0}, "Mango Smoothie": {"12": null, "16": 109.0, "22": 129.0}};
    data.recipes.forEach(r=>{
      r.sellingPrices ||= {'12':null,'16':null,'22':null};
      const src=currentMenuPrices[r.name];
      if(src) ['12','16','22'].forEach(s=>{
        if((r.sellingPrices[s]===null || r.sellingPrices[s]==='' || r.sellingPrices[s]===undefined) && src[s]!=null) r.sellingPrices[s]=src[s];
      });
    });
    return data;
  }
  function loadState(){
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return migrateV9(JSON.parse(saved));
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy){
        const migrated = migrateV9(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
      if (legacyV1){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV1)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyOld = localStorage.getItem('kbr-costing-data-v1');
      if (legacyOld){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyOld)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV2 = localStorage.getItem('kbr-costing-data-v2');
      if (legacyV2){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV2)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV3 = localStorage.getItem('kbr-costing-data-v3');
      if (legacyV3){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV3)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV4 = localStorage.getItem('kbr-costing-data-v4');
      if (legacyV4){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV4)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV5 = localStorage.getItem('kbr-costing-data-v5');
      if (legacyV5){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV5)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV6 = localStorage.getItem('kbr-costing-data-v6');
      if (legacyV6){
        const migrated = migrateV9(pruneUnusedIngredients(JSON.parse(legacyV6)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch(e){ console.warn(e); }
    return migrateV9(clone(window.KBR_SEED));
  }
  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const el = $('#saveStatus');
    if (el){ el.textContent='Saved locally'; el.classList.add('success'); setTimeout(()=>el.classList.remove('success'),800); }
  }

  function normUnit(u){ return unitAliases[String(u||'').trim().toLowerCase()] || String(u||'').trim().toLowerCase(); }
  function findIngredient(name){ return state.ingredients.find(i => i.name === name); }
  function baseCost(ing){
    if (!ing || !Number(ing.purchaseQty)) return null;
    return Number(ing.price) / Number(ing.purchaseQty);
  }
  function lineCost(row){
    const ing = findIngredient(row.ingredient);
    if (!ing) return {cost:null, error:'Ingredient missing'};
    const q = Number(row.qty);
    if (!Number.isFinite(q)) return {cost:null,error:'Invalid quantity'};
    if (q === 0) return {cost:0,error:row.note || 'Quantity not set'};
    const b = baseCost(ing);
    if (!Number.isFinite(b)) return {cost:null,error:'Missing purchase quantity'};
    const recipeUnit = normUnit(row.unit);
    const baseUnit = normUnit(ing.unit);
    if (recipeUnit === baseUnit) return {cost:q*b,error:null};
    const conv = Number((ing.conversions||{})[recipeUnit]);
    if (Number.isFinite(conv) && conv > 0) return {cost:q*conv*b,error:null};
    return {cost:null,error:`Set ${recipeUnit} → ${baseUnit} conversion`};
  }
  function sizeCost(recipe,size){
    const lines = recipe.sizes?.[size] || [];
    let total = 0, unresolved = 0;
    for (const r of lines){
      const c = lineCost(r);
      if (c.cost == null) unresolved++; else total += c.cost;
    }
    return {total, unresolved};
  }

  function setOnlineStatus(){
    const el=$('#offlineStatus');
    if (!el) return;
    if (navigator.onLine){ el.textContent='Offline capable'; el.className='status-pill success'; }
    else { el.textContent='Working offline'; el.className='status-pill success'; }
  }

  function initTabs(){
    $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
      $$('.tab').forEach(b=>b.classList.toggle('active',b===btn));
      $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===btn.dataset.tab));
      if(btn.dataset.tab==='costing') renderCosting();
      if(btn.dataset.tab==='data') renderReviewList();
    }));
  }

  function renderIngredients(){
    const list=state.ingredients.filter(i=>i.name.toLowerCase().includes(ingredientFilter.toLowerCase()));
    const unresolvedConversions = countUnresolvedLines();
    $('#ingredientSummary').innerHTML = `
      <div class="stat"><div class="value">${state.ingredients.length}</div><div class="label">Ingredients</div></div>
      <div class="stat"><div class="value">${state.recipes.length}</div><div class="label">Recipes</div></div>
      <div class="stat"><div class="value">${unresolvedConversions}</div><div class="label">Recipe lines needing conversion</div></div>
      <div class="stat"><div class="value">${state.recipes.filter(r=>r.needsReview).length}</div><div class="label">Imported recipes flagged for review</div></div>`;
    $('#ingredientRows').innerHTML=list.map(ing=>{
      const convs=Object.entries(ing.conversions||{}).map(([u,v])=>`${u}=${v} ${ing.unit}`).join(', ');
      return `<tr>
        <td><strong>${escapeHtml(ing.name)}</strong><div class="subtle">${escapeHtml(ing.source||'Manual')}</div></td>
        <td class="money">${money(Number(ing.price))}</td>
        <td>${fmt(Number(ing.purchaseQty))}</td>
        <td>${escapeHtml(ing.unit)}</td>
        <td class="money">${money(baseCost(ing))} / ${escapeHtml(ing.unit)}</td>
        <td>${convs ? `<span class="subtle">${escapeHtml(convs)}</span>` : '<span class="badge muted">none</span>'}</td>
        <td><div class="row-actions"><button class="btn small" data-edit-ing="${ing.id}">Edit</button><button class="danger-link" data-del-ing="${ing.id}">Delete</button></div></td>
      </tr>`;
    }).join('');
    $$('[data-edit-ing]').forEach(b=>b.onclick=()=>openIngredientDialog(b.dataset.editIng));
    $$('[data-del-ing]').forEach(b=>b.onclick=()=>deleteIngredient(b.dataset.delIng));
  }

  function countUnresolvedLines(){
    let n=0;
    for(const r of state.recipes) for(const s of ['12','16','22']) for(const l of (r.sizes?.[s]||[])) if(lineCost(l).cost==null) n++;
    return n;
  }

  function openIngredientDialog(id=null){
    const dlg=$('#ingredientDialog');
    const ing=id?state.ingredients.find(x=>x.id===id):null;
    editingIngredientOriginalName=ing?.name||null;
    $('#ingredientDialogTitle').textContent=ing?'Edit ingredient':'Add ingredient';
    $('#ingredientId').value=ing?.id||'';
    $('#ingredientName').value=ing?.name||'';
    $('#ingredientPrice').value=ing?.price??'';
    $('#ingredientQty').value=ing?.purchaseQty??'';
    const unit=ing?.unit||'ml';
    ensureOption($('#ingredientUnit'),unit);
    $('#ingredientUnit').value=unit;
    renderConversionRows(ing?.conversions||{});
    dlg.showModal();
  }
  function renderConversionRows(convs){
    const box=$('#conversionRows');
    box.innerHTML='';
    Object.entries(convs).forEach(([u,v])=>addConversionRow(u,v));
  }
  function addConversionRow(unit='',value=''){
    const row=document.createElement('div'); row.className='conversion-row';
    row.innerHTML=`<select class="conv-unit">${recipeUnits.map(u=>`<option ${u===unit?'selected':''}>${u}</option>`).join('')}</select><input class="conv-value" type="number" step="0.001" min="0" value="${value}" placeholder="base units per 1"/><button type="button" class="icon-btn">×</button>`;
    row.querySelector('button').onclick=()=>row.remove();
    $('#conversionRows').appendChild(row);
  }
  function saveIngredientFromDialog(e){
    e.preventDefault();
    const id=$('#ingredientId').value||uid('ing');
    const name=$('#ingredientName').value.trim();
    const price=Number($('#ingredientPrice').value);
    const purchaseQty=Number($('#ingredientQty').value);
    const unit=$('#ingredientUnit').value;
    if(!name||!Number.isFinite(price)||!Number.isFinite(purchaseQty)||purchaseQty<=0) return;
    const conv={};
    $$('.conversion-row',$('#conversionRows')).forEach(r=>{
      const u=$('.conv-unit',r).value; const v=Number($('.conv-value',r).value); if(v>0) conv[u]=v;
    });
    let ing=state.ingredients.find(x=>x.id===id);
    if(ing){
      if(Number(ing.price)!==price) (ing.priceHistory ||= []).push({price:Number(ing.price),changedAt:new Date().toISOString()});
      if(editingIngredientOriginalName && editingIngredientOriginalName!==name){
        state.recipes.forEach(r=>['12','16','22'].forEach(s=>(r.sizes?.[s]||[]).forEach(l=>{if(l.ingredient===editingIngredientOriginalName) l.ingredient=name;})));
      }
      Object.assign(ing,{name,price,purchaseQty,unit,conversions:conv,source:ing.source||'Manual'});
    } else {
      state.ingredients.push({id,name,price,purchaseQty,unit,conversions:conv,priceHistory:[],source:'Manual'});
    }
    saveState(); $('#ingredientDialog').close(); renderAll();
  }
  function deleteIngredient(id){
    const ing=state.ingredients.find(x=>x.id===id); if(!ing) return;
    const uses=state.recipes.reduce((n,r)=>n+['12','16','22'].reduce((m,s)=>m+(r.sizes?.[s]||[]).filter(l=>l.ingredient===ing.name).length,0),0);
    if(!confirm(`Delete ${ing.name}?${uses?` It is used in ${uses} recipe line(s), which will become unresolved.`:''}`)) return;
    state.ingredients=state.ingredients.filter(x=>x.id!==id); saveState(); renderAll();
  }

  function renderCategoryFilters(){
    const cats=[...new Set(state.recipes.map(r=>r.category).filter(Boolean))].sort();
    for(const sel of [$('#recipeCategoryFilter'),$('#costCategoryFilter')]){
      const current=sel.value;
      sel.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
      if(cats.includes(current)) sel.value=current;
    }
  }

  function renderRecipeList(){
    const list=state.recipes.filter(r=>(!recipeCategory||r.category===recipeCategory)&&r.name.toLowerCase().includes(recipeFilter.toLowerCase()));
    $('#recipeList').innerHTML=list.map(r=>`<div class="recipe-item ${r.id===selectedRecipeId?'active':''}" data-recipe-id="${r.id}"><div class="name">${escapeHtml(r.name)}</div><div class="meta"><span>${escapeHtml(r.category||'Uncategorized')}</span>${r.needsReview?'<span class="badge warn">review</span>':''}</div></div>`).join('');
    $$('.recipe-item').forEach(el=>el.onclick=()=>{selectedRecipeId=el.dataset.recipeId; activeRecipeSize='12'; renderRecipeList(); renderRecipeEditor();});
  }

  function renderRecipeEditor(){
    const host=$('#recipeEditor');
    const r=state.recipes.find(x=>x.id===selectedRecipeId);
    if(!r){host.innerHTML='<div class="empty-state">Select a recipe to edit.</div>';return;}
    const sc=sizeCost(r,activeRecipeSize);
    host.innerHTML=`
      <div class="editor-head">
        <div class="editor-title-grid"><input id="editRecipeName" value="${escapeAttr(r.name)}"/><input id="editRecipeCategory" value="${escapeAttr(r.category||'')}" placeholder="Category"/></div>
        <button class="danger-link" id="deleteRecipeBtn">Delete recipe</button>
      </div>
      <div class="size-tabs">${['12','16','22'].map(s=>`<button class="size-tab ${s===activeRecipeSize?'active':''}" data-size="${s}">${sizeLabels[s]}</button>`).join('')}</div>
      <div class="recipe-lines">
        <div class="line-row header"><div>Ingredient</div><div>Qty</div><div>Unit</div><div>Optional</div><div>Line cost</div><div></div></div>
        <div id="recipeLineRows"></div>
      </div>
      <div class="recipe-total"><span>Recipe cost</span><strong>${money(sc.total)}</strong>${sc.unresolved?`<span class="badge warn">${sc.unresolved} unresolved</span>`:'<span class="badge ok">complete</span>'}</div>
      <div class="editor-actions"><button id="addRecipeLineBtn" class="btn">+ Add ingredient</button><div class="selling-row"><label>Selling price</label><input id="sellingPrice" class="selling-input" type="number" min="0" step="0.01" value="${r.sellingPrices?.[activeRecipeSize]??''}" placeholder="₱"><span class="subtle" id="foodCostPct"></span><button id="saveRecipeBtn" class="btn primary">Save recipe</button></div></div>
      ${r.needsReview?`<div class="review-callout"><strong>Needs review.</strong> ${escapeHtml(r.notes||'Imported source has an inconsistency.')}</div>`:''}
      <div class="notes-box"><label class="subtle">Notes / source notes</label><textarea id="recipeNotes">${escapeHtml(r.notes||'')}</textarea></div>
    `;
    renderRecipeLines(r);
    updateFoodCostPct(r);
    $$('.size-tab',host).forEach(b=>b.onclick=()=>{activeRecipeSize=b.dataset.size; renderRecipeEditor();});
    $('#addRecipeLineBtn').onclick=()=>{r.sizes[activeRecipeSize].push({ingredient:state.ingredients[0]?.name||'',qty:0,unit:state.ingredients[0]?.unit||'ml',optional:false,note:''}); saveState(); renderRecipeEditor();};
    $('#saveRecipeBtn').onclick=()=>saveRecipeEditor(r);
    $('#sellingPrice').oninput=()=>{r.sellingPrices[activeRecipeSize]=$('#sellingPrice').value===''?null:Number($('#sellingPrice').value); saveState(); updateFoodCostPct(r);};
    $('#deleteRecipeBtn').onclick=()=>{if(confirm(`Delete ${r.name}?`)){state.recipes=state.recipes.filter(x=>x.id!==r.id); selectedRecipeId=state.recipes[0]?.id||null; saveState(); renderAll();}};
  }
  function renderRecipeLines(r){
    const box=$('#recipeLineRows'); const lines=r.sizes?.[activeRecipeSize]||[];
    box.innerHTML=lines.map((ln,idx)=>{
      const lc=lineCost(ln);
      return `<div class="line-row" data-line="${idx}">
        <select class="line-ingredient">${state.ingredients.map(i=>`<option ${i.name===ln.ingredient?'selected':''}>${escapeHtml(i.name)}</option>`).join('')}${findIngredient(ln.ingredient)?'':`<option selected>${escapeHtml(ln.ingredient)}</option>`}</select>
        <input class="line-qty" type="number" min="0" step="0.01" value="${ln.qty}">
        <select class="line-unit">${recipeUnits.map(u=>`<option ${normUnit(u)===normUnit(ln.unit)?'selected':''}>${u}</option>`).join('')}</select>
        <input class="line-optional" type="checkbox" ${ln.optional?'checked':''} title="Optional ingredient">
        <div class="line-cost">${lc.cost==null?`<span class="cost-error">${escapeHtml(lc.error)}</span>`:money(lc.cost)}</div>
        <button class="icon-btn line-delete" type="button">×</button>
      </div>`;
    }).join('');
    $$('.line-row[data-line]',box).forEach(row=>{
      const idx=Number(row.dataset.line); const ln=lines[idx];
      $('.line-ingredient',row).onchange=e=>{ln.ingredient=e.target.value; const ing=findIngredient(ln.ingredient); if(ing && !ln.unit) ln.unit=ing.unit; saveState(); renderRecipeEditor();};
      $('.line-qty',row).onchange=e=>{ln.qty=Number(e.target.value); saveState(); renderRecipeEditor();};
      $('.line-unit',row).onchange=e=>{ln.unit=e.target.value; saveState(); renderRecipeEditor();};
      $('.line-optional',row).onchange=e=>{ln.optional=e.target.checked; saveState();};
      $('.line-delete',row).onclick=()=>{lines.splice(idx,1); saveState(); renderRecipeEditor();};
    });
  }
  function updateFoodCostPct(r){
    const el=$('#foodCostPct'); if(!el) return;
    const sell=Number(r.sellingPrices?.[activeRecipeSize]); const sc=sizeCost(r,activeRecipeSize);
    el.textContent=(sell>0&&!sc.unresolved)?`${(sc.total/sell*100).toFixed(1)}% food cost`:'';
  }
  function saveRecipeEditor(r){
    r.name=$('#editRecipeName').value.trim()||'Untitled Recipe';
    r.category=$('#editRecipeCategory').value.trim();
    r.notes=$('#recipeNotes').value.trim();
    r.instructions ||= {'12':'','16':'','22':''};
    r.instructions[activeRecipeSize]=$('#recipeInstructions')?.value.trim()||'';
    const sp=$('#sellingPrice').value; r.sellingPrices[activeRecipeSize]=sp===''?null:Number(sp);
    saveState(); renderAll();
  }
  function addNewRecipe(){
    const r={id:uid('recipe'),name:'New Recipe',category:'',sizes:{'12':[],'16':[],'22':[]},sellingPrices:{'12':null,'16':null,'22':null},instructions:{'12':'','16':'','22':''},image:'',notes:'',needsReview:false,sourcePages:[]};
    state.recipes.unshift(r); selectedRecipeId=r.id; activeRecipeSize='12'; saveState(); renderAll();
  }

  function renderCosting(){
    renderCategoryFilters();
    const rows=state.recipes.filter(r=>(!costCategory||r.category===costCategory)&&r.name.toLowerCase().includes(costFilter.toLowerCase()));
    $('#costingRows').innerHTML=rows.map(r=>`<tr>
      <td><strong>${escapeHtml(r.name)}</strong>${r.sourcePages?.length?`<div class="subtle">PDF page${r.sourcePages.length>1?'s':''}: ${r.sourcePages.join(', ')}</div>`:''}</td>
      <td>${escapeHtml(r.category||'')}</td>
      ${['12','16','22'].map(s=>costCell(r,s)).join('')}
      <td>${r.needsReview?`<span class="badge warn">Needs review</span>`:'<span class="badge ok">Imported</span>'}</td>
    </tr>`).join('');
    $$('[data-edit-cost]').forEach(b=>b.onclick=()=>{selectedRecipeId=b.dataset.editCost; activeRecipeSize=b.dataset.size; switchToTab('recipes'); renderRecipeList(); renderRecipeEditor();});
  }
  function costCell(r,s){
    const c=sizeCost(r,s); const sell=Number(r.sellingPrices?.[s]);
    if(!(r.sizes?.[s]||[]).length) return `<td><div class="cost-box"><div class="big">—</div><div class="small">No recipe</div></div><button class="btn small" data-edit-cost="${r.id}" data-size="${s}">Edit</button></td>`;
    const diff=sell>0?sell-c.total:null;
    const pct=sell>0?(c.total/sell*100):null;
    const risk=diff!=null && diff<0;
    return `<td><div class="cost-box ${c.unresolved?'unresolved':''} ${risk?'loss':''}">
      <div class="big">${money(c.total)}</div>
      <div class="small">Costing price</div>
      <div class="price-compare">
        <div><span>Current</span><strong>${sell>0?money(sell):'—'}</strong></div>
        <div><span>Difference</span><strong class="${risk?'negative':'positive'}">${diff!=null?money(diff):'—'}</strong></div>
      </div>
      <div class="small">${c.unresolved?`${c.unresolved} unresolved · difference is provisional`:sell>0?`Food cost ${pct.toFixed(1)}%`:'Current price not entered'}</div>
    </div><button class="btn small" data-edit-cost="${r.id}" data-size="${s}">Edit</button></td>`;
  }

  function renderReviewList(){
    const flagged=state.recipes.filter(r=>r.needsReview);
    $('#reviewList').innerHTML=flagged.map(r=>`<div class="review-item"><strong>${escapeHtml(r.name)}</strong><div class="subtle">${escapeHtml(r.notes||'Review imported source.')}</div></div>`).join('') || '<span class="subtle">No flagged recipes.</span>';
  }

  function exportJSON(){
    downloadBlob(JSON.stringify(state,null,2),'kape-barrio-costing-backup.json','application/json');
  }
  function importJSON(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try { const parsed=JSON.parse(reader.result); if(!parsed.ingredients||!parsed.recipes) throw new Error('Invalid backup'); state=parsed; selectedRecipeId=state.recipes[0]?.id||null; saveState(); renderAll(); alert('Backup imported.'); }
      catch(e){ alert('Could not import this backup file.'); }
    };
    reader.readAsText(file);
  }
  function exportCSV(){
    const rows=[['Menu item','Category','12 oz cost','12 oz current price','12 oz difference','12 oz unresolved','16 oz cost','16 oz current price','16 oz difference','16 oz unresolved','22 oz cost','22 oz current price','22 oz difference','22 oz unresolved']];
    state.recipes.forEach(r=>{
      const a=sizeCost(r,'12'),b=sizeCost(r,'16'),c=sizeCost(r,'22');
      const sa=Number(r.sellingPrices?.['12'])||0,sb=Number(r.sellingPrices?.['16'])||0,sc=Number(r.sellingPrices?.['22'])||0;
      rows.push([r.name,r.category,a.total.toFixed(2),sa||'',sa?(sa-a.total).toFixed(2):'',a.unresolved,b.total.toFixed(2),sb||'',sb?(sb-b.total).toFixed(2):'',b.unresolved,c.total.toFixed(2),sc||'',sc?(sc-c.total).toFixed(2):'',c.unresolved]);
    });
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    downloadBlob(csv,'kape-barrio-menu-costing.csv','text/csv;charset=utf-8');
  }
  function downloadBlob(content,name,type){
    const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function resetData(){
    if(!confirm('Reset all changes and restore the original imported ingredient and menu data?')) return;
    state=clone(window.KBR_SEED); selectedRecipeId=state.recipes[0]?.id||null; activeRecipeSize='12'; saveState(); renderAll();
  }

  function switchToTab(id){
    $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===id));
  }
  function renderAll(){ renderCategoryFilters(); renderIngredients(); renderRecipeList(); renderRecipeEditor(); renderCosting(); renderReviewList(); }
  function fmt(n){ return Number.isFinite(n)?Number(n.toFixed(4)).toString():'—'; }
  function ensureOption(sel,val){ if(![...sel.options].some(o=>o.value===val)){const o=document.createElement('option');o.value=val;o.textContent=val;sel.appendChild(o);} }
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function escapeAttr(v){return escapeHtml(v);}

  function bind(){
    initTabs();
    $('#ingredientSearch').oninput=e=>{ingredientFilter=e.target.value;renderIngredients();};
    $('#recipeSearch').oninput=e=>{recipeFilter=e.target.value;renderRecipeList();};
    $('#recipeCategoryFilter').onchange=e=>{recipeCategory=e.target.value;renderRecipeList();};
    $('#costSearch').oninput=e=>{costFilter=e.target.value;renderCosting();};
    $('#costCategoryFilter').onchange=e=>{costCategory=e.target.value;renderCosting();};
    $('#addIngredientBtn').onclick=()=>openIngredientDialog();
    $('#addConversionBtn').onclick=()=>addConversionRow();
    $('#ingredientForm').addEventListener('submit',saveIngredientFromDialog);
    $('#addRecipeBtn').onclick=addNewRecipe;
    $('#exportJsonBtn').onclick=exportJSON;
    $('#exportCsvBtn').onclick=exportCSV;
    $('#importJsonInput').onchange=e=>{if(e.target.files?.[0]) importJSON(e.target.files[0]);e.target.value='';};
    $('#resetBtn').onclick=resetData;
    window.addEventListener('online',setOnlineStatus);window.addEventListener('offline',setOnlineStatus);setOnlineStatus();
    if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }

  bind(); renderAll();
})();
