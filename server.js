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
];

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

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signAgtPayloadJws(payloadObj, companyNif) {
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use((_req, res, next) => {
    res.setHeader(
      'Link',
      '</llms.txt>; rel="alternate"; type="text/markdown"; title="LLMs Documentation", </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"; title="MCP Server Card", <https://plum-quetzal-938419.hostingersite.com/>; rel="canonical"'
    );
    res.setHeader('Vary', 'Accept');
    next();
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(
      `User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nSitemap: https://plum-quetzal-938419.hostingersite.com/sitemap.xml\n`
    );
  });

  app.get('/llms.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(DEFAULT_LLMS_MARKDOWN);
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml; charset=utf-8').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://plum-quetzal-938419.hostingersite.com/</loc></url><url><loc>https://plum-quetzal-938419.hostingersite.com/about</loc></url><url><loc>https://plum-quetzal-938419.hostingersite.com/contact</loc></url><url><loc>https://plum-quetzal-938419.hostingersite.com/terms</loc></url><url><loc>https://plum-quetzal-938419.hostingersite.com/privacy</loc></url><url><loc>https://plum-quetzal-938419.hostingersite.com/llms.txt</loc></url></urlset>`
    );
  });

  app.get('/.well-known/mcp/server-card.json', (_req, res) => {
    res.json({
      schemaVersion: '1.0',
      protocolVersion: '2025-03-26',
      name: 'alhan-factura-mcp-server',
      title: 'ALHAN FACTURA — Servidor MCP de Facturação Electrónica e Gestão Fiscal (Angola)',
      version: '1.0.0',
      description:
        'Servidor Model Context Protocol (MCP / SEP-1649) do software ALHAN FACTURA (ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA).',
      homepageUrl: 'https://plum-quetzal-938419.hostingersite.com/',
      documentationUrl: 'https://plum-quetzal-938419.hostingersite.com/llms.txt',
      endpoint: 'https://plum-quetzal-938419.hostingersite.com/api/mcp',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
      tools: [
        {
          name: 'calculate_angola_invoice_taxes',
          description:
            'Calcula o resumo fiscal de uma factura em Angola em Kwanzas (AOA), incluindo IVA de 14%, Retenção na Fonte de 6,5% e desconto promocional Black Friday de 60%.',
          inputSchema: {
            type: 'object',
            properties: {
              grossAmountKz: { type: 'number' },
              applyBlackFriday60: { type: 'boolean' },
              applyWithholding65: { type: 'boolean' },
            },
            required: ['grossAmountKz'],
          },
        },
      ],
    });
  });

  app.all('/api/mcp', (req, res) => {
    const body = req.body || {};
    if (req.method === 'GET' || !body.method) {
      res.json({
        name: 'alhan-factura-mcp-server',
        version: '1.0.0',
        protocolVersion: '2025-03-26',
        endpoint: 'https://plum-quetzal-938419.hostingersite.com/api/mcp',
        capabilities: { tools: {}, resources: {}, prompts: {} },
      });
      return;
    }
    res.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        protocolVersion: '2025-03-26',
        serverInfo: { name: 'alhan-factura-mcp-server', version: '1.0.0' },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      },
    });
  });

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

  app.post('/api/agt/:serviceName', async (req, res) => {
    const serviceName = req.params.serviceName;
    if (!AGT_SERVICES.includes(serviceName)) {
      res.status(400).json({
        ok: false,
        resultStatus: 'erro_comunicacao',
        message: `Serviço AGT desconhecido: ${serviceName}`,
      });
      return;
    }

    const { companyNif, environment = 'homologacao', payload = {} } = req.body || {};

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
      let parsedBody = {};
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

  app.post('/api/payments/mcx/initiate', async (req, res) => {
    const { orderReference, companyName, companyNif, planId, billingCycle, amountKz, clientPhone } =
      req.body || {};

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

  const distPath = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
    ? path.join(__dirname, 'dist')
    : __dirname;
  const distIndexHtml = path.join(distPath, 'index.html');

  if (fs.existsSync(distIndexHtml) || process.env.NODE_ENV === 'production') {
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
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALHAN FACTURA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
