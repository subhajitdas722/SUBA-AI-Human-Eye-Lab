import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const stage=document.querySelector('#stage');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b1726);
const camera=new THREE.PerspectiveCamera(38,1,.01,100); camera.position.set(0,0,5.4);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=1.5; controls.maxDistance=12;
scene.add(new THREE.HemisphereLight(0xc8e4ff,0x263044,2));
const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(3,4,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x62cbd1,1.2);fill.position.set(-4,-2,-3);scene.add(fill);
const root=new THREE.Group();scene.add(root);
const loader=new GLTFLoader();const draco=new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);
const anatomy=[],exterior=[];
const names={
'VH_M_aqueous_humor_L':['Aqueous humour','Clear fluid in the anterior and posterior chambers that nourishes the cornea and lens.'],
'VH_M_bulbar_conjunctiva_L':['Bulbar conjunctiva','Thin transparent mucous membrane covering the anterior sclera.'],
'VH_M_ciliary_body_L':['Ciliary body','Produces aqueous humour and helps change lens curvature for accommodation.'],
'VH_M_ciliary_muscle_L':['Ciliary muscle','Changes tension on the suspensory ligaments during accommodation.'],
'VH_M_ciliary_processes_L':['Ciliary processes','Folded projections that produce aqueous humour and anchor zonular fibres.'],
'VH_M_cornea_L':['Cornea','Transparent curved front surface; provides most of the eye’s refractive power.'],
'VH_M_corneo_scleral_junction_L':['Corneoscleral junction','Transition region between cornea and sclera, near the drainage angle.'],
'VH_M_iris_L':['Iris','Pigmented diaphragm that regulates pupil diameter.'],
'VH_M_lens_L':['Crystalline lens','Transparent, flexible structure that fine-focuses light onto the retina.'],
'VH_M_optic_choroid_L':['Choroid','Vascular, pigmented layer between sclera and retina.'],
'VH_M_ora_serrata_of_retina_L':['Ora serrata','Anterior serrated boundary of the photosensitive retina.'],
'VH_M_palpebral_conjunctiva_of_lower_eyelid_L':['Lower palpebral conjunctiva','Conjunctival lining of the inner lower eyelid.'],
'VH_M_palpebral_conjunctiva_of_upper_eyelid_L':['Upper palpebral conjunctiva','Conjunctival lining of the inner upper eyelid.'],
'VH_M_pupil_L':['Pupil','Opening in the iris through which light enters the eye.'],
'VH_M_retina_L':['Retina','Light-sensitive neural tissue that converts light into electrical signals.'],
'VH_M_fovea_L':['Fovea','Central retinal region responsible for the highest visual acuity.'],
'VH_M_macula_lutea_L':['Macula lutea','Central retinal area used for detailed central vision.'],
'VH_M_optic_disc_L':['Optic disc','Region where retinal ganglion-cell axons leave the eye; the physiological blind spot.'],
'VH_M_schlemms_canal_L':['Schlemm’s canal','Circular drainage channel that receives aqueous humour from the trabecular meshwork.'],
'VH_M_sclera_L':['Sclera','Tough white outer coat that protects the eye and maintains its shape.'],
'VH_M_suspensory_ligament_of_lens_L':['Suspensory ligaments (zonules)','Fibres connecting the ciliary body to the lens capsule.'],
'VH_M_trabecular_meshwork_L':['Trabecular meshwork','Porous tissue that provides the main conventional outflow route for aqueous humour.'],
'VH_M_vitreous_humor_L':['Vitreous humour','Transparent gel filling the large posterior cavity behind the lens.']
};
let selected=null,mode='anatomy',exploded=false;
const initiallyHidden = new Set(['VH_M_sclera_L','VH_M_vitreous_humor_L','VH_M_bulbar_conjunctiva_L','VH_M_palpebral_conjunctiva_of_lower_eyelid_L','VH_M_palpebral_conjunctiva_of_upper_eyelid_L']);
function labelFor(obj){return names[obj.name]?.[0]||obj.name.replace(/^VH_M_/,'').replace(/_L$/,'').replaceAll('_',' ')}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
window.addEventListener('resize',resize);resize();
function frameObject(obj){const box=new THREE.Box3().setFromObject(obj);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());obj.position.sub(center);const max=Math.max(size.x,size.y,size.z);camera.position.set(0,0,max*1.8);controls.target.set(0,0,0);controls.update()}
function select(obj){selected=obj;document.querySelectorAll('.structure').forEach(el=>el.classList.toggle('selected',el.dataset.mesh===obj?.name));document.querySelector('#selectedName').textContent=obj?labelFor(obj):'Select a structure';document.querySelector('#selectedDesc').textContent=obj?(names[obj.name]?.[1]||'Anatomical mesh from the HRA reference model.'):'Choose a structure to highlight it and view its controls.';document.querySelector('#opacity').value=obj?Math.round((obj.material.opacity??1)*100):100;document.querySelector('#opacityValue').textContent=(document.querySelector('#opacity').value)+'%'}
function buildList(){const list=document.querySelector('#structureList');list.innerHTML='';anatomy.forEach(obj=>{const row=document.createElement('div');row.className='structure';row.dataset.mesh=obj.name;const eye=document.createElement('input');eye.type='checkbox';eye.checked=obj.visible;eye.title='Show or hide';eye.onchange=()=>obj.visible=eye.checked;const title=document.createElement('span');title.className='name';title.textContent=labelFor(obj);title.onclick=()=>select(obj);const iso=document.createElement('button');iso.textContent='Focus';iso.onclick=()=>{select(obj);anatomy.forEach(m=>m.visible=m===obj);};row.append(eye,title,iso);list.append(row)})}
function loadGLB(url,target){return new Promise((resolve,reject)=>loader.load(url,g=>{g.scene.traverse(o=>{if(o.isMesh){o.userData.basePosition=o.position.clone();o.material=o.material.clone();o.material.side=THREE.DoubleSide;o.material.transparent=true;o.material.depthWrite=o.material.opacity>=.99;target.push(o);}});resolve(g.scene)},undefined,reject))}
await loadGLB('./models/eye-anatomy.glb',anatomy).then(obj=>{
 root.add(obj);frameObject(obj);
 anatomy.forEach(o=>{if(initiallyHidden.has(o.name))o.visible=false;});
 buildList();document.querySelector('#loading').remove();
}).catch(e=>{
 document.querySelector('#loading').textContent='Could not load anatomy GLB: '+(e?.message||e)+'. Upload models/eye-anatomy.glb to this repository and use an HTTPS web server.';
 console.error('Anatomy GLB load error:',e);
});
await loadGLB('./models/human_eye.glb',exterior).then(obj=>{obj.visible=false;root.add(obj)}).catch(e=>console.warn('Exterior GLB not loaded; upload models/human_eye.glb',e));
function setMode(next){mode=next;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelector('#modeTitle').textContent=mode==='anatomy'?'Internal anatomy':'Exterior view';anatomy.forEach(o=>o.visible=mode==='anatomy'&&!initiallyHidden.has(o.name));exterior.forEach(o=>o.visible=mode==='exterior');if(mode==='anatomy')buildList();else document.querySelector('#structureList').innerHTML='<p class="hint">Exterior model: DEGUIDER Sketchfab GLB. Its source file contains two meshes (eye body and iris).</p>';select(null);exploded=false}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelector('#search').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.structure').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'flex':'none')};
document.querySelector('#opacity').oninput=e=>{if(!selected)return;const v=Number(e.target.value)/100;selected.material.opacity=v;selected.material.transparent=v<1;selected.material.depthWrite=v>=.99;document.querySelector('#opacityValue').textContent=e.target.value+'%'};
document.querySelector('#hideSelected').onclick=()=>{if(selected){selected.visible=false;buildList();select(null)}};
document.querySelector('#showAll').onclick=()=>{anatomy.forEach(o=>{o.visible=true;o.position.copy(o.userData.basePosition)});exploded=false;buildList()};
document.querySelector('#isolate').onclick=()=>{if(selected){anatomy.forEach(o=>o.visible=o===selected);buildList()}};
document.querySelector('#reset').onclick=()=>{anatomy.forEach(o=>{o.visible=!initiallyHidden.has(o.name);o.position.copy(o.userData.basePosition)});frameObject(root);buildList();select(null);exploded=false};
document.querySelector('#explode').onclick=()=>{if(mode!=='anatomy')return;exploded=!exploded;const center=new THREE.Vector3();new THREE.Box3().setFromObject(root).getCenter(center);anatomy.forEach((o,i)=>{const p=o.userData.basePosition.clone();if(exploded){const dir=o.getWorldPosition(new THREE.Vector3()).sub(center).normalize();p.add(dir.multiplyScalar(.12+(i%4)*.025))}o.position.copy(p)})};
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
