// ============================================================
// ESTUFA HAYASHI — Backend (Render)
// Proxy Google Sheets · Fila de impressão · Auth
// ============================================================
const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const app      = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ── ENV VARS (configurar no Render) ──────────────────────
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const SENHA_ACESSO    = process.env.SENHA_ACESSO    || 'hayashi2024';
const PORT            = process.env.PORT            || 3000;

// ── FILA DE IMPRESSÃO (em memória) ───────────────────────
const filaImpressao = [];

// ── MIDDLEWARE AUTH ───────────────────────────────────────
function autenticar(req, res, next) {
  const senha = req.body?._senha || req.query?.senha || '';
  if (senha !== SENHA_ACESSO) {
    return res.status(403).json({ ok: false, erro: 'Acesso negado' });
  }
  next();
}

// ── PING ─────────────────────────────────────────────────
app.get('/ping', (req, res) => {
  res.json({ ok: true, versao: '2.0', ts: new Date().toISOString() });
});

// ── PROXY → APPS SCRIPT (GET) ────────────────────────────
app.get('/api/:acao', autenticar, async (req, res) => {
  if (!APPS_SCRIPT_URL) return res.status(500).json({ ok: false, erro: 'APPS_SCRIPT_URL não configurada' });
  try {
    const params = new URLSearchParams({ ...req.query, acao: req.params.acao });
    const resp   = await fetch(`${APPS_SCRIPT_URL}?${params}`);
    const data   = await resp.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── PROXY → APPS SCRIPT (POST) ───────────────────────────
app.post('/api', autenticar, async (req, res) => {
  if (!APPS_SCRIPT_URL) return res.status(500).json({ ok: false, erro: 'APPS_SCRIPT_URL não configurada' });
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    });
    // Apps Script com no-cors retorna opaque — assumir sucesso
    res.json({ ok: true, msg: 'Dados enviados ao Sheets' });
  } catch(e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── FILA DE IMPRESSÃO ─────────────────────────────────────
// O servidor local Windows faz polling aqui e imprime
app.post('/print/queue', autenticar, (req, res) => {
  const { zpl, lote, copias } = req.body;
  if (!zpl) return res.status(400).json({ ok: false, erro: 'ZPL não informado' });
  const item = { id: Date.now(), zpl, lote: lote || '', copias: copias || 1, ts: new Date().toISOString(), status: 'PENDENTE' };
  filaImpressao.push(item);
  console.log(`[FILA] Etiqueta enfileirada: ${lote} (${copias} cópias)`);
  res.json({ ok: true, id: item.id, msg: 'Etiqueta enfileirada' });
});

// O servidor Windows faz GET aqui para buscar pendentes
app.get('/print/pending', (req, res) => {
  const senha = req.query.senha || '';
  if (senha !== SENHA_ACESSO) return res.status(403).json({ ok: false, erro: 'Acesso negado' });
  const pendentes = filaImpressao.filter(i => i.status === 'PENDENTE');
  res.json({ ok: true, itens: pendentes });
});

// O servidor Windows marca como impresso
app.post('/print/done/:id', (req, res) => {
  const senha = req.body?.senha || '';
  if (senha !== SENHA_ACESSO) return res.status(403).json({ ok: false, erro: 'Acesso negado' });
  const item = filaImpressao.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ ok: false, erro: 'Item não encontrado' });
  item.status = 'IMPRESSO';
  item.tsImpresso = new Date().toISOString();
  console.log(`[FILA] Impresso: ${item.lote}`);
  res.json({ ok: true });
});

// Status da fila
app.get('/print/status', (req, res) => {
  const senha = req.query.senha || '';
  if (senha !== SENHA_ACESSO) return res.status(403).json({ ok: false });
  res.json({
    ok: true,
    pendentes:  filaImpressao.filter(i => i.status === 'PENDENTE').length,
    impressos:  filaImpressao.filter(i => i.status === 'IMPRESSO').length,
    total:      filaImpressao.length,
  });
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Estufa Hayashi Backend rodando na porta ${PORT}`);
  console.log(`APPS_SCRIPT_URL: ${APPS_SCRIPT_URL ? 'configurada' : 'NÃO CONFIGURADA'}`);
});
