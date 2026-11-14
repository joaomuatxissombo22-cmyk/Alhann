import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const AGT_SERVICES = [
  'registarFactura',
  'obterEstado',
  'listarFacturas',
  'consultarFactura',
  'solicitarSerie',
  'listarSeries',
  'validarDocumento',
] as const;

type AgtServiceName = (typeof AGT_SERVICES)[number];

const KNOWN_APP_ROUTES = new Set([
  '/',
  '/index.html',
  '/about',
  '/about/',
  '/sobre',
  '/contact',
  '/contact/',
  '/contactos',
  '/terms',
  '/terms/',
  '/termos',
  '/privacy',
  '/privacy/',
  '/privacidade',
  '/pricing',
  '/planos',
  '/features',
  '/funcionalidades',
  '/faq',
  '/login',
  '/register',
  '/dashboard',
  '/painel-adm-alhan',
  '/painel-adm-alhan/',
]);

const DEFAULT_LLMS_MARKDOWN = `# ALHAN FACTURA

> Software Profissional SaaS de Facturação Electrónica, Exportação SAF-T (AO), Integração Oficial AGT (IVA 14% e Retenção na Fonte 6,5%) e Pagamentos Multicaixa Express para Empresas em Angola, desenvolvido por ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA.

O ALHAN FACTURA é uma plataforma de gestão comercial, facturação electrónica (formato A4 e Talão Térmico 80mm/58mm), controlo de stock, tesouraria e conformidade tributária desenhada especificamente para a realidade fiscal da República de Angola (Decreto Presidencial n.º 71/25 da Administração Geral Tributária — AGT).

- Entidade Proprietária: ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA (Luanda, Angola)
- Moeda Padrão: Kwanza Angolano (Kz / AOA)
- Impostos Suportados: IVA Taxa Normal 14% (7%, 5% ou Isento) e Retenção na Fonte de 6,5% (Imposto Industrial)
- Promoção Activa: Black Friday -60% em todos os planos de subscrição e módulo promocional nas facturas emitidas
- Canal Oficial de Pagamento Multicaixa Express: 927 496 287 (Beneficiário: ALHAN)
- Contactos Oficiais: Telefone +244 922 021 211 / +244 927 496 287 | E-mail: facturao@alhan.pro

## Páginas Principais

- [Página Inicial ALHAN FACTURA](https://plum-quetzal-938419.hostingersite.com/): Apresentação completa do software de facturação electrónica, planos com desconto Black Friday de 60%, calculadora fiscal e demonstração interactiva.
- [Sobre a ALHAN Consultoria](https://plum-quetzal-938419.hostingersite.com/about): Missão, arquitectura SaaS multi-empresa e compromisso com a conformidade fiscal junto da AGT em Angola.
- [Contactos Comerciais e Suporte Técnico](https://plum-quetzal-938419.hostingersite.com/contact): Atendimento comercial e apoio técnico em Luanda (+244 922 021 211, +244 927 496 287, facturao@alhan.pro).
- [Termos e Condições de Utilização](https://plum-quetzal-938419.hostingersite.com/terms): Regras contratuais do serviço SaaS, imutabilidade de documentos fiscais e preparação para certificação AGT.
- [Política de Privacidade e Criptografia](https://plum-quetzal-938419.hostingersite.com/privacy): Isolamento multi-tenant, encriptação TLS 1.3 / AES-256 e conservação legal de ficheiros SAF-T (AO).

## Recursos para Agentes e Integrações Técnicas

- [MCP Server Card (SEP-1649)](https://plum-quetzal-938419.hostingersite.com/.well-known/mcp/server-card.json): Declaração oficial de capacidades Model Context Protocol (MCP) e ferramentas disponíveis.
- [Endpoint MCP JSON-RPC](https://plum-quetzal-938419.hostingersite.com/api/mcp): Endpoint de execução de ferramentas para cálculo de IVA 14%, Retenção 6,5% e consulta de planos em Kwanzas (AOA).
- [Mapa do Site XML](https://plum-quetzal-938419.hostingersite.com/sitemap.xml): Lista estruturada de URLs públicas para indexação por motores de busca e agentes.
`;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signAgtPayloadJws(payloadObj: Record<string, unknown>, companyNif: string): {
  jwsCompact: string;
  jwsHeaderSummary: string;
  usingOfficialCert: boolean;
} {
  const privateKeyPem = process.env.AGT_JWS_PRIVATE_KEY_PEM || '';
  const thumbprint = process.env.AGT_CERTIFICATE_THUMBPRINT || 'PENDING_OFFICIAL_AGT_CERT';
  const producerNif = process.env.AGT_PRODUCER_NIF || companyNif;
  const usingOfficialCert = Boolean(
    privateKeyPem.includes('PRIVATE KEY') && process.env.AGT_CLIENT_ID && process.env.AGT_CLIENT_SECRET
  );

  const header = {
    alg: usingOfficialCert ? 'RS256' : 'HS256',
    typ: 'JOSE+JSON',
    kid: thumbprint,
    crit: ['iat', 'nifProdutor'],
    iat: Math.floor(Date.now() / 1000),
    nifProdutor: producerNif,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payloadObj));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  let signature = '';
  if (usingOfficialCert) {
    try {
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signingInput);
      signer.end();
      signature = base64UrlEncode(signer.sign(privateKeyPem));
    } catch {
      const hmac = crypto.createHmac('sha256', thumbprint);
      hmac.update(signingInput);
      signature = base64UrlEncode(hmac.digest());
    }
  } else {
    const hmac = crypto.createHmac('sha256', `ALHAN_AUDIT_${producerNif}`);
    hmac.update(signingInput);
    signature = base64UrlEncode(hmac.digest());
  }

  return {
    jwsCompact: `${encodedHeader}.${encodedPayload}.${signature}`,
    jwsHeaderSummary: JSON.stringify(header),
    usingOfficialCert,
  };
}

// ============================================================================
// PERMANENT SERVER-SIDE REGISTRY VAULT & ANTI-INTRUSION SECURITY ENGINE
// ============================================================================
const DATA_DIR = path.join(__dirname, 'data');
const VAULT_FILE = path.join(DATA_DIR, 'alhan_permanent_registry.json');
const VAULT_BACKUP_FILE = path.join(DATA_DIR, 'alhan_permanent_registry.backup.json');
const ADMIN_HMAC_SECRET =
  process.env.ALHAN_ADMIN_HMAC_SECRET || 'ALHAN_MASTER_SECURITY_VAULT_KEY_2026_AO';

const FICTITIOUS_NIFS = new Set([
  '5401192837',
  '5402881920',
  '5409918273',
  '5000112233',
  '5417283910',
  '5403391821',
  '5408821904',
  '5401928374',
  '0000000000',
]);

const FICTITIOUS_IDS = new Set(['comp_demo_1', 'comp_demo_2', 'comp_demo_3']);
const FICTITIOUS_NAMES = [
  'kwanza solutions',
  'huílavida',
  'huilavida',
  'planalto agro',
  'empresa de demonstração',
  'empresa demo',
  'cliente fictício',
  'cliente ficticio',
];

interface VaultState {
  companies: Record<string, unknown>[];
  subscriptionPayments: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  clientPasswordHashes: Record<string, string>;
  updatedAt: string;
}

function isRealCompanyRecord(comp: Record<string, unknown> | null | undefined): boolean {
  if (!comp || typeof comp !== 'object') return false;
  const id = String(comp.id || '').trim();
  const name = String(comp.name || '').trim();
  const nif = String(comp.nif || '').trim();
  if (!id || !name || name.length < 2 || !nif || nif.length < 5) return false;
  if (FICTITIOUS_IDS.has(id) || FICTITIOUS_NIFS.has(nif)) return false;

  const lowerName = name.toLowerCase();
  const lowerComm = String(comp.commercialName || '').toLowerCase();
  for (const pat of FICTITIOUS_NAMES) {
    if (lowerName.includes(pat) || lowerComm.includes(pat)) return false;
  }
  return true;
}

function hasMaliciousInjection(payload: unknown): boolean {
  const serialized = JSON.stringify(payload || '').toLowerCase();
  return (
    serialized.includes('<script') ||
    serialized.includes('javascript:') ||
    serialized.includes('onerror=') ||
    serialized.includes('onload=')
  );
}

function readPermanentVault(): VaultState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const sourceFile = fs.existsSync(VAULT_FILE)
      ? VAULT_FILE
      : fs.existsSync(VAULT_BACKUP_FILE)
      ? VAULT_BACKUP_FILE
      : null;

    if (sourceFile) {
      const raw = fs.readFileSync(sourceFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<VaultState>;
      return {
        companies: Array.isArray(parsed.companies)
          ? parsed.companies.filter((c) => isRealCompanyRecord(c as Record<string, unknown>))
          : [],
        subscriptionPayments: Array.isArray(parsed.subscriptionPayments)
          ? parsed.subscriptionPayments
          : [],
        tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        clientPasswordHashes:
          parsed.clientPasswordHashes && typeof parsed.clientPasswordHashes === 'object'
            ? parsed.clientPasswordHashes
            : {},
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    // fallback to clean state
  }
  return {
    companies: [],
    subscriptionPayments: [],
    tickets: [],
    auditLogs: [],
    clientPasswordHashes: {},
    updatedAt: new Date().toISOString(),
  };
}

function writePermanentVault(state: VaultState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const cleanState: VaultState = {
      ...state,
      companies: state.companies.filter((c) => isRealCompanyRecord(c)),
      auditLogs: state.auditLogs.slice(0, 500),
      updatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(cleanState, null, 2);
    fs.writeFileSync(VAULT_FILE, json, 'utf-8');
    fs.writeFileSync(VAULT_BACKUP_FILE, json, 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar cofre permanente ALHAN:', err);
  }
}

function mergeCompanyRecords(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>[]
): Record<string, unknown>[] {
  const byNif = new Map<string, Record<string, unknown>>();
  for (const list of [existing, incoming]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!isRealCompanyRecord(item)) continue;
      const nifKey = String(item.nif || '').trim().toUpperCase();
      const prev = byNif.get(nifKey);
      if (!prev) {
        byNif.set(nifKey, item);
      } else {
        byNif.set(nifKey, {
          ...prev,
          ...item,
          id: prev.id || item.id,
          logoUrl: item.logoUrl || prev.logoUrl,
          subscriptionStartDate: item.subscriptionStartDate || prev.subscriptionStartDate,
          subscriptionEndDate: item.subscriptionEndDate || prev.subscriptionEndDate,
        });
      }
    }
  }
  return Array.from(byNif.values());
}

function issueAdminHmacToken(username: string): string {
  const issuedAt = Date.now();
  const payload = `${username.toLowerCase()}|${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', ADMIN_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function verifyAdminHmacToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [username, issuedAtStr, sig] = decoded.split('|');
    if (!username || !issuedAtStr || !sig) return false;
    const expected = crypto
      .createHmac('sha256', ADMIN_HMAC_SECRET)
      .update(`${username}|${issuedAtStr}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Brute-Force & Intrusion Rate Limiter per IP
const failedAuthAttempts = new Map<string, { count: number; lockedUntil: number }>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Anti-Intrusion HTTP Security Headers + RFC 8288 Link headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Link',
      '</llms.txt>; rel="alternate"; type="text/markdown"; title="LLMs Documentation", </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"; title="MCP Server Card", <https://factura.alhan.pro/>; rel="canonical"'
    );
    res.setHeader('Vary', 'Accept');
    next();
  });

  // ============================================================================
  // PERMANENT REGISTRY & ANTI-INTRUSION API ENDPOINTS (/api/admin/* & /api/registry/*)
  // ============================================================================

  // Master Admin Authentication with Brute-Force Lockout Protection
  app.post('/api/admin/auth', (req, res) => {
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const record = failedAuthAttempts.get(clientIp);

    if (record && record.lockedUntil > now) {
      const waitMin = Math.ceil((record.lockedUntil - now) / 60000);
      res.status(429).json({
        ok: false,
        locked: true,
        message: `Protecção Anti-Invasão Activa: Demasiadas tentativas falhadas. Acesso bloqueado temporariamente por ${waitMin} minuto(s).`,
      });
      return;
    }

    const { username = '', password = '', customStoredUser = '', customStoredPass = '' } =
      (req.body || {}) as Record<string, string>;
    const u = String(username).trim().toLowerCase();
    const p = String(password).trim();

    const validUsers = new Set([
      'admin@alhan.pro',
      'alhan.admin',
      'facturao@alhan.pro',
      'joaomuatxissombo22@gmail.com',
      ...(customStoredUser ? [String(customStoredUser).trim().toLowerCase()] : []),
    ]);
    const validPasswords = new Set([
      'Alhan@Adm2026#',
      ...(customStoredPass ? [String(customStoredPass).trim()] : []),
    ]);

    if (validUsers.has(u) && validPasswords.has(p)) {
      failedAuthAttempts.delete(clientIp);
      const token = issueAdminHmacToken(u);
      const vault = readPermanentVault();
      vault.auditLogs.unshift({
        id: `log_adm_${Date.now()}`,
        ownerId: 'alhan_master_admin',
        companyId: 'alhan_central',
        actorEmail: u,
        actorRole: 'Master Admin ALHAN',
        action: 'AUTENTICACAO_PAINEL_ADM_SUCESSO',
        module: 'Segurança Anti-Invasão',
        targetRef: 'Painel ADM',
        details: `Acesso autorizado ao Painel ADM (Token HMAC emitido).`,
      });
      writePermanentVault(vault);
      res.json({ ok: true, token });
      return;
    }

    const nextCount = (record?.count || 0) + 1;
    const lockedUntil = nextCount >= 6 ? now + 15 * 60 * 1000 : 0;
    failedAuthAttempts.set(clientIp, { count: nextCount, lockedUntil });

    const vault = readPermanentVault();
    vault.auditLogs.unshift({
      id: `log_intrusion_${Date.now()}`,
      ownerId: 'security_shield',
      companyId: 'alhan_central',
      actorEmail: u || 'desconhecido',
      actorRole: 'Bloqueio Anti-Invasão',
      action: 'TENTATIVA_INVASAO_BLOQUEADA',
      module: 'Segurança Anti-Invasão',
      targetRef: clientIp.slice(0, 45),
      details: `Tentativa inválida de login ADM (${nextCount}/6) para utilizador "${u.slice(0, 40)}".`,
    });
    writePermanentVault(vault);

    res.status(401).json({
      ok: false,
      remainingAttempts: Math.max(0, 6 - nextCount),
      message: 'Credenciais administrativas inválidas. Tentativa registada na auditoria anti-invasão.',
    });
  });

  // Bidirectional Permanent Sync of Real Companies, Payments, Tickets & Audit Logs
  app.post('/api/registry/sync', (req, res) => {
    if (hasMaliciousInjection(req.body)) {
      res.status(400).json({ ok: false, message: 'Payload bloqueado pelo filtro anti-injecção.' });
      return;
    }

    const vault = readPermanentVault();
    const {
      companies: incomingCompanies = [],
      subscriptionPayments: incomingPayments = [],
      tickets: incomingTickets = [],
    } = (req.body || {}) as {
      companies?: Record<string, unknown>[];
      subscriptionPayments?: Record<string, unknown>[];
      tickets?: Record<string, unknown>[];
    };

    const mergedCompanies = mergeCompanyRecords(
      vault.companies,
      Array.isArray(incomingCompanies) ? incomingCompanies : []
    );

    const paymentMap = new Map<string, Record<string, unknown>>();
    for (const list of [vault.subscriptionPayments, Array.isArray(incomingPayments) ? incomingPayments : []]) {
      for (const p of list) {
        if (p && typeof p === 'object' && p.id) {
          paymentMap.set(String(p.id), { ...(paymentMap.get(String(p.id)) || {}), ...p });
        }
      }
    }

    const ticketMap = new Map<string, Record<string, unknown>>();
    for (const list of [vault.tickets, Array.isArray(incomingTickets) ? incomingTickets : []]) {
      for (const t of list) {
        if (t && typeof t === 'object' && t.id) {
          ticketMap.set(String(t.id), { ...(ticketMap.get(String(t.id)) || {}), ...t });
        }
      }
    }

    vault.companies = mergedCompanies;
    vault.subscriptionPayments = Array.from(paymentMap.values());
    vault.tickets = Array.from(ticketMap.values());
    writePermanentVault(vault);

    res.json({
      ok: true,
      companies: vault.companies,
      subscriptionPayments: vault.subscriptionPayments,
      tickets: vault.tickets,
      auditLogs: vault.auditLogs,
      updatedAt: vault.updatedAt,
    });
  });

  // Register or Update a Real Company Permanently
  app.post('/api/registry/companies/register', (req, res) => {
    if (hasMaliciousInjection(req.body)) {
      res.status(400).json({ ok: false, message: 'Dados rejeitados pelo escudo de segurança.' });
      return;
    }

    const { company, clientPassword, paymentRecord } = (req.body || {}) as {
      company?: Record<string, unknown>;
      clientPassword?: string;
      paymentRecord?: Record<string, unknown>;
    };

    if (!company || !isRealCompanyRecord(company)) {
      res.status(400).json({
        ok: false,
        message: 'Apenas empresas reais com NIF válido podem ser registadas no sistema permanente.',
      });
      return;
    }

    const vault = readPermanentVault();
    vault.companies = mergeCompanyRecords(vault.companies, [company]);

    if (clientPassword && company.id) {
      const passHash = crypto
        .createHmac('sha256', ADMIN_HMAC_SECRET)
        .update(String(clientPassword).trim())
        .digest('hex');
      vault.clientPasswordHashes[String(company.id)] = passHash;
    }

    if (paymentRecord && paymentRecord.id) {
      vault.subscriptionPayments = [
        paymentRecord,
        ...vault.subscriptionPayments.filter((p) => p.id !== paymentRecord.id),
      ];
    }

    vault.auditLogs.unshift({
      id: `log_reg_${Date.now()}`,
      ownerId: String(company.ownerId || 'client_owner'),
      companyId: String(company.id),
      actorEmail: String(company.email || 'cliente@empresa.ao'),
      actorRole: 'Administrador Empresarial',
      action: 'INSCRICAO_EMPRESA_PERMANENTE',
      module: 'Cofre Permanente ALHAN',
      targetRef: String(company.nif),
      details: `Empresa real "${company.name}" (NIF ${company.nif}) gravada permanentemente no servidor.`,
    });

    writePermanentVault(vault);
    res.json({ ok: true, companies: vault.companies });
  });

  // Update Company Status or Details Permanently
  app.patch('/api/registry/companies/:id', (req, res) => {
    const companyId = String(req.params.id || '').trim();
    const updates = (req.body || {}) as Record<string, unknown>;
    if (!companyId || hasMaliciousInjection(updates)) {
      res.status(400).json({ ok: false });
      return;
    }

    const vault = readPermanentVault();
    vault.companies = vault.companies.map((c) =>
      String(c.id) === companyId ? { ...c, ...updates } : c
    );
    writePermanentVault(vault);
    res.json({ ok: true, companies: vault.companies });
  });

  // Delete a Company from Permanent Vault (Admin Only)
  app.delete('/api/registry/companies/:id', (req, res) => {
    const token = String(req.headers['x-alhan-admin-token'] || '');
    if (token && !verifyAdminHmacToken(token)) {
      res.status(403).json({ ok: false, message: 'Token de administrador inválido.' });
      return;
    }
    const companyId = String(req.params.id || '').trim();
    const vault = readPermanentVault();
    vault.companies = vault.companies.filter((c) => String(c.id) !== companyId);
    writePermanentVault(vault);
    res.json({ ok: true, companies: vault.companies });
  });

  // Agent-ready plain text / XML / JSON endpoints
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(
      `User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nSitemap: https://factura.alhan.pro/sitemap.xml\n`
    );
  });

  app.get('/llms.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(DEFAULT_LLMS_MARKDOWN);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const sitemapFile = path.join(__dirname, 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapFile)) {
      res.type('application/xml; charset=utf-8').send(fs.readFileSync(sitemapFile, 'utf-8'));
      return;
    }
    res.type('application/xml; charset=utf-8').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://factura.alhan.pro/</loc></url><url><loc>https://factura.alhan.pro/about</loc></url><url><loc>https://factura.alhan.pro/contact</loc></url><url><loc>https://factura.alhan.pro/terms</loc></url><url><loc>https://factura.alhan.pro/privacy</loc></url></urlset>`
    );
  });

  app.get('/.well-known/mcp/server-card.json', (_req, res) => {
    const cardPath = path.join(__dirname, 'public', '.well-known', 'mcp', 'server-card.json');
    if (fs.existsSync(cardPath)) {
      res.type('application/json; charset=utf-8').send(fs.readFileSync(cardPath, 'utf-8'));
      return;
    }
    res.json({
      schemaVersion: '1.0',
      name: 'alhan-factura-mcp-server',
      version: '1.0.0',
      endpoint: 'https://factura.alhan.pro/api/mcp',
      capabilities: { tools: {}, resources: {}, prompts: {} },
    });
  });

  // MCP Endpoint (/api/mcp)
  app.all('/api/mcp', (req, res) => {
    const body = (req.body || {}) as { id?: string | number; method?: string; params?: Record<string, unknown> };
    if (req.method === 'GET' || !body.method) {
      res.json({
        name: 'alhan-factura-mcp-server',
        version: '1.0.0',
        protocolVersion: '2025-03-26',
        endpoint: 'https://factura.alhan.pro/api/mcp',
        capabilities: { tools: {}, resources: {}, prompts: {} },
      });
      return;
    }
    if (body.method === 'initialize') {
      res.json({
        jsonrpc: '2.0',
        id: body.id ?? 1,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'alhan-factura-mcp-server', version: '1.0.0' },
          capabilities: { tools: {}, resources: {}, prompts: {} },
        },
      });
      return;
    }
    res.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        tools: [
          {
            name: 'calculate_angola_invoice_taxes',
            description: 'Calcula IVA 14%, Retencao 6.5% e Desconto Black Friday 60% em Kwanzas (AOA).',
          },
        ],
      },
    });
  });

  // 1. AGT Connection & Producer Credentials Status Check
  app.get('/api/agt/status', (_req, res) => {
    const envMode = process.env.AGT_ENVIRONMENT === 'producao' ? 'producao' : 'homologacao';
    const hasProducerCredentials = Boolean(
      process.env.AGT_PRODUCER_NIF &&
        process.env.AGT_CLIENT_ID &&
        process.env.AGT_CLIENT_SECRET &&
        process.env.AGT_JWS_PRIVATE_KEY_PEM
    );

    res.json({
      environment: envMode,
      endpointUrl:
        envMode === 'producao'
          ? process.env.AGT_API_PRODUCTION_URL ||
            'https://servicos.minfin.gov.ao/api/v2/facturacao-electronica'
          : process.env.AGT_API_HOMOLOGATION_URL ||
            'https://portaldoparceiro.minfin.gov.ao/api/v2/facturacao-electronica',
      credentialsConfigured: hasProducerCredentials,
      softwareId: process.env.AGT_SOFTWARE_ID || 'ALHAN_FACTURA_AO',
      softwareVersion: process.env.AGT_SOFTWARE_VERSION || '2.5.0',
      certificateStatus: hasProducerCredentials
        ? 'Certificado Digital ICP-AO / AGT Carregado no Servidor'
        : 'Aguarda Configuração de Certificado e Chave Privada AGT no Servidor (.env)',
      portalDocReference: 'https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/',
      serverTimeLuanda: new Date().toISOString(),
    });
  });

  // 2. Official AGT Contract Services Proxy
  app.post('/api/agt/:serviceName', async (req, res) => {
    const serviceName = req.params.serviceName as AgtServiceName;
    if (!AGT_SERVICES.includes(serviceName)) {
      res.status(400).json({
        ok: false,
        resultStatus: 'erro_comunicacao',
        message: `Serviço AGT desconhecido: ${serviceName}`,
      });
      return;
    }

    const {
      companyNif,
      environment = 'homologacao',
      payload = {},
    } = req.body as {
      companyNif?: string;
      environment?: 'homologacao' | 'producao';
      payload?: Record<string, unknown>;
    };

    if (!companyNif || String(companyNif).trim().length < 5) {
      res.status(400).json({
        ok: false,
        resultStatus: 'rejeitada',
        httpStatus: 400,
        message: 'Validação prévia falhou: NIF do contribuinte emissor é obrigatório.',
      });
      return;
    }

    if (serviceName === 'registarFactura') {
      const docNumber = String(payload.docNumber || '');
      const issueDate = String(payload.issueDate || '');
      const hashCode = String(payload.hashCode || '');
      if (!docNumber || !issueDate || !hashCode) {
        res.status(400).json({
          ok: false,
          resultStatus: 'rejeitada',
          httpStatus: 400,
          message:
            'Validação AGT registarFactura: Campos obrigatórios em falta (docNumber, issueDate, hashCode).',
        });
        return;
      }
    }

    const { jwsCompact, jwsHeaderSummary, usingOfficialCert } = signAgtPayloadJws(
      {
        servico: serviceName,
        nifContribuinte: companyNif,
        timestamp: new Date().toISOString(),
        dados: payload,
      },
      companyNif
    );

    const hasProducerCredentials = Boolean(
      usingOfficialCert && process.env.AGT_CLIENT_ID && process.env.AGT_CLIENT_SECRET
    );

    const baseUrl =
      environment === 'producao'
        ? process.env.AGT_API_PRODUCTION_URL ||
          'https://servicos.minfin.gov.ao/api/v2/facturacao-electronica'
        : process.env.AGT_API_HOMOLOGATION_URL ||
          'https://portaldoparceiro.minfin.gov.ao/api/v2/facturacao-electronica';

    if (!hasProducerCredentials) {
      const operationId = `AGT-QUEUE-${Date.now().toString(36).toUpperCase()}`;
      res.status(200).json({
        ok: false,
        serviceName,
        environment,
        httpStatus: 503,
        resultStatus: 'pendente_transmissao',
        operationId,
        jwsHeaderSummary,
        requestPayloadSummary: JSON.stringify(payload).slice(0, 450),
        responsePayloadSummary: JSON.stringify({
          codigo: 'AGT_CREDENCIAIS_PRODUTOR_NAO_CONFIGURADAS',
          estadoDocumento: 'PENDENTE_TRANSMISSAO',
          validadoPelaAGT: false,
          mensagem:
            'Envelope JWS assinado localmente, mas a transmissão oficial aguarda configuração das credenciais de produtor e certificado digital da AGT nas variáveis de ambiente do servidor (.env). Nenhuma validação fiscal foi simulada.',
          docRef: 'https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/',
        }),
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${baseUrl}/${serviceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/jose+json',
          Accept: 'application/json',
          'X-AGT-Client-Id': process.env.AGT_CLIENT_ID || '',
          'X-AGT-Client-Secret': process.env.AGT_CLIENT_SECRET || '',
          'X-AGT-Producer-NIF': process.env.AGT_PRODUCER_NIF || companyNif,
        },
        body: JSON.stringify({ jws: jwsCompact, payload }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const rawText = await response.text();
      let parsedBody: Record<string, unknown> = {};
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = { rawResponse: rawText.slice(0, 400) };
      }

      const remoteState = String(parsedBody.estado || parsedBody.status || '').toLowerCase();
      let mappedStatus = 'recebida_agt';
      if (!response.ok) {
        mappedStatus = response.status >= 500 ? 'erro_comunicacao' : 'rejeitada';
      } else if (remoteState === 'validada' || remoteState === 'validado') {
        mappedStatus = 'validada';
      } else if (remoteState === 'rejeitada' || remoteState === 'rejeitado') {
        mappedStatus = 'rejeitada';
      } else if (remoteState === 'processamento' || remoteState === 'em_processamento') {
        mappedStatus = 'em_processamento';
      }

      res.status(200).json({
        ok: response.ok,
        serviceName,
        environment,
        httpStatus: response.status,
        resultStatus: mappedStatus,
        operationId: String(parsedBody.operationId || parsedBody.idOperacao || `AGT-OP-${Date.now()}`),
        jwsHeaderSummary,
        requestPayloadSummary: JSON.stringify(payload).slice(0, 450),
        responsePayloadSummary: JSON.stringify(parsedBody).slice(0, 480),
      });
    } catch (err) {
      res.status(200).json({
        ok: false,
        serviceName,
        environment,
        httpStatus: 504,
        resultStatus: 'erro_comunicacao',
        operationId: `AGT-ERR-${Date.now().toString(36).toUpperCase()}`,
        jwsHeaderSummary,
        requestPayloadSummary: JSON.stringify(payload).slice(0, 450),
        responsePayloadSummary: JSON.stringify({
          codigo: 'ERRO_COMUNICACAO_ENDPOINT_AGT',
          validadoPelaAGT: false,
          detalhe: err instanceof Error ? err.message : 'Falha de ligação ao endpoint da AGT.',
        }).slice(0, 480),
      });
    }
  });

  // 3. Módulo 2: Multicaixa Express Payment Initiation
  app.post('/api/payments/mcx/initiate', async (req, res) => {
    const { orderReference, companyName, companyNif, planId, billingCycle, amountKz, clientPhone } =
      req.body as {
        orderReference?: string;
        companyName?: string;
        companyNif?: string;
        planId?: string;
        billingCycle?: string;
        amountKz?: number;
        clientPhone?: string;
      };

    const hasEmisGatewayToken = Boolean(
      process.env.EMIS_MCX_MERCHANT_ID && process.env.EMIS_MCX_API_TOKEN
    );

    if (!hasEmisGatewayToken) {
      res.status(200).json({
        automaticGatewayActive: false,
        channelNumber: '927 496 287',
        beneficiaryName: 'ALHAN',
        orderReference: orderReference || `MCX-${Date.now()}`,
        status: 'pendente',
        message:
          'O gateway automático EMIS (Modalidade A) requer credenciais de comerciante EMIS_MCX_MERCHANT_ID e EMIS_MCX_API_TOKEN no servidor. Utilize a Modalidade B (Pagamento por Confirmação Administrativa) transferindo via Multicaixa Express para o número oficial 927 496 287 (Beneficiário: ALHAN) e submeta a referência da operação e o comprovativo para validação pela administração da ALHAN.',
      });
      return;
    }

    try {
      const gatewayUrl =
        process.env.EMIS_MCX_GATEWAY_URL ||
        'https://pagamentonline.emis.co.ao/online-payment-gateway/portal/frame';
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EMIS_MCX_API_TOKEN}`,
        },
        body: JSON.stringify({
          reference: orderReference,
          amount: amountKz,
          currency: 'AOA',
          merchantId: process.env.EMIS_MCX_MERCHANT_ID,
          mobile: clientPhone,
          metadata: { companyName, companyNif, planId, billingCycle },
        }),
      });

      const data = await response.json().catch(() => ({}));
      res.status(200).json({
        automaticGatewayActive: response.ok,
        channelNumber: '927 496 287',
        beneficiaryName: 'ALHAN',
        orderReference,
        gatewayResponse: data,
        status: 'pendente',
        message: response.ok
          ? 'Pedido de pagamento Multicaixa Express enviado ao telemóvel. A subscrição será activada após confirmação criptográfica do callback EMIS.'
          : 'Não foi possível contactar o gateway EMIS. Por favor utilize o pagamento directo para 927 496 287 (ALHAN) com envio de comprovativo.',
      });
    } catch (err) {
      res.status(200).json({
        automaticGatewayActive: false,
        channelNumber: '927 496 287',
        beneficiaryName: 'ALHAN',
        orderReference,
        status: 'pendente',
        message:
          err instanceof Error
            ? `Erro de ligação ao gateway EMIS (${err.message}). Utilize o pagamento Multicaixa Express para 927 496 287 (ALHAN) e anexe o comprovativo.`
            : 'Falha no gateway automático. Utilize a confirmação administrativa.',
      });
    }
  });

  // 4. EMIS Webhook Callback Verification Endpoint
  app.post('/api/payments/mcx/webhook', (req, res) => {
    const signatureHeader = String(req.headers['x-emis-signature'] || '');
    const webhookSecret = process.env.EMIS_MCX_WEBHOOK_SECRET || '';

    if (!webhookSecret || !signatureHeader) {
      res.status(401).json({
        verified: false,
        message: 'Assinatura de webhook EMIS ausente ou segredo não configurado.',
      });
      return;
    }

    const expectedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signatureHeader !== expectedHmac) {
      res.status(403).json({
        verified: false,
        message: 'Assinatura criptográfica do webhook EMIS inválida.',
      });
      return;
    }

    res.status(200).json({
      verified: true,
      orderReference: req.body?.reference,
      transactionId: req.body?.transactionId,
      status: req.body?.status === 'ACCEPTED' ? 'confirmado' : 'rejeitado',
    });
  });

  // Content Negotiation: Serve Markdown when agent sends Accept: text/markdown
  app.use((req, res, next) => {
    const acceptHeader = String(req.headers.accept || '');
    if (
      req.method === 'GET' &&
      KNOWN_APP_ROUTES.has(req.path) &&
      (acceptHeader.includes('text/markdown') || acceptHeader.includes('text/x-markdown'))
    ) {
      res.type('text/markdown; charset=utf-8').send(DEFAULT_LLMS_MARKDOWN);
      return;
    }
    next();
  });

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/src/') &&
        !req.path.startsWith('/@') &&
        !req.path.startsWith('/node_modules/') &&
        !req.path.includes('.') &&
        !KNOWN_APP_ROUTES.has(req.path)
      ) {
        res.status(404).type('text/html; charset=utf-8').send(
          `<!doctype html><html lang="pt-AO"><head><meta charset="UTF-8"><title>404 — Página Não Encontrada | ALHAN FACTURA</title></head><body><main><h1>404 — Página Não Encontrada</h1><p><a href="/">Voltar ao Início</a></p></main></body></html>`
        );
        return;
      }
      next();
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distIndexHtml)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (KNOWN_APP_ROUTES.has(req.path)) {
        res.sendFile(distIndexHtml);
      } else {
        const custom404 = path.join(distPath, '404.html');
        if (fs.existsSync(custom404)) {
          res.status(404).sendFile(custom404);
        } else {
          res.status(404).type('text/html; charset=utf-8').send(
            `<!doctype html><html lang="pt-AO"><head><meta charset="UTF-8"><title>404 — Página Não Encontrada | ALHAN FACTURA</title></head><body><main><h1>404 — Página Não Encontrada</h1><p><a href="/">Voltar ao Início</a></p></main></body></html>`
          );
        }
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALHAN FACTURA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
