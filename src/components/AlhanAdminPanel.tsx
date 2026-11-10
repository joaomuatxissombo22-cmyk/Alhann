import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  RefreshCcw,
  Shield,
  Sliders,
  XCircle,
} from 'lucide-react';
import {
  AuditLog,
  Company,
  Invoice,
  SubscriptionPayment,
  SubscriptionPlanConfig,
  SubscriptionStatusType,
  SupportTicket,
} from '../types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
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

interface AlhanAdminPanelProps {
  companies: Company[];
  invoices: Invoice[];
  tickets: SupportTicket[];
  auditLogs: AuditLog[];
  plans: SubscriptionPlanConfig[];
  subscriptionPayments: SubscriptionPayment[];
  onUpdatePlans: (updated: SubscriptionPlanConfig[]) => void;
  onUpdateCompanyStatus: (company: Company, newStatus: SubscriptionStatusType) => Promise<void>;
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
  onValidateSubscriptionPayment,
  onRespondTicket,
  onBroadcastNotice,
}) => {
  const [subTab, setSubTab] = useState<
    | 'financeiro_alhan'
    | 'pagamentos_mcx'
    | 'empresas'
    | 'planos'
    | 'suporte'
    | 'comunicados'
    | 'seguranca'
  >('financeiro_alhan');

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

  // Recurring SaaS revenue from active companies + confirmed Multicaixa Express payments
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

  const handlePriceChange = (planId: string, newPrice: number) => {
    const next = plans.map((p) =>
      p.id === planId ? { ...p, monthlyPriceKz: Math.max(1000, newPrice) } : p
    );
    onUpdatePlans(next);
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
      title: 'PAINEL FINANCEIRO CENTRAL DA ALHAN — SUBSCRIÇÕES E MULTICAIXA EXPRESS',
      company: dummyCompany,
      period: getLuandaIsoDate(),
      headers: [
        'Indicador Financeiro / Subscrições ALHAN',
        'Valor / Quantidade',
        'Canal / Detalhe Oficial',
      ],
      rows: [
        ['Total de Subscrições Registadas', String(totalSubscriptions), 'Empresas Multi-Tenant'],
        ['Empresas Activas', String(activeCompaniesCount), 'Subscrição Regularizada'],
        ['Empresas Pendentes', String(pendingCompaniesCount), 'Aguardam Confirmação'],
        ['Empresas Suspensas / Vencidas', String(suspendedCompaniesCount), 'Bloqueio Administrativo'],
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
        ['Pagamentos Rejeitados', String(rejectedPayments.length), 'Referência Inválida'],
        [
          'Subscrições Próximas do Vencimento (<= 7 dias)',
          String(expiringSoonCompanies.length),
          'Alertas Automáticos 7, 3 e 1 dia',
        ],
      ],
      summaryText: `Canal Oficial Multicaixa Express: ${MCX_EXPRESS_OFFICIAL_NUMBER} (Beneficiário: ${MCX_EXPRESS_BENEFICIARY}) | Receita Mensal: ${formatKz(monthlyRevenueKz)} | Receita Anual: ${formatKz(annualRevenueKz)}`,
    });
  };

  const handleExportAlhanFinanceExcel = () => {
    exportarDadosExcel('Painel_Financeiro_ALHAN', `ALHAN_Financeiro_${getLuandaIsoDate()}`, [
      {
        Indicador: 'Total de Subscrições',
        Quantidade: totalSubscriptions,
        Valor_Kz: 0,
        Canal: 'SaaS ALHAN FACTURA',
      },
      {
        Indicador: 'Empresas Activas',
        Quantidade: activeCompaniesCount,
        Valor_Kz: monthlyRevenueKz,
        Canal: 'Activas',
      },
      {
        Indicador: 'Empresas Pendentes',
        Quantidade: pendingCompaniesCount,
        Valor_Kz: 0,
        Canal: 'Pendentes',
      },
      {
        Indicador: 'Empresas Suspensas',
        Quantidade: suspendedCompaniesCount,
        Valor_Kz: 0,
        Canal: 'Suspensas',
      },
      {
        Indicador: 'Receita Diária (AOA)',
        Quantidade: activeCompaniesCount,
        Valor_Kz: dailyRevenueKz,
        Canal: 'Multicaixa Express 927 496 287',
      },
      {
        Indicador: 'Receita Mensal (AOA)',
        Quantidade: activeCompaniesCount,
        Valor_Kz: monthlyRevenueKz,
        Canal: 'Multicaixa Express 927 496 287',
      },
      {
        Indicador: 'Receita Anual (AOA)',
        Quantidade: activeCompaniesCount,
        Valor_Kz: annualRevenueKz,
        Canal: 'Multicaixa Express 927 496 287',
      },
      {
        Indicador: 'Pagamentos Multicaixa Express (Total)',
        Quantidade: subscriptionPayments.length,
        Valor_Kz: confirmedPaymentsVolumeKz,
        Canal: `${MCX_EXPRESS_OFFICIAL_NUMBER} (${MCX_EXPRESS_BENEFICIARY})`,
      },
      {
        Indicador: 'Pagamentos Pendentes',
        Quantidade: pendingPayments.length,
        Valor_Kz: pendingPayments.reduce((a, b) => a + b.amountKz, 0),
        Canal: 'Aguarda Confirmação Admin',
      },
      {
        Indicador: 'Pagamentos Confirmados',
        Quantidade: confirmedPayments.length,
        Valor_Kz: confirmedPaymentsVolumeKz,
        Canal: 'Confirmados',
      },
      {
        Indicador: 'Pagamentos Rejeitados',
        Quantidade: rejectedPayments.length,
        Valor_Kz: rejectedPayments.reduce((a, b) => a + b.amountKz, 0),
        Canal: 'Rejeitados',
      },
      {
        Indicador: 'Subscrições Próximas do Vencimento',
        Quantidade: expiringSoonCompanies.length,
        Valor_Kz: 0,
        Canal: 'Avisos 7, 3 e 1 dia',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner with Official ALHAN Logo */}
      <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <img
            src={ALHAN_OFFICIAL_LOGO_URL}
            alt="ALHAN Logo"
            className="h-12 w-auto rounded-lg bg-white px-2.5 py-1 object-contain shrink-0"
          />
          <div className="space-y-1">
            <p className="text-xs font-mono text-sky-400">
              PAINEL ADMINISTRATIVO E FINANCEIRO CENTRAL EXCLUSIVO · ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA
            </p>
            <h2 className="text-xl font-bold tracking-tight font-display">
              Governação SaaS, Validação Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER}) e Painel Financeiro ALHAN
            </h2>
            <p className="text-xs text-slate-300">
              Beneficiário Oficial: <strong>{MCX_EXPRESS_BENEFICIARY}</strong> · Apoio: <strong>922 021 211</strong> · <strong>facturao@alhan.pro</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700 shrink-0">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Imutabilidade Fiscal Activa</span>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg overflow-x-auto">
        {[
          {
            id: 'financeiro_alhan',
            label: 'Painel Financeiro da ALHAN (Módulo 3)',
            icon: BarChart3,
          },
          {
            id: 'pagamentos_mcx',
            label: `Pagamentos MCX (${pendingPayments.length} Pendentes)`,
            icon: CreditCard,
          },
          { id: 'empresas', label: 'Empresas & Subscrições', icon: Building2 },
          { id: 'planos', label: 'Planos & Preços (AOA)', icon: Sliders },
          { id: 'suporte', label: 'Atendimento & Suporte', icon: MessageSquare },
          { id: 'comunicados', label: 'Comunicados & Legislação', icon: Megaphone },
          { id: 'seguranca', label: 'Auditoria & Segurança', icon: Shield },
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
                <span>Exportar Painel Financeiro (Excel)</span>
              </button>
            </div>
          </div>

          {/* All 12 Mandatory Financial Indicators Grid */}
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

          {/* Subscriptions Near Expiration Table (7, 3 and 1 day alerts) */}
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

          {validationFeedback && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{validationFeedback}</span>
            </div>
          )}

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
                    <th className="py-3 px-4 text-right">Decisão Administrativa (Secção 2.4)</th>
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

      {subTab === 'empresas' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Empresas Registadas na Plataforma ALHAN FACTURA
              </h3>
              <p className="text-xs text-slate-500">
                Aprovação de registos, activação/suspensão de subscrições e controlo de mensalidades/anuidades.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Empresa / Denominação</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">Província</th>
                  <th className="py-3 px-4">Plano & Ciclo</th>
                  <th className="py-3 px-4">Estado Subscrição</th>
                  <th className="py-3 px-4">Adesão AGT</th>
                  <th className="py-3 px-4 text-right">Acções Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            alt={c.commercialName}
                            className="w-8 h-8 rounded object-contain border border-slate-200 bg-white p-0.5 shrink-0"
                          />
                        ) : null}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                          <p className="text-slate-500">
                            {c.email} · {c.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">{c.nif}</td>
                    <td className="py-3 px-4">{c.province}</td>
                    <td className="py-3 px-4 uppercase font-mono">
                      {c.planId} ({c.billingCycle})
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          c.subscriptionStatus === 'activa'
                            ? 'text-emerald-600'
                            : c.subscriptionStatus === 'suspensa'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {c.subscriptionStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {c.agtAdhesionStatus || 'em_homologacao'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {c.subscriptionStatus !== 'activa' && (
                          <button
                            onClick={() => onUpdateCompanyStatus(c, 'activa')}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            Activar Conta
                          </button>
                        )}
                        {c.subscriptionStatus !== 'suspensa' && (
                          <button
                            onClick={() => onUpdateCompanyStatus(c, 'suspensa')}
                            className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            Enviar Comunicado Global / Actualização de Legislação Fiscal às Empresas
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

      {subTab === 'seguranca' && (
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
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
