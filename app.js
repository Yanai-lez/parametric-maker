import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {STLLoader} from './vendor/three/STLLoader.js';

const OSCAD='./vendor/openscad.js';
const FONTS=['Liberation Sans','Liberation Sans:style=Bold','Liberation Sans:style=Italic','Liberation Sans:style=Bold Italic'];
const FONT_FILES=['Regular','Bold','Italic','BoldItalic'];
let fileName='model';
const getBin=async u=>new Uint8Array(await (await fetch(u)).arrayBuffer());
let fontCache=null,libCache={};
async function fonts(){return fontCache||(fontCache=Promise.all(FONT_FILES.map(async f=>[f,await getBin(`./vendor/fonts/LiberationSans-${f}.ttf`)])));}
async function lib(name){
  if(!libCache[name])libCache[name]=(async()=>{
    const list=await (await fetch(`./libs/${name}/manifest.json`)).json();
    return Promise.all(list.map(async f=>[f,await getBin(`./libs/${name}/${f}`)]));
  })();
  return libCache[name];
}
const mkdirp=(FS,p)=>{let c='';for(const s of p.split('/').filter(Boolean)){c+='/'+s;try{FS.mkdir(c);}catch{}}};
async function runScad(code,log){
  const mod=await import(OSCAD);
  const fnt=await fonts();
  const libs=/\b(include|use)\s*<\s*BOSL2\//.test(code)?await lib('BOSL2'):null;
  const uploads=params.filter(p=>p.t==='file'&&p.file);
  const inst=await mod.default({noInitialRun:true,print:t=>log.push(t),printErr:t=>log.push(t),
    preRun:[m=>{
      m.ENV.FONTCONFIG_PATH='/fonts';m.ENV.OPENSCADPATH='/libraries';
      mkdirp(m.FS,'/fonts');mkdirp(m.FS,'/tmp/fc');
      for(const [f,d] of fnt)m.FS.writeFile(`/fonts/LiberationSans-${f}.ttf`,d);
      m.FS.writeFile('/fonts/fonts.conf','<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/tmp/fc</cachedir></fontconfig>');
      if(libs){mkdirp(m.FS,'/libraries/BOSL2');for(const [f,d] of libs)m.FS.writeFile(`/libraries/BOSL2/${f}`,d);}
      if(uploads.length){mkdirp(m.FS,'/uploads');for(const p of uploads)m.FS.writeFile('/uploads/'+safeName(p.file.name),p.file.data);}
    }]});
  inst.FS.writeFile('/in.scad',code);
  const args=['/in.scad','-o','/out.stl','--backend=manifold'];
  for(const p of params) if(p.dirty||(p.t==='file'&&p.file)) args.push(arg(p));
  await new Promise(r=>setTimeout(r,20));
  inst.callMain(args);
  return new Uint8Array(inst.FS.readFile('/out.stl'));
}
const $=s=>document.querySelector(s);

/* ---------- Customizer parser ---------- */
let params=[], parsedSrc=null;
function parse(src){
  const out=[];let group='General',depth=0,prev='';
  for(const raw of src.split('\n')){
    const l=raw.trim();
    const g=l.match(/^\/\*\s*\[(.+?)\]\s*\*\//);
    if(g&&depth===0){ if(g[1].trim().toLowerCase()==='hidden')break; group=g[1].trim();prev='';continue; }
    if(depth===0){
      const m=l.match(/^(\$?[A-Za-z_]\w*)\s*=\s*([^;]+?)\s*;\s*(?:\/\/\s*(.*))?$/);
      if(m){ out.push(mk(m[1],m[2],m[3]||'',prev,group)); prev=''; }
      else prev=l.startsWith('//')?l.slice(2).trim():'';
    }
    const code=l.replace(/"(?:[^"\\]|\\.)*"/g,'').replace(/\/\/.*$/,'');
    for(const c of code){ if(c==='{')depth++; else if(c==='}')depth--; }
  }
  return out;
}
function sel(s){
  return s.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{
    const i=x.indexOf(':'); return i<0?{v:x.replace(/^"|"$/g,''),l:x.replace(/^"|"$/g,'')}:{v:x.slice(0,i).replace(/^"|"$/g,''),l:x.slice(i+1)};
  });
}
function mk(name,val,cm,desc,group){
  const p={name,desc,group,dirty:false};
  const o=cm.match(/^\[(.*)\]/); const opts=o?o[1].trim():null;
  if(/^(true|false)$/.test(val)){p.t='bool';p.v=val==='true';}
  else if(/^".*"$/.test(val)){
    p.v=val.slice(1,-1);
    if(/^color\b/.test(cm)&&/^#[0-9a-f]{6}$/i.test(p.v)){p.t='color';}
    else if(/^font\b/.test(cm)){p.t='font';}
    else if(/^default\.(png|svg|stl)$/i.test(p.v)){p.t='file';p.file=null;}
    else if(opts!==null){p.t='sel';p.isStr=true;p.o=sel(opts);} else p.t='str';
  }
  else if(/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(val)){
    p.v=+val;
    if(opts!==null){
      if(/^-?[\d.]+(:-?[\d.]+){1,2}$/.test(opts)){
        const a=opts.split(':').map(Number);p.t='num';
        if(a.length===2){p.min=a[0];p.max=a[1];p.step=Number.isInteger(p.v)?1:0.1;}
        else{p.min=a[0];p.step=a[1];p.max=a[2];}
      } else {p.t='sel';p.o=sel(opts);}
    } else p.t='numfree';
  }
  else {p.t='raw';p.v=val;}
  return p;
}
const safeName=n=>String(n).replace(/[^\w.-]/g,'_');
function arg(p){
  let v=p.v;
  if(p.t==='file') v=p.file?'/uploads/'+safeName(p.file.name):p.v;
  if(['str','color','font','file'].includes(p.t)||(p.t==='sel'&&p.isStr)) v='"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  return `-D${p.name}=${v}`;
}

/* ---------- Parameter UI ---------- */
function build(){
  const old=new Map(params.map(p=>[p.name+p.t,p]));
  params=parse($('#code').value);
  parsedSrc=$('#code').value;
  for(const p of params){const o=old.get(p.name+p.t);if(o&&o.dirty){p.v=o.v;p.dirty=true;if(o.file)p.file=o.file;}}
  const box=$('#plist');box.innerHTML='';
  if(!params.length){const d=document.createElement('p');d.className='d';d.textContent='No parameters found. The model is built from the code as is.';box.append(d);return;}
  let g=null;
  for(const p of params){
    if(p.group!==g){g=p.group;const h=document.createElement('h3');h.textContent=g;box.append(h);}
    const r=document.createElement('div');r.className='row';
    const lab=document.createElement('label');
    const nm=document.createElement('span');nm.textContent=p.name.replace(/_/g,' ');
    const vl=document.createElement('span');vl.style.color='var(--mut)';
    lab.append(nm,vl);r.append(lab);
    if(p.desc){const d=document.createElement('div');d.className='d';d.textContent=p.desc;r.append(d);}
    let el;
    const touch=()=>{p.dirty=true;schedule();};
    if(p.t==='bool'){el=document.createElement('input');el.type='checkbox';el.checked=p.v;el.onchange=()=>{p.v=el.checked;touch();};}
    else if(p.t==='num'){el=document.createElement('input');el.type='range';el.min=p.min;el.max=p.max;el.step=p.step;el.value=p.v;vl.textContent=p.v;
      el.oninput=()=>{p.v=+el.value;vl.textContent=el.value;touch();};}
    else if(p.t==='numfree'){el=document.createElement('input');el.type='number';el.step='any';el.inputMode='decimal';el.value=p.v;
      el.oninput=()=>{if(el.value!==''){p.v=+el.value;touch();}};}
    else if(p.t==='sel'){el=document.createElement('select');
      for(const o of p.o){const op=document.createElement('option');op.value=o.v;op.textContent=o.l;if(String(o.v)===String(p.v))op.selected=true;el.append(op);}
      el.onchange=()=>{p.v=el.value;touch();};}
    else if(p.t==='color'){el=document.createElement('input');el.type='color';el.value=p.v;el.oninput=()=>{p.v=el.value;vl.textContent=el.value;touch();};vl.textContent=p.v;}
    else if(p.t==='font'){el=document.createElement('select');
      const list=FONTS.includes(p.v)?FONTS:[p.v,...FONTS];
      for(const f of list){const op=document.createElement('option');op.value=f;op.textContent=FONTS.includes(f)?f:f+' (falls back to Liberation Sans)';if(f===p.v)op.selected=true;el.append(op);}
      el.onchange=()=>{p.v=el.value;touch();};}
    else if(p.t==='file'){el=document.createElement('input');el.type='file';vl.textContent=p.file?p.file.name:p.v+' (tap to upload)';
      if(p.v.toLowerCase().endsWith('.svg'))el.accept='.svg,image/svg+xml';else if(p.v.toLowerCase().endsWith('.stl'))el.accept='.stl';else el.accept='.png,image/png';
      el.onchange=async()=>{const f=el.files[0];if(!f)return;p.file={name:f.name,data:new Uint8Array(await f.arrayBuffer())};vl.textContent=f.name;touch();};}
    else {el=document.createElement('input');el.type='text';el.value=p.v;el.oninput=()=>{p.v=el.value;touch();};}
    r.append(el);box.append(r);
  }
}

/* ---------- 3D view ---------- */
const cv=$('#cv');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color(0x14171d);
const camera=new THREE.PerspectiveCamera(45,1,0.1,5000);camera.up.set(0,0,1);camera.position.set(80,-120,90);
scene.add(new THREE.HemisphereLight(0xffffff,0x334155,1.1));
const dl=new THREE.DirectionalLight(0xffffff,1.4);dl.position.set(1,-1,2);scene.add(dl);
let grid=new THREE.GridHelper(200,20,0x334155,0x232833);grid.rotation.x=Math.PI/2;scene.add(grid);
const controls=new OrbitControls(camera,cv);controls.enableDamping=true;
let mesh=null;
function resize(){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);
(function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);})();
function show(buf){
  const geo=new STLLoader().parse(buf);geo.computeVertexNormals();geo.computeBoundingBox();
  const b=geo.boundingBox;geo.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,-b.min.z);
  if(mesh){scene.remove(mesh);mesh.geometry.dispose();}
  mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x4f8cff,roughness:.55,metalness:.1}));
  scene.add(mesh);
  const s=new THREE.Vector3();b.getSize(s);
  const r=Math.max(s.length()/2,1);
  const dist=r/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.15;
  const dir=new THREE.Vector3(0.55,-0.8,0.6).normalize();
  controls.target.set(0,0,s.z/2);
  camera.position.copy(dir.multiplyScalar(dist)).add(controls.target);
  camera.near=r/100;camera.far=dist*20;camera.updateProjectionMatrix();
  const gs=Math.ceil(Math.max(s.x,s.y)*2.4/10)*10;
  scene.remove(grid);grid=new THREE.GridHelper(gs,gs/10,0x334155,0x232833);grid.rotation.x=Math.PI/2;scene.add(grid);
}

/* ---------- OpenSCAD ---------- */
let results=null;
let timer=null,busy=false,again=false,renderedSrc=null;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(true),500);}
async function render(auto){
  if(busy){again=true;return;}
  const st=$('#status'),src=$('#code').value;
  if(!src.trim()){st.textContent='No code yet. Paste or upload a file in the Code tab.';return;}
  if($('#code').value!==parsedSrc)build();
  const need=params.find(p=>p.t==='file'&&!p.file);
  if(need){st.textContent='Upload a file for "'+need.name.replace(/_/g,' ')+'" in the Parameters tab.';return;}
  busy=true;
  const btn=$('#btnRender');
  if(!auto)tab('view');btn.disabled=true;$('#btnDl').disabled=true;
  st.textContent='Updating model…';
  renderedSrc=src;
  const log=[];
  try{
    const plates=[...src.matchAll(/module\s+mw_plate_(\d+)\s*\(/g)].map(m=>+m[1]).sort((a,b)=>a-b);
    const asm=/module\s+mw_assembly_view\s*\(/.test(src);
    const jobs=plates.length?plates.map(n=>({id:'Plate '+n,call:`mw_plate_${n}();`,exp:true})):[{id:'Model',call:'',exp:true}];
    if(asm&&plates.length)jobs.unshift({id:'Assembly view',call:'mw_assembly_view();',exp:false});
    const res=[];
    for(const j of jobs){
      st.textContent=jobs.length>1?`Building ${j.id}…`:'Building model…';
      res.push({id:j.id,exp:j.exp,stl:await runScad(src+'\n'+j.call+'\n',log)});
    }
    results=res;
    const sel=$('#plateSel');
    const prev=sel.value;
    sel.innerHTML='';for(const r of res){const o=document.createElement('option');o.value=r.id;o.textContent=r.id;sel.append(o);}
    sel.style.display=res.length>1?'':'none';
    if(res.some(r=>r.id===prev))sel.value=prev;
    showSel();
    st.textContent='Done ✔ '+log.filter(l=>/ERROR|WARNING/.test(l)).join('\n');
    $('#btnDl').disabled=!res.some(r=>r.exp);
  }catch(e){
    st.textContent='Error:\n'+(log.join('\n')||e.message||e);
  }
  btn.disabled=false;busy=false;
  if(again){again=false;schedule();}
}
function showSel(){const r=results&&results.find(x=>x.id===$('#plateSel').value);if(r)show(r.stl.buffer.slice(0));}
$('#plateSel').onchange=showSel;
$('#btnRender').onclick=()=>render(false);
/* ---------- 3MF export ---------- */
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(files){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  for(const [name,text] of files){
    const n=enc.encode(name),d=enc.encode(text),crc=crc32(d);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
    h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,n.length,true);
    parts.push(new Uint8Array(h.buffer),n,d);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
    c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,n.length,true);c.setUint32(42,off,true);
    cd.push(new Uint8Array(c.buffer),n);
    off+=30+n.length+d.length;
  }
  let cdLen=0;for(const x of cd)cdLen+=x.length;
  const e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cdLen,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cd,new Uint8Array(e.buffer)],{type:'model/3mf'});
}
function meshOf(stlBuf){
  const pos=new STLLoader().parse(stlBuf).attributes.position.array;
  const map=new Map(),verts=[],tris=[];
  for(let i=0;i<pos.length;i+=3){
    const k=pos[i].toFixed(5)+','+pos[i+1].toFixed(5)+','+pos[i+2].toFixed(5);
    let id=map.get(k);if(id===undefined){id=verts.length/3;map.set(k,id);verts.push(pos[i],pos[i+1],pos[i+2]);}
    tris.push(id);
  }
  let v='',t='',minX=Infinity,maxX=-Infinity;
  for(let i=0;i<verts.length;i+=3){v+=`<vertex x="${+verts[i].toFixed(5)}" y="${+verts[i+1].toFixed(5)}" z="${+verts[i+2].toFixed(5)}"/>`;minX=Math.min(minX,verts[i]);maxX=Math.max(maxX,verts[i]);}
  for(let i=0;i<tris.length;i+=3)if(tris[i]!==tris[i+1]&&tris[i+1]!==tris[i+2]&&tris[i]!==tris[i+2])t+=`<triangle v1="${tris[i]}" v2="${tris[i+1]}" v3="${tris[i+2]}"/>`;
  return {v,t,minX,maxX};
}
function to3mf(list){
  let objs='',items='',x=0;
  list.forEach((r,i)=>{
    const m=meshOf(r.stl.buffer.slice(0)),id=i+1;
    objs+=`<object id="${id}" type="model" name="${r.id}"><mesh><vertices>${m.v}</vertices><triangles>${m.t}</triangles></mesh></object>`;
    const dx=i===0?0:x-m.minX;
    items+=`<item objectid="${id}"${dx?` transform="1 0 0 0 1 0 0 0 1 ${+dx.toFixed(3)} 0 0"`:''}/>`;
    x=(i===0?m.maxX:x+(m.maxX-m.minX))+10;
  });
  return zip([
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'],
    ['3D/3dmodel.model',`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${objs}</resources><build>${items}</build></model>`]
  ]);
}
function save(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
$('#btnDl').onclick=()=>{if(!results)return;const l=results.filter(r=>r.exp);if(l.length)save(to3mf(l),fileName+'.3mf');};
$('#btnSave').onclick=()=>{const t=$('#code').value;if(!t.trim())return;save(new Blob([t],{type:'text/plain'}),fileName+'.scad');};

/* ---------- Load code ---------- */
$('#btnUp').onclick=()=>$('#file').click();
$('#file').onchange=e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  fileName=f.name.replace(/\.[^.]*$/,'').replace(/[^\w.\- ]/g,'_')||'model';
  const r=new FileReader();
  r.onload=()=>{$('#code').value=String(r.result);params=[];build();tab('params');schedule();};
  r.onerror=()=>alert('Could not read the file');
  r.readAsText(f);
  e.target.value='';
};
$('#btnPaste').onclick=async()=>{
  try{
    const t=await navigator.clipboard.readText();
    if(t){$('#code').value=t;params=[];build();tab('params');schedule();}
  }catch{ $('#code').focus(); alert('Clipboard access was denied. Long-press in the code box and paste manually.'); }
};

/* ---------- Tabs ---------- */
function tab(t){
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id===t||(t==='params'&&p.id==='view')));
  $('#view').classList.toggle('mini',t==='params');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  if(t==='params'&&$('#code').value!==parsedSrc)build();
  if(t==='view'||t==='params')requestAnimationFrame(resize);
  if(t!=='codepane'&&$('#code').value.trim()&&$('#code').value!==renderedSrc)schedule();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));

$('#code').value='';build();tab('codepane');

/* ---------- PWA ---------- */
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
let installEv=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;$('#btnInstall').style.display='';});
$('#btnInstall').onclick=async()=>{if(!installEv)return;installEv.prompt();await installEv.userChoice;installEv=null;$('#btnInstall').style.display='none';};
addEventListener('appinstalled',()=>{$('#btnInstall').style.display='none';});
