import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageSquare,
  Package,
  Plus,
  Search,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AuditLog,
  BillingCycleType,
  Client,
  Company,
  FinancialTransaction,
  InventoryMovement,
  Invoice,
  PlanIdType,
  Product,
  SubscriptionPayment,
  SubscriptionPlanConfig,
  Supplier,
  SupportTicket,
  TeamMember,
  UserRoleType,
} from '../types/models';
import {
  calcularDiasParaVencimento,
  comprimirImagemParaBase64,
  exportarDadosExcel,
  exportarFluxoCaixaExcel,
  exportarReciboSubscricaoPDF,
  exportarRelatorioPDF,
  formatKz,
  getLuandaIsoDate,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
  PROVINCIAS_ANGOLA,
} from '../lib/angolaUtils';

interface OperationsModulesProps {
  activeModule:
    | 'clients'
    | 'products'
    | 'inventory'
    | 'finance'
    | 'suppliers'
    | 'reports'
    | 'users'
    | 'support';
  company: Company;
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  movements: InventoryMovement[];
  transactions: FinancialTransaction[];
  suppliers: Supplier[];
  teamMembers: TeamMember[];
  tickets: SupportTicket[];
  auditLogs: AuditLog[];
  plans: SubscriptionPlanConfig[];
  onCreateClient: (data: Omit<Client, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCreateProduct: (data: Omit<Product, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onRecordInventoryMovement: (
    data: Omit<InventoryMovement, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onRecordFinancialTx: (
    data: Omit<FinancialTransaction, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReconcileTx: (tx: FinancialTransaction) => Promise<void>;
  onCreateSupplier: (
    data: Omit<Supplier, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onRecordSupplierPurchase: (params: {
    supplier: Supplier;
    product: Product;
    quantity: number;
    unitCost: number;
    invoiceRef: string;
    isCreditNote: boolean;
  }) => Promise<void>;
  onCreateTeamMember: (
    data: Omit<TeamMember, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateSupportTicket: (
    data: Omit<SupportTicket, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onChangeCompanyPlan: (planId: PlanIdType, billingCycle: BillingCycleType) => Promise<void>;
  subscriptionPayments?: SubscriptionPayment[];
  onOpenMcxCheckout?: (planId?: PlanIdType, cycle?: BillingCycleType) => void;
  onUpdateCompanyLogo?: (logoUrl: string) => Promise<void>;
}

export const OperationsModules: React.FC<OperationsModulesProps> = ({
  activeModule,
  company,
  clients,
  products,
  invoices,
  movements,
  transactions,
  suppliers,
  teamMembers,
  tickets,
  auditLogs,
  plans,
  onCreateClient,
  onCreateProduct,
  onRecordInventoryMovement,
  onRecordFinancialTx,
  onReconcileTx,
  onCreateSupplier,
  onRecordSupplierPurchase,
  onCreateTeamMember,
  onCreateSupportTicket,
  onChangeCompanyPlan,
  subscriptionPayments = [],
  onOpenMcxCheckout,
  onUpdateCompanyLogo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientExtract, setSelectedClientExtract] = useState<Client | null>(null);

  // Client Form State
  const [clientForm, setClientForm] = useState({
    clientType: 'empresarial' as 'empresarial' | 'particular',
    name: '',
    nif: '',
    address: '',
    province: 'Luanda',
    phone: '',
    email: '',
    contactPerson: '',
    creditLimit: 1500000,
  });

  // Product Form State
  const [productForm, setProductForm] = useState({
    itemType: 'produto' as 'produto' | 'servico',
    code: '',
    barcode: '',
    description: '',
    category: 'Informática & Equipamentos',
    purchasePrice: 45000,
    salePrice: 68000,
    unit: 'UN',
    taxRate: 14,
    taxExemptionReason: 'Aplicação Taxa Geral IVA Angola',
    stock: 25,
    minStock: 5,
    warehouse: 'Armazém Central Luanda',
  });

  // Inventory Movement State
  const [movForm, setMovForm] = useState({
    productId: products[0]?.id || '',
    movementType: 'entrada' as InventoryMovement['movementType'],
    quantity: 10,
    warehouseOrigin: 'Armazém Central Luanda',
    warehouseDest: 'Loja Talatona',
    unitCost: 45000,
    referenceDoc: 'GR 2026/001',
    notes: 'Reposição regular de stock',
  });

  // Financial Transaction State
  const [txForm, setTxForm] = useState({
    txType: 'despesa' as FinancialTransaction['txType'],
    category: 'Operações & Logística',
    description: '',
    amount: 85000,
    paymentMethod: 'transferencia' as FinancialTransaction['paymentMethod'],
    accountName: `${company.bankName} (AOA)`,
    referenceDoc: 'DOC-FIN-01',
    entityName: '',
    txDate: getLuandaIsoDate(),
  });

  // Supplier & Purchase State
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    nif: '',
    phone: '',
    email: '',
    address: 'Zona Económica Especial (ZEE), Viana - Luanda',
    category: 'Distribuidor Oficial',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    productId: '',
    quantity: 15,
    unitCost: 40000,
    invoiceRef: 'FT-FORN-2026/104',
    isCreditNote: false,
  });

  // Team Member State
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    role: 'Operador de facturacao' as UserRoleType,
    establishment: 'Sede Principal - Luanda',
  });

  // Support Ticket State
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'Facturação & SAF-T AO',
    priority: 'media' as SupportTicket['priority'],
    description: '',
    attachmentRef: 'SAF-T_Log_Verificacao.xml',
  });
  const [multicaixaNotice, setMulticaixaNotice] = useState<string | null>(null);

  // Reports Filter State
  const [reportType, setReportType] = useState<
    | 'vendas_mensais'
    | 'iva_liquidado'
    | 'dividas_clientes'
    | 'existencias_stock'
    | 'fluxo_caixa'
  >('vendas_mensais');
  const [reportStartDate, setReportStartDate] = useState(`${getLuandaIsoDate().slice(0, 8)}01`);
  const [reportEndDate, setReportEndDate] = useState(getLuandaIsoDate());

  const rolePermissionsMap: Record<UserRoleType, string> = {
    Administrador: 'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
    Gerente: 'Acesso Gerencial: Facturação, Relatórios, Financeiro, Inventário, Compras e Clientes',
    Contabilista: 'Acesso Fiscal e Contabilístico: SAF-T AO, Relatórios de IVA, Fluxo de Caixa e Facturas',
    'Operador de facturacao': 'Emissão de Facturas, Facturas-Recibo, Proformas, Recibos e Gestão de Clientes',
    Vendedor: 'Emissão de Orçamentos, Facturas Proforma, Consulta de Preços e Registo de Clientes',
    'Responsavel de armazem': 'Gestão de Produtos, Entradas/Saídas de Stock, Transferências e Guias de Remessa',
    Consulta: 'Acesso exclusivo de leitura a relatórios e documentos sem permissão de escrita',
  };

  // 1. CLIENTS MODULE
  if (activeModule === 'clients') {
    const filteredClients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nif.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
              Módulo de Clientes, Limites de Crédito e Conta Corrente
            </h2>
            <p className="text-xs text-slate-500">
              Registo de clientes particulares e empresariais, controlo de dívidas e exportação de extractos.
            </p>
          </div>
          <button
            onClick={() =>
              exportarDadosExcel(
                'Clientes',
                `Clientes_${company.nif}`,
                clients.map((c) => ({
                  Tipo: c.clientType,
                  Nome: c.name,
                  NIF: c.nif,
                  Provincia: c.province,
                  Telefone: c.phone,
                  Email: c.email,
                  Limite_Credito_Kz: c.creditLimit,
                  Total_Facturado_Kz: c.totalInvoiced,
                  Total_Pago_Kz: c.totalPaid,
                  Saldo_Divida_Kz: c.currentBalance,
                }))
              )
            }
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold hover:bg-slate-800 transition-colors self-start"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Lista de Clientes (Excel)
          </button>
        </div>

        {/* Create Client Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!clientForm.name || !clientForm.nif) return;
            await onCreateClient({
              ...clientForm,
              currentBalance: 0,
              totalInvoiced: 0,
              totalPaid: 0,
            });
            setClientForm({
              ...clientForm,
              name: '',
              nif: '',
              phone: '',
              email: '',
              address: '',
              contactPerson: '',
            });
          }}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600" />
            <span>Registar Novo Cliente (Empresarial ou Particular)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Cliente
              </label>
              <select
                value={clientForm.clientType}
                onChange={(e) =>
                  setClientForm({
                    ...clientForm,
                    clientType: e.target.value as 'empresarial' | 'particular',
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="empresarial">Empresarial (Pessoa Colectiva)</option>
                <option value="particular">Particular (Consumidor Singular)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo / Denominação Social *
              </label>
              <input
                type="text"
                required
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                placeholder="Ex.: Sonangol Distribuidora, S.A. ou João Baptista"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIF do Cliente *
              </label>
              <input
                type="text"
                required
                value={clientForm.nif}
                onChange={(e) => setClientForm({ ...clientForm, nif: e.target.value })}
                placeholder="Ex.: 5401092831"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Província
              </label>
              <select
                value={clientForm.province}
                onChange={(e) => setClientForm({ ...clientForm, province: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                {PROVINCIAS_ANGOLA.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Morada / Endereço
              </label>
              <input
                type="text"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                placeholder="Rua, Município, Edifício..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                placeholder="+244 923..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="financeiro@cliente.ao"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pessoa de Contacto
              </label>
              <input
                type="text"
                value={clientForm.contactPerson}
                onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
                placeholder="Nome do Gestor"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Limite de Crédito (AOA)
              </label>
              <input
                type="number"
                min={0}
                value={clientForm.creditLimit}
                onChange={(e) =>
                  setClientForm({ ...clientForm, creditLimit: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                <Plus className="w-4 h-4" />
                Guardar Cliente
              </button>
            </div>
          </div>
        </form>

        {/* Search & Clients Table */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Carteira de Clientes & Saldos de Conta Corrente ({filteredClients.length})
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar cliente por nome ou NIF..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-transparent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">Província / Contacto</th>
                  <th className="py-3 px-4 text-right">Limite Crédito</th>
                  <th className="py-3 px-4 text-right">Total Facturado</th>
                  <th className="py-3 px-4 text-right">Dívida Actual</th>
                  <th className="py-3 px-4 text-right">Conta Corrente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-slate-500 capitalize">{c.clientType}</p>
                    </td>
                    <td className="py-3 px-4 font-mono">{c.nif}</td>
                    <td className="py-3 px-4">
                      {c.province} · {c.phone}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatKz(c.creditLimit)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatKz(c.totalInvoiced)}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        c.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatKz(c.currentBalance)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedClientExtract(c)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-700 dark:text-slate-200 font-semibold transition-colors"
                      >
                        Ver Extracto
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Client Account Statement Modal */}
        {selectedClientExtract && (
          <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">
                  Extracto de Conta Corrente — {selectedClientExtract.name} (NIF:{' '}
                  {selectedClientExtract.nif})
                </h4>
                <p className="text-slate-400">
                  Total Facturado: {formatKz(selectedClientExtract.totalInvoiced)} · Total Pago:{' '}
                  {formatKz(selectedClientExtract.totalPaid)} · Saldo Pendente:{' '}
                  {formatKz(selectedClientExtract.currentBalance)}
                </p>
              </div>
              <button
                onClick={() => setSelectedClientExtract(null)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Fechar Extracto
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="py-2 px-3">Documento</th>
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3 text-right">Valor Total</th>
                    <th className="py-2 px-3 text-right">Valor Liquidado</th>
                    <th className="py-2 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoices
                    .filter(
                      (i) =>
                        i.clientId === selectedClientExtract.id ||
                        i.clientNif === selectedClientExtract.nif
                    )
                    .map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-mono">{inv.docNumber}</td>
                        <td className="py-2 px-3 font-mono">{inv.issueDate}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatKz(inv.totalAmount)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatKz(inv.paidAmount)}
                        </td>
                        <td className="py-2 px-3 uppercase font-mono">{inv.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. PRODUCTS & SERVICES MODULE
  if (activeModule === 'products') {
    const calculatedMargin =
      productForm.purchasePrice > 0
        ? Math.round(
            ((productForm.salePrice - productForm.purchasePrice) / productForm.purchasePrice) * 100
          )
        : 100;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Catálogo de Produtos e Serviços
          </h2>
          <p className="text-xs text-slate-500">
            Gestão de códigos internos, códigos de barras, taxas de IVA, margens de lucro e armazéns.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!productForm.code || !productForm.description) return;
            await onCreateProduct({
              ...productForm,
              profitMargin: calculatedMargin,
            });
            setProductForm({
              ...productForm,
              code: '',
              barcode: '',
              description: '',
            });
          }}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-600" />
            <span>Registar Produto ou Serviço</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Natureza do Item
              </label>
              <select
                value={productForm.itemType}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    itemType: e.target.value as 'produto' | 'servico',
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="produto">Produto (Com Controlo de Stock)</option>
                <option value="servico">Prestação de Serviço</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Código Interno *
              </label>
              <input
                type="text"
                required
                value={productForm.code}
                onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                placeholder="Ex.: PRD-004"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Código de Barras (EAN)
              </label>
              <input
                type="text"
                value={productForm.barcode}
                onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                placeholder="Ex.: 5601234567890"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <input
                type="text"
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descrição Comercial *
              </label>
              <input
                type="text"
                required
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Descrição detalhada do artigo ou serviço..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preço de Compra (AOA)
              </label>
              <input
                type="number"
                min={0}
                value={productForm.purchasePrice}
                onChange={(e) =>
                  setProductForm({ ...productForm, purchasePrice: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preço de Venda s/ IVA (AOA)
              </label>
              <input
                type="number"
                min={0}
                value={productForm.salePrice}
                onChange={(e) =>
                  setProductForm({ ...productForm, salePrice: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unidade de Medida
              </label>
              <select
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="UN">UN (Unidade)</option>
                <option value="CX">CX (Caixa)</option>
                <option value="KG">KG (Quilograma)</option>
                <option value="LT">LT (Litro)</option>
                <option value="HR">HR (Hora Técnica)</option>
                <option value="MES">MÊS (Avença Mensal)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Taxa Fiscal IVA (%)
              </label>
              <select
                value={productForm.taxRate}
                onChange={(e) =>
                  setProductForm({ ...productForm, taxRate: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value={14}>14% — Taxa Normal Angola</option>
                <option value={7}>7% — Regime Simplificado / Hotelaria</option>
                <option value={5}>5% — Cesta Básica / Insumos Agrícolas</option>
                <option value={0}>0% — Isento de IVA</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Stock Inicial / Mínimo
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) =>
                    setProductForm({ ...productForm, stock: Number(e.target.value) || 0 })
                  }
                  placeholder="Stock"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
                />
                <input
                  type="number"
                  value={productForm.minStock}
                  onChange={(e) =>
                    setProductForm({ ...productForm, minStock: Number(e.target.value) || 0 })
                  }
                  placeholder="Mín."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                <Plus className="w-4 h-4" />
                Guardar ({calculatedMargin}% Margem)
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código / EAN</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Tipo / Armazém</th>
                  <th className="py-3 px-4 text-right">Preço Compra</th>
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  <th className="py-3 px-4 text-right">IVA</th>
                  <th className="py-3 px-4 text-right">Margem</th>
                  <th className="py-3 px-4 text-right">Stock Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono">
                      <p className="font-bold text-slate-900 dark:text-white">{p.code}</p>
                      <p className="text-slate-400">{p.barcode}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{p.description}</p>
                      <p className="text-slate-500">{p.category}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="capitalize">{p.itemType}</p>
                      <p className="text-slate-500">{p.warehouse}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatKz(p.purchasePrice)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {formatKz(p.salePrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{p.taxRate}%</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">
                      +{p.profitMargin}%
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        p.itemType === 'produto' && p.stock <= p.minStock
                          ? 'text-red-600'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {p.itemType === 'servico' ? 'Serviço' : `${p.stock} ${p.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. INVENTORY MODULE
  if (activeModule === 'inventory') {
    const lowStockItems = products.filter((p) => p.itemType === 'produto' && p.stock <= p.minStock);
    const totalInventoryValuationKz = products
      .filter((p) => p.itemType === 'produto')
      .reduce((acc, p) => acc + p.stock * p.purchasePrice, 0);
    const totalRetailValuationKz = products
      .filter((p) => p.itemType === 'produto')
      .reduce((acc, p) => acc + p.stock * p.salePrice, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Valorização de Stock (Preço de Custo)</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {formatKz(totalInventoryValuationKz)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Valor Comercial de Venda: {formatKz(totalRetailValuationKz)}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Alertas de Ruptura de Stock</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
              {lowStockItems.length} Produto(s)
            </p>
            <p className="text-xs text-slate-500 mt-1">Abaixo ou igual ao stock mínimo configurado</p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Movimentos de Armazém Registados</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-sky-600 mt-1">
              {movements.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Entradas, Saídas, Transferências e Ajustes</p>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between text-xs text-red-900 dark:text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>
                <strong>Alerta de Ruptura de Stock:</strong>{' '}
                {lowStockItems.map((i) => `${i.description} (${i.stock}/${i.minStock} ${i.unit})`).join(' · ')}
              </span>
            </div>
          </div>
        )}

        {/* Record Movement Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const prod = products.find((p) => p.id === movForm.productId) || products[0];
            if (!prod) return;
            await onRecordInventoryMovement({
              productId: prod.id,
              productName: prod.description,
              movementType: movForm.movementType,
              quantity: Math.max(1, Number(movForm.quantity)),
              warehouseOrigin: movForm.warehouseOrigin,
              warehouseDest: movForm.warehouseDest,
              unitCost: Number(movForm.unitCost) || prod.purchasePrice,
              referenceDoc: movForm.referenceDoc,
              notes: movForm.notes,
            });
          }}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-sky-600" />
            <span>Registar Movimento de Inventário (Entrada, Saída, Transferência, Devolução ou Ajuste)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Artigo / Produto
              </label>
              <select
                value={movForm.productId}
                onChange={(e) => setMovForm({ ...movForm, productId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.description} (Stock actual: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Movimento
              </label>
              <select
                value={movForm.movementType}
                onChange={(e) =>
                  setMovForm({
                    ...movForm,
                    movementType: e.target.value as InventoryMovement['movementType'],
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="entrada">Entrada de Stock (+)</option>
                <option value="saida">Saída de Stock (-)</option>
                <option value="transferencia">Transferência entre Armazéns</option>
                <option value="devolucao">Devolução (+)</option>
                <option value="ajuste">Ajuste de Inventário (+)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min={1}
                value={movForm.quantity}
                onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) || 1 })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Armazém Origem
              </label>
              <input
                type="text"
                value={movForm.warehouseOrigin}
                onChange={(e) => setMovForm({ ...movForm, warehouseOrigin: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Armazém Destino
              </label>
              <input
                type="text"
                value={movForm.warehouseDest}
                onChange={(e) => setMovForm({ ...movForm, warehouseDest: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Documento de Referência
              </label>
              <input
                type="text"
                value={movForm.referenceDoc}
                onChange={(e) => setMovForm({ ...movForm, referenceDoc: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                Confirmar Movimento
              </button>
            </div>
          </div>
        </form>

        {/* Movements History */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Histórico Auditado de Movimentos de Stock
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Produto</th>
                  <th className="py-2.5 px-4">Operação</th>
                  <th className="py-2.5 px-4 text-right">Qtd</th>
                  <th className="py-2.5 px-4">Origem → Destino</th>
                  <th className="py-2.5 px-4">Ref. Documento</th>
                  <th className="py-2.5 px-4">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {m.productName}
                    </td>
                    <td className="py-2.5 px-4 uppercase font-mono font-bold text-sky-700 dark:text-sky-400">
                      {m.movementType}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">{m.quantity}</td>
                    <td className="py-2.5 px-4">
                      {m.warehouseOrigin} → {m.warehouseDest}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{m.referenceDoc}</td>
                    <td className="py-2.5 px-4 text-slate-500">{m.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. FINANCIAL MODULE
  if (activeModule === 'finance') {
    const totalReceipts = transactions
      .filter((t) => t.txType === 'recebimento')
      .reduce((a, b) => a + b.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.txType !== 'recebimento')
      .reduce((a, b) => a + b.amount, 0);
    const netBalance = totalReceipts - totalExpenses;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
              Módulo Financeiro, Tesouraria, Bancos e Fluxo de Caixa
            </h2>
            <p className="text-xs text-slate-500">
              Controlo de recebimentos, despesas, contas bancárias, caixa e reconciliação de movimentos em Kwanzas.
            </p>
          </div>
          <button
            onClick={() => exportarFluxoCaixaExcel(transactions)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            Exportar Fluxo de Caixa (Excel)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Total de Recebimentos (Entradas)</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
              {formatKz(totalReceipts)}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Total de Despesas e Pagamentos (Saídas)</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
              {formatKz(totalExpenses)}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">Saldo Líquido de Tesouraria (Caixa + Bancos)</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {formatKz(netBalance)}
            </p>
          </div>
        </div>

        {/* Record Financial Transaction */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!txForm.description || txForm.amount <= 0) return;
            await onRecordFinancialTx({
              ...txForm,
              status: 'liquidado',
            });
            setTxForm({ ...txForm, description: '', entityName: '' });
          }}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-sky-600" />
            <span>Registar Movimento Financeiro (Recebimento, Despesa ou Pagamento)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Natureza do Movimento
              </label>
              <select
                value={txForm.txType}
                onChange={(e) =>
                  setTxForm({
                    ...txForm,
                    txType: e.target.value as FinancialTransaction['txType'],
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="recebimento">Recebimento de Cliente (+)</option>
                <option value="despesa">Despesa Operacional (-)</option>
                <option value="pagamento_fornecedor">Pagamento a Fornecedor (-)</option>
                <option value="transferencia_caixa">Reforço / Transferência Caixa</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descrição do Movimento *
              </label>
              <input
                type="text"
                required
                value={txForm.description}
                onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                placeholder="Ex.: Pagamento de arrendamento, energia ENDE, telecomunicações..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor (Kwanzas / AOA) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Meio de Pagamento
              </label>
              <select
                value={txForm.paymentMethod}
                onChange={(e) =>
                  setTxForm({
                    ...txForm,
                    paymentMethod: e.target.value as FinancialTransaction['paymentMethod'],
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="transferencia">Transferência Bancária (IBAN)</option>
                <option value="multicaixa_express">Multicaixa Express</option>
                <option value="pos">TPA / POS Multicaixa</option>
                <option value="numerario">Numerário (Caixa)</option>
                <option value="referencia">Referência de Pagamento</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Conta Bancária / Caixa
              </label>
              <input
                type="text"
                value={txForm.accountName}
                onChange={(e) => setTxForm({ ...txForm, accountName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entidade / Beneficiário
              </label>
              <input
                type="text"
                value={txForm.entityName}
                onChange={(e) => setTxForm({ ...txForm, entityName: e.target.value })}
                placeholder="Nome do cliente ou fornecedor"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                Lançar Movimento
              </button>
            </div>
          </div>
        </form>

        {/* Transactions Ledger & Reconciliation */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Extracto de Tesouraria e Reconciliação Bancária
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Descrição / Entidade</th>
                  <th className="py-2.5 px-4">Conta & Meio</th>
                  <th className="py-2.5 px-4 text-right">Valor (AOA)</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4 text-right">Reconciliação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 px-4 font-mono">{t.txDate}</td>
                    <td className="py-2.5 px-4 uppercase font-mono font-semibold">
                      {t.txType}
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{t.description}</p>
                      <p className="text-slate-500">{t.entityName} · Ref: {t.referenceDoc}</p>
                    </td>
                    <td className="py-2.5 px-4">
                      {t.accountName} ({t.paymentMethod})
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-bold ${
                        t.txType === 'recebimento' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {t.txType === 'recebimento' ? '+' : '-'}
                      {formatKz(t.amount)}
                    </td>
                    <td className="py-2.5 px-4 uppercase font-mono">{t.status}</td>
                    <td className="py-2.5 px-4 text-right">
                      {t.status !== 'reconciliado' ? (
                        <button
                          onClick={() => onReconcileTx(t)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                        >
                          Reconciliar
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Reconciliado ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 5. SUPPLIERS & PURCHASES MODULE
  if (activeModule === 'suppliers') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Módulo de Fornecedores, Compras e Entrada Automática em Stock
          </h2>
          <p className="text-xs text-slate-500">
            Registo de fornecedores, facturas de compra, notas de crédito de fornecedor e alimentação directa do inventário.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Supplier */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supplierForm.name || !supplierForm.nif) return;
              await onCreateSupplier({
                ...supplierForm,
                totalPurchased: 0,
                balanceDue: 0,
              });
              setSupplierForm({ ...supplierForm, name: '', nif: '', phone: '', email: '' });
            }}
            className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-600" />
              <span>1. Registar Fornecedor</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Denominação do Fornecedor *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Ex.: Importadora Atlântico Angola, Lda"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">NIF *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.nif}
                  onChange={(e) => setSupplierForm({ ...supplierForm, nif: e.target.value })}
                  placeholder="540..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Telefone</label>
                <input
                  type="text"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="+244 923..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-slate-900 dark:bg-sky-600 text-white font-semibold"
                >
                  Guardar Fornecedor
                </button>
              </div>
            </div>
          </form>

          {/* Record Purchase / Supplier Credit Note with Automatic Stock Entry */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const sup =
                suppliers.find((s) => s.id === purchaseForm.supplierId) || suppliers[0];
              const prod =
                products.find((p) => p.id === purchaseForm.productId) || products[0];
              if (!sup || !prod) return;
              await onRecordSupplierPurchase({
                supplier: sup,
                product: prod,
                quantity: Math.max(1, Number(purchaseForm.quantity)),
                unitCost: Math.max(1, Number(purchaseForm.unitCost)),
                invoiceRef: purchaseForm.invoiceRef,
                isCreditNote: purchaseForm.isCreditNote,
              });
            }}
            className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>2. Registar Compra / Factura de Fornecedor (Entrada Automática em Stock)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Fornecedor</label>
                <select
                  value={purchaseForm.supplierId}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.nif})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Produto a Dar Entrada</label>
                <select
                  value={purchaseForm.productId}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, productId: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Quantidade & Custo Unit. (AOA)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={purchaseForm.quantity}
                    onChange={(e) =>
                      setPurchaseForm({ ...purchaseForm, quantity: Number(e.target.value) || 1 })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 font-mono bg-transparent"
                  />
                  <input
                    type="number"
                    min={1}
                    value={purchaseForm.unitCost}
                    onChange={(e) =>
                      setPurchaseForm({ ...purchaseForm, unitCost: Number(e.target.value) || 1 })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 font-mono bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">N.º Factura Fornecedor</label>
                <input
                  type="text"
                  value={purchaseForm.invoiceRef}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, invoiceRef: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={purchaseForm.isCreditNote}
                    onChange={(e) =>
                      setPurchaseForm({ ...purchaseForm, isCreditNote: e.target.checked })
                    }
                  />
                  <span>É Nota de Crédito de Fornecedor (Devolução / Abatimento)</span>
                </label>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Registar Compra & Actualizar Stock
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Suppliers Table */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Fornecedores Registados e Conta Corrente de Compras
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">Contacto / Morada</th>
                  <th className="py-3 px-4 text-right">Volume de Compras</th>
                  <th className="py-3 px-4 text-right">Saldo a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 font-mono">{s.nif}</td>
                    <td className="py-3 px-4">
                      {s.phone} · {s.address}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatKz(s.totalPurchased)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                      {formatKz(s.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 6. REPORTS & STATISTICS MODULE
  if (activeModule === 'reports') {
    const filteredInvs = invoices.filter((i) => {
      const d = i.issueDate.slice(0, 10);
      return d >= reportStartDate && d <= reportEndDate;
    });

    const totalSalesKz = filteredInvs.reduce((a, b) => a + b.totalAmount, 0);
    const totalVatLiquidatedKz = filteredInvs.reduce((a, b) => a + b.taxTotal, 0);

    const handleExportCurrentReportPdf = () => {
      exportarRelatorioPDF({
        title: reportType.toUpperCase().replace(/_/g, ' '),
        company,
        period: `${reportStartDate} a ${reportEndDate}`,
        headers: ['Documento / Ref', 'Data', 'Cliente / Entidade', 'NIF', 'IVA (AOA)', 'Total (AOA)'],
        rows: filteredInvs.map((i) => [
          i.docNumber,
          i.issueDate,
          i.clientName,
          i.clientNif,
          formatKz(i.taxTotal),
          formatKz(i.totalAmount),
        ]),
        summaryText: `Total Facturado no Período: ${formatKz(totalSalesKz)} | Total IVA Liquidado: ${formatKz(totalVatLiquidatedKz)}`,
      });
    };

    const handleExportCurrentReportExcel = () => {
      exportarDadosExcel(
        'Relatorio_Fiscal',
        `ALHAN_Relatorio_${reportType}`,
        filteredInvs.map((i) => ({
          Documento: i.docNumber,
          Tipo: i.docType,
          Serie: i.series,
          Data: i.issueDate,
          Cliente: i.clientName,
          NIF_Cliente: i.clientNif,
          Subtotal_Kz: i.subtotal,
          IVA_Liquidado_Kz: i.taxTotal,
          Total_Geral_Kz: i.totalAmount,
          Estado: i.status,
        }))
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
              Relatórios Empresariais, IVA e Estatísticas Exportáveis (PDF & Excel)
            </h2>
            <p className="text-xs text-slate-500">
              Vendas diárias/mensais/anuais, IVA liquidado e suportado, dívidas de clientes, existências e fluxo de caixa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCurrentReportPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
            <button
              onClick={handleExportCurrentReportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Tipo de Relatório Oficial</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
            >
              <option value="vendas_mensais">Vendas Diárias, Mensais e Anuais por Série</option>
              <option value="iva_liquidado">Mapa de Apuramento de IVA Liquidado (AOA)</option>
              <option value="dividas_clientes">Antiguidade de Saldos e Dívidas de Clientes</option>
              <option value="existencias_stock">Mapa de Valorização de Existências (Inventário)</option>
              <option value="fluxo_caixa">Demonstrativo de Receitas, Despesas e Fluxo de Caixa</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Data Inicial</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Data Final</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
            />
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Resultados Apurados ({filteredInvs.length} registos)
            </span>
            <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
              Total Geral: {formatKz(totalSalesKz)} · IVA Liquidado: {formatKz(totalVatLiquidatedKz)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Documento</th>
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">NIF</th>
                  <th className="py-2.5 px-4 text-right">Incidência (Subtotal)</th>
                  <th className="py-2.5 px-4 text-right">IVA Liquidado</th>
                  <th className="py-2.5 px-4 text-right">Total (AOA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredInvs.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5 px-4 font-mono font-bold">{i.docNumber}</td>
                    <td className="py-2.5 px-4 font-mono">{i.issueDate}</td>
                    <td className="py-2.5 px-4">{i.clientName}</td>
                    <td className="py-2.5 px-4 font-mono">{i.clientNif}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatKz(i.subtotal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatKz(i.taxTotal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {formatKz(i.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 7. USERS, ROLES & AUDIT MODULE
  if (activeModule === 'users') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Gestão de Utilizadores, Perfis de Acesso e Auditoria de Operações
          </h2>
          <p className="text-xs text-slate-500">
            Configure permissões granulares por função (Administrador, Gerente, Contabilista, Operador, Vendedor, Armazém, Consulta).
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!memberForm.name || !memberForm.email) return;
            await onCreateTeamMember({
              name: memberForm.name,
              email: memberForm.email,
              role: memberForm.role,
              establishment: memberForm.establishment,
              permissionsSummary: rolePermissionsMap[memberForm.role],
              status: 'activo',
            });
            setMemberForm({ ...memberForm, name: '', email: '' });
          }}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-600" />
            <span>Adicionar Utilizador / Operador à Empresa</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Nome do Utilizador *</label>
              <input
                type="text"
                required
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="Ex.: Ana Paula Santos"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">E-mail de Acesso *</label>
              <input
                type="email"
                required
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                placeholder="operador@empresa.ao"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Função / Perfil de Permissões</label>
              <select
                value={memberForm.role}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, role: e.target.value as UserRoleType })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="Administrador">Administrador</option>
                <option value="Gerente">Gerente</option>
                <option value="Contabilista">Contabilista</option>
                <option value="Operador de facturacao">Operador de facturação</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Responsavel de armazem">Responsável de armazém</option>
                <option value="Consulta">Consulta</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                Criar Utilizador
              </button>
            </div>
          </div>
          <p className="text-slate-500">
            <strong>Permissões atribuídas a {memberForm.role}:</strong>{' '}
            {rolePermissionsMap[memberForm.role]}
          </p>
        </form>

        {/* Team Members List */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Quadros e Operadores Autorizados ({teamMembers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Nome</th>
                  <th className="py-2.5 px-4">E-mail</th>
                  <th className="py-2.5 px-4">Função</th>
                  <th className="py-2.5 px-4">Estabelecimento</th>
                  <th className="py-2.5 px-4">Permissões</th>
                  <th className="py-2.5 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {teamMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {m.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{m.email}</td>
                    <td className="py-2.5 px-4 font-bold text-sky-700 dark:text-sky-400">
                      {m.role}
                    </td>
                    <td className="py-2.5 px-4">{m.establishment}</td>
                    <td className="py-2.5 px-4 text-slate-500">{m.permissionsSummary}</td>
                    <td className="py-2.5 px-4 uppercase font-mono text-emerald-600">
                      {m.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Audit Logs */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Registo de Auditoria da Empresa (Imutável)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Operador</th>
                  <th className="py-2.5 px-4">Módulo</th>
                  <th className="py-2.5 px-4">Acção</th>
                  <th className="py-2.5 px-4">Referência</th>
                  <th className="py-2.5 px-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-4 font-mono">{l.actorEmail}</td>
                    <td className="py-2.5 px-4 font-semibold">{l.module}</td>
                    <td className="py-2.5 px-4 text-sky-700 dark:text-sky-400">{l.action}</td>
                    <td className="py-2.5 px-4 font-mono">{l.targetRef}</td>
                    <td className="py-2.5 px-4 text-slate-500">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 8. SUPPORT, KNOWLEDGE BASE & SUBSCRIPTION MODULE
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-sky-400">
            SUPORTE TÉCNICO, BASE DE CONHECIMENTO & GESTÃO DE SUBSCRIÇÃO ALHAN
          </p>
          <h2 className="text-xl font-bold tracking-tight font-display">
            Atendimento Directo ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA
          </h2>
          <p className="text-xs text-slate-300">
            Linha Directa Angola: <strong>+244 922 021 211</strong> · E-mail Oficial:{' '}
            <strong>facturao@alhan.pro</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="https://wa.me/244922021211?text=Suporte%20T%C3%A9cnico%20ALHAN%20FACTURA"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp (922 021 211)
          </a>
          <a
            href="mailto:facturao@alhan.pro?subject=Suporte%20ALHAN%20FACTURA"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white"
          >
            <Mail className="w-4 h-4" />
            facturao@alhan.pro
          </a>
        </div>
      </div>

      {/* Company Logo & Subscription Management via Multicaixa Express 927 496 287 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 cols: Logótipo da Empresa */}
        <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Identidade Visual & Logótipo da Sua Empresa
          </h3>
          <p className="text-slate-500">
            O logótipo carregado abaixo aparece automaticamente nas facturas A4, nos talões térmicos 80mm e no cabeçalho da empresa.
          </p>
          <div className="flex items-center gap-4">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.commercialName}
                className="w-20 h-20 rounded-xl object-contain border border-slate-200 bg-white p-1.5 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-400 shrink-0">
                SEM LOGO
              </div>
            )}
            <div className="space-y-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 text-white font-semibold transition-colors">
                <span>Actualizar Logótipo (PNG/JPG)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !onUpdateCompanyLogo) return;
                    const dataUrl = await comprimirImagemParaBase64(file, 280, 32000);
                    await onUpdateCompanyLogo(dataUrl);
                    setMulticaixaNotice('Logótipo oficial da empresa actualizado com sucesso!');
                  }}
                  className="hidden"
                />
              </label>
              {company.logoUrl && onUpdateCompanyLogo && (
                <button
                  type="button"
                  onClick={() => onUpdateCompanyLogo('')}
                  className="block text-red-600 hover:underline font-semibold"
                >
                  Remover logótipo actual
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 7 cols: Multicaixa Express 927 496 287 Subscription & Expiration Control */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span>
                  Plano Contratado: {company.planId.toUpperCase()} ({company.billingCycle}) — Estado:{' '}
                  <strong className="text-emerald-600">{company.subscriptionStatus.toUpperCase()}</strong>
                </span>
              </h3>
              <p className="text-slate-500 mt-0.5">
                Canal Oficial: <strong>MULTICAIXA EXPRESS {MCX_EXPRESS_OFFICIAL_NUMBER}</strong> (Beneficiário: <strong>{MCX_EXPRESS_BENEFICIARY}</strong>) · Vigência:{' '}
                {company.subscriptionStartDate || getLuandaIsoDate()} até{' '}
                <strong>{company.subscriptionEndDate || 'Activa'}</strong>
              </p>
            </div>
            {onOpenMcxCheckout && (
              <button
                type="button"
                onClick={() => onOpenMcxCheckout(company.planId, company.billingCycle)}
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-sm"
              >
                PAGAR COM MULTICAIXA EXPRESS ({MCX_EXPRESS_OFFICIAL_NUMBER})
              </button>
            )}
          </div>

          {(() => {
            const dias = calcularDiasParaVencimento(company.subscriptionEndDate);
            if (dias !== null && dias <= 7) {
              return (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 text-amber-900 dark:text-amber-200 font-medium">
                  Alerta de Vencimento da Subscrição (Avisos 7, 3 e 1 dia): A sua subscrição vence em{' '}
                  <strong>{dias} dia(s)</strong> ({company.subscriptionEndDate}). Renove via Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER} — {MCX_EXPRESS_BENEFICIARY}).
                </div>
              );
            }
            return null;
          })()}

          <div className="flex flex-wrap items-center gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (onOpenMcxCheckout) {
                    onOpenMcxCheckout(p.id, company.billingCycle);
                  } else {
                    onChangeCompanyPlan(p.id, company.billingCycle);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                  company.planId === p.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Subscrever {p.name} ({formatKz(p.monthlyPriceKz)}/mês)
              </button>
            ))}
          </div>

          {multicaixaNotice && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{multicaixaNotice}</span>
            </div>
          )}
        </div>
      </div>

      {/* Company Subscription Payments History & Receipt PDF Export */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Histórico de Pagamentos de Subscrição Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER} — {MCX_EXPRESS_BENEFICIARY})
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhe o estado de validação dos seus pagamentos e descarregue o recibo oficial após confirmação administrativa.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Ref. Pedido</th>
                <th className="py-2.5 px-4">Plano & Ciclo</th>
                <th className="py-2.5 px-4">Ref. Operação MCX</th>
                <th className="py-2.5 px-4 text-right">Valor (AOA)</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4">Observações Administração ALHAN</th>
                <th className="py-2.5 px-4 text-right">Recibo Oficial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {subscriptionPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-slate-400">
                    Nenhum pagamento de subscrição submetido ainda. Clique em "PAGAR COM MULTICAIXA EXPRESS" acima.
                  </td>
                </tr>
              ) : (
                subscriptionPayments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-2.5 px-4 font-mono font-bold">{pay.orderReference}</td>
                    <td className="py-2.5 px-4 uppercase font-mono">
                      {pay.planId} ({pay.billingCycle})
                    </td>
                    <td className="py-2.5 px-4 font-mono">{pay.transactionReference}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {formatKz(pay.amountKz)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          pay.status === 'confirmado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pay.status === 'rejeitado'
                            ? 'bg-red-100 text-red-800'
                            : pay.status === 'novo_comprovativo'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pay.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {pay.adminNotes}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {pay.status === 'confirmado' ? (
                        <button
                          type="button"
                          onClick={() => exportarReciboSubscricaoPDF(pay)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
                        >
                          <Download className="w-3 h-3" />
                          <span>Recibo PDF</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">Aguarda Validação</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Open Support Ticket */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ticketForm.subject || !ticketForm.description) return;
            await onCreateSupportTicket({
              companyName: company.name,
              subject: ticketForm.subject,
              description: ticketForm.description,
              category: ticketForm.category,
              priority: ticketForm.priority,
              attachmentRef: ticketForm.attachmentRef,
              status: 'aberto',
              adminResponse: '',
            });
            setTicketForm({ ...ticketForm, subject: '', description: '' });
          }}
          className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Abrir Chamado de Suporte Técnico ALHAN
          </h3>
          <div>
            <label className="block font-semibold mb-1">Assunto do Chamado *</label>
            <input
              type="text"
              required
              value={ticketForm.subject}
              onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
              placeholder="Ex.: Apoio na validação do ficheiro SAF-T AO mensal"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Módulo / Categoria</label>
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="Facturação & SAF-T AO">Facturação & SAF-T AO</option>
                <option value="Integração AGT">Integração AGT (DP 71/25)</option>
                <option value="Inventário & Armazéns">Inventário & Armazéns</option>
                <option value="Subscrição & Pagamentos">Subscrição & Pagamentos</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Prioridade</label>
              <select
                value={ticketForm.priority}
                onChange={(e) =>
                  setTicketForm({
                    ...ticketForm,
                    priority: e.target.value as SupportTicket['priority'],
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Descrição do Problema *</label>
            <textarea
              rows={3}
              required
              value={ticketForm.description}
              onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              placeholder="Descreva os passos ou código de documento em questão..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            Submeter Chamado à Equipa ALHAN
          </button>
        </form>

        {/* Knowledge Base & Tutorials */}
        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>Base de Conhecimento & Tutoriais de Utilização</span>
          </h3>
          <div className="space-y-3">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white">
                1. Como emitir uma Nota de Crédito para rectificar uma Factura?
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                As facturas emitidas não podem ser eliminadas. Aceda ao módulo de Facturação, clique em "Rectificar (Nota de Crédito)" na linha da factura original ou seleccione o tipo "Nota de Crédito" indicando o motivo da rectificação.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white">
                2. Como exportar e validar o ficheiro SAF-T (AO) mensal?
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                No menu lateral, seleccione "SAF-T AO (XML)", escolha o período do mês anterior e clique em "Validar Estrutura e Gerar XML". O sistema verifica automaticamente os NIFs, séries e assinaturas Hash antes de descarregar o ficheiro `.xml`.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white">
                3. Funcionamento Offline e Sincronização Automática
              </p>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Instale a aplicação através do botão "Instalar Aplicação" no topo. Em caso de corte de Internet, continue a consultar e preparar documentos críticos; assim que a rede regressar, a sincronização ocorre automaticamente.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket History */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Histórico de Atendimento e Chamados da Empresa ({tickets.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Assunto</th>
                <th className="py-2.5 px-4">Categoria</th>
                <th className="py-2.5 px-4">Prioridade</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4">Resposta do Suporte ALHAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {t.subject}
                  </td>
                  <td className="py-2.5 px-4">{t.category}</td>
                  <td className="py-2.5 px-4 uppercase font-mono">{t.priority}</td>
                  <td className="py-2.5 px-4 uppercase font-mono font-bold text-sky-600">
                    {t.status}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                    {t.adminResponse || 'Em análise pela equipa técnica ALHAN (922 021 211)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
