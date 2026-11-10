export type TaxRegimeType = 'Regime Geral' | 'Regime Simplificado' | 'Regime de Exclusão';
export type VatSchemeType = 'IVA 14% (Geral)' | 'IVA 7% (Simplificado)' | 'IVA 5% (Cesta Básica)' | 'Isento de IVA';
export type PlanIdType = 'starter' | 'profissional' | 'empresarial';
export type BillingCycleType = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type SubscriptionStatusType = 'activa' | 'pendente' | 'vencida' | 'suspensa';
export type AgtStatusType = 'preparacao_certificacao' | 'ambiente_testes' | 'homologacao_pendente';
export type AgtEnvironmentType = 'sandbox_teste' | 'producao_bloqueada';
export type AgtAdhesionStatusType = 'nao_aderente' | 'em_homologacao' | 'aderente_activo';

export type AgtTransmissionStatusType =
  | 'rascunho'
  | 'pendente_transmissao'
  | 'recebida_agt'
  | 'em_processamento'
  | 'validada'
  | 'rejeitada'
  | 'erro_comunicacao'
  | 'preparacao_certificacao'
  | 'pendente_envio'
  | 'contingencia'
  | 'registado_local';

export type AgtOfficialServiceName =
  | 'registarFactura'
  | 'obterEstado'
  | 'listarFacturas'
  | 'consultarFactura'
  | 'solicitarSerie'
  | 'listarSeries'
  | 'validarDocumento';

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  commercialName: string;
  nif: string;
  address: string;
  province: string;
  municipality: string;
  phone: string;
  email: string;
  economicActivity: string;
  taxRegime: TaxRegimeType;
  vatScheme: VatSchemeType;
  responsibleName: string;
  bankName: string;
  bankIban: string;
  establishmentsCount: number;
  planId: PlanIdType;
  billingCycle: BillingCycleType;
  subscriptionStatus: SubscriptionStatusType;
  agtStatus: AgtStatusType;
  agtCertificateRef: string;
  agtEnvironment: AgtEnvironmentType;
  logoUrl?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  agtAdhesionStatus?: AgtAdhesionStatusType;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Client {
  id: string;
  ownerId: string;
  companyId: string;
  clientType: 'empresarial' | 'particular';
  name: string;
  nif: string;
  address: string;
  province: string;
  phone: string;
  email: string;
  contactPerson: string;
  creditLimit: number;
  currentBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  ownerId: string;
  companyId: string;
  itemType: 'produto' | 'servico';
  code: string;
  barcode: string;
  description: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  unit: string;
  taxRate: number;
  taxExemptionReason: string;
  stock: number;
  minStock: number;
  warehouse: string;
  profitMargin: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type FiscalDocumentType =
  | 'Factura'
  | 'Factura-Recibo'
  | 'Factura Proforma'
  | 'Recibo'
  | 'Nota de Credito'
  | 'Nota de Debito'
  | 'Orcamento'
  | 'Guia de Remessa'
  | 'Guia de Transporte'
  | 'Aviso de Cobranca'
  | 'Factura Global';

export interface InvoiceLineItem {
  productId: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  ownerId: string;
  companyId: string;
  docType: FiscalDocumentType;
  series: string;
  sequentialNumber: number;
  docNumber: string;
  issueDate: string;
  dueDate: string;
  emitterName: string;
  emitterNif: string;
  clientId: string;
  clientName: string;
  clientNif: string;
  clientAddress: string;
  itemsSummary: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  withholdingTaxRate?: number;
  withholdingTaxTotal?: number;
  netPayableAmount?: number;
  blackFridayApplied?: boolean;
  totalAmount: number;
  amountInWords: string;
  paymentTerms: string;
  paymentMethod: string;
  notes: string;
  qrCodePayload: string;
  hashCode: string;
  softwareCertText: string;
  status: 'emitida' | 'paga' | 'pendente' | 'vencida' | 'rectificada';
  paidAmount: number;
  printCount: number;
  agtTransmissionStatus: AgtTransmissionStatusType;
  agtOperationId?: string;
  agtResponseJson?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryMovement {
  id: string;
  ownerId: string;
  companyId: string;
  productId: string;
  productName: string;
  movementType: 'entrada' | 'saida' | 'transferencia' | 'devolucao' | 'ajuste';
  quantity: number;
  warehouseOrigin: string;
  warehouseDest: string;
  unitCost: number;
  referenceDoc: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialTransaction {
  id: string;
  ownerId: string;
  companyId: string;
  txType: 'recebimento' | 'despesa' | 'pagamento_fornecedor' | 'transferencia_caixa';
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'transferencia' | 'numerario' | 'pos' | 'multicaixa_express' | 'referencia';
  accountName: string;
  referenceDoc: string;
  entityName: string;
  status: 'liquidado' | 'pendente' | 'reconciliado';
  txDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Supplier {
  id: string;
  ownerId: string;
  companyId: string;
  name: string;
  nif: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  totalPurchased: number;
  balanceDue: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type UserRoleType =
  | 'Administrador'
  | 'Gerente'
  | 'Contabilista'
  | 'Operador de facturacao'
  | 'Vendedor'
  | 'Responsavel de armazem'
  | 'Consulta';

export interface TeamMember {
  id: string;
  ownerId: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRoleType;
  establishment: string;
  permissionsSummary: string;
  status: 'activo' | 'suspenso';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportTicket {
  id: string;
  ownerId: string;
  companyId: string;
  companyName: string;
  subject: string;
  description: string;
  category: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  attachmentRef: string;
  status: 'aberto' | 'em_analise' | 'respondido' | 'fechado';
  adminResponse: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  ownerId: string;
  companyId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  module: string;
  targetRef: string;
  details: string;
  createdAt?: unknown;
}

export interface SubscriptionPayment {
  id: string;
  ownerId: string;
  companyId: string;
  companyName: string;
  companyNif: string;
  planId: PlanIdType;
  billingCycle: BillingCycleType;
  amountKz: number;
  mcxChannelNumber: string;
  beneficiaryName: string;
  orderReference: string;
  transactionReference: string;
  paymentModality: 'automatico_emis' | 'confirmacao_administrativa';
  proofFileName: string;
  proofDataUrl: string;
  paymentDeadline: string;
  status: 'pendente' | 'confirmado' | 'rejeitado' | 'novo_comprovativo';
  adminNotes: string;
  receiptNumber: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AgtCommunicationLog {
  id: string;
  ownerId: string;
  companyId: string;
  serviceName: AgtOfficialServiceName;
  environment: 'homologacao' | 'producao';
  targetRef: string;
  jwsHeaderSummary: string;
  requestPayloadSummary: string;
  responsePayloadSummary: string;
  httpStatus: number;
  resultStatus: AgtTransmissionStatusType;
  operationId: string;
  createdAt?: unknown;
}

export interface SubscriptionPlanConfig {
  id: PlanIdType;
  name: string;
  audience: string;
  monthlyPriceKz: number;
  maxUsers: number;
  maxEstablishments: number;
  features: string[];
}
