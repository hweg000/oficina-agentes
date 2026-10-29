// Oficina de agentes: recibe los eventos de los hooks de Claude Code (de
// cualquier proyecto) y los transmite en vivo a la pagina 3D. Solo escucha en
// esta maquina: ahi pasan rutas y comandos de tus proyectos.
// shortcut: el estado vive en memoria; si se reinicia, cada sesion reaparece con su siguiente evento.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { crearOficina, aplicar, foto, publica } = require('./estado');

const PUERTO = Number(process.env.OFICINA_PORT) || 3950;
// Modo barrio: OFICINA_TOKENS="Ana:token1:ana@correo.com,Beto:token2" deja que cada amigo mande sus eventos por
// el tunel. El correo (opcional) es con el que entra por Access: asi su muneco lleva el mismo nombre que sus salas.
const AMIGOS = (process.env.OFICINA_TOKENS || '').split(',').map((x) => x.trim().split(':')).filter((x) => x.length >= 2);
const TOKENS = new Map(AMIGOS.map(([nombre, token]) => [token, nombre]));
const CORREOS = new Map(AMIGOS.filter((x) => x[2]).map(([nombre, , correo]) => [correo.toLowerCase(), nombre]));
const NOMBRE = process.env.OFICINA_NOMBRE || ''; // para que tus propias salas tambien lleven tu nombre
// Lo que entra por Cloudflare Tunnel trae este header; lo local (tus hooks, tu navegador) no.
const esRemoto = (req) => Boolean(req.headers['cf-connecting-ip']);
const ARCHIVOS = {
  '/': ['index.html', 'text/html'],
  '/oficina.js': ['oficina.js', 'text/javascript'],
};

const oficina = crearOficina();
const clientes = new Map(); // res -> remoto
const crudo = []; // ultimos eventos (solo nombres de campos) para depurar los hooks

let pendiente = null;
function emitir() {
  if (pendiente) return;
  pendiente = setTimeout(() => {
    pendiente = null;
    const f = foto(oficina);
    const datos = `data: ${JSON.stringify(f)}\n\n`;
    const datosPublicos = `data: ${JSON.stringify(publica(f))}\n\n`;
    for (const [res, remoto] of clientes) res.write(remoto ? datosPublicos : datos);
  }, 80);
}
setInterval(emitir, 5000); // para que "dormido" y las despedidas avancen sin eventos nuevos

// Avatares de quienes tienen la pagina abierta. Van por su propio evento SSE para no reenviar toda la oficina en cada paso.
const jugadores = new Map(); // `${nombre}:${id}` -> { id, nombre, x, y, z, ry, ultimo }
const JUGADOR_MS = 10000; // sin noticias en este tiempo, cerro la pagina
let pendienteJugadores = null;
function emitirJugadores() {
  if (pendienteJugadores) return;
  pendienteJugadores = setTimeout(() => {
    pendienteJugadores = null;
    for (const [k, j] of jugadores) if (Date.now() - j.ultimo > JUGADOR_MS) jugadores.delete(k);
    const datos = `event: jugadores\ndata: ${JSON.stringify([...jugadores.values()].map(({ ultimo, ...j }) => j))}\n\n`;
    for (const res of clientes.keys()) res.write(datos);
  }, 100);
}
setInterval(emitirJugadores, 3000);
// Desde el tunel, Cloudflare Access pone el correo de quien entro; de ahi sale su nombre y no se puede inventar.
function nombreDeVisita(req) {
  try {
    const q = new URL(req.url, 'http://localhost').searchParams.get('nombre');
    if (q) return q.trim().slice(0, 30);
  } catch {}
  if (!esRemoto(req)) return NOMBRE || 'Anfitrión';
  const correo = String(req.headers['cf-access-authenticated-user-email'] || '').toLowerCase();
  return CORREOS.get(correo) || correo.split('@')[0];
}

// Quien tiene la pagina abierta, contado por su conexion: no se va aunque cambie de pestaña (ahi deja de mandar su posicion).
const conectados = new Map(); // res -> nombre
function emitirConectados() {
  const datos = `event: conectados\ndata: ${JSON.stringify([...new Set(conectados.values())].filter(Boolean))}\n\n`;
  for (const res of clientes.keys()) res.write(datos);
}

// Chat: los ultimos mensajes se le mandan a quien llega.
const chat = [];
function mandarChat(m) {
  chat.push(m);
  if (chat.length > 30) chat.shift();
  const datos = `event: chat\ndata: ${JSON.stringify([m])}\n\n`;
  for (const res of clientes.keys()) res.write(datos);
}

function leerJson(req, res, max, usar) {
  let cuerpo = '';
  req.on('data', (c) => {
    cuerpo += c;
    if (cuerpo.length > max) req.destroy();
  });
  req.on('end', () => {
    try {
      usar(JSON.parse(cuerpo));
    } catch {}
    res.writeHead(204).end();
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const remoto = esRemoto(req);

  if (req.method === 'POST' && url === '/evento') {
    const dueno = remoto ? TOKENS.get((req.headers.authorization || '').replace(/^Bearer\s+/i, '')) : NOMBRE;
    if (remoto && !dueno) return res.writeHead(401).end();
    let cuerpo = '';
    req.on('data', (c) => {
      cuerpo += c;
      if (cuerpo.length > 8e6) req.destroy(); // el hook manda el evento completo (incluye lo que leyo o escribio)
    });
    req.on('end', () => {
      try {
        const ev = JSON.parse(cuerpo);
        ev.dueno = dueno;
        // Dos amigos nunca comparten sesion, aunque su session_id coincidiera.
        if (dueno && ev.session_id) ev.session_id = `${dueno}:${ev.session_id}`;
        crudo.push({ evento: ev.hook_event_name, herramienta: ev.tool_name, campos: Object.keys(ev) });
        if (crudo.length > 50) crudo.shift();
        // _prueba_hace_ms solo lo manda prueba-estados.js, para fingir un evento viejo (estado "dormido").
        if (aplicar(oficina, ev, Date.now() - (Number(ev._prueba_hace_ms) || 0))) emitir();
      } catch {}
      res.writeHead(204).end();
    });
    return;
  }

  if (req.method === 'POST' && (url === '/posicion' || url === '/chat' || url === '/gesto')) {
    const nombre = nombreDeVisita(req);
    if (!nombre) return res.writeHead(403).end();
    if (url === '/gesto') {
      return leerJson(req, res, 1000, ({ id, gesto, objetivo }) => {
        if (typeof id === 'string' && typeof gesto === 'string' && gesto.length <= 40) {
          const datos = `event: gesto\ndata: ${JSON.stringify({ id: id.slice(0, 40), nombre, gesto, objetivo: objetivo ? String(objetivo).slice(0, 50) : null, t: Date.now() })}\n\n`;
          for (const c of clientes.keys()) c.write(datos);
        }
      });
    }
    if (url === '/chat') {
      return leerJson(req, res, 2000, ({ id, texto }) => {
        texto = String(texto || '').trim().slice(0, 200);
        if (texto) mandarChat({ id: String(id || '').slice(0, 40), nombre, texto, t: Date.now() });
      });
    }
    return leerJson(req, res, 1000, ({ id, x, y, z, ry }) => {
      const n = [x, y, z, ry].map(Number);
      if (typeof id === 'string' && id.length <= 40 && n.every((v) => Number.isFinite(v) && Math.abs(v) < 500)) {
        jugadores.set(`${nombre}:${id}`, { id, nombre, x: n[0], y: n[1], z: n[2], ry: n[3], ultimo: Date.now() });
        emitirJugadores();
      }
    });
  }

  if (url === '/eventos') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const f = foto(oficina);
    const nombre = nombreDeVisita(req);
    const id = String(new URL(req.url, 'http://localhost').searchParams.get('id') || '').slice(0, 40);
    res.write(`event: yo\ndata: ${JSON.stringify(nombre)}\n\n`);
    res.write(`event: chat\ndata: ${JSON.stringify(chat)}\n\n`);
    res.write(`data: ${JSON.stringify(remoto ? publica(f) : f)}\n\n`);
    clientes.set(res, remoto);
    conectados.set(res, nombre);
    emitirJugadores();
    emitirConectados();
    req.on('close', () => {
      clientes.delete(res);
      conectados.delete(res);
      emitirConectados();
      if (id && jugadores.delete(`${nombre}:${id}`)) emitirJugadores();
    });
    return;
  }

  if (url === '/estado' || (url === '/crudo' && !remoto)) {
    const f = foto(oficina);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(url === '/crudo' ? crudo : remoto ? publica(f) : f, null, 2));
  }

  const archivo = ARCHIVOS[url];
  if (!archivo) return res.writeHead(404).end();
  // no-store: que ni el navegador ni Cloudflare guarden una version vieja de la pagina.
  res.writeHead(200, { 'Content-Type': `${archivo[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  if (url !== '/') return fs.createReadStream(path.join(__dirname, 'public', archivo[0])).pipe(res);
  // El ?v= cambia con cada version de oficina.js, por si algun cache ya tenia la anterior.
  const version = Math.round(fs.statSync(path.join(__dirname, 'public', 'oficina.js')).mtimeMs);
  res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8').replace('src="/oficina.js"', `src="/oficina.js?v=${version}"`));
});

server.on('error', (err) => {
  console.error(`No se pudo abrir la oficina en el puerto ${PUERTO}: ${err.message}`);
  process.exit(1);
});
server.listen(PUERTO, '127.0.0.1', () => console.log(`Oficina de agentes en http://localhost:${PUERTO}`));
