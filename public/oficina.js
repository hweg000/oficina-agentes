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
isla.castShadow = false;
scene.add(isla);
const orilla = malla(new THREE.CylinderGeometry(60, 52, 6, 32), '#c9a77e', 0, -6, 0);
scene.add(orilla);

const plaza = malla(new THREE.CylinderGeometry(4.8, 5, 0.18, 24), '#f1e7d6', 0, 0.09, 0);
scene.add(plaza);
const pisos = [isla, plaza]; // donde tu avatar puede caminar con clic
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
yo.g.position.set(0, 0.18, 0);
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
  if (texto) fetch(rutaConNombre('/chat'), { method: 'POST', body: JSON.stringify({ id: miId, texto }) }).catch(() => {});
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
