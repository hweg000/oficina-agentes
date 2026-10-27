# Oficina de agentes

Una oficina 3D low poly, en vivo, de lo que hacen tus sesiones de Claude Code y
sus agentes en **todos** tus proyectos:

- una sala por proyecto y un escritorio por agente (los subagentes llevan gorra);
- cada uno muestra lo que hace: leyendo, editando, corriendo un comando,
  pensando, delegando, dormido…;
- cuando alguno necesita tu permiso o te hace una pregunta, se levanta y camina
  hasta tu avatar con una burbuja.

No gasta tokens: solo recibe los eventos que Claude Code ya produce (hooks).
Todo es local (`127.0.0.1`); no se publica nada.

## Requisitos

- **Node.js 18 o más nuevo** (no usa dependencias: no hace falta `npm install`).
- **Claude Code** 2.1 o más nuevo (para los hooks `async`).
- **curl** en la terminal (viene con Windows 10/11, macOS y Linux).
- En Windows, **Git Bash** instalado: Claude Code lo usa para correr los hooks.
- Un navegador moderno con WebGL. La página carga three.js desde un CDN, así
  que la primera vez necesita internet.

## Cómo correrlo

1. Descarga el proyecto:

   ```
   git clone https://github.com/hweg000/oficina-agentes.git
   cd oficina-agentes
   ```

2. Arranca la oficina y déjala abierta:

   ```
   npm start
   ```

   Abre **http://localhost:3950** en el navegador. Si el puerto está ocupado,
   usa otro con `OFICINA_PORT=3960 npm start` (y cambia el puerto también en
   los hooks del paso 3).

3. Conecta Claude Code: pega el bloque `hooks` de la sección
   [Conectar Claude Code](#conectar-claude-code-hooks-globales) en tu
   `~/.claude/settings.json` (en Windows: `C:\Users\<tu usuario>\.claude\settings.json`).
   Si ya tienes un bloque `hooks`, agrega estos eventos dentro del tuyo.

4. Usa Claude Code como siempre, en cualquier proyecto. Su sala aparece en la
   oficina con su primer evento.

Para verla funcionar sin Claude Code (con la oficina corriendo, en otra terminal):

```
npm run prueba     # pone un agente en cada estado y hace las transiciones (Ctrl+C limpia)
npm run demo       # eventos al azar sin fin, para verla moverse
npm test           # prueba del modelo de estado
```

## Controles

Hay tres vistas; se cambian con la tecla **V** o el botón "Vista" (abajo a la izquierda).

**Tercera y primera persona:** clic para mirar con el mouse, **W A S D** (o
flechas) para caminar, **Shift** para correr, **E** para hablar con el agente
de enfrente (si te busca, abre su tarjeta) y **Esc** para soltar el mouse.
Aquí no se atraviesan paredes ni escritorios.

**Isométrica:**

- **Clic en el piso:** tu avatar camina hacia allá y la cámara lo sigue.
- **Clic en un agente:** tu avatar va a verlo y ves su bitácora en el panel.
  Si ese agente te estaba esperando (permiso o pregunta), se abre su tarjeta
  con el texto completo y un botón **Abrir en Antigravity** (o VS Code, según el selector del panel) que enfoca la ventana
  de ese proyecto. La respuesta se da en Claude Code; la oficina solo muestra.
- **Arrastrar:** mueve la vista. **Rueda:** zoom.
- Los agentes que te buscan van a donde esté tu avatar.

## Conectar Claude Code (hooks globales)

Agrega esto a `~/.claude/settings.json`. Los hooks son `async`: corren en
segundo plano y no frenan a Claude Code aunque la oficina esté apagada.

```json
"hooks": {
  "SessionStart":       [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "SessionEnd":         [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "UserPromptSubmit":   [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "PreToolUse":         [{ "matcher": "*", "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "PostToolUse":        [{ "matcher": "*", "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "PostToolUseFailure": [{ "matcher": "*", "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "Notification":       [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "Stop":               [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "SubagentStart":      [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "SubagentStop":       [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }],
  "PreCompact":         [{ "hooks": [{ "type": "command", "async": true, "command": "curl -s -m 2 -H \"Content-Type: application/json\" --data-binary @- http://127.0.0.1:3950/evento >/dev/null 2>&1 || true" }] }]
}
```

Para desconectarla, borra ese bloque `hooks`.

## Depurar

- `http://localhost:3950/estado`: lo que la oficina cree que pasa.
- `http://localhost:3950/crudo`: los últimos 50 eventos recibidos (solo nombres de campos).

El estado vive en memoria: si reinicias el servidor, cada sesión reaparece con
su siguiente evento.
