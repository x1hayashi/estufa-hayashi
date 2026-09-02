# 🌿 Estufa Hayashi — Sistema de Rastreabilidade

App web para rastreabilidade de lotes de batata-semente, controle de laboratório, produtividade e impressão de etiquetas.

## Estrutura

```
estufa-hayashi/
├── frontend/          → GitHub Pages (app PWA)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   └── icon-512.png
├── backend/           → Render (proxy + fila impressão)
│   ├── server.js
│   ├── package.json
│   └── windows-print-server/   → Roda no PC com a impressora
│       ├── server.js
│       ├── package.json
│       └── INICIAR.bat
└── README.md
```

## Deploy

### 1. GitHub Pages (frontend)
1. Crie o repositório `estufa-hayashi` no GitHub
2. Vá em Settings → Pages → Branch: `main` → Folder: `/frontend`
3. URL: `https://SEU_USUARIO.github.io/estufa-hayashi`

### 2. Render (backend)
1. New Web Service → conecte o repositório
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Configure as variáveis de ambiente:
   - `APPS_SCRIPT_URL` = URL do Google Apps Script
   - `SENHA_ACESSO` = senha do sistema
6. URL gerada: `https://estufa-hayashi.onrender.com`

### 3. Windows (impressora)
1. Instale Node.js em nodejs.org
2. Copie a pasta `windows-print-server` para `C:\hayashi-printer`
3. Edite `server.js`: coloque a URL do Render e a senha
4. Execute `npm install` no Prompt como Administrador
5. Dê dois cliques em `INICIAR.bat`

### 4. Configurar no app
- Abra o app → ⚙️ Config
- URL do Apps Script: URL do Google Apps Script
- URL servidor impressão: URL do Render + `/print/queue`

## Variáveis de ambiente (Render)
| Variável | Descrição |
|---|---|
| `APPS_SCRIPT_URL` | URL do Google Apps Script publicado como Web App |
| `SENHA_ACESSO` | Senha de acesso ao sistema (mesma do Apps Script) |
| `PORT` | Porta (Render define automaticamente) |
