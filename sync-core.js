'use strict';
window.KBRCloud=(()=>{
 const cfg=window.KBR_SYNC_CONFIG,sessionKey='kbr_cloud_session_v1';let refreshing=null;
 function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
 function session(){return read(sessionKey);}
 function storeSession(value){if(value){value.expires_at=Date.now()+(Number(value.expires_in)||3600)*1000;localStorage.setItem(sessionKey,JSON.stringify(value));}else localStorage.removeItem(sessionKey);}
 async function raw(path,options={},token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{
  const response=await fetch(cfg.url+path,{...options,signal:controller.signal,headers:{apikey:cfg.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...options.headers}});
  const body=await response.text();let data;try{data=body?JSON.parse(body):null;}catch{data=null;}
  if(!response.ok){const error=new Error(data?.message||data?.msg||data?.error_description||'Request failed ('+response.status+')');error.status=response.status;error.code=data?.code;throw error;}return data;
 }catch(error){if(error.name==='AbortError')throw new Error('Connection timed out. Your pending request is kept for retry.');throw error;}finally{clearTimeout(timer);}}
 async function refresh(){if(!refreshing)refreshing=(async()=>{const s=session();if(!s?.refresh_token)throw new Error('Please sign in.');try{const next=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})});storeSession(next);return next;}catch(e){if(e.status===400||e.status===401)storeSession(null);throw e;}})().finally(()=>refreshing=null);return refreshing;}
 async function request(path,options={}){let s=session();if(!s?.access_token)throw new Error('Please sign in.');if(s.expires_at<Date.now()+60000)s=await refresh();try{return await raw(path,options,s.access_token);}catch(e){if(e.status!==401)throw e;s=await refresh();return raw(path,options,s.access_token);}}
 async function login(email,password){const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});storeSession(s);try{await role();}catch(e){storeSession(null);throw e;}}
 async function role(){const rows=await request('/rest/v1/kbr_staff?select=role');if(!rows?.length)throw new Error('This login has not been added to kbr_staff. Run the staff access SQL.');return rows[0].role;}
 function requireLogin(){if(!session()){const next=location.pathname.split('/').pop()||'index.html';location.replace('sync-login.html?next='+encodeURIComponent(next));return false;}return true;}
 async function rpc(name,args){return request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)});}
 async function rows(path){const all=[];for(let offset=0;;offset+=500){const batch=await request(path+(path.includes('?')?'&':'?')+'limit=500&offset='+offset);all.push(...batch);if(batch.length<500)return all;}}
 function strip(order){const copy=structuredClone(order);delete copy._cloudId;delete copy._cloudRevision;return copy;}
 function uuid(){return crypto.randomUUID();}
 function bindStatus(){if(document.getElementById('cloudStatus'))return;const el=document.createElement('div');el.id='cloudStatus';el.className='cloud-status';el.setAttribute('role','status');el.textContent='Connecting…';document.body.append(el);}
 function status(text,problem=false){bindStatus();const el=document.getElementById('cloudStatus');el.textContent=text;el.classList.toggle('problem',problem);}
 function logout(){storeSession(null);location.href='sync-login.html';}
 return {read,session,request,rpc,rows,role,login,requireLogin,strip,uuid,status,logout,config:cfg};
})();
