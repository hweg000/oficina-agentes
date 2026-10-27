// Oficina de agentes: recibe los eventos de los hooks de Claude Code (de
// cualquier proyecto) y los transmite en vivo a la pagina 3D. Solo escucha en
// esta maquina: ahi pasan rutas y comandos de tus proyectos.
// shortcut: el estado vive en memoria; si se reinicia, cada sesion reaparece con su siguiente evento.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { crearOficina, aplicar, foto, publica } = require('./estado');

const PUERTO = Number(process.env.OFICINA_PORT) || 3950;
// Modo barrio: OFICINA_TOKENS="Ana:token1,Beto:token2" deja que cada amigo mande sus eventos por el tunel.
const TOKENS = new Map(
  (process.env.OFICINA_TOKENS || '').split(',').filter((x) => x.includes(':')).map((x) => x.trim().split(':').reverse())
);
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

  if (url === '/eventos') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const f = foto(oficina);
    res.write(`data: ${JSON.stringify(remoto ? publica(f) : f)}\n\n`);
    clientes.set(res, remoto);
    req.on('close', () => clientes.delete(res));
    return;
  }

  if (url === '/estado' || (url === '/crudo' && !remoto)) {
    const f = foto(oficina);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(url === '/crudo' ? crudo : remoto ? publica(f) : f, null, 2));
  }

  const archivo = ARCHIVOS[url];
  if (!archivo) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': `${archivo[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
  fs.createReadStream(path.join(__dirname, 'public', archivo[0])).pipe(res);
});

server.on('error', (err) => {
  console.error(`No se pudo abrir la oficina en el puerto ${PUERTO}: ${err.message}`);
  process.exit(1);
});
server.listen(PUERTO, '127.0.0.1', () => console.log(`Oficina de agentes en http://localhost:${PUERTO}`));
