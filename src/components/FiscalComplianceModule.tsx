import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  FileCode2,
  KeyRound,
  Play,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  AgtAdhesionStatusType,
  AgtCommunicationLog,
  AgtOfficialServiceName,
  AgtTransmissionStatusType,
  Client,
  Company,
  Invoice,
  Product,
} from '../types/models';
import {
  AGT_STATE_LABELS,
  formatKz,
  formatLuandaDateTime,
  gerarValidarSaftAO,
  getLuandaIsoDate,
  SaftValidationResult,
} from '../lib/angolaUtils';

interface FiscalComplianceModuleProps {
  mode: 'agt' | 'saft';
  company: Company;
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  agtLogs: AgtCommunicationLog[];
  onQueueContingencySync: (invoice: Invoice) => Promise<void>;
  onUpdateInvoiceAgtState: (
    invoice: Invoice,
    newStatus: AgtTransmissionStatusType,
    operationId?: string,
    responseJson?: string
  ) => Promise<void>;
  onRecordAgtLog: (
    logData: Omit<AgtCommunicationLog, 'id' | 'ownerId' | 'companyId' | 'createdAt'>
  ) => Promise<void>;
  onUpdateCompanyConfig?: (updates: Partial<Company>) => Promise<void>;
  onLogAudit: (action: string, module: string, targetRef: string, details: string) => Promise<void>;
}

interface AgtServerStatus {
  portalDocReference: string;
  activeEnvironment: string;
  credentialsConfigured: boolean;
  rsaPrivateKeyConfigured: boolean;
  jwsAlgorithm: string;
  softwareValidationNumber: string;
  softwareProductId: string;
  supportedServices: AgtOfficialServiceName[];
  lastCheckTimestamp: string;
}

const AGT_SERVICES_META: {
  id: AgtOfficialServiceName;
  label: string;
  description: string;
}[] = [
  {
    id: 'registarFactura',
    label: 'registarFactura',
    description: 'Transmissão electrónica de documentos fiscais emitidos com assinatura JWS.',
  },
  {
    id: 'obterEstado',
    label: 'obterEstado',
    description: 'Consulta do estado de validação de uma transmissão pelo ID da operação.',
  },
  {
    id: 'listarFacturas',
    label: 'listarFacturas',
    description: 'Consulta de documentos fiscais emitidos por período e contribuinte.',
  },
  {
    id: 'consultarFactura',
    label: 'consultarFactura',
    description: 'Consulta detalhada de uma factura específica registada na AGT.',
  },
  {
    id: 'solicitarSerie',
    label: 'solicitarSerie',
    description: 'Solicitação oficial de novas séries de facturação por estabelecimento.',
  },
  {
    id: 'listarSeries',
    label: 'listarSeries',
    description: 'Consulta das séries autorizadas e disponíveis para o contribuinte.',
  },
  {
    id: 'validarDocumento',
    label: 'validarDocumento',
    description: 'Validação estrutural e criptográfica de documentos fiscais quando aplicável.',
  },
];

export const FiscalComplianceModule: React.FC<FiscalComplianceModuleProps> = ({
  mode,
  company,
  clients,
  products,
  invoices,
  agtLogs,
  onQueueContingencySync,
  onUpdateInvoiceAgtState,
  onRecordAgtLog,
  onUpdateCompanyConfig,
  onLogAudit,
}) => {
  const [saftType, setSaftType] = useState<'Facturação (F)' | 'Contabilidade (C)' | 'Inventário (I)'>(
    'Facturação (F)'
  );
  const [startDate, setStartDate] = useState(`${getLuandaIsoDate().slice(0, 8)}01`);
  const [endDate, setEndDate] = useState(getLuandaIsoDate());
  const [saftResult, setSaftResult] = useState<SaftValidationResult | null>(null);
  const [saftHistory, setSaftHistory] = useState<
    { fileName: string; type: string; period: string; docs: number; totalKz: number; date: string }[]
  >([
    {
      fileName: `SAFT_AO_${company.nif}_F_2026-10-01_2026-10-31.xml`,
      type: 'Facturação (F)',
      period: '2026-10-01 a 2026-10-31',
      docs: invoices.length,
      totalKz: invoices.reduce((a, b) => a + b.totalAmount, 0),
      date: getLuandaIsoDate(),
    },
  ]);

  const [agtEnvironment, setAgtEnvironment] = useState<'homologacao' | 'producao'>('homologacao');
  const [serverStatus, setServerStatus] = useState<AgtServerStatus | null>(null);
  const [selectedService, setSelectedService] = useState<AgtOfficialServiceName>('registarFactura');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || '');
  const [queryOperationId, setQueryOperationId] = useState<string>('');
  const [executingService, setExecutingService] = useState(false);
  const [lastServiceResponse, setLastServiceResponse] = useState<{
    serviceName: AgtOfficialServiceName;
    httpStatus: number;
    resultStatus: AgtTransmissionStatusType;
    operationId: string;
    jwsHeaderSummary: string;
    message: string;
    rawJson: string;
  } | null>(null);

  const [authorizedSeries, setAuthorizedSeries] = useState([
    {
      series: 'FT 2026',
      docType: 'Factura',
      establishment: 'Sede Principal (Estab. 01)',
      status: 'Activa (Homologação / Local)',
      seqActual: invoices.length + 1,
    },
    {
      series: 'FR 2026',
      docType: 'Factura-Recibo',
      establishment: 'Sede Principal (Estab. 01)',
      status: 'Activa (Homologação / Local)',
      seqActual: 1,
    },
    {
      series: 'NC 2026',
      docType: 'Nota de Credito',
      establishment: 'Sede Principal (Estab. 01)',
      status: 'Activa (Homologação / Local)',
      seqActual: 1,
    },
    {
      series: 'FP 2026',
      docType: 'Factura Proforma',
      establishment: 'Sede Principal (Estab. 01)',
      status: 'Activa (Comercial)',
      seqActual: 1,
    },
  ]);
  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesType, setNewSeriesType] = useState('Factura');
  const [newSeriesEstab, setNewSeriesEstab] = useState('Sede Principal (Estab. 01)');

  const [adhesionStatus, setAdhesionStatus] = useState<AgtAdhesionStatusType>(
    company.agtAdhesionStatus || 'em_homologacao'
  );
  const [certRef, setCertRef] = useState(company.agtCertificateRef || 'CERT-AO-JWS-7125');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (invoices.length > 0 && !selectedInvoiceId) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    let active = true;
    fetch('/api/agt/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setServerStatus(data);
      })
      .catch(() => {
        // Ignore offline error
      });
    return () => {
      active = false;
    };
  }, []);

  // Counters for the AGT Integration Panel (Section 1.5)
  const countTransmitidos = agtLogs.filter((l) => l.serviceName === 'registarFactura').length;
  const countValidados = invoices.filter((i) => i.agtTransmissionStatus === 'validada').length;
  const countRejeitados = invoices.filter((i) => i.agtTransmissionStatus === 'rejeitada').length;
  const countPendentes = invoices.filter((i) =>
    [
      'pendente_transmissao',
      'preparacao_certificacao',
      'pendente_envio',
      'recebida_agt',
      'em_processamento',
    ].includes(i.agtTransmissionStatus)
  ).length;
  const countErros =
    invoices.filter((i) => i.agtTransmissionStatus === 'erro_comunicacao').length +
    agtLogs.filter((l) => l.resultStatus === 'erro_comunicacao').length;
  const countContingencia = invoices.filter((i) => i.agtTransmissionStatus === 'contingencia').length;

  const handleSaveCompanyAgtConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCompanyConfig) return;
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      await onUpdateCompanyConfig({
        agtAdhesionStatus: adhesionStatus,
        agtCertificateRef: certRef.trim().slice(0, 100),
        agtEnvironment: agtEnvironment === 'producao' ? 'producao_bloqueada' : 'sandbox_teste',
      });
      await onLogAudit(
        'ACTUALIZAR_CONFIG_FISCAL_AGT',
        'Integração AGT',
        company.nif,
        `Configuração fiscal AGT actualizada: Adesão=${adhesionStatus}, Certificado=${certRef}.`
      );
      setConfigFeedback('Configuração fiscal individual da empresa guardada com sucesso.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExecuteAgtService = async (
    serviceToCall: AgtOfficialServiceName,
    targetInvoice?: Invoice
  ) => {
    setExecutingService(true);
    setLastServiceResponse(null);
    try {
      const inv =
        targetInvoice ||
        invoices.find((i) => i.id === selectedInvoiceId) ||
        invoices[0];

      // Duplicate submission protection (Section 1.4)
      if (serviceToCall === 'registarFactura' && inv?.agtTransmissionStatus === 'validada') {
        setLastServiceResponse({
          serviceName: serviceToCall,
          httpStatus: 409,
          resultStatus: 'validada',
          operationId: inv.agtOperationId || 'OP-DUPLICATE-BLOCKED',
          jwsHeaderSummary: 'alg:RS256 | PROTECCAO_DUPLICADOS',
          message: `Protecção contra envio duplicado: O documento ${inv.docNumber} já se encontra VALIDADO pela AGT.`,
          rawJson: JSON.stringify({ duplicateBlocked: true, docNumber: inv.docNumber }, null, 2),
        });
        return;
      }

      const targetRef =
        serviceToCall === 'solicitarSerie' || serviceToCall === 'listarSeries'
          ? newSeriesCode || 'FT 2026'
          : serviceToCall === 'obterEstado' && queryOperationId
          ? queryOperationId
          : inv?.docNumber || company.nif;

      const payload =
        serviceToCall === 'registarFactura' ||
        serviceToCall === 'consultarFactura' ||
        serviceToCall === 'validarDocumento'
          ? {
              taxRegistrationNumber: company.nif,
              companyName: company.name,
              softwareValidationNumber: serverStatus?.softwareValidationNumber || '0/AGT/PREP',
              documentNo: inv?.docNumber || 'FT 2026/1',
              documentType: inv?.docType || 'Factura',
              series: inv?.series || 'FT 2026',
              issueDate: inv?.issueDate || getLuandaIsoDate(),
              customerTaxID: inv?.clientNif || '999999999',
              customerName: inv?.clientName || 'Consumidor Final',
              netTotal: inv?.subtotal || 0,
              taxPayable: inv?.taxTotal || 0,
              grossTotal: inv?.totalAmount || 0,
              hash: inv?.hashCode || '',
            }
          : serviceToCall === 'obterEstado'
          ? {
              taxRegistrationNumber: company.nif,
              operationId: queryOperationId || inv?.agtOperationId || 'AGT-OP-CONSULTA',
              documentNo: inv?.docNumber || '',
            }
          : serviceToCall === 'solicitarSerie'
          ? {
              taxRegistrationNumber: company.nif,
              seriesCode: newSeriesCode || 'FT 2026',
              documentType: newSeriesType,
              establishment: newSeriesEstab,
            }
          : {
              taxRegistrationNumber: company.nif,
              periodStart: startDate,
              periodEnd: endDate,
            };

      const res = await fetch(`/api/agt/${serviceToCall}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: agtEnvironment,
          companyNif: company.nif,
          companyName: company.name,
          certificateRef: certRef,
          targetRef,
          payload,
        }),
      });

      const data = await res.json();
      const resultStatus: AgtTransmissionStatusType =
        data.resultStatus || 'pendente_transmissao';
      const operationId = String(data.operationId || `AGT-${Date.now()}`);
      const jwsHeaderSummary = String(data.jwsHeaderSummary || 'alg:HS256-PREP | typ:JOSE+JSON');
      const rawJson = JSON.stringify(data, null, 2);

      setLastServiceResponse({
        serviceName: serviceToCall,
        httpStatus: Number(data.httpStatus || res.status),
        resultStatus,
        operationId,
        jwsHeaderSummary,
        message: String(data.message || 'Pedido processado pelo proxy AGT.'),
        rawJson,
      });

      await onRecordAgtLog({
        serviceName: serviceToCall,
        environment: agtEnvironment,
        targetRef: String(targetRef).slice(0, 110),
        jwsHeaderSummary: jwsHeaderSummary.slice(0, 290),
        requestPayloadSummary: JSON.stringify(payload).slice(0, 750),
        responsePayloadSummary: String(data.message || rawJson).slice(0, 750),
        httpStatus: Number(data.httpStatus || res.status),
        resultStatus,
        operationId: operationId.slice(0, 110),
      });

      if (
        inv &&
        (serviceToCall === 'registarFactura' ||
          serviceToCall === 'obterEstado' ||
          serviceToCall === 'validarDocumento')
      ) {
        await onUpdateInvoiceAgtState(inv, resultStatus, operationId, rawJson);
      }

      await onLogAudit(
        `AGT_${serviceToCall.toUpperCase()}`,
        'Integração AGT',
        String(targetRef),
        `Serviço ${serviceToCall} executado (${agtEnvironment}) -> Estado: ${resultStatus} (${operationId}).`
      );
    } catch (err) {
      setLastServiceResponse({
        serviceName: serviceToCall,
        httpStatus: 503,
        resultStatus: 'erro_comunicacao',
        operationId: `ERR-${Date.now()}`,
        jwsHeaderSummary: 'ERRO_REDE_LOCAL',
        message:
          err instanceof Error
            ? err.message
            : 'Erro de comunicação ao contactar o serviço de integração AGT.',
        rawJson: JSON.stringify({ error: String(err) }, null, 2),
      });
    } finally {
      setExecutingService(false);
    }
  };

  const handleGenerateSaft = async () => {
    const result = gerarValidarSaftAO({
      company,
      clients,
      products,
      invoices,
      startDate,
      endDate,
      saftType,
    });
    setSaftResult(result);
    setSaftHistory((prev) => [
      {
        fileName: result.fileName,
        type: result.saftType,
        period: result.periodLabel,
        docs: result.totalDocuments,
        totalKz: result.totalCreditKz,
        date: getLuandaIsoDate(),
      },
      ...prev,
    ]);
    await onLogAudit(
      'GERAR_VALIDAR_SAFT_AO',
      'SAF-T AO',
      result.fileName,
      `Ficheiro XML ${result.saftType} validado para o período ${result.periodLabel} (${result.totalDocuments} documentos).`
    );
  };

  const handleDownloadSaftXml = () => {
    if (!saftResult) return;
    const blob = new Blob([saftResult.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = saftResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeriesCode.trim()) return;
    const code = newSeriesCode.trim().toUpperCase();
    setAuthorizedSeries((prev) => [
      ...prev,
      {
        series: code,
        docType: newSeriesType,
        establishment: newSeriesEstab,
        status: 'Solicitada / Activa (Homologação AGT)',
        seqActual: 1,
      },
    ]);
    await handleExecuteAgtService('solicitarSerie');
    setNewSeriesCode('');
  };

  if (mode === 'saft') {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono text-sky-400">
              MÓDULO SAF-T (AO) · ESQUEMA OFICIAL AO_1.01_01
            </p>
            <h2 className="text-xl font-bold tracking-tight font-display">
              Exportação e Validação Estrutural de Ficheiros SAF-T AO (XML)
            </h2>
            <p className="text-xs text-slate-300">
              Geração real de XML com verificação de campos obrigatórios, validação de assinaturas Hash, relatório de conformidade e arquivo histórico.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700 shrink-0">
            <FileCode2 className="w-4 h-4 text-sky-400" />
            <span>NIF Contribuinte: {company.nif}</span>
          </div>
        </div>

        {/* SAF-T Generator Form */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Configurar Período de Referência e Tipo de Ficheiro SAF-T AO
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Obrigação SAF-T AO
              </label>
              <select
                value={saftType}
                onChange={(e) => setSaftType(e.target.value as typeof saftType)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
              >
                <option value="Facturação (F)">SAF-T AO de Facturação (F)</option>
                <option value="Contabilidade (C)">SAF-T AO de Contabilidade (C)</option>
                <option value="Inventário (I)">Ficheiro de Inventário (I)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data Inicial do Período
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data Final do Período
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerateSaft}
                className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors"
              >
                Validar Estrutura e Gerar XML
              </button>
            </div>
          </div>

          {saftResult && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {saftResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {saftResult.fileName} —{' '}
                      {saftResult.valid
                        ? 'Estrutura XML Validada Sem Erros'
                        : 'Erros de Validação Detectados'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Período: {saftResult.periodLabel} · Documentos: {saftResult.totalDocuments} · Total Facturado:{' '}
                    <strong className="font-mono">{formatKz(saftResult.totalCreditKz)}</strong> · IVA Liquidado:{' '}
                    <strong className="font-mono">{formatKz(saftResult.totalTaxKz)}</strong>
                  </p>
                </div>

                <button
                  onClick={handleDownloadSaftXml}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descarregar Ficheiro XML Oficial
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    Relatório de Verificação de Campos Obrigatórios (XSD AO_1.01_01)
                  </h4>
                  <div className="space-y-2">
                    {saftResult.checks.map((chk, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800"
                      >
                        <div>
                          <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {chk.field}
                          </p>
                          <p className="text-slate-500">{chk.detail}</p>
                        </div>
                        <span
                          className={`font-mono font-bold ${
                            chk.status === 'OK'
                              ? 'text-emerald-600'
                              : chk.status === 'AVISO'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {chk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Pré-visualização do Ficheiro XML Gerado
                  </h4>
                  <pre className="p-3 rounded bg-slate-950 text-slate-100 font-mono text-[11px] max-h-56 overflow-auto">
                    {saftResult.xml}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SAF-T Archive History */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Histórico e Arquivo Seguro de Ficheiros SAF-T AO Gerados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Nome do Ficheiro XML</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Período de Referência</th>
                  <th className="py-2.5 px-4 text-right">N.º Documentos</th>
                  <th className="py-2.5 px-4 text-right">Total Crédito (AOA)</th>
                  <th className="py-2.5 px-4">Data de Geração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {saftHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-sky-700 dark:text-sky-400">
                      {item.fileName}
                    </td>
                    <td className="py-2.5 px-4">{item.type}</td>
                    <td className="py-2.5 px-4 font-mono">{item.period}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{item.docs}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatKz(item.totalKz)}</td>
                    <td className="py-2.5 px-4 font-mono">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Mode === 'agt' (MÓDULO 1 – INTEGRAÇÃO OFICIAL COM A AGT)
  return (
    <div className="space-y-6">
      {/* Header & Official Portal Reference */}
      <div className="p-6 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="text-xs font-mono font-semibold text-sky-400">
                MÓDULO 1 · INTEGRAÇÃO OFICIAL COM A FACTURAÇÃO ELECTRÓNICA DA AGT
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight font-display">
              Painel de Comunicação Oficial AGT, Assinatura JWS e Controlo de Séries
            </h2>
            <p className="text-xs text-slate-300">
              Especificação Técnica: <span className="font-mono text-sky-300">https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/</span> · Decreto Presidencial n.º 71/25
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setAgtEnvironment('homologacao')}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                agtEnvironment === 'homologacao'
                  ? 'bg-sky-600 text-white border-sky-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              Ambiente Homologação / Testes
            </button>
            <button
              onClick={() => setAgtEnvironment('producao')}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                agtEnvironment === 'producao'
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              Ambiente de Produção Oficial
            </button>
          </div>
        </div>

        {/* Strict Non-Simulation & Security Notice */}
        <div className="p-3.5 rounded-lg bg-amber-950/80 border border-amber-700/70 text-xs text-amber-100 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>RIGOR FISCAL E CRIPTOGRÁFICO (SECÇÃO 1.1 & 1.3):</strong> As credenciais de produtor de software, tokens e chaves privadas RSA são lidos exclusivamente no servidor (<code className="font-mono">.env</code>) e nunca expostos no navegador. <strong>Receber um pedido não significa que esteja validado:</strong> o sistema não simula respostas positivas (<code className="font-mono">Validada</code>) enquanto as credenciais oficiais da AGT não estiverem activas.
          </div>
        </div>
      </div>

      {/* Section 1.5: Painel de Integração AGT Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Estado da Ligação AGT</p>
          <p className="text-sm font-bold font-mono mt-1 text-sky-700 dark:text-sky-400">
            {serverStatus?.credentialsConfigured ? 'API Activa' : 'Proxy JWS Pronto'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Amb.: {agtEnvironment === 'producao' ? 'Produção' : 'Homologação'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Transmitidos (API)</p>
          <p className="text-xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
            {countTransmitidos}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Últ.: {agtLogs[0] ? formatLuandaDateTime().slice(0, 16) : 'Sem envio'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Validados pela AGT</p>
          <p className="text-xl font-bold font-mono mt-1 text-emerald-600">{countValidados}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Com confirmação oficial</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Pendentes Transmissão</p>
          <p className="text-xl font-bold font-mono mt-1 text-amber-600">{countPendentes}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Fila controlada activa</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Rejeitados / Erros</p>
          <p className="text-xl font-bold font-mono mt-1 text-red-600">
            {countRejeitados} / {countErros}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Registo de falhas</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-500">Séries & Certificados</p>
          <p className="text-sm font-bold font-mono mt-1 text-slate-900 dark:text-white">
            {authorizedSeries.length} Séries · {countContingencia} Conting.
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">Cert: {certRef}</p>
        </div>
      </div>

      {/* Section 1.2: Individual Company Fiscal Configuration & Section 1.1: Official Services Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 cols: Configuração Individual por Empresa */}
        <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Configuração Fiscal Individual da Empresa (Secção 1.2)
              </h3>
              <p className="text-slate-500">
                Isolamento criptográfico Multi-Tenant por Contribuinte
              </p>
            </div>
            <KeyRound className="w-4 h-4 text-sky-600" />
          </div>

          <form onSubmit={handleSaveCompanyAgtConfig} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  NIF do Contribuinte
                </label>
                <input
                  type="text"
                  disabled
                  value={company.nif}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Estabelecimentos Activos
                </label>
                <input
                  type="text"
                  disabled
                  value={`${company.establishmentsCount} Estabelecimento(s)`}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado de Adesão à Facturação Electrónica AGT
              </label>
              <select
                value={adhesionStatus}
                onChange={(e) => setAdhesionStatus(e.target.value as AgtAdhesionStatusType)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="em_homologacao">
                  Em Homologação / Testes no Portal do Parceiro AGT
                </option>
                <option value="aderente_activo">
                  Contribuinte Aderente Activo (Transmissão API Tempo Real)
                </option>
                <option value="nao_aderente">
                  Não Aderente Directo (Submissão Mensal SAF-T AO)
                </option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Identificador do Certificado Digital / Chave JWS (`kid`)
              </label>
              <input
                type="text"
                value={certRef}
                onChange={(e) => setCertRef(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
              <p>
                <strong>Algoritmo JWS Servidor:</strong>{' '}
                <span className="font-mono">{serverStatus?.jwsAlgorithm || 'RS256 / HS256-RFC7515'}</span>
              </p>
              <p>
                <strong>Chave Privada Produtor (.env):</strong>{' '}
                <span className="font-mono">
                  {serverStatus?.rsaPrivateKeyConfigured
                    ? 'Chave RSA PEM Carregada no Servidor'
                    : 'Modo Preparação (Aguarda Chave RSA Oficial no .env)'}
                </span>
              </p>
              <p>
                <strong>Regime Tributário:</strong> {company.taxRegime} · {company.vatScheme}
              </p>
            </div>

            {configFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                {configFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 text-white font-semibold transition-colors"
            >
              {savingConfig ? 'A guardar configuração...' : 'Guardar Configuração Fiscal da Empresa'}
            </button>
          </form>
        </div>

        {/* Right 7 cols: Consola dos 7 Serviços Oficiais da API AGT */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Consola de Execução dos 7 Serviços Oficiais da AGT (Contrato Portal do Parceiro)
              </h3>
              <p className="text-slate-500">
                Assinatura JWS no backend (<code className="font-mono">/api/agt/:serviceName</code>) e registo integral de pedidos/respostas
              </p>
            </div>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>

          {/* 7 Official Service Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AGT_SERVICES_META.map((srv) => (
              <button
                key={srv.id}
                type="button"
                onClick={() => setSelectedService(srv.id)}
                className={`px-3 py-2 rounded-lg font-mono text-[11px] font-semibold border text-left transition-colors ${
                  selectedService === srv.id
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                }`}
              >
                {srv.label}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono font-bold text-sky-700 dark:text-sky-400">
                POST /api/agt/{selectedService}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {AGT_SERVICES_META.find((s) => s.id === selectedService)?.description}
              </p>
            </div>

            <button
              type="button"
              disabled={executingService}
              onClick={() => handleExecuteAgtService(selectedService)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{executingService ? 'A comunicar...' : `Executar ${selectedService}`}</span>
            </button>
          </div>

          {/* Dynamic Parameters for the Selected Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Documento Fiscal Alvo
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              >
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.docNumber} — {formatKz(inv.totalAmount)} (
                    {AGT_STATE_LABELS[inv.agtTransmissionStatus]?.label || inv.agtTransmissionStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ID da Operação AGT (Para <code className="font-mono">obterEstado</code>)
              </label>
              <input
                type="text"
                value={queryOperationId}
                onChange={(e) => setQueryOperationId(e.target.value)}
                placeholder="Ex.: AGT-OP-176281920-AB12"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-900 dark:text-white bg-transparent"
              />
            </div>
          </div>

          {lastServiceResponse && (
            <div className="p-4 rounded-xl bg-slate-950 text-slate-100 border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="font-mono font-bold text-sky-400">
                  Resposta Oficial Proxy AGT · {lastServiceResponse.serviceName} (HTTP{' '}
                  {lastServiceResponse.httpStatus})
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    AGT_STATE_LABELS[lastServiceResponse.resultStatus]?.badgeClass ||
                    'bg-slate-800 text-white'
                  }`}
                >
                  Estado: {AGT_STATE_LABELS[lastServiceResponse.resultStatus]?.label || lastServiceResponse.resultStatus}
                </span>
              </div>
              <p className="text-[11px] text-amber-300">{lastServiceResponse.message}</p>
              <p className="text-[10px] font-mono text-slate-400">
                JWS Protected Header: {lastServiceResponse.jwsHeaderSummary} · Operation ID:{' '}
                {lastServiceResponse.operationId}
              </p>
              <pre className="p-2.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 max-h-40 overflow-auto">
                {lastServiceResponse.rawJson}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Authorized Billing Series Management (solicitarSerie & listarSeries) */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Séries de Facturação Autorizadas e Estabelecimentos (`solicitarSerie` / `listarSeries`)
            </h3>
            <p className="text-slate-500">
              Controlo de sequencialidade por série, estabelecimento e ano fiscal.
            </p>
          </div>
          <form onSubmit={handleAddSeries} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newSeriesCode}
              onChange={(e) => setNewSeriesCode(e.target.value)}
              placeholder="Ex.: FT L02/2026"
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-mono text-slate-900 dark:text-white bg-transparent"
            />
            <select
              value={newSeriesType}
              onChange={(e) => setNewSeriesType(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
            >
              <option value="Factura">Factura</option>
              <option value="Factura-Recibo">Factura-Recibo</option>
              <option value="Nota de Credito">Nota de Crédito</option>
              <option value="Guia de Remessa">Guia de Remessa</option>
            </select>
            <input
              type="text"
              value={newSeriesEstab}
              onChange={(e) => setNewSeriesEstab(e.target.value)}
              placeholder="Estabelecimento"
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-900 dark:text-white bg-transparent"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-sky-600 text-white font-semibold whitespace-nowrap shrink-0"
            >
              Solicitar Série AGT
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Código da Série</th>
                <th className="py-2.5 px-4">Tipo de Documento</th>
                <th className="py-2.5 px-4">Estabelecimento</th>
                <th className="py-2.5 px-4">Próx. Sequencial</th>
                <th className="py-2.5 px-4">Estado da Série</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {authorizedSeries.map((s, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-4 font-mono font-bold">{s.series}</td>
                  <td className="py-2.5 px-4">{s.docType}</td>
                  <td className="py-2.5 px-4">{s.establishment}</td>
                  <td className="py-2.5 px-4 font-mono">{s.seqActual}</td>
                  <td className="py-2.5 px-4 text-amber-700 dark:text-amber-400 font-medium">
                    {s.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 1.3 & 1.4: Fila de Transmissão, Estados Distintos e Reconciliação de Documentos */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Fila de Transmissão Fiscal, Estados Distintos AGT e Modo de Contingência (Secção 1.3 & 1.4)
            </h3>
            <p className="text-xs text-slate-500">
              Estados oficiais: Rascunho · Pendente de transmissão · Recebida pela AGT · Em processamento · Validada · Rejeitada · Erro de comunicação
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExecuteAgtService('listarFacturas')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconciliar com AGT (listarFacturas)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">N.º Documento</th>
                <th className="py-2.5 px-4">Data</th>
                <th className="py-2.5 px-4">NIF Cliente</th>
                <th className="py-2.5 px-4 text-right">Total (AOA)</th>
                <th className="py-2.5 px-4">ID Operação AGT</th>
                <th className="py-2.5 px-4">Estado Oficial AGT</th>
                <th className="py-2.5 px-4 text-right">Acções de Transmissão / Contingência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.map((inv) => {
                const stateInfo = AGT_STATE_LABELS[inv.agtTransmissionStatus] || {
                  label: inv.agtTransmissionStatus,
                  badgeClass: 'bg-slate-200 text-slate-800',
                };
                return (
                  <tr key={inv.id}>
                    <td className="py-2.5 px-4 font-mono font-bold">{inv.docNumber}</td>
                    <td className="py-2.5 px-4 font-mono">{inv.issueDate}</td>
                    <td className="py-2.5 px-4 font-mono">{inv.clientNif}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatKz(inv.totalAmount)}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {inv.agtOperationId || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold ${stateInfo.badgeClass}`}
                      >
                        {stateInfo.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={executingService}
                          onClick={() => handleExecuteAgtService('registarFactura', inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                          title="Transmitir via registarFactura com assinatura JWS"
                        >
                          <Send className="w-3 h-3" />
                          <span>Transmitir</span>
                        </button>
                        <button
                          type="button"
                          disabled={executingService}
                          onClick={() => handleExecuteAgtService('obterEstado', inv)}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold"
                          title="Consultar estado na AGT (obterEstado)"
                        >
                          Estado
                        </button>
                        {inv.agtTransmissionStatus !== 'contingencia' && (
                          <button
                            type="button"
                            onClick={() => onQueueContingencySync(inv)}
                            className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold"
                          >
                            Contingência
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Log of All AGT Communications (Section 1.1 & 1.4) */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Registo Imutável de Pedidos e Respostas da Comunicação AGT (`agt_communications`)
          </h3>
          <p className="text-xs text-slate-500">
            Auditoria técnica de todas as chamadas aos serviços oficiais com cabeçalho JWS, HTTP status e ID de operação.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Serviço Oficial</th>
                <th className="py-2.5 px-4">Ambiente</th>
                <th className="py-2.5 px-4">Ref. Alvo</th>
                <th className="py-2.5 px-4">ID Operação AGT</th>
                <th className="py-2.5 px-4">Cabeçalho JWS</th>
                <th className="py-2.5 px-4">HTTP</th>
                <th className="py-2.5 px-4">Estado Resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {agtLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Nenhuma comunicação AGT registada nesta sessão. Utilize a consola acima ou o botão Transmitir.
                  </td>
                </tr>
              ) : (
                agtLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 font-mono font-bold text-sky-700 dark:text-sky-400">
                      {log.serviceName}
                    </td>
                    <td className="py-2.5 px-4 uppercase font-mono text-[11px]">{log.environment}</td>
                    <td className="py-2.5 px-4 font-mono">{log.targetRef}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{log.operationId}</td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                      {log.jwsHeaderSummary}
                    </td>
                    <td className="py-2.5 px-4 font-mono">{log.httpStatus}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                          AGT_STATE_LABELS[log.resultStatus]?.badgeClass ||
                          'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {AGT_STATE_LABELS[log.resultStatus]?.label || log.resultStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
