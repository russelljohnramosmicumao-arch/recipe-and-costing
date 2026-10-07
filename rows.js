const ICE_FILL={'12':200,'16':250,'22':330};
const LIQUID_FILL={'12':180,'16':220,'22':300};
function ingredientKey(d){return [d.category,d.name,type,size,isFrappe(d)&&size==='16'?(withIce?'ice':'plain'):''].join('|');}
const ROWS_KEY='kbr-recipe-rows-v2';let savedRows={},legacyIngredients={},rowEditor=null,rowError='';
try{const x=JSON.parse(localStorage.getItem(ROWS_KEY)||'{}');if(x&&typeof x==='object'&&!Array.isArray(x))savedRows=x;}catch{}
try{const x=JSON.parse(localStorage.getItem('kbr-recipe-ingredients-v1')||'{}');if(x&&typeof x==='object')legacyIngredients=x;}catch{}
const UNIT_OPTIONS=['g','ml','pc','pump','tbsp','scoop','sachet','shot','cup','portion','as needed','to fill'];
function normalizedName(x){return String(x).toLowerCase().replace(/[^a-z0-9]/g,'');}
function canonicalName(name,d){
 const n=normalizedName(name);
 if(['milk','milkmade'].includes(n))return 'Milk (Made)';
 if(/whitechoco|chocochipswhite/.test(n))return 'Removed ingredient';
 if(['bobapearlcooked','bobapearlscooked','boobapearls','bobapearl','bobapearls','bobba','bobbapearl','bobbapearls'].includes(n))return 'Boba pearl cooked';
 if(n==='ubesyrup')return 'Taro Syrup';
 if(['blackforestchocopowder','blackforest'].includes(n))return 'Black Forest Powder';
 if(['vanillaicecream','icecreamvanilla'].includes(n))return 'Ice cream (vanilla)';
 const aliases={coffeesyrup:'Coffee Espresso Syrup',coffeesyrupespressoshot:'Espresso Shot',espressoshot:'Espresso Shot',coffeebeams:'Coffee ground',coffeebeans:'Coffee ground',boba:'Booba Pearls',bobapearl:'Booba Pearls',bobapearls:'Booba Pearls',bobba:'Booba Pearls',bobbaPearls:'Booba Pearls',taropowder:'Taro Milk Tea',whitebunnypowder:'White Bunny Milk Tea',wintermelonpowder:'Wintermelon',cookiesandcreampowder:'Cookies and Cream',okinawapowder:'Okinawa',okinawasyrup:'Okinawa',condensed:'Condensed Milk',ccondensedmilk:'Condensed Milk',vanilla:'Vanilla Syrup',caramel:'Caramel Syrup',greenapple:'Green Apple Syrup',chocosyrup:'Choco Syrup',premiumMatcha:'Matcha Ceremonial Powder',premiummatcha:'Matcha Ceremonial Powder',avocadopowder:'Avocado Milk Shake Poweder',ubepowder:'Ube milk shake powder',dutchmill:'Dutch Mill',coke:'Coke Soda',blueberryjam:'Blue berry Jam',syrupblueberry:'Blueberry Syrup',syrupstrawberry:'Strawberry Syrup',syrupbrownsugar:'Brown Sugar Syrup',ice:'Ice tubes',icecreamvanilla:'Ice cream (vanilla)'};
 if(n==='syrup'&&d.category==='Soda'){const flavor=INGREDIENT_CATALOG.find(x=>normalizedName(x.name)===normalizedName(d.name+' Syrup'));return flavor?flavor.name:'Fruit Soda Syrup';}
 const direct=INGREDIENT_CATALOG.find(x=>normalizedName(x.name)===n);if(direct)return direct.name;
 return aliases[n]||String(name).trim().replace(/^of\s+/i,'');
}
function parseNumber(s){s=String(s).trim().replace(/½/g,' .5').replace(/¾/g,' .75').replace(/¼/g,' .25').replace(/⁄/g,'/');if(/^\d+\s*\/\s*\d+$/.test(s)){const[a,b]=s.split('/').map(Number);return b?a/b:null;}const ns=s.match(/\d+(?:\.\d+)?|\.\d+/g);return ns?ns.map(Number).reduce((a,b)=>a+b,0):null;}
function unitName(s){s=s.toLowerCase();if(s.startsWith('gram'))return 'g';if(s.startsWith('table')||s==='tbsp')return 'tbsp';if(s.startsWith('pump'))return 'pump';if(s.startsWith('scoop'))return 'scoop';if(s.startsWith('sachet'))return 'sachet';if(s.startsWith('cup'))return 'cup';if(s==='pcs'||s==='piece'||s==='pieces')return 'pc';return s;}
function parseIngredient(line,d){
 if(line&&typeof line==='object')return {name:canonicalName(line.name,d),quantity:line.quantity??null,unit:String(line.unit||'g')};
 const raw=String(line).replace(/\u200b/g,'').trim();
 if(/ice/i.test(raw)&&/cup of ice/i.test(raw)){
  const rows=[{name:'Ice tubes',quantity:ICE_FILL[size],unit:'g'}];
  if(/Coke/i.test(raw))rows.push({name:'Coke Soda',quantity:LIQUID_FILL[size],unit:'ml'});
  if(/Espresso Shot/i.test(raw))rows.push({name:'Espresso Shot',quantity:null,unit:'shot'});
  return rows;
 }
 let quantity=null,unit='as needed',name=raw;
 const combined=raw.match(/^(\d+)\s*ml\s*\+\s*(\d+)\s*ml\s+(.+)$/i);
 const initial=raw.match(/^([\d\s.½¾¼/⁄]+)\s*(ml|grams?|g|tablespoons?|tbsp|pumps?|scoops?|sachets?|cups?|shots?|pcs?)\s+(?:of\s+)?(.+)$/i);
 const final=raw.match(/^(.+?)\s*\(([\d\s.½¾¼/⁄]+)\s*(ml|grams?|g|pumps?|scoops?)\)$/i);
 const trailing=raw.match(/^(.+?)\s+([\d\s.½¾¼/⁄]+)\s*(pumps?|ml|grams?|g)$/i);
 const dash=raw.match(/^(.+?)\s*[—–]\s*([\d\s.½¾¼/⁄]+)\s*(ml|grams?|g|pumps?|scoops?|tbsp|pc)$/i);
 if(combined){quantity=Number(combined[1])+Number(combined[2]);unit='ml';name=combined[3];}
 else if(initial){quantity=parseNumber(initial[1]);unit=unitName(initial[2]);name=initial[3];}
 else if(final){quantity=parseNumber(final[2]);unit=unitName(final[3]);name=final[1];}
 else if(trailing){quantity=parseNumber(trailing[2]);unit=unitName(trailing[3]);name=trailing[1];}
 else if(dash){quantity=parseNumber(dash[2]);unit=unitName(dash[3]);name=dash[1];}
 if(/to (fill|full)/i.test(name)){name=name.replace(/to (fill|full)/ig,'').trim();if(quantity===null)unit='to fill';}
 name=name.replace(/\s*\(Depende\)/ig,'').trim();
 const optional=/\(optional\)/i.test(name);name=name.replace(/\s*\(optional\)/ig,'');
 if(unit==='tbsp'&&quantity!==null){quantity=Number((quantity*13).toFixed(3));unit='g';}
 if(unit==='sachet'&&/instant coffee/i.test(name)&&quantity!==null){quantity*=5;unit='g';}
 if(unit==='scoop'&&/mango jam/i.test(name)&&quantity!==null){quantity*=40;unit='g';}
 return {name:canonicalName(name,d),quantity,unit,...(optional?{note:'Optional'}:{})};
}
function flatParsed(lines,d){return lines.flatMap(x=>{const value=parseIngredient(x,d);return Array.isArray(value)?value:[value]});}
function standardIngredients(d,v){
 const legacy=legacyIngredients[ingredientKey(d)];const lines=Array.isArray(legacy)&&legacy.every(x=>typeof x==='string')?legacy:(v?.ingredients||[]);
 let rows=flatParsed(lines,d);
 rows=rows.filter(x=>x.name!=='Removed ingredient').map(x=>{const n=normalizedName(x.name);if(n==='icetubes')return {...x,quantity:Math.max(Number(x.quantity)||0,ICE_FILL[size]),unit:'g'};if(n==='milkmade')return {...x,quantity:d.name==='Cookies de Crema'||d.name==='Mango Smoothie'&&size==='22'?Number(x.quantity):Math.max(Number(x.quantity)||0,LIQUID_FILL[size]),unit:'ml'};if(['sprite','cokesoda','sodawater'].includes(n))return {...x,quantity:Math.max(Number(x.quantity)||0,LIQUID_FILL[size]),unit:'ml'};if(n==='water'&&(x.quantity===null||x.unit==='to fill'))return {...x,quantity:LIQUID_FILL[size],unit:'ml'};if(n==='espressoshot'&&x.quantity===null)return {...x,quantity:1,unit:'shot'};if(n==='bobapearlcooked')return {...x,quantity:50,unit:'g'};if(/icecream/.test(n)&&x.unit==='scoop')return {...x,quantity:(Number(x.quantity)||1)*40,unit:'g'};return x;});
 if(v&&rows.length&&!rows.some(x=>normalizedName(x.name)==='milkmade')&&v.steps.some(x=>/\bmilk\b/i.test(x))&&!['Chuckie Float','Dutchmill Float'].includes(d.name))rows.push({name:'Milk (Made)',quantity:LIQUID_FILL[size],unit:'ml'});
 if(v&&/ice cream/i.test(v.label+' '+v.steps.join(' '))&&!rows.some(x=>/icecream/.test(normalizedName(x.name))))rows.push({name:'Ice cream (vanilla)',quantity:40,unit:'g'});
 if(d.category==='Soda')rows=rows.map(x=>x.name==='Fruit Soda Syrup'?{...x,note:d.name+' flavour'}:x);
 if(d.name==='Chuckie Float'||d.name==='Dutchmill Float'){
  const drink=d.name==='Chuckie Float'?'Chuckie':'Dutch Mill';const beverage={'12':110,'16':180,'22':290}[size];
  rows=rows.filter(x=>!['milk','milkmade','chuckie','dutchmill'].includes(normalizedName(x.name)));
  if(!rows.some(x=>x.name==='Ice tubes'))rows.unshift({name:'Ice tubes',quantity:ICE_FILL[size],unit:'g'});
  rows.splice(1,0,{name:drink,quantity:beverage,unit:'ml'},{name:'Milk (Made)',quantity:LIQUID_FILL[size]-beverage,unit:'ml',note:'Top up to '+LIQUID_FILL[size]+' ml'});
 }
 return rows;
}
function rowStorageKey(d,kind){return ingredientKey(d)+'|'+kind;}
function validRows(x){return Array.isArray(x)&&x.every(r=>r&&typeof r.name==='string'&&typeof r.unit==='string'&&(r.quantity===null||(typeof r.quantity==='number'&&Number.isFinite(r.quantity)&&r.quantity>=0)));}
function getRows(d,kind,v,packaging){if(kind==='ingredients'&&isFrappe(d)&&size==='16'&&withIce){const base=inContext(d,'16',type,false,()=>getRows(d,kind,variant(d),packaging)).filter(r=>!/icecream/.test(normalizedName(r.name)));const ice=standardIngredients(d,v).find(r=>/icecream/.test(normalizedName(r.name)));return [...base,{name:ice?.name||'Ice cream (vanilla)',quantity:40,unit:'g'}];}const stored=savedRows[rowStorageKey(d,kind)];if(validRows(stored))return stored.map(x=>({...x}));return kind==='ingredients'?standardIngredients(d,v):packaging.map(x=>Array.isArray(x)?{name:x[0],quantity:parseNumber(x[1]),unit:x[1].includes('pc')?'pc':'as needed'}:{...x});}
function cancelIngredientEdit(){rowEditor=null;rowError='';}
function rowList(d,kind,v,packaging){
 const rows=getRows(d,kind,v,packaging);const catalog=kind==='ingredients'?INGREDIENT_CATALOG.map(x=>x.name):['12 oz cup','16 oz cup','22 oz cup','Boba straw','Thin straw','Flat straw','Flat lid','Dome lid','Parchment paper','Single bag','Single plastic bag'];
 const editing=rowEditor&&rowEditor.kind===kind;const index=editing?rowEditor.index:-1;
 const renderEditor=(row,i)=>`<form class="row-editor" data-row-form="${kind}" data-row-index="${i}"><label>${kind==='ingredients'?'Ingredient':'Packaging item'}<input name="rowName" list="${kind}-choices" value="${esc(row.name)}" required maxlength="160" autocomplete="off" placeholder="Choose or type a name"></label><div class="row-amounts"><label>Quantity<input name="rowQuantity" type="number" min="0" step="any" value="${row.quantity===null?'':esc(row.quantity)}" placeholder="Quantity"></label><label>Unit<select name="rowUnit">${[...new Set([...UNIT_OPTIONS,row.unit])].map(u=>`<option value="${esc(u)}" ${u===row.unit?'selected':''}>${esc(u)}</option>`).join('')}</select></label></div><div class="edit-actions"><button class="save" type="submit">Save</button><button type="button" data-cancel-row="true">Cancel</button></div>${rowError?`<p class="save-error" role="alert">${esc(rowError)}</p>`:''}</form>`;
 return `<div class="recipe-row heading" aria-hidden="true"><span>${kind==='ingredients'?'Ingredient':'Packaging'}</span><span>Quantity</span><span>Unit</span><span></span></div><div class="recipe-rows">${rows.map((r,i)=>index===i?renderEditor(r,i):`<div class="recipe-row"><span class="row-name">${esc(r.name)}${r.note?`<small>${esc(r.note)}</small>`:''}${kind==='ingredients'&&!INGREDIENT_CATALOG.some(x=>normalizedName(x.name)===normalizedName(r.name))?'<small class="unmatched">Not in ingredient list</small>':''}</span><span class="row-quantity">${r.quantity===null?'—':esc(r.quantity)}</span><span>${esc(r.unit)}</span><button class="pencil" data-edit-row="${kind}" data-row-index="${i}" aria-label="Edit ${esc(r.name)}" title="Edit ${esc(r.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg></button></div>`).join('')}${index===rows.length?renderEditor({name:'',quantity:1,unit:kind==='ingredients'?'g':'pc'},rows.length):''}</div>${!rows.length&&index<0?'<p class="empty">No items yet. Add an item below.</p>':''}<button class="add-row" data-add-item="${kind}">${kind==='ingredients'?'Add ingredients':'Add packaging'}</button><datalist id="${kind}-choices">${catalog.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist><p class="note">${kind==='ingredients'?'Choose ingredient names from your supply list. ':''}Edits sync to the shop cloud for this size and variant.</p>`;
}
function saveRow(d,kind,index,row){if(kind==='ingredients'&&isFrappe(d)&&size==='16'&&withIce){const rows=getRows(d,kind,variant(d),currentPackaging);if(index===rows.length-1)throw Error('The ice cream version adds one fixed 40 g scoop. Edit other ingredients in the base recipe.');return inContext(d,'16',type,false,()=>saveRow(d,kind,index===rows.length?index-1:index,row));}const rows=getRows(d,kind,variant(d),currentPackaging);if(index<0||index>rows.length)throw Error('Invalid row');rows[index]=row;const next={...savedRows,[rowStorageKey(d,kind)]:rows};localStorage.setItem(ROWS_KEY,JSON.stringify(next));savedRows=next;}
function recipeSteps(d,v){
 if(!v)return [];
 if(d.name!=='Chuckie Float'&&d.name!=='Dutchmill Float')return v.steps;
 const rows=getRows(d,'ingredients',v,currentPackaging),brand=d.name==='Chuckie Float'?'Chuckie':'Dutch Mill';
 const amount=name=>rows.find(r=>r.name===name);
 const display=r=>r?`${r.quantity===null?'Measured amount':r.quantity+' '+r.unit} of ${r.name}`:'';
 const steps=[`Add ${display(amount('Ice tubes'))||'the measured ice'} to the selected cup.`,`Pour in ${display(amount(brand))||'the measured '+brand}.`];
 const milk=amount('Milk (Made)');if(milk)steps.push(`Add ${display(milk)} to top up the base liquid. Use the amounts in the ingredient table.`);
 steps.push(...v.steps.filter(x=>/ice cream|walling|drizzle/i.test(x)),'Close the cup and serve with the items in the packaging table.');return steps;
}
