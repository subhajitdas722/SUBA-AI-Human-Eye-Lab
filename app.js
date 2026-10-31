import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const stage=document.querySelector('#stage');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x081421);

const camera=new THREE.PerspectiveCamera(34,1,0.05,100);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=false;
stage.appendChild(renderer.domElement);

const labelLayer=document.createElement('div');
labelLayer.id='modelLabelLayer';
labelLayer.setAttribute('aria-hidden','true');
const labelSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
labelSvg.classList.add('model-label-lines');
labelLayer.appendChild(labelSvg);
stage.appendChild(labelLayer);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.055;
controls.enablePan=false;
controls.minDistance=3;
controls.maxDistance=15;

scene.add(new THREE.AmbientLight(0xffffff,0.55));
scene.add(new THREE.HemisphereLight(0xf1f6ff,0x273449,1.05));
const key=new THREE.DirectionalLight(0xfff5e9,3.0);key.position.set(4,6,7);scene.add(key);
const fill=new THREE.DirectionalLight(0xa8d9ed,1.25);fill.position.set(-5,1,4);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffb79a,1.4);rim.position.set(-4,3,-5);scene.add(rim);

const anatomyPivot=new THREE.Group();
const exteriorPivot=new THREE.Group();
scene.add(anatomyPivot,exteriorPivot);
exteriorPivot.visible=false;

const loader=new GLTFLoader();
let mode='anatomy';
let anatomyModel=null, exteriorModel=null;
let entities=[];
let exteriorEntities=[];
let labelItems=[];
let labelsEnabled=true;
let selected=null;
let exploded=false;
let normalCamera={position:new THREE.Vector3(6.2,1.2,4.3),target:new THREE.Vector3(0,0,0)};
let entityCenter=new THREE.Vector3(0,0,0);

const partDefinitions=[
 {label:'Cornea',nodes:['Cornea'],description:'Transparent curved front surface of the eye. It provides most of the eye’s refractive power.'},
 {label:'Iris',nodes:['iris'],description:'Pigmented diaphragm whose muscles regulate the diameter of the pupil.'},
 {label:'Pupil',nodes:[],description:'The opening in the iris. In this model it is represented in the iris assembly.'},
 {label:'Crystalline lens',nodes:['Lens'],description:'Transparent biconvex structure that fine-focuses light onto the retina.'},
 {label:'Suspensory ligaments',nodes:['Suspensory ligaments 1','Suspensory ligaments 2','Suspensory ligaments 3','Suspensory ligaments 4'],description:'Zonular fibres that connect the ciliary region to the lens capsule.'},
 {label:'Sclera',nodes:['Sclera'],description:'Tough outer coat that protects the eye and helps maintain its shape.'},
 {label:'Choroid',nodes:['Choroid'],description:'Vascular, pigmented layer between the sclera and retina.'},
 {label:'Muscle group 1',nodes:['Muscle 1'],description:'Muscle group represented in the source anatomical model. The source object is not more specifically identified.'},
 {label:'Muscle group 2',nodes:['Muscle 2'],description:'Muscle group represented in the source anatomical model. The source object is not more specifically identified.'},
 {label:'Retina',nodes:['Retina'],description:'Light-sensitive neural tissue lining the back of the eye.'},
 {label:'Artery',nodes:['Artery'],description:'Arterial vessel component included in the supplied anatomical model.'},
 {label:'Vein',nodes:['Vein'],description:'Venous vessel component included in the supplied anatomical model.'},
 {label:'Additional model components',nodes:['Cylinder.006','Cylinder.007','Cube.001','Cube.002','Cube.003','Cube.005'],description:'Additional geometry present in the source GLB. The source file does not provide more specific anatomical names for these objects.'}
];

function showMessage(message,isError=false){
 const el=document.querySelector('#loading');
 el.hidden=false;el.textContent=message;
 el.style.color=isError?'#ffb4a9':'#d3e2f0';
}
function resize(){
 const w=stage.clientWidth,h=stage.clientHeight;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
 labelSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 labelSvg.setAttribute('width',w);
 labelSvg.setAttribute('height',h);
}
window.addEventListener('resize',resize);resize();

function activeEntities(){
 return mode==='anatomy'?entities:exteriorEntities;
}
function buildModelLabels(){
 labelItems=[];
 labelLayer.querySelectorAll('.model-label').forEach(el=>el.remove());
 labelSvg.innerHTML='';
 const source=activeEntities();
 const anatomyOrder=['Cornea','Iris','Crystalline lens','Suspensory ligaments','Sclera','Choroid','Muscle group 1','Muscle group 2','Retina','Artery','Vein'];
 const ordered=mode==='anatomy'
  ? anatomyOrder.map(name=>source.find(entity=>entity.label===name)).filter(Boolean)
  : ['Eye body','Iris'].map(name=>source.find(entity=>entity.label===name)).filter(Boolean);
 ordered.forEach(entity=>{
  const el=document.createElement('div');
  el.className='model-label';
  el.textContent=entity.label;
  labelLayer.appendChild(el);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('stroke','rgba(108,220,211,.88)');
  line.setAttribute('stroke-width','1.4');
  line.setAttribute('stroke-linecap','round');
  labelSvg.appendChild(line);
  const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('r','3');
  dot.setAttribute('fill','#6bded4');
  dot.setAttribute('stroke','#09202b');
  dot.setAttribute('stroke-width','1');
  labelSvg.appendChild(dot);
  labelItems.push({entity,el,line,dot,point:new THREE.Vector3(),x:0,y:0,side:'left'});
 });
 updateModelLabels();
}
function updateModelLabels(){
 if(!labelsEnabled || !labelItems.length || !labelLayer.isConnected){
  labelLayer.style.display='none';
  return;
 }
 labelLayer.style.display='block';
 const width=stage.clientWidth,height=stage.clientHeight;
 const visible=[];
 labelItems.forEach(item=>{
  const isVisible=item.entity.objects.some(obj=>obj.visible);
  if(!isVisible){item.el.style.display='none';item.line.style.display='none';item.dot.style.display='none';return;}
  const box=new THREE.Box3();
  item.entity.objects.forEach(obj=>box.expandByObject(obj));
  if(box.isEmpty()){item.el.style.display='none';item.line.style.display='none';item.dot.style.display='none';return;}
  const center=box.getCenter(item.point);
  center.project(camera);
  if(center.z < -1 || center.z > 1){item.el.style.display='none';item.line.style.display='none';item.dot.style.display='none';return;}
  const x=(center.x*.5+.5)*width;
  const y=(-center.y*.5+.5)*height;
  if(x < -12 || x > width+12 || y < -12 || y > height+12){item.el.style.display='none';item.line.style.display='none';item.dot.style.display='none';return;}
  item.x=x;item.y=y;item.side=x<width*.5?'left':'right';
  visible.push(item);
 });
 const left=visible.filter(x=>x.side==='left').sort((a,b)=>a.y-b.y);
 const right=visible.filter(x=>x.side==='right').sort((a,b)=>a.y-b.y);
 const labelWidth=width<600?112:136;
 const columnX={left:8,right:Math.max(8,width-labelWidth-8)};
 for(const [side,items] of [['left',left],['right',right]]){
  if(!items.length)continue;
  const top=16,bottom=height-16;
  const gap=Math.min(30,(bottom-top)/Math.max(1,items.length-1));
  const ys=items.map(item=>THREE.MathUtils.clamp(item.y,top,bottom));
  for(let i=1;i<ys.length;i++)ys[i]=Math.max(ys[i],ys[i-1]+gap);
  if(ys[ys.length-1]>bottom){
   const shift=ys[ys.length-1]-bottom;
   for(let i=0;i<ys.length;i++)ys[i]-=shift;
  }
  for(let i=ys.length-2;i>=0;i--)ys[i]=Math.min(ys[i],ys[i+1]-gap);
  if(ys[0]<top){
   const shift=top-ys[0];
   for(let i=0;i<ys.length;i++)ys[i]+=shift;
  }
  items.forEach((item,i)=>{
   const x=columnX[side],y=ys[i];
   item.el.style.display='block';
   item.el.style.left=x+'px';
   item.el.style.top=(y-12)+'px';
   item.el.style.width=labelWidth+'px';
   const labelEdge=side==='left'?x+labelWidth:x;
   item.line.style.display='block';
   item.line.setAttribute('x1',labelEdge);
   item.line.setAttribute('y1',y);
   item.line.setAttribute('x2',item.x);
   item.line.setAttribute('y2',item.y);
   item.dot.style.display='block';
   item.dot.setAttribute('cx',item.x);
   item.dot.setAttribute('cy',item.y);
  });
 }
}


function cloneMeshMaterials(model){
 model.traverse(o=>{
  if(!o.isMesh)return;
  o.frustumCulled=false;
  o.castShadow=false;o.receiveShadow=false;
  if(o.geometry?.attributes?.position&&!o.geometry.attributes.normal){
   o.geometry.computeVertexNormals();
  }
  const source=Array.isArray(o.material)?o.material:[o.material];
  const clones=source.map(m=>{
   const c=m.clone();
   c.userData.baseOpacity=c.opacity;
   c.userData.baseTransparent=c.transparent;
   c.userData.baseDepthWrite=c.depthWrite;
   if(c.map)c.map.colorSpace=THREE.SRGBColorSpace;
   if(c.normalMap)c.normalScale.multiplyScalar(0.85);
   return c;
  });
  o.material=Array.isArray(o.material)?clones:clones[0];
 });
}
function normalizeModel(model,fitObjects=null,targetSize=3.6){
 model.updateMatrixWorld(true);
 const fitBox=new THREE.Box3();
 const objects=fitObjects?.length?fitObjects:[model];
 for(const obj of objects)fitBox.expandByObject(obj);
 if(fitBox.isEmpty())throw new Error('The GLB has no renderable geometry.');
 const size=fitBox.getSize(new THREE.Vector3());
 const center=fitBox.getCenter(new THREE.Vector3());
 const scale=targetSize/Math.max(size.x,size.y,size.z,0.001);
 model.scale.setScalar(scale);
 model.position.copy(center).multiplyScalar(-scale);
 model.updateMatrixWorld(true);
 return {center,scale,size};
}
function parseGLB(buffer,path='./models/'){
 return new Promise((resolve,reject)=>loader.parse(buffer,path,resolve,reject));
}
async function loadGzipGLB(url){
 const response=await fetch(url,{cache:'no-cache'});
 if(!response.ok)throw new Error('HTTP '+response.status+' while fetching '+url);
 if(!('DecompressionStream' in window))throw new Error('This browser cannot decompress the optimised GLB. Please use an up-to-date Chrome or Edge browser.');
 const compressed=await response.arrayBuffer();
 const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=await new Response(stream).arrayBuffer();
 return await parseGLB(decoded,'./models/');
}
function getRootNode(model){
 let found=null;
 model.traverse(o=>{if(!found&&o.name==='RootNode')found=o;});
 return found||model;
}
function getNamedChild(root,name){
 return root.children.find(o=>o.name===name)||null;
}
function buildEntities(root){
 const built=[];
 for(const def of partDefinitions){
  const objects=def.nodes.map(n=>getNamedChild(root,n)).filter(Boolean);
  if(objects.length)built.push({...def,objects,visible:objects.some(o=>o.visible),basePositions:new Map(objects.map(o=>[o,o.position.clone()]))});
 }
 return built;
}
function computeGroupFitObjects(root){
 const names=['Cornea','iris','Lens','Suspensory ligaments 1','Suspensory ligaments 2','Suspensory ligaments 3','Suspensory ligaments 4','Sclera','Choroid','Muscle 1','Muscle 2','Retina'];
 return names.map(n=>getNamedChild(root,n)).filter(Boolean);
}
function setupAnatomy(gltf){
 const model=gltf.scene;
 const root=getRootNode(model);
 // Strip non-rendering Sketchfab camera/point helpers; keep all anatomical geometry.
 for(const n of ['Camera','Point','Point.001']){
  const helper=getNamedChild(root,n);
  if(helper)helper.removeFromParent();
 }
 cloneMeshMaterials(model);
 entities=buildEntities(root);
 const fitObjects=computeGroupFitObjects(root);
 const fitted=normalizeModel(model,fitObjects,3.55);
 entityCenter.set(0,0,0);
 anatomyPivot.clear();anatomyPivot.add(model);
 model.updateMatrixWorld(true);
 return {model,root,fitted};
}
function fitExterior(gltf){
 const model=gltf.scene;
 cloneMeshMaterials(model);
 normalizeModel(model,null,3.45);
 exteriorPivot.clear();exteriorPivot.add(model);
 let eyeBody=null,iris=null;
 model.traverse(obj=>{
  if(obj.isMesh && obj.name==='Eye_Eye_0')eyeBody=obj;
  if(obj.isMesh && obj.name==='Eye_Iris_0')iris=obj;
 });
 exteriorEntities=[
  ...(eyeBody?[{label:'Eye body',objects:[eyeBody],description:'Main exterior eye-body mesh from the DEGUIDER Sketchfab model. The source GLB does not separate the cornea and sclera into their own meshes.'}]:[]),
  ...(iris?[{label:'Iris',objects:[iris],description:'Iris mesh from the DEGUIDER Sketchfab exterior model.'}]:[])
 ];
 return model;
}
function applyEntityOpacity(entity,value){
 entity.objects.forEach(group=>group.traverse(o=>{
  if(!o.isMesh)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  mats.forEach(m=>{
   const base=m.userData.baseOpacity??1;
   const baseTransparent=m.userData.baseTransparent??false;
   m.opacity=base*value;
   m.transparent=baseTransparent||value<0.999;
   m.depthWrite=value>=0.999?(m.userData.baseDepthWrite??true):false;
   m.needsUpdate=true;
  });
 }));
}
function entityIsVisible(entity){return entity.objects.every(o=>o.visible);}
function setEntityVisible(entity,visible){entity.objects.forEach(o=>o.visible=visible);entity.visible=visible;}
function selectEntity(entity){
 selected=entity;
 document.querySelectorAll('.structure').forEach(row=>row.classList.toggle('selected',row.dataset.entity===entity?.label));
 document.querySelector('#selectedName').textContent=entity?entity.label:'Select a structure';
 document.querySelector('#selectedDesc').textContent=entity?entity.description:'Choose a structure to highlight it and view its controls.';
 document.querySelector('#opacity').value=100;
 document.querySelector('#opacityValue').textContent='100%';
}
function buildList(){
 const list=document.querySelector('#structureList');list.innerHTML='';
 activeEntities().forEach(entity=>{
  const row=document.createElement('div');row.className='structure';row.dataset.entity=entity.label;
  const eye=document.createElement('input');eye.type='checkbox';eye.checked=entityIsVisible(entity);eye.title='Show or hide';
  eye.onchange=()=>setEntityVisible(entity,eye.checked);
  const label=document.createElement('span');label.className='name';label.textContent=entity.label;label.onclick=()=>selectEntity(entity);
  const focus=document.createElement('button');focus.textContent='Focus';
  focus.onclick=()=>{
   entities.forEach(e=>setEntityVisible(e,e===entity));
   focusEntity(entity);selectEntity(entity);buildList();
  };
  row.append(eye,label,focus);list.append(row);
 });
}
function focusEntity(entity){
 const box=new THREE.Box3();
 entity.objects.forEach(o=>box.expandByObject(o));
 if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3());
 const size=box.getSize(new THREE.Vector3());
 const direction=camera.position.clone().sub(controls.target).normalize();
 const distance=Math.max(3.4,Math.max(size.x,size.y,size.z)*2.7);
 controls.target.copy(center);
 camera.position.copy(center).add(direction.multiplyScalar(distance));
 controls.update();
}
function resetAnatomy(){
 entities.forEach(entity=>{
  entity.objects.forEach(o=>{o.visible=true;const base=entity.basePositions.get(o);if(base)o.position.copy(base);});
  entity.visible=true;
 });
 exploded=false;buildList();selectEntity(null);
 controls.target.set(0,0,0);
 camera.position.copy(normalCamera.position);
 controls.update();
}
function setMode(next){
 mode=next;
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 document.querySelector('#modeTitle').textContent=mode==='anatomy'?'Human eye cross-section':'Exterior view';
 anatomyPivot.visible=mode==='anatomy';exteriorPivot.visible=mode==='exterior';
 if(mode==='anatomy')buildList();
 else document.querySelector('#structureList').innerHTML='<p class="hint">Exterior model by DEGUIDER. Switch back to Anatomy to inspect the supplied 54-mesh cross-section model.</p>';
 selectEntity(null);
 controls.target.set(0,0,0);
 camera.position.copy(mode==='anatomy'?normalCamera.position:new THREE.Vector3(0,0.8,7.2));
 controls.update();
}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
const labelToggle=document.querySelector('#showLabels');
if(labelToggle){
 labelToggle.setAttribute('aria-pressed','true');
 labelToggle.onclick=()=>{
  labelsEnabled=!labelsEnabled;
  labelToggle.textContent=labelsEnabled?'Hide labels':'Show labels';
  labelToggle.setAttribute('aria-pressed',String(labelsEnabled));
  updateModelLabels();
 };
}
document.querySelector('#search').oninput=e=>{
 const q=e.target.value.toLowerCase();
 document.querySelectorAll('.structure').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'flex':'none');
};
document.querySelector('#opacity').oninput=e=>{
 if(!selected)return;
 const v=Number(e.target.value)/100;
 applyEntityOpacity(selected,v);
 document.querySelector('#opacityValue').textContent=e.target.value+'%';
};
document.querySelector('#hideSelected').onclick=()=>{
 if(selected){setEntityVisible(selected,false);selectEntity(null);buildList();}
};
document.querySelector('#showAll').onclick=()=>{
 activeEntities().forEach(e=>setEntityVisible(e,true));
 buildList();selectEntity(null);
};
document.querySelector('#isolate').onclick=()=>{
 if(selected){activeEntities().forEach(e=>setEntityVisible(e,e===selected));buildList();}
};
document.querySelector('#reset').onclick=()=>{
 if(mode==='anatomy')resetAnatomy();
 else {exteriorEntities.forEach(e=>setEntityVisible(e,true));buildList();selectEntity(null);controls.target.set(0,0,0);camera.position.set(0,0.8,7.2);controls.update();}
 buildModelLabels();
};
document.querySelector('#explode').onclick=()=>{
 if(mode!=='anatomy')return;
 exploded=!exploded;
 const allBox=new THREE.Box3();entities.forEach(e=>e.objects.forEach(o=>allBox.expandByObject(o)));
 const center=allBox.getCenter(new THREE.Vector3());
 entities.forEach((entity,index)=>{
  entity.objects.forEach(o=>{
   const base=entity.basePositions.get(o);if(!base)return;
   if(!exploded){o.position.copy(base);return;}
   const box=new THREE.Box3().setFromObject(o);
   const dir=box.getCenter(new THREE.Vector3()).sub(center);
   if(dir.lengthSq()<1e-6)dir.set((index%3)-1,((index+1)%3)-1,((index+2)%3)-1);
   dir.normalize();
   const shiftWorld=dir.multiplyScalar(0.09);
   const parent=o.parent;
   const worldOrigin=o.getWorldPosition(new THREE.Vector3());
   const shifted=worldOrigin.add(shiftWorld);
   parent.updateWorldMatrix(true,false);
   parent.worldToLocal(shifted);
   o.position.copy(shifted);
  });
 });
};

async function start(){
 try{
  showMessage('Loading optimised human-eye cross-section…');
  const gltf=await loadGzipGLB('./models/eye-cross-section.glb.gz');
  anatomyModel=setupAnatomy(gltf);
  buildList();
  document.querySelector('#loading').hidden=true;
  resetAnatomy();
  buildModelLabels();
 }catch(e){
  console.error('Cross-section model load failed:',e);
  showMessage('Could not load eye-cross-section.glb.gz. Upload the compressed GLB into the models folder, then refresh. '+(e?.message||e),true);
 }
 try{
  const gltf=await loader.loadAsync('./models/human_eye.glb');
  exteriorModel=fitExterior(gltf);
  if(mode==='exterior'){buildList();buildModelLabels();}
 }catch(e){
  console.warn('Exterior model could not be loaded:',e);
 }
}
function animate(){requestAnimationFrame(animate);controls.update();updateModelLabels();renderer.render(scene,camera);}
start();
animate();
