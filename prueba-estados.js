// Caso de prueba visual: pone un agente en cada estado y luego hace las
// transiciones (llegar, terminar, que te busquen, regresar).
// Uso: con la oficina abierta en el navegador, node prueba-estados.js
// Ctrl+C limpia a todos los agentes de prueba.
const PUERTO = process.env.OFICINA_PORT || 3950;
const ESTADOS = 'C:\\Pruebas\\prueba-estados';
const VISITAS = 'C:\\Pruebas\\prueba-visitas';

const enviar = (ev) =>
  fetch(`http://127.0.0.1:${PUERTO}/evento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) }).catch(() => {
    console.error('No hay oficina en el puerto', PUERTO, '- arrancala con npm start');
    process.exit(1);
  });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const usados = new Set();
const ev = (session_id, cwd, hook_event_name, extra = {}) => {
  usados.add(session_id);
  return enviar({ session_id, cwd, hook_event_name, ...extra });
};
const herramienta = (id, cwd, tool_name, tool_input, extra = {}) => ev(id, cwd, 'PreToolUse', { tool_name, tool_input, ...extra });
const paso = (texto) => console.log(`\n> ${texto}`);

async function limpiar() {
  for (const id of usados) await enviar({ session_id: id, hook_event_name: 'SessionEnd' });
}
process.on('SIGINT', async () => {
  await limpiar();
  console.log('\nAgentes de prueba eliminados.');
  process.exit(0);
});

(async () => {
  // Por si quedo algo de una corrida anterior.
  for (const id of ['leyendo', 'editando', 'comando', 'consultando', 'delegando', 'pensando', 'trabajando', 'compactando', 'listo', 'espera', 'dormido', 'permiso', 'pregunta', 'nuevo']) usados.add(id);
  await limpiar();
  await pausa(500);

  paso('Sala "prueba-estados": un agente por estado de trabajo');
  await ev('leyendo', ESTADOS, 'UserPromptSubmit');
  await herramienta('leyendo', ESTADOS, 'Read', { file_path: 'C:\\x\\estado-leyendo.md' });
  console.log('  Leyendo        -> mueve la cabeza, pantalla azul');
  await ev('editando', ESTADOS, 'UserPromptSubmit');
  await herramienta('editando', ESTADOS, 'Edit', { file_path: 'C:\\x\\estado-editando.js' });
  console.log('  Editando       -> teclea rapido, pantalla verde');
  await ev('comando', ESTADOS, 'UserPromptSubmit');
  await herramienta('comando', ESTADOS, 'Bash', { command: 'npm test (estado comando)' });
  console.log('  Comando        -> se inclina, pantalla parpadea');
  await ev('consultando', ESTADOS, 'UserPromptSubmit');
  await herramienta('consultando', ESTADOS, 'mcp__erp__show_report', { query: 'estado consultando (MCP)' });
  console.log('  Consultando    -> como leyendo, pantalla morada');
  await ev('delegando', ESTADOS, 'UserPromptSubmit');
  await herramienta('delegando', ESTADOS, 'Agent', { description: 'Subagente de prueba', subagent_type: 'Explore' });
  await ev('delegando', ESTADOS, 'SubagentStart', { agent_id: 'sub-delegado', agent_type: 'Explore' });
  await herramienta('delegando', ESTADOS, 'Grep', { pattern: 'subagente leyendo' }, { agent_id: 'sub-delegado', agent_type: 'Explore' });
  console.log('  Delegando      -> agita el brazo; su subagente (con gorra) lee a un lado');
  await ev('pensando', ESTADOS, 'UserPromptSubmit');
  console.log('  Pensando       -> puntitos sobre la cabeza');
  await ev('trabajando', ESTADOS, 'UserPromptSubmit');
  await herramienta('trabajando', ESTADOS, 'Skill', { description: 'estado trabajando (herramienta generica)' });
  console.log('  Trabajando     -> puntitos, pantalla turquesa');
  await ev('compactando', ESTADOS, 'UserPromptSubmit');
  await ev('compactando', ESTADOS, 'PreCompact');
  console.log('  Ordenando mem. -> puntitos, pantalla lila');

  paso('Sala "prueba-visitas": estados de espera');
  await ev('listo', VISITAS, 'UserPromptSubmit');
  await ev('listo', VISITAS, 'Stop');
  console.log('  Listo          -> recargado en la silla');
  await ev('espera', VISITAS, 'Stop');
  await ev('espera', VISITAS, 'Notification', { notification_type: 'idle_prompt', message: 'Claude is waiting for your input' });
  console.log('  Te espera      -> termino y espera tu mensaje (no camina)');
  await ev('dormido', VISITAS, 'Stop', { _prueba_hace_ms: 20 * 60 * 1000 });
  console.log('  Dormido        -> 20 min sin actividad: cabeza abajo, pantalla apagada');
  await herramienta('permiso', VISITAS, 'Bash', { command: 'npm run deploy' });
  await ev('permiso', VISITAS, 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash: npm run deploy' });
  console.log('  Permiso        -> se levanta y camina hasta tu avatar con su burbuja');
  await herramienta('pregunta', VISITAS, 'Agent', { description: 'Subagente con duda', subagent_type: 'general-purpose' });
  await ev('pregunta', VISITAS, 'SubagentStart', { agent_id: 'sub-duda', agent_type: 'general-purpose' });
  await herramienta('pregunta', VISITAS, 'AskUserQuestion', { questions: [{ question: '¿Le doy acceso de Ventas al reporte de cobranza?' }] }, { agent_id: 'sub-duda' });
  console.log('  Pregunta       -> el SUBAGENTE (no su jefe) camina hasta ti');

  paso('Prueba tu avatar: clic en el piso para caminar; clic en un agente que te busca para ver su tarjeta.');
  paso('En 25 s llega un agente nuevo caminando...');
  await pausa(25000);
  await ev('nuevo', VISITAS, 'SessionStart');
  await herramienta('nuevo', VISITAS, 'Read', { file_path: 'C:\\x\\recien-llegado.md' });
  console.log('  Nuevo          -> entra por la puerta y se sienta');

  paso('En 15 s el subagente de "delegando" termina...');
  await pausa(15000);
  await ev('delegando', ESTADOS, 'SubagentStop', { agent_id: 'sub-delegado' });
  await ev('delegando', ESTADOS, 'PostToolUse', { tool_name: 'Agent' });
  console.log('  Termino        -> brinca con los brazos arriba, sale por la puerta y desaparece');

  paso('En 20 s se contestan el permiso y la pregunta...');
  await pausa(20000);
  await ev('permiso', VISITAS, 'PostToolUse', { tool_name: 'Bash' });
  await ev('pregunta', VISITAS, 'PostToolUse', { tool_name: 'AskUserQuestion', agent_id: 'sub-duda' });
  console.log('  Contestados    -> los dos regresan a su escritorio');

  paso('Listo. Ctrl+C para borrar a los agentes de prueba (o vuelve a correr el script para repetir).');
})();
