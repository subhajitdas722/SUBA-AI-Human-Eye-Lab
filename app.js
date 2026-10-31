import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const stage = document.querySelector('#stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1726);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = false;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 4.4;
controls.maxDistance = 12;
controls.target.set(0, 0.02, 0);
camera.position.set(6.2, 1.3, 2.8);

scene.add(new THREE.AmbientLight(0xffffff, 0.42));
scene.add(new THREE.HemisphereLight(0xfff8ee, 0x33252d, 0.72));
const key = new THREE.DirectionalLight(0xfff3e7, 3.5);
key.position.set(4.8, 6.5, 6.8); scene.add(key);
const fill = new THREE.DirectionalLight(0xe6ecff, 1.12);
fill.position.set(-4.5, 1.2, 5.2); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffb7a5, 1.0);
rim.position.set(-4, 3.5, -5.5); scene.add(rim);
const warm = new THREE.PointLight(0xff8d70, 0.48, 11, 2);
warm.position.set(-3, -1.4, 3.5); scene.add(warm);

const anatomyPivot = new THREE.Group();
const exteriorPivot = new THREE.Group();
scene.add(anatomyPivot, exteriorPivot);
exteriorPivot.visible = false;

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);

const anatomy = [];
const exterior = [];
let anatomyModel = null;
let exteriorModel = null;
let selected = null;
let selectedOriginalEmissive = null;
let mode = 'anatomy';
let exploded = false;

const descriptions = {
  VH_M_aqueous_humor_L:['Aqueous humour','Clear fluid in the anterior and posterior chambers. It nourishes avascular tissues and helps maintain intraocular pressure.'],
  VH_M_bulbar_conjunctiva_L:['Bulbar conjunctiva','Thin transparent mucous membrane covering the anterior sclera.'],
  VH_M_ciliary_body_L:['Ciliary body','Ring-shaped structure that produces aqueous humour and supports accommodation.'],
  VH_M_ciliary_muscle_L:['Ciliary muscle','Changes zonular tension so the lens can alter its curvature during accommodation.'],
  VH_M_ciliary_processes_L:['Ciliary processes','Folded projections of the ciliary body that secrete aqueous humour and support zonular fibres.'],
  VH_M_cornea_L:['Cornea','Transparent curved front surface. It provides most of the eye’s refractive power.'],
  VH_M_corneo_scleral_junction_L:['Corneoscleral junction','Limbus: the transition between the cornea and sclera.'],
  VH_M_iris_L:['Iris','Pigmented diaphragm whose muscles regulate pupil diameter.'],
  VH_M_lens_L:['Crystalline lens','Transparent, flexible biconvex structure that fine-focuses light onto the retina.'],
  VH_M_optic_choroid_L:['Choroid','Vascular, pigmented layer between sclera and retina; nourishes the outer retina.'],
  VH_M_ora_serrata_of_retina_L:['Ora serrata','Anterior serrated boundary of the photosensitive retina.'],
  VH_M_palpebral_conjunctiva_of_lower_eyelid_L:['Lower palpebral conjunctiva','Conjunctival lining of the inner lower eyelid.'],
  VH_M_palpebral_conjunctiva_of_upper_eyelid_L:['Upper palpebral conjunctiva','Conjunctival lining of the inner upper eyelid.'],
  VH_M_pupil_L:['Pupil','Opening in the iris through which light enters the eye.'],
  VH_M_retina_L:['Retina','Light-sensitive neural tissue that converts light into electrical signals.'],
  VH_M_fovea_L:['Fovea','Small central retinal pit responsible for the highest visual acuity.'],
  VH_M_macula_lutea_L:['Macula lutea','Central retinal area used for detailed central vision.'],
  VH_M_optic_disc_L:['Optic disc','Region where retinal ganglion-cell axons leave the eye; the physiological blind spot.'],
  VH_M_schlemms_canal_L:['Schlemm’s canal','Circular drainage channel that receives aqueous humour from the trabecular meshwork.'],
  VH_M_sclera_L:['Sclera','Tough white outer coat that protects the eye and helps maintain its shape.'],
  VH_M_suspensory_ligament_of_lens_L:['Suspensory ligaments (zonules)','Fibres connecting the ciliary body to the lens capsule.'],
  VH_M_trabecular_meshwork_L:['Trabecular meshwork','Porous tissue providing the main conventional outflow route for aqueous humour.'],
  VH_M_vitreous_humor_L:['Vitreous humour','Transparent gel filling the large posterior cavity behind the lens.']
};

const anatomyStyle = {
  VH_M_aqueous_humor_L:{color:0xb3d4e6,opacity:0.10,transparent:true,roughness:0.16},
  VH_M_bulbar_conjunctiva_L:{color:0xccb2a6,opacity:0.42,transparent:true},
  VH_M_ciliary_body_L:{color:0x8c5940},
  VH_M_ciliary_muscle_L:{color:0x99664a},
  VH_M_ciliary_processes_L:{color:0x854d38},
  VH_M_cornea_L:{color:0xd8ecf2,opacity:0.18,transparent:true,roughness:0.07,clearcoat:0.8},
  VH_M_corneo_scleral_junction_L:{color:0xb9c8cc},
  VH_M_iris_L:{color:0x79532f,roughness:0.78},
  VH_M_lens_L:{color:0xdbe9ee,opacity:0.24,transparent:true,roughness:0.12,clearcoat:0.35},
  VH_M_optic_choroid_L:{color:0x732633,roughness:0.78},
  VH_M_ora_serrata_of_retina_L:{color:0x8c666b},
  VH_M_palpebral_conjunctiva_of_lower_eyelid_L:{color:0xe08072,opacity:0.5,transparent:true},
  VH_M_palpebral_conjunctiva_of_upper_eyelid_L:{color:0xe08072,opacity:0.5,transparent:true},
  VH_M_pupil_L:{color:0x030609,roughness:0.98},
  VH_M_retina_L:{color:0x995a61},
  VH_M_fovea_L:{color:0xd9994d},
  VH_M_macula_lutea_L:{color:0xcca640},
  VH_M_optic_disc_L:{color:0x8c8073},
  VH_M_schlemms_canal_L:{color:0x669980,opacity:0.88,transparent:true},
  VH_M_sclera_L:{color:0xf2eee3,roughness:0.62},
  VH_M_suspensory_ligament_of_lens_L:{color:0xc4d2d6,opacity:0.82,transparent:true,roughness:0.45},
  VH_M_trabecular_meshwork_L:{color:0xc7a059},
  VH_M_vitreous_humor_L:{color:0x99b3cc,opacity:0.045,transparent:true,roughness:0.08}
};

const initiallyHidden = new Set([
  'VH_M_sclera_L',
  'VH_M_bulbar_conjunctiva_L',
  'VH_M_palpebral_conjunctiva_of_lower_eyelid_L',
  'VH_M_palpebral_conjunctiva_of_upper_eyelid_L'
]);

function niceName(mesh) {
  return descriptions[mesh.name]?.[0] || mesh.name.replace(/^VH_M_/,'').replace(/_L$/,'').replaceAll('_',' ');
}
function setLoadMessage(message, error=false) {
  const node = document.querySelector('#loading');
  node.hidden = false;
  node.textContent = message;
  node.style.color = error ? '#ffb0a8' : '#c4d6e8';
}
function makeAnatomicalMaterial(name) {
  const s = anatomyStyle[name] || {color:0xb8c8d5};
  if (s.transparent) {
    return new THREE.MeshPhysicalMaterial({
      color:s.color, transparent:true, opacity:s.opacity ?? 0.5,
      depthWrite:false, side:THREE.DoubleSide,
      roughness:s.roughness ?? 0.45, metalness:0,
      clearcoat:s.clearcoat ?? 0.12, clearcoatRoughness:0.55
    });
  }
  return new THREE.MeshStandardMaterial({
    color:s.color, roughness:s.roughness ?? 0.62, metalness:0,
    side:THREE.DoubleSide
  });
}
function prepareModel(gltf, target, isAnatomy) {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const allMeshes = [];
  model.traverse(o => { if (o.isMesh) allMeshes.push(o); });

  // Detach the fovea, macula, optic disc and ciliary muscle from parent meshes
  // while preserving their world transforms. They remain independently toggleable.
  for (const mesh of allMeshes) {
    if (mesh.parent && mesh.parent.isMesh) model.attach(mesh);
  }
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 3.8 / Math.max(size.x,size.y,size.z,0.001);
  model.scale.setScalar(scale);
  model.position.copy(center).multiplyScalar(-scale);

  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.rotation.set(0.05,-0.28,0);

  model.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.basePosition = o.position.clone();
    if (isAnatomy) {
      o.material = makeAnatomicalMaterial(o.name);
      if (o.geometry?.attributes?.position && !o.geometry.attributes.normal) {
        o.geometry.computeVertexNormals();
      }
    } else {
      // Preserve the downloaded Sketchfab PBR textures/materials for the exterior.
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m => {
        const clone = m.clone();
        if (clone.map) clone.map.colorSpace = THREE.SRGBColorSpace;
        if (clone.normalMap) clone.normalScale.multiplyScalar(0.8);
        if (clone.roughness !== undefined) clone.roughness = THREE.MathUtils.clamp(clone.roughness ?? 0.5,0.42,0.68);
        if (clone.metalness !== undefined) clone.metalness = 0;
        return clone;
      });
      if (o.material.length===1) o.material=o.material[0];
    }
    target.push(o);
  });
  return {pivot, model};
}
function resize() {
  const w=stage.clientWidth,h=stage.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
window.addEventListener('resize',resize); resize();

function resetCamera() {
  // Oblique lateral-anterior view: exposes the cornea-to-retina axis and
  // avoids the gear-like straight-on appearance of the ciliary processes.
  if (mode === 'anatomy') camera.position.set(6.2,1.3,2.8);
  else camera.position.set(0,1.05,8.2);
  controls.target.set(0,0.02,0);
  controls.update();
}
function resetAnatomyCutaway() {
  anatomy.forEach(o => {
    o.visible = !initiallyHidden.has(o.name);
    o.position.copy(o.userData.basePosition);
  });
  buildList();
  exploded=false;
}
function select(mesh) {
  if (selected && selected.material && selectedOriginalEmissive) {
    const old = Array.isArray(selected.material) ? selected.material : [selected.material];
    old.forEach((m,i) => { if (m.emissive && selectedOriginalEmissive[i]) m.emissive.copy(selectedOriginalEmissive[i]); });
  }
  selected=mesh;
  selectedOriginalEmissive=null;
  if (mesh) {
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    selectedOriginalEmissive=mats.map(m=>m.emissive?m.emissive.clone():null);
    mats.forEach(m=>{if(m.emissive)m.emissive.setHex(0x244d42)});
  }
  document.querySelectorAll('.structure').forEach(el=>el.classList.toggle('selected',el.dataset.mesh===mesh?.name));
  document.querySelector('#selectedName').textContent=mesh?niceName(mesh):'Select a structure';
  document.querySelector('#selectedDesc').textContent=mesh?(descriptions[mesh.name]?.[1]||'Anatomical structure from the HRA reference model.'):'Choose a structure to highlight it and view its controls.';
  const m=mesh?(Array.isArray(mesh.material)?mesh.material[0]:mesh.material):null;
  document.querySelector('#opacity').value=mesh?Math.round((m?.opacity??1)*100):100;
  document.querySelector('#opacityValue').textContent=document.querySelector('#opacity').value+'%';
}
function buildList() {
  const list=document.querySelector('#structureList'); list.innerHTML='';
  anatomy.forEach(mesh=>{
    const row=document.createElement('div'); row.className='structure'; row.dataset.mesh=mesh.name;
    const eye=document.createElement('input'); eye.type='checkbox'; eye.checked=mesh.visible; eye.title='Show or hide';
    eye.onchange=()=>{mesh.visible=eye.checked;};
    const title=document.createElement('span'); title.className='name'; title.textContent=niceName(mesh); title.onclick=()=>select(mesh);
    const focus=document.createElement('button'); focus.textContent='Focus';
    focus.onclick=()=>{resetAnatomyCutaway(); mesh.visible=true; select(mesh);};
    row.append(eye,title,focus); list.append(row);
  });
}
function loadGLB(url,target,isAnatomy) {
  return new Promise((resolve,reject)=>loader.load(url,gltf=>{
    try { resolve(prepareModel(gltf,target,isAnatomy)); } catch(e) { reject(e); }
  },undefined,reject));
}

try {
  anatomyModel=await loadGLB('./models/eye-anatomy.glb',anatomy,true);
  anatomyPivot.add(anatomyModel.pivot);
  resetAnatomyCutaway();
  document.querySelector('#loading').hidden=true;
} catch(e) {
  setLoadMessage('Unable to load eye-anatomy.glb. Confirm that models/eye-anatomy.glb exists in the repository. '+(e?.message||e),true);
  console.error('Anatomy model load failed',e);
}
try {
  exteriorModel=await loadGLB('./models/human_eye.glb',exterior,false);
  exteriorPivot.add(exteriorModel.pivot);
} catch(e) {
  console.warn('Exterior model load failed',e);
}

function setMode(next) {
  mode=next;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  document.querySelector('#modeTitle').textContent=mode==='anatomy'?'Internal anatomy':'Exterior view';
  anatomyPivot.visible=mode==='anatomy';
  exteriorPivot.visible=mode==='exterior';
  if (mode==='anatomy') buildList();
  else document.querySelector('#structureList').innerHTML='<p class="hint">Exterior model by DEGUIDER. The downloaded GLB contains separate eye-body and iris meshes. Rotate to inspect the surface.</p>';
  select(null);
  resetCamera();
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelector('#search').oninput=e=>{
  const q=e.target.value.toLowerCase();
  document.querySelectorAll('.structure').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'flex':'none');
};
document.querySelector('#opacity').oninput=e=>{
  if(!selected)return;
  const v=Number(e.target.value)/100;
  const mats=Array.isArray(selected.material)?selected.material:[selected.material];
  mats.forEach(m=>{m.opacity=v;m.transparent=v<0.999;m.depthWrite=v>=0.999;m.needsUpdate=true;});
  document.querySelector('#opacityValue').textContent=e.target.value+'%';
};
document.querySelector('#hideSelected').onclick=()=>{
  if(selected){selected.visible=false;buildList();select(null);}
};
document.querySelector('#showAll').onclick=()=>{
  anatomy.forEach(o=>{o.visible=true;o.position.copy(o.userData.basePosition);});
  exploded=false;buildList();
};
document.querySelector('#isolate').onclick=()=>{
  if(selected){anatomy.forEach(o=>o.visible=o===selected);buildList();}
};
document.querySelector('#reset').onclick=()=>{
  if(mode==='anatomy')resetAnatomyCutaway();
  resetCamera();
  select(null);
};
document.querySelector('#explode').onclick=()=>{
  if(mode!=='anatomy')return;
  exploded=!exploded;
  anatomy.forEach((o,i)=>{
    const p=o.userData.basePosition.clone();
    if(exploded){
      const world=o.getWorldPosition(new THREE.Vector3());
      const d=world.lengthSq()>0.0001?world.normalize():new THREE.Vector3((i%3)-1,((i+1)%3)-1,((i+2)%3)-1).normalize();
      const inverseRotation=new THREE.Matrix4().extractRotation(anatomyPivot.matrixWorld).invert();
      d.transformDirection(inverseRotation);
      p.add(d.multiplyScalar(0.075));
    }
    o.position.copy(p);
  });
};
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}
animate();
