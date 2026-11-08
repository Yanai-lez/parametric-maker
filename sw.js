const CACHE='pm-shell-v5';
const SHELL=['./','index.html','style.css','app.js','manifest.webmanifest?v=4','logo.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// Receive files/text shared from other Android apps (Share -> Parametric Maker).
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='POST'&&u.origin===location.origin&&u.pathname.endsWith('/share-target')){
    e.respondWith((async()=>{
      try{
        const fd=await e.request.formData();
        const f=fd.getAll('scad').find(x=>x&&x.name!==undefined&&x.size>0);
        let name='',text='';
        if(f){name=f.name;text=await f.text();}
        else text=[fd.get('text'),fd.get('url')].filter(Boolean).join('\n');
        const c=await caches.open('pm-shared');
        await c.put('shared-scad',new Response(JSON.stringify({name,text}),{headers:{'content-type':'application/json'}}));
      }catch(err){}
      return Response.redirect('./?shared=1',303);
    })());
  }
});
// Network first (so updates always arrive), cache fallback (so it works offline after first visit).
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy));}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
