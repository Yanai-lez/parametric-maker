import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {STLLoader} from './vendor/three/STLLoader.js';

const OSCAD='./vendor/openscad.js';
const $=s=>document.querySelector(s);
const SAMPLE=`/* [מידות] */
// אורך הקופסה
length = 40; // [10:100]
// רוחב
width = 30; // [10:100]
height = 15; // [5:60]
wall = 2; // [1:0.5:6]

/* [אפשרויות] */
rounded = true;
shape = "box"; // [box:קופסה, cyl:גליל]

/* [Hidden] */
$fn = 48;

if (shape == "box") {
  difference() {
    cube([length, width, height]);
    translate([wall, wall, wall]) cube([length-2*wall, width-2*wall, height]);
  }
} else {
  difference() {
    cylinder(d=length, h=height);
    translate([0,0,wall]) cylinder(d=length-2*wall, h=height);
  }
}
`;

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
  if(!params.length){const d=document.createElement('p');d.className='d';d.textContent='לא נמצאו פרמטרים. אפשר לרנדר את הקוד כמו שהוא.';box.append(d);return;}
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
    const touch=()=>{p.dirty=true;$('#status').textContent='הפרמטרים שונו. לחץ "רנדר"';};
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
async function render(){
  const btn=$('#btnRender'),st=$('#status');
  if($('#code').value!==parsedSrc)build();
  tab('view');btn.disabled=true;$('#btnDl').disabled=true;
  st.textContent='טוען מנוע (בפעם הראשונה זה לוקח כמה שניות)…';
  const log=[];
  try{
    const mod=await import(OSCAD);
    const api=await mod.createOpenSCAD({noInitialRun:true,print:t=>log.push(t),printErr:t=>log.push(t)});
    const inst=api.getInstance();
    inst.FS.writeFile('/in.scad',$('#code').value);
    const args=['/in.scad','-o','/out.stl'];
    for(const p of params) if(p.dirty) args.push(arg(p));
    st.textContent='מרנדר…';
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
  btn.disabled=false;
}
$('#btnRender').onclick=render;
$('#btnDl').onclick=()=>{
  if(!lastStl)return;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([lastStl],{type:'model/stl'}));
  a.download='model.stl';document.body.append(a);a.click();a.remove();
};

/* ---------- טעינת קוד ---------- */
$('#btnUp').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  $('#code').value=await f.text();params=[];build();tab('params');e.target.value='';try{localStorage.setItem('pm.code',$('#code').value);}catch{}
};
$('#btnPaste').onclick=async()=>{
  try{
    const t=await navigator.clipboard.readText();
    if(t){$('#code').value=t;params=[];build();tab('params');try{localStorage.setItem('pm.code',t);}catch{}}
  }catch{ $('#code').focus(); alert('הדפדפן לא אישר גישה ללוח. לחץ לחיצה ארוכה בתיבת הקוד והדבק ידנית.'); }
};

/* ---------- לשוניות ---------- */
function tab(t){
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id===t));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  if(t==='params'&&$('#code').value!==parsedSrc)build();
  if(t==='view')requestAnimationFrame(resize);
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.t));

let saved=null;try{saved=localStorage.getItem('pm.code');}catch{}
$('#code').value=saved||SAMPLE;build();
$('#code').addEventListener('input',()=>{try{localStorage.setItem('pm.code',$('#code').value);}catch{}});
