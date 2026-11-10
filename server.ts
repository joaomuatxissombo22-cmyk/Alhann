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

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Generates an RFC 7515 JWS (JSON Web Signature) compact token on the server.
 * Uses RSA-SHA256 if AGT_JWS_PRIVATE_KEY_PEM is configured, or HMAC-SHA256 integrity envelope
 * for local cryptographic audit logging without exposing any secret to the frontend.
 */
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

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

  // 2. Official AGT Contract Services Proxy (Never simulates positive validation without real AGT response)
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

  const distPath = path.join(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distIndexHtml)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALHAN FACTURA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
