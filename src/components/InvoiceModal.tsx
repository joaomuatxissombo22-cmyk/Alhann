import React, { useState } from 'react';
import { Download, Mail, MessageSquare, Printer, ShieldAlert, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Company, Invoice, InvoiceLineItem } from '../types/models';
import { AGT_STATE_LABELS, exportarFacturaPDF, formatKz } from '../lib/angolaUtils';

interface InvoiceModalProps {
  invoice: Invoice | null;
  company: Company;
  onClose: () => void;
  onIncrementPrintCount: (invoice: Invoice) => Promise<void>;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  company,
  onClose,
  onIncrementPrintCount,
}) => {
  const [viewFormat, setViewFormat] = useState<'A4' | 'TERMICO'>('A4');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  if (!invoice) return null;

  let parsedItems: InvoiceLineItem[] = [];
  try {
    parsedItems = JSON.parse(invoice.itemsSummary);
  } catch {
    parsedItems = [];
  }

  const isOriginal = (invoice.printCount || 0) === 0;
  const exemplarText = isOriginal ? 'ORIGINAL' : `2.ª VIA (${invoice.printCount + 1}.ª Impressão)`;
  const hash4 = `${invoice.hashCode[0] || 'A'}${invoice.hashCode[10] || 'L'}${invoice.hashCode[20] || 'H'}${invoice.hashCode[30] || 'N'}`;

  const handleDownloadPdf = async (fmt: 'A4' | 'TERMICO') => {
    exportarFacturaPDF(invoice, company, fmt);
    await onIncrementPrintCount(invoice);
  };

  const handleBrowserPrint = async () => {
    window.print();
    await onIncrementPrintCount(invoice);
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Exmo(a). ${invoice.clientName},\nEnviamos os dados do documento *${invoice.docType} ${invoice.docNumber}* emitido por *${company.name}* (NIF: ${company.nif}).\nValor Total: *${formatKz(invoice.totalAmount)}*\nData: ${invoice.issueDate}\nAssinatura Hash: ${hash4}\n\nProcessado por ALHAN FACTURA (Preparação Certificação AGT).`
    );
    window.location.href = `https://wa.me/?text=${msg}`;
  };

  const handleSendEmail = () => {
    setEmailStatus(`Notificação de envio preparada para o cliente (${invoice.clientName}) com cópia para ${company.email}.`);
    const subject = encodeURIComponent(`${invoice.docType} ${invoice.docNumber} - ${company.name}`);
    const body = encodeURIComponent(
      `Exmo.(s) Sr.(s) ${invoice.clientName},\n\nSegue o resumo do documento ${invoice.docType} N.º ${invoice.docNumber}:\n- Data de Emissão: ${invoice.issueDate}\n- Subtotal: ${formatKz(invoice.subtotal)}\n- IVA: ${formatKz(invoice.taxTotal)}\n- Total Geral: ${formatKz(invoice.totalAmount)} (${invoice.amountInWords})\n- Código Hash: ${hash4}\n\nCom os melhores cumprimentos,\n${company.name}\nNIF: ${company.nif} | Tel: ${company.phone}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Top Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-900 text-white no-print">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-tight">
              {invoice.docType} — {invoice.docNumber}
            </span>
            <span className="text-xs text-sky-300">·</span>
            <span className="text-xs font-mono text-amber-300">{exemplarText}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewFormat('A4')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  viewFormat === 'A4' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Formato A4
              </button>
              <button
                onClick={() => setViewFormat('TERMICO')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  viewFormat === 'TERMICO' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Talão Térmico 80mm
              </button>
            </div>

            <button
              onClick={() => handleDownloadPdf(viewFormat)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              PDF ({viewFormat})
            </button>

            <button
              onClick={handleBrowserPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>

            <button
              onClick={handleSendEmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              E-mail
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {emailStatus && (
          <div className="px-6 py-2 bg-sky-50 dark:bg-sky-950/50 border-b border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 no-print">
            {emailStatus}
          </div>
        )}

        {/* Notice Banner for AGT Status */}
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>ESTADO FISCAL AGT:</strong>{' '}
              <span className="underline font-bold">
                {AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label || invoice.agtTransmissionStatus}
              </span>{' '}
              {invoice.agtOperationId ? `(ID Operação AGT: ${invoice.agtOperationId})` : ''} — Decreto Presidencial n.º 71/25.
            </span>
          </div>
        </div>

        {/* Document Canvas */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950 max-h-[75vh] overflow-y-auto flex justify-center">
          {viewFormat === 'TERMICO' ? (
            <div className="w-80 bg-white text-slate-900 p-5 shadow-md border border-slate-200 font-mono text-xs space-y-3">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt={company.commercialName}
                    className="h-12 w-auto mx-auto object-contain mb-1"
                  />
                )}
                <p className="font-bold text-sm">{company.commercialName}</p>
                <p className="text-[11px]">{company.name}</p>
                <p className="text-[11px]">NIF: {company.nif}</p>
                <p className="text-[10px]">{company.address} · {company.province}</p>
                <p className="text-[10px]">Tel: {company.phone}</p>
              </div>

              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <p className="font-bold">{invoice.docType.toUpperCase()}</p>
                <p className="font-bold">{invoice.docNumber}</p>
                <p className="text-[10px] mt-0.5">Exemplar: {exemplarText}</p>
                <p className="text-[10px]">Data: {invoice.issueDate}</p>
              </div>

              <div className="border-b border-dashed border-slate-300 pb-2 text-[11px]">
                <p>Cliente: {invoice.clientName}</p>
                <p>NIF: {invoice.clientNif || '999999999'}</p>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>
                      {item.quantity}x {item.description.slice(0, 18)}
                    </span>
                    <span className="tabular-nums font-semibold">{formatKz(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-right border-b border-dashed border-slate-300 pb-2">
                <p className="text-[11px]">Subtotal: {formatKz(invoice.subtotal)}</p>
                <p className="text-[11px]">Desconto: {formatKz(invoice.discountTotal)}</p>
                <p className="text-[11px]">IVA: {formatKz(invoice.taxTotal)}</p>
                <p className="text-sm font-bold">TOTAL: {formatKz(invoice.totalAmount)}</p>
              </div>

              <div className="flex flex-col items-center pt-2 space-y-2 text-center">
                <QRCodeSVG value={invoice.qrCodePayload} size={110} level="M" />
                <p className="text-[10px] leading-tight">
                  {hash4} — Processado por ALHAN FACTURA (Preparação para Certificação AGT)
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl bg-white text-slate-900 p-8 shadow-sm border border-slate-200 space-y-6">
              {/* A4 Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-3">
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={company.commercialName}
                        className="w-14 h-14 rounded-lg object-contain border border-slate-200 bg-white p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0">
                        {company.commercialName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                      <p className="text-xs text-slate-500">{company.commercialName}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                    <p>
                      <strong>NIF:</strong> {company.nif} · <strong>Regime:</strong> {company.taxRegime}
                    </p>
                    <p>
                      <strong>Sede:</strong> {company.address}, {company.municipality} — {company.province}, Angola
                    </p>
                    <p>
                      <strong>Contacto:</strong> {company.phone} · {company.email}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="flex flex-wrap sm:justify-end gap-1.5">
                    <span className="inline-block text-xs font-mono font-bold tracking-wider text-slate-900 border border-slate-300 px-2.5 py-1 rounded">
                      {exemplarText}
                    </span>
                    <span className="inline-block text-xs font-mono font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded">
                      AGT: {AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label || invoice.agtTransmissionStatus}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mt-2">
                    {invoice.docType.toUpperCase()}
                  </h4>
                  <p className="text-sm font-mono font-semibold text-sky-700">{invoice.docNumber}</p>
                  <p className="text-xs text-slate-500">Série: {invoice.series} · Seq. N.º {invoice.sequentialNumber}</p>
                </div>
              </div>

              {/* Client & Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4 px-5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="space-y-1">
                  <p className="text-slate-400 font-semibold">DESTINATÁRIO / CLIENTE</p>
                  <p className="text-sm font-bold text-slate-900">{invoice.clientName}</p>
                  <p className="text-slate-700">
                    <strong>NIF:</strong> {invoice.clientNif || '999999999 (Consumidor Final)'}
                  </p>
                  <p className="text-slate-600">
                    <strong>Morada:</strong> {invoice.clientAddress || 'Luanda, Angola'}
                  </p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-slate-400 font-semibold">DETALHES DE EMISSÃO</p>
                  <p className="text-slate-700">
                    <strong>Data de Emissão:</strong> {invoice.issueDate}
                  </p>
                  <p className="text-slate-700">
                    <strong>Data de Vencimento:</strong> {invoice.dueDate}
                  </p>
                  <p className="text-slate-700">
                    <strong>Condições:</strong> {invoice.paymentTerms} · <strong>Meio:</strong> {invoice.paymentMethod}
                  </p>
                  <p className="text-slate-700">
                    <strong>Moeda Fiscal:</strong> Kwanza (AOA / Kz)
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição do Produto / Serviço</th>
                      <th className="py-2.5 px-3 text-right">Qtd.</th>
                      <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desc.</th>
                      <th className="py-2.5 px-3 text-right">IVA</th>
                      <th className="py-2.5 px-3 text-right">Total Ilíquido/Líq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedItems.map((line, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 font-mono">{line.code}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{line.description}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatKz(line.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{line.discountPercent}%</td>
                        <td className="py-2.5 px-3 text-right font-mono">{line.taxRate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {formatKz(line.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & QR Code Section */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-2 items-start">
                <div className="sm:col-span-7 flex items-start gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="bg-white p-2 rounded border border-slate-200 shrink-0">
                    <QRCodeSVG value={invoice.qrCodePayload} size={96} level="M" />
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-900">
                      Assinatura Digital & Código QR (Decreto Presidencial n.º 71/25)
                    </p>
                    <p className="font-mono text-[10px] break-all text-slate-500">
                      Hash: {invoice.hashCode}
                    </p>
                    <p>
                      <strong>Coordenadas Bancárias ({company.bankName}):</strong> {company.bankIban || 'Não definido'}
                    </p>
                    {invoice.notes && (
                      <p>
                        <strong>Observações:</strong> {invoice.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-5 space-y-2 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Ilíquido:</span>
                    <span className="font-mono">{formatKz(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Descontos Comerciais:</span>
                    <span className="font-mono">{formatKz(invoice.discountTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Imposto (IVA):</span>
                    <span className="font-mono">{formatKz(invoice.taxTotal)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 flex justify-between items-baseline text-sm font-bold text-slate-900">
                    <span>TOTAL A PAGAR (AOA):</span>
                    <span className="font-mono text-base text-sky-700">{formatKz(invoice.totalAmount)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic pt-1">
                    Por extenso: {invoice.amountInWords}
                  </p>
                </div>
              </div>

              {/* Legal Footer */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {hash4} — Processado por software em <strong>PREPARAÇÃO PARA CERTIFICAÇÃO AGT</strong> · ALHAN FACTURA v2.5
                </span>
                <span>
                  ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA · Tel: 922 021 211 · facturao@alhan.pro
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
