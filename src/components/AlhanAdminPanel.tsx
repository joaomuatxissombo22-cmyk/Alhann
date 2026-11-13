import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Sliders,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  AuditLog,
  BillingCycleType,
  Company,
  Invoice,
  PlanIdType,
  SubscriptionPayment,
  SubscriptionPlanConfig,
  SubscriptionStatusType,
  SupportTicket,
} from '../types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  calcularDataVencimentoSubscricao,
  calcularDiasParaVencimento,
  calcularPrecoCiclo,
  exportarDadosExcel,
  exportarReciboSubscricaoPDF,
  exportarRelatorioPDF,
  formatKz,
  formatLuandaDateTime,
  getLuandaIsoDate,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
} from '../lib/angolaUtils';

export const DEFAULT_MASTER_ADMIN_USER = 'admin@alhan.pro';
export const DEFAULT_MASTER_ADMIN_ALIAS = 'alhan.admin';
export const DEFAULT_MASTER_ADMIN_PASS = 'Alhan@Adm2026#';
const ADMIN_CREDS_STORAGE_KEY = 'alhan_master_admin_creds_v1';
const CLIENT_PASSWORDS_STORAGE_KEY = 'alhan_client_credentials_v1';

interface StoredAdminCreds {
  username: string;
  password: string;
}

export function getStoredMasterAdminCreds(): StoredAdminCreds {
  try {
    const raw = localStorage.getItem(ADMIN_CREDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAdminCreds;
      if (parsed.username && parsed.password) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    username: DEFAULT_MASTER_ADMIN_USER,
    password: DEFAULT_MASTER_ADMIN_PASS,
  };
}

export function getClientAccessPassword(companyId: string, nif: string): string {
  try {
    const raw = localStorage.getItem(CLIENT_PASSWORDS_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      if (map[companyId]) return map[companyId];
    }
  } catch {
    // ignore
  }
  return `Alhan@${nif.slice(-4) || '2026'}!`;
}

export function saveClientAccessPassword(companyId: string, password: string): void {
  try {
    const raw = localStorage.getItem(CLIENT_PASSWORDS_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[companyId] = password;
    localStorage.setItem(CLIENT_PASSWORDS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

interface AlhanAdminPanelProps {
  companies: Company[];
  invoices: Invoice[];
  tickets: SupportTicket[];
  auditLogs: AuditLog[];
  plans: SubscriptionPlanConfig[];
  subscriptionPayments: SubscriptionPayment[];
  onUpdatePlans: (updated: SubscriptionPlanConfig[]) => void;
  onUpdateCompanyStatus: (company: Company, newStatus: SubscriptionStatusType) => Promise<void>;
  onUpdateCompanyDetails?: (companyId: string, updates: Partial<Company>) => Promise<void>;
  onCreateClientCompany?: (
    companyData: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    clientPassword: string,
    paidAmountKz: number
  ) => Promise<void>;
  onDeleteClientCompany?: (companyId: string) => Promise<void>;
  onInspectClientCompany?: (company: Company) => void;
  onValidateSubscriptionPayment: (
    payment: SubscriptionPayment,
    decision: 'confirmado' | 'rejeitado' | 'novo_comprovativo',
    adminNotes: string
  ) => Promise<void>;
  onRespondTicket: (
    ticket: SupportTicket,
    response: string,
    newStatus: SupportTicket['status']
  ) => Promise<void>;
  onBroadcastNotice: (title: string, message: string) => void;
  onExitHiddenAdmin?: () => void;
  requireMasterLoginGate?: boolean;
  isMasterAuthenticated?: boolean;
  onMasterAuthenticated?: () => void;
  onMasterLogout?: () => void;
}

export const AlhanAdminPanel: React.FC<AlhanAdminPanelProps> = ({
  companies,
  invoices,
  tickets,
  auditLogs,
  plans,
  subscriptionPayments,
  onUpdatePlans,
  onUpdateCompanyStatus,
  onUpdateCompanyDetails,
  onCreateClientCompany,
  onDeleteClientCompany,
  onInspectClientCompany,
  onValidateSubscriptionPayment,
  onRespondTicket,
  onBroadcastNotice,
  onExitHiddenAdmin,
  requireMasterLoginGate = false,
  isMasterAuthenticated = true,
  onMasterAuthenticated,
  onMasterLogout,
}) => {
  // Master Admin Login Gate State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<
    | 'empresas'
    | 'financeiro_alhan'
    | 'pagamentos_mcx'
    | 'planos'
    | 'suporte'
    | 'comunicados'
    | 'seguranca'
  >('empresas');

  // Client filtering & search state
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('todos');
  const [clientPlanFilter, setClientPlanFilter] = useState<string>('todos');

  // Modal to register a new ALHAN Client after acquiring the software
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    commercialName: '',
    nif: '',
    province: 'Luanda',
    municipality: 'Luanda',
    address: 'Luanda, Angola',
    phone: '+244 923 000 000',
    email: '',
    responsibleName: '',
    economicActivity: 'Comércio Geral e Prestação de Serviços',
    taxRegime: 'Regime Geral' as Company['taxRegime'],
    vatScheme: 'IVA 14% (Geral)' as Company['vatScheme'],
    bankName: 'BAI — Banco Angolano de Investimentos',
    bankIban: 'AO06.0040.0000.0000.0000.0000.1',
    establishmentsCount: 1,
    planId: 'profissional' as PlanIdType,
    billingCycle: 'anual' as BillingCycleType,
    subscriptionStatus: 'activa' as SubscriptionStatusType,
    clientPassword: 'Alhan@Cliente2026',
    paidAmountKz: 403200,
  });

  // Modal to view/reset client credentials & license details
  const [selectedClientForAccess, setSelectedClientForAccess] = useState<Company | null>(null);
  const [customClientPassInput, setCustomClientPassInput] = useState('');
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  // Admin Credentials Management State
  const [adminCreds, setAdminCreds] = useState<StoredAdminCreds>(() => getStoredMasterAdminCreds());
  const [newAdminUser, setNewAdminUser] = useState(adminCreds.username);
  const [newAdminPass, setNewAdminPass] = useState(adminCreds.password);
  const [showAdminPassConfig, setShowAdminPassConfig] = useState(false);

  const [ticketResponses, setTicketResponses] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [previewProofPayment, setPreviewProofPayment] = useState<SubscriptionPayment | null>(null);
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);

  const [broadcastTitle, setBroadcastTitle] = useState(
    'Actualização Normativa AGT — Decreto Presidencial n.º 71/25'
  );
  const [broadcastBody, setBroadcastBody] = useState(
    'Informamos todas as empresas utilizadoras do ALHAN FACTURA que os 7 serviços oficiais da API AGT e o canal de subscrições Multicaixa Express (927 496 287 — ALHAN) encontram-se operacionais.'
  );
  const [broadcastSent, setBroadcastSent] = useState(false);

  const currentOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://factura.alhan.pro';
  const hiddenAdminPrimaryLink = 'https://factura.alhan.pro/painel-adm-alhan';
  const hiddenAdminQueryLink = 'https://factura.alhan.pro/?painel=adm-alhan';
  const hostingerHiddenLink = 'https://factura.alhan.pro/painel-adm-alhan';
  const hostingerQueryLink = 'https://factura.alhan.pro/?painel=adm-alhan';
  const localEnvHiddenLink = `${currentOrigin}/painel-adm-alhan`;

  const handleCopyText = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedBanner(label);
    setTimeout(() => setCopiedBanner(null), 3500);
  };

  const handleMasterLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const stored = getStoredMasterAdminCreds();
    const u = loginUser.trim().toLowerCase();
    const p = loginPass.trim();

    const validUser =
      u === stored.username.toLowerCase() ||
      u === DEFAULT_MASTER_ADMIN_USER.toLowerCase() ||
      u === DEFAULT_MASTER_ADMIN_ALIAS.toLowerCase() ||
      u === 'facturao@alhan.pro' ||
      u === 'joaomuatxissombo22@gmail.com';

    const validPass = p === stored.password || p === DEFAULT_MASTER_ADMIN_PASS;

    if (validUser && validPass) {
      onMasterAuthenticated?.();
    } else {
      setLoginError(
        'Credenciais administrativas inválidas. Verifique o Utilizador e a Senha exclusiva da Administração ALHAN.'
      );
    }
  };

  // Module 3: Painel Financeiro da ALHAN Calculations
  const totalSubscriptions = companies.length;
  const activeCompaniesCount = companies.filter((c) => c.subscriptionStatus === 'activa').length;
  const pendingCompaniesCount = companies.filter((c) => c.subscriptionStatus === 'pendente').length;
  const suspendedCompaniesCount = companies.filter(
    (c) => c.subscriptionStatus === 'suspensa' || c.subscriptionStatus === 'vencida'
  ).length;

  const confirmedPayments = subscriptionPayments.filter((p) => p.status === 'confirmado');
  const pendingPayments = subscriptionPayments.filter(
    (p) => p.status === 'pendente' || p.status === 'novo_comprovativo'
  );
  const rejectedPayments = subscriptionPayments.filter((p) => p.status === 'rejeitado');

  const confirmedPaymentsVolumeKz = confirmedPayments.reduce((acc, p) => acc + p.amountKz, 0);

  const monthlyRecurringRevenueKz = companies
    .filter((c) => c.subscriptionStatus === 'activa')
    .reduce((acc, c) => {
      const plan = plans.find((p) => p.id === c.planId) || plans[1];
      return acc + (plan?.monthlyPriceKz || 42000);
    }, 0);

  const monthlyRevenueKz = Math.max(monthlyRecurringRevenueKz, confirmedPaymentsVolumeKz);
  const dailyRevenueKz = Math.round(monthlyRevenueKz / 30);
  const annualRevenueKz = companies
    .filter((c) => c.subscriptionStatus === 'activa')
    .reduce((acc, c) => {
      const plan = plans.find((p) => p.id === c.planId) || plans[1];
      return acc + calcularPrecoCiclo(plan?.monthlyPriceKz || 42000, 'anual');
    }, 0);

  const expiringSoonCompanies = companies.filter((c) => {
    const dias = calcularDiasParaVencimento(c.subscriptionEndDate);
    return dias !== null && dias <= 7;
  });

  const totalPlatformVolumeKz = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = clientSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.commercialName.toLowerCase().includes(q) ||
        c.nif.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.responsibleName.toLowerCase().includes(q);
      const matchesStatus =
        clientStatusFilter === 'todos' || c.subscriptionStatus === clientStatusFilter;
      const matchesPlan = clientPlanFilter === 'todos' || c.planId === clientPlanFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [companies, clientSearch, clientStatusFilter, clientPlanFilter]);

  const handlePriceChange = (planId: string, newPrice: number) => {
    const next = plans.map((p) =>
      p.id === planId ? { ...p, monthlyPriceKz: Math.max(1000, newPrice) } : p
    );
    onUpdatePlans(next);
  };

  const handleRenewClientLicense = async (company: Company, addDays: number) => {
    const baseDateStr =
      company.subscriptionEndDate &&
      new Date(company.subscriptionEndDate).getTime() > Date.now()
        ? company.subscriptionEndDate
        : getLuandaIsoDate();
    const baseDate = new Date(`${baseDateStr}T12:00:00Z`);
    baseDate.setUTCDate(baseDate.getUTCDate() + addDays);
    const nextEndDate = baseDate.toISOString().slice(0, 10);

    if (onUpdateCompanyDetails) {
      await onUpdateCompanyDetails(company.id, {
        subscriptionStatus: 'activa',
        subscriptionStartDate: company.subscriptionStartDate || getLuandaIsoDate(),
        subscriptionEndDate: nextEndDate,
      });
    } else {
      await onUpdateCompanyStatus(company, 'activa');
    }
    setValidationFeedback(
      `Licença do cliente "${company.name}" (NIF ${company.nif}) renovada por +${addDays} dias (Válida até ${nextEndDate}).`
    );
  };

  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateClientCompany) return;
    const today = getLuandaIsoDate();
    const endDate = calcularDataVencimentoSubscricao(today, newClientForm.billingCycle);

    await onCreateClientCompany(
      {
        name: newClientForm.name.trim(),
        commercialName: (newClientForm.commercialName || newClientForm.name).trim(),
        nif: newClientForm.nif.trim(),
        province: newClientForm.province,
        municipality: newClientForm.municipality,
        address: newClientForm.address,
        phone: newClientForm.phone,
        email: newClientForm.email.trim(),
        responsibleName: newClientForm.responsibleName.trim() || 'Administrador da Empresa',
        economicActivity: newClientForm.economicActivity,
        taxRegime: newClientForm.taxRegime,
        vatScheme: newClientForm.vatScheme,
        bankName: newClientForm.bankName,
        bankIban: newClientForm.bankIban,
        establishmentsCount: Number(newClientForm.establishmentsCount) || 1,
        planId: newClientForm.planId,
        billingCycle: newClientForm.billingCycle,
        subscriptionStatus: newClientForm.subscriptionStatus,
        agtStatus: 'preparacao_certificacao',
        agtCertificateRef: 'CERT-AO-JWS-7125',
        agtEnvironment: 'sandbox_teste',
        subscriptionStartDate: today,
        subscriptionEndDate: endDate,
        agtAdhesionStatus: 'em_homologacao',
      },
      newClientForm.clientPassword.trim() || 'Alhan@Cliente2026',
      Number(newClientForm.paidAmountKz) || 0
    );

    setIsAddClientModalOpen(false);
    setValidationFeedback(
      `Novo cliente "${newClientForm.name}" (NIF ${newClientForm.nif}) registado com sucesso e licença ${newClientForm.subscriptionStatus.toUpperCase()} até ${endDate}!`
    );
    setNewClientForm({
      ...newClientForm,
      name: '',
      commercialName: '',
      nif: '',
      email: '',
      responsibleName: '',
    });
  };

  const handleAdminPaymentAction = async (
    payment: SubscriptionPayment,
    decision: 'confirmado' | 'rejeitado' | 'novo_comprovativo'
  ) => {
    const defaultNote =
      decision === 'confirmado'
        ? `Pagamento Multicaixa Express (${MCX_EXPRESS_OFFICIAL_NUMBER} — ${MCX_EXPRESS_BENEFICIARY}) confirmado pela Administração ALHAN. Plano activado.`
        : decision === 'rejeitado'
        ? 'Comprovativo ou referência de operação inválida / não localizada no extracto Multicaixa Express.'
        : 'Solicitado novo comprovativo legível com o número de operação Multicaixa Express visível.';

    const note = (paymentNotes[payment.id] || defaultNote).trim();
    await onValidateSubscriptionPayment(payment, decision, note);

    if (decision === 'confirmado') {
      setValidationFeedback(
        `Pagamento ${payment.orderReference} CONFIRMADO! Subscrição da empresa ${payment.companyName} activada automaticamente, vigência actualizada e recibo fiscal gerado.`
      );
    } else if (decision === 'rejeitado') {
      setValidationFeedback(`Pagamento ${payment.orderReference} marcado como REJEITADO.`);
    } else {
      setValidationFeedback(
        `Solicitação de NOVO COMPROVATIVO registada para o pedido ${payment.orderReference}.`
      );
    }
  };

  const handleSaveAdminCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: StoredAdminCreds = {
      username: newAdminUser.trim() || DEFAULT_MASTER_ADMIN_USER,
      password: newAdminPass.trim() || DEFAULT_MASTER_ADMIN_PASS,
    };
    try {
      localStorage.setItem(ADMIN_CREDS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setAdminCreds(updated);
    setValidationFeedback(
      `Credenciais do Painel ADM actualizadas com sucesso! Utilizador: ${updated.username}`
    );
  };

  const handleExportAlhanFinancePdf = () => {
    const dummyCompany: Company = companies[0] || {
      id: 'alhan-hq',
      ownerId: 'admin',
      name: 'ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA',
      commercialName: 'ALHAN FACTURA',
      nif: '5000000000',
      address: 'Luanda, Angola',
      province: 'Luanda',
      municipality: 'Luanda',
      phone: '+244 922 021 211',
      email: 'facturao@alhan.pro',
      economicActivity: 'Software SaaS de Facturação Electrónica',
      taxRegime: 'Regime Geral',
      vatScheme: 'IVA 14% (Geral)',
      responsibleName: 'Administração Central ALHAN',
      bankName: 'BAI',
      bankIban: '',
      establishmentsCount: 1,
      planId: 'empresarial',
      billingCycle: 'anual',
      subscriptionStatus: 'activa',
      agtStatus: 'preparacao_certificacao',
      agtCertificateRef: 'ALHAN-HQ',
      agtEnvironment: 'sandbox_teste',
    };

    exportarRelatorioPDF({
      title: 'PAINEL ADMINISTRATIVO E FINANCEIRO CENTRAL DA ALHAN — CONTROLO DE CLIENTES',
      company: dummyCompany,
      period: getLuandaIsoDate(),
      headers: [
        'Indicador Financeiro / Clientes ALHAN',
        'Valor / Quantidade',
        'Canal / Detalhe Oficial',
      ],
      rows: [
        ['Total de Empresas Clientes', String(totalSubscriptions), 'Clientes ALHAN FACTURA'],
        ['Clientes c/ Licença Activa', String(activeCompaniesCount), 'Subscrição Regularizada'],
        ['Clientes Pendentes', String(pendingCompaniesCount), 'Aguardam Confirmação'],
        ['Clientes Suspensos / Vencidos', String(suspendedCompaniesCount), 'Bloqueio Administrativo'],
        ['Receita Diária Estimada (AOA)', formatKz(dailyRevenueKz), 'Média Diária SaaS'],
        ['Receita Mensal (AOA)', formatKz(monthlyRevenueKz), 'Facturação Mensal Subscrições'],
        ['Receita Anual Projectada (AOA)', formatKz(annualRevenueKz), 'Facturação Anual Subscrições'],
        [
          'Total Pagamentos Multicaixa Express',
          String(subscriptionPayments.length),
          `N.º ${MCX_EXPRESS_OFFICIAL_NUMBER} (${MCX_EXPRESS_BENEFICIARY})`,
        ],
        ['Pagamentos Pendentes de Validação', String(pendingPayments.length), 'Estado PENDENTE'],
        [
          'Pagamentos Confirmados',
          `${confirmedPayments.length} (${formatKz(confirmedPaymentsVolumeKz)})`,
          'Validados com Recibo Emitido',
        ],
      ],
      summaryText: `Canal Oficial Multicaixa Express: ${MCX_EXPRESS_OFFICIAL_NUMBER} (Beneficiário: ${MCX_EXPRESS_BENEFICIARY}) | Receita Mensal: ${formatKz(monthlyRevenueKz)} | Receita Anual: ${formatKz(annualRevenueKz)}`,
    });
  };

  const handleExportAlhanFinanceExcel = () => {
    exportarDadosExcel('Clientes_Subscricoes_ALHAN', `ALHAN_Clientes_${getLuandaIsoDate()}`, [
      ...companies.map((c) => ({
        Empresa: c.name,
        Nome_Comercial: c.commercialName,
        NIF: c.nif,
        Provincia: c.province,
        Telefone: c.phone,
        Email: c.email,
        Responsavel: c.responsibleName,
        Plano: c.planId.toUpperCase(),
        Ciclo: c.billingCycle.toUpperCase(),
        Estado_Licenca: c.subscriptionStatus.toUpperCase(),
        Inicio_Subscricao: c.subscriptionStartDate || getLuandaIsoDate(),
        Fim_Subscricao: c.subscriptionEndDate || 'Activa',
      })),
    ]);
  };

  // RENDER DEDICATED MASTER ADMIN LOGIN GATE WHEN ACCESSED VIA HIDDEN LINK AND NOT YET AUTHENTICATED
  if (requireMasterLoginGate && !isMasterAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center gap-3.5">
            <img
              src={ALHAN_OFFICIAL_LOGO_URL}
              alt="ALHAN Logo"
              className="h-11 w-auto rounded-lg bg-white px-2.5 py-1 object-contain shrink-0"
            />
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold uppercase">
                ACESSO OCULTO & RESTRITO
              </span>
              <h1 className="text-base font-bold tracking-tight font-display mt-1">
                Painel ADM Central — ALHAN FACTURA
              </h1>
              <p className="text-[11px] text-slate-400">
                Controlo de Clientes, Licenças e Pagamentos Multicaixa Express
              </p>
            </div>
          </div>

          <form onSubmit={handleMasterLoginSubmit} className="p-6 space-y-4 text-xs">
            {loginError && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Utilizador Administrador (User / E-mail) *
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="admin@alhan.pro"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Senha de Administração (Palavra-passe) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-9 pr-10 py-2.5 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  title="Mostrar / Ocultar Senha"
                >
                  {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Aceder ao Painel ADM de Clientes ALHAN</span>
            </button>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA</span>
              {onExitHiddenAdmin && (
                <button
                  type="button"
                  onClick={onExitHiddenAdmin}
                  className="text-slate-400 hover:text-white underline"
                >
                  Voltar ao Site Público
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner with Official ALHAN Logo & Hidden Link Quick Actions */}
      <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <img
            src={ALHAN_OFFICIAL_LOGO_URL}
            alt="ALHAN Logo"
            className="h-12 w-auto rounded-lg bg-white px-2.5 py-1 object-contain shrink-0"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold uppercase">
                PAINEL ADM OCULTO · CONTROLO PÓS-VENDA
              </span>
              <span className="text-xs font-mono text-sky-400">
                ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight font-display">
              Gestão Central de Clientes ALHAN FACTURA, Licenças e Pagamentos MCX ({MCX_EXPRESS_OFFICIAL_NUMBER})
            </h2>
            <p className="text-xs text-slate-300">
              Link Oculto Directo:{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                {hiddenAdminPrimaryLink}
              </code>{' '}
              · Utilizador ADM: <strong className="font-mono text-sky-300">{adminCreds.username}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddClientModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Cliente ALHAN</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleCopyText(
                hiddenAdminPrimaryLink,
                `Link oculto do Painel ADM copiado: ${hiddenAdminPrimaryLink}`
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
            title="Copiar Link Oculto do Painel ADM"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" />
            <span>Copiar Link ADM</span>
          </button>

          {onMasterLogout && (
            <button
              type="button"
              onClick={onMasterLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white text-xs font-semibold border border-red-500/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Bloquear / Sair ADM</span>
            </button>
          )}
        </div>
      </div>

      {copiedBanner && (
        <div className="p-3.5 rounded-xl bg-sky-950 text-sky-200 border border-sky-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{copiedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setCopiedBanner(null)}
            className="text-sky-400 hover:text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {validationFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{validationFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationFeedback(null)}
            className="text-xs underline"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg overflow-x-auto">
        {[
          {
            id: 'empresas',
            label: `Clientes ALHAN & Licenças (${companies.length})`,
            icon: Building2,
          },
          {
            id: 'pagamentos_mcx',
            label: `Pagamentos MCX (${pendingPayments.length} Pendentes)`,
            icon: CreditCard,
          },
          {
            id: 'financeiro_alhan',
            label: 'Painel Financeiro da ALHAN',
            icon: BarChart3,
          },
          { id: 'planos', label: 'Planos & Preços (AOA)', icon: Sliders },
          { id: 'suporte', label: `Suporte Clientes (${tickets.length})`, icon: MessageSquare },
          { id: 'comunicados', label: 'Comunicados Globais', icon: Megaphone },
          { id: 'seguranca', label: 'Link Oculto, User/Senha ADM & Auditoria', icon: Shield },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CONTROLO DE TODOS OS CLIENTES DA ALHAN PÓS-AQUISIÇÃO */}
      {subTab === 'empresas' && (
        <div className="space-y-4">
          {/* Quick KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Total Clientes ALHAN</p>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {companies.length}
              </p>
              <p className="text-[11px] text-slate-400">Empresas que adquiriram o sistema</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Licenças Activas</p>
              <p className="text-2xl font-bold font-mono text-emerald-600 mt-0.5">
                {activeCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400">Em pleno funcionamento</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Aguardam Activação / Pendentes</p>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                {pendingCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400">Para validar pagamento MCX</p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Suspensas / Expiradas</p>
              <p className="text-2xl font-bold font-mono text-red-600 mt-0.5">
                {suspendedCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400">Acesso bloqueado por vencimento</p>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Pesquisar cliente por Empresa, NIF, Telefone, E-mail ou Responsável..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 pl-9 pr-3 py-2 bg-transparent text-slate-900 dark:text-white focus:border-sky-600 focus:outline-none"
                />
              </div>

              <select
                value={clientStatusFilter}
                onChange={(e) => setClientStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="todos">Todos os Estados</option>
                <option value="activa">Licença Activa</option>
                <option value="pendente">Pendente</option>
                <option value="suspensa">Suspensa / Bloqueada</option>
                <option value="vencida">Vencida</option>
              </select>

              <select
                value={clientPlanFilter}
                onChange={(e) => setClientPlanFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="todos">Todos os Planos</option>
                <option value="starter">Plano Starter / Básico</option>
                <option value="profissional">Plano Profissional</option>
                <option value="empresarial">Plano Empresarial</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAlhanFinanceExcel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Lista (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddClientModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Cliente ALHAN</span>
              </button>
            </div>
          </div>

          {/* Complete Client Table */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Controlo Geral de Empresas Clientes da ALHAN ({filteredCompanies.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Active ou suspenda licenças, altere planos, renove prazos (+30d / +1 ano), envie credenciais de acesso por WhatsApp/E-mail ou entre na conta do cliente para suporte.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cliente / Empresa & Responsável</th>
                    <th className="py-3 px-4">NIF & Província</th>
                    <th className="py-3 px-4">Plano & Ciclo</th>
                    <th className="py-3 px-4">Vigência / Validade</th>
                    <th className="py-3 px-4">Estado da Licença</th>
                    <th className="py-3 px-4">Credenciais do Cliente</th>
                    <th className="py-3 px-4 text-right">Controlo Administrativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum cliente encontrado com os filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((c) => {
                      const diasRestantes = calcularDiasParaVencimento(c.subscriptionEndDate);
                      const clientPassword = getClientAccessPassword(c.id, c.nif);
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 align-top"
                        >
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                            <p className="text-slate-500 text-[11px]">
                              Resp.: <strong>{c.responsibleName}</strong>
                            </p>
                            <p className="text-slate-500 text-[11px] font-mono">
                              {c.email} · {c.phone}
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-slate-900 dark:text-white">
                              {c.nif}
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              {c.province} ({c.taxRegime})
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <select
                                value={c.planId}
                                onChange={(e) =>
                                  onUpdateCompanyDetails?.(c.id, {
                                    planId: e.target.value as PlanIdType,
                                  })
                                }
                                className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] font-mono font-bold uppercase bg-white dark:bg-slate-800"
                              >
                                <option value="starter">STARTER / BÁSICO</option>
                                <option value="profissional">PROFISSIONAL</option>
                                <option value="empresarial">EMPRESARIAL</option>
                              </select>
                              <select
                                value={c.billingCycle}
                                onChange={(e) =>
                                  onUpdateCompanyDetails?.(c.id, {
                                    billingCycle: e.target.value as BillingCycleType,
                                  })
                                }
                                className="block rounded border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                              >
                                <option value="mensal">Mensal</option>
                                <option value="trimestral">Trimestral</option>
                                <option value="semestral">Semestral</option>
                                <option value="anual">Anual</option>
                              </select>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <p>Início: {c.subscriptionStartDate || getLuandaIsoDate()}</p>
                            <p className="font-bold text-slate-900 dark:text-white">
                              Vence: {c.subscriptionEndDate || 'Activa'}
                            </p>
                            {diasRestantes !== null && (
                              <span
                                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  diasRestantes <= 0
                                    ? 'bg-red-100 text-red-800'
                                    : diasRestantes <= 7
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {diasRestantes <= 0
                                  ? `Expirada (${Math.abs(diasRestantes)}d)`
                                  : `${diasRestantes} dia(s) restantes`}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase ${
                                c.subscriptionStatus === 'activa'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.subscriptionStatus === 'suspensa'
                                  ? 'bg-red-100 text-red-800'
                                  : c.subscriptionStatus === 'vencida'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.subscriptionStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
                              <p className="truncate max-w-[160px]" title={c.email}>
                                <span className="text-slate-400">User:</span> {c.email}
                              </p>
                              <p>
                                <span className="text-slate-400">Senha:</span>{' '}
                                <strong className="text-sky-700 dark:text-sky-400">
                                  {clientPassword}
                                </strong>
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClientForAccess(c);
                                  setCustomClientPassInput(clientPassword);
                                }}
                                className="text-[10px] font-sans font-semibold text-sky-600 hover:underline flex items-center gap-1 pt-0.5"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Gerir / Enviar Acesso</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[280px] ml-auto">
                              {c.subscriptionStatus !== 'activa' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateCompanyStatus(c, 'activa')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                                >
                                  Activar Licença
                                </button>
                              )}
                              {c.subscriptionStatus !== 'suspensa' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateCompanyStatus(c, 'suspensa')}
                                  className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px]"
                                >
                                  Suspender
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRenewClientLicense(c, 30)}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white font-semibold text-[11px] flex items-center gap-1"
                                title="Renovar por mais 30 dias"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>+30d</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRenewClientLicense(c, 365)}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white font-semibold text-[11px]"
                                title="Renovar por mais 1 Ano (365 dias)"
                              >
                                +1 Ano
                              </button>

                              {onInspectClientCompany && (
                                <button
                                  type="button"
                                  onClick={() => onInspectClientCompany(c)}
                                  className="px-2.5 py-1 rounded bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 text-white font-semibold text-[11px] flex items-center gap-1"
                                  title="Entrar no sistema de facturação deste cliente em modo suporte"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Entrar na Conta</span>
                                </button>
                              )}

                              {onDeleteClientCompany && companies.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteClientCompany(c.id)}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  title="Remover registo de cliente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO 3 – PAINEL FINANCEIRO DA ALHAN */}
      {subTab === 'financeiro_alhan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-mono font-bold text-sky-600">
                MÓDULO 3 · PAINEL FINANCEIRO EXCLUSIVO DA ADMINISTRAÇÃO ALHAN
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Receitas de Subscrição, Estado das Empresas e Canal Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER})
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAlhanFinancePdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Painel Financeiro (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleExportAlhanFinanceExcel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Clientes & Subscrições (Excel)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">1. Total de Subscrições</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {totalSubscriptions}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Contas empresariais na plataforma</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">2. Empresas Activas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {activeCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Com subscrição válida em vigor</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">3. Empresas Pendentes</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                {pendingCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Aguardam validação de pagamento</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">4. Empresas Suspensas / Vencidas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
                {suspendedCompaniesCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Subscrição expirada ou suspensa</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">5. Receita Diária ALHAN</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-1">
                {formatKz(dailyRevenueKz)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Média diária de subscrições (AOA)</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">6. Receita Mensal ALHAN</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {formatKz(monthlyRevenueKz)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Receita mensal recorrente (MRR)</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">7. Receita Anual ALHAN</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatKz(annualRevenueKz)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Receita anual contratada (ARR)</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">8. Pagamentos Multicaixa Express</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-sky-600 mt-1">
                {subscriptionPayments.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Canal: {MCX_EXPRESS_OFFICIAL_NUMBER} ({MCX_EXPRESS_BENEFICIARY})
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">9. Pagamentos Pendentes</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                {pendingPayments.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Para validação administrativa</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">10. Pagamentos Confirmados</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {confirmedPayments.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Total: {formatKz(confirmedPaymentsVolumeKz)}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">11. Pagamentos Rejeitados</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-red-600 mt-1">
                {rejectedPayments.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Bloqueados ou comprovativo inválido</p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">12. Subscrições Próximas do Vencimento</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-orange-600 mt-1">
                {expiringSoonCompanies.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Avisos automáticos: 7, 3 e 1 dia</p>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Controlo de Vigência e Avisos de Vencimento das Subscrições (7, 3 e 1 Dia antes)
                </h4>
                <p className="text-xs text-slate-500">
                  Volume global facturado pelas empresas clientes: {formatKz(totalPlatformVolumeKz)}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Empresa</th>
                    <th className="py-2.5 px-4">NIF</th>
                    <th className="py-2.5 px-4">Plano & Ciclo</th>
                    <th className="py-2.5 px-4">Data Início</th>
                    <th className="py-2.5 px-4">Data Vencimento</th>
                    <th className="py-2.5 px-4">Dias Restantes</th>
                    <th className="py-2.5 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {companies.map((c) => {
                    const dias = calcularDiasParaVencimento(c.subscriptionEndDate);
                    return (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 font-semibold">{c.name}</td>
                        <td className="py-2.5 px-4 font-mono">{c.nif}</td>
                        <td className="py-2.5 px-4 uppercase font-mono">
                          {c.planId} ({c.billingCycle})
                        </td>
                        <td className="py-2.5 px-4 font-mono">{c.subscriptionStartDate || '—'}</td>
                        <td className="py-2.5 px-4 font-mono">{c.subscriptionEndDate || '—'}</td>
                        <td className="py-2.5 px-4 font-mono font-bold">
                          {dias === null ? 'Activa' : `${dias} dia(s)`}
                        </td>
                        <td className="py-2.5 px-4 uppercase font-mono font-bold text-emerald-600">
                          {c.subscriptionStatus}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MÓDULO 2.4 & 2.5 – VALIDAÇÃO ADMINISTRATIVA DE PAGAMENTOS MULTICAIXA EXPRESS */}
      {subTab === 'pagamentos_mcx' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Validação Administrativa de Pagamentos Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER} — {MCX_EXPRESS_BENEFICIARY})
              </h3>
              <p className="text-slate-500">
                Ao confirmar um pagamento, o sistema activa automaticamente o plano contratado, actualiza as datas de vigência, emite o recibo oficial e prepara a confirmação por e-mail.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Pedido / Empresa</th>
                    <th className="py-3 px-4">Plano & Período</th>
                    <th className="py-3 px-4">Ref. Transacção MCX</th>
                    <th className="py-3 px-4 text-right">Valor (AOA)</th>
                    <th className="py-3 px-4">Comprovativo</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Observações Admin</th>
                    <th className="py-3 px-4 text-right">Decisão Administrativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {subscriptionPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum pagamento Multicaixa Express registado ainda.
                      </td>
                    </tr>
                  ) : (
                    subscriptionPayments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-slate-900 dark:text-white">
                            {pay.orderReference}
                          </p>
                          <p className="text-slate-500">
                            {pay.companyName} (NIF: {pay.companyNif})
                          </p>
                        </td>
                        <td className="py-3 px-4 uppercase font-mono">
                          {pay.planId} ({pay.billingCycle})
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-sky-700 dark:text-sky-400">
                          {pay.transactionReference}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {formatKz(pay.amountKz)}
                        </td>
                        <td className="py-3 px-4">
                          {pay.proofDataUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewProofPayment(pay)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Talão</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">{pay.proofFileName || 'Sem anexo'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={paymentNotes[pay.id] ?? pay.adminNotes}
                            onChange={(e) =>
                              setPaymentNotes({ ...paymentNotes, [pay.id]: e.target.value })
                            }
                            placeholder="Registar observação..."
                            className="w-44 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs bg-transparent"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdminPaymentAction(pay, 'confirmado')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                              title="Confirmar pagamento e activar subscrição"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirmar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminPaymentAction(pay, 'novo_comprovativo')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                              title="Solicitar novo comprovativo"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              <span>Novo Talão</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminPaymentAction(pay, 'rejeitado')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
                              title="Rejeitar pagamento"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeitar</span>
                            </button>
                            {pay.status === 'confirmado' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => exportarReciboSubscricaoPDF(pay)}
                                  className="px-2 py-1 rounded bg-slate-900 text-white font-semibold"
                                  title="Emitir Recibo PDF"
                                >
                                  Recibo PDF
                                </button>
                                <a
                                  href={`mailto:?subject=${encodeURIComponent(
                                    `Confirmação de Subscrição ALHAN FACTURA - ${pay.orderReference}`
                                  )}&body=${encodeURIComponent(
                                    `Exmo(a). Cliente ${pay.companyName},\n\nConfirmamos a recepção do seu pagamento Multicaixa Express (927 496 287 - ALHAN) no valor de ${formatKz(
                                      pay.amountKz
                                    )} (Ref. ${pay.transactionReference}).\nO plano ${pay.planId.toUpperCase()} (${pay.billingCycle}) encontra-se ACTIVO.\nRecibo N.º: ${
                                      pay.receiptNumber || pay.orderReference
                                    }\n\nALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA\nTel: 922 021 211 | facturao@alhan.pro`
                                  )}`}
                                  className="p-1.5 rounded bg-sky-100 text-sky-800 hover:bg-sky-200"
                                  title="Enviar confirmação por e-mail"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {previewProofPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
              <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 space-y-4 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-sm font-bold">
                    Comprovativo Multicaixa Express — {previewProofPayment.orderReference}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPreviewProofPayment(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Fechar
                  </button>
                </div>
                <div className="text-xs space-y-1">
                  <p>
                    <strong>Empresa:</strong> {previewProofPayment.companyName} (NIF:{' '}
                    {previewProofPayment.companyNif})
                  </p>
                  <p>
                    <strong>Ref. Transacção MCX:</strong>{' '}
                    <span className="font-mono font-bold">
                      {previewProofPayment.transactionReference}
                    </span>
                  </p>
                  <p>
                    <strong>Valor:</strong> {formatKz(previewProofPayment.amountKz)}
                  </p>
                </div>
                {previewProofPayment.proofDataUrl.startsWith('data:image/') ? (
                  <img
                    src={previewProofPayment.proofDataUrl}
                    alt="Comprovativo MCX"
                    className="w-full max-h-80 object-contain rounded border border-slate-200 bg-slate-50 p-2"
                  />
                ) : (
                  <div className="p-4 rounded bg-slate-100 text-xs font-mono">
                    Ficheiro anexado: {previewProofPayment.proofFileName}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'planos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                <p className="text-xs text-slate-500">{plan.audience}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preço Mensal Base (Kwanzas / AOA)
                </label>
                <input
                  type="number"
                  step={500}
                  value={plan.monthlyPriceKz}
                  onChange={(e) => handlePriceChange(plan.id, Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white bg-transparent"
                />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>
                  • Trimestral (-5%):{' '}
                  <strong className="font-mono">
                    {formatKz(Math.round(plan.monthlyPriceKz * 3 * 0.95))}
                  </strong>
                </p>
                <p>
                  • Semestral (-10%):{' '}
                  <strong className="font-mono">
                    {formatKz(Math.round(plan.monthlyPriceKz * 6 * 0.9))}
                  </strong>
                </p>
                <p>
                  • Anual (-20%):{' '}
                  <strong className="font-mono">
                    {formatKz(Math.round(plan.monthlyPriceKz * 12 * 0.8))}
                  </strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'suporte' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
              Nenhum chamado de suporte aberto de momento.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {t.subject}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-600 dark:text-slate-300">{t.companyName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono uppercase text-amber-600">
                      Prioridade: {t.priority}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-400">
                      Estado: {t.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
                  {t.description}
                </p>
                {t.adminResponse && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                    <strong>Resposta Oficial ALHAN:</strong> {t.adminResponse}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={ticketResponses[t.id] || ''}
                    onChange={(e) =>
                      setTicketResponses({ ...ticketResponses, [t.id]: e.target.value })
                    }
                    placeholder="Escrever resposta técnica oficial da ALHAN..."
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
                  />
                  <button
                    onClick={() =>
                      onRespondTicket(
                        t,
                        ticketResponses[t.id] ||
                          'Recebido pelo Suporte Técnico ALHAN (922 021 211). Situação verificada e resolvida.',
                        'respondido'
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold whitespace-nowrap shrink-0"
                  >
                    Enviar Resposta
                  </button>
                  <button
                    onClick={() =>
                      onRespondTicket(
                        t,
                        t.adminResponse || 'Chamado concluído pelo suporte ALHAN.',
                        'fechado'
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold whitespace-nowrap shrink-0"
                  >
                    Encerrar Chamado
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'comunicados' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Enviar Comunicado Global / Actualização de Legislação Fiscal às Empresas Clientes
          </h3>
          {broadcastSent && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Comunicado transmitido com sucesso para todas as empresas activas!</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título do Comunicado
            </label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mensagem / Instrução Regulatória
            </label>
            <textarea
              rows={3}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-transparent"
            />
          </div>
          <button
            onClick={() => {
              onBroadcastNotice(broadcastTitle, broadcastBody);
              setBroadcastSent(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            Publicar Comunicado na Plataforma
          </button>
        </div>
      )}

      {/* TAB 7: LINK OCULTO ADM, CREDENCIAIS USER/SENHA & AUDITORIA */}
      {subTab === 'seguranca' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Hidden Link Card */}
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Links Ocultos do Painel ADM ALHAN (Exclusivos da Administração)
                </h3>
              </div>
              <p className="text-slate-500">
                Este painel está 100% oculto do site público e da área de trabalho dos clientes. Guarde os links abaixo nos seus favoritos:
              </p>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    1. Link Privado Principal do Painel ADM (Produção):
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sky-700 dark:text-sky-400 break-all">
                      {hostingerHiddenLink}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          hostingerHiddenLink,
                          `Link Privado copiado: ${hostingerHiddenLink}`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    2. Link Privado Alternativo Universal (Parâmetro Directo):
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sky-700 dark:text-sky-400 break-all">
                      {hostingerQueryLink}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          hostingerQueryLink,
                          `Link Alternativo copiado: ${hostingerQueryLink}`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    3. Link no Ambiente Actual:
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
                      {localEnvHiddenLink}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          localEnvHiddenLink,
                          `Link copiado: ${localEnvHiddenLink}`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin User & Password Management Card */}
            <form
              onSubmit={handleSaveAdminCredentials}
              className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Credenciais Master do Painel ADM (User & Senha)
                </h3>
              </div>
              <p className="text-slate-500">
                Credenciais exclusivas para abrir o Painel ADM oculto. Pode personalizar o utilizador e a senha abaixo:
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Utilizador (User / E-mail ADM)
                </label>
                <input
                  type="text"
                  required
                  value={newAdminUser}
                  onChange={(e) => setNewAdminUser(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Senha (Palavra-passe ADM)
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassConfig ? 'text' : 'password'}
                    required
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 pr-10 font-mono text-slate-900 dark:text-white bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassConfig(!showAdminPassConfig)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showAdminPassConfig ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
              >
                Guardar Credenciais ADM
              </button>
            </form>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Registo Central de Auditoria Criptográfica & Segurança (Append-Only)
                </h3>
                <p className="text-xs text-slate-500">
                  Todos os eventos críticos são gravados de forma imutável sem possibilidade de eliminação.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span>Política de Retenção Fiscal: 10 Anos</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Data / Hora (Luanda)</th>
                    <th className="py-2.5 px-4">Utilizador</th>
                    <th className="py-2.5 px-4">Perfil</th>
                    <th className="py-2.5 px-4">Módulo</th>
                    <th className="py-2.5 px-4">Operação</th>
                    <th className="py-2.5 px-4">Ref. Alvo</th>
                    <th className="py-2.5 px-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-4 font-mono whitespace-nowrap">
                        {formatLuandaDateTime()}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{log.actorEmail}</td>
                      <td className="py-2.5 px-4">{log.actorRole}</td>
                      <td className="py-2.5 px-4 font-semibold">{log.module}</td>
                      <td className="py-2.5 px-4 text-sky-700 dark:text-sky-400 font-medium">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{log.targetRef}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR NOVO CLIENTE ALHAN PÓS-VENDA */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold">
                  Cadastrar Novo Cliente ALHAN FACTURA (Licença Pós-Aquisição)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Regista a empresa cliente, activa o plano escolhido e cria o Utilizador e Senha de acesso ao sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClientModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClientSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold mb-1">Denominação Social da Empresa *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    placeholder="Ex.: Grupo Comercial Benguela, Lda."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">NIF da Empresa *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.nif}
                    onChange={(e) => setNewClientForm({ ...newClientForm, nif: e.target.value })}
                    placeholder="Ex.: 5403991827"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Responsável / Director *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.responsibleName}
                    onChange={(e) =>
                      setNewClientForm({ ...newClientForm, responsibleName: e.target.value })
                    }
                    placeholder="Ex.: Dr. António Mateus"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    placeholder="+244 923 000 000"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    E-mail Corporativo (Utilizador de Login) *
                  </label>
                  <input
                    type="email"
                    required
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    placeholder="geral@empresacliente.ao"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Senha Inicial do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientForm.clientPassword}
                    onChange={(e) =>
                      setNewClientForm({ ...newClientForm, clientPassword: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono font-bold text-sky-700 dark:text-sky-400 bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Plano Adquirido *</label>
                  <select
                    value={newClientForm.planId}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        planId: e.target.value as PlanIdType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 font-semibold"
                  >
                    <option value="starter">Plano Starter / Básico</option>
                    <option value="profissional">Plano Profissional</option>
                    <option value="empresarial">Plano Empresarial</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Ciclo de Subscrição *</label>
                  <select
                    value={newClientForm.billingCycle}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        billingCycle: e.target.value as BillingCycleType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 font-semibold"
                  >
                    <option value="mensal">Mensal (30 Dias)</option>
                    <option value="trimestral">Trimestral (90 Dias)</option>
                    <option value="semestral">Semestral (180 Dias)</option>
                    <option value="anual">Anual (365 Dias)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Valor Pago (Kwanzas / AOA)</label>
                  <input
                    type="number"
                    value={newClientForm.paidAmountKz}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        paidAmountKz: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Estado Inicial da Licença</label>
                  <select
                    value={newClientForm.subscriptionStatus}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        subscriptionStatus: e.target.value as SubscriptionStatusType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 font-semibold"
                  >
                    <option value="activa">ACTIVA (Liberar Acesso Imediato)</option>
                    <option value="pendente">PENDENTE (Aguardar Pagamento)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Activar & Guardar Cliente ALHAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GERIR CREDENCIAIS E ENVIAR ACESSO AO CLIENTE */}
      {selectedClientForAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Credenciais do Cliente — {selectedClientForAccess.name}
                </h4>
                <p className="text-[11px] text-slate-500">NIF: {selectedClientForAccess.nif}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientForAccess(null)}
                className="text-slate-400 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2 font-mono">
              <p>
                <span className="text-slate-400">Link do Sistema:</span>{' '}
                <strong>https://factura.alhan.pro/</strong>
              </p>
              <p>
                <span className="text-slate-400">Utilizador (E-mail ou NIF):</span>{' '}
                <strong>{selectedClientForAccess.email}</strong> (ou{' '}
                <strong>{selectedClientForAccess.nif}</strong>)
              </p>
              <div>
                <label className="block text-slate-500 font-sans font-semibold mb-1">
                  Definir / Alterar Senha do Cliente:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customClientPassInput}
                    onChange={(e) => setCustomClientPassInput(e.target.value)}
                    className="flex-1 rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      saveClientAccessPassword(
                        selectedClientForAccess.id,
                        customClientPassInput.trim() || 'Alhan2026!'
                      );
                      setValidationFeedback(
                        `Senha do cliente ${selectedClientForAccess.name} actualizada para: ${customClientPassInput}`
                      );
                    }}
                    className="px-3 py-1.5 rounded bg-sky-600 text-white font-sans font-bold"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={`https://wa.me/${selectedClientForAccess.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Olá ${selectedClientForAccess.responsibleName} (${selectedClientForAccess.name}),\n\nA sua licença do software *ALHAN FACTURA* (Plano ${selectedClientForAccess.planId.toUpperCase()} - ${selectedClientForAccess.billingCycle.toUpperCase()}) está *${selectedClientForAccess.subscriptionStatus.toUpperCase()}*!\n\n🔗 *Link de Acesso:* https://factura.alhan.pro/\n👤 *Utilizador:* ${selectedClientForAccess.email} (ou NIF ${selectedClientForAccess.nif})\n🔑 *Senha:* ${customClientPassInput}\n📅 *Validade:* ${selectedClientForAccess.subscriptionEndDate || 'Activa'}\n\nSuporte Técnico ALHAN: +244 922 021 211 | facturao@alhan.pro`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-center"
              >
                Enviar por WhatsApp
              </a>
              <a
                href={`mailto:${selectedClientForAccess.email}?subject=${encodeURIComponent(
                  `Dados de Acesso ALHAN FACTURA — ${selectedClientForAccess.name}`
                )}&body=${encodeURIComponent(
                  `Exmo(a). ${selectedClientForAccess.responsibleName},\nEmpresa: ${selectedClientForAccess.name} (NIF: ${selectedClientForAccess.nif})\n\nA sua subscrição do software de facturação electrónica ALHAN FACTURA encontra-se ${selectedClientForAccess.subscriptionStatus.toUpperCase()}.\n\nLink de Acesso: https://factura.alhan.pro/\nUtilizador: ${selectedClientForAccess.email} (ou NIF ${selectedClientForAccess.nif})\nPalavra-passe: ${customClientPassInput}\nPlano: ${selectedClientForAccess.planId.toUpperCase()} (${selectedClientForAccess.billingCycle.toUpperCase()})\nValidade: ${selectedClientForAccess.subscriptionEndDate || 'Activa'}\n\nALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA\nTel: +244 922 021 211 | facturao@alhan.pro`
                )}`}
                className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-center"
              >
                Enviar por E-mail
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
