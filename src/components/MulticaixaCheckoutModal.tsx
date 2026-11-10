import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileUp,
  Lock,
  Phone,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import {
  BillingCycleType,
  Company,
  PlanIdType,
  SubscriptionPayment,
  SubscriptionPlanConfig,
} from '../types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  calcularPrecoCiclo,
  comprimirImagemParaBase64,
  formatKz,
  getLuandaIsoDate,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
} from '../lib/angolaUtils';

interface MulticaixaCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  plans: SubscriptionPlanConfig[];
  existingPayments: SubscriptionPayment[];
  initialPlanId?: PlanIdType;
  initialCycle?: BillingCycleType;
  onSubmitSubscriptionPayment: (
    paymentData: Omit<SubscriptionPayment, 'id' | 'ownerId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const MulticaixaCheckoutModal: React.FC<MulticaixaCheckoutModalProps> = ({
  isOpen,
  onClose,
  company,
  plans,
  existingPayments,
  initialPlanId,
  initialCycle,
  onSubmitSubscriptionPayment,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanIdType>(
    initialPlanId || company.planId || 'profissional'
  );
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleType>(
    initialCycle || company.billingCycle || 'mensal'
  );
  const [modality, setModality] = useState<'automatico_emis' | 'confirmacao_administrativa'>(
    'confirmacao_administrativa'
  );
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedOrderRef, setCopiedOrderRef] = useState(false);

  const [customerPhone, setCustomerPhone] = useState(company.phone || '923 000 000');
  const [transactionReference, setTransactionReference] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [gatewayResponse, setGatewayResponse] = useState<{
    gatewayConfigured: boolean;
    message: string;
    orderReference: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<string | null>(null);

  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) || plans[1] || plans[0];

  const amountKz = calcularPrecoCiclo(selectedPlan.monthlyPriceKz, selectedCycle);

  const orderReference = useMemo(() => {
    const cleanNif = (company.nif || '5000').slice(-4);
    const stamp = String(Date.now()).slice(-5);
    return `ALH-${cleanNif}-${stamp}`;
  }, [company.nif, selectedPlanId, selectedCycle]);

  const paymentDeadline = useMemo(() => {
    const base = new Date(`${getLuandaIsoDate()}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + 2);
    return base.toISOString().slice(0, 10);
  }, []);

  if (!isOpen) return null;

  const handleCopyMcxNumber = () => {
    navigator.clipboard?.writeText(MCX_EXPRESS_OFFICIAL_NUMBER.replace(/\s+/g, ''));
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleCopyOrderRef = () => {
    navigator.clipboard?.writeText(orderReference);
    setCopiedOrderRef(true);
    setTimeout(() => setCopiedOrderRef(false), 2500);
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setErrorMsg(null);
    try {
      const compressed = await comprimirImagemParaBase64(file, 480, 38000);
      setProofFileName(file.name.slice(0, 180));
      setProofDataUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao anexar comprovativo.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleInitiateEmisGateway = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/mcx/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          planId: selectedPlanId,
          billingCycle: selectedCycle,
          amountKz,
          customerPhone,
          orderReference,
        }),
      });
      const data = await res.json();
      setGatewayResponse({
        gatewayConfigured: Boolean(data.gatewayConfigured),
        message: String(
          data.message ||
            'Pedido Multicaixa Express iniciado. Verifique a notificação no seu telemóvel ou utilize a Confirmação Administrativa.'
        ),
        orderReference: String(data.orderReference || orderReference),
      });
      if (!data.gatewayConfigured) {
        setModality('confirmacao_administrativa');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao iniciar pagamento Multicaixa Express.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPaymentValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmittedSuccess(null);

    const cleanTxRef = transactionReference.trim().toUpperCase();
    if (!cleanTxRef || cleanTxRef.length < 4) {
      setErrorMsg(
        'Por favor, introduza o Número de Operação / Referência da Transacção Multicaixa Express (mínimo 4 caracteres).'
      );
      return;
    }

    // Duplicate reference protection (Section 2.6)
    const isDuplicateRef = existingPayments.some(
      (p) =>
        p.transactionReference &&
        p.transactionReference.trim().toUpperCase() === cleanTxRef &&
        p.status !== 'rejeitado'
    );
    if (isDuplicateRef) {
      setErrorMsg(
        `Protecção Anti-Duplicação: A referência de transacção Multicaixa Express "${cleanTxRef}" já foi submetida anteriormente.`
      );
      return;
    }

    if (!proofFileName || !proofDataUrl) {
      setErrorMsg(
        'Por favor, anexe o comprovativo de pagamento Multicaixa Express (imagem/captura do talão) para validação administrativa.'
      );
      return;
    }

    const numericPaid = Number(paidAmountInput) || amountKz;
    if (numericPaid < amountKz) {
      setErrorMsg(
        `O valor informado (${formatKz(numericPaid)}) é inferior ao valor do plano seleccionado (${formatKz(amountKz)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitSubscriptionPayment({
        companyName: company.name,
        companyNif: company.nif,
        planId: selectedPlanId,
        billingCycle: selectedCycle,
        amountKz,
        mcxChannelNumber: MCX_EXPRESS_OFFICIAL_NUMBER,
        beneficiaryName: MCX_EXPRESS_BENEFICIARY,
        orderReference,
        transactionReference: cleanTxRef.slice(0, 120),
        paymentModality: modality,
        proofFileName: proofFileName.slice(0, 180),
        proofDataUrl,
        paymentDeadline,
        status: 'pendente',
        adminNotes:
          'Aguarda validação pela Administração Central ALHAN. Nenhuma subscrição é activada sem confirmação oficial.',
        receiptNumber: '',
      });

      setSubmittedSuccess(
        `Pedido de pagamento ${orderReference} registado com estado PENDENTE. Após verificação do comprovativo Multicaixa Express (${MCX_EXPRESS_OFFICIAL_NUMBER} — ${MCX_EXPRESS_BENEFICIARY}), a administração ALHAN activará o plano e emitirá o recibo oficial.`
      );
      setTransactionReference('');
      setProofFileName('');
      setProofDataUrl('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao submeter pagamento para validação.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Top Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={ALHAN_OFFICIAL_LOGO_URL}
              alt="ALHAN"
              className="h-9 w-auto rounded bg-white px-2 py-0.5 object-contain"
            />
            <div>
              <span className="text-[11px] font-mono font-semibold text-amber-400 block">
                MÓDULO 2 · CANAL OFICIAL DE SUBSCRIÇÕES MULTICAIXA EXPRESS
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight font-display">
                Pagamento de Subscrição ALHAN FACTURA
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs max-h-[82vh] overflow-y-auto">
          {/* Mandatory Official Payment Summary Card (Section 2.1 & 2.2) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 rounded-xl bg-slate-950 text-white border border-slate-800">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-sky-400">
                  DADOS OFICIAIS DO PEDIDO DE SUBSCRIÇÃO
                </span>
                <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[11px] font-bold">
                  Ref. Pedido: {orderReference}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Empresa Subscritora</p>
                  <p className="font-bold text-white text-xs truncate mt-0.5">{company.name}</p>
                  <p className="font-mono text-[11px] text-slate-400">NIF: {company.nif}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Data Limite do Pagamento</p>
                  <p className="font-bold font-mono text-amber-300 text-xs mt-0.5">
                    {paymentDeadline} (Fuso Africa/Luanda)
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyOrderRef}
                    className="text-[11px] text-sky-400 hover:text-sky-300 underline mt-0.5 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedOrderRef ? 'Referência copiada!' : 'Copiar Ref. do Pedido'}
                  </button>
                </div>
              </div>

              {/* Plan & Period Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Plano Seleccionado
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => {
                      setSelectedPlanId(e.target.value as PlanIdType);
                      setPaidAmountInput('');
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-semibold"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatKz(p.monthlyPriceKz)}/mês)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Período da Subscrição
                  </label>
                  <select
                    value={selectedCycle}
                    onChange={(e) => {
                      setSelectedCycle(e.target.value as BillingCycleType);
                      setPaidAmountInput('');
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-semibold"
                  >
                    <option value="mensal">Mensal (1 Mês)</option>
                    <option value="trimestral">Trimestral (3 Meses · 5% Desc.)</option>
                    <option value="semestral">Semestral (6 Meses · 10% Desc.)</option>
                    <option value="anual">Anual (12 Meses · 20% Desc.)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Official Multicaixa Express 927 496 287 Box */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 border border-sky-500/40 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    CANAL: MULTICAIXA EXPRESS
                  </span>
                  <Smartphone className="w-4 h-4 text-sky-400" />
                </div>

                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-400">Número Multicaixa Express Oficial:</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl font-bold font-mono tracking-wider text-white">
                      {MCX_EXPRESS_OFFICIAL_NUMBER}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyMcxNumber}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] transition-colors"
                    >
                      {copiedNumber ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Número</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 pt-1">
                    Beneficiário / Nome Comercial:{' '}
                    <strong className="text-amber-300 font-mono">{MCX_EXPRESS_BENEFICIARY}</strong>
                  </p>
                </div>

                <div className="pt-1">
                  <p className="text-[11px] text-slate-400">Valor Total a Pagar em Kwanzas:</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400">
                    {formatKz(amountKz)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleInitiateEmisGateway}
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <CreditCard className="w-4 h-4" />
                <span>PAGAR COM MULTICAIXA EXPRESS</span>
              </button>
            </div>
          </div>

          {gatewayResponse && (
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 space-y-1">
              <p className="font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>Resposta do Canal Multicaixa Express ({gatewayResponse.orderReference})</span>
              </p>
              <p>{gatewayResponse.message}</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {submittedSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Comprovativo Submetido com Estado PENDENTE</span>
              </div>
              <p>{submittedSuccess}</p>
            </div>
          )}

          {/* Section 2.3: Modalidade A vs Modalidade B Tabs */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Modalidades de Funcionamento (Secção 2.3)
                </h3>
                <p className="text-slate-500">
                  Seleccione entre Pagamento Automático via Gateway ou Submissão de Comprovativo para Confirmação Administrativa.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModality('confirmacao_administrativa')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    modality === 'confirmacao_administrativa'
                      ? 'bg-slate-900 dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Modalidade B — Confirmação Administrativa (Activa)
                </button>
                <button
                  type="button"
                  onClick={() => setModality('automatico_emis')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    modality === 'automatico_emis'
                      ? 'bg-slate-900 dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Modalidade A — Gateway Automático EMIS
                </button>
              </div>
            </div>

            {modality === 'automatico_emis' ? (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Modalidade A — Pagamento Automático via Gateway EMIS / Multicaixa Express
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    Introduza o telemóvel associado ao seu Multicaixa Express para receber o pedido de autorização push, ou clique em <strong>PAGAR COM MULTICAIXA EXPRESS</strong>. O webhook oficial (<code className="font-mono">POST /api/payments/mcx/webhook</code>) valida a assinatura HMAC-SHA256 antes de activar a subscrição.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Telemóvel Multicaixa Express do Cliente
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Referência Única Gerada
                    </label>
                    <input
                      type="text"
                      disabled
                      value={orderReference}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleInitiateEmisGateway}
                    className="py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors"
                  >
                    {submitting ? 'A contactar Gateway...' : 'Iniciar Pedido Automático MCX'}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitPaymentValidation}
                className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Modalidade B — Pagamento por Confirmação Administrativa (927 496 287 · Beneficiário: ALHAN)
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    1. Efectue a transferência ou pagamento no seu aplicativo <strong>Multicaixa Express</strong> para o número <strong>{MCX_EXPRESS_OFFICIAL_NUMBER}</strong> (Beneficiário: <strong>{MCX_EXPRESS_BENEFICIARY}</strong>) no valor de <strong>{formatKz(amountKz)}</strong>.<br />
                    2. Registe abaixo a referência da operação e anexe o comprovativo. O pedido ficará com estado <strong>PENDENTE</strong> até confirmação pela administração da ALHAN.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Valor Pago (Kwanzas AOA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={amountKz}
                      step="0.01"
                      value={paidAmountInput || amountKz}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Referência / ID da Operação MCX *
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="Ex.: MCX928374615"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Anexar Comprovativo (Talão / Imagem) *
                    </label>
                    <label className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-sky-600 bg-sky-50/70 dark:bg-sky-950/30 px-3 py-2 text-sky-800 dark:text-sky-300 font-semibold hover:bg-sky-100 transition-colors">
                      <FileUp className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {uploadingProof
                          ? 'A comprimir...'
                          : proofFileName
                          ? proofFileName
                          : 'Seleccionar Comprovativo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleProofFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {proofDataUrl && proofDataUrl.startsWith('data:image/') && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <img
                      src={proofDataUrl}
                      alt="Pré-visualização do Comprovativo"
                      className="h-16 w-auto rounded border border-slate-300 object-contain"
                    />
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        Comprovativo anexado: {proofFileName}
                      </p>
                      <p className="text-slate-500">
                        Pronto para verificação pela Administração Central ALHAN.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Regra de Segurança Obrigatória (Secção 2.3 & 2.6):</strong> Nenhuma subscrição é activada automaticamente apenas pelo envio de imagem ou declaração do utilizador. O estado inicial será <strong>PENDENTE</strong> até validação oficial da transacção.
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="w-4 h-4 text-sky-600" />
                    <span>
                      Apoio a Subscrições ALHAN: <strong>922 021 211</strong> ·{' '}
                      <strong>facturao@alhan.pro</strong>
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || uploadingProof}
                    className="px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors shadow-sm"
                  >
                    {submitting
                      ? 'A submeter comprovativo...'
                      : 'Submeter Pagamento para Validação (Estado: PENDENTE)'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Protecção contra reutilização de referências e validação RBAC no servidor.
            </span>
            <span>ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
