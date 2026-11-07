'use strict';
(()=>{
const trigger=document.getElementById('recipeMenuDetails');
if(!trigger)return;
const outer=document.createElement('section');
outer.id='recipeCatalogPanel';outer.hidden=true;
outer.innerHTML=`
<div class="catalog-head"><h2>Menu Details & Photos</h2><button id="catalogClose" type="button">Close</button></div>
<p>Edit product names, categories, pictures and the <b>names</b> of sizes here. Set prices and size availability from the Manager's <b>Price Management</b> tab. A renamed size retains its recipe and selling price.</p>
<div class="catalog-tools"><input id="catalogSearch" type="search" placeholder="Search products…"><select id="catalogFilter"><option value="">All categories</option></select><button id="catalogReload" type="button">Refresh</button><button id="catalogNew" type="button">＋ New Product</button></div>
<p id="catalogStatus" role="status"></p>
<form id="catalogForm" hidden>
 <h3 id="catalogTitle">Edit menu details</h3>
 <div class="catalog-fields"><label>Product name<input id="catalogName" maxlength="100" required></label><label>Category<select id="catalogCategory" required></select></label><label><input id="catalogFood" type="checkbox"> Food / non-drink item</label></div>
 <div class="catalog-photo"><img id="catalogImage" alt="Menu picture preview" hidden><label>Upload or replace picture<input id="catalogUpload" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
 <h4>Rename sizes or selling units</h4><p>Rename the labels without changing their prices. For frappes you can use names like “16 oz without ice cream” or “22 oz with ice cream”. New sizes start unavailable at ₱1 until priced and enabled in Manager.</p>
 <div id="catalogSizes"></div><button id="catalogAddSize" type="button">＋ Add Size / Portion</button>
 <div class="catalog-actions"><button id="catalogSave" type="submit">Save Menu Details</button><button id="catalogCancel" type="button">Cancel</button></div>
</form>
<div id="catalogItems"></div>`;
document.body.append(outer);
const style=document.createElement('style');
style.textContent=`
#recipeCatalogPanel{position:fixed;inset:0;z-index:1000;overflow-y:auto;background:#f9f5ee;color:#3e332c;padding:22px;box-sizing:border-box;font-family:system-ui}
#recipeCatalogPanel[hidden],#catalogForm[hidden]{display:none!important}
#recipeCatalogPanel .catalog-head,#recipeCatalogPanel .catalog-tools,#recipeCatalogPanel .catalog-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:12px 0}
#recipeCatalogPanel .catalog-head{justify-content:space-between}
#recipeCatalogPanel button{padding:9px 13px;border-radius:9px;border:1px solid #ccb79f;cursor:pointer;font:inherit}
#recipeCatalogPanel input,#recipeCatalogPanel select{min-width:0;width:100%;font:inherit;padding:9px;border:1px solid #ccb79f;border-radius:8px;box-sizing:border-box}
#recipeCatalogPanel #catalogSave,#recipeCatalogPanel #catalogNew{background:#694731;color:#fff;font-weight:700}
#recipeCatalogPanel .catalog-tools input{flex:2;min-width:140px}#recipeCatalogPanel .catalog-tools select{flex:1;min-width:140px}
#recipeCatalogPanel #catalogForm{border:1px solid #c8b19b;background:#fff9f2;border-radius:14px;padding:15px;margin:15px 0}
#recipeCatalogPanel .catalog-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#recipeCatalogPanel label{display:grid;gap:5px;font-weight:650}
#recipeCatalogPanel .catalog-fields label:last-child{display:flex;align-items:center}
#recipeCatalogPanel [type=checkbox]{width:auto}
#recipeCatalogPanel .catalog-photo{display:flex;align-items:center;gap:15px;margin:15px 0;flex-wrap:wrap}
#recipeCatalogPanel .catalog-photo img{width:105px;height:105px;object-fit:cover;border-radius:10px}
#recipeCatalogPanel .catalog-row{display:grid;grid-template-columns:110px minmax(140px,1fr) 44px;gap:8px;margin:9px 0;align-items:center}
#recipeCatalogPanel .catalog-entry{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e5d7cb;border-radius:12px;margin:8px 0;padding:9px}
#recipeCatalogPanel .catalog-entry img{width:60px;height:60px;object-fit:cover;background:#f0e8df;border-radius:8px}
#recipeCatalogPanel .catalog-entry .info{flex:1;min-width:0}#recipeCatalogPanel .catalog-entry small{display:block;color:#756553}
#recipeCatalogPanel #catalogStatus{font-weight:700;color:#245a37}
@media(max-width:650px){#recipeCatalogPanel .catalog-fields{grid-template-columns:1fr}#recipeCatalogPanel .catalog-row{grid-template-columns:90px minmax(100px,1fr) 40px}}
`;
document.head.append(style);
const $=id=>outer.querySelector('#'+id);
const imageUrl=raw=>!raw?'':/^https?:\/\//.test(raw)?raw:'https://russelljohnramosmicumao-arch.github.io/Kape-Barrio/'+raw.replace(/^\.\//,'');
let products=[],menuRevision=null,recipeRevision=null,selected=null,file=null,working=false;
const note=(m)=>{$('catalogStatus').textContent=m;};
function ensureCategory(){
 const cats=[...new Set(products.map(x=>x.category).filter(Boolean))].sort();
 const prev=$('catalogFilter').value;
 $('catalogFilter').replaceChildren(new Option('All categories',''),...cats.map(x=>new Option(x,x)));
 $('catalogFilter').value=cats.includes(prev)?prev:'';
 $('catalogCategory').replaceChildren(new Option('Select category',''),...cats.map(x=>new Option(x,x)));
}
async function reload(){
 if(working)return;working=true;note('Loading latest shared menu and recipes…');
 try{
  const [m,r]=await Promise.all([
   cloud.rpc('kbr_manager_menu_snapshot',{}),
   cloud.request('/rest/v1/kbr_recipe_state?id=eq.1&select=revision')
  ]);
  products=m.items||[];menuRevision=Number(m.revision);
  recipeRevision=Number(r[0]?.revision);
  if(!Number.isInteger(recipeRevision))throw Error('Recipe revision unavailable. Please sync Recipe & Costing first.');
  ensureCategory();draw();note('Menu details loaded. Size prices and availability are managed separately.');
 }catch(e){note(e.message||'Unable to load menu details');}
 finally{working=false;}
}
function draw(){
 const q=$('catalogSearch').value.toLowerCase(),cat=$('catalogFilter').value;const container=$('catalogItems');container.replaceChildren();
 for(const p of products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+p.category).toLowerCase().includes(q)))){
  const el=document.createElement('div');el.className='catalog-entry';
  const img=document.createElement('img');img.alt=p.name;if(p.image)img.src=imageUrl(p.image);
  const inf=document.createElement('div');inf.className='info';const strong=document.createElement('strong');strong.textContent=p.name;
  const small=document.createElement('small');small.textContent=p.category+' · '+(p.sizes||[]).join(', ');inf.append(strong,small);
  const b=document.createElement('button');b.textContent='Edit';b.onclick=()=>open(p);
  el.append(img,inf,b);container.append(el);
 }
}
function addRow(type='standard',size=''){
 const row=document.createElement('div');row.className='catalog-row';
 const kind=document.createElement('select');kind.append(new Option('Standard','standard'),new Option('Premium','premium'));kind.value=type;
 const input=document.createElement('input');input.value=size;input.required=true;input.maxLength=50;input.placeholder='Size or portion';
 const del=document.createElement('button');del.type='button';del.textContent='×';del.onclick=()=>{if($('catalogSizes').children.length>1)row.remove();else note('Keep at least one size.');};
 row.append(kind,input,del);$('catalogSizes').append(row);
}
function open(item=null){
 selected=item?structuredClone(item):null;file=null;$('catalogUpload').value='';
 $('catalogTitle').textContent=item?'Edit '+item.name:'New Menu Product';
 $('catalogName').value=item?.name||'';
 if(item?.category&&!Array.from($('catalogCategory').options).some(o=>o.value===item.category))$('catalogCategory').append(new Option(item.category,item.category));
 $('catalogCategory').value=item?.category||'';
 $('catalogFood').checked=!!item?.food;
 $('catalogSizes').replaceChildren();
 if(item){
  (item.sizes||[]).forEach(v=>addRow('standard',v));
  (item.premiumSizes||[]).forEach(v=>addRow('premium',v));
 }else{addRow('standard','16 oz');}
 const src=imageUrl(item?.image);$('catalogImage').hidden=!src;
 if(src)$('catalogImage').src=src;else $('catalogImage').removeAttribute('src');
 $('catalogForm').hidden=false;$('catalogForm').scrollIntoView({behavior:'smooth'});
}
async function uploadImage(input){
 if(!['image/jpeg','image/png','image/webp'].includes(input.type)||input.size>10000000)throw Error('Select a JPG, PNG or WebP picture smaller than 10MB.');
 const bmp=await createImageBitmap(input),ratio=Math.min(1,900/Math.max(bmp.width,bmp.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bmp.width*ratio);canvas.height=Math.round(bmp.height*ratio);
 const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
 const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',.82));
 if(!blob)throw Error('Picture compression failed.');
 await cloud.rpc('kbr_management_access',{});
 const token=cloud.session()?.access_token;if(!token)throw Error('Sign in again before uploading a picture.');
 const path=crypto.randomUUID()+'.jpg';
 const response=await fetch(cloud.config.url+'/storage/v1/object/kbr-menu-images/'+path,{
  method:'POST',headers:{apikey:cloud.config.key,Authorization:'Bearer '+token,'Content-Type':'image/jpeg'},body:blob
 });
 if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.message||'Picture upload failed.');}
 return cloud.config.url+'/storage/v1/object/public/kbr-menu-images/'+path;
}
async function saveMenu(ev){
 ev.preventDefault();if(working)return;
 if(role!=='owner'){note('Owner login is required to edit product details.');return;}
 if(cloud.read(pendingKey)){note('Please sync pending recipe edits before editing menu details.');return;}
 const rows=[...$('catalogSizes').children].map(row=>({type:row.querySelector('select').value,size:row.querySelector('input').value.trim()}));
 const std=rows.filter(x=>x.type==='standard').map(x=>x.size),premium=rows.filter(x=>x.type==='premium').map(x=>x.size);
 if(!std.length||rows.some(x=>!x.size)){note('Enter at least one standard size and valid size names.');return;}
 const name=$('catalogName').value.trim(),cat=$('catalogCategory').value;
 if(name.length<2||!cat){note('Choose a product name and category.');return;}
 if(new Set(std.map(x=>x.toLowerCase())).size!==std.length||new Set(premium.map(x=>x.toLowerCase())).size!==premium.length){note('Size names cannot be duplicated.');return;}
 if(!selected&&(!confirm('New products start Not Available with ₱1 placeholder prices. Set real prices and enable sizes from Manager Price Management before selling.')))return;
 working=true;$('catalogSave').disabled=true;
 try{
  let image=selected?.image||'';
  if(file){note('Uploading picture…');image=await uploadImage(file);}
  note('Saving catalog details and recipe size names…');
  const result=await cloud.rpc('kbr_recipe_save_menu_details',{
   p_product_id:selected?.productId||null,p_name:name,p_category:cat,p_image:image,
   p_food:$('catalogFood').checked||cat==='Snackies'||cat==='Ice Cream',
   p_sizes:std,p_premium_sizes:premium.length?premium:null,
   p_expected_menu_revision:menuRevision,p_expected_recipe_revision:recipeRevision
  });
  if(result.conflict){$('catalogForm').hidden=true;working=false;await reload();note('The menu or recipes changed on another device. Review and retry.');return;}
  if(!result.ok)throw Error('Server did not confirm the update.');
  $('catalogForm').hidden=true;await Promise.allSettled([refresh()]);
  working=false;await reload();note('Product details saved. For prices and availability, open Manager Price Management.');
 }catch(e){note(e.message||'Could not save product details.');}
 finally{working=false;$('catalogSave').disabled=false;}
}
trigger.addEventListener('click',async()=>{
 if(role!=='owner'){status('Sign in as shop owner to edit menu details.');return;}
 if(!online){status('Connect to the internet before changing shared menu details.');return;}
 outer.hidden=false;await reload();
});
$('catalogClose').onclick=()=>outer.hidden=true;
$('catalogCancel').onclick=()=>{$('catalogForm').hidden=true;file=null;};
$('catalogNew').onclick=()=>open();
$('catalogReload').onclick=reload;
$('catalogAddSize').onclick=()=>addRow('standard','');
$('catalogSearch').addEventListener('input',draw);
$('catalogFilter').addEventListener('change',draw);
$('catalogForm').addEventListener('submit',saveMenu);
$('catalogUpload').addEventListener('change',()=>{
 file=$('catalogUpload').files?.[0]||null;
 if(file){const src=URL.createObjectURL(file);$('catalogImage').src=src;$('catalogImage').hidden=false;$('catalogImage').onload=()=>URL.revokeObjectURL(src);}
});
})();
