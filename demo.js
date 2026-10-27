// Manda eventos de mentira a la oficina para verla moverse sin Claude Code:
// node demo.js   (con el servidor ya corriendo)
const PUERTO = process.env.OFICINA_PORT || 3950;
const enviar = (ev) =>
  fetch(`http://127.0.0.1:${PUERTO}/evento`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) }).catch(() => {});

const SESIONES = [
  { session_id: 'demo-mcp-1', cwd: 'C:\\Projects\\mcp' },
  { session_id: 'demo-mcp-2', cwd: 'C:\\Projects\\mcp' },
  { session_id: 'demo-tienda', cwd: 'C:\\Projects\\tienda-web' },
  { session_id: 'demo-logistica', cwd: 'C:\\Projects\\Logistica' },
];
const HERRAMIENTAS = [
  ['Read', { file_path: 'C:\\x\\db-tools.js' }],
  ['Edit', { file_path: 'C:\\x\\catalog.js' }],
  ['Grep', { pattern: 'requireAdmin' }],
  ['Bash', { command: 'npm test' }],
  ['Write', { file_path: 'C:\\x\\index.html' }],
  ['mcp__erp__show_report', { report: 'QQ_ardoc_reg' }],
];
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const azar = (a) => a[Math.floor(Math.random() * a.length)];

(async () => {
  for (const s of SESIONES) await enviar({ ...s, hook_event_name: 'SessionStart' });
  for (const s of SESIONES) await enviar({ ...s, hook_event_name: 'UserPromptSubmit' });

  // Un subagente con id en la sesion de mcp.
  await enviar({ ...SESIONES[0], hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'Revisar permisos', subagent_type: 'Explore' } });
  await enviar({ ...SESIONES[0], hook_event_name: 'PreToolUse', tool_name: 'Grep', agent_id: 'sub-1', tool_input: { pattern: 'role_table_access' } });
  for (let i = 0; i < 3; i++) {
    await enviar({ ...SESIONES[2], hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: `Revisor ${i + 1}`, subagent_type: 'general-purpose' } });
    await enviar({ ...SESIONES[2], hook_event_name: 'PreToolUse', tool_name: azar(HERRAMIENTAS)[0], agent_id: `w-${i}`, tool_input: azar(HERRAMIENTAS)[1] });
  }

  let paso = 0;
  for (;;) {
    paso++;
    for (const s of SESIONES) {
      if (Math.random() < 0.5) continue;
      const [tool, input] = azar(HERRAMIENTAS);
      await enviar({ ...s, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
    }
    for (let i = 0; i < 3; i++) {
      const [tool, input] = azar(HERRAMIENTAS);
      await enviar({ ...SESIONES[2], hook_event_name: 'PreToolUse', tool_name: tool, agent_id: `w-${i}`, tool_input: input });
    }
    if (paso % 6 === 2) await enviar({ ...SESIONES[1], hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash: npm run deploy' });
    if (paso % 6 === 5) await enviar({ ...SESIONES[1], hook_event_name: 'PostToolUse', tool_name: 'Bash' });
    if (paso % 8 === 4) await enviar({ ...SESIONES[0], hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', agent_id: 'sub-1', tool_input: { questions: [{ question: '¿Le doy acceso de Ventas al reporte de cobranza?' }] } });
    if (paso % 8 === 7) await enviar({ ...SESIONES[0], hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', agent_id: 'sub-1' });
    if (paso % 10 === 9) await enviar({ ...SESIONES[3], hook_event_name: 'Stop' });
    await pausa(1500);
  }
})();
