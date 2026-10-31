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
labelLayer.setAttribute('role','group');
labelLayer.setAttribute('aria-label','Interactive anatomical model labels');
const labelSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
labelSvg.classList.add('model-label-lines');
labelSvg.setAttribute('aria-hidden','true');
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
 if(typeof layoutModelLabels==='function')layoutModelLabels();
}
window.addEventListener('resize',resize);resize();

function activeEntities(){
 return mode==='anatomy'?entities:exteriorEntities;
}
function modelRootForMode(){
 return mode==='anatomy'?anatomyModel?.model:exteriorModel;
}
function isEffectivelyVisible(object,stopAt){
 let current=object;
 while(current && current!==stopAt){
  if(!current.visible)return false;
  current=current.parent;
 }
 return true;
}
function createStableAnchor(entity){
 const box=new THREE.Box3();
 entity.objects.forEach(object=>box.expandByObject(object));
 if(box.isEmpty())return null;
 const worldCenter=box.getCenter(new THREE.Vector3());
 const modelRoot=modelRootForMode();
 if(!modelRoot)return null;
 // A single named group gets its own child anchor so the pin follows that
 // structure if it is moved by the explode control. Multi-object groups use
 // the model root to keep their combined centre stable.
 const parent=entity.objects.length===1?entity.objects[0]:modelRoot;
 parent.updateWorldMatrix(true,true);
 const localCenter=parent.worldToLocal(worldCenter.clone());
 const anchor=new THREE.Object3D();
 anchor.name='label-anchor-'+entity.label.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
 anchor.position.copy(localCenter);
 parent.add(anchor);
 return anchor;
}
function buildModelLabels(){
 labelItems=[];
 labelLayer.querySelectorAll('.anatomy-callout').forEach(el=>el.remove());
 labelSvg.innerHTML='';
 const source=activeEntities();
 const anatomyOrder=['Cornea','Iris','Crystalline lens','Suspensory ligaments','Sclera','Choroid','Muscle group 1','Muscle group 2','Retina','Artery','Vein'];
 const ordered=mode==='anatomy'
  ? anatomyOrder.map(name=>source.find(entity=>entity.label===name)).filter(Boolean)
  : ['Eye body','Iris'].map(name=>source.find(entity=>entity.label===name)).filter(Boolean);
 ordered.forEach((entity,index)=>{
  const el=document.createElement('button');
  el.type='button';
  el.className='anatomy-callout';
  el.setAttribute('aria-label','Locate '+entity.label);
  const roleNames={
   'Cornea':'REFRACTIVE SURFACE','Iris':'LIGHT CONTROL','Crystalline lens':'FOCUSING',
   'Suspensory ligaments':'ACCOMMODATION','Sclera':'OUTER COAT','Choroid':'VASCULAR LAYER',
   'Muscle group 1':'MUSCLE GROUP','Muscle group 2':'MUSCLE GROUP','Retina':'SENSORY LAYER',
   'Artery':'BLOOD SUPPLY','Vein':'BLOOD SUPPLY','Eye body':'EXTERIOR MESH'
  };
  const kicker=roleNames[entity.label]||'ANATOMICAL PART';
  el.innerHTML='<span class="callout-index">'+String(index+1).padStart(2,'0')+'</span><span class="callout-copy"><span class="callout-kicker"></span><span class="callout-title"></span></span><span class="callout-chevron">↗</span>';
  el.querySelector('.callout-kicker').textContent=kicker;
  el.querySelector('.callout-title').textContent=entity.label;
  el.addEventListener('click',()=>{selectEntity(entity);focusEntity(entity);});
  el.addEventListener('pointerenter',()=>{
   el.classList.add('is-hovered');
   if(selected!==entity)setEntityHighlight(entity,true);
  });
  el.addEventListener('pointerleave',()=>{
   el.classList.remove('is-hovered');
   if(selected!==entity)setEntityHighlight(entity,false);
  });
  labelLayer.appendChild(el);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('class','callout-connector');labelSvg.appendChild(path);
  const halo=document.createElementNS('http://www.w3.org/2000/svg','circle');
  halo.setAttribute('class','callout-anchor-halo');halo.setAttribute('r','6');labelSvg.appendChild(halo);
  const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('class','callout-anchor-dot');dot.setAttribute('r','2.4');labelSvg.appendChild(dot);
  labelItems.push({
   entity,el,path,halo,dot,anchorNode:createStableAnchor(entity),
   side:'left',screenX:0,screenY:0,layoutX:0,layoutY:0,
   visible:false,index
  });
 });
 layoutModelLabels();
 updateModelLabels(1);
}
function layoutModelLabels(){
 if(!labelItems.length)return;
 const width=stage.clientWidth,height=stage.clientHeight;
 const compact=width<720;
 const cardWidth=compact?120:158;
 const cardHeight=compact?30:36;
 const edgeGap=compact?6:12;
 camera.updateMatrixWorld(true);
 labelItems.forEach(item=>{
  if(!item.anchorNode)return;
  const p=item.anchorNode.getWorldPosition(new THREE.Vector3()).project(camera);
  item.side=p.x<0?'left':'right';
 });
 const groups={
  left:labelItems.filter(item=>item.side==='left').sort((a,b)=>a.index-b.index),
  right:labelItems.filter(item=>item.side==='right').sort((a,b)=>a.index-b.index)
 };
 for(const side of ['left','right']){
  const items=groups[side];
  const top=22,bottom=Math.max(top+1,height-22);
  items.forEach((item,index)=>{
   item.layoutX=side==='left'?edgeGap:Math.max(edgeGap,width-cardWidth-edgeGap);
   item.layoutY=items.length===1?(top+bottom)/2:top+(bottom-top)*index/(items.length-1);
   item.cardWidth=cardWidth;item.cardHeight=cardHeight;
   item.el.style.left=item.layoutX+'px';
   item.el.style.top=(item.layoutY-cardHeight/2)+'px';
   item.el.style.width=cardWidth+'px';
  });
 }
}
function updateModelLabels(dt=1/60){
 if(!labelsEnabled || !labelItems.length || !labelLayer.isConnected){
  labelLayer.style.display='none';return;
 }
 labelLayer.style.display='block';
 const width=stage.clientWidth,height=stage.clientHeight;
 const stopAt=modelRootForMode();
 camera.updateMatrixWorld(true);
 // One smooth exponential interpolation makes the connector ends settle
 // naturally without expensive raycasts or layout reflow.
 const alpha=1-Math.exp(-18*Math.min(Math.max(dt,0),0.05));
 labelItems.forEach(item=>{
  const entityVisible=item.entity.objects.some(obj=>isEffectivelyVisible(obj,stopAt));
  if(!entityVisible || !item.anchorNode){
   item.el.style.display='none';item.path.style.display='none';
   item.halo.style.display='none';item.dot.style.display='none';return;
  }
  const projected=item.anchorNode.getWorldPosition(new THREE.Vector3()).project(camera);
  if(projected.z<-1 || projected.z>1 || projected.x<-1.08 || projected.x>1.08 || projected.y<-1.08 || projected.y>1.08){
   item.el.style.display='none';item.path.style.display='none';
   item.halo.style.display='none';item.dot.style.display='none';return;
  }
  const targetX=(projected.x*0.5+0.5)*width;
  const targetY=(-projected.y*0.5+0.5)*height;
  if(!item.visible){
   item.screenX=targetX;item.screenY=targetY;item.visible=true;
  }else{
   item.screenX+=(targetX-item.screenX)*alpha;
   item.screenY+=(targetY-item.screenY)*alpha;
  }
  const anchorX=item.screenX,anchorY=item.screenY;
  item.el.style.display='grid';
  item.el.classList.toggle('is-active',item.entity===selected);
  item.el.style.transform='translate3d(0,0,0)';
  const cardWidth=item.cardWidth||158;
  const cardHeight=item.cardHeight||36;
  const cardX=item.layoutX,cardY=item.layoutY;
  const edgeX=item.side==='left'?cardX+cardWidth:cardX;
  const edgeY=cardY+cardHeight/2;
  const bendX=anchorX+(edgeX-anchorX)*0.55;
  const curve='M '+anchorX.toFixed(2)+' '+anchorY.toFixed(2)+
    ' C '+bendX.toFixed(2)+' '+anchorY.toFixed(2)+
    ' '+bendX.toFixed(2)+' '+edgeY.toFixed(2)+
    ' '+edgeX.toFixed(2)+' '+edgeY.toFixed(2);
  item.path.setAttribute('d',curve);item.path.style.display='block';
  item.path.classList.toggle('is-active',item.entity===selected);
  item.halo.setAttribute('cx',anchorX);item.halo.setAttribute('cy',anchorY);
  item.dot.setAttribute('cx',anchorX);item.dot.setAttribute('cy',anchorY);
  item.halo.style.display='block';item.dot.style.display='block';
  item.halo.classList.toggle('is-active',item.entity===selected);
  item.dot.classList.toggle('is-active',item.entity===selected);
 });
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
   if(c.emissive){c.userData.baseEmissive=c.emissive.clone();c.userData.baseEmissiveIntensity=c.emissiveIntensity;}
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
function setEntityHighlight(entity,enabled){
 if(!entity)return;
 entity.objects.forEach(root=>root.traverse(object=>{
  if(!object.isMesh)return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  materials.forEach(material=>{
   if(!material.emissive)return;
   if(enabled){
    material.emissive.set(0x43c9c0);
    material.emissiveIntensity=0.24;
   }else{
    material.emissive.copy(material.userData.baseEmissive||new THREE.Color(0x000000));
    material.emissiveIntensity=material.userData.baseEmissiveIntensity??0;
   }
   material.needsUpdate=true;
  });
 }));
}
function selectEntity(entity){
 if(selected)setEntityHighlight(selected,false);
 selected=entity;
 if(selected)setEntityHighlight(selected,true);
 document.querySelectorAll('.structure').forEach(row=>row.classList.toggle('selected',row.dataset.entity===entity?.label));
 document.querySelectorAll('.anatomy-callout').forEach(el=>el.classList.toggle('is-active',el.getAttribute('aria-label')==='Locate '+entity?.label));
 document.querySelector('#selectedName').textContent=entity?entity.label:'Select a structure';
 document.querySelector('#selectedDesc').textContent=entity?entity.description:'Choose a structure or a model label to read about it.';
 document.querySelector('#opacity').value=100;
 document.querySelector('#opacityValue').textContent='100%';
}
function buildList(){
 const list=document.querySelector('#structureList');list.innerHTML='';
 activeEntities().forEach(entity=>{
  const row=document.createElement('div');row.className='structure';row.dataset.entity=entity.label;
  const eye=document.createElement('input');eye.type='checkbox';eye.checked=entityIsVisible(entity);eye.title='Show or hide';
  eye.onchange=()=>{setEntityVisible(entity,eye.checked);updateModelLabels(true);};
  const label=document.createElement('span');label.className='name';label.textContent=entity.label;label.onclick=()=>selectEntity(entity);
  const focus=document.createElement('button');focus.textContent='Focus';
  focus.onclick=()=>{
   activeEntities().forEach(e=>setEntityVisible(e,e===entity));
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
 buildList();
 selectEntity(null);
 controls.target.set(0,0,0);
 camera.position.copy(mode==='anatomy'?normalCamera.position:new THREE.Vector3(0,0.8,7.2));
 controls.update();
 buildModelLabels();
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
 if(selected){setEntityVisible(selected,false);selectEntity(null);buildList();updateModelLabels(true);}
};
document.querySelector('#showAll').onclick=()=>{
 activeEntities().forEach(e=>setEntityVisible(e,true));
 buildList();selectEntity(null);updateModelLabels(true);
};
document.querySelector('#isolate').onclick=()=>{
 if(selected){activeEntities().forEach(e=>setEntityVisible(e,e===selected));buildList();updateModelLabels(true);}
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
  renderLesson();
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
let previousFrameTime=0;
function animate(now=0){requestAnimationFrame(animate);const dt=previousFrameTime?Math.min((now-previousFrameTime)/1000,0.05):1/60;previousFrameTime=now;controls.update();updateModelLabels(dt);renderer.render(scene,camera);}
start();
animate();


/* ==========================================================
   SUBA AI STUDENT LEARNING STUDIO
   Guided lessons, browser-saved revision progress, flashcards,
   formative quiz and searchable glossary.
   ========================================================== */
const studyLessons=[
 {
  title:'The cornea',tag:'REFRACTION',structure:'Cornea',
  lead:'The clear, curved window at the front of the eye.',
  body:'Light first enters the eye through the cornea. Because of its curved surface and the difference in refractive index between air and corneal tissue, it bends incoming light strongly. The cornea provides most of the eye’s focusing power.',
  exam:'The cornea is transparent and has no blood vessels. It provides most of the refractive power; the crystalline lens fine-adjusts the focus.',
  duration:'2 min'
 },
 {
  title:'The iris and pupil',tag:'LIGHT CONTROL',structure:'Iris',
  lead:'A coloured diaphragm controls the opening through which light enters.',
  body:'The pupil is the opening at the centre of the iris. The iris contains circular and radial muscles that change pupil size. In bright light the pupil becomes smaller; in dim light it becomes larger. This helps regulate the amount of light entering the eye.',
  exam:'The iris controls pupil size. The pupil is an opening, not a solid part or a muscle.',
  duration:'2 min'
 },
 {
  title:'The crystalline lens',tag:'FOCUSING',structure:'Crystalline lens',
  lead:'A transparent, flexible, biconvex lens fine-tunes the image on the retina.',
  body:'The lens changes its curvature to focus objects at different distances. For a nearby object it becomes thicker and more convex; for a distant object it becomes thinner. This adjustment is called accommodation.',
  exam:'Accommodation is the change in focal length of the eye lens to focus near and distant objects on the retina.',
  duration:'3 min'
 },
 {
  title:'Suspensory ligaments',tag:'ACCOMMODATION',structure:'Suspensory ligaments',
  lead:'Fine fibres connect the lens capsule to the ciliary body.',
  body:'The suspensory ligaments, also called zonular fibres, transmit changes in tension from the ciliary muscle to the lens. When the ciliary muscle contracts, zonular tension is reduced and the elastic lens becomes rounder for near vision. When the muscle relaxes, the lens becomes flatter for distant vision.',
  exam:'Do not confuse the ciliary muscle with the suspensory ligaments: the muscle changes tension; the fibres transmit that change to the lens.',
  duration:'3 min'
 },
 {
  title:'The retina',tag:'LIGHT DETECTION',structure:'Retina',
  lead:'The light-sensitive neural layer converts light into electrical signals.',
  body:'The retina contains photoreceptor cells called rods and cones. Rods are very sensitive in dim light and are important for night vision. Cones work best in brighter light and provide colour vision and fine detail. The signals are processed by retinal neurons and travel towards the brain through the optic nerve.',
  exam:'The image formed on the retina of a normal eye is real and inverted. The fovea has a high density of cones and provides sharp central vision.',
  duration:'3 min'
 },
 {
  title:'The sclera and choroid',tag:'PROTECTION',structure:'Sclera',
  lead:'Two important layers protect and support the eyeball.',
  body:'The sclera is the tough, white outer coat that helps maintain the shape of the eyeball and protects its inner structures. The choroid lies inside the sclera. It is rich in blood vessels that nourish the outer retina, and its pigment helps absorb stray light inside the eye.',
  exam:'Remember the order from outside to inside: sclera → choroid → retina.',
  duration:'2 min'
 }
];
const studyFlashcards=[
 {category:'ANATOMY',front:'What is the main optical role of the cornea?',back:'The cornea provides most of the eye’s refractive power and bends incoming light towards the retina.'},
 {category:'ANATOMY',front:'What is the difference between the iris and the pupil?',back:'The iris is the coloured muscular diaphragm. The pupil is the opening at its centre through which light enters.'},
 {category:'ANATOMY',front:'What is accommodation?',back:'Accommodation is the change in curvature and focal length of the eye lens so that near and distant objects are focused on the retina.'},
 {category:'ANATOMY',front:'Which structures help the lens change its shape?',back:'The ciliary muscle and suspensory ligaments (zonular fibres) work together to change tension on the lens.'},
 {category:'ANATOMY',front:'What are rods and cones?',back:'Rods are highly sensitive in dim light. Cones support colour vision and sharp detail in brighter light.'},
 {category:'ANATOMY',front:'What is the fovea?',back:'The fovea is a small central region of the retina with a high density of cones. It provides the sharpest central vision.'},
 {category:'ANATOMY',front:'What is the blind spot?',back:'The optic disc is the point where the optic nerve leaves the eye. It has no rods or cones, so light falling there is not detected.'},
 {category:'ANATOMY',front:'What does the choroid do?',back:'The choroid is a vascular, pigmented layer. It supplies nutrients to the outer retina and absorbs stray light.'},
 {category:'VISION DEFECTS',front:'What is myopia?',back:'Myopia (short-sightedness) makes distant objects appear blurred. The image tends to form in front of the retina. It is corrected using a diverging (concave) lens.'},
 {category:'VISION DEFECTS',front:'What is hypermetropia?',back:'Hypermetropia (long-sightedness) makes nearby objects appear blurred. The image tends to form behind the retina. It is corrected using a converging (convex) lens.'},
 {category:'VISION DEFECTS',front:'What is presbyopia?',back:'Presbyopia is an age-related reduction in the eye’s accommodation, often making near focusing difficult. Suitable near correction may use convex lenses; some people need bifocal or progressive lenses.'},
 {category:'VISION DEFECTS',front:'What is the near point of a normal young adult eye?',back:'The conventional least distance of distinct vision is approximately 25 cm for a normal adult eye.'}
];
const studyQuestions=[
 {topic:'ANATOMY',q:'Which structure provides most of the refractive power of the human eye?',options:['Cornea','Iris','Retina','Optic nerve'],answer:0,why:'The curved cornea provides most of the eye’s refractive power. The lens fine-adjusts the focus by accommodation.'},
 {topic:'ANATOMY',q:'Which structure controls the diameter of the pupil?',options:['Sclera','Iris','Choroid','Retina'],answer:1,why:'The iris contains muscles that make the pupil smaller in bright light and larger in dim light.'},
 {topic:'ACCOMMODATION',q:'When focusing on a nearby object, what happens to the eye lens?',options:['It becomes flatter','It becomes thicker and more convex','It becomes opaque','It moves in front of the cornea'],answer:1,why:'For near vision, the ciliary muscle contracts, zonular tension decreases and the elastic lens becomes rounder.'},
 {topic:'RETINA',q:'Which photoreceptors are especially important for colour vision in bright light?',options:['Rods','Cones','Bipolar cells','Ganglion cells'],answer:1,why:'Cones support colour vision and fine detail, especially under brighter conditions. Rods are more sensitive in dim light.'},
 {topic:'IMAGE FORMATION',q:'For a normal relaxed eye viewing a distant object, where is the image formed?',options:['In front of the cornea','Behind the retina','On the retina','On the iris'],answer:2,why:'The eye focuses a real, inverted image on the retina. The brain interprets the visual signals.'},
 {topic:'VISION DEFECTS',q:'A person sees nearby objects clearly but distant objects appear blurred. Which correction is generally used for myopia?',options:['Convex lens','Concave lens','Cylindrical lens only','Plane glass'],answer:1,why:'In myopia, parallel rays from distant objects focus in front of the retina. A concave (diverging) lens moves the focus back onto the retina.'},
 {topic:'VISION DEFECTS',q:'Which lens is generally used to correct hypermetropia?',options:['Concave lens','Convex lens','Plane mirror','Prism only'],answer:1,why:'A convex (converging) lens helps bring the image of a nearby object forward onto the retina.'},
 {topic:'VISION DEFECTS',q:'Presbyopia is most directly associated with which change?',options:['Loss of retinal pigments','Age-related reduction in accommodation','Excessive pupil dilation','Damage to the optic disc in every case'],answer:1,why:'Presbyopia occurs with age as the lens becomes less flexible and the accommodation system becomes less effective.'}
];
const studyGlossary=[
 ['Accommodation','The process by which the eye changes the focal length of its lens to focus objects at different distances.'],
 ['Aqueous humour','A clear fluid in the front part of the eye that nourishes the cornea and lens and helps maintain intraocular pressure.'],
 ['Blind spot','The optic disc, where the optic nerve exits the eye. It has no photoreceptors.'],
 ['Ciliary muscle','A ring of smooth muscle that changes tension on the suspensory ligaments during accommodation.'],
 ['Choroid','A vascular, pigmented layer between the sclera and retina.'],
 ['Cornea','The transparent curved front surface of the eye; it supplies most of the eye’s refractive power.'],
 ['Fovea','The central retinal region with a high cone density and the greatest visual acuity.'],
 ['Hypermetropia','Long-sightedness; near objects are blurred and correction generally uses a convex lens.'],
 ['Iris','The coloured muscular diaphragm that regulates pupil diameter.'],
 ['Lens','A transparent, flexible, biconvex structure that fine-focuses light onto the retina.'],
 ['Myopia','Short-sightedness; distant objects are blurred and correction generally uses a concave lens.'],
 ['Optic nerve','A bundle of retinal ganglion-cell axons that carries visual information towards the brain.'],
 ['Presbyopia','An age-related reduction in accommodation, commonly causing difficulty focusing on near objects.'],
 ['Pupil','The opening in the iris through which light enters the eye.'],
 ['Retina','The light-sensitive neural tissue lining the back of the eye.'],
 ['Rods','Photoreceptors that are highly sensitive in dim light and support night vision.'],
 ['Sclera','The tough, white outer coat of the eyeball.'],
 ['Suspensory ligaments','Zonular fibres connecting the ciliary body to the lens capsule.'],
 ['Vitreous humour','A transparent gel that fills the large cavity behind the lens and helps maintain the shape of the eyeball.']
];
const studyState={lesson:0,card:0,cardRevealed:false,quiz:0,score:0,answered:false,completed:new Set()};
const lessonStorageKey='subaEyeLessonsV1';
try{
 const saved=JSON.parse(localStorage.getItem(lessonStorageKey)||'[]');
 if(Array.isArray(saved))saved.forEach(i=>{if(Number.isInteger(i)&&i>=0&&i<studyLessons.length)studyState.completed.add(i);});
}catch(error){console.info('Lesson progress storage is unavailable in this browser.');}
function studySetTab(name){
 document.querySelectorAll('.study-tab').forEach(tab=>{
  const active=tab.dataset.studyTab===name;
  tab.classList.toggle('active',active);
  tab.setAttribute('aria-selected',String(active));
 });
 document.querySelectorAll('[data-study-panel]').forEach(panel=>{
  panel.hidden=panel.dataset.studyPanel!==name;
 });
}
document.querySelectorAll('.study-tab').forEach(tab=>tab.addEventListener('click',()=>studySetTab(tab.dataset.studyTab)));
function updateStudyProgress(){
 const count=studyState.completed.size;
 document.querySelector('#studyProgressText').textContent=count+' of '+studyLessons.length+' lessons revised';
 document.querySelector('#studyProgressBar').style.width=(count/studyLessons.length*100)+'%';
}
function saveStudyProgress(){
 try{localStorage.setItem(lessonStorageKey,JSON.stringify([...studyState.completed]));}catch(error){console.info('Could not save revision progress.');}
}
function renderLesson(){
 const index=studyState.lesson,lesson=studyLessons[index];
 document.querySelector('#lessonNumber').textContent='LESSON '+String(index+1).padStart(2,'0')+' / '+String(studyLessons.length).padStart(2,'0');
 document.querySelector('#lessonTag').textContent=lesson.tag;
 document.querySelector('#lessonTitle').textContent=lesson.title;
 document.querySelector('#lessonLead').textContent=lesson.lead;
 document.querySelector('#lessonBody').textContent=lesson.body;
 document.querySelector('#lessonExamTip').textContent=lesson.exam;
 document.querySelector('#lessonComplete').textContent=studyState.completed.has(index)?'✓ Revised':'Mark as revised';
 document.querySelector('#lessonComplete').classList.toggle('is-complete',studyState.completed.has(index));
 document.querySelector('#lessonPrev').disabled=index===0;
 document.querySelector('#lessonNext').textContent=index===studyLessons.length-1?'Back to first lesson ↺':'Next lesson →';
 const entity=entities.find(e=>e.label===lesson.structure);
 document.querySelector('#lessonFocus').disabled=!entity;
 document.querySelector('#lessonStatus').textContent=studyState.completed.has(index)?'You have marked this lesson as revised.':'Read the key idea and exam reminder, then mark this lesson as revised.';
 document.querySelector('#lessonList').innerHTML='';
 studyLessons.forEach((item,i)=>{
  const button=document.createElement('button');
  button.type='button';button.className='lesson-step'+(i===index?' active':'')+(studyState.completed.has(i)?' done':'');
  button.innerHTML='<span class="lesson-step-number"></span><span class="lesson-step-copy"><strong></strong><small></small></span><span class="lesson-step-check"></span>';
  button.querySelector('.lesson-step-number').textContent=String(i+1).padStart(2,'0');
  button.querySelector('strong').textContent=item.title;
  button.querySelector('small').textContent=item.duration;
  button.querySelector('.lesson-step-check').textContent=studyState.completed.has(i)?'✓':'';
  button.addEventListener('click',()=>{studyState.lesson=i;renderLesson();});
  document.querySelector('#lessonList').appendChild(button);
 });
 updateStudyProgress();
}
document.querySelector('#lessonPrev').addEventListener('click',()=>{
 studyState.lesson=Math.max(0,studyState.lesson-1);renderLesson();
});
document.querySelector('#lessonNext').addEventListener('click',()=>{
 studyState.lesson=(studyState.lesson+1)%studyLessons.length;renderLesson();
});
document.querySelector('#lessonComplete').addEventListener('click',()=>{
 const i=studyState.lesson;
 if(studyState.completed.has(i))studyState.completed.delete(i);else studyState.completed.add(i);
 saveStudyProgress();renderLesson();
});
document.querySelector('#lessonFocus').addEventListener('click',()=>{
 const lesson=studyLessons[studyState.lesson];
 const entity=entities.find(e=>e.label===lesson.structure);
 if(!entity){document.querySelector('#lessonStatus').textContent='This structure is described in the lesson but is not separately available in the current GLB.';return;}
 document.querySelector('#stage').scrollIntoView({behavior:'smooth',block:'center'});
 if(mode!=='anatomy')setMode('anatomy');
 entities.forEach(e=>setEntityVisible(e,e===entity));
 buildList();selectEntity(entity);focusEntity(entity);buildModelLabels();
});
function renderFlashcard(){
 const card=studyFlashcards[studyState.card];
 document.querySelector('#cardCounter').textContent='CARD '+String(studyState.card+1).padStart(2,'0')+' / '+String(studyFlashcards.length).padStart(2,'0');
 document.querySelector('#flashcardCategory').textContent=card.category;
 document.querySelector('#flashcardTerm').textContent=card.front;
 document.querySelector('#flashcardAnswer').textContent=card.back;
 document.querySelector('#flashcardAnswer').hidden=!studyState.cardRevealed;
 document.querySelector('#flashcardHint').textContent=studyState.cardRevealed?'Answer revealed · Try to explain it in your own words':'Tap to reveal the answer';
 document.querySelector('#flashcard').classList.toggle('revealed',studyState.cardRevealed);
 document.querySelector('#cardReveal').textContent=studyState.cardRevealed?'Hide answer':'Reveal answer';
}
function revealCard(){
 studyState.cardRevealed=!studyState.cardRevealed;
 renderFlashcard();
}
document.querySelector('#flashcard').addEventListener('click',revealCard);
document.querySelector('#cardReveal').addEventListener('click',revealCard);
document.querySelector('#cardPrev').addEventListener('click',()=>{
 studyState.card=(studyState.card-1+studyFlashcards.length)%studyFlashcards.length;studyState.cardRevealed=false;renderFlashcard();
});
document.querySelector('#cardNext').addEventListener('click',()=>{
 studyState.card=(studyState.card+1)%studyFlashcards.length;studyState.cardRevealed=false;renderFlashcard();
});
function renderQuiz(){
 studyState.answered=false;
 const q=studyQuestions[studyState.quiz];
 document.querySelector('#quizResult').hidden=true;
 document.querySelector('#quizCounter').textContent='QUESTION '+(studyState.quiz+1)+' / '+studyQuestions.length;
 document.querySelector('#quizProgressBar').style.width=(studyState.quiz/studyQuestions.length*100)+'%';
 document.querySelector('#quizTopic').textContent=q.topic;
 document.querySelector('#quizQuestion').textContent=q.q;
 document.querySelector('#quizOptions').innerHTML='';
 document.querySelector('#quizFeedback').hidden=true;
 document.querySelector('#quizNext').disabled=true;
 document.querySelector('#quizNext').textContent=studyState.quiz===studyQuestions.length-1?'See your result':'Next question →';
 document.querySelector('#quizScoreLive').textContent='Score: '+studyState.score;
 q.options.forEach((option,index)=>{
  const button=document.createElement('button');
  button.type='button';button.className='quiz-option';
  button.innerHTML='<span class="option-letter"></span><span class="option-text"></span>';
  button.querySelector('.option-letter').textContent=String.fromCharCode(65+index);
  button.querySelector('.option-text').textContent=option;
  button.addEventListener('click',()=>answerQuiz(index));
  document.querySelector('#quizOptions').appendChild(button);
 });
}
function answerQuiz(choice){
 if(studyState.answered)return;
 studyState.answered=true;
 const q=studyQuestions[studyState.quiz];
 const correct=choice===q.answer;
 if(correct)studyState.score++;
 document.querySelectorAll('.quiz-option').forEach((button,index)=>{
  button.disabled=true;
  if(index===q.answer)button.classList.add('correct');
  else if(index===choice)button.classList.add('incorrect');
 });
 const feedback=document.querySelector('#quizFeedback');
 feedback.hidden=false;feedback.className='quiz-feedback '+(correct?'correct':'incorrect');
 const heading=document.createElement('strong');heading.textContent=correct?'Correct!':'Not quite.';
 const explanation=document.createElement('p');explanation.textContent=q.why;
 feedback.replaceChildren(heading,explanation);
 document.querySelector('#quizScoreLive').textContent='Score: '+studyState.score;
 document.querySelector('#quizProgressBar').style.width=((studyState.quiz+1)/studyQuestions.length*100)+'%';
 document.querySelector('#quizNext').disabled=false;
}
document.querySelector('#quizNext').addEventListener('click',()=>{
 if(!studyState.answered)return;
 if(studyState.quiz<studyQuestions.length-1){
  studyState.quiz++;renderQuiz();return;
 }
 const pct=Math.round(studyState.score/studyQuestions.length*100);
 document.querySelector('#quizCard')?.setAttribute('hidden','');
 document.querySelector('.quiz-card').hidden=true;
 document.querySelector('#quizResult').hidden=false;
 document.querySelector('#quizResultTitle').textContent=pct>=80?'Excellent work!':pct>=50?'Good effort—keep revising!':'Keep practising—you can improve!';
 document.querySelector('#quizResultText').textContent='You scored '+studyState.score+' out of '+studyQuestions.length+' ('+pct+'%). Review the explanations, revisit the lessons and try again.';
 document.querySelector('#quizCounter').textContent='COMPLETED';
 document.querySelector('#quizProgressBar').style.width='100%';
});
document.querySelector('#quizRestart').addEventListener('click',()=>{
 studyState.quiz=0;studyState.score=0;studyState.answered=false;
 document.querySelector('.quiz-card').hidden=false;
 renderQuiz();
});
function renderGlossary(query=''){
 const list=document.querySelector('#glossaryList');list.innerHTML='';
 const q=query.trim().toLowerCase();
 const matches=studyGlossary.filter(([term,definition])=>(term+' '+definition).toLowerCase().includes(q));
 document.querySelector('#glossaryCount').textContent=matches.length+' / '+studyGlossary.length+' TERMS';
 document.querySelector('#glossaryEmpty').hidden=matches.length!==0;
 matches.forEach(([term,definition])=>{
  const item=document.createElement('article');item.className='glossary-item';
  const title=document.createElement('h4');title.textContent=term;
  const body=document.createElement('p');body.textContent=definition;
  item.append(title,body);list.appendChild(item);
 });
}
document.querySelector('#glossarySearch').addEventListener('input',e=>renderGlossary(e.target.value));
renderLesson();
renderFlashcard();
renderQuiz();
renderGlossary();


/* ================= VISION DEFECTS & CORRECTION LAB ================= */
const visionDefects={
 myopia:{
  category:'REFRACTIVE ERROR',
  name:'Myopia (short-sightedness)',
  summary:'Distant objects appear blurred because, for a relaxed eye, parallel rays from a distant object focus in front of the retina.',
  imagePosition:'In front of the retina',
  correction:'Concave (diverging) lens',
  opticalEffect:'Diverges incoming parallel rays before they enter the eye',
  why:'A concave lens makes the incoming rays diverge slightly. The eye lens then converges them so the final image forms on the retina instead of in front of it.',
  memory:'MYOPIA → CONCAVE lens. Think: the eye focuses distant light too soon; a diverging lens reduces the net convergence.',
  question:'Which lens is commonly used to correct myopia?',
  answers:['Convex lens','Concave lens','Cylindrical lens only','Plane glass'],
  correct:1,
  feedback:'A concave (diverging) lens spreads the incoming rays before they enter a myopic eye, moving the final focus back onto the retina.',
  diagramTitle:'Myopia — parallel rays focus before the retina'
 },
 hypermetropia:{
  category:'REFRACTIVE ERROR',
  name:'Hypermetropia (long-sightedness)',
  summary:'Nearby objects may appear blurred because the eye’s optical power is insufficient, or the eyeball is relatively short, so the image would form behind the retina.',
  imagePosition:'Behind the retina',
  correction:'Convex (converging) lens',
  opticalEffect:'Converges incoming rays before they enter the eye',
  why:'A convex lens adds convergence to the light before it enters the eye. The eye then brings the image forward so it forms on the retina.',
  memory:'HYPERMETROPIA → CONVEX lens. The unaided eye would focus behind the retina; a converging lens helps bring the focus forward.',
  question:'Which lens is commonly used to correct hypermetropia?',
  answers:['Concave lens','Convex lens','Plane mirror','No lens can help'],
  correct:1,
  feedback:'A convex (converging) lens adds optical power and helps focus light on the retina.',
  diagramTitle:'Hypermetropia — rays would focus behind the retina'
 },
 presbyopia:{
  category:'AGE-RELATED ACCOMMODATION CHANGE',
  name:'Presbyopia',
  summary:'With age, the eye’s ability to accommodate decreases. The near point moves farther away, making close objects difficult to focus on.',
  imagePosition:'Near-object focus may fall behind the retina',
  correction:'Convex near-add lens; bifocal or progressive lenses when needed',
  opticalEffect:'Adds convergence for near viewing',
  why:'A convex reading lens supplies some of the converging power that the ageing eye can no longer provide through accommodation. People who also need distance correction may use bifocal or progressive lenses.',
  memory:'PRESBYOPIA → reduced accommodation. It is age-related and is not simply the same condition as hypermetropia.',
  question:'What is the main change associated with presbyopia?',
  answers:['The eye loses all colour vision','Accommodation becomes less effective','The pupil becomes permanently closed','The retina moves forward'],
  correct:1,
  feedback:'Presbyopia is mainly a reduction in the ability to accommodate, commonly associated with increasing stiffness of the crystalline lens.',
  diagramTitle:'Presbyopia — a near object is not focused adequately'
 },
 astigmatism:{
  category:'REFRACTIVE ERROR',
  name:'Astigmatism',
  summary:'The cornea or lens has different curvature in different meridians. Light is therefore not brought to one sharp point on the retina.',
  imagePosition:'Different meridians focus at different positions',
  correction:'Cylindrical or toric lens',
  opticalEffect:'Corrects unequal refractive power in different meridians',
  why:'A cylindrical or toric lens provides different optical power in different directions. This compensates for the unequal curvature and helps the meridians focus together on the retina.',
  memory:'ASTIGMATISM → CYLINDRICAL / TORIC correction. The axis and power depend on the individual eye examination.',
  question:'Which type of lens is commonly used to correct regular astigmatism?',
  answers:['Concave spherical lens only','Convex spherical lens only','Cylindrical or toric lens','A plane glass plate'],
  correct:2,
  feedback:'A cylindrical or toric lens is designed to correct unequal refractive power in different meridians.',
  diagramTitle:'Astigmatism — two principal meridians do not share one focus'
 }
};
let activeDefect='myopia';
let rayMode='uncorrected';
function rayPath(points){
 return points.map((p,i)=>(i?'L':'M')+' '+p[0]+' '+p[1]).join(' ');
}
function lensMarkup(x,type,label){
 let path;
 if(type==='concave')path='M '+x+' 102 Q '+(x-17)+' 170 '+x+' 238 Q '+(x+17)+' 170 '+x+' 102 Z';
 else path='M '+x+' 102 Q '+(x+17)+' 170 '+x+' 238 Q '+(x-17)+' 170 '+x+' 102 Z';
 return '<path class="'+(type==='none'?'eye-lens':'correction-lens')+'" d="'+path+'"/><text x="'+x+'" y="260" text-anchor="middle" class="small-label">'+label+'</text>';
}
function eyeMarkup(){
 return '<path class="eye-shell" d="M 338 170 C 370 84 500 67 585 170 C 500 273 370 256 338 170 Z"/>'+
  '<path class="eye-lens" d="M 392 118 Q 425 170 392 222 Q 359 170 392 118 Z"/>'+
  '<text x="392" y="92" text-anchor="middle" class="small-label">EYE LENS</text>'+
  '<line class="retina" x1="566" y1="105" x2="566" y2="235"/>'+
  '<text x="566" y="258" text-anchor="middle" class="small-label">RETINA</text>';
}
function makeDiagramSvg(defect,corrected){
 const commonStart='<defs><marker id="rayArrowGold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#f5c968"/></marker><marker id="rayArrowTeal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#5fe0ce"/></marker></defs>'+
  '<line class="axis" x1="24" y1="170" x2="710" y2="170"/>'+
  '<text x="28" y="24" class="small-label">'+(defect==='presbyopia'?'NEAR OBJECT':'DISTANT OBJECT')+'</text>'+
  '<path class="object-mark" d="M 42 170 L 42 104 M 34 114 L 42 104 L 50 114"/>'+
  '<text x="42" y="270" text-anchor="middle" class="small-label">OBJECT</text>'+
  '<text x="210" y="78" text-anchor="middle" class="small-label">'+(corrected?'CORRECTIVE LENS':'NO CORRECTION')+'</text>'+
  eyeMarkup();
 let paths='',focus='',corrective='';
 if(defect==='myopia'){
  if(corrected){
   corrective=lensMarkup(210,'concave','CONCAVE');
   paths='<path class="ray-in" d="'+rayPath([[42,112],[210,112]])+'"/><path class="ray-out" d="'+rayPath([[210,112],[338,92],[392,112],[566,170]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[210,228]])+'"/><path class="ray-out" d="'+rayPath([[210,228],[338,248],[392,228],[566,170]])+'"/>';
   focus='<circle class="focus-good" cx="566" cy="170" r="6"/><text x="575" y="157" class="small-label">FOCUS ON RETINA</text>';
  }else{
   paths='<path class="ray-in" d="'+rayPath([[42,112],[392,132]])+'"/><path class="ray-bad" d="'+rayPath([[392,132],[480,170],[566,196]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[392,208]])+'"/><path class="ray-bad" d="'+rayPath([[392,208],[480,170],[566,144]])+'"/>';
   focus='<circle class="focus-point" cx="480" cy="170" r="6"/><text x="480" y="150" text-anchor="middle" class="small-label">FOCUS</text>';
  }
 }else if(defect==='hypermetropia'){
  if(corrected){
   corrective=lensMarkup(210,'convex','CONVEX');
   paths='<path class="ray-in" d="'+rayPath([[42,112],[210,112]])+'"/><path class="ray-out" d="'+rayPath([[210,112],[338,140],[392,146],[566,170]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[210,228]])+'"/><path class="ray-out" d="'+rayPath([[210,228],[338,200],[392,194],[566,170]])+'"/>';
   focus='<circle class="focus-good" cx="566" cy="170" r="6"/><text x="575" y="157" class="small-label">FOCUS ON RETINA</text>';
  }else{
   paths='<path class="ray-in" d="'+rayPath([[42,112],[392,135]])+'"/><path class="ray-bad" d="'+rayPath([[392,135],[630,170],[680,177]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[392,205]])+'"/><path class="ray-bad" d="'+rayPath([[392,205],[630,170],[680,163]])+'"/>';
   focus='<circle class="focus-point" cx="630" cy="170" r="6"/><text x="630" y="150" text-anchor="middle" class="small-label">FOCUS BEHIND RETINA</text>';
  }
 }else if(defect==='presbyopia'){
  if(corrected){
   corrective=lensMarkup(210,'convex','READING ADD');
   paths='<path class="ray-in" d="'+rayPath([[42,170],[210,118]])+'"/><path class="ray-out" d="'+rayPath([[210,118],[338,140],[392,146],[566,170]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,170],[210,222]])+'"/><path class="ray-out" d="'+rayPath([[210,222],[338,200],[392,194],[566,170]])+'"/>';
   focus='<circle class="focus-good" cx="566" cy="170" r="6"/><text x="575" y="157" class="small-label">FOCUS ON RETINA</text>';
  }else{
   paths='<path class="ray-in" d="'+rayPath([[42,170],[392,118]])+'"/><path class="ray-bad" d="'+rayPath([[392,118],[620,170],[680,184]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,170],[392,222]])+'"/><path class="ray-bad" d="'+rayPath([[392,222],[620,170],[680,156]])+'"/>';
   focus='<circle class="focus-point" cx="620" cy="170" r="6"/><text x="620" y="150" text-anchor="middle" class="small-label">NEAR FOCUS BEHIND RETINA</text>';
  }
 }else{
  if(corrected){
   corrective=lensMarkup(210,'convex','TORIC / CYLINDRICAL');
   paths='<path class="ray-in" d="'+rayPath([[42,112],[210,112],[338,140],[392,146],[566,170]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[210,228],[338,200],[392,194],[566,170]])+'"/>'+
    '<path class="ray-out" d="'+rayPath([[42,145],[210,145],[338,158],[392,160],[566,170]])+'"/>';
   focus='<circle class="focus-good" cx="566" cy="170" r="6"/><text x="575" y="157" class="small-label">MERIDIANS CORRECTED</text>';
  }else{
   paths='<path class="ray-in" d="'+rayPath([[42,112],[392,140]])+'"/><path class="ray-bad" d="'+rayPath([[392,140],[510,170],[566,184]])+'"/>'+
    '<path class="ray-in" d="'+rayPath([[42,228],[392,200]])+'"/><path class="ray-bad" d="'+rayPath([[392,200],[625,170],[680,163]])+'"/>';
   focus='<circle class="focus-point" cx="510" cy="170" r="5"/><circle class="focus-point" cx="625" cy="170" r="5"/><text x="510" y="150" text-anchor="middle" class="small-label">FOCAL LINE 1</text><text x="625" y="192" text-anchor="middle" class="small-label">FOCAL LINE 2</text>';
  }
 }
 const retinaNote=corrected?'RAYS BROUGHT TO RETINAL PLANE':'SCHEMATIC RAY PATH';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" role="img" aria-label="'+visionDefects[defect].name+(corrected?' with corrective lens':' without correction')+'">'+
  commonStart+corrective+paths+focus+
  '<text x="392" y="286" text-anchor="middle" class="small-label">EYE</text>'+
  '<text x="700" y="286" text-anchor="end" class="small-label">'+retinaNote+'</text></svg>';
}
function renderDefect(){
 const data=visionDefects[activeDefect];
 document.querySelectorAll('.defect-choice').forEach(button=>button.classList.toggle('active',button.dataset.defect===activeDefect));
 document.querySelectorAll('[data-ray-mode]').forEach(button=>button.classList.toggle('active',button.dataset.rayMode===rayMode));
 document.querySelector('#rayDiagramTitle').textContent=data.diagramTitle;
 document.querySelector('#defectRayDiagram').outerHTML=makeDiagramSvg(activeDefect,rayMode==='corrected');
 document.querySelector('#defectName').textContent=data.name;
 document.querySelector('#defectCategory').textContent=data.category;
 document.querySelector('#defectSummary').textContent=data.summary;
 document.querySelector('#defectImagePosition').textContent=data.imagePosition;
 document.querySelector('#defectCorrection').textContent=data.correction;
 document.querySelector('#defectOpticalEffect').textContent=data.opticalEffect;
 document.querySelector('#defectWhy').textContent=data.why;
 document.querySelector('#defectMemory').textContent=data.memory;
 document.querySelector('#defectQuestion').textContent=data.question;
 document.querySelector('#defectQuestionHint').textContent='Choose one answer to check your understanding.';
 const answerBox=document.querySelector('#defectAnswers');answerBox.innerHTML='';
 document.querySelector('#defectAnswerFeedback').hidden=true;
 data.answers.forEach((answer,index)=>{
  const button=document.createElement('button');
  button.type='button';button.className='defect-answer';button.textContent=String.fromCharCode(65+index)+'. '+answer;
  button.addEventListener('click',()=>checkDefectAnswer(index));
  answerBox.appendChild(button);
 });
}
function checkDefectAnswer(index){
 const data=visionDefects[activeDefect];
 const feedback=document.querySelector('#defectAnswerFeedback');
 document.querySelectorAll('.defect-answer').forEach((button,i)=>{
  button.disabled=true;
  if(i===data.correct)button.classList.add('correct');
  else if(i===index)button.classList.add('wrong');
 });
 feedback.hidden=false;
 feedback.textContent=(index===data.correct?'Correct! ':'Not quite. ')+data.feedback;
}
document.querySelectorAll('.defect-choice').forEach(button=>button.addEventListener('click',()=>{
 activeDefect=button.dataset.defect;renderDefect();
}));
document.querySelectorAll('[data-ray-mode]').forEach(button=>button.addEventListener('click',()=>{
 rayMode=button.dataset.rayMode;renderDefect();
}));
renderDefect();
