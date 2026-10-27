// Estado de la oficina armado solo con los eventos que mandan los hooks de
// Claude Code: sesiones (una por ventana de Claude, agrupadas por proyecto)
// y sus agentes (subagentes y agentes de flujos).
const DORMIDO_MS = 15 * 60 * 1000;
const OLVIDAR_MS = 8 * 60 * 60 * 1000;
const DESPEDIDA_MS = 20 * 1000; // un agente terminado se queda unos segundos para verlo irse
const BITACORA_MAX = 40;

const ESTADO_POR_HERRAMIENTA = [
  [/^(Read|Grep|Glob|WebFetch|WebSearch|LS)$/, 'leyendo'],
  [/^(Edit|Write|MultiEdit|NotebookEdit)$/, 'editando'],
  [/^(Bash|PowerShell)$/, 'comando'],
  [/^(Agent|Task|Workflow)$/, 'delegando'],
  [/^(AskUserQuestion|ExitPlanMode)$/, 'pregunta'],
  [/^mcp__/, 'consultando'],
];

function estadoDeHerramienta(tool) {
  for (const [re, estado] of ESTADO_POR_HERRAMIENTA) if (re.test(tool || '')) return estado;
  return 'trabajando';
}

function detalle(input) {
  if (!input || typeof input !== 'object') return '';
  if (input.file_path) return String(input.file_path).split(/[\\/]/).pop();
  if (input.command) return String(input.command).slice(0, 120);
  if (Array.isArray(input.questions) && input.questions[0]) return input.questions[0].question || '';
  for (const k of ['description', 'pattern', 'url', 'query', 'prompt']) if (input[k]) return String(input[k]).slice(0, 120);
  return '';
}

function crearOficina() {
  return { sesiones: new Map(), provisionales: 0 };
}

function obtenerSesion(of, ev, ahora) {
  let s = of.sesiones.get(ev.session_id);
  if (!s) {
    const cwd = ev.cwd || '';
    s = {
      id: ev.session_id,
      cwd,
      proyecto: cwd.split(/[\\/]/).filter(Boolean).pop() || 'sin proyecto',
      estado: 'listo',
      detalle: '',
      espera: null,
      agentes: new Map(),
      bitacora: [],
      ultimo: ahora,
    };
    of.sesiones.set(ev.session_id, s);
  }
  return s;
}

function obtenerAgente(s, ev, ahora) {
  if (!ev.agent_id) return null;
  let a = s.agentes.get(ev.agent_id);
  if (!a) {
    // La sesion ya lo anuncio al llamar la herramienta Agent (sin id): es el mismo.
    const prov = [...s.agentes.values()].find((x) => x.provisional && !x.terminado);
    if (prov) s.agentes.delete(prov.id);
    a = prov
      ? { ...prov, id: ev.agent_id, provisional: false }
      : { id: ev.agent_id, tipo: ev.agent_type || 'agente', descripcion: '', estado: 'pensando', detalle: '', terminado: false };
    s.agentes.set(a.id, a);
  }
  if (ev.agent_type && a.tipo === 'agente') a.tipo = ev.agent_type;
  a.ultimo = ahora;
  return a;
}

function tipoDeAviso(ev) {
  const m = ev.message || '';
  if (ev.notification_type === 'permission_prompt' || /permission|permiso/i.test(m)) return 'permiso';
  if (ev.notification_type === 'idle_prompt' || /waiting for your input|esperando/i.test(m)) return 'mensaje';
  return 'aviso';
}

// Aplica un evento de hook. Devuelve true si cambio algo.
function aplicar(of, ev, ahora = Date.now()) {
  if (!ev || !ev.session_id) return false;
  const evento = ev.hook_event_name;
  if (evento === 'SessionEnd') return of.sesiones.delete(ev.session_id);

  const s = obtenerSesion(of, ev, ahora);
  s.ultimo = ahora;
  const a = obtenerAgente(s, ev, ahora);
  const quien = a || s;
  const tool = ev.tool_name || '';
  let texto = '';

  switch (evento) {
    case 'SessionStart':
      s.estado = 'listo';
      s.detalle = '';
      texto = 'Abrio la sesion';
      break;
    case 'UserPromptSubmit':
      s.estado = 'pensando';
      s.detalle = '';
      s.espera = null;
      texto = 'Recibio tu mensaje';
      break;
    case 'PreToolUse': {
      quien.estado = estadoDeHerramienta(tool);
      quien.detalle = detalle(ev.tool_input);
      texto = `${tool} ${quien.detalle}`.trim();
      if (quien.estado === 'pregunta') s.espera = { tipo: 'pregunta', texto: quien.detalle || 'Tengo una pregunta', de: a ? a.id : null };
      if (!a && (tool === 'Agent' || tool === 'Task')) {
        const id = `prov-${++of.provisionales}`;
        const input = ev.tool_input || {};
        s.agentes.set(id, { id, provisional: true, tipo: input.subagent_type || 'agente', descripcion: input.description || '', estado: 'pensando', detalle: '', terminado: false, ultimo: ahora });
      }
      break;
    }
    case 'PostToolUse':
    case 'PostToolUseFailure':
      quien.estado = 'pensando';
      // Si la herramienta ya corrio, el permiso o la pregunta ya se contesto.
      if (s.espera && (s.espera.tipo === 'permiso' || /^(AskUserQuestion|ExitPlanMode)$/.test(tool))) s.espera = null;
      texto = evento === 'PostToolUseFailure' ? `Fallo ${tool}` : '';
      break;
    case 'Notification':
      s.espera = { tipo: tipoDeAviso(ev), texto: ev.message || '', de: null };
      texto = ev.message || 'Aviso';
      break;
    case 'Stop':
      s.estado = 'listo';
      s.detalle = '';
      if (s.espera && s.espera.tipo !== 'mensaje') s.espera = null;
      texto = 'Termino su turno';
      break;
    case 'SubagentStart':
      if (!a) return false;
      a.estado = 'pensando';
      texto = `Empezo ${a.descripcion || a.tipo}`;
      break;
    case 'SubagentStop': {
      const fin = a || [...s.agentes.values()].find((x) => x.provisional && !x.terminado);
      if (fin) Object.assign(fin, { terminado: true, estado: 'listo', detalle: '', ultimo: ahora });
      texto = `Termino ${fin ? fin.descripcion || fin.tipo : 'un agente'}`;
      break;
    }
    case 'PreCompact':
      s.estado = 'compactando';
      texto = 'Ordenando su memoria';
      break;
    default:
      return false;
  }

  if (texto) {
    s.bitacora.push({ t: ahora, quien: a ? a.descripcion || a.tipo : 'Principal', texto: texto.slice(0, 160) });
    if (s.bitacora.length > BITACORA_MAX) s.bitacora.shift();
  }
  return true;
}

// Foto serializable para la pagina; de paso olvida lo viejo.
function foto(of, ahora = Date.now()) {
  const sesiones = [];
  for (const s of of.sesiones.values()) {
    if (ahora - s.ultimo > OLVIDAR_MS) {
      of.sesiones.delete(s.id);
      continue;
    }
    for (const a of s.agentes.values()) {
      // Terminado hace rato, o sin noticias (se perdio su SubagentStop).
      if ((a.terminado && ahora - a.ultimo > DESPEDIDA_MS) || ahora - a.ultimo > DORMIDO_MS) s.agentes.delete(a.id);
    }
    sesiones.push({
      id: s.id,
      proyecto: s.proyecto,
      cwd: s.cwd,
      estado: s.estado,
      detalle: s.detalle,
      espera: s.espera,
      dormido: ahora - s.ultimo > DORMIDO_MS,
      agentes: [...s.agentes.values()].map(({ id, tipo, descripcion, estado, detalle: d, terminado }) => ({ id, tipo, descripcion, estado, detalle: d, terminado })),
      bitacora: s.bitacora,
    });
  }
  return { ahora, sesiones };
}

module.exports = { crearOficina, aplicar, foto, estadoDeHerramienta };
