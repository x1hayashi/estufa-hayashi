// ============================================================
// HAYASHI PRINT SERVER — Windows Local
// Faz polling no backend Render e imprime via USB
// ============================================================
// INSTALAÇÃO:
//   1. Instale Node.js em nodejs.org (versão LTS)
//   2. Coloque esta pasta em C:\hayashi-printer
//   3. Abra Prompt como Administrador na pasta
//   4. Execute: npm install
//   5. Edite o RENDER_URL e SENHA abaixo
//   6. Dê dois cliques em INICIAR.bat
// ============================================================

const http  = require('http');
const https = require('https');
const { exec } = require('child_process');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

// ── CONFIGURAÇÃO — edite aqui ─────────────────────────────
const CONFIG = {
  RENDER_URL:   'https://estufa-hayashi.onrender.com', // URL do seu backend no Render
  SENHA:        'hayashi2024',                          // Mesma senha do sistema
  PORTA_USB:    'LPT1',                                 // Porta da impressora (LPT1 ou \\.\USB001)
  POLL_MS:      3000,                                   // Verificar a cada 3 segundos
  LOG_FILE:     path.join(__dirname, 'print-log.txt'),
};

// ── LOG ───────────────────────────────────────────────────
function log(msg) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  console.log(linha);
  fs.appendFileSync(CONFIG.LOG_FILE, linha + '\n', 'utf8');
}

// ── HTTP HELPER ───────────────────────────────────────────
function fetchJSON(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    };
    const req = lib.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ ok: false, raw: data }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── DETECTAR PORTA IMPRESSORA ─────────────────────────────
function detectarPorta() {
  return new Promise(resolve => {
    exec('wmic printer get Name,PortName', (err, stdout) => {
      if (!err) {
        for (const linha of stdout.split('\n')) {
          if (/elgin|l42|zpl/i.test(linha)) {
            const partes = linha.trim().split(/\s{2,}/);
            if (partes.length >= 2) {
              const porta = partes[partes.length - 1].trim();
              if (porta) { log(`Impressora detectada: ${porta}`); resolve(porta); return; }
            }
          }
        }
      }
      resolve(CONFIG.PORTA_USB);
    });
  });
}

// ── IMPRIMIR ZPL ─────────────────────────────────────────
async function imprimirZPL(zpl, lote, copias) {
  const porta   = await detectarPorta();
  const tmpFile = path.join(os.tmpdir(), `hayashi_${Date.now()}.zpl`);

  // Repetir o ZPL pelo número de cópias se ^PQ não estiver no ZPL
  const zplFinal = zpl.includes('^PQ') ? zpl : zpl.replace('^XZ', `^PQ${copias},0,1,Y\n^XZ`);

  return new Promise((resolve, reject) => {
    fs.writeFileSync(tmpFile, zplFinal, 'binary');
    exec(`copy /b "${tmpFile}" "${porta}"`, (err) => {
      try { fs.unlinkSync(tmpFile); } catch(e) {}
      if (err) {
        log(`Erro COPY, tentando PowerShell...`);
        exec(`powershell -Command "Get-Content '${tmpFile}' | Out-Printer -Name '${porta}'"`, (err2) => {
          if (err2) reject(err2);
          else { log(`Impresso via PowerShell: ${lote}`); resolve(); }
        });
      } else {
        log(`Impresso via COPY: ${lote} (${copias}x)`);
        resolve();
      }
    });
  });
}

// ── POLLING ───────────────────────────────────────────────
async function verificarFila() {
  try {
    const data = await fetchJSON(
      `${CONFIG.RENDER_URL}/print/pending?senha=${encodeURIComponent(CONFIG.SENHA)}`
    );
    if (!data.ok || !data.itens?.length) return;

    for (const item of data.itens) {
      log(`Processando: ${item.lote} (${item.copias} cópias)`);
      try {
        await imprimirZPL(item.zpl, item.lote, item.copias || 1);

        // Marcar como impresso no Render
        await fetchJSON(`${CONFIG.RENDER_URL}/print/done/${item.id}`, {
          method: 'POST',
          body: JSON.stringify({ senha: CONFIG.SENHA }),
        });
      } catch(e) {
        log(`Erro ao imprimir ${item.lote}: ${e.message}`);
      }
    }
  } catch(e) {
    // Render pode estar dormindo (free tier) — silencioso
  }
}

// ── INICIAR ───────────────────────────────────────────────
log('════════════════════════════════════════');
log('  HAYASHI PRINT SERVER (Windows)');
log(`  Render: ${CONFIG.RENDER_URL}`);
log(`  Verificando fila a cada ${CONFIG.POLL_MS/1000}s`);
log('  Deixe esta janela aberta');
log('════════════════════════════════════════');

detectarPorta().then(p => { CONFIG.PORTA_USB = p; });

// Polling contínuo
setInterval(verificarFila, CONFIG.POLL_MS);
verificarFila(); // Verificar imediatamente ao iniciar

process.on('uncaughtException', err => log(`Erro: ${err.message}`));
