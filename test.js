// Prueba del estado: node test.js
const assert = require('assert');
const { crearOficina, aplicar, foto, publica } = require('./estado');

const of = crearOficina();
const base = { session_id: 's1', cwd: 'C:\\Users\\yo\\Projects\\mcp' };
const ev = (e) => aplicar(of, { ...base, ...e }, 1000);

ev({ hook_event_name: 'SessionStart' });
ev({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'C:\\x\\db-tools.js' } });
let s = foto(of, 1000).sesiones[0];
assert.equal(s.proyecto, 'mcp');
assert.equal(s.estado, 'editando');
assert.equal(s.detalle, 'db-tools.js');

// Permiso: llega aviso, se contesta cuando la herramienta corre.
ev({ hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' });
assert.equal(foto(of, 1000).sesiones[0].espera.tipo, 'permiso');
ev({ hook_event_name: 'PostToolUse', tool_name: 'Bash' });
assert.equal(foto(of, 1000).sesiones[0].espera, null);

// Subagente anunciado sin id y luego con agent_id: es el mismo, no dos.
ev({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'Revisar permisos', subagent_type: 'Explore' } });
ev({ hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'Explore' });
ev({ hook_event_name: 'PreToolUse', tool_name: 'Grep', agent_id: 'a1', tool_input: { pattern: 'requireAdmin' } });
s = foto(of, 1000).sesiones[0];
assert.equal(s.agentes.length, 1);
assert.equal(s.agentes[0].descripcion, 'Revisar permisos');
assert.equal(s.agentes[0].estado, 'leyendo');
assert.equal(s.estado, 'delegando', 'la herramienta del subagente no cambia a la sesion principal');

// Pregunta de un subagente la lleva el subagente.
ev({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', agent_id: 'a1', tool_input: { questions: [{ question: 'Cual rol?' }] } });
assert.deepEqual(foto(of, 1000).sesiones[0].espera, { tipo: 'pregunta', texto: 'Cual rol?', de: 'a1' });

// Termina y se va despues de la despedida.
ev({ hook_event_name: 'SubagentStop', agent_id: 'a1' });
assert.equal(foto(of, 1000).sesiones[0].agentes[0].terminado, true);
assert.equal(foto(of, 1000 + 21000).sesiones[0].agentes.length, 0);

// Eventos sin sesion o desconocidos no rompen nada.
assert.equal(aplicar(of, {}), false);
assert.equal(aplicar(of, { ...base, hook_event_name: 'Raro' }), false);

// La version publica no deja salir rutas, comandos ni bitacora.
ev({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cat .env' } });
ev({ hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' });
const pub = JSON.stringify(publica(foto(of, 1000)));
for (const secreto of ['cat .env', 'Projects', 'permission']) assert(!pub.includes(secreto), secreto);
assert.equal(publica(foto(of, 1000)).sesiones[0].espera.tipo, 'permiso');

// Sesion de un amigo: su nombre va en la sala.
aplicar(of, { hook_event_name: 'SessionStart', session_id: 'Ana:s9', cwd: '/home/ana/api-pagos', dueno: 'Ana' }, 1000);
assert(foto(of, 1000).sesiones.some((x) => x.proyecto === 'Ana · api-pagos'));

ev({ hook_event_name: 'SessionEnd' });
assert.equal(foto(of, 1000).sesiones.filter((x) => x.id === 's1').length, 0);
console.log('OK estado');
