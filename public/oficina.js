import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- constantes ----------
const ESTADOS = {
  leyendo: ['Leyendo', '#4fa8ff'],
  editando: ['Editando', '#45c86a'],
  comando: ['Corriendo comando', '#22bfa0'],
  consultando: ['Consultando', '#a07cff'],
  delegando: ['Delegando', '#ffb72e'],
  pensando: ['Pensando', '#9aa8b8'],
  trabajando: ['Trabajando', '#5fbfb8'],
  pregunta: ['Tiene una pregunta', '#ff7a59'],
  compactando: ['Ordenando memoria', '#c196e6'],
  listo: ['Listo', '#c3ccd6'],
};
const COLORES = ['#5b8def', '#ef6f6c', '#3fb393', '#f29e4c', '#9b6fd6', '#e8689f', '#38aecb', '#8ab33c'];
const PELOS = ['#3b2a20', '#6b4423', '#1f1f24', '#a8662f', '#d9b36c', '#5a3a2e'];
const PIELES = ['#f3cfb3', '#e7b897', '#c98e6a', '#a86f4f', '#f6dcc6'];
const PAREDES = ['#f4d9cc', '#d3e4f4', '#d8ecd2', '#eadcf3', '#f6e8c3', '#cfeceb'];
const ALFOMBRAS = ['#e98f7c', '#7fa7d9', '#86c08f', '#b195d6', '#e6c164', '#6cbcb6'];
const SALA = 9.6;
const MITAD = SALA / 2;
// Puestos dentro de la sala [x, z]: el agente se sienta ahi mirando a la plaza (+z).
const PUESTOS = [[0, -0.4], [-2.9, -0.4], [2.9, -0.4], [0, -3.0], [-2.9, -3.0], [2.9, -3.0], [0, 2.2], [-2.9, 2.2], [2.9, 2.2]];

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const corto = (t, n) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t || '');
const suave = (actual, meta, dt, vel = 8) => actual + (meta - actual) * Math.min(1, dt * vel);

// ---------- escena ----------
const cont = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Modo ligero: sin sombras reales, resolucion 1x y 30 cuadros por segundo.
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
cont.appendChild(renderer.domElement);

const capa = new CSS2DRenderer();
capa.setSize(innerWidth, innerHeight);
capa.domElement.className = 'capa-etiquetas';
cont.appendChild(capa.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe8f1');

// Camara isometrica fija (tipo LoL): arrastrar mueve, la rueda acerca.
const VISTA = 17;
const camera = new THREE.OrthographicCamera(-VISTA, VISTA, VISTA, -VISTA, 0.1, 400);
function encuadrar() {
  const aspecto = innerWidth / innerHeight;
  Object.assign(camera, { left: -VISTA * aspecto, right: VISTA * aspecto, top: VISTA, bottom: -VISTA });
  camera.updateProjectionMatrix();
}
encuadrar();
camera.position.set(100, 115, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableDamping = true;
controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.minZoom = 0.6;
controls.maxZoom = 4;

const hemi = new THREE.HemisphereLight('#ffffff', '#c9b79c', 1.4);
scene.add(hemi);
const sol = new THREE.DirectionalLight('#fff3e0', 1.6);
sol.position.set(22, 36, 8);
scene.add(sol);

const materiales = new Map();
function mat(color) {
  if (!materiales.has(color)) materiales.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return materiales.get(color);
}
function malla(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const caja = (w, h, d, color, x, y, z) => malla(new THREE.BoxGeometry(w, h, d), color, x, y, z);
function etiqueta(clase, html = '') {
  const div = document.createElement('div');
  div.className = clase;
  div.innerHTML = html;
  return new CSS2DObject(div);
}

// ---------- mundo ----------
let semilla = 11;
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;

const isla = malla(new THREE.CylinderGeometry(64, 60, 3, 32), '#b9d8a3', 0, -1.5, 0);
isla.material = isla.material.clone();
isla.castShadow = false;
scene.add(isla);
const orilla = malla(new THREE.CylinderGeometry(60, 52, 6, 32), '#c9a77e', 0, -6, 0);
orilla.material = orilla.material.clone();
scene.add(orilla);

const plaza = malla(new THREE.CylinderGeometry(4.8, 5, 0.18, 24), '#f1e7d6', 0, 0.09, 0);
plaza.material = plaza.material.clone();
scene.add(plaza);
const pisos = [isla, plaza]; // donde tu avatar puede caminar con clic
const COLOR_ISLA_ORIG = isla.material.color.clone();
const COLOR_ORILLA_ORIG = orilla.material.color.clone();
const COLOR_PLAZA_ORIG = plaza.material.color.clone();
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.2;
  const arbusto = malla(new THREE.IcosahedronGeometry(0.55, 0), i % 2 ? '#79b46c' : '#68a77a', Math.sin(a) * 4.4, 0.45, Math.cos(a) * 4.4);
  arbusto.scale.y = 0.8;
  if (i % 4 === 1) scene.add(arbusto);
}
const farol = new THREE.Group();
farol.add(caja(0.14, 2.4, 0.14, '#3d4652', 0, 1.2, 0));
farol.add(malla(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd77a', emissiveIntensity: 0.8, flatShading: true }), 0, 2.5, 0));
farol.position.set(-3.6, 0.18, 2.6);
scene.add(farol);

// ---------- dia y noche ----------
// Sigue la hora de tu reloj. Para verlo sin esperar: ?hora=21 la fija, ?ciclo=2 da la vuelta al dia en 2 minutos.
const paramsCielo = new URLSearchParams(location.search);
const horaFija = paramsCielo.has('hora') ? ((Number(paramsCielo.get('hora')) % 24) + 24) % 24 : null;
const minutosCiclo = Number(paramsCielo.get('ciclo')) || 0;
// [hora, fondo, luz de arriba, luz de abajo, su intensidad, color del sol, su intensidad, luces encendidas 0-1]
const momentos = [
  [0, '#1d2542', '#5d6c9e', '#2b2a3a', 0.6, '#9aaee0', 0.35, 1],
  [5, '#1d2542', '#5d6c9e', '#2b2a3a', 0.6, '#9aaee0', 0.35, 1],
  [6.5, '#f1c7a6', '#ffd9c0', '#b9a58c', 1.0, '#ffb27a', 1.0, 0.3],
  [9, '#dfe8f1', '#ffffff', '#c9b79c', 1.4, '#fff3e0', 1.6, 0],
  [17, '#dfe8f1', '#ffffff', '#c9b79c', 1.4, '#fff3e0', 1.6, 0],
  [18.5, '#f0b088', '#ffd2b0', '#b59a80', 1.1, '#ff9b5c', 1.1, 0.4],
  [20, '#2a3156', '#6a76a8', '#33303f', 0.65, '#9aaad8', 0.4, 1],
  [24, '#1d2542', '#5d6c9e', '#2b2a3a', 0.6, '#9aaee0', 0.35, 1],
].map(([h, ...v]) => ({ h, v: v.map((x) => (typeof x === 'string' ? new THREE.Color(x) : x)) }));
const luzFarol = new THREE.PointLight('#ffcf7a', 0, 10, 2);
luzFarol.position.set(-3.6, 2.7, 2.6);
scene.add(luzFarol);
const bombilla = farol.children[1].material;
const COLOR_FAROL_ORIG = bombilla.color.clone();
const COLOR_LUZ_FAROL_ORIG = luzFarol.color.clone();
const vidrioDia = new THREE.Color('#9fd3ff');
const vidrioNoche = new THREE.Color('#ffc46b');
const ahora = new Date();
const horaInicio = ahora.getHours() + ahora.getMinutes() / 60;

function horaDelDia(t) {
  if (horaFija !== null) return horaFija;
  if (minutosCiclo) return (horaInicio + (t * 24) / (minutosCiclo * 60)) % 24;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

let horaPintada = -1;
function pintarCielo(t) {
  const h = horaDelDia(t);
  if (Math.abs(h - horaPintada) < 0.01) return; // cambia despacio: no hace falta recalcular cada cuadro
  horaPintada = h;
  const i = momentos.findIndex((m) => m.h > h);
  const [a, b] = [momentos[i - 1], momentos[i]];
  const k = (h - a.h) / (b.h - a.h);
  const [fondo, arriba, abajo, intensidad, colorSol, intensidadSol, luces] = a.v.map((x, j) => (x.isColor ? x.clone().lerp(b.v[j], k) : x + (b.v[j] - x) * k));
  scene.background.copy(fondo);
  hemi.color.copy(arriba);
  hemi.groundColor.copy(abajo);
  hemi.intensity = intensidad;
  sol.color.copy(colorSol);
  sol.intensity = intensidadSol;
  // De dia el sol y de noche la luna cruzan de este a oeste.
  const arco = (((h + 18) % 12) / 12) * Math.PI;
  sol.position.set(Math.cos(arco) * 30, 12 + Math.sin(arco) * 28, 8);
  bombilla.emissiveIntensity = 0.8 + luces * 1.2;
  luzFarol.intensity = luces * 14;
  for (const sala of salas.values()) {
    for (const v of sala.ventanas) {
      v.emissive.copy(vidrioDia).lerp(vidrioNoche, luces);
      v.emissiveIntensity = 0.35 + luces * 0.8;
    }
  }
}

function arbol(x, z, s) {
  const g = new THREE.Group();
  g.add(caja(0.35, 1.3, 0.35, '#8a6446', 0, 0.65, 0));
  const verde = azar() > 0.5 ? '#6fae6a' : '#5c9c76';
  if (azar() > 0.35) {
    g.add(malla(new THREE.ConeGeometry(1.25, 2.4, 6), verde, 0, 2.1, 0));
    g.add(malla(new THREE.ConeGeometry(0.9, 1.8, 6), verde, 0, 3.2, 0));
  } else {
    g.add(malla(new THREE.IcosahedronGeometry(1.3, 0), verde, 0, 2.4, 0));
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = azar() * 6;
  scene.add(g);
  arboles.push(g);
}
const arboles = []; // se esconden los que quedan dentro de una sala
for (let i = 0; i < 45; i++) {
  const a = azar() * Math.PI * 2;
  const r = 42 + azar() * 18;
  arbol(Math.sin(a) * r, Math.cos(a) * r, 0.8 + azar() * 0.9);
}
for (let i = 0; i < 26; i++) {
  const a = azar() * Math.PI * 2;
  const r = 8 + azar() * 52;
  const roca = malla(new THREE.DodecahedronGeometry(0.3 + azar() * 0.4, 0), azar() > 0.5 ? '#c7c2b8' : '#b5b0a6', Math.sin(a) * r, 0.1, Math.cos(a) * r);
  roca.scale.y = 0.6;
  scene.add(roca);
}

// Sombra falsa (un circulo) en vez de sombras reales: mucho mas barato.
const sombraGeo = new THREE.CircleGeometry(0.42, 12);
const sombraMat = new THREE.MeshBasicMaterial({ color: '#2b3440', transparent: true, opacity: 0.18, depthWrite: false });

// ---------- personas ----------
function crearPersona(color, { ayudante = false, semillaId = '' } = {}) {
  const h = hash(semillaId);
  const piel = PIELES[h % PIELES.length];
  const pelo = PELOS[(h >> 3) % PELOS.length];
  const g = new THREE.Group();
  const cadera = new THREE.Group();
  cadera.position.y = 0.47;
  g.add(cadera);
  const sombra = new THREE.Mesh(sombraGeo, sombraMat);
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  g.add(sombra);

  const piernas = [-0.1, 0.1].map((x) => {
    const p = new THREE.Group();
    p.position.x = x;
    p.add(caja(0.14, 0.46, 0.15, '#3d4a5c', 0, -0.23, 0));
    p.add(caja(0.15, 0.08, 0.22, '#2a2f38', 0, -0.44, 0.04));
    cadera.add(p);
    return p;
  });
  const torso = malla(new THREE.CylinderGeometry(0.2, 0.27, 0.56, 7), color, 0, 0.28, 0);
  cadera.add(torso);
  cadera.add(malla(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 6), piel, 0, 0.6, 0));

  const cabeza = new THREE.Group();
  cabeza.position.y = 0.78;
  cadera.add(cabeza);
  cabeza.add(malla(new THREE.IcosahedronGeometry(0.22, 1), piel));
  const cabello = malla(new THREE.SphereGeometry(0.235, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), pelo, 0, 0.02, -0.02);
  cabello.rotation.x = -0.25;
  cabeza.add(cabello);
  for (const x of [-0.08, 0.08]) cabeza.add(caja(0.045, 0.06, 0.02, '#262a31', x, 0.0, 0.205));
  if (ayudante) {
    const gorra = color;
    cabeza.add(malla(new THREE.CylinderGeometry(0.235, 0.235, 0.1, 8), gorra, 0, 0.14, 0));
    cabeza.add(caja(0.3, 0.03, 0.18, gorra, 0, 0.1, 0.2));
  }

  const brazos = [-0.28, 0.28].map((x) => {
    const b = new THREE.Group();
    b.position.set(x, 0.5, 0);
    b.add(caja(0.1, 0.38, 0.12, color, 0, -0.19, 0));
    b.add(malla(new THREE.IcosahedronGeometry(0.065, 0), piel, 0, -0.42, 0));
    cadera.add(b);
    return b;
  });

  const puntos = new THREE.Group();
  puntos.position.y = 1.55;
  for (let i = 0; i < 3; i++) puntos.add(malla(new THREE.IcosahedronGeometry(0.06, 0), '#ffffff', (i - 1) * 0.16, 0, 0));
  puntos.visible = false;
  g.add(puntos);

  if (ayudante) g.scale.setScalar(0.85);
  return { g, cadera, piernas, brazos, cabeza, puntos };
}

// Tu avatar en la plaza.
const yo = crearPersona('#f2b134', { semillaId: 'yo' });
yo.g.position.set(0, 0.18, 2.5);
yo.g.rotation.y = Math.atan2(camera.position.x, camera.position.z);
scene.add(yo.g);
const etiquetaYo = etiqueta('etiqueta-yo', 'Tú');
etiquetaYo.position.y = 1.95;
yo.g.add(etiquetaYo);
const anillo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.5, 40), new THREE.MeshBasicMaterial({ color: '#ff7a59', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
anillo.rotation.x = -Math.PI / 2;
anillo.position.y = 0.2;
anillo.visible = false;
scene.add(anillo);

// CSS2DRenderer solo quita los divs del objeto que se quita, no los de sus hijos.
function quitarDeEscena(obj) {
  obj.removeFromParent();
  obj.traverse((o) => o.isCSS2DObject && o.element.remove());
}

// ---------- barrios: un pedazo de isla por dueño ----------
// Con un solo dueño todo queda alrededor de la plaza, como siempre; con varios, cada uno
// tiene su barrio (su placita y sus salas) en un anillo alrededor de la plaza del centro.
let barrios = new Map(); // dueno -> { x, z, adornos }
function centroBarrio(k, n) {
  if (n <= 1) return { x: 0, z: 0 };
  const R = Math.max(28, 22 / Math.sin(Math.PI / n)); // shortcut: con mas de 5 dueños los barrios se salen de la isla
  const a = (k / n) * Math.PI * 2;
  return { x: Math.sin(a) * R, z: Math.cos(a) * R };
}

function armarBarrios(duenos) {
  for (const p of [...personas.values()]) quitarPersona(p);
  for (const sala of salas.values()) {
    quitarDeEscena(sala.g);
    quitarDeEscena(sala.cartel);
  }
  salas.clear();
  pisos.length = 2; // isla y plaza
  for (const b of barrios.values()) b.adornos.forEach(quitarDeEscena);
  for (const a of arboles) a.visible = true;
  barrios = new Map(duenos.map((d, k) => [d, { ...centroBarrio(k, duenos.length), adornos: [] }]));
  if (duenos.length < 2) return;
  for (const [dueno, b] of barrios) {
    const placita = malla(new THREE.CylinderGeometry(4.2, 4.4, 0.06, 24), COLORES[hash(dueno) % COLORES.length], b.x, 0.03, b.z);
    placita.material = placita.material.clone();
    placita.material.transparent = true;
    placita.material.opacity = 0.35;
    const letrero = etiqueta('etiqueta-sala', `<b>Barrio de ${esc(dueno || 'anfitrión')}</b>`);
    letrero.position.set(b.x, 1.2, b.z);
    scene.add(placita, letrero);
    b.adornos.push(placita, letrero);
  }
}

// ---------- salas ----------
const salas = new Map();

function posicionSala(i) {
  const vuelta = Math.floor(i / 6);
  const ang = ((i % 6) / 6) * Math.PI * 2 + Math.PI / 6 + vuelta * (Math.PI / 6);
  const r = 15 + vuelta * 13; // shortcut: mas de 12 proyectos a la vez chocarian con los arboles
  return { x: Math.sin(ang) * r, z: Math.cos(ang) * r, ang, r };
}

function planta(x, z) {
  const g = new THREE.Group();
  g.add(malla(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 7), '#c8775a', 0, 0.22, 0));
  g.add(malla(new THREE.IcosahedronGeometry(0.45, 0), '#5fa766', 0, 0.75, 0));
  g.add(malla(new THREE.IcosahedronGeometry(0.3, 0), '#77bb6d', 0.15, 1.05, 0.05));
  g.position.set(x, 0, z);
  return g;
}

function obtenerSala(nombre, dueno) {
  if (salas.has(nombre)) return salas.get(nombre);
  const centro = barrios.get(dueno) || { x: 0, z: 0 };
  const pos = posicionSala([...salas.values()].filter((s) => s.dueno === dueno).length);
  const { ang, r } = pos;
  const x = centro.x + pos.x;
  const z = centro.z + pos.z;
  for (const a of arboles) if (Math.hypot(a.position.x - x, a.position.z - z) < 8) a.visible = false;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ang + Math.PI; // +z local apunta a la plaza
  scene.add(g);
  const h = hash(nombre);
  const pared = PAREDES[h % PAREDES.length];

  for (let k = 0; k < 6; k++) {
    const tabla = caja(SALA / 6, 0.25, SALA, k % 2 ? '#e2c39b' : '#d9b78d', -MITAD + SALA / 12 + (k * SALA) / 6, 0.125, 0);
    g.add(tabla);
    pisos.push(tabla);
  }
  // Las dos paredes van en grupos propios para transparentarlas cuando tapan la vista.
  const fondo = new THREE.Group();
  const lado = new THREE.Group();
  g.add(fondo, lado);
  fondo.add(caja(SALA, 2.4, 0.25, pared, 0, 1.45, -MITAD + 0.125));
  lado.add(caja(0.25, 2.4, SALA, pared, -MITAD + 0.125, 1.45, 0));
  fondo.add(caja(SALA + 0.1, 0.14, 0.36, '#fbfaf7', 0, 2.72, -MITAD + 0.125));
  lado.add(caja(0.36, 0.14, SALA + 0.1, '#fbfaf7', -MITAD + 0.125, 2.72, 0));
  const vidrio = new THREE.MeshStandardMaterial({ color: '#cfeaff', emissive: '#9fd3ff', emissiveIntensity: 0.35, flatShading: true });
  fondo.add(malla(new THREE.BoxGeometry(2.6, 1.1, 0.06), vidrio, 2.1, 1.65, -MITAD + 0.27));
  lado.add(malla(new THREE.BoxGeometry(0.06, 1.1, 2.6), vidrio.clone(), -MITAD + 0.27, 1.65, 1.6));
  for (const muro of [fondo, lado]) muro.traverse((o) => o.isMesh && (o.material = Object.assign(o.material.clone(), { transparent: true })));
  g.add(caja(4.8, 0.03, 3.0, ALFOMBRAS[h % ALFOMBRAS.length], 0, 0.265, -1.7));
  g.add(planta(MITAD - 0.6, -MITAD + 0.7));
  g.children.at(-1).position.y = 0.25;
  g.add(planta(-MITAD + 0.7, MITAD - 0.6));
  g.children.at(-1).position.y = 0.25;
  const librero = new THREE.Group();
  librero.add(caja(0.45, 1.8, 1.9, '#b58a63', 0, 0.9, 0));
  ['#e06c5a', '#5b8def', '#f2b134', '#3fb393', '#9b6fd6'].forEach((c, i) => librero.add(caja(0.3, 0.42, 0.22, c, 0.1, 0.5 + (i % 2) * 0.62, -0.7 + i * 0.32)));
  librero.position.set(-MITAD + 0.5, 0.25, -1.4);
  g.add(librero);

  // Camino de piedras hasta la plaza.
  for (let d = MITAD + 0.9; d < r - 5.2; d += 1.15) {
    const piedra = malla(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 7), '#e7dfd1', (hash(nombre + d) % 5) * 0.08 - 0.16, 0.04, d);
    piedra.castShadow = false;
    g.add(piedra);
  }

  const interior = new THREE.Group();
  interior.position.y = 0.25;
  g.add(interior);
  const cartel = etiqueta('etiqueta-sala', `<b>${esc(nombre)}</b><span></span>`);
  // En la esquina mas lejana a la camara (que es fija), para no tapar a nadie.
  cartel.position.set(x - 4.2, 3.4, z - 4.2);
  scene.add(cartel);
  g.updateMatrixWorld(true);

  const muros = [
    { grupo: fondo, eje: 'z', normal: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y), opacidad: 1 },
    { grupo: lado, eje: 'x', normal: new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y), opacidad: 1 },
  ];
  const ventanas = [];
  for (const muro of [fondo, lado]) muro.traverse((o) => o.isMesh && o.material.isMeshStandardMaterial && ventanas.push(o.material));
  horaPintada = -1; // la sala nueva toma la luz de la hora actual
  const sala = { nombre, dueno, centro, g, interior, ang, cartel, muros, ventanas, puestos: Array(PUESTOS.length).fill(null), escritorios: [] };
  salas.set(nombre, sala);
  if (typeof decorarSalaEstacional === 'function') decorarSalaEstacional(sala);
  return sala;
}

function escritorio(sala, k) {
  if (sala.escritorios[k]) return sala.escritorios[k];
  const [x, z] = PUESTOS[k];
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(caja(1.5, 0.07, 0.75, '#c99b6b', 0, 0.76, 0.72));
  for (const [lx, lz] of [[-0.68, 0.4], [0.68, 0.4], [-0.68, 1.04], [0.68, 1.04]]) g.add(caja(0.07, 0.74, 0.07, '#8b6a4a', lx, 0.37, lz));
  g.add(caja(0.09, 0.22, 0.09, '#3a3f47', 0, 0.9, 0.98));
  g.add(caja(0.82, 0.52, 0.06, '#3a3f47', 0, 1.22, 1.0));
  const pantalla = new THREE.MeshStandardMaterial({ color: '#1d2430', emissive: '#9aa8b8', emissiveIntensity: 0.8 });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.42), pantalla);
  tela.position.set(0, 1.22, 0.966);
  tela.rotation.y = Math.PI;
  g.add(tela);
  const foco = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#9aa8b8', emissiveIntensity: 1.2, flatShading: true });
  g.add(malla(new THREE.IcosahedronGeometry(0.08, 0), foco, 0.36, 1.56, 1.0));
  g.add(caja(0.56, 0.03, 0.18, '#eef1f5', 0, 0.81, 0.56));
  g.add(malla(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), COLORES[(hash(sala.nombre) + k) % COLORES.length], -0.55, 0.86, 0.6));
  const silla = '#4b5563';
  g.add(caja(0.56, 0.08, 0.54, silla, 0, 0.41, 0));
  g.add(caja(0.56, 0.58, 0.08, silla, 0, 0.76, -0.28));
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6), '#2f3640', 0, 0.2, 0));
  g.add(caja(0.5, 0.04, 0.5, '#2f3640', 0, 0.03, 0));
  sala.interior.add(g);
  sala.g.updateMatrixWorld(true);
  sala.escritorios[k] = { pantalla, foco };
  return sala.escritorios[k];
}

const mundo = (sala, x, y, z) => sala.interior.localToWorld(new THREE.Vector3(x, y, z));
const pasillo = (x) => (x > 1 ? x - 1.45 : x + 1.45);

// ---------- estado de la pagina ----------
const personas = new Map();
window.oficina = { personas, get camera() { return camara; }, get modo() { return modo; }, get yo() { return yo; } }; // para inspeccionar desde la consola
let fotoActual = { sesiones: [] };
let primeraFoto = true;
let seleccion = null;
let objetivoCamara = null;

function puestoDe(p) {
  if (p.puesto < 0) return mundo(p.sala, 3.6 - (p.extra % 4) * 0.7, 0, 3.9);
  const [x, z] = PUESTOS[p.puesto];
  return mundo(p.sala, x, 0, z);
}
function rutaSalida(p) {
  const [x, z] = p.puesto < 0 ? [3.6, 3.9] : PUESTOS[p.puesto];
  const px = pasillo(x);
  return [mundo(p.sala, px, 0, z), mundo(p.sala, px, -0.25, MITAD + 1.2)];
}

function nuevaPersona(id, e) {
  const sala = obtenerSala(e.sesion.proyecto, e.sesion.dueno || '');
  const color = COLORES[hash(e.sesion.id) % COLORES.length];
  const cuerpo = crearPersona(color, { ayudante: e.ayudante, semillaId: id });
  scene.add(cuerpo.g);
  let puesto = sala.puestos.indexOf(null);
  if (puesto >= 0) sala.puestos[puesto] = id;
  const p = {
    id, ...cuerpo, sala, puesto, extra: personas.size, color, ayudante: e.ayudante,
    lugar: 'escritorio', ruta: [], datos: e.datos, sesion: e.sesion, fase: Math.random() * 6,
    pill: etiqueta('pill'), burbuja: etiqueta('burbuja'), adios: 0,
  };
  p.pill.position.y = 1.9;
  p.burbuja.position.y = 2.55;
  p.burbuja.visible = false;
  p.g.add(p.pill, p.burbuja);
  p.g.traverse((o) => (o.userData.persona = id));
  if (puesto >= 0) escritorio(sala, puesto);

  const asiento = puestoDe(p);
  if (primeraFoto) {
    p.g.position.copy(asiento);
  } else {
    // Llega caminando desde la puerta.
    const [entrada, puerta] = rutaSalida(p);
    p.g.position.copy(puerta).lerp(new THREE.Vector3(sala.centro.x, 0.18, sala.centro.z), 0.25);
    p.ruta = [puerta, entrada, asiento];
    p.lugar = 'llegando';
  }
  personas.set(id, p);
  return p;
}

function quitarPersona(p) {
  if (p.puesto >= 0 && p.sala.puestos[p.puesto] === p.id) p.sala.puestos[p.puesto] = null;
  quitarDeEscena(p.g);
  personas.delete(p.id);
  if (seleccion === p.id) seleccion = null;
}

function quienVisita(s) {
  if (!s.espera || !['permiso', 'pregunta'].includes(s.espera.tipo)) return null;
  return s.espera.de && s.agentes.some((a) => a.id === s.espera.de) ? `${s.id}/${s.espera.de}` : s.id;
}

function sincronizar(foto) {
  fotoActual = foto;
  // Si llega o se va un dueño, se rehace el reparto de barrios (los agentes reaparecen en su escritorio).
  const duenos = [...new Set(foto.sesiones.map((s) => s.dueno || ''))].sort();
  if (duenos.join('\n') !== [...barrios.keys()].join('\n')) {
    armarBarrios(duenos);
    primeraFoto = true;
  }
  const vivos = new Set();
  for (const s of foto.sesiones) {
    const entradas = [{ id: s.id, datos: s, ayudante: false, sesion: s }, ...s.agentes.map((a) => ({ id: `${s.id}/${a.id}`, datos: a, ayudante: true, sesion: s }))];
    const visita = quienVisita(s);
    for (const e of entradas) {
      vivos.add(e.id);
      const p = personas.get(e.id) || nuevaPersona(e.id, e);
      p.datos = e.datos;
      p.sesion = s;
      p.pideVisita = e.id === visita;
    }
  }
  for (const p of [...personas.values()]) if (!vivos.has(p.id)) quitarPersona(p);
  ubicarVisitantes();
  for (const sala of salas.values()) {
    const n = foto.sesiones.filter((s) => s.proyecto === sala.nombre).reduce((t, s) => t + 1 + s.agentes.length, 0);
    sala.cartel.element.classList.toggle('vacia', n === 0);
    sala.cartel.element.querySelector('span').textContent = n === 0 ? 'sin nadie' : n === 1 ? '1 trabajando' : `${n} trabajando`;
  }
  primeraFoto = false;
  revisarClaude();
  pintarPanel();
}

// Cada agente busca a su dueño: tu avatar si la sesion es tuya, el muñeco del amigo si es suya.
// Si su dueño no tiene la pagina abierta, se queda en su escritorio.
let miNombre = null;
const esMia = (s) => !s.dueno || s.dueno === miNombre;
function anfitrionDe(s) {
  if (esMia(s)) return yo.g;
  for (const o of otros.values()) if (o.meta.nombre === s.dueno) return o.c.g;
  return null;
}

// Quien busca a alguien se para alrededor de su avatar, del lado de su sala; si se mueve, lo sigue.
function ubicarVisitantes() {
  const porAnfitrion = new Map();
  for (const p of personas.values()) {
    p.anfitrion = p.pideVisita ? anfitrionDe(p.sesion) : null;
    p.quiereVisitar = Boolean(p.anfitrion);
    if (p.anfitrion) porAnfitrion.set(p.anfitrion, [...(porAnfitrion.get(p.anfitrion) || []), p]);
  }
  for (const [anfitrion, visitantes] of porAnfitrion) {
    const pos = anfitrion.position;
    visitantes.forEach((p, j) => {
      const haciaSala = Math.atan2(p.sala.g.position.x - pos.x, p.sala.g.position.z - pos.z);
      const a = haciaSala + (j - (visitantes.length - 1) / 2) * 0.6;
      p.lugarVisita = new THREE.Vector3(pos.x + Math.sin(a) * 1.6, pos.y, pos.z + Math.cos(a) * 1.6);
      if (p.lugar === 'yendo' && p.ruta.length) p.ruta[p.ruta.length - 1] = p.lugarVisita.clone();
    });
  }
}

// ---------- animacion ----------
function textoEstado(p) {
  const d = p.datos;
  if (p.sesion.dormido && !p.ayudante) return ['Dormido', '#b8c0ca', ''];
  if (d.terminado) return ['Terminó', '#45c86a', ''];
  if (!p.ayudante && p.sesion.espera && p.sesion.espera.tipo === 'mensaje') return ['Te espera', '#ff9f43', ''];
  const [txt, color] = ESTADOS[d.estado] || ESTADOS.trabajando;
  return [txt, color, d.detalle];
}

function animarPersona(p, t, dt) {
  const [txt, color, det] = textoEstado(p);
  const conDetalle = det && (!p.ayudante || seleccion === p.id);
  const pillHtml = `<i style="--c:${color}"></i><span>${esc(txt)}</span>${conDetalle ? `<small>${esc(corto(det, 34))}</small>` : ''}`;
  if (p.pillHtml !== pillHtml) {
    p.pill.element.innerHTML = pillHtml;
    p.pillHtml = pillHtml;
  }
  p.pill.element.className = `pill${p.ayudante ? ' ayudante' : ''}${seleccion === p.id ? ' sel' : ''}`;

  // Decidir a donde va.
  if (p.datos.terminado && p.lugar === 'escritorio') {
    p.adios += dt;
    if (p.adios > 3) {
      p.ruta = rutaSalida(p);
      p.ruta.push(p.ruta[1].clone().multiplyScalar(0.8));
      p.lugar = 'saliendo';
    }
  } else if (p.quiereVisitar && (p.lugar === 'escritorio' || p.lugar === 'volviendo') && p.lugarVisita) {
    const salida = p.lugar === 'escritorio' ? rutaSalida(p) : [];
    p.ruta = [...salida, p.lugarVisita.clone()];
    p.lugar = 'yendo';
  } else if (!p.quiereVisitar && (p.lugar === 'yendo' || p.lugar === 'visita')) {
    const [entrada, puerta] = rutaSalida(p);
    p.ruta = [puerta, entrada, puestoDe(p)];
    p.lugar = 'volviendo';
  } else if (p.quiereVisitar && p.lugar === 'visita' && p.lugarVisita && p.g.position.distanceTo(p.lugarVisita) > 0.3) {
    p.ruta = [p.lugarVisita.clone()];
  }

  const enEscritorio = p.lugar === 'escritorio';
  let caminando = false;
  if (p.ruta.length) {
    const meta = p.ruta[0];
    const delta = meta.clone().sub(p.g.position);
    const dist = delta.length();
    const paso = 2.8 * dt;
    if (dist <= paso) {
      p.g.position.copy(meta);
      p.ruta.shift();
      if (!p.ruta.length) {
        if (p.lugar === 'yendo') p.lugar = 'visita';
        else if (p.lugar === 'saliendo') p.g.visible = false;
        else if (p.lugar !== 'visita') p.lugar = 'escritorio';
      }
    } else {
      p.g.position.addScaledVector(delta, paso / dist);
      caminando = true;
    }
    if (dist > 0.01 && (Math.abs(delta.x) + Math.abs(delta.z)) > 0.01) {
      const rumbo = Math.atan2(delta.x, delta.z);
      let dif = rumbo - p.g.rotation.y;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      p.g.rotation.y += dif * Math.min(1, dt * 10);
    }
  } else if (enEscritorio) {
    let dif = p.sala.g.rotation.y - p.g.rotation.y;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    p.g.rotation.y += dif * Math.min(1, dt * 6);
  } else if (p.lugar === 'visita' && p.anfitrion) {
    const rumbo = Math.atan2(p.anfitrion.position.x - p.g.position.x, p.anfitrion.position.z - p.g.position.z);
    let dif = rumbo - p.g.rotation.y;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    p.g.rotation.y += dif * Math.min(1, dt * 6);
  }

  // Pose.
  const tt = t + p.fase;
  const estado = p.sesion.dormido && !p.ayudante ? 'dormido' : p.datos.estado;
  let piernas = 0, brazoI = -0.1, brazoD = -0.1, inclina = 0, cabezaX = 0, cabezaY = 0, cabezaZ = 0, salto = 0;
  if (caminando) {
    const s = Math.sin(tt * 11);
    piernas = null;
    p.piernas[0].rotation.x = s * 0.6;
    p.piernas[1].rotation.x = -s * 0.6;
    brazoI = -s * 0.5;
    brazoD = s * 0.5;
  } else if (enEscritorio && !p.datos.terminado) {
    piernas = -Math.PI / 2;
    switch (estado) {
      case 'editando': brazoI = -1.2 + Math.sin(tt * 20) * 0.12; brazoD = -1.2 + Math.sin(tt * 20 + 2) * 0.12; cabezaX = 0.12; break;
      case 'comando': brazoI = brazoD = -1.25 + Math.sin(tt * 7) * 0.05; inclina = 0.14; cabezaX = 0.08; break;
      case 'leyendo':
      case 'consultando': brazoI = brazoD = -0.75; cabezaX = 0.18; cabezaY = Math.sin(tt * 0.9) * 0.28; break;
      case 'delegando': brazoI = -0.6; brazoD = -2.7 + Math.sin(tt * 9) * 0.25; cabezaY = 0.3; break;
      case 'dormido': brazoI = brazoD = -0.1; cabezaX = 0.55; inclina = 0.12; break;
      case 'listo': brazoI = brazoD = -0.15; inclina = -0.12; cabezaZ = Math.sin(tt * 0.7) * 0.05; break;
      default: brazoI = -0.35; brazoD = -0.35; cabezaZ = Math.sin(tt * 1.3) * 0.1; cabezaX = -0.1;
    }
  } else if (p.reaccionGesto && t - p.reaccionGesto.inicio < p.reaccionGesto.duracion) {
    salto = Math.abs(Math.sin(tt * 8)) * 0.12;
    brazoD = -2.5 + Math.sin(tt * 12) * 0.25;
    cabezaZ = Math.sin(tt * 6) * 0.15;
  } else if (p.datos.terminado) {
    salto = Math.abs(Math.sin(tt * 6)) * 0.35;
    brazoI = brazoD = -2.9;
  } else if (p.lugar === 'visita') {
    brazoD = Math.sin(tt * 2.2) > 0.4 ? -2.6 + Math.sin(tt * 12) * 0.2 : -0.2;
    cabezaX = -0.15;
  }
  if (piernas !== null) for (const pierna of p.piernas) pierna.rotation.x = suave(pierna.rotation.x, piernas, dt);
  p.brazos[0].rotation.x = suave(p.brazos[0].rotation.x, brazoI, dt, 12);
  p.brazos[1].rotation.x = suave(p.brazos[1].rotation.x, brazoD, dt, 12);
  p.cadera.rotation.x = suave(p.cadera.rotation.x, inclina, dt);
  p.cabeza.rotation.x = suave(p.cabeza.rotation.x, cabezaX, dt, 5);
  p.cabeza.rotation.y = suave(p.cabeza.rotation.y, cabezaY, dt, 5);
  p.cabeza.rotation.z = suave(p.cabeza.rotation.z, cabezaZ, dt, 5);
  p.cadera.position.y = 0.47 + salto + (caminando ? Math.abs(Math.sin(tt * 11)) * 0.04 : 0);

  const pensar = enEscritorio && ['pensando', 'trabajando', 'compactando'].includes(estado);
  p.puntos.visible = pensar;
  if (pensar) p.puntos.children.forEach((b, i) => (b.position.y = Math.max(0, Math.sin(tt * 4 - i * 0.7)) * 0.12));

  // Pantalla y foco del escritorio.
  const mesa = p.puesto >= 0 ? p.sala.escritorios[p.puesto] : null;
  if (mesa) {
    const c = (ESTADOS[p.datos.estado] || ESTADOS.trabajando)[1];
    const presente = enEscritorio || p.lugar === 'llegando';
    mesa.pantalla.emissive.set(presente ? c : '#56606c');
    mesa.foco.emissive.set(color);
    let brillo = estado === 'dormido' ? 0.12 : estado === 'pensando' ? 0.45 : 0.95;
    if (estado === 'comando') brillo = 0.75 + Math.sin(tt * 28) * 0.2;
    mesa.pantalla.emissiveIntensity = presente ? brillo : 0.15;
    mesa.foco.emissiveIntensity = 1 + Math.sin(tt * 3) * 0.3;
  }

  // Burbuja cuando viene a preguntarte.
  const s = p.sesion;
  const mostrar = p.quiereVisitar && (p.lugar === 'visita' || p.lugar === 'yendo');
  // CSS2D no hereda la visibilidad del padre: si el agente ya salio por la puerta, sus etiquetas tambien.
  p.burbuja.visible = mostrar && p.g.visible;
  // De cerca (tercera/primera persona) solo se etiquetan los agentes proximos.
  p.pill.visible = p.g.visible && !mostrar && (modo === 'iso' || p.g.position.distanceTo(yo.g.position) < 12);
  if (mostrar) {
    const titulo = s.espera.tipo === 'permiso' ? 'Necesito tu permiso' : 'Tengo una pregunta';
    const html = `<b>${titulo}</b>${esc(corto(s.espera.texto, 120))}`;
    if (p.burbujaHtml !== html) {
      p.burbuja.element.innerHTML = html;
      p.burbujaHtml = html;
    }
  }
}

// ---------- panel ----------
const lista = document.getElementById('lista');
const detalle = document.getElementById('detalle');
const aviso = document.getElementById('aviso');
const vacio = document.getElementById('vacio');
const conexion = document.getElementById('conexion');

function nombreDe(p) {
  if (!p) return '';
  return p.ayudante ? p.datos.descripcion || p.datos.tipo : `Claude · ${p.sesion.id.split(':').pop().slice(0, 4)}`;
}

function fila(p) {
  const [txt, color, det] = textoEstado(p);
  return `<button type="button" class="fila${p.ayudante ? ' ayudante' : ''}${seleccion === p.id ? ' sel' : ''}" data-id="${esc(p.id)}">
    <span class="dot" style="background:${p.color}"></span>
    <span class="nombre">${esc(nombreDe(p))}</span>
    <span class="estado" style="--c:${color}">${esc(txt)}</span>
    ${det ? `<span class="det">${esc(det)}</span>` : ''}
  </button>`;
}

function pintarPanel() {
  const sesiones = fotoActual.sesiones;
  vacio.classList.toggle('si', sesiones.length === 0);
  const esperan = sesiones.filter((s) => quienVisita(s) && esMia(s));
  aviso.classList.toggle('si', esperan.length > 0);
  aviso.textContent = esperan.length === 1 ? '1 agente te espera' : `${esperan.length} agentes te esperan`;
  etiquetaYo.element.classList.toggle('llaman', esperan.length > 0);
  etiquetaYo.element.textContent = esperan.length ? `Tú · ${esperan.length} te ${esperan.length === 1 ? 'busca' : 'buscan'}` : 'Tú';
  anillo.visible = esperan.length > 0;

  pintarPuntos();
  let html = htmlConectados();
  if (esperan.length) {
    html += `<div class="grupo esperan"><h3>Te esperan</h3>${esperan.map((s) => personas.get(quienVisita(s)) || personas.get(s.id)).filter(Boolean).map(fila).join('')}</div>`;
  }
  const proyectos = [...new Set(sesiones.map((s) => s.proyecto))];
  for (const proyecto of proyectos) {
    html += `<div class="grupo"><h3>${esc(proyecto)}</h3>`;
    for (const s of sesiones.filter((x) => x.proyecto === proyecto)) {
      const principal = personas.get(s.id);
      if (principal) html += fila(principal);
      for (const a of s.agentes) {
        const p = personas.get(`${s.id}/${a.id}`);
        if (p) html += fila(p);
      }
    }
    html += '</div>';
  }
  lista.innerHTML = html;

  const sel = personas.get(seleccion);
  if (!sel) {
    detalle.innerHTML = '';
    return;
  }
  const s = sel.sesion;
  const hora = (t) => new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  detalle.innerHTML = `<h2>${esc(nombreDe(sel))}</h2>
    <div class="ruta">${esc(s.cwd)}</div>
    ${botonEditor(s.cwd)}
    <ol>${[...s.bitacora].reverse().map((b) => `<li><time>${hora(b.t)}</time><span><em>${esc(b.quien)}</em> ${esc(b.texto)}</span></li>`).join('') || '<li><span>Sin eventos todavía</span></li>'}</ol>`;
}

// El navegador le pasa el enlace al editor (Antigravity o VS Code), que enfoca
// la ventana de esa carpeta o la abre. El selector se recuerda en este navegador.
const EDITORES = { 'antigravity-ide': 'Antigravity', vscode: 'VS Code' };
const selectorEditor = document.getElementById('editor');
try {
  if (EDITORES[localStorage.getItem('editor')]) selectorEditor.value = localStorage.getItem('editor');
} catch {}
selectorEditor.addEventListener('change', () => {
  try {
    localStorage.setItem('editor', selectorEditor.value);
  } catch {}
  pintarPanel();
});
function botonEditor(cwd) {
  if (!cwd) return '';
  const esquema = selectorEditor.value;
  return `<a class="boton" href="${esc(`${esquema}://file/${encodeURI(cwd.replace(/\\/g, '/'))}`)}">Abrir en ${EDITORES[esquema]}</a>`;
}

function seleccionar(id, { mover = true } = {}) {
  seleccion = id;
  const p = personas.get(id);
  if (p && mover) objetivoCamara = p.g.position.clone();
  pintarPanel();
}

// Tarjeta con la pregunta o el permiso completo, cuando vas tu a ver al agente.
const tarjeta = document.getElementById('tarjeta');
function abrirTarjeta(p) {
  const s = p.sesion;
  if (!s.espera) return;
  const titulo = s.espera.tipo === 'permiso' ? 'Necesita tu permiso' : s.espera.tipo === 'pregunta' ? 'Tiene una pregunta' : 'Te espera';
  tarjeta.innerHTML = `<b>${esc(titulo)}</b>
    <p>${esc(s.espera.texto || 'Terminó y espera tu siguiente mensaje.')}</p>
    <div class="quien"><i style="background:${p.color}"></i>${esc(nombreDe(p))} · ${esc(s.proyecto)}</div>
    <div class="nota">Contéstale en su ventana de Claude Code.</div>
    <div class="acciones">
      ${botonEditor(s.cwd)}
      <button type="button" class="boton secundario" data-cerrar>Cerrar</button>
    </div>`;
  tarjeta.classList.add('si');
  if (document.pointerLockElement) document.exitPointerLock(); // para poder dar clic en sus botones
}
tarjeta.addEventListener('click', (e) => {
  if (e.target.closest('[data-cerrar], a')) tarjeta.classList.remove('si');
});

// Tu avatar camina hacia un punto (clic en el piso) o hacia un agente.
let yoDestino = null;
let yoBusca = null; // agente al que vas a ver
function caminarA(punto, agente = null) {
  yoDestino = punto.clone();
  yoBusca = agente;
  tarjeta.classList.remove('si');
  marca.position.set(punto.x, punto.y + 0.03, punto.z);
  marca.userData.vida = 1;
}
function irConAgente(p) {
  const hacia = yo.g.position.clone().sub(p.g.position).setY(0);
  if (hacia.length() < 0.01) hacia.set(0, 0, 1);
  caminarA(p.g.position.clone().add(hacia.normalize().multiplyScalar(1.3)).setY(p.g.position.y), p);
}

lista.addEventListener('click', (e) => {
  const b = e.target.closest('.fila');
  if (b) seleccionar(b.dataset.id);
});
aviso.addEventListener('click', () => {
  const s = fotoActual.sesiones.find((x) => quienVisita(x));
  const p = s && personas.get(quienVisita(s));
  if (!p) return;
  seleccionar(p.id);
  // Fuera de isometrica no hay caminata automatica (atravesaria paredes): solo se selecciona.
  if (modo === 'iso') irConAgente(p);
});
document.getElementById('plegar').addEventListener('click', (e) => {
  const plegado = document.getElementById('panel').classList.toggle('plegado');
  e.target.textContent = plegado ? 'Mostrar' : 'Ocultar';
});

// Clic (sin arrastrar): en un agente, tu avatar va a verlo; en el piso, camina hacia alla.
const rayo = new THREE.Raycaster();
const marca = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 24), new THREE.MeshBasicMaterial({ color: '#45c86a', transparent: true, opacity: 0, depthWrite: false }));
marca.rotation.x = -Math.PI / 2;
marca.userData.vida = 0;
scene.add(marca);
let abajo = null;
renderer.domElement.addEventListener('pointerdown', (e) => (abajo = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 5) return;
  if (modo !== 'iso') {
    tarjeta.classList.remove('si');
    renderer.domElement.requestPointerLock();
    return;
  }
  rayo.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const golpe = rayo.intersectObjects([...personas.values()].filter((p) => p.g.visible).map((p) => p.g), true)[0];
  if (golpe) {
    const p = personas.get(golpe.object.userData.persona);
    seleccionar(p.id, { mover: false });
    irConAgente(p);
    return;
  }
  const piso = rayo.intersectObjects(pisos, false)[0];
  if (piso) caminarA(piso.point);
});

// Avatar: camina, la camara lo sigue, y al llegar con un agente abre su tarjeta.
function moverYo(t, dt) {
  let caminando = false;
  if (yoDestino) {
    if (yoBusca && personas.get(yoBusca.id) !== yoBusca) yoBusca = null; // se fue
    const d = yoDestino.clone().sub(yo.g.position);
    const dist = Math.hypot(d.x, d.z);
    const paso = 3.6 * dt;
    if (dist <= paso) {
      yo.g.position.copy(yoDestino);
      yoDestino = null;
      if (yoBusca) {
        seleccionar(yoBusca.id, { mover: false });
        if (yoBusca.sesion.espera && quienVisita(yoBusca.sesion) === yoBusca.id) abrirTarjeta(yoBusca);
        else if (yoBusca.sesion.espera && yoBusca.sesion.espera.tipo === 'mensaje' && !yoBusca.ayudante) abrirTarjeta(yoBusca);
        yoBusca = null;
      }
    } else {
      yo.g.position.x += (d.x / dist) * paso;
      yo.g.position.z += (d.z / dist) * paso;
      yo.g.position.y = suave(yo.g.position.y, yoDestino.y, dt, 10);
      let dif = Math.atan2(d.x, d.z) - yo.g.rotation.y;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      yo.g.rotation.y += dif * Math.min(1, dt * 12);
      caminando = true;
      objetivoCamara = yo.g.position.clone();
    }
  }
  if (modo !== 'iso') caminando = moverConTeclas(dt) || caminando;
  if (caminando && yo.gestoActivo) cancelarGesto(yo);
  pasos(yo, caminando, t, dt);
  anillo.position.x = yo.g.position.x;
  anillo.position.z = yo.g.position.z;
  anillo.position.y = yo.g.position.y + 0.03;
  if (marca.userData.vida > 0) {
    marca.userData.vida -= dt * 1.5;
    marca.material.opacity = Math.max(0, marca.userData.vida);
    marca.scale.setScalar(1 + (1 - marca.userData.vida) * 0.8);
  }
  return caminando;
}

function pasos(c, caminando, t, dt) {
  const s = Math.sin(t * 11);
  c.piernas[0].rotation.x = caminando ? s * 0.6 : suave(c.piernas[0].rotation.x, 0, dt);
  c.piernas[1].rotation.x = caminando ? -s * 0.6 : suave(c.piernas[1].rotation.x, 0, dt);
  c.brazos[0].rotation.x = caminando ? -s * 0.5 : suave(c.brazos[0].rotation.x, -0.1, dt);
}

// ---------- otros visitantes (multijugador) ----------
const paramNombre = new URLSearchParams(location.search).get('nombre');
const rutaConNombre = (r) => (paramNombre ? `${r}?nombre=${encodeURIComponent(paramNombre)}` : r);
const miId = Math.random().toString(36).slice(2, 12);
const otros = new Map(); // `${nombre}:${id}` -> { c, meta }
function sincronizarJugadores(lista) {
  const vivos = new Set();
  for (const j of lista) {
    if (j.id === miId || (!paramNombre && j.nombre === miNombre)) continue; // tus otras pestañas tambien eres tu
    const k = `${j.nombre}:${j.id}`;
    vivos.add(k);
    let o = otros.get(k);
    if (!o) {
      const c = crearPersona(COLORES[hash(j.nombre) % COLORES.length], { semillaId: j.nombre });
      c.g.position.set(j.x, j.y, j.z);
      c.g.rotation.y = j.ry;
      const e = etiqueta('etiqueta-yo', `<i></i>${esc(j.nombre)}`);
      e.position.y = 1.95;
      e.element.dataset.claude = claudeDe(j.nombre);
      c.g.add(e);
      scene.add(c.g);
      o = { c, e };
      otros.set(k, o);
    }
    o.meta = j;
  }
  for (const [k, o] of otros) {
    if (vivos.has(k)) continue;
    quitarDeEscena(o.c.g);
    otros.delete(k);
  }
}

function moverOtros(t, dt) {
  for (const { c, meta } of otros.values()) {
    const d = Math.hypot(meta.x - c.g.position.x, meta.z - c.g.position.z);
    // Llega una posicion cada ~200 ms: avanza hacia ella a paso de caminar, o salta si quedo muy lejos.
    if (d > 8) c.g.position.set(meta.x, meta.y, meta.z);
    c.g.position.x = suave(c.g.position.x, meta.x, dt, 6);
    c.g.position.z = suave(c.g.position.z, meta.z, dt, 6);
    c.g.position.y = suave(c.g.position.y, meta.y, dt, 10);
    let dif = meta.ry - c.g.rotation.y;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    c.g.rotation.y += dif * Math.min(1, dt * 10);
    if (d > 0.05 && c.gestoActivo) cancelarGesto(c);
    const gestoActivo = actualizarGesto(c, t, dt);
    if (!gestoActivo) pasos(c, d > 0.05, t, dt);
  }
}

// ---------- chat ----------
const formChat = document.getElementById('chat');
const mensajes = document.getElementById('mensajes');
const escribir = document.getElementById('escribir');
const DICE_MS = 6000;
function decir(c, texto) {
  if (!c.dice) {
    c.dice = etiqueta('dice');
    c.dice.position.y = 2.5;
    c.g.add(c.dice);
  }
  c.dice.element.textContent = texto;
  c.diceHasta = Date.now() + DICE_MS;
}
const vistos = new Set(); // al reconectar, el servidor reenvia el historial
function recibirChat(lista) {
  for (const m of lista) {
    const clave = `${m.t}:${m.nombre}:${m.id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const li = document.createElement('li');
    li.innerHTML = `<b style="color:${m.id === miId ? '#c27a00' : COLORES[hash(m.nombre) % COLORES.length]}">${esc(m.nombre)}</b>${esc(m.texto)}`;
    mensajes.append(li);
    if (Date.now() - m.t > DICE_MS) continue; // historial: solo en la lista
    const o = m.id === miId || m.nombre === miNombre ? { c: yo } : otros.get(`${m.nombre}:${m.id}`);
    if (o) decir(o.c, m.texto);
  }
  while (mensajes.children.length > 30) mensajes.firstChild.remove();
  mensajes.scrollTop = mensajes.scrollHeight;
}
function globos() {
  const ahora = Date.now();
  for (const c of [yo, ...[...otros.values()].map((o) => o.c), ...[...personas.values()].map((p) => p)]) {
    if (c.dice) c.dice.visible = c.g.visible && ahora < c.diceHasta;
    if (c.globoGesto && c.globoGestoHasta) c.globoGesto.visible = c.g.visible && ahora < c.globoGestoHasta;
  }
}
formChat.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = escribir.value.trim();
  if (!texto) return;
  const cmd = texto.toLowerCase();
  if (cmd === '/eventos' || cmd === '/festividad' || cmd === '/festividades' || cmd === '/menu' || cmd === '/fiesta' || cmd === '/fiestas') {
    if (typeof abrirModalEvento === 'function') abrirModalEvento();
    escribir.value = '';
    escribir.blur();
    return;
  }
  fetch(rutaConNombre('/chat'), { method: 'POST', body: JSON.stringify({ id: miId, texto }) }).catch(() => {});
  escribir.value = '';
  escribir.blur(); // de vuelta a caminar con el teclado
});
addEventListener('keydown', (e) => {
  if (e.code !== 'Enter' || e.target === escribir) return;
  if (document.pointerLockElement) document.exitPointerLock();
  escribir.focus();
  e.preventDefault();
});

// Manda tu posicion ~5 veces por segundo mientras te mueves, y cada 3 s quieto (para no desaparecer).
let ultimaPos = '';
let ultimoEnvio = 0;
function mandarPosicion(t) {
  const { x, y, z } = yo.g.position;
  const pos = [x, y, z, yo.g.rotation.y].map((v) => v.toFixed(2)).join(',');
  if (t - ultimoEnvio < (pos === ultimaPos ? 3 : 0.2)) return;
  ultimaPos = pos;
  ultimoEnvio = t;
  const [px, py, pz, ry] = pos.split(',').map(Number);
  fetch(rutaConNombre('/posicion'), { method: 'POST', body: JSON.stringify({ id: miId, x: px, y: py, z: pz, ry }) }).catch(() => {});
}

// ---------- ruleta de gestos ----------
const GESTOS_SOLO = [
  {
    id: 'bailar',
    nombre: 'Bailar',
    icono: '🕺',
    desc: '¡Pasos de breakdance y ritmo!',
    duracion: 4.2,
    animar: (c, p, dt, t) => {
      const tt = t * 14;
      c.cadera.position.y = 0.47 + Math.abs(Math.sin(tt * 0.5)) * 0.14;
      c.cadera.rotation.y = Math.sin(tt * 0.5) * 0.45;
      c.cadera.rotation.z = Math.cos(tt * 0.5) * 0.18;
      c.brazos[0].rotation.x = -1.6 + Math.sin(tt) * 1.1;
      c.brazos[1].rotation.x = -1.6 - Math.sin(tt) * 1.1;
      c.brazos[0].rotation.z = -0.3 + Math.sin(tt * 0.5) * 0.4;
      c.brazos[1].rotation.z = 0.3 - Math.sin(tt * 0.5) * 0.4;
      c.piernas[0].rotation.x = Math.sin(tt * 0.5) * 0.45;
      c.piernas[1].rotation.x = -Math.sin(tt * 0.5) * 0.45;
      c.cabeza.rotation.z = Math.sin(tt * 0.5) * 0.25;
      c.cabeza.rotation.x = -0.1 + Math.abs(Math.sin(tt)) * 0.15;
    },
  },
  {
    id: 'flexiones',
    nombre: 'Flexiones',
    icono: '💪',
    desc: 'Entrenamiento físico al suelo',
    duracion: 4.0,
    animar: (c, p, dt, t) => {
      const faseEntrar = Math.min(1, p * 4);
      const faseSalir = Math.min(1, (1 - p) * 4);
      const factor = Math.min(faseEntrar, faseSalir);
      const ciclo = Math.sin(t * 8);
      c.cadera.position.y = 0.47 * (1 - factor) + (0.16 + Math.max(0, ciclo) * 0.12) * factor;
      c.cadera.rotation.x = -1.4 * factor;
      c.brazos[0].rotation.x = (-0.1) * (1 - factor) + (-1.3 + ciclo * 0.4) * factor;
      c.brazos[1].rotation.x = (-0.1) * (1 - factor) + (-1.3 + ciclo * 0.4) * factor;
      c.brazos[0].rotation.z = -0.3 * factor;
      c.brazos[1].rotation.z = 0.3 * factor;
      c.piernas[0].rotation.x = 0.25 * factor;
      c.piernas[1].rotation.x = 0.25 * factor;
      c.cabeza.rotation.x = 0.7 * factor;
    },
  },
  {
    id: 'voltereta',
    nombre: 'Voltereta',
    icono: '🤸',
    desc: 'Salto mortal acrobático 360°',
    duracion: 2.4,
    animar: (c, p, dt, t) => {
      if (p < 0.15) {
        const k = p / 0.15;
        c.cadera.position.y = 0.47 - k * 0.18;
        c.cadera.rotation.x = k * 0.3;
        c.brazos[0].rotation.x = k * 0.5;
        c.brazos[1].rotation.x = k * 0.5;
        c.piernas[0].rotation.x = -k * 0.4;
        c.piernas[1].rotation.x = -k * 0.4;
      } else if (p < 0.85) {
        const k = (p - 0.15) / 0.7;
        const salto = Math.sin(k * Math.PI) * 1.5;
        c.cadera.position.y = 0.47 + salto;
        c.cadera.rotation.x = -k * Math.PI * 2;
        c.brazos[0].rotation.x = -2.6;
        c.brazos[1].rotation.x = -2.6;
        c.brazos[0].rotation.z = -0.4;
        c.brazos[1].rotation.z = 0.4;
        c.piernas[0].rotation.x = 0.75 * Math.sin(k * Math.PI);
        c.piernas[1].rotation.x = 0.75 * Math.sin(k * Math.PI);
      } else {
        const k = (p - 0.85) / 0.15;
        c.cadera.position.y = 0.47 - (1 - k) * 0.08;
        c.cadera.rotation.x = 0;
        c.brazos[0].rotation.x = -2.3 * (1 - k);
        c.brazos[1].rotation.x = -2.3 * (1 - k);
        c.brazos[0].rotation.z = -0.5 * (1 - k);
        c.brazos[1].rotation.z = 0.5 * (1 - k);
        c.piernas[0].rotation.x = 0;
        c.piernas[1].rotation.x = 0;
      }
    },
  },
  {
    id: 'meditar',
    nombre: 'Meditar',
    icono: '🧘',
    desc: 'Modo Zen y levitación',
    duracion: 4.5,
    animar: (c, p, dt, t) => {
      const entrada = Math.min(1, p * 3);
      const salida = Math.min(1, (1 - p) * 3);
      const k = Math.min(entrada, salida);
      const flotar = Math.sin(t * 3.5) * 0.1;
      c.cadera.position.y = 0.47 + (0.38 + flotar) * k;
      c.piernas[0].rotation.x = 1.15 * k;
      c.piernas[1].rotation.x = 1.15 * k;
      c.piernas[0].rotation.z = -0.55 * k;
      c.piernas[1].rotation.z = 0.55 * k;
      c.brazos[0].rotation.x = -0.65 * k;
      c.brazos[1].rotation.x = -0.65 * k;
      c.brazos[0].rotation.z = -0.6 * k;
      c.brazos[1].rotation.z = 0.6 * k;
      c.cabeza.rotation.x = -0.15 * k;
      c.cabeza.rotation.y = Math.sin(t * 1.5) * 0.08 * k;
    },
  },
  {
    id: 'estirarse',
    nombre: 'Estirarse',
    icono: '🥱',
    desc: 'Bostezo y desperezarse',
    duracion: 3.5,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      c.brazos[0].rotation.x = -2.85 * k;
      c.brazos[1].rotation.x = -2.85 * k;
      c.brazos[0].rotation.z = (-0.4 + Math.sin(t * 5) * 0.1) * k;
      c.brazos[1].rotation.z = (0.4 - Math.sin(t * 5) * 0.1) * k;
      c.cadera.rotation.x = -0.22 * k;
      c.cadera.position.y = 0.47 + 0.06 * k;
      c.cabeza.rotation.x = -0.38 * k;
      c.cabeza.rotation.z = Math.sin(t * 4) * 0.12 * k;
    },
  },
  {
    id: 'reloj',
    nombre: 'Mirar reloj',
    icono: '⌚',
    desc: 'Revisar la hora con prisa',
    duracion: 3.2,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      c.brazos[0].rotation.x = -1.45 * k;
      c.brazos[0].rotation.y = 0.75 * k;
      c.brazos[0].rotation.z = -0.55 * k;
      c.cabeza.rotation.x = 0.35 * k;
      c.cabeza.rotation.y = -0.3 * k;
      c.brazos[1].rotation.x = -0.15 + Math.sin(t * 6) * 0.1 * k;
      c.piernas[1].rotation.x = Math.abs(Math.sin(t * 9)) * 0.28 * k;
    },
  },
];

const GESTOS_ACOMPANADO = [
  {
    id: 'saludar',
    nombre: 'Saludar',
    icono: '👋',
    desc: 'Saluda con la mano levantada',
    duracion: 3.2,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      c.brazos[1].rotation.x = -2.75 * k;
      c.brazos[1].rotation.z = (0.4 + Math.sin(t * 14) * 0.5) * k;
      c.brazos[0].rotation.x = -0.25 * k;
      c.cabeza.rotation.z = Math.sin(t * 7) * 0.18 * k;
      c.cabeza.rotation.x = -0.12 * k;
      c.cadera.position.y = 0.47 + Math.abs(Math.sin(t * 7)) * 0.05 * k;
    },
  },
  {
    id: 'chocar5',
    nombre: 'Chocar los 5',
    icono: '✋',
    desc: '¡Dame esos cinco en el aire!',
    duracion: 2.8,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      c.cadera.position.y = 0.47 + Math.abs(Math.sin(t * 8)) * 0.1 * k;
      c.cadera.rotation.x = 0.12 * k;
      c.brazos[1].rotation.x = (-2.3 + Math.sin(t * 12) * 0.2) * k;
      c.brazos[1].rotation.y = -0.35 * k;
      c.brazos[1].rotation.z = 0.2 * k;
      c.brazos[0].rotation.x = -0.4 * k;
      c.cabeza.rotation.x = -0.15 * k;
    },
  },
  {
    id: 'reverencia',
    nombre: 'Reverencia',
    icono: '🙇',
    desc: 'Saludo formal y respeto',
    duracion: 3.0,
    animar: (c, p, dt, t) => {
      const inclinacion = Math.sin(p * Math.PI) * 0.7;
      c.cadera.rotation.x = inclinacion;
      c.cadera.position.y = 0.47 - inclinacion * 0.06;
      c.cabeza.rotation.x = inclinacion * 0.5;
      c.brazos[0].rotation.x = -inclinacion * 0.9;
      c.brazos[1].rotation.x = -inclinacion * 0.9;
    },
  },
  {
    id: 'aplaudir',
    nombre: 'Aplaudir',
    icono: '👏',
    desc: 'Aplausos y celebración',
    duracion: 3.5,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      const palmas = Math.sin(t * 18);
      c.brazos[0].rotation.x = -1.35 * k;
      c.brazos[1].rotation.x = -1.35 * k;
      c.brazos[0].rotation.y = (0.55 + palmas * 0.28) * k;
      c.brazos[1].rotation.y = (-0.55 - palmas * 0.28) * k;
      c.cadera.position.y = 0.47 + Math.abs(palmas) * 0.06 * k;
      c.cabeza.rotation.x = Math.sin(t * 9) * 0.1 * k;
    },
  },
  {
    id: 'senalar',
    nombre: 'Señalar',
    icono: '👉',
    desc: 'Apuntar y llamar atención',
    duracion: 3.0,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      c.brazos[1].rotation.x = -1.57 * k;
      c.brazos[1].rotation.y = -0.15 * k;
      c.brazos[1].rotation.z = 0.1 * k;
      c.brazos[0].rotation.x = -0.2 * k;
      c.cadera.rotation.x = 0.1 * k;
      c.cabeza.rotation.x = Math.sin(t * 7) * 0.12 * k;
    },
  },
  {
    id: 'corazon',
    nombre: 'Dar amor',
    icono: '❤️',
    desc: 'Enviar afecto y corazones',
    duracion: 3.2,
    animar: (c, p, dt, t) => {
      const k = Math.sin(p * Math.PI);
      const apertura = Math.sin(p * Math.PI * 1.5);
      c.cadera.position.y = 0.47 + Math.max(0, Math.sin(p * Math.PI * 2)) * 0.14;
      c.brazos[0].rotation.x = (-1.4 - apertura * 0.6) * k;
      c.brazos[1].rotation.x = (-1.4 - apertura * 0.6) * k;
      c.brazos[0].rotation.z = (-0.1 - apertura * 0.5) * k;
      c.brazos[1].rotation.z = (0.1 + apertura * 0.5) * k;
      c.cabeza.rotation.x = -0.22 * k;
    },
  },
];

const GESTOS_MAP = Object.fromEntries([...GESTOS_SOLO, ...GESTOS_ACOMPANADO].map((g) => [g.id, g]));

function mostrarGloboGesto(c, icono, texto) {
  if (!c || !c.g) return;
  if (!c.globoGesto) {
    c.globoGesto = etiqueta('globo-gesto', `<i></i><span></span>`);
    c.globoGesto.position.y = 2.45;
    c.g.add(c.globoGesto);
  }
  const el = c.globoGesto.element;
  el.querySelector('i').textContent = icono;
  el.querySelector('span').textContent = texto;
  c.globoGesto.visible = true;
}

function limpiarGesto(c) {
  if (!c) return;
  c.gestoActivo = null;
  c.globoGestoHasta = 0;
  if (c.globoGesto) c.globoGesto.visible = false;
  c.cadera.position.y = 0.47;
  c.cadera.rotation.set(0, 0, 0);
  c.piernas[0].rotation.set(0, 0, 0);
  c.piernas[1].rotation.set(0, 0, 0);
  c.brazos[0].rotation.set(0, 0, 0);
  c.brazos[1].rotation.set(0, 0, 0);
  c.cabeza.rotation.set(0, 0, 0);
}

const cancelarGesto = limpiarGesto;

function iniciarGesto(c, gesto, { objetivo = null, objetivoPersona = null, emitir = true } = {}) {
  if (!c || !gesto) return;
  limpiarGesto(c);
  c.gestoActivo = {
    id: gesto.id,
    inicio: reloj.elapsedTime,
    duracion: gesto.duracion,
    objetivo: objetivo || null,
  };
  c.globoGestoHasta = Date.now() + Math.round(gesto.duracion * 1000);

  if (objetivoPersona && objetivoPersona.g) {
    const dir = objetivoPersona.g.position.clone().sub(c.g.position);
    c.g.rotation.y = Math.atan2(dir.x, dir.z);
  }

  const texto = objetivo ? `${gesto.nombre} a ${objetivo}` : gesto.nombre;
  mostrarGloboGesto(c, gesto.icono, texto);

  if (c === yo && objetivoPersona && objetivoPersona.datos) {
    const p = objetivoPersona;
    p.reaccionGesto = { inicio: reloj.elapsedTime, duracion: 2.2, tipo: gesto.id };
    const dirAgente = yo.g.position.clone().sub(p.g.position);
    p.g.rotation.y = Math.atan2(dirAgente.x, dirAgente.z);
    const resp = gesto.id === 'corazon' ? '🥰' : gesto.id === 'chocar5' ? '✋' : '👋';
    mostrarGloboGesto(p, resp, '¡Hola!');
    p.globoGestoHasta = Date.now() + 2500;
  }

  if (emitir && c === yo) {
    fetch(rutaConNombre('/gesto'), {
      method: 'POST',
      body: JSON.stringify({ id: miId, gesto: gesto.id, objetivo: objetivo || null }),
    }).catch(() => {});
  }
}

function actualizarGesto(c, t, dt) {
  if (!c || !c.gestoActivo) return false;
  const g = c.gestoActivo;
  const transcurrido = t - g.inicio;
  if (transcurrido >= g.duracion) {
    limpiarGesto(c);
    return false;
  }
  const def = GESTOS_MAP[g.id];
  if (def && def.animar) {
    def.animar(c, transcurrido / g.duracion, dt, t);
  }
  return true;
}

function obtenerUsuarioCercano() {
  const DIST_MAX_JUGADOR = 4.0;
  let masCercano = null;
  let menorDist = DIST_MAX_JUGADOR;

  for (const [k, o] of otros) {
    if (!o.c || !o.c.g || !o.c.g.visible) continue;
    const d = o.c.g.position.distanceTo(yo.g.position);
    if (d < menorDist) {
      menorDist = d;
      masCercano = {
        tipo: 'jugador',
        nombre: o.meta?.nombre || 'Compañero',
        persona: o.c,
        distancia: d,
      };
    }
  }

  if (!masCercano) {
    let menorDistAgente = 3.2;
    for (const p of personas.values()) {
      if (!p.g || !p.g.visible) continue;
      const d = p.g.position.distanceTo(yo.g.position);
      if (d < menorDistAgente) {
        menorDistAgente = d;
        masCercano = {
          tipo: 'agente',
          nombre: nombreDe(p),
          persona: p,
          distancia: d,
        };
      }
    }
  }

  return masCercano;
}

function recibirGesto(m) {
  if (!m || m.id === miId) return;
  const o = otros.get(`${m.nombre}:${m.id}`);
  const g = GESTOS_MAP[m.gesto];
  if (o && g) {
    let objPersona = null;
    if (m.objetivo === miNombre) objPersona = yo;
    iniciarGesto(o.c, g, { objetivo: m.objetivo, objetivoPersona: objPersona, emitir: false });
  }
}

const ruletaOverlay = document.getElementById('ruleta-overlay');
const ruletaPanel = document.getElementById('ruleta-panel');
const ruletaBadge = document.getElementById('ruleta-badge');
const ruletaTitulo = document.getElementById('ruleta-titulo');
const ruletaDesc = document.getElementById('ruleta-desc');
const ruletaSvg = document.getElementById('ruleta-svg');
const iconoCentro = document.getElementById('ruleta-icono-centro');
const nombreCentro = document.getElementById('ruleta-nombre-centro');
const subCentro = document.getElementById('ruleta-sub-centro');
const botonGestos = document.getElementById('boton-gestos');

let ruletaAbierta = false;
let gestosActuales = [];

function construirRuletaSvg(gestos, contexto) {
  gestosActuales = gestos;
  ruletaSvg.innerHTML = '';
  const n = gestos.length;
  const Rin = 58;
  const Rout = 148;
  const step = (Math.PI * 2) / n;
  const gap = 0.055;

  gestos.forEach((g, i) => {
    const aMid = -Math.PI / 2 + i * step;
    const a1 = aMid - step / 2 + gap;
    const a2 = aMid + step / 2 - gap;

    const x1a = (Rin * Math.cos(a1)).toFixed(2);
    const y1a = (Rin * Math.sin(a1)).toFixed(2);
    const x2a = (Rout * Math.cos(a1)).toFixed(2);
    const y2a = (Rout * Math.sin(a1)).toFixed(2);
    const x2b = (Rout * Math.cos(a2)).toFixed(2);
    const y2b = (Rout * Math.sin(a2)).toFixed(2);
    const x1b = (Rin * Math.cos(a2)).toFixed(2);
    const y1b = (Rin * Math.sin(a2)).toFixed(2);

    const d = `M ${x2a} ${y2a} A ${Rout} ${Rout} 0 0 1 ${x2b} ${y2b} L ${x1b} ${y1b} A ${Rin} ${Rin} 0 0 0 ${x1a} ${y1a} Z`;

    const rIcon = 104;
    const rText = 126;
    const rNum = 73;

    const xIcon = (rIcon * Math.cos(aMid)).toFixed(2);
    const yIcon = (rIcon * Math.sin(aMid) - 3).toFixed(2);

    const xText = (rText * Math.cos(aMid)).toFixed(2);
    const yText = (rText * Math.sin(aMid) + 2).toFixed(2);

    const xNum = (rNum * Math.cos(aMid)).toFixed(2);
    const yNum = (rNum * Math.sin(aMid) + 2).toFixed(2);

    const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grupo.setAttribute('class', 'ruleta-sector');
    grupo.setAttribute('data-index', i);

    grupo.innerHTML = `
      <path class="sector-path" d="${d}"></path>
      <text class="sector-numero" x="${xNum}" y="${yNum}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>
      <text class="sector-icono" x="${xIcon}" y="${yIcon}">${g.icono}</text>
      <text class="sector-nombre" x="${xText}" y="${yText}">${g.nombre}</text>
    `;

    const destacar = () => {
      iconoCentro.textContent = g.icono;
      nombreCentro.textContent = g.nombre;
      subCentro.textContent = g.desc;
      ruletaSvg.querySelectorAll('.ruleta-sector').forEach((s, idx) => {
        s.classList.toggle('seleccionado', idx === i);
      });
    };

    grupo.addEventListener('pointerenter', destacar);
    grupo.addEventListener('click', (e) => {
      e.stopPropagation();
      ejecutarGestoDesdeRuleta(i);
    });

    ruletaSvg.appendChild(grupo);
  });
}

function abrirRuleta() {
  if (document.pointerLockElement) document.exitPointerLock();
  const cercano = obtenerUsuarioCercano();
  const contexto = cercano ? 'acompanado' : 'solo';
  const lista = contexto === 'acompanado' ? GESTOS_ACOMPANADO : GESTOS_SOLO;

  ruletaPanel.classList.toggle('solo', contexto === 'solo');
  ruletaPanel.classList.toggle('acompanado', contexto === 'acompanado');

  ruletaBadge.className = 'ruleta-badge ' + contexto;
  ruletaBadge.textContent = cercano ? `👥 Junto a ${cercano.nombre}` : '👤 En solitario';
  ruletaTitulo.textContent = cercano ? 'Gestos en compañía' : 'Gestos en solitario';
  ruletaDesc.textContent = cercano ? `Interactúa directamente con ${cercano.nombre}` : 'Expresiones y movimientos individuales';

  iconoCentro.textContent = cercano ? '👋' : '✨';
  nombreCentro.textContent = 'Elige un gesto';
  subCentro.textContent = 'Presiona 1-6 o haz clic';

  construirRuletaSvg(lista, contexto);

  ruletaOverlay.classList.add('abierta');
  ruletaAbierta = true;
}

function cerrarRuleta() {
  ruletaOverlay.classList.remove('abierta');
  ruletaAbierta = false;
}

function toggleRuleta() {
  if (ruletaAbierta) cerrarRuleta();
  else abrirRuleta();
}

function ejecutarGestoDesdeRuleta(indice) {
  if (indice < 0 || indice >= gestosActuales.length) return;
  const g = gestosActuales[indice];
  const cercano = obtenerUsuarioCercano();
  cerrarRuleta();
  iniciarGesto(yo, g, { objetivo: cercano?.nombre, objetivoPersona: cercano?.persona });
}

ruletaOverlay.addEventListener('click', (e) => {
  if (e.target === ruletaOverlay) cerrarRuleta();
});
if (botonGestos) {
  botonGestos.addEventListener('click', () => {
    toggleRuleta();
    botonGestos.blur();
  });
}

// ---------- eventos y festividades estacionales ----------
const grupoEstacional = new THREE.Group();
scene.add(grupoEstacional);

const animadoresEstacionales = [];
const decoracionesArboles = [];
let eventoActualConfig = null;
let modoEventoSeleccionado = null; // null = automático según fecha

const OPCIONES_EVENTOS = [
  { id: 'auto', titulo: 'Automático', subtitulo: 'Sigue el calendario real', icono: '🗓️', tag: 'Recomendado', especial: false, desc: 'Detecta automáticamente la festividad según el día actual del año.' },
  { id: 'halloween_mes', titulo: 'Halloween (Mes)', subtitulo: 'Octubre temático', icono: '🎃', tag: 'Mes', especial: false, desc: 'Calabazas talladas con luz tenue, murciélagos y tono otoñal en toda la oficina.' },
  { id: 'halloween_especial', titulo: 'Halloween (¡Mero Día!)', subtitulo: '31 de Octubre', icono: '👻', tag: 'Mero Día', especial: true, desc: 'Escenario especial: Gran Caldero con poción verde burbujeante, fantasma y cementerio.' },
  { id: 'diademuertos_mes', titulo: 'Día de Muertos (Temporada)', subtitulo: 'Inicios de Noviembre', icono: '🌼', tag: 'Temporada', especial: false, desc: 'Senderos con flores de cempasúchil doradas, papel picado festivo y veladoras.' },
  { id: 'diademuertos_especial', titulo: 'Día de Muertos (¡Mero Día!)', subtitulo: '1 y 2 de Noviembre', icono: '💀', tag: 'Mero Día', especial: true, desc: 'Escenario especial: Gran Altar Monumental de 3 niveles con ofrendas, pan de muerto y veladoras.' },
  { id: 'navidad_mes', titulo: 'Navidad (Mes)', subtitulo: 'Diciembre nevado', icono: '❄️', tag: 'Mes', especial: false, desc: 'Isla y árboles cubiertos de nieve blanca, coronas de pino y guirnaldas de luces.' },
  { id: 'navidad_especial', titulo: 'Navidad (¡Mero Día!)', subtitulo: '24 y 25 de Diciembre', icono: '🎄', tag: 'Mero Día', especial: true, desc: 'Escenario especial: Gran Árbol Navideño con estrella dorada, regalos, muñeco de nieve y nieve cayendo.' },
  { id: 'normal', titulo: 'Temporada Regular', subtitulo: 'Sin festividad', icono: '🍃', tag: 'Normal', especial: false, desc: 'Oficina cotidiana con césped verde y clima templado.' },
];

function obtenerConfigEvento(eleccionManual = modoEventoSeleccionado) {
  const params = new URLSearchParams(location.search);
  const paramEvento = params.get('evento');
  const paramEspecial = params.has('especial') || params.has('merodia') || params.get('especial') === '1' || params.get('merodia') === '1';
  const paramFecha = params.get('fecha');

  let eleccion = eleccionManual;
  if (!eleccion && paramEvento) {
    if (paramEvento === 'halloween') eleccion = paramEspecial ? 'halloween_especial' : 'halloween_mes';
    else if (paramEvento === 'diademuertos') eleccion = paramEspecial ? 'diademuertos_especial' : 'diademuertos_mes';
    else if (paramEvento === 'navidad') eleccion = paramEspecial ? 'navidad_especial' : 'navidad_mes';
    else if (paramEvento === 'ninguno' || paramEvento === 'normal') eleccion = 'normal';
  }

  let ahora = new Date();
  if (paramFecha) {
    const partes = paramFecha.split('-').map(Number);
    if (partes.length === 2) ahora = new Date(ahora.getFullYear(), partes[0] - 1, partes[1]);
    else if (partes.length === 3) ahora = new Date(partes[0], partes[1] - 1, partes[2]);
  }

  const mes = ahora.getMonth() + 1; // 1 - 12
  const dia = ahora.getDate();      // 1 - 31

  if (!eleccion || eleccion === 'auto') {
    // 1. Halloween: Mes de Octubre (1 al 31)
    if (mes === 10) {
      const esMeroDia = dia === 31 || paramEspecial;
      return {
        id: 'halloween',
        modo: 'auto',
        nombre: 'Halloween',
        icono: esMeroDia ? '👻' : '🎃',
        esMeroDia,
        titulo: esMeroDia ? '¡El Mero Día de Brujas!' : 'Mes de Halloween',
        descripcion: esMeroDia ? '31 de Octubre: Gran Caldero con pócima mágica, fantasmas y cementerio' : 'Calabazas talladas, luz de velas y ambiente de misterio',
      };
    }
    // 2. Día de Muertos: 1 al 3 de Noviembre
    if (mes === 11 && dia <= 3) {
      const esMeroDia = dia === 1 || dia === 2 || paramEspecial;
      return {
        id: 'diademuertos',
        modo: 'auto',
        nombre: 'Día de Muertos',
        icono: esMeroDia ? '💀' : '🌼',
        esMeroDia,
        titulo: esMeroDia ? '¡El Mero Día de Muertos!' : 'Temporada de Día de Muertos',
        descripcion: esMeroDia ? '1 y 2 de Noviembre: Gran Altar Monumental de 3 niveles con ofrendas tradicionales' : 'Caminos de flores de cempasúchil, papel picado y veladoras',
      };
    }
    // 3. Navidad: Diciembre completo y hasta el 6 de Enero
    if (mes === 12 || (mes === 1 && dia <= 6)) {
      const esMeroDia = (mes === 12 && (dia === 24 || dia === 25)) || paramEspecial;
      return {
        id: 'navidad',
        modo: 'auto',
        nombre: 'Navidad',
        icono: esMeroDia ? '🎄' : '❄️',
        esMeroDia,
        titulo: esMeroDia ? '¡Nochebuena y Navidad!' : 'Mes Navideño',
        descripcion: esMeroDia ? '24 y 25 de Diciembre: Gran Árbol Navideño, regalos, muñeco de nieve y nieve cayendo' : 'Isla nevada, árboles con escarcha y guirnaldas de luces',
      };
    }
    return {
      id: 'normal',
      modo: 'auto',
      nombre: 'Normal',
      icono: '🍃',
      esMeroDia: false,
      titulo: 'Temporada Regular',
      descripcion: 'Oficina cotidiana con césped verde y clima templado',
    };
  }

  // Modos manuales forzados desde el menú:
  if (eleccion === 'halloween_mes') {
    return { id: 'halloween', modo: 'manual', nombre: 'Halloween', icono: '🎃', esMeroDia: false, titulo: 'Halloween (Mes)', descripcion: 'Mes de Octubre con calabazas iluminadas y murciélagos' };
  }
  if (eleccion === 'halloween_especial') {
    return { id: 'halloween', modo: 'manual', nombre: 'Halloween', icono: '👻', esMeroDia: true, titulo: 'Halloween (¡Mero Día!)', descripcion: '31 de Octubre: Gran Caldero con pócima mágica, fantasma y cementerio' };
  }
  if (eleccion === 'diademuertos_mes') {
    return { id: 'diademuertos', modo: 'manual', nombre: 'Día de Muertos', icono: '🌼', esMeroDia: false, titulo: 'Día de Muertos (Temporada)', descripcion: 'Caminos de cempasúchil, papel picado y veladoras' };
  }
  if (eleccion === 'diademuertos_especial') {
    return { id: 'diademuertos', modo: 'manual', nombre: 'Día de Muertos', icono: '💀', esMeroDia: true, titulo: 'Día de Muertos (¡Mero Día!)', descripcion: '1 y 2 de Noviembre: Gran Altar Monumental de 3 niveles con ofrendas' };
  }
  if (eleccion === 'navidad_mes') {
    return { id: 'navidad', modo: 'manual', nombre: 'Navidad', icono: '❄️', esMeroDia: false, titulo: 'Navidad (Mes)', descripcion: 'Mes de Diciembre: Isla nevada, escarcha y luces navideñas' };
  }
  if (eleccion === 'navidad_especial') {
    return { id: 'navidad', modo: 'manual', nombre: 'Navidad', icono: '🎄', esMeroDia: true, titulo: 'Navidad (¡Mero Día!)', descripcion: '24 y 25 de Diciembre: Gran Árbol Navideño con estrella dorada, regalos y nieve cayendo' };
  }
  return { id: 'normal', modo: 'manual', nombre: 'Normal', icono: '🍃', esMeroDia: false, titulo: 'Temporada Regular', descripcion: 'Oficina cotidiana sin festividad' };
}

// Modelos 3D Procedurales para las Festividades
function crearCalabaza(radio = 0.32, { conLuz = true, sombrero = false, cara = true } = {}) {
  const g = new THREE.Group();
  // Cuerpo achatado de calabaza con gajos
  const matCalabaza = new THREE.MeshLambertMaterial({ color: '#ea5d15', flatShading: true });
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(radio, 8, 7), matCalabaza);
  cuerpo.scale.set(1.2, 0.88, 1.2);
  cuerpo.position.y = radio * 0.85;
  cuerpo.castShadow = true;
  g.add(cuerpo);

  // Tallo curvado
  const tallo = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.1, radio * 0.16, radio * 0.45, 5), mat('#2e5b2c'));
  tallo.position.set(0, radio * 1.68, 0);
  tallo.rotation.z = 0.22;
  g.add(tallo);

  if (cara) {
    const matCara = new THREE.MeshBasicMaterial({ color: '#ffe455' });
    // Ojos triangulares
    const ojoI = new THREE.Mesh(new THREE.BoxGeometry(radio * 0.22, radio * 0.18, radio * 0.08), matCara);
    ojoI.position.set(-radio * 0.38, radio * 0.96, radio * 1.12);
    ojoI.rotation.z = -0.2;
    const ojoD = new THREE.Mesh(new THREE.BoxGeometry(radio * 0.22, radio * 0.18, radio * 0.08), matCara);
    ojoD.position.set(radio * 0.38, radio * 0.96, radio * 1.12);
    ojoD.rotation.z = 0.2;
    // Boca con dientes
    const boca = new THREE.Mesh(new THREE.BoxGeometry(radio * 0.64, radio * 0.16, radio * 0.08), matCara);
    boca.position.set(0, radio * 0.68, radio * 1.15);
    g.add(ojoI, ojoD, boca);
  }

  let luz = null;
  if (conLuz) {
    luz = new THREE.PointLight('#ff7722', 1.0, radio * 9, 2);
    luz.position.set(0, radio * 0.9, radio * 0.5);
    g.add(luz);
    const fase = Math.random() * Math.PI * 2;
    animadoresEstacionales.push((t) => {
      luz.intensity = 0.9 + Math.sin(t * 12 + fase) * 0.25;
    });
  }

  if (sombrero) {
    const ala = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.6, radio * 1.6, 0.04, 12), mat('#1c1e24'));
    ala.position.y = radio * 1.62;
    const cono = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.85, radio * 1.8, 8), mat('#252830'));
    cono.position.set(0, radio * 2.5, -radio * 0.1);
    cono.rotation.x = -0.15;
    const cinta = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.86, radio * 0.88, radio * 0.22, 8), mat('#8e24aa'));
    cinta.position.set(0, radio * 1.74, -0.01);
    g.add(ala, cono, cinta);
  }

  return g;
}

function crearMurcielago(escala = 1) {
  const g = new THREE.Group();
  const matNegro = mat('#23252e');
  // Cuerpo
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.12 * escala, 6, 5), matNegro);
  cuerpo.position.y = 0.15 * escala;
  // Orejitas
  const orejaI = new THREE.Mesh(new THREE.ConeGeometry(0.04 * escala, 0.09 * escala, 4), matNegro);
  orejaI.position.set(-0.06 * escala, 0.26 * escala, 0);
  const orejaD = new THREE.Mesh(new THREE.ConeGeometry(0.04 * escala, 0.09 * escala, 4), matNegro);
  orejaD.position.set(0.06 * escala, 0.26 * escala, 0);
  // Ojitos amarillos
  const matOjos = new THREE.MeshBasicMaterial({ color: '#ffea00' });
  const ojoI = new THREE.Mesh(new THREE.SphereGeometry(0.02 * escala, 4, 4), matOjos);
  ojoI.position.set(-0.04 * escala, 0.17 * escala, 0.11 * escala);
  const ojoD = new THREE.Mesh(new THREE.SphereGeometry(0.02 * escala, 4, 4), matOjos);
  ojoD.position.set(0.04 * escala, 0.17 * escala, 0.11 * escala);
  // Alas
  const alaI = new THREE.Mesh(new THREE.BoxGeometry(0.3 * escala, 0.12 * escala, 0.02 * escala), matNegro);
  alaI.position.set(-0.2 * escala, 0.15 * escala, 0);
  alaI.rotation.z = 0.2;
  const alaD = new THREE.Mesh(new THREE.BoxGeometry(0.3 * escala, 0.12 * escala, 0.02 * escala), matNegro);
  alaD.position.set(0.2 * escala, 0.15 * escala, 0);
  alaD.rotation.z = -0.2;
  g.add(cuerpo, orejaI, orejaD, ojoI, ojoD, alaI, alaD);
  return g;
}

function crearCempasuchil(radio = 0.18, color = '#ff7700') {
  const g = new THREE.Group();
  const flor = new THREE.Mesh(new THREE.DodecahedronGeometry(radio, 0), mat(color));
  flor.position.y = radio * 0.9;
  const tallito = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.12, radio * 0.12, radio * 0.6, 4), mat('#386b36'));
  tallito.position.y = radio * 0.3;
  g.add(tallito, flor);
  return g;
}

function crearTiraPapelPicado(ancho = 2.6, y = 2.3) {
  const g = new THREE.Group();
  const colores = ['#e91e63', '#ff9800', '#9c27b0', '#00bcd4', '#ffeb3b', '#4caf50'];
  const n = 6;
  const w = ancho / n;
  for (let i = 0; i < n; i++) {
    const c = colores[i % colores.length];
    const bandera = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, 0.42), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    bandera.position.set(-ancho / 2 + w * (i + 0.5), y - 0.22, 0);
    bandera.rotation.x = 0.08 * ((i % 2) ? 1 : -1);
    g.add(bandera);
  }
  return g;
}

function crearVeladora(x, y, z, { conLuz = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 7), mat('#f8f5eb'));
  vaso.position.y = 0.09;
  const llama = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.08, 5), new THREE.MeshBasicMaterial({ color: '#ffd54f' }));
  llama.position.y = 0.22;
  g.add(vaso, llama);

  if (conLuz) {
    const luz = new THREE.PointLight('#ffb347', 0.8, 3.2, 2);
    luz.position.y = 0.26;
    g.add(luz);
    const fase = Math.random() * Math.PI * 2;
    animadoresEstacionales.push((t) => {
      luz.intensity = 0.75 + Math.sin(t * 15 + fase) * 0.2;
      llama.scale.y = 0.9 + Math.sin(t * 18 + fase) * 0.2;
    });
  }
  return g;
}

function crearCoronaNavidena(radio = 0.35) {
  const g = new THREE.Group();
  const pino = new THREE.Mesh(new THREE.TorusGeometry(radio, radio * 0.3, 6, 12), mat('#1b5e20'));
  pino.rotation.x = Math.PI / 2;
  // Moño rojo arriba
  const matMono = mat('#d32f2f');
  const nudo = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.18, 6, 5), matMono);
  nudo.position.set(0, radio, radio * 0.25);
  const lazoI = new THREE.Mesh(new THREE.BoxGeometry(radio * 0.12, radio * 0.45, 0.03), matMono);
  lazoI.position.set(-radio * 0.15, radio * 0.75, radio * 0.25);
  lazoI.rotation.z = 0.35;
  const lazoD = new THREE.Mesh(new THREE.BoxGeometry(radio * 0.12, radio * 0.45, 0.03), matMono);
  lazoD.position.set(radio * 0.15, radio * 0.75, radio * 0.25);
  lazoD.rotation.z = -0.35;
  // Bayas rojas
  const baya1 = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.08, 4, 4), matMono);
  baya1.position.set(-radio * 0.7, 0, radio * 0.25);
  const baya2 = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.08, 4, 4), matMono);
  baya2.position.set(radio * 0.7, 0, radio * 0.25);
  g.add(pino, nudo, lazoI, lazoD, baya1, baya2);
  return g;
}

function crearGuirnaldaLuces(longitud = 4, y = 2.5) {
  const g = new THREE.Group();
  const colores = ['#ff3344', '#33dd55', '#ffcc22', '#3399ff', '#ff8800'];
  const focos = [];
  const cantidad = 8;
  const paso = longitud / (cantidad - 1);
  for (let i = 0; i < cantidad; i++) {
    const c = colores[i % colores.length];
    const matFoco = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, flatShading: true });
    const foco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), matFoco);
    const x = -longitud / 2 + i * paso;
    const dip = Math.sin((i / (cantidad - 1)) * Math.PI) * 0.18; // curva colgante
    foco.position.set(x, y - dip, 0);
    g.add(foco);
    focos.push({ mat: matFoco, idx: i });
  }
  animadoresEstacionales.push((t) => {
    const par = Math.floor(t * 2.5) % 2;
    for (const f of focos) {
      f.mat.emissiveIntensity = (f.idx % 2 === par) ? 1.6 : 0.3;
    }
  });
  return g;
}

function crearMunecoNieve() {
  const g = new THREE.Group();
  const matNieve = mat('#ffffff');
  const matNegro = mat('#212529');
  const matNaranja = mat('#ff6f00');
  const matRojo = mat('#d32f2f');

  // Bolas de nieve
  const bolaAbajo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 7), matNieve);
  bolaAbajo.position.y = 0.52;
  const bolaMedio = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 7), matNieve);
  bolaMedio.position.y = 1.22;
  const bolaCabeza = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 7), matNieve);
  bolaCabeza.position.y = 1.72;

  // Botones de carbón
  for (let i = 0; i < 3; i++) {
    const boton = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), matNegro);
    boton.position.set(0, 1.1 + i * 0.15, 0.36 - i * 0.04);
    g.add(boton);
  }

  // Ojos de carbón
  const ojoI = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), matNegro);
  ojoI.position.set(-0.09, 1.78, 0.24);
  const ojoD = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), matNegro);
  ojoD.position.set(0.09, 1.78, 0.24);

  // Nariz de zanahoria
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 5), matNaranja);
  nariz.position.set(0, 1.7, 0.36);
  nariz.rotation.x = Math.PI / 2;

  // Sombrero de copa
  const alaSombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), matNegro);
  alaSombrero.position.y = 1.95;
  const copaSombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10), matNegro);
  copaSombrero.position.y = 2.12;
  const cintaRoja = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 10), matRojo);
  cintaRoja.position.y = 1.99;

  // Bufanda
  const bufanda = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 6, 12), matRojo);
  bufanda.position.y = 1.5;
  bufanda.rotation.x = Math.PI / 2;

  // Brazos de ramitas
  const brazoI = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.65, 4), mat('#5c3d2e'));
  brazoI.position.set(-0.52, 1.35, 0);
  brazoI.rotation.z = Math.PI / 3;
  const brazoD = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.65, 4), mat('#5c3d2e'));
  brazoD.position.set(0.52, 1.35, 0);
  brazoD.rotation.z = -Math.PI / 3;

  g.add(bolaAbajo, bolaMedio, bolaCabeza, ojoI, ojoD, nariz, alaSombrero, copaSombrero, cintaRoja, bufanda, brazoI, brazoD);
  return g;
}

function crearCajasRegalos() {
  const g = new THREE.Group();
  const presets = [
    { w: 0.65, h: 0.52, d: 0.65, colorCaja: '#d32f2f', colorLazo: '#ffd54f', x: -1.2, z: 0.9 },
    { w: 0.54, h: 0.68, d: 0.54, colorCaja: '#1976d2', colorLazo: '#ffffff', x: 1.1, z: 0.8 },
    { w: 0.72, h: 0.44, d: 0.72, colorCaja: '#388e3c', colorLazo: '#d32f2f', x: -0.85, z: -1.1 },
    { w: 0.48, h: 0.48, d: 0.48, colorCaja: '#fbc02d', colorLazo: '#7b1fa2', x: 0.95, z: -0.85 },
    { w: 0.58, h: 0.38, d: 0.58, colorCaja: '#e91e63', colorLazo: '#ffffff', x: 1.45, z: 0.1 },
  ];
  for (const p of presets) {
    const cajaG = new THREE.Group();
    cajaG.position.set(p.x, p.h / 2, p.z);
    cajaG.add(caja(p.w, p.h, p.d, p.colorCaja, 0, 0, 0));
    // Cinta cruzada
    cajaG.add(caja(p.w * 0.16, p.h + 0.01, p.d + 0.01, p.colorLazo, 0, 0, 0));
    cajaG.add(caja(p.w + 0.01, p.h + 0.01, p.d * 0.16, p.colorLazo, 0, 0, 0));
    // Moño arriba
    const mono = new THREE.Mesh(new THREE.SphereGeometry(p.w * 0.14, 5, 5), mat(p.colorLazo));
    mono.position.y = p.h / 2 + p.w * 0.1;
    cajaG.add(mono);
    g.add(cajaG);
  }
  return g;
}

// Escenarios Especiales del Mero Día en la Plaza Central
function crearEscenarioHalloweenMeroDia() {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);

  // 1. Gran Caldero de Bruja
  const matHierro = mat('#1b1e22');
  const caldero = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 0.88, 1.22, 14), matHierro);
  caldero.position.y = 0.85;
  const bordeCaldero = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.14, 6, 16), matHierro);
  bordeCaldero.position.y = 1.46;
  bordeCaldero.rotation.x = Math.PI / 2;
  // 3 Patas arqueadas
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), matHierro);
    pata.position.set(Math.sin(ang) * 0.95, 0.3, Math.cos(ang) * 0.95);
    pata.rotation.z = (Math.cos(ang) * 0.25);
    pata.rotation.x = (Math.sin(ang) * -0.25);
    g.add(pata);
  }

  // Leños de madera y brasas
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const leno = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.4, 5), mat('#422d1f'));
    leno.position.set(0, 0.08, 0);
    leno.rotation.y = a;
    leno.rotation.z = Math.PI / 2;
    g.add(leno);
  }
  const brasas = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#ff3d00', emissive: '#ff5722', emissiveIntensity: 1.5 }));
  brasas.position.y = 0.06;
  g.add(brasas);

  // Poción verde brillante burbujeante
  const matPocion = new THREE.MeshStandardMaterial({ color: '#39ff14', emissive: '#2ebd0e', emissiveIntensity: 1.4, flatShading: true });
  const superficiePocion = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.08, 14), matPocion);
  superficiePocion.position.y = 1.35;
  g.add(caldero, bordeCaldero, superficiePocion);

  // Luz espectral verde de la poción
  const luzPocion = new THREE.PointLight('#39ff14', 2.8, 9, 1.8);
  luzPocion.position.set(0, 1.6, 0);
  g.add(luzPocion);

  // Burbujas flotantes de poción
  const burbujas = [];
  for (let i = 0; i < 7; i++) {
    const rBurbuja = 0.08 + Math.random() * 0.12;
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * 0.85;
    const bMesh = new THREE.Mesh(new THREE.SphereGeometry(rBurbuja, 6, 6), matPocion);
    const baseX = Math.sin(ang) * dist;
    const baseZ = Math.cos(ang) * dist;
    bMesh.position.set(baseX, 1.38, baseZ);
    g.add(bMesh);
    burbujas.push({ mesh: bMesh, baseY: 1.38, amp: 0.14 + Math.random() * 0.18, vel: 2.5 + Math.random() * 3, fase: Math.random() * Math.PI * 2 });
  }

  // 2. Mini-Cementerio y Lápidas
  const matPiedra = mat('#545b62');
  const lapida1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.18), matPiedra);
  lapida1.position.set(-2.0, 0.52, 0.7);
  lapida1.rotation.y = 0.35;
  const cruz1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.2), mat('#2b3035'));
  cruz1.position.set(-2.0, 0.75, 0.7);
  cruz1.rotation.y = 0.35;
  const lapida2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 0.16), matPiedra);
  lapida2.position.set(1.9, 0.45, -1.1);
  lapida2.rotation.y = -0.4;
  g.add(lapida1, cruz1, lapida2);

  // 3. Calabaza Monarca Gigante con Sombrero de Bruja
  const reina = crearCalabaza(0.55, { conLuz: true, sombrero: true, cara: true });
  reina.position.set(-1.6, 0, -1.3);
  reina.rotation.y = 0.6;
  g.add(reina);

  // 4. Fantasma Flotante Simpático
  const gFantasma = new THREE.Group();
  gFantasma.position.set(1.4, 2.2, 1.2);
  const matFantasma = new THREE.MeshLambertMaterial({ color: '#f0f6ff', transparent: true, opacity: 0.86, flatShading: true });
  const cabezaFantasma = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), matFantasma);
  cabezaFantasma.position.y = 0.3;
  const faldaFantasma = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.7, 7), matFantasma);
  faldaFantasma.rotation.x = Math.PI;
  // Ojos del fantasma
  const ojoFI = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), mat('#1a1a24'));
  ojoFI.position.set(-0.12, 0.32, 0.38);
  const ojoFD = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), mat('#1a1a24'));
  ojoFD.position.set(0.12, 0.32, 0.38);
  gFantasma.add(cabezaFantasma, faldaFantasma, ojoFI, ojoFD);
  g.add(gFantasma);

  // Banner flotante 3D
  const cartel = etiqueta('cartel-festivo halloween', '🎃 ¡Noche de Brujas! 👻');
  cartel.position.set(0, 3.4, 0);
  g.add(cartel);

  // Animaciones del escenario
  animadoresEstacionales.push((t) => {
    // Oscilación de burbujas
    for (const b of burbujas) {
      b.mesh.position.y = b.baseY + Math.sin(t * b.vel + b.fase) * b.amp;
      b.mesh.scale.setScalar(0.85 + Math.sin(t * b.vel + b.fase) * 0.25);
    }
    // Levitación del fantasma
    gFantasma.position.y = 2.2 + Math.sin(t * 2.2) * 0.3;
    gFantasma.rotation.y = Math.sin(t * 1.4) * 0.4;
    // Parpadeo de luz mágica verde
    luzPocion.intensity = 2.4 + Math.sin(t * 9) * 0.5;
  });

  return g;
}

function crearEscenarioDiaDeMuertosMeroDia() {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);

  // 1. Altar de 3 Niveles (Inframundo, Tierra, Cielo)
  const nivel1 = caja(3.4, 0.38, 2.3, '#f5efe6', 0, 0.19, -0.1);
  const nivel2 = caja(2.3, 0.38, 1.5, '#ffffff', 0, 0.57, -0.3);
  const nivel3 = caja(1.3, 0.38, 0.9, '#f5efe6', 0, 0.95, -0.5);
  g.add(nivel1, nivel2, nivel3);

  // Cenefas de papel picado en el frente de cada nivel
  g.add(crearTiraPapelPicado(3.2, 0.38));
  g.add(crearTiraPapelPicado(2.1, 0.76));
  g.add(crearTiraPapelPicado(1.2, 1.14));

  // 2. Gran Arco de Cempasúchil sobre el altar
  const arco = new THREE.Group();
  arco.position.set(0, 1.14, -0.75);
  for (let i = 0; i <= 14; i++) {
    const ang = (i / 14) * Math.PI;
    const flor = crearCempasuchil(0.16, i % 2 ? '#ff7700' : '#ffaa00');
    flor.position.set(Math.cos(ang) * 0.95, Math.sin(ang) * 0.85, 0);
    arco.add(flor);
  }
  g.add(arco);

  // 3. Calaveritas de Azúcar Tradicionales
  const crearCalaverita = (x, y, z, cColor) => {
    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    const cráneo = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.2), mat('#ffffff'));
    cráneo.position.y = 0.11;
    const ojoI = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), mat(cColor));
    ojoI.position.set(-0.06, 0.13, 0.11);
    const ojoD = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), mat(cColor));
    ojoD.position.set(0.06, 0.13, 0.11);
    const frente = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), mat('#ff007f'));
    frente.position.set(0, 0.18, 0.11);
    cg.add(cráneo, ojoI, ojoD, frente);
    return cg;
  };
  g.add(crearCalaverita(-0.4, 1.14, -0.5, '#00bcd4'));
  g.add(crearCalaverita(0.4, 1.14, -0.5, '#e91e63'));
  g.add(crearCalaverita(0, 1.14, -0.3, '#ffeb3b'));

  // 4. Pan de Muerto
  const crearPanDeMuerto = (x, y, z) => {
    const pg = new THREE.Group();
    pg.position.set(x, y, z);
    const bollo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), mat('#c68c4a'));
    bollo.scale.set(1.2, 0.7, 1.2);
    bollo.position.y = 0.1;
    const hueso1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.06), mat('#e0a768'));
    hueso1.position.y = 0.18;
    const hueso2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.32), mat('#e0a768'));
    hueso2.position.y = 0.18;
    const bolita = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), mat('#f5efe6'));
    bolita.position.y = 0.22;
    pg.add(bollo, hueso1, hueso2, bolita);
    return pg;
  };
  g.add(crearPanDeMuerto(-0.65, 0.76, -0.2));
  g.add(crearPanDeMuerto(0.65, 0.76, -0.2));

  // 5. Veladoras en los escalones
  const velas = [
    [-1.4, 0.38, 0.8], [1.4, 0.38, 0.8], [-1.4, 0.38, -0.5], [1.4, 0.38, -0.5],
    [-0.9, 0.76, 0.3], [0.9, 0.76, 0.3],
    [-0.45, 1.14, -0.75], [0.45, 1.14, -0.75],
  ];
  for (const [vx, vy, vz] of velas) g.add(crearVeladora(vx, vy, vz, { conLuz: true }));

  // Luz dorada ceremonial del altar
  const luzAltar = new THREE.PointLight('#ff9900', 2.0, 8, 2);
  luzAltar.position.set(0, 1.4, -0.2);
  g.add(luzAltar);

  // 6. Camino de pétalos de cempasúchil
  for (let i = 0; i < 24; i++) {
    const petalo = new THREE.Mesh(new THREE.CircleGeometry(0.09 + Math.random() * 0.06, 5), mat(Math.random() > 0.5 ? '#ff7700' : '#ffaa00'));
    petalo.rotation.x = -Math.PI / 2;
    petalo.position.set((Math.random() - 0.5) * 1.6, 0.19, 0.9 + Math.random() * 2.2);
    g.add(petalo);
  }

  // Banner flotante 3D
  const cartel = etiqueta('cartel-festivo diademuertos', '💀 Gran Ofrenda de Muertos 🌼');
  cartel.position.set(0, 3.2, -0.4);
  g.add(cartel);

  animadoresEstacionales.push((t) => {
    luzAltar.intensity = 1.8 + Math.sin(t * 11) * 0.35;
  });

  return g;
}

function crearEscenarioNavidadMeroDia() {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);

  // 1. Gran Árbol de Navidad Monumental
  const matPino = mat('#1b5e20');
  const matPinoClaro = mat('#25732b');
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 7), mat('#5c3a21'));
  tronco.position.y = 0.65;
  g.add(tronco);

  // 4 Niveles de ramas con conos
  const pisosArbol = [
    { r: 2.3, h: 2.1, y: 2.0, mat: matPino },
    { r: 1.8, h: 1.8, y: 3.1, mat: matPinoClaro },
    { r: 1.35, h: 1.5, y: 4.1, mat: matPino },
    { r: 0.85, h: 1.3, y: 5.0, mat: matPinoClaro },
  ];
  for (const pa of pisosArbol) {
    const cono = new THREE.Mesh(new THREE.ConeGeometry(pa.r, pa.h, 8), pa.mat);
    cono.position.y = pa.y;
    // Borde de nieve en la base de cada piso
    const nieveFalda = new THREE.Mesh(new THREE.ConeGeometry(pa.r * 1.02, 0.22, 8), mat('#ffffff'));
    nieveFalda.position.y = pa.y - pa.h / 2 + 0.11;
    g.add(cono, nieveFalda);
  }

  // Esferas navideñas brillantes
  const coloresEsferas = ['#ff1744', '#ffd700', '#2979ff', '#e040fb', '#00e676', '#ffffff'];
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 * 3; // espiral
    const altura = 1.3 + (i / 22) * 3.8;
    const radioCapa = 2.3 * (1 - (altura - 1.2) / 4.4);
    const col = coloresEsferas[i % coloresEsferas.length];
    const matEsfera = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.8 });
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), matEsfera);
    esfera.position.set(Math.sin(ang) * (radioCapa + 0.05), altura, Math.cos(ang) * (radioCapa + 0.05));
    g.add(esfera);
  }

  // Gran Estrella de Belén Dorada en la punta
  const gEstrella = new THREE.Group();
  gEstrella.position.set(0, 5.85, 0);
  const matEstrella = new THREE.MeshStandardMaterial({ color: '#fff59d', emissive: '#ffd700', emissiveIntensity: 1.8, flatShading: true });
  const conoE1 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), matEstrella);
  const conoE2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), matEstrella);
  conoE2.rotation.z = Math.PI;
  const conoE3 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), matEstrella);
  conoE3.rotation.z = Math.PI / 2;
  const conoE4 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), matEstrella);
  conoE4.rotation.z = -Math.PI / 2;
  gEstrella.add(conoE1, conoE2, conoE3, conoE4);
  g.add(gEstrella);

  // Luz dorada brillante en la estrella
  const luzEstrella = new THREE.PointLight('#ffd700', 2.4, 12, 1.8);
  luzEstrella.position.set(0, 5.9, 0);
  g.add(luzEstrella);

  // 2. Montaña de Regalos alrededor del árbol
  g.add(crearCajasRegalos());

  // 3. Muñeco de Nieve (Frosty)
  const muneco = crearMunecoNieve();
  muneco.position.set(2.4, 0, 1.1);
  muneco.rotation.y = -0.5;
  g.add(muneco);

  // 4. Copos de Nieve Cayendo por Todo el Mapa
  const copos = [];
  const geoCopo = new THREE.DodecahedronGeometry(0.08, 0);
  const matCopo = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 160; i++) {
    const copo = new THREE.Mesh(geoCopo, matCopo);
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60;
    const y = Math.random() * 20;
    copo.position.set(x, y, z);
    copo.scale.setScalar(0.6 + Math.random() * 0.8);
    g.add(copo);
    copos.push({ mesh: copo, velY: 1.8 + Math.random() * 1.6, velX: 0.6 + Math.random() * 0.8, fase: Math.random() * Math.PI * 2 });
  }

  // Banner flotante 3D
  const cartel = etiqueta('cartel-festivo navidad', '🎄 ¡Feliz Navidad! 🎅');
  cartel.position.set(0, 6.7, 0);
  g.add(cartel);

  // Animaciones navideñas
  animadoresEstacionales.push((t, dt) => {
    // Rotación de la estrella dorada
    gEstrella.rotation.y = t * 1.2;
    luzEstrella.intensity = 2.2 + Math.sin(t * 8) * 0.4;

    // Caída continua de copos de nieve
    for (const c of copos) {
      c.mesh.position.y -= c.velY * dt;
      c.mesh.position.x += Math.sin(t * 1.4 + c.fase) * (c.velX * dt);
      c.mesh.position.z += Math.cos(t * 1.1 + c.fase) * (c.velX * dt);
      if (c.mesh.position.y < 0.1) {
        c.mesh.position.y = 18 + Math.random() * 4;
        c.mesh.position.x = (Math.random() - 0.5) * 60;
        c.mesh.position.z = (Math.random() - 0.5) * 60;
      }
    }
  });

  return g;
}

// Limpieza de todos los elementos estacionales antes de cambiar
function limpiarEventoEstacional() {
  quitarDeEscena(grupoEstacional);
  grupoEstacional.clear();
  scene.add(grupoEstacional);
  animadoresEstacionales.length = 0;

  // Limpiar decoraciones de salas
  for (const s of salas.values()) {
    if (s._decoracionEstacional) {
      quitarDeEscena(s._decoracionEstacional);
      s._decoracionEstacional = null;
    }
  }

  // Limpiar nieve de los árboles
  for (const da of decoracionesArboles) quitarDeEscena(da);
  decoracionesArboles.length = 0;

  // Restaurar colores originales de la isla, farol y plaza
  if (typeof COLOR_ISLA_ORIG !== 'undefined') isla.material.color.copy(COLOR_ISLA_ORIG);
  if (typeof COLOR_ORILLA_ORIG !== 'undefined') orilla.material.color.copy(COLOR_ORILLA_ORIG);
  if (typeof COLOR_PLAZA_ORIG !== 'undefined') plaza.material.color.copy(COLOR_PLAZA_ORIG);
  if (typeof COLOR_FAROL_ORIG !== 'undefined') bombilla.color.copy(COLOR_FAROL_ORIG);
  if (typeof COLOR_LUZ_FAROL_ORIG !== 'undefined') luzFarol.color.copy(COLOR_LUZ_FAROL_ORIG);
}

// Decorar una sala según el evento activo
function decorarSalaEstacional(sala) {
  if (!eventoActualConfig || eventoActualConfig.id === 'normal') return;
  if (sala._decoracionEstacional) {
    quitarDeEscena(sala._decoracionEstacional);
    sala._decoracionEstacional = null;
  }
  const g = new THREE.Group();
  sala._decoracionEstacional = g;
  sala.g.add(g);

  const evId = eventoActualConfig.id;

  if (evId === 'halloween') {
    // Calabazas iluminadas en la entrada de la sala
    const cal1 = crearCalabaza(0.24, { conLuz: true, sombrero: false, cara: true });
    cal1.position.set(MITAD - 0.7, 0.25, MITAD - 0.4);
    cal1.rotation.y = -0.5;
    const cal2 = crearCalabaza(0.2, { conLuz: true, sombrero: false, cara: true });
    cal2.position.set(-MITAD + 0.7, 0.25, MITAD - 0.4);
    cal2.rotation.y = 0.5;
    // Murciélago descansando en el librero
    const mur = crearMurcielago(0.9);
    mur.position.set(-MITAD + 0.5, 2.25, -1.4);
    g.add(cal1, cal2, mur);
  } else if (evId === 'diademuertos') {
    // Tira de papel picado festivo en la pared frontal superior
    const papel = crearTiraPapelPicado(SALA * 0.75, 2.7);
    papel.position.set(0, 0, MITAD - 0.05);
    // Veladora en la entrada
    const vela = crearVeladora(MITAD - 0.65, 0.25, MITAD - 0.4, { conLuz: true });
    const flor = crearCempasuchil(0.16, '#ff7700');
    flor.position.set(MITAD - 0.45, 0.25, MITAD - 0.4);
    g.add(papel, vela, flor);
  } else if (evId === 'navidad') {
    // Corona navideña de pino en la pared de fondo
    const corona = crearCoronaNavidena(0.42);
    corona.position.set(0, 2.0, -MITAD + 0.32);
    corona.rotation.x = 0;
    // Tira de luces navideñas a lo largo de la pared de fondo
    const luces = crearGuirnaldaLuces(SALA * 0.85, 2.68);
    luces.position.set(0, 0, -MITAD + 0.3);
    g.add(corona, luces);
  }
}

// Aplicar y renderizar el evento estacional en el mundo
function aplicarEventoEstacional(eleccionManual = modoEventoSeleccionado) {
  eventoActualConfig = obtenerConfigEvento(eleccionManual);
  limpiarEventoEstacional();

  const cfg = eventoActualConfig;
  const evId = cfg.id;

  // Ajustes de colores de entorno según la festividad
  if (evId === 'halloween') {
    isla.material.color.set('#9eb97d'); // césped otoñal
    orilla.material.color.set('#bfa075');
    bombilla.color.set('#ff8c33');
    luzFarol.color.set('#ff6f00');

    // Calabazas Jack-o'-lantern repartidas en la plaza
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const r = 4.2;
      const cal = crearCalabaza(0.3, { conLuz: true, sombrero: i === 0, cara: true });
      cal.position.set(Math.sin(a) * r, 0.18, Math.cos(a) * r);
      cal.rotation.y = a + Math.PI;
      grupoEstacional.add(cal);
    }
  } else if (evId === 'diademuertos') {
    isla.material.color.set('#a6c287');
    bombilla.color.set('#ffaa22');
    luzFarol.color.set('#ff8f00');

    // Ramilletes de cempasúchil en el borde de la plaza
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.15;
      const r = 4.5;
      const flor = crearCempasuchil(0.2, i % 2 ? '#ff6d00' : '#ffab00');
      flor.position.set(Math.sin(a) * r, 0.18, Math.cos(a) * r);
      grupoEstacional.add(flor);
    }
    // Veladoras al inicio de los caminos
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      grupoEstacional.add(crearVeladora(Math.sin(a) * 3.8, 0.18, Math.cos(a) * 3.8, { conLuz: true }));
    }
  } else if (evId === 'navidad') {
    // Manto de nieve en toda la isla
    isla.material.color.set('#edf5f9');
    orilla.material.color.set('#c8dce8');
    plaza.material.color.set('#e2edf3');
    bombilla.color.set('#fff8db');
    luzFarol.color.set('#ffea88');

    // Copete de nieve en la cima de cada pino
    for (const arb of arboles) {
      const nievePino = malla(new THREE.ConeGeometry(0.7, 0.65, 6), '#ffffff', 0, 3.6, 0);
      arb.add(nievePino);
      decoracionesArboles.push(nievePino);
    }

    // Guirnalda festiva y lazo rojo en el farol principal
    const lazoFarol = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 6, 10), mat('#d32f2f'));
    lazoFarol.position.set(-3.6, 2.3, 2.6);
    grupoEstacional.add(lazoFarol);
  }

  // Decorar todas las salas existentes
  for (const s of salas.values()) decorarSalaEstacional(s);

  // Escenario Central Especial ("El Mero Día")
  if (cfg.esMeroDia) {
    if (evId === 'halloween') grupoEstacional.add(crearEscenarioHalloweenMeroDia());
    else if (evId === 'diademuertos') grupoEstacional.add(crearEscenarioDiaDeMuertosMeroDia());
    else if (evId === 'navidad') grupoEstacional.add(crearEscenarioNavidadMeroDia());
  }

  // Actualizar Botón de Festividad en la UI
  const botonEvento = document.getElementById('boton-evento');
  if (botonEvento) {
    botonEvento.innerHTML = `<span>${cfg.icono}</span> <span>${cfg.nombre}${cfg.esMeroDia ? ' (¡Mero Día!)' : ''}</span>`;
  }
  const modoTextoEl = document.getElementById('evento-modo-actual');
  if (modoTextoEl) {
    modoTextoEl.textContent = `Activo: ${cfg.titulo} (${eleccionManual === 'auto' || !eleccionManual ? 'Automático' : 'Manual'})`;
  }
}

// Bucle de animación estacional
function animarEventoEstacional(t, dt) {
  for (const fn of animadoresEstacionales) {
    try { fn(t, dt); } catch (e) {}
  }
}

// Modal y Selector de Festividades
const eventoOverlay = document.getElementById('evento-overlay');
const eventoGrid = document.getElementById('evento-grid');
let modalEventoAbierto = false;

function poblarOpcionesEvento() {
  if (!eventoGrid) return;
  eventoGrid.innerHTML = '';
  const actual = modoEventoSeleccionado || 'auto';

  for (const op of OPCIONES_EVENTOS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `evento-card ${actual === op.id ? 'activa' : ''}`;
    card.innerHTML = `
      <div class="evento-card-icono">${op.icono}</div>
      <div class="evento-card-info">
        <div class="evento-card-titulo">
          <span>${op.titulo}</span>
          <span class="evento-card-tag ${op.especial ? 'especial' : ''}">${op.tag}</span>
        </div>
        <div class="evento-card-desc">${op.desc}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      modoEventoSeleccionado = op.id === 'auto' ? null : op.id;
      aplicarEventoEstacional(modoEventoSeleccionado);
      cerrarModalEvento();
    });
    eventoGrid.appendChild(card);
  }
}

function abrirModalEvento() {
  if (!eventoOverlay) return;
  poblarOpcionesEvento();
  eventoOverlay.classList.add('abierta');
  modalEventoAbierto = true;
}

function cerrarModalEvento() {
  if (!eventoOverlay) return;
  eventoOverlay.classList.remove('abierta');
  modalEventoAbierto = false;
}

function toggleModalEvento() {
  if (modalEventoAbierto) cerrarModalEvento();
  else abrirModalEvento();
}

if (eventoOverlay) {
  eventoOverlay.addEventListener('click', (e) => {
    if (e.target === eventoOverlay) cerrarModalEvento();
  });
}
// Comandos para abrir el menú de festividades:
// 1. En el chat con el comando /eventos o /menu
// 2. En la consola con window.eventos() o eventos()
// 3. En la URL con ?menu=1 o ?eventos=1
window.eventos = () => abrirModalEvento();
window.festividades = () => abrirModalEvento();
if (new URLSearchParams(location.search).has('menu') || new URLSearchParams(location.search).has('eventos')) {
  setTimeout(abrirModalEvento, 400);
}

// Inicializar festividades
aplicarEventoEstacional();

// ---------- vistas: isometrica, tercera y primera persona ----------
const MODOS = ['iso', 'tercera', 'primera'];
const NOMBRE_MODO = { iso: 'Isométrica', tercera: 'Tercera persona', primera: 'Primera persona' };
const AYUDA_MODO = {
  iso: 'Clic en el piso: caminas · clic en un agente: vas a verlo · arrastra: mueves la vista · rueda: zoom · V: cambiar vista · G: gestos',
  tercera: 'Clic: mirar con el mouse · W A S D: caminar (Shift corre) · E: hablar · Esc: soltar el mouse · V: cambiar vista · G: gestos',
  primera: 'Clic: mirar con el mouse · W A S D: caminar (Shift corre) · E: hablar · Esc: soltar el mouse · V: cambiar vista · G: gestos',
};
const camPersona = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 140);
// Niebla siempre puesta (quitarla y ponerla recompila los shaders = tiron);
// en isometrica se manda fuera de rango porque la camara esta lejos.
const niebla = new THREE.Fog('#dfe8f1', 1e4, 1e4);
scene.fog = niebla;
let modo = 'iso';
let camara = camera;
const vista = { yaw: 0, pitch: 0 };
const teclas = new Set();
const botonModo = document.getElementById('modo');
const ayuda = document.getElementById('titulo');
const accion = document.getElementById('accion');
let cercano = null;

function cambiarModo(nuevo) {
  modo = nuevo;
  if (ruletaAbierta) cerrarRuleta();
  const iso = modo === 'iso';
  camara = iso ? camera : camPersona;
  controls.enabled = iso;
  niebla.near = iso ? 1e4 : 35;
  niebla.far = iso ? 1e4 : 120;
  tarjeta.classList.remove('si');
  yoDestino = null;
  yoBusca = null;
  objetivoCamara = null;
  if (iso) {
    if (document.pointerLockElement) document.exitPointerLock();
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(yo.g.position);
    camera.position.copy(yo.g.position).add(offset);
  } else {
    vista.yaw = yo.g.rotation.y;
    vista.pitch = 0;
    colocarCamara(1);
  }
  yo.g.visible = modo !== 'primera';
  etiquetaYo.visible = yo.g.visible; // CSS2D no hereda la visibilidad del padre
  document.body.dataset.modo = modo;
  botonModo.textContent = `Vista: ${NOMBRE_MODO[modo]}`;
  ayuda.textContent = AYUDA_MODO[modo];
}
botonModo.addEventListener('click', () => {
  cambiarModo(MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length]);
  botonModo.blur(); // que la barra espaciadora no lo vuelva a apretar
});

addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  if (modalEventoAbierto) {
    if (e.code === 'Escape') {
      e.preventDefault();
      cerrarModalEvento();
      return;
    }
  }
  if (e.code === 'KeyG' && !e.repeat) {
    e.preventDefault();
    toggleRuleta();
    return;
  }
  if (ruletaAbierta) {
    if (e.code === 'Escape') {
      e.preventDefault();
      cerrarRuleta();
      return;
    }
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 6) {
      e.preventDefault();
      ejecutarGestoDesdeRuleta(num - 1);
      return;
    }
  }
  if (e.code === 'KeyV' && !e.repeat) botonModo.click();
  if (e.code === 'KeyE' && !e.repeat && modo !== 'iso') hablarConCercano();
  teclas.add(e.code);
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  vista.yaw -= e.movementX * 0.0025;
  // pitch = mirar hacia arriba; en tercera persona la camara solo sube y baja un poco
  const [min, max] = modo === 'primera' ? [-1.2, 1.2] : [-0.6, 0.25];
  vista.pitch = Math.min(max, Math.max(min, vista.pitch - e.movementY * 0.0025));
});

// Choques: paredes, librero y escritorios de cada sala, y la orilla de la isla.
const RADIO = 0.3;
const local = new THREE.Vector3();
function choca(x, z) {
  if (Math.hypot(x, z) > 58) return true;
  for (const sala of salas.values()) {
    local.set(x, 0, z);
    sala.interior.worldToLocal(local);
    if (Math.abs(local.x) > MITAD + 1 || Math.abs(local.z) > MITAD + 1) continue;
    const dentro = (x0, x1, z0, z1) => local.x > x0 - RADIO && local.x < x1 + RADIO && local.z > z0 - RADIO && local.z < z1 + RADIO;
    if (dentro(-MITAD, MITAD, -MITAD, -MITAD + 0.25) || dentro(-MITAD, -MITAD + 0.25, -MITAD, MITAD)) return true;
    if (dentro(-MITAD + 0.27, -MITAD + 0.73, -2.35, -0.45)) return true;
    for (let k = 0; k < sala.escritorios.length; k++) {
      if (!sala.escritorios[k]) continue;
      const [px, pz] = PUESTOS[k];
      if (dentro(px - 0.75, px + 0.75, pz + 0.35, pz + 1.1)) return true;
    }
  }
  return false;
}
function alturaEn(x, z) {
  for (const sala of salas.values()) {
    local.set(x, 0, z);
    sala.interior.worldToLocal(local);
    if (Math.abs(local.x) <= MITAD && Math.abs(local.z) <= MITAD) return 0.25;
  }
  return Math.hypot(x, z) < 4.9 ? 0.18 : 0;
}

function moverConTeclas(dt) {
  const tiene = (...c) => c.some((k) => teclas.has(k));
  const adelante = (tiene('KeyW', 'ArrowUp') ? 1 : 0) - (tiene('KeyS', 'ArrowDown') ? 1 : 0);
  const lado = (tiene('KeyD', 'ArrowRight') ? 1 : 0) - (tiene('KeyA', 'ArrowLeft') ? 1 : 0);
  const pos = yo.g.position;
  let caminando = false;
  if (adelante || lado) {
    const dir = new THREE.Vector3(Math.sin(vista.yaw), 0, Math.cos(vista.yaw)).multiplyScalar(adelante)
      .add(new THREE.Vector3(-Math.cos(vista.yaw), 0, Math.sin(vista.yaw)).multiplyScalar(lado))
      .normalize()
      .multiplyScalar(3.6 * dt * (tiene('ShiftLeft', 'ShiftRight') ? 1.7 : 1));
    // Si choca de frente, intenta deslizarse por un solo eje. Si ya esta dentro
    // de un obstaculo (llego ahi en isometrica, que no tiene choques), lo deja salir.
    const libre = (x, z) => atorado || !choca(x, z);
    const atorado = choca(pos.x, pos.z);
    if (libre(pos.x + dir.x, pos.z + dir.z)) pos.add(dir);
    else if (libre(pos.x + dir.x, pos.z)) pos.x += dir.x;
    else if (libre(pos.x, pos.z + dir.z)) pos.z += dir.z;
    if (modo === 'tercera') {
      let dif = Math.atan2(dir.x, dir.z) - yo.g.rotation.y;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      yo.g.rotation.y += dif * Math.min(1, dt * 12);
    }
    caminando = true;
  }
  if (modo === 'primera') yo.g.rotation.y = vista.yaw;
  pos.y = suave(pos.y, alturaEn(pos.x, pos.z), dt, 12);
  return caminando;
}

function colocarCamara(dt) {
  const cabeza = yo.g.position.clone();
  if (modo === 'primera') {
    cabeza.y += 1.25;
    camPersona.position.copy(cabeza);
    const mira = new THREE.Vector3(Math.sin(vista.yaw) * Math.cos(vista.pitch), Math.sin(vista.pitch), Math.cos(vista.yaw) * Math.cos(vista.pitch));
    camPersona.lookAt(cabeza.add(mira));
    return;
  }
  cabeza.y += 1.1;
  const elev = 0.3 - vista.pitch;
  const atras = new THREE.Vector3(-Math.sin(vista.yaw) * Math.cos(elev), Math.sin(elev), -Math.cos(vista.yaw) * Math.cos(elev)).multiplyScalar(4.6);
  camPersona.position.lerp(cabeza.clone().add(atras), Math.min(1, dt * 10));
  camPersona.lookAt(cabeza);
}

// El agente mas cercano (a menos de 2.3) se puede saludar con E.
function buscarCercano() {
  cercano = null;
  let mejor = 2.3;
  for (const p of personas.values()) {
    if (!p.g.visible) continue;
    const d = p.g.position.distanceTo(yo.g.position);
    if (d < mejor) {
      mejor = d;
      cercano = p;
    }
  }
  const mostrar = modo !== 'iso' && cercano && !tarjeta.classList.contains('si');
  accion.classList.toggle('si', Boolean(mostrar));
  if (mostrar) {
    const texto = `<kbd>E</kbd> Hablar con ${esc(nombreDe(cercano))}${quienVisita(cercano.sesion) === cercano.id ? ' <b>· te busca</b>' : ''}`;
    if (accion.dataset.texto !== texto) {
      accion.innerHTML = texto;
      accion.dataset.texto = texto;
    }
  }
}
function hablarConCercano() {
  if (!cercano) return;
  seleccionar(cercano.id, { mover: false });
  const s = cercano.sesion;
  if (s.espera && (quienVisita(s) === cercano.id || (s.espera.tipo === 'mensaje' && !cercano.ayudante))) abrirTarjeta(cercano);
}

// ---------- conectados: quien tiene la pagina abierta y si su Claude trabaja ----------
const avisos = document.getElementById('avisos');
const AVISO_MS = 4500;
let enPagina = null; // nombres con la pagina abierta (sin ti); null hasta la primera lista, que no avisa
let claudeAntes = null; // nombre -> estado de su Claude en la foto anterior
const CLAUDE = { trabajando: 'Claude trabajando', espera: 'Claude en espera', apagado: 'Sin Claude' };
const nombreDueno = (s) => s.dueno || 'Anfitrión'; // el anfitrion sin OFICINA_NOMBRE se llama asi tambien en /eventos

function claudeDe(nombre) {
  const despiertas = fotoActual.sesiones.filter((s) => nombreDueno(s) === nombre && !s.dormido);
  if (!despiertas.length) return 'apagado';
  return despiertas.some((s) => s.estado !== 'listo' || s.agentes.some((a) => !a.terminado)) ? 'trabajando' : 'espera';
}

function avisar(texto, color) {
  const div = document.createElement('div');
  div.className = 'avisito';
  div.innerHTML = `<i style="background:${color}"></i>${esc(texto)}`;
  avisos.append(div);
  setTimeout(() => div.remove(), AVISO_MS);
}

function recibirConectados(nombres) {
  const ahora = new Set(nombres.filter((n) => n !== miNombre));
  if (enPagina) {
    for (const n of ahora) if (!enPagina.has(n)) avisar(`${n} se conectó`, '#4fcf73');
    for (const n of enPagina) if (!ahora.has(n)) avisar(`${n} se desconectó`, '#e05555');
  }
  enPagina = ahora;
  pintarPanel();
}

// Avisa cuando el Claude de un amigo pasa de apagado a encendido o al reves (no por cada herramienta).
function revisarClaude() {
  const ahora = new Map([...new Set(fotoActual.sesiones.map(nombreDueno))].map((n) => [n, claudeDe(n)]));
  if (claudeAntes) {
    for (const n of new Set([...ahora.keys(), ...claudeAntes.keys()])) {
      if (n === miNombre) continue;
      const antes = (claudeAntes.get(n) || 'apagado') !== 'apagado';
      const despues = (ahora.get(n) || 'apagado') !== 'apagado';
      if (!antes && despues) avisar(`${n} empezó a usar Claude`, '#4fa8ff');
      if (antes && !despues) avisar(`${n} dejó de usar Claude`, '#c3ccd6');
    }
  }
  claudeAntes = ahora;
}

function pintarPuntos() {
  for (const o of otros.values()) o.e.element.dataset.claude = claudeDe(o.meta.nombre);
}

// Solo con amigos: estando solo, el panel queda como siempre.
function htmlConectados() {
  const amigos = new Set([...(enPagina || []), ...fotoActual.sesiones.map(nombreDueno)]);
  amigos.delete(miNombre);
  if (!amigos.size) return '';
  const fila = (nombre, titulo, pagina) => {
    const claude = claudeDe(nombre);
    return `<div class="persona" data-claude="${claude}">
      <span class="dot${pagina ? ' si' : ''}" title="${pagina ? 'Con la oficina abierta' : 'Sin la oficina abierta'}"></span>
      <b>${esc(titulo)}</b>
      <span>${pagina ? 'En la oficina' : 'Fuera'} · <em>${CLAUDE[claude]}</em></span>
    </div>`;
  };
  const enLinea = (n) => Boolean(enPagina && enPagina.has(n));
  const orden = [...amigos].sort((a, b) => enLinea(b) - enLinea(a) || a.localeCompare(b));
  return `<div class="grupo conectados"><h3>Conectados</h3>${fila(miNombre, 'Tú', true)}${orden.map((n) => fila(n, n, enLinea(n))).join('')}</div>`;
}

// ---------- datos en vivo ----------
function conectar() {
  // Con tu id, el servidor borra tu avatar en cuanto se cierra esta pagina (si no, al recargar quedaba un clon unos segundos).
  const ruta = rutaConNombre('/eventos');
  const fuente = new EventSource(`${ruta}${ruta.includes('?') ? '&' : '?'}id=${miId}`);
  fuente.onopen = () => {
    ultimoEnvio = -Infinity; // si se corto y volvio, reaparece ya sin esperar al siguiente envio
    conexion.classList.add('ok');
    conexion.textContent = 'En vivo';
  };
  fuente.onmessage = (m) => sincronizar(JSON.parse(m.data));
  fuente.addEventListener('jugadores', (m) => sincronizarJugadores(JSON.parse(m.data)));
  fuente.addEventListener('chat', (m) => recibirChat(JSON.parse(m.data)));
  fuente.addEventListener('conectados', (m) => recibirConectados(JSON.parse(m.data)));
  fuente.addEventListener('gesto', (m) => recibirGesto(JSON.parse(m.data)));
  fuente.addEventListener('yo', (m) => {
    miNombre = JSON.parse(m.data);
    if (fotoActual.sesiones.length) sincronizar(fotoActual);
  });
  fuente.onerror = () => {
    conexion.classList.remove('ok');
    conexion.textContent = 'Sin conexión';
  };
}
conectar();

// ---------- bucle ----------
const reloj = new THREE.Clock();
let acumulado = 0;
function cuadro() {
  requestAnimationFrame(cuadro);
  acumulado += reloj.getDelta();
  // Tope de ~30 cuadros por segundo; la tolerancia evita saltarse un vsync de mas en pantallas de 60 Hz.
  if (acumulado < 1 / 30 - 0.005) return;
  const dt = Math.min(acumulado, 0.1);
  acumulado = 0;
  const t = reloj.elapsedTime;
  pintarCielo(t);
  const yoCamina = moverYo(t, dt);
  mandarPosicion(t);
  moverOtros(t, dt);
  globos();
  ubicarVisitantes();
  for (const p of personas.values()) animarPersona(p, t, dt);
  animarEventoEstacional(t, dt);

  const gestoYo = actualizarGesto(yo, t, dt);

  // Quieto en isometrica, tu avatar voltea hacia quien lo busca (o hacia ti).
  const visita = [...personas.values()].find((p) => p.lugar === 'visita');
  if (modo === 'iso' && !yoCamina && !gestoYo) {
    const ref = visita ? visita.g.position.clone().sub(yo.g.position) : camera.position.clone().sub(controls.target);
    let dif = Math.atan2(ref.x, ref.z) - yo.g.rotation.y;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    yo.g.rotation.y += dif * Math.min(1, dt * 3);
  }
  if (!gestoYo) {
    yo.brazos[1].rotation.x = suave(yo.brazos[1].rotation.x, visita && !yoCamina ? -0.9 : -0.1, dt, 5);
    yo.cabeza.rotation.z = Math.sin(t * 0.8) * 0.05;
  }
  if (anillo.visible) {
    const k = (t * 0.8) % 1;
    anillo.scale.setScalar(1 + k * 0.8);
    anillo.material.opacity = 0.8 * (1 - k);
  }

  if (modo !== 'iso') colocarCamara(dt);
  buscarCercano();

  // Paredes que tapan: en isometrica, las del lado de la camara; en tercera
  // persona, las que quedan entre la camara y tu avatar; en primera, ninguna.
  const plano = -MITAD + 0.125;
  const yoLocal = new THREE.Vector3();
  for (const sala of salas.values()) {
    sala.cartel.visible = modo === 'iso' || sala.g.position.distanceTo(yo.g.position) < 14;
    const haciaCamara = camara.position.clone().sub(sala.g.position).setY(0).normalize();
    local.copy(camara.position);
    sala.interior.worldToLocal(local);
    yoLocal.copy(yo.g.position);
    sala.interior.worldToLocal(yoLocal);
    const entreMedio = (m) => {
      const [c, y, cOtro, yOtro] = m.eje === 'z' ? [local.z, yoLocal.z, local.x, yoLocal.x] : [local.x, yoLocal.x, local.z, yoLocal.z];
      return (c - plano) * (y - plano) < 0 && Math.max(Math.abs(cOtro), Math.abs(yOtro)) < MITAD + 1;
    };
    for (const m of sala.muros) {
      const tapa = modo === 'iso' ? haciaCamara.dot(m.normal) > 0.15 : modo === 'tercera' && entreMedio(m);
      const meta = tapa ? 0.15 : 1;
      if (Math.abs(m.opacidad - meta) < 0.01) continue;
      m.opacidad = suave(m.opacidad, meta, dt, 6);
      m.grupo.traverse((o) => {
        if (!o.isMesh) return;
        o.material.opacity = m.opacidad;
        o.material.depthWrite = m.opacidad > 0.9;
      });
    }
  }

  if (modo === 'iso' && objetivoCamara) {
    const antes = controls.target.clone();
    controls.target.lerp(objetivoCamara, Math.min(1, dt * 3));
    camera.position.add(controls.target.clone().sub(antes));
    if (controls.target.distanceTo(objetivoCamara) < 0.05) objetivoCamara = null;
  }
  if (modo === 'iso') controls.update();
  renderer.render(scene, camara);
  capa.render(scene, camara);
}
cuadro();

addEventListener('resize', () => {
  encuadrar();
  camPersona.aspect = innerWidth / innerHeight;
  camPersona.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  capa.setSize(innerWidth, innerHeight);
});
