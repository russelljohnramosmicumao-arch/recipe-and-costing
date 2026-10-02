(() => {
  const STORAGE_KEY = 'kbr-costing-data-v11';
  const LEGACY_STORAGE_KEY = 'kbr-costing-data-v9';
  const LEGACY_STORAGE_KEY_V1 = 'kbr-costing-data-v8';
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
  function migrateV11(data){
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
    // v11: latest images, instructions, prices, and Premium Cappuccino cleanup.
    const premiumMilk=data.recipes.find(r=>r.name==='Cappuccino - Premium (Milk)');
    const premiumBase=data.recipes.find(r=>r.name==='Cappuccino - Premium');
    if(premiumMilk){
      if(premiumBase){
        premiumBase.sizes=premiumMilk.sizes;
        premiumBase.notes='Premium cappuccino consolidated to the milk/frothed recipe.';
      } else {
        premiumMilk.name='Cappuccino - Premium';
      }
      data.recipes=data.recipes.filter(r=>r.name!=='Cappuccino - Premium (Milk)');
    }
    const v11Meta={"Fruit Soda": {"image": "images/green-apple.jpg", "instructions": {"12": "1. Lagay ng 1 ½ PUMPS ng syrup sa baso. 2. Lagyan ng ice ang baso. Around ¾ ng buong baso. 3. Lagyan ng Sprite ang baso. Wag masyadong punuin para sa toppings. 4. Lagyan ng Rainbow jelly na topping. Isang kutsara. 5. Lagyan ng parchment paper sa taas ng baso then close.", "16": "1. Lagay ng 2½ PUMPS ng syrup sa baso. 2. Lagyan ng ice ang baso. Around ¾ ng buong baso. 3. Lagyan ng Sprite ang baso. Wag masyadong punuin para sa toppings. 4. Lagyan ng Rainbow jelly na topping. Isang kutsara. 5. Lagyan ng parchment paper sa taas ng baso then close.", "22": "1. Lagay ng 4 PUMPS ng syrup sa baso. 2. Lagyan ng ice ang baso. Around ¾ ng buong baso. 3. Lagyan ng Sprite ang baso. Wag masyadong punuin para sa toppings. 4. Lagyan ng Rainbow jelly na topping. Isang kutsara. 5. Lagyan ng parchment paper sa taas ng baso then close."}, "sellingPrices": {"12": 39.0, "16": 49.0, "22": 69.0}}, "Coke Float": {"image": "images/coke-float.jpg", "instructions": {"12": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng Coke ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup.", "16": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng Coke ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup.", "22": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng Coke ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup."}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 69.0}}, "Chuckie Float": {"image": "images/chuckie-float.jpg", "instructions": {"12": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 110ml na Chuckie ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup.", "16": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 180ml na Chuckie ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup.", "22": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 110ml at 180ml na Chuckie ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng choco syrup."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 89.0}}, "Dutchmill Float": {"image": "images/dutchmill-float.jpg", "instructions": {"12": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 110ml na Dutchmill ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng strawberry syrup.", "16": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 180ml na Dutchmill ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng strawberry syrup.", "22": "1. Lagyan ng ice ang baso. Around ¾ ng buong baso. 2. Lagyan ng 110ml at 180ml na Dutchmill ang baso. Wag masyadong punuin para sa toppings. 3. Lagyan ng 1 scoop ice cream. 4. Add choco walling at drizzle yung ice cream ng strawberry syrup."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 89.0}}, "Classic Taro": {"image": "images/taro-milk-tea.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of taro powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Taro syrup na pang walling. 9. Cover with parchment paper and close.", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of taro powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Taro syrup na pang walling. 9. Cover with parchment paper and close.", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2½ tablespoon of taro powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Taro syrup na pang walling. 9. Cover with parchment paper and close."}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 79.0}}, "Okinawa": {"image": "images/okinawa-milk-tea.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of okinawa powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add okinawa syrup na pang walling. 9. Cover with parchment paper and close.", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of okinawa powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Taro okinawa na pang walling. 9. Cover with parchment paper and close.", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2½ tablespoon of okinawa powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Taro okinawa na pang walling. 9. Cover with parchment paper and close."}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "Cookies and Cream Milk Tea": {"image": "images/cookies-and-cream.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of Cookies and Cream powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang walling. 9. Cover with parchment paper and close.", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of Cookies and Cream powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang walling. 9. Cover with parchment paper and close.", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2½ tablespoon of Cookies and Cream powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang walling. 9. Cover with parchment paper and close."}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "Black Forest Choco": {"image": "images/black-forest-choco.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of Blackforest Choco powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of Blackforest Choco powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2 1⁄2 tablespoons of Blackforest Choco powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add more milk. 8. Add Choco syrup na pang"}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "Wintermelon": {"image": "images/wintermelon-milk-tea.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of wintermelon powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of wintermelon powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2½ tablespoon of wintermelon powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso. 7. Ilipat sa Baso yung mixture. Kung kulang, add"}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "White Bunny": {"image": "images/white-bunny-milk-tea.jpg", "instructions": {"12": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 100ml na milk ang shaker . 4. Maglagay ng 1 ½ tablespoon of white bunny powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso.", "16": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 180ml na milk ang shaker . 4. Maglagay ng 2 tablespoons of white bunny powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso.", "22": "1. Punuin ang baso ng ice . 2. Ilipat ice sa Shaker . 3. Lagyan ng 200ml na milk ang shaker . 4. Maglagay ng 2½ tablespoon of white bunny powder ang shaker. 5. Shake the mixture thoroughly. 6. Add Bobba Pearls sa baso."}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 79.0}}, "Matcha Milktea": {"image": "images/matcha-milk-tea.jpg", "instructions": {"12": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Sa shaker , maglagay ng 1 ½ tablespoon ng matcha powder, kunting ice, at 100 ml water. Then shake. Or", "16": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 180ml na milk ang baso . 3. Sa shaker , maglagay ng 1 ½ tablespoon ng matcha powder, kunting ice, at 100 ml water. Then shake. Or", "22": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 200ml na milk ang baso . 3. Sa shaker , maglagay ng 1 ½ tablespoon ng matcha powder, kunting ice, at 100 ml water. Then shake. Or"}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "Strawberry Milk Tea (Syrup)": {"image": "images/strawberry-milk-tea.jpg", "instructions": {"12": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 15ml (1 ½ pumps)na strawberry syrup sa jigger.", "16": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 25ml (2 ½ pumps) na strawberry syrup sa jigger.", "22": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 40ml (4 pumps) na strawberry syrup sa jigger."}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 79.0}}, "Blueberry Milk Tea (Syrup)": {"image": "images/blueberry-milk-tea.jpg", "instructions": {"12": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 15ml (1 ½", "16": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 25ml (2 ½", "22": "1. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso . 3. Maglagay ng 40ml (4"}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 79.0}}, "Brown Sugar Milk Tea (Syrup)": {"image": "images/caramel-brown-sugar.jpg", "instructions": {"12": "1. Lagyan ng pearl at ice ang baso ng around ¾ .", "16": "1. Lagyan ng pearl at ice ang baso ng around ¾ .", "22": "1. Lagyan ng pearl at ice ang baso ng around ¾ ."}, "sellingPrices": {"12": 49.0, "16": 59.0, "22": 79.0}}, "Red Matcha Milk Tea (Strawberry Matcha)": {"image": "images/red-matcha-milk-tea.jpg", "instructions": {"12": "1. Lagyan ng 10ml strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add ng 1 ½ tablespoons na matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na strawberry syrup for walling. 5. Cover with parchment paper and close.", "16": "1. Lagyan ng 20ml strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 70ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add 2 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na strawberry syrup for walling. 5. Cover with parchment paper and close.", "22": "1. Lagyan ng 40ml strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 1 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add 3 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na strawberry syrup for walling. 5. Cover with parchment paper and close."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Green Taro Milk Tea (Matcha Taro)": {"image": "images/green-taro-milktea.jpg", "instructions": {"12": "1. Lagyan ng 10ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add ng 1 ½ tablespoons na matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close.", "16": "1. Lagyan ng 20ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 70ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add 2 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close.", "22": "1. Lagyan ng 40ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 1 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Matcha. 3. Maglagay ng 100ml na milk sa frother . Then add 3 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Dirty Taro Milk Tea (Mocha Taro)": {"image": "images/dirty-taro-milktea.jpg", "instructions": {"12": "1. Lagyan ng 10ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa coffee and choco syrup. 3. Maglagay ng 20ml na coffee syrup at 10 ml choco syrup 4. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close.", "16": "1. Lagyan ng 10ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa coffee and choco syrup. 3. Maglagay ng 30ml na coffee syrup at 10 ml choco syrup 4. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close.", "22": "1. Lagyan ng 10ml Taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa coffee and choco syrup. 3. Maglagay ng 40ml na coffee syrup at 10 ml choco syrup 4. Add milk kung kulang. Then lagyan ng 5ml na Taro syrup for walling. 5. Cover with parchment paper and close."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Blue-ish Red Milk Tea (Blueberry & Strawberry)": {"image": "images/blue-ish-red-milktea.jpg", "instructions": {"12": "1. Lagyan ng 10ml Strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Blueberry. 3. Maglagay ng 100ml na milk sa frother . Then add ng 1 ½ tablespoons na matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Strawberry syrup for walling. 5. Cover with parchment paper and close.", "16": "1. Lagyan ng 20ml Strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 70ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Blueberry. 3. Maglagay ng 100ml na milk sa frother . Then add 2 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Strawberry syrup for walling. 5. Cover with parchment paper and close.", "22": "1. Lagyan ng 40ml Strawberry syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 1 50ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa Blueberry. 3. Maglagay ng 100ml na milk sa frother . Then add 3 tablespoons of matcha powder. Then mix. 4. Ilagay ang mixture sa baso. Add milk kung kulang. Then lagyan ng 5ml na Strawberry syrup for walling. 5. Cover with parchment paper and close."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Brown Sugar Taro Milk Tea": {"image": "images/caramel-brown-sugar.jpg", "instructions": {"12": "1. Lagyan ng 10ml taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 100ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa brown sugar. 3. Then lagyan ng 5ml na brown sugar syrup for walling. Add milk kung kulang. 5. Cover with parchment paper and close.", "16": "1. Lagyan ng 20ml taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 1 70ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa brown sugar. 3. Then lagyan ng 5ml na brown sugar syrup for walling. Add milk kung kulang. 5. Cover with parchment paper and close. 5. Cover with parchment paper and close.", "22": "1. Lagyan ng 40ml taro syrup ang baso. Then add 50ml milk and mix them. 2. Lagyan ng pearl at ice ang baso ng around ¾ . 2. Lagyan ng 250ml na milk ang baso or punuin hanggang ¾ lang ng baso. Magtira ng space para sa brown sugar. . Then lagyan ng 5ml na brown sugar syrup for walling. Add milk kung kulang. 5. Cover with parchment paper and close. 5. Cover with parchment paper and close."}, "sellingPrices": {"12": 49, "16": 59, "22": 79}}, "Americano - Budget": {"image": "images/americano.jpg", "instructions": {"12": "1. Maglagay ng 20 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks.", "16": "1. Maglagay ng 30 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 20 ml sweetener if the customer asks.", "22": "1. Maglagay ng 40 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 30 ml sweetener if the customer asks."}, "sellingPrices": {"12": null, "16": 89.0, "22": 109.0}}, "Cappuccino - Budget": {"image": "images/cappuccino.jpg", "instructions": {"12": "1. Ilagay ang 20 ml coffee syrup sa frother, then add 100ml milk. Wait the mixture na mag froth. 2. Maglagay ng ¾ cup ice sa baso at ilagay yung mixture. 2. Mag-add ng milk to fill. 3. Add 10 ml sweetener if the customer asks. 4. Add Parchment paper.", "16": "1. Ilagay ang 30ml coffee syrup sa frother, then add 100ml milk. Wait the mixture na mag froth. 2. Maglagay ng ¾ cup ice sa baso at ilagay yung mixture. 2. Mag-add ng milk to fill. 3. Add 10 ml sweetener if the customer asks. 4. Add Parchment paper.", "22": "1. Ilagay ang 40 ml coffee syrup sa frother, then add 100ml milk. Wait the mixture na mag froth. 2. Maglagay ng ¾ cup ice sa baso at ilagay yung mixture. 2. Mag-add ng milk to fill. 3. Add 10 ml sweetener if the customer asks. 4. Add Parchment paper."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Vanilla Latte - Budget": {"image": "images/vanilla-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 20 ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup. Add milk to full. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 25ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup. Add milk to full. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 40 ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup. Add milk to full. 4. And Parchment paper and close it."}, "sellingPrices": {"12": 59.0, "16": 69.0, "22": 89.0}}, "Caramel Latte - Budget": {"image": "images/caramel-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Spanish Latte - Budget": {"image": "images/spanish-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Iced Mocha Latte - Budget": {"image": "images/iced-mocha-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml choco syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20ml choco syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml choco syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Caramel Macchiato Latte - Budget": {"image": "images/caramel-macchiato.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml Vanilla at 10 ml Caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 10 ml Vanilla at 10 ml Caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 20 ml Vanilla at 20 ml Caramel Syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": 69.0, "16": 79.0, "22": 99.0}}, "Americano - Premium": {"image": "images/americano.jpg", "instructions": {"12": "1. Make an espresso shot and add sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks.", "16": "1. Maglagay ng 20 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks.", "22": "1. Maglagay ng 20 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks."}, "sellingPrices": {"12": null, "16": 89, "22": null}}, "Cappuccino - Premium": {"image": "images/cappuccino.jpg", "instructions": {"12": "1. Make an espresso shot and add sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks.", "16": "1. Maglagay ng 20 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks.", "22": "1. Maglagay ng 20 ml Coffee Syrup sa baso. 2. ¾ cup of ice then top it with water. 3. Add 10 ml sweetener if the customer asks."}, "sellingPrices": {"12": null, "16": 99, "22": null}}, "Vanilla Latte - Premium": {"image": "images/vanilla-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 20 ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup and espresso shot. Add milk to full. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 25ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup and espresso shot. Add milk to full. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 40 ml vanilla syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup and espresso shot. Add milk to full. 4. And Parchment paper and close it."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}, "Caramel Latte - Premium": {"image": "images/caramel-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup and espresso shot. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup espresso shot. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml caramel syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup espresso shot. Add milk to full. Add 5 ml caramel for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}, "Spanish Latte - Premium": {"image": "images/spanish-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 20 ml coffee syrup and espresso shot. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 30 ml coffee syrup and espresso shot. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml condensed milk, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the 40 ml coffee syrup and espresso shot. Add milk to full. Add 5 ml condensed milk for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": null, "16": 119.0, "22": 139.0}}, "Iced Mocha Latte - Premium": {"image": "images/iced-mocha-latte.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml choco syrup, then add 20 ml coffee syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 20 ml choco syrup, then add 30 ml coffee syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 30 ml choco syrup, then add 40 ml coffee syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml choco syrup for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}, "Caramel Macchiato Latte - Premium": {"image": "images/caramel-macchiato.jpg", "instructions": {"12": "1. Sa baso, maglagay ng 10 ml Vanilla at 10 ml Caramel syrup, then add 20 ml coffee syrup, then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it.", "16": "1. Sa baso, maglagay ng 10 ml Vanilla at 10 ml Caramel syrup,then add 30 ml coffee syrup then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it.", "22": "1. Sa baso, maglagay ng 20 ml Vanilla at 20 ml Caramel Syrup,then add 40 ml coffee syrup then 100ml milk. Mix it. 2. Punuin ng baso ng ice hanggang ¾ lang. Mag-iwan ng space para sa kape. 3. Drizzle the espresso shot. Add milk to full. Add 5 ml caramel syrup for walling. 4. And Parchment paper and close it."}, "sellingPrices": {"12": null, "16": 119.0, "22": 139.0}}, "Frappuccino": {"image": "images/frappuccino.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Frapmacchiato": {"image": "images/frappe-macchiato.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 20 ml vanilla 20 ml caramel 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 20 ml vanilla 20 ml caramel 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Frappe' de Ube (Taro)": {"image": "images/frappe-de-taro.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 20 grams of ube powder 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. Use 10 ml Taro syrup for walling. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml coffee syrup 20 grams of ube powder 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. Use 10 ml Taro syrup for walling. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Frappe' de Choco": {"image": "images/frappe-de-choco.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml choco syrup 20 grams of black forest powder 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. Use 10 ml choco syrup for walling. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml choco syrup 20 grams of black forest powder 1 instant coffee 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. Use 10 ml choco syrup for walling. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Mekus de Beries": {"image": "images/mekus-de-berries.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml na Strawberry Syrup 20 ml na Blueberry Syrup 3. Sa baso, maglagay ng blueberry jam at gamiting pang walling. Then ilagay sa baso yung nablender. Maglagay ng half spoon na white choco chips. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 ml na Strawberry Syrup 20 ml na Blueberry Syrup 3. Sa baso, maglagay ng blueberry jam at gamiting pang walling. Then ilagay sa baso yung nablender. Maglagay ng half spoon na white choco chips. 4. Close it with a flat lid and serve."}, "sellingPrices": {"12": null, "16": 99.0, "22": 119.0}}, "Familia de Verde": {"image": "images/familia-de-verde.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 grams avocado 20 grams matcha powder 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. Use 10 ml green apple syrup for walling. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 grams avocado 20 grams matcha powder 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. Use 10 ml green apple syrup for walling. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}, "Matcha Frappe": {"image": "images/matcha-frappe.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 grams matcha powder 10 ml vanilla syrup 3 grams premium matcha 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. Use 10 ml choco syrup for walling. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 20 grams matcha powder 10 ml vanilla syrup 3 grams premium matcha 3. Blend lahat. Then ilagay sa baso. Maglagay ng half spoon na white choco chips. 4. Add 1 scoop of vanilla ice cream. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}, "Mango Smoothie": {"image": "images/mango-smoothie.jpg", "instructions": {"16": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 2 scoops ng mango jam then blend. 3. Sa baso, maglagay ng half scoop ng mango Jam for walling. Then ilagay ang blended drink. Use half a scoop of mango jam pang toppings. 4. Close it with a flat lid and serve.", "22": "1. Sa baso, punuin ng ice . Ilagay yung ice sa blender . 2. Sa blender, maglagay ng 120 ml na milk. 20 ml na sweetener 20 ml na condensed milk 2 scoops ng mango jam then blend. 3. Sa baso, maglagay ng half scoop ng mango Jam for walling. Then ilagay ang blended drink. 4. Add 1 scoop of vanilla ice cream. Use half a scoop of mango jam pang toppings. 5. Close it with a dome lid and serve."}, "sellingPrices": {"12": null, "16": 109.0, "22": 129.0}}};
    data.recipes.forEach(r=>{
      const meta=v11Meta[r.name];
      if(!meta) return;
      if(meta.image) r.image=meta.image;
      r.instructions ||= {'12':'','16':'','22':''};
      ['12','16','22'].forEach(s=>{
        if(!r.instructions[s] && meta.instructions?.[s]) r.instructions[s]=meta.instructions[s];
      });
      r.sellingPrices ||= {'12':null,'16':null,'22':null};
      ['12','16','22'].forEach(s=>{
        if((r.sellingPrices[s]===null || r.sellingPrices[s]==='' || r.sellingPrices[s]===undefined) && meta.sellingPrices?.[s]!=null)
          r.sellingPrices[s]=meta.sellingPrices[s];
      });
    });
    return data;
  }
  function loadState(){
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return migrateV11(JSON.parse(saved));
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy){
        const migrated = migrateV11(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
      if (legacyV1){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV1)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyOld = localStorage.getItem('kbr-costing-data-v1');
      if (legacyOld){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyOld)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV2 = localStorage.getItem('kbr-costing-data-v2');
      if (legacyV2){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV2)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV3 = localStorage.getItem('kbr-costing-data-v3');
      if (legacyV3){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV3)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV4 = localStorage.getItem('kbr-costing-data-v4');
      if (legacyV4){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV4)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV5 = localStorage.getItem('kbr-costing-data-v5');
      if (legacyV5){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV5)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const legacyV6 = localStorage.getItem('kbr-costing-data-v6');
      if (legacyV6){
        const migrated = migrateV11(pruneUnusedIngredients(JSON.parse(legacyV6)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch(e){ console.warn(e); }
    return migrateV11(clone(window.KBR_SEED));
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


  function isPackagingLine(line){
    const n=(line?.ingredient||'').trim().toLowerCase();
    const packagingNames=new Set([
      '12 oz with logo','16 oz with logo','22 oz with logo',
      'flat lids','dome lids','thin straws','bobba straws',
      'single bags','parchment paper'
    ]);
    return packagingNames.has(n) || /packaging/i.test(line?.note||'');
  }

  function lineEditorHtml(ln,idx){
    const lc=lineCost(ln);
    return `<div class="line-row kbr-compact" data-line="${idx}">
      <select class="line-ingredient">${state.ingredients.map(i=>`<option ${i.name===ln.ingredient?'selected':''}>${escapeHtml(i.name)}</option>`).join('')}${findIngredient(ln.ingredient)?'':`<option selected>${escapeHtml(ln.ingredient)}</option>`}</select>
      <input class="line-qty" type="number" min="0" step="0.01" value="${ln.qty}">
      <select class="line-unit">${recipeUnits.map(u=>`<option ${normUnit(u)===normUnit(ln.unit)?'selected':''}>${u}</option>`).join('')}</select>
      <input class="line-optional" type="checkbox" ${ln.optional?'checked':''} title="Optional ingredient">
      <div class="line-cost">${lc.cost==null?`<span class="cost-error">${escapeHtml(lc.error)}</span>`:money(lc.cost)}</div>
      <button class="icon-btn line-delete" type="button" title="Remove">×</button>
    </div>`;
  }

  function renderRecipeEditor(){
    const host=$('#recipeEditor');
    const r=state.recipes.find(x=>x.id===selectedRecipeId);
    if(!r){host.innerHTML='<div class="empty-state">Select a recipe to edit.</div>';return;}

    r.instructions ||= {'12':'','16':'','22':''};
    r.sellingPrices ||= {'12':null,'16':null,'22':null};

    const sc=sizeCost(r,activeRecipeSize);
    const sell=Number(r.sellingPrices?.[activeRecipeSize]);
    const diff=sell>0?sell-sc.total:null;
    const lines=r.sizes?.[activeRecipeSize]||[];
    const ingredientCount=lines.filter(x=>!isPackagingLine(x)).length;
    const packagingCount=lines.filter(isPackagingLine).length;

    host.innerHTML=`
      <div class="kbr-recipe-hero">
        <section class="kbr-drink-info">
          <span class="kbr-eyebrow">Drink</span>
          <input id="editRecipeName" class="kbr-name-input" value="${escapeAttr(r.name)}">
          <input id="editRecipeCategory" class="kbr-category-input" value="${escapeAttr(r.category||'')}" placeholder="Category">
          <div class="size-tabs">${['12','16','22'].map(s=>`<button class="size-tab ${s===activeRecipeSize?'active':''}" data-size="${s}">${sizeLabels[s]}</button>`).join('')}</div>
        </section>

        <section class="kbr-photo-box">
          ${r.image?`<img src="${escapeAttr(r.image)}" alt="${escapeAttr(r.name)}">`:`<div class="kbr-photo-empty">No image</div>`}
        </section>

        <section class="kbr-price-box">
          <div class="kbr-price-row"><span>Current costing</span><strong>${money(sc.total)}</strong></div>
          <div class="kbr-price-row">
            <span>Current price</span>
            <strong>${sell>0?money(sell):'—'}</strong>
            <input id="sellingPrice" class="selling-input" type="number" min="0" step="0.01" value="${r.sellingPrices?.[activeRecipeSize]??''}" placeholder="Price">
          </div>
          <div class="kbr-price-row ${diff!=null&&diff<0?'kbr-loss':''}">
            <span>Difference</span><strong>${diff!=null?money(diff):'—'}</strong>
            <small>${sc.unresolved?`${sc.unresolved} unresolved cost line(s)`:sell>0?`Food cost ${(sc.total/sell*100).toFixed(1)}%`:'Enter current price'}</small>
          </div>
        </section>
      </div>

      <div class="kbr-recipe-titlebar">
        <div><h3>Recipe</h3><span>${ingredientCount} ingredients · ${packagingCount} packaging</span></div>
        <button class="danger-link" id="deleteRecipeBtn">Delete recipe</button>
      </div>

      <div class="kbr-recipe-grid">
        <section class="kbr-recipe-card">
          <div class="kbr-card-head">
            <div><h4>Ingredients</h4><span>Add, remove, or change ingredients.</span></div>
            <button id="addRecipeLineBtn" class="btn small primary">+ Ingredient</button>
          </div>
          <div class="kbr-line-head"><span>Ingredient</span><span>Qty</span><span>Unit</span><span>Opt.</span><span>Cost</span><span></span></div>
          <div id="ingredientLineRows"></div>
        </section>

        <section class="kbr-recipe-card kbr-packaging-card">
          <div class="kbr-card-head">
            <div><h4>Packaging</h4><span>Cup, lid, straw, bag, paper.</span></div>
            <button id="addPackagingLineBtn" class="btn small">+ Packaging</button>
          </div>
          <div class="kbr-line-head"><span>Packaging</span><span>Qty</span><span>Unit</span><span>Opt.</span><span>Cost</span><span></span></div>
          <div id="packagingLineRows"></div>
        </section>
      </div>

      <div class="recipe-total kbr-total">
        <span>Total recipe + packaging cost</span>
        <strong>${money(sc.total)}</strong>
        ${sc.unresolved?`<span class="badge warn">${sc.unresolved} unresolved</span>`:'<span class="badge ok">complete</span>'}
      </div>

      <section class="kbr-instructions-card">
        <div class="kbr-card-head">
          <div><h4>Instructions</h4><span>Preparation steps for ${sizeLabels[activeRecipeSize]}.</span></div>
          <button id="saveRecipeBtn" class="btn primary">Save recipe</button>
        </div>
        <textarea id="recipeInstructions" placeholder="Enter preparation instructions…">${escapeHtml(r.instructions?.[activeRecipeSize]||'')}</textarea>
      </section>

      ${r.needsReview?`<div class="review-callout"><strong>Needs review.</strong> ${escapeHtml(r.notes||'Imported source has an inconsistency.')}</div>`:''}
      <div class="notes-box"><label class="subtle">Internal notes / source notes</label><textarea id="recipeNotes">${escapeHtml(r.notes||'')}</textarea></div>
    `;

    renderRecipeLines(r);

    $$('.size-tab',host).forEach(b=>b.onclick=()=>{activeRecipeSize=b.dataset.size;renderRecipeEditor();});

    $('#addRecipeLineBtn').onclick=()=>{
      const defaultIng=state.ingredients.find(i=>!['12 oz with logo','16 oz with logo','22 oz with logo','Flat lids','Dome lids','Thin straws','Bobba Straws','Single Bags','Parchment Paper'].includes(i.name)) || state.ingredients[0];
      r.sizes[activeRecipeSize].push({ingredient:defaultIng?.name||'',qty:0,unit:defaultIng?.unit||'ml',optional:false,note:''});
      saveState();renderRecipeEditor();
    };

    $('#addPackagingLineBtn').onclick=()=>{
      r.sizes[activeRecipeSize].push({ingredient:'Single Bags',qty:1,unit:'pc',optional:false,note:'Packaging'});
      saveState();renderRecipeEditor();
    };

    $('#sellingPrice').onchange=()=>{
      r.sellingPrices[activeRecipeSize]=$('#sellingPrice').value===''?null:Number($('#sellingPrice').value);
      saveState();renderRecipeEditor();
    };

    $('#saveRecipeBtn').onclick=()=>saveRecipeEditor(r);
    $('#deleteRecipeBtn').onclick=()=>{
      if(confirm(`Delete ${r.name}?`)){
        state.recipes=state.recipes.filter(x=>x.id!==r.id);
        selectedRecipeId=state.recipes[0]?.id||null;
        saveState();renderAll();
      }
    };
  }

  function renderRecipeLines(r){
    const lines=r.sizes?.[activeRecipeSize]||[];
    const ingredients=lines.map((ln,idx)=>({ln,idx})).filter(x=>!isPackagingLine(x.ln));
    const packaging=lines.map((ln,idx)=>({ln,idx})).filter(x=>isPackagingLine(x.ln));

    $('#ingredientLineRows').innerHTML=ingredients.length
      ? ingredients.map(x=>lineEditorHtml(x.ln,x.idx)).join('')
      : '<div class="empty-mini">No ingredients yet.</div>';

    $('#packagingLineRows').innerHTML=packaging.length
      ? packaging.map(x=>lineEditorHtml(x.ln,x.idx)).join('')
      : '<div class="empty-mini">No packaging yet.</div>';

    $$('.line-row[data-line]',$('#recipeEditor')).forEach(row=>{
      const idx=Number(row.dataset.line);
      const ln=lines[idx];

      $('.line-ingredient',row).onchange=e=>{
        ln.ingredient=e.target.value;
        const ing=findIngredient(ln.ingredient);
        if(ing) ln.unit=ing.unit;
        saveState();renderRecipeEditor();
      };
      $('.line-qty',row).onchange=e=>{ln.qty=Number(e.target.value);saveState();renderRecipeEditor();};
      $('.line-unit',row).onchange=e=>{ln.unit=e.target.value;saveState();renderRecipeEditor();};
      $('.line-optional',row).onchange=e=>{ln.optional=e.target.checked;saveState();};
      $('.line-delete',row).onclick=()=>{lines.splice(idx,1);saveState();renderRecipeEditor();};
    });
  }

  function saveRecipeEditor(r){
    r.name=$('#editRecipeName').value.trim()||'Untitled Recipe';
    r.category=$('#editRecipeCategory').value.trim();
    r.notes=$('#recipeNotes').value.trim();
    r.instructions ||= {'12':'','16':'','22':''};
    r.instructions[activeRecipeSize]=$('#recipeInstructions').value.trim();
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
