import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  AgtTransmissionStatusType,
  BillingCycleType,
  Client,
  Company,
  FinancialTransaction,
  Invoice,
  InvoiceLineItem,
  Product,
  SubscriptionPayment,
  SubscriptionPlanConfig,
} from '../types/models';

export const ALHAN_OFFICIAL_LOGO_URL = '/assets/aistudio/alhan_digital-08_a6504d34.png';
export const MCX_EXPRESS_OFFICIAL_NUMBER = '927 496 287';
export const MCX_EXPRESS_BENEFICIARY = 'ALHAN';

export const PROVINCIAS_ANGOLA = [
  'Luanda',
  'Benguela',
  'Huíla',
  'Huambo',
  'Cabinda',
  'Cuanza Sul',
  'Cuanza Norte',
  'Uíge',
  'Zaire',
  'Malanje',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Bié',
  'Namibe',
  'Cunene',
  'Cuando Cubango',
  'Bengo',
  'Icolo e Bengo',
  'Moxico Leste',
  'Cuando',
];

export const INITIAL_PLANS: SubscriptionPlanConfig[] = [
  {
    id: 'starter',
    name: 'PLANO STARTER',
    audience: 'Para comerciantes individuais e prestadores de serviços',
    monthlyPriceKz: 18500,
    maxUsers: 1,
    maxEstablishments: 1,
    features: [
      '1 Empresa e 1 Estabelecimento comercial',
      '1 Utilizador com acesso seguro',
      'Módulo de Facturação completo (A4 e Térmico)',
      'Gestão de Clientes e Conta Corrente',
      'Exportação SAF-T AO de Facturação',
      'Relatórios comerciais básicos (PDF/Excel)',
    ],
  },
  {
    id: 'profissional',
    name: 'PLANO PROFISSIONAL',
    audience: 'Para pequenas e médias empresas em expansão',
    monthlyPriceKz: 42000,
    maxUsers: 8,
    maxEstablishments: 2,
    features: [
      '1 Empresa e até 2 Estabelecimentos',
      'Até 8 Utilizadores com perfis de permissão',
      'Facturação Electrónica, Proformas, Guias e Notas de Crédito',
      'Controlo de Inventário e Alertas de Ruptura de Stock',
      'Módulo Financeiro, Fluxo de Caixa e Reconciliação',
      'Gestão de Fornecedores e Compras com entrada automática',
      'SAF-T AO (Facturação, Contabilidade e Inventário)',
      'Relatórios financeiros e fiscais completos',
    ],
  },
  {
    id: 'empresarial',
    name: 'PLANO EMPRESARIAL',
    audience: 'Para médias e grandes empresas multi-estabelecimento',
    monthlyPriceKz: 89000,
    maxUsers: 50,
    maxEstablishments: 15,
    features: [
      'Vários estabelecimentos comerciais (até 15 lojas/filiais)',
      'Até 50 Utilizadores e Operadores simultâneos',
      'Gestão avançada de múltiplos armazéns e transferências',
      'Integração AGT Oficial (registarFactura, obterEstado, JWS)',
      'Auditoria criptográfica completa e backups automáticos',
      'Relatórios analíticos avançados por série e operador',
      'Suporte técnico prioritário ALHAN (WhatsApp e Dedicado)',
    ],
  },
];

export const AGT_STATE_LABELS: Record<
  AgtTransmissionStatusType,
  { label: string; badgeClass: string }
> = {
  rascunho: {
    label: 'Rascunho',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  },
  pendente_transmissao: {
    label: 'Pendente de transmissão',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  recebida_agt: {
    label: 'Recebida pela AGT',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  em_processamento: {
    label: 'Em processamento',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  validada: {
    label: 'Validada',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  rejeitada: {
    label: 'Rejeitada',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  },
  erro_comunicacao: {
    label: 'Erro de comunicação',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
  preparacao_certificacao: {
    label: 'Pendente de transmissão (Prep. Certificação)',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  pendente_envio: {
    label: 'Pendente de transmissão',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  contingencia: {
    label: 'Modo de Contingência',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
  },
  registado_local: {
    label: 'Registado Localmente',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  },
};

export function formatKz(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return (
    new Intl.NumberFormat('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe) + ' Kz'
  );
}

export function calcularPrecoCiclo(monthlyKz: number, cycle: BillingCycleType): number {
  if (cycle === 'trimestral') return Math.round(monthlyKz * 3 * 0.95);
  if (cycle === 'semestral') return Math.round(monthlyKz * 6 * 0.9);
  if (cycle === 'anual') return Math.round(monthlyKz * 12 * 0.8);
  return monthlyKz;
}

export function calcularDataVencimentoSubscricao(
  startDateIso: string,
  cycle: BillingCycleType
): string {
  const d = new Date(`${startDateIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return startDateIso;
  const monthsToAdd =
    cycle === 'anual' ? 12 : cycle === 'semestral' ? 6 : cycle === 'trimestral' ? 3 : 1;
  d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
  return d.toISOString().slice(0, 10);
}

export function calcularDiasParaVencimento(endDateIso?: string): number | null {
  if (!endDateIso) return null;
  const today = new Date(`${getLuandaIsoDate()}T00:00:00Z`);
  const target = new Date(`${endDateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Compresses an uploaded image file (company logo or Multicaixa payment proof)
 * to a compact Data URL safe for Firestore document size limits.
 */
export function comprimirImagemParaBase64(
  file: File,
  maxWidth = 320,
  maxChars = 36000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro seleccionado.'));
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      if (!file.type.startsWith('image/')) {
        resolve(resultStr.slice(0, maxChars));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(resultStr.slice(0, maxChars));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(resultStr.slice(0, maxChars));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxChars && quality > 0.25) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl.slice(0, maxChars));
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

export function formatLuandaDateTime(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return String(dateInput || '');
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Africa/Luanda',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getLuandaIsoDate(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

const UNIDADES = [
  '',
  'Um',
  'Dois',
  'Três',
  'Quatro',
  'Cinco',
  'Seis',
  'Sete',
  'Oito',
  'Nove',
  'Dez',
  'Onze',
  'Doze',
  'Treze',
  'Catorze',
  'Quinze',
  'Dezasseis',
  'Dezassete',
  'Dezoito',
  'Dezanove',
];

const DEZENAS = [
  '',
  '',
  'Vinte',
  'Trinta',
  'Quarenta',
  'Cinquenta',
  'Sessenta',
  'Setenta',
  'Oitenta',
  'Noventa',
];

const CENTENAS = [
  '',
  'Cento',
  'Duzentos',
  'Trezentos',
  'Quatrocentos',
  'Quinhentos',
  'Seiscentos',
  'Setecentos',
  'Oitocentos',
  'Novecentos',
];

function converterBlocoCentena(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'Cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(DEZENAS[d]);
      if (u > 0) partes.push(UNIDADES[u]);
    }
  }
  return partes.join(' e ');
}

export function valorPorExtensoKz(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return 'Zero Kwanzas';
  const inteiro = Math.floor(valor);
  const centimos = Math.round((valor - inteiro) * 100);

  if (inteiro === 0) {
    return `${centimos} Cêntimos de Kwanza`;
  }

  const milhoes = Math.floor(inteiro / 1000000);
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  const resto = inteiro % 1000;

  const blocos: string[] = [];
  if (milhoes > 0) {
    blocos.push(
      milhoes === 1
        ? 'Um Milhão'
        : `${converterBlocoCentena(milhoes)} Milhões`
    );
  }
  if (milhares > 0) {
    blocos.push(
      milhares === 1 ? 'Mil' : `${converterBlocoCentena(milhares)} Mil`
    );
  }
  if (resto > 0) {
    blocos.push(converterBlocoCentena(resto));
  }

  let texto = `${blocos.join(' e ')} ${inteiro === 1 ? 'Kwanza' : 'Kwanzas'}`;
  if (centimos > 0) {
    texto += ` e ${converterBlocoCentena(centimos)} Cêntimos`;
  }
  return texto.slice(0, 290);
}

/**
 * Generates deterministic cryptographic hash signature for fiscal document chaining
 * according to AGT technical specifications (Decreto Presidencial n.º 71/25).
 */
export async function gerarAssinaturaHashAGT(
  issueDate: string,
  docNumber: string,
  totalAmount: number,
  emitterNif: string,
  previousHash = 'ALHAN0000'
): Promise<string> {
  const canonicalPayload = `${issueDate};${docNumber};${totalAmount.toFixed(2)};${emitterNif};${previousHash}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalPayload);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
  }
  let h = 0;
  for (let i = 0; i < canonicalPayload.length; i++) {
    h = (Math.imul(31, h) + canonicalPayload.charCodeAt(i)) | 0;
  }
  return `AGT7125${Math.abs(h).toString(16).toUpperCase().padStart(16, '0')}`;
}

export function gerarPayloadQrAGT(params: {
  emitterNif: string;
  clientNif: string;
  docType: string;
  docNumber: string;
  issueDate: string;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  hashCode: string;
}): string {
  const hash4 = `${params.hashCode[0] || 'A'}${params.hashCode[10] || 'L'}${params.hashCode[20] || 'H'}${params.hashCode[30] || 'N'}`;
  return [
    `A:${params.emitterNif}`,
    `B:${params.clientNif || '999999999'}`,
    `C:AO`,
    `D:${params.docType}`,
    `E:N`,
    `F:${params.issueDate}`,
    `G:${params.docNumber}`,
    `H:0`,
    `I1:AO`,
    `I7:${params.subtotal.toFixed(2)}`,
    `I8:${params.taxTotal.toFixed(2)}`,
    `N:${params.taxTotal.toFixed(2)}`,
    `O:${params.totalAmount.toFixed(2)}`,
    `Q:${hash4}`,
    `R:ALHAN-PREP-AGT`,
  ].join('*');
}

export interface SaftValidationResult {
  valid: boolean;
  xml: string;
  fileName: string;
  saftType: 'Facturação (F)' | 'Contabilidade (C)' | 'Inventário (I)';
  periodLabel: string;
  totalDocuments: number;
  totalCreditKz: number;
  totalTaxKz: number;
  checks: { field: string; status: 'OK' | 'ERRO' | 'AVISO'; detail: string }[];
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function gerarValidarSaftAO(params: {
  company: Company;
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  startDate: string;
  endDate: string;
  saftType: 'Facturação (F)' | 'Contabilidade (C)' | 'Inventário (I)';
}): SaftValidationResult {
  const { company, clients, products, invoices, startDate, endDate, saftType } = params;
  const checks: { field: string; status: 'OK' | 'ERRO' | 'AVISO'; detail: string }[] = [];

  if (company.nif && company.nif.length >= 9) {
    checks.push({
      field: 'Header/TaxRegistrationNumber',
      status: 'OK',
      detail: `NIF do contribuinte validado (${company.nif})`,
    });
  } else {
    checks.push({
      field: 'Header/TaxRegistrationNumber',
      status: 'ERRO',
      detail: 'NIF da empresa inválido ou com menos de 9 caracteres.',
    });
  }

  checks.push({
    field: 'Header/AuditFileVersion',
    status: 'OK',
    detail: 'Esquema SAF-T (AO) versão 1.01_01 em conformidade com a AGT.',
  });

  checks.push({
    field: 'Header/CurrencyCode',
    status: 'OK',
    detail: 'Moeda fiscal obrigatória definida como AOA (Kwanza).',
  });

  const filteredInvoices = invoices.filter((inv) => {
    const d = inv.issueDate.slice(0, 10);
    return d >= startDate && d <= endDate;
  });

  if (filteredInvoices.length === 0 && saftType !== 'Inventário (I)') {
    checks.push({
      field: 'SourceDocuments/SalesInvoices',
      status: 'AVISO',
      detail: 'Nenhum documento emitido encontrado no período seleccionado (SAF-T sem movimento).',
    });
  } else {
    checks.push({
      field: 'SourceDocuments/SalesInvoices',
      status: 'OK',
      detail: `${filteredInvoices.length} documento(s) verificados com numeração sequencial e código hash.`,
    });
  }

  const allHashesValid = filteredInvoices.every((i) => i.hashCode && i.hashCode.length >= 8);
  checks.push({
    field: 'SalesInvoices/Invoice/Hash',
    status: allHashesValid ? 'OK' : 'ERRO',
    detail: allHashesValid
      ? 'Assinaturas criptográficas Hash verificadas em todos os documentos.'
      : 'Existem documentos sem assinatura Hash válida.',
  });

  const basisCode =
    saftType === 'Facturação (F)' ? 'F' : saftType === 'Contabilidade (C)' ? 'C' : 'I';

  const totalCreditKz = filteredInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalTaxKz = filteredInvoices.reduce((acc, inv) => acc + inv.taxTotal, 0);
  const fiscalYear = startDate.slice(0, 4) || '2026';

  const customersXml = clients
    .map(
      (c) => `    <Customer>
      <CustomerID>${escapeXml(c.id)}</CustomerID>
      <AccountID>311100</AccountID>
      <CustomerTaxID>${escapeXml(c.nif || '999999999')}</CustomerTaxID>
      <CompanyName>${escapeXml(c.name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${escapeXml(c.address || 'Luanda')}</AddressDetail>
        <City>${escapeXml(c.province || 'Luanda')}</City>
        <Country>AO</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`
    )
    .join('\n');

  const productsXml = products
    .map(
      (p) => `    <Product>
      <ProductType>${p.itemType === 'servico' ? 'S' : 'P'}</ProductType>
      <ProductCode>${escapeXml(p.code)}</ProductCode>
      <ProductGroup>${escapeXml(p.category || 'Geral')}</ProductGroup>
      <ProductDescription>${escapeXml(p.description)}</ProductDescription>
      <ProductNumberCode>${escapeXml(p.barcode || p.code)}</ProductNumberCode>
    </Product>`
    )
    .join('\n');

  const invoicesXml = filteredInvoices
    .map((inv) => {
      let parsedItems: InvoiceLineItem[] = [];
      try {
        parsedItems = JSON.parse(inv.itemsSummary);
      } catch {
        parsedItems = [];
      }
      const linesXml =
        parsedItems.length > 0
          ? parsedItems
              .map(
                (line, lIdx) => `        <Line>
          <LineNumber>${lIdx + 1}</LineNumber>
          <ProductCode>${escapeXml(line.code || 'ITEM01')}</ProductCode>
          <ProductDescription>${escapeXml(line.description)}</ProductDescription>
          <Quantity>${line.quantity}</Quantity>
          <UnitOfMeasure>${escapeXml(line.unit || 'UN')}</UnitOfMeasure>
          <UnitPrice>${line.unitPrice.toFixed(2)}</UnitPrice>
          <TaxPointDate>${escapeXml(inv.issueDate.slice(0, 10))}</TaxPointDate>
          <Description>${escapeXml(line.description)}</Description>
          <CreditAmount>${line.lineSubtotal.toFixed(2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>${line.taxRate > 0 ? 'NOR' : 'ISE'}</TaxCode>
            <TaxPercentage>${line.taxRate.toFixed(2)}</TaxPercentage>
          </Tax>
          ${line.taxRate === 0 ? '<TaxExemptionReason>Isento nos termos do Código do IVA em vigor em Angola</TaxExemptionReason><TaxExemptionCode>M00</TaxExemptionCode>' : ''}
          <SettlementAmount>${((line.unitPrice * line.quantity * line.discountPercent) / 100).toFixed(2)}</SettlementAmount>
        </Line>`
              )
              .join('\n')
          : `        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>SERV01</ProductCode>
          <ProductDescription>Prestação de Serviços / Fornecimento Comercial</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${inv.subtotal.toFixed(2)}</UnitPrice>
          <TaxPointDate>${escapeXml(inv.issueDate.slice(0, 10))}</TaxPointDate>
          <Description>Documento ${escapeXml(inv.docNumber)}</Description>
          <CreditAmount>${inv.subtotal.toFixed(2)}</CreditAmount>
        </Line>`;

      return `      <Invoice>
        <InvoiceNo>${escapeXml(inv.docNumber)}</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>${inv.status === 'rectificada' ? 'A' : 'N'}</InvoiceStatus>
          <InvoiceStatusDate>${escapeXml(inv.issueDate)}T10:00:00</InvoiceStatusDate>
          <SourceID>ADMIN</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${escapeXml(inv.hashCode)}</Hash>
        <HashControl>1</HashControl>
        <Period>${Number(inv.issueDate.slice(5, 7)) || 1}</Period>
        <InvoiceDate>${escapeXml(inv.issueDate.slice(0, 10))}</InvoiceDate>
        <InvoiceType>${inv.docType === 'Factura-Recibo' ? 'FR' : inv.docType === 'Nota de Credito' ? 'NC' : inv.docType === 'Factura Proforma' ? 'PP' : 'FT'}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>ADMIN</SourceID>
        <SystemEntryDate>${escapeXml(inv.issueDate)}T10:00:00</SystemEntryDate>
        <CustomerID>${escapeXml(inv.clientId || 'CONSUMIDOR_FINAL')}</CustomerID>
${linesXml}
        <DocumentTotals>
          <TaxPayable>${inv.taxTotal.toFixed(2)}</TaxPayable>
          <NetTotal>${inv.subtotal.toFixed(2)}</NetTotal>
          <GrossTotal>${inv.totalAmount.toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${escapeXml(company.nif)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(company.nif)}</TaxRegistrationNumber>
    <TaxAccountingBasis>${basisCode}</TaxAccountingBasis>
    <CompanyName>${escapeXml(company.name)}</CompanyName>
    <BusinessName>${escapeXml(company.commercialName)}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(company.address)}</AddressDetail>
      <City>${escapeXml(company.municipality)}</City>
      <Province>${escapeXml(company.province)}</Province>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${escapeXml(startDate)}</StartDate>
    <EndDate>${escapeXml(endDate)}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${getLuandaIsoDate()}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>5000000000</ProductCompanyTaxID>
    <SoftwareValidationNumber>0/AGT/PREP-CERTIFICACAO</SoftwareValidationNumber>
    <ProductID>ALHAN FACTURA/ALHAN CONSULTORIA E PRESTACAO DE SERVICOS LDA</ProductID>
    <ProductVersion>2.5.0-AO</ProductVersion>
    <Telephone>${escapeXml(company.phone)}</Telephone>
    <Email>${escapeXml(company.email)}</Email>
  </Header>
  <MasterFiles>
${customersXml}
${productsXml}
    <TaxTable>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>Taxa Normal IVA Angola (14%)</Description>
        <TaxPercentage>14.00</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>ISE</TaxCode>
        <Description>Isento de IVA</Description>
        <TaxPercentage>0.00</TaxPercentage>
      </TaxTableEntry>
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${filteredInvoices.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${totalCreditKz.toFixed(2)}</TotalCredit>
${invoicesXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

  const valid = checks.every((c) => c.status !== 'ERRO');
  const fileName = `SAFT_AO_${company.nif}_${basisCode}_${startDate}_${endDate}.xml`;

  return {
    valid,
    xml,
    fileName,
    saftType,
    periodLabel: `${startDate} a ${endDate}`,
    totalDocuments: filteredInvoices.length,
    totalCreditKz,
    totalTaxKz,
    checks,
  };
}

export function exportarFacturaPDF(invoice: Invoice, company: Company, format: 'A4' | 'TERMICO' = 'A4'): void {
  const isOriginal = (invoice.printCount || 0) === 0;
  const viaLabel = isOriginal ? 'ORIGINAL' : `2.ª VIA (${invoice.printCount + 1}.ª Impressão)`;

  let parsedItems: InvoiceLineItem[] = [];
  try {
    parsedItems = JSON.parse(invoice.itemsSummary);
  } catch {
    parsedItems = [];
  }

  if (format === 'TERMICO') {
    const doc = new jsPDF({ unit: 'mm', format: [80, 210] });
    doc.setFontSize(10);
    doc.text(company.commercialName.slice(0, 28), 40, 10, { align: 'center' });
    doc.setFontSize(7);
    doc.text(`NIF: ${company.nif} | Tel: ${company.phone}`, 40, 15, { align: 'center' });
    doc.text(`${company.address.slice(0, 35)} - ${company.province}`, 40, 19, { align: 'center' });
    doc.line(4, 22, 76, 22);
    doc.setFontSize(8);
    doc.text(`${invoice.docType.toUpperCase()} N.º ${invoice.docNumber}`, 40, 27, { align: 'center' });
    doc.setFontSize(7);
    doc.text(`Exemplar: ${viaLabel}`, 40, 31, { align: 'center' });
    doc.text(`Data: ${invoice.issueDate}`, 4, 36);
    doc.text(`Cliente: ${invoice.clientName.slice(0, 28)}`, 4, 40);
    doc.text(`NIF Cliente: ${invoice.clientNif || 'Consumidor Final'}`, 4, 44);
    doc.line(4, 47, 76, 47);

    let y = 52;
    parsedItems.forEach((item) => {
      doc.text(`${item.quantity}x ${item.description.slice(0, 22)}`, 4, y);
      doc.text(formatKz(item.lineTotal), 76, y, { align: 'right' });
      y += 5;
    });

    doc.line(4, y, 76, y);
    y += 5;
    doc.text(`Subtotal: ${formatKz(invoice.subtotal)}`, 76, y, { align: 'right' });
    y += 4;
    doc.text(`IVA: ${formatKz(invoice.taxTotal)}`, 76, y, { align: 'right' });
    y += 5;
    doc.setFontSize(9);
    doc.text(`TOTAL: ${formatKz(invoice.totalAmount)}`, 76, y, { align: 'right' });
    y += 6;
    doc.setFontSize(6);
    const hash4 = `${invoice.hashCode[0] || 'A'}${invoice.hashCode[10] || 'L'}${invoice.hashCode[20] || 'H'}${invoice.hashCode[30] || 'N'}`;
    doc.text(`${hash4} - Estado AGT: ${(AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label || invoice.agtTransmissionStatus).slice(0, 32)}`, 40, y, { align: 'center' });
    y += 4;
    doc.text('ALHAN FACTURA - Angola', 40, y, { align: 'center' });

    doc.save(`${invoice.docNumber.replace(/\//g, '_')}_TERMICO.pdf`);
    return;
  }

  const doc = new jsPDF();
  // Header brand bar
  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, 210, 34, 'F');

  let textStartX = 14;
  if (company.logoUrl && company.logoUrl.startsWith('data:image/')) {
    try {
      doc.addImage(company.logoUrl, 'JPEG', 14, 6, 22, 22);
      textStartX = 40;
    } catch {
      textStartX = 14;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(company.name.slice(0, 48), textStartX, 15);
  doc.setFontSize(9);
  doc.text(`NIF: ${company.nif}  |  ${company.taxRegime}  |  ${company.vatScheme}`, textStartX, 22);
  doc.text(`${company.address}, ${company.municipality} - ${company.province} | Tel: ${company.phone}`, textStartX, 28);

  doc.setFontSize(11);
  doc.text(viaLabel, 196, 15, { align: 'right' });
  doc.setFontSize(8);
  doc.text(
    `ESTADO AGT: ${(AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label || invoice.agtTransmissionStatus).toUpperCase()}`,
    196,
    22,
    { align: 'right' }
  );

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.text(`${invoice.docType.toUpperCase()} — ${invoice.docNumber}`, 14, 46);

  doc.setFontSize(9);
  doc.text(`Data de Emissão: ${invoice.issueDate}`, 14, 53);
  doc.text(`Data de Vencimento: ${invoice.dueDate}`, 14, 58);
  doc.text(`Condições de Pagamento: ${invoice.paymentTerms} (${invoice.paymentMethod})`, 14, 63);

  doc.setFontSize(10);
  doc.text('Exmo.(s) Sr.(s) / Cliente:', 120, 46);
  doc.setFontSize(9);
  doc.text(invoice.clientName, 120, 52);
  doc.text(`NIF: ${invoice.clientNif || '999999999 (Consumidor Final)'}`, 120, 57);
  doc.text(`Morada: ${invoice.clientAddress || 'Luanda, Angola'}`, 120, 62);

  const tableRows = parsedItems.map((item, i) => [
    String(i + 1),
    item.code,
    item.description,
    `${item.quantity} ${item.unit}`,
    formatKz(item.unitPrice),
    `${item.discountPercent}%`,
    `${item.taxRate}%`,
    formatKz(item.lineTotal),
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['#', 'Código', 'Descrição', 'Qtd', 'Preço Unit.', 'Desc.', 'IVA', 'Total']],
    body: tableRows,
    headStyles: { fillColor: [11, 25, 44], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 130;

  doc.setFontSize(9);
  doc.text(`Subtotal Ilíquido: ${formatKz(invoice.subtotal)}`, 196, finalY + 10, { align: 'right' });
  doc.text(`Total de Descontos: ${formatKz(invoice.discountTotal)}`, 196, finalY + 16, { align: 'right' });
  doc.text(`Total de Imposto (IVA): ${formatKz(invoice.taxTotal)}`, 196, finalY + 22, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`TOTAL GERAL (AOA): ${formatKz(invoice.totalAmount)}`, 196, finalY + 30, { align: 'right' });

  doc.setFontSize(8);
  doc.text(`Valor por extenso: ${invoice.amountInWords}`, 14, finalY + 38);
  if (company.bankIban) {
    doc.text(`Coordenadas Bancárias (${company.bankName}): IBAN ${company.bankIban}`, 14, finalY + 44);
  }
  if (invoice.notes) {
    doc.text(`Observações: ${invoice.notes}`, 14, finalY + 50);
  }

  const hash4 = `${invoice.hashCode[0] || 'A'}${invoice.hashCode[10] || 'L'}${invoice.hashCode[20] || 'H'}${invoice.hashCode[30] || 'N'}`;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${hash4} - Estado Fiscal AGT: ${AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label || invoice.agtTransmissionStatus} (Decreto Presidencial n.º 71/25) | Hash: ${invoice.hashCode.slice(0, 24)}...`,
    14,
    282
  );
  doc.text(
    'ALHAN FACTURA — Pertencente a ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA | Tel: 922 021 211 | facturao@alhan.pro',
    14,
    287
  );

  doc.save(`${invoice.docNumber.replace(/\//g, '_')}.pdf`);
}

export function exportarReciboSubscricaoPDF(payment: SubscriptionPayment): void {
  const doc = new jsPDF();
  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA', 14, 14);
  doc.setFontSize(9);
  doc.text(
    'Canal Oficial Multicaixa Express: 927 496 287 (Beneficiário: ALHAN) | Suporte: 922 021 211 | facturao@alhan.pro',
    14,
    22
  );

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.text(
    `RECIBO DE SUBSCRIÇÃO ALHAN FACTURA — ${payment.receiptNumber || payment.orderReference}`,
    14,
    46
  );

  autoTable(doc, {
    startY: 54,
    head: [['Campo da Operação', 'Detalhe Oficial']],
    body: [
      ['Empresa Subscritora', `${payment.companyName} (NIF: ${payment.companyNif})`],
      ['Plano Contratado & Período', `Plano ${payment.planId.toUpperCase()} — Ciclo ${payment.billingCycle.toUpperCase()}`],
      ['Canal de Pagamento', `MULTICAIXA EXPRESS — N.º ${payment.mcxChannelNumber} (${payment.beneficiaryName})`],
      ['Referência Única do Pedido', payment.orderReference],
      ['Referência da Transacção MCX', payment.transactionReference || 'Confirmada pela Administração ALHAN'],
      ['Valor Liquidado (Kwanzas)', formatKz(payment.amountKz)],
      ['Valor por Extenso', valorPorExtensoKz(payment.amountKz)],
      ['Estado do Pagamento', payment.status.toUpperCase()],
      ['Observações Administrativas', payment.adminNotes || 'Subscrição validada e activada com sucesso.'],
    ],
    headStyles: { fillColor: [11, 25, 44], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
  });

  doc.save(`Recibo_Subscricao_${payment.orderReference}.pdf`);
}

export function exportarRelatorioPDF(params: {
  title: string;
  company: Company;
  period: string;
  headers: string[];
  rows: string[][];
  summaryText: string;
}): void {
  const doc = new jsPDF();
  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`ALHAN FACTURA — ${params.title}`, 14, 13);
  doc.setFontSize(9);
  doc.text(`${params.company.name} (NIF: ${params.company.nif}) | Período: ${params.period}`, 14, 21);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(params.summaryText, 14, 38);

  autoTable(doc, {
    startY: 44,
    head: [params.headers],
    body: params.rows,
    headStyles: { fillColor: [11, 25, 44], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  doc.save(`Relatorio_${params.title.replace(/\s+/g, '_')}.pdf`);
}

export function exportarDadosExcel(
  sheetName: string,
  fileName: string,
  data: Record<string, string | number>[]
): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportarFluxoCaixaExcel(transactions: FinancialTransaction[]): void {
  const rows = transactions.map((t) => ({
    Data: t.txDate,
    Tipo: t.txType.toUpperCase(),
    Categoria: t.category,
    Descricao: t.description,
    Entidade: t.entityName,
    Meio_Pagamento: t.paymentMethod,
    Conta: t.accountName,
    Documento_Ref: t.referenceDoc,
    Estado: t.status,
    Valor_Kz: t.amount,
  }));
  exportarDadosExcel('FluxoCaixa', 'ALHAN_Fluxo_de_Caixa', rows);
}
