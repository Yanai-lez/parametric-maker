import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {STLLoader} from './vendor/three/STLLoader.js';

const OSCAD='./vendor/openscad.js';
const $=s=>document.querySelector(s);

/* ---------- פרסור Customizer ---------- */
let params=[], parsedSrc=null;
function parse(src){
  const out=[];let group='כללי',depth=0,prev='';
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
    if(opts!==null){p.t='sel';p.isStr=true;p.o=sel(opts);} else p.t='str';
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
function arg(p){
  let v=p.v;
  if(p.t==='str'||(p.t==='sel'&&p.isStr)) v='"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  return `-D${p.name}=${v}`;
}

/* ---------- בניית ממשק פרמטרים ---------- */
function build(){
  const old=new Map(params.map(p=>[p.name+p.t,p]));
  params=parse($('#code').value);
  parsedSrc=$('#code').value;
  for(const p of params){const o=old.get(p.name+p.t);if(o&&o.dirty){p.v=o.v;p.dirty=true;}}
  const box=$('#plist');box.innerHTML='';
  if(!params.length){const d=document.createElement('p');d.className='d';d.textContent='לא נמצאו פרמטרים. המודל נבנה מהקוד כמו שהוא.';box.append(d);return;}
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
    else {el=document.createElement('input');el.type='text';el.value=p.v;el.oninput=()=>{p.v=el.value;touch();};}
    r.append(el);box.append(r);
  }
}

/* ---------- תצוגה תלת־ממדית ---------- */
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

/* ---------- רינדור OpenSCAD ---------- */
let lastStl=null;
let timer=null,busy=false,again=false,renderedSrc=null;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(true),500);}
async function render(auto){
  if(busy){again=true;return;}
  if(!$('#code').value.trim()){$('#status').textContent='אין קוד. הדבק או העלה קובץ בלשונית "קוד".';return;}
  busy=true;
  const btn=$('#btnRender'),st=$('#status');
  if($('#code').value!==parsedSrc)build();
  if(!auto)tab('view');btn.disabled=true;$('#btnDl').disabled=true;
  st.textContent='מעדכן מודל…';
  renderedSrc=$('#code').value;
  const log=[];
  try{
    const mod=await import(OSCAD);
    const api=await mod.createOpenSCAD({noInitialRun:true,print:t=>log.push(t),printErr:t=>log.push(t)});
    const inst=api.getInstance();
    inst.FS.writeFile('/in.scad',$('#code').value);
    const args=['/in.scad','-o','/out.stl'];
    for(const p of params) if(p.dirty) args.push(arg(p));
    st.textContent='בונה את המודל…';
    await new Promise(r=>setTimeout(r,30));
    inst.callMain(args);
    const d=inst.FS.readFile('/out.stl');
    lastStl=new Uint8Array(d);
    show(lastStl.buffer.slice(0));
    st.textContent='הסתיים ✔ '+(log.filter(l=>!/^\s*(Could not initialize|Geometry cache|CGAL|Edges|Halffacets|Facets|Volumes|Vertices|Halfedges|Rendering|Simple|Top level|Total|Geometries|Current)/.test(l)).join('\n')||'');
    $('#btnDl').disabled=false;
  }catch(e){
    st.textContent='שגיאה:\n'+(log.join('\n')||e.message||e);
  }
  btn.disabled=false;busy=false;
  if(again){again=false;schedule();}
}
$('#btnRender').onclick=()=>render(false);
/* ---------- ייצוא 3MF ---------- */
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
function to3mf(stlBuf){
  const pos=new STLLoader().parse(stlBuf).attributes.position.array;
  const map=new Map(),verts=[],tris=[];
  for(let i=0;i<pos.length;i+=3){
    const k=pos[i].toFixed(5)+','+pos[i+1].toFixed(5)+','+pos[i+2].toFixed(5);
    let id=map.get(k);if(id===undefined){id=verts.length/3;map.set(k,id);verts.push(pos[i],pos[i+1],pos[i+2]);}
    tris.push(id);
  }
  let v='',t='';
  for(let i=0;i<verts.length;i+=3)v+=`<vertex x="${+verts[i].toFixed(5)}" y="${+verts[i+1].toFixed(5)}" z="${+verts[i+2].toFixed(5)}"/>`;
  for(let i=0;i<tris.length;i+=3)if(tris[i]!==tris[i+1]&&tris[i+1]!==tris[i+2]&&tris[i]!==tris[i+2])t+=`<triangle v1="${tris[i]}" v2="${tris[i+1]}" v3="${tris[i+2]}"/>`;
  return zip([
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'],
    ['3D/3dmodel.model',`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`]
  ]);
}
$('#btnDl').onclick=()=>{
  if(!lastStl)return;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(to3mf(lastStl.buffer.slice(0)));
  a.download='model.3mf';document.body.append(a);a.click();a.remove();
};

/* ---------- טעינת קוד ---------- */
$('#btnUp').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  $('#code').value=await f.text();params=[];build();tab('params');e.target.value='';schedule();
};
$('#btnPaste').onclick=async()=>{
  try{
    const t=await navigator.clipboard.readText();
    if(t){$('#code').value=t;params=[];build();tab('params');schedule();}
  }catch{ $('#code').focus(); alert('הדפדפן לא אישר גישה ללוח. לחץ לחיצה ארוכה בתיבת הקוד והדבק ידנית.'); }
};

/* ---------- לשוניות ---------- */
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
