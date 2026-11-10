import React, { useState } from 'react';
import {
  Download,
  Laptop,
  Mail,
  MessageSquare,
  Percent,
  Printer,
  ShieldAlert,
  Smartphone,
  Tag,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Company, Invoice, InvoiceLineItem } from '../types/models';
import {
  AGT_STATE_LABELS,
  BLACK_FRIDAY_DISCOUNT_PERCENT,
  calcularResumoFiscalFactura,
  exportarFacturaPDF,
  formatKz,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
  valorPorExtensoKz,
} from '../lib/angolaUtils';

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
  const [viewFormat, setViewFormat] = useState<'A4' | 'TERMICO'>('TERMICO');
  const [thermalDeviceWidth, setThermalDeviceWidth] = useState<'80mm_pc' | '58mm_mobile'>('80mm_pc');
  const [simulateBlackFriday60, setSimulateBlackFriday60] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  if (!invoice) return null;

  let parsedItems: InvoiceLineItem[] = [];
  try {
    parsedItems = JSON.parse(invoice.itemsSummary);
  } catch {
    parsedItems = [];
  }

  const baseFiscal = calcularResumoFiscalFactura(invoice);
  const isPromoActive = baseFiscal.blackFridayApplied || simulateBlackFriday60;

  // Compute live display numbers when Black Friday 60% promo is active or toggled in preview
  const grossBeforeDiscount =
    baseFiscal.grossBeforeDiscount > 0 ? baseFiscal.grossBeforeDiscount : invoice.subtotal;
  const effectiveDiscount =
    simulateBlackFriday60 && !baseFiscal.blackFridayApplied
      ? Math.round(grossBeforeDiscount * (BLACK_FRIDAY_DISCOUNT_PERCENT / 100) * 100) / 100
      : baseFiscal.discountTotal;
  const effectiveSubtotal =
    simulateBlackFriday60 && !baseFiscal.blackFridayApplied
      ? Math.max(0, Math.round((grossBeforeDiscount - effectiveDiscount) * 100) / 100)
      : baseFiscal.subtotal;
  const effectiveIva14 = Math.round(effectiveSubtotal * (baseFiscal.ivaRate / 100) * 100) / 100;
  const effectiveWithholding65 =
    Math.round(effectiveSubtotal * (baseFiscal.withholdingRate / 100) * 100) / 100;
  const effectiveTotalInvoice = Math.round((effectiveSubtotal + effectiveIva14) * 100) / 100;
  const effectiveNetPayable = Math.max(
    0,
    Math.round((effectiveTotalInvoice - effectiveWithholding65) * 100) / 100
  );

  const effectiveInvoiceForPdf: Invoice = {
    ...invoice,
    subtotal: effectiveSubtotal,
    discountTotal: effectiveDiscount,
    taxTotal: effectiveIva14,
    withholdingTaxRate: baseFiscal.withholdingRate,
    withholdingTaxTotal: effectiveWithholding65,
    totalAmount: effectiveTotalInvoice,
    netPayableAmount: effectiveNetPayable,
    blackFridayApplied: isPromoActive,
    amountInWords: valorPorExtensoKz(effectiveNetPayable),
  };

  const isOriginal = (invoice.printCount || 0) === 0;
  const exemplarText = isOriginal ? 'ORIGINAL' : `2.ª VIA (${invoice.printCount + 1}.ª Impressão)`;
  const hash4 = `${invoice.hashCode[0] || 'A'}${invoice.hashCode[10] || 'L'}${invoice.hashCode[20] || 'H'}${invoice.hashCode[30] || 'N'}`;

  const handleDownloadPdf = async (fmt: 'A4' | 'TERMICO') => {
    exportarFacturaPDF(effectiveInvoiceForPdf, company, fmt);
    await onIncrementPrintCount(invoice);
  };

  const handleBrowserPrint = async () => {
    window.print();
    await onIncrementPrintCount(invoice);
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Exmo(a). ${invoice.clientName},\nEnviamos os dados do documento *${invoice.docType} ${invoice.docNumber}* emitido por *${company.name}* (NIF: ${company.nif}).\n- Incidência: ${formatKz(effectiveSubtotal)}\n- IVA (14%): +${formatKz(effectiveIva14)}\n- Retenção na Fonte (6,5%): -${formatKz(effectiveWithholding65)}\n- *Líquido a Pagar: ${formatKz(effectiveNetPayable)}*\nData: ${invoice.issueDate} | Hash: ${hash4}\n\nProcessado por ALHAN FACTURA.`
    );
    window.location.href = `https://wa.me/?text=${msg}`;
  };

  const handleSendEmail = () => {
    setEmailStatus(
      `Notificação de envio preparada para o cliente (${invoice.clientName}) com cópia para ${company.email}.`
    );
    const subject = encodeURIComponent(`${invoice.docType} ${invoice.docNumber} - ${company.name}`);
    const body = encodeURIComponent(
      `Exmo.(s) Sr.(s) ${invoice.clientName},\n\nSegue o resumo do documento ${invoice.docType} N.º ${invoice.docNumber}:\n- Data de Emissão: ${invoice.issueDate}\n- Subtotal Tributável: ${formatKz(effectiveSubtotal)}\n- Desconto${isPromoActive ? ' (Promoção Black Friday 60%)' : ''}: -${formatKz(effectiveDiscount)}\n- IVA (14%): +${formatKz(effectiveIva14)}\n- Retenção na Fonte (6,5%): -${formatKz(effectiveWithholding65)}\n- Total da Factura: ${formatKz(effectiveTotalInvoice)}\n- Valor Líquido a Pagar: ${formatKz(effectiveNetPayable)} (${valorPorExtensoKz(effectiveNetPayable)})\n- Código Hash: ${hash4}\n\nCom os melhores cumprimentos,\n${company.name}\nNIF: ${company.nif} | Tel: ${company.phone}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-2 sm:my-6">
        {/* Top Control Toolbar */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-3.5 bg-slate-900 text-white no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight">
                {invoice.docType} — {invoice.docNumber}
              </span>
              <span className="text-xs text-sky-300">·</span>
              <span className="text-xs font-mono text-amber-300">{exemplarText}</span>
              <span className="text-xs text-sky-300">·</span>
              <span className="text-[11px] font-mono text-emerald-400">
                IVA 14% + Retenção 6,5%
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
            {/* Format & Device Adaptive Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
                <button
                  onClick={() => setViewFormat('TERMICO')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewFormat === 'TERMICO'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Talão Térmico (Móvel / PC)
                </button>
                <button
                  onClick={() => setViewFormat('A4')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewFormat === 'A4'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Formato A4
                </button>
              </div>

              {viewFormat === 'TERMICO' && (
                <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
                  <button
                    onClick={() => setThermalDeviceWidth('80mm_pc')}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      thermalDeviceWidth === '80mm_pc'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3 h-3" />
                    <span>Computador (80mm)</span>
                  </button>
                  <button
                    onClick={() => setThermalDeviceWidth('58mm_mobile')}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      thermalDeviceWidth === '58mm_mobile'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Telemóvel (58mm)</span>
                  </button>
                </div>
              )}

              {!baseFiscal.blackFridayApplied && (
                <button
                  onClick={() => setSimulateBlackFriday60(!simulateBlackFriday60)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    simulateBlackFriday60
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-amber-400 hover:bg-slate-700 border border-amber-500/40'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>
                    {simulateBlackFriday60
                      ? 'Black Friday -60% Activa'
                      : 'Aplicar Promo Black Friday -60%'}
                  </span>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleDownloadPdf(viewFormat)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF ({viewFormat})</span>
              </button>

              <button
                onClick={handleBrowserPrint}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={handleSendEmail}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">E-mail</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            </div>
          </div>
        </div>

        {emailStatus && (
          <div className="px-4 sm:px-6 py-2 bg-sky-50 dark:bg-sky-950/50 border-b border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 no-print">
            {emailStatus}
          </div>
        )}

        {/* Notice Banner for AGT Status & Tax Rules */}
        <div className="px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 no-print">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>ESTADO FISCAL AGT:</strong>{' '}
              <span className="underline font-bold">
                {AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label ||
                  invoice.agtTransmissionStatus}
              </span>{' '}
              · <strong>IVA 14%</strong> + <strong>Retenção na Fonte 6,5%</strong>
              {isPromoActive ? ' · PROMOÇÃO BLACK FRIDAY (-60%) APLICADA' : ''}
            </span>
          </div>
        </div>

        {/* Document Canvas — Responsive for Mobile & Desktop */}
        <div className="p-2 sm:p-6 bg-slate-100 dark:bg-slate-950 max-h-[78vh] overflow-y-auto flex justify-center">
          {viewFormat === 'TERMICO' ? (
            <div
              className={`w-full ${
                thermalDeviceWidth === '58mm_mobile'
                  ? 'max-w-[295px] p-3.5 text-[11px]'
                  : 'max-w-[360px] p-4 sm:p-5 text-xs'
              } bg-white text-slate-900 shadow-lg border-x border-t-4 border-b-4 border-slate-900 rounded-md font-mono space-y-3 transition-all mx-auto`}
            >
              {/* Header: Company Identity & Logo */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2.5 space-y-1">
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt={company.commercialName}
                    className="h-11 w-auto mx-auto object-contain mb-1"
                  />
                )}
                <p className="font-bold text-xs sm:text-sm uppercase tracking-tight break-words">
                  {company.commercialName}
                </p>
                <p className="text-[10px] sm:text-[11px] leading-tight break-words">
                  {company.name}
                </p>
                <p className="text-[10px] sm:text-[11px] font-bold">NIF: {company.nif}</p>
                <p className="text-[10px] text-slate-600 leading-tight">
                  {company.address} · {company.province}
                </p>
                <p className="text-[10px] text-slate-600">
                  Tel: {company.phone} · {company.taxRegime}
                </p>
              </div>

              {/* Document Meta & Black Friday Callout */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2 space-y-0.5">
                <p className="font-bold text-xs sm:text-sm">{invoice.docType.toUpperCase()}</p>
                <p className="font-bold text-sky-800">{invoice.docNumber}</p>
                <div className="flex items-center justify-center gap-2 text-[10px] pt-0.5">
                  <span className="font-bold">{exemplarText}</span>
                  <span>·</span>
                  <span>{invoice.issueDate}</span>
                </div>
                {isPromoActive && (
                  <div className="mt-1.5 py-1 px-2 rounded bg-slate-900 text-amber-300 font-bold text-[10px] tracking-wide">
                    PROMOÇÃO BLACK FRIDAY (-60% DESCONTO)
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="border-b border-dashed border-slate-400 pb-2 text-[10px] sm:text-[11px] space-y-0.5">
                <p className="break-words">
                  <strong>Cliente:</strong> {invoice.clientName}
                </p>
                <p>
                  <strong>NIF:</strong> {invoice.clientNif || '999999999 (Consumidor Final)'}
                </p>
                <p className="truncate">
                  <strong>Meio Pag.:</strong> {invoice.paymentMethod}
                </p>
              </div>

              {/* Items Table — Mobile & Desktop Adjusted */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-600 border-b border-slate-200 pb-1">
                  <span>ARTIGO (QTD x PREÇO · IVA)</span>
                  <span>TOTAL (AOA)</span>
                </div>
                {parsedItems.map((item, idx) => {
                  const itemDisc = isPromoActive
                    ? Math.max(item.discountPercent, BLACK_FRIDAY_DISCOUNT_PERCENT)
                    : item.discountPercent;
                  const itemGross = item.unitPrice * item.quantity;
                  const itemNet = itemGross * (1 - itemDisc / 100);
                  const itemRate = item.taxRate > 0 ? item.taxRate : 14;
                  const itemTotalWithIva = itemNet * (1 + itemRate / 100);

                  return (
                    <div key={idx} className="space-y-0.5 text-[10px] sm:text-[11px]">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-slate-900 break-words leading-tight">
                          {item.quantity}x {item.description}
                        </span>
                        <span className="tabular-nums font-bold shrink-0">
                          {formatKz(itemTotalWithIva)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[9.5px] text-slate-600">
                        <span>Unit: {formatKz(item.unitPrice)}</span>
                        <span>·</span>
                        <span>Desc: {itemDisc}%</span>
                        <span>·</span>
                        <span>IVA: {itemRate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Fiscal Summary: Subtotal, Black Friday 60%, IVA 14%, Retenção 6.5% */}
              <div className="space-y-1 text-[10px] sm:text-[11px] border-b border-dashed border-slate-400 pb-2.5">
                {effectiveDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Valor Ilíquido s/ Desc.:</span>
                      <span className="tabular-nums">{formatKz(grossBeforeDiscount)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>
                        {isPromoActive ? 'Desconto Black Friday (60%):' : 'Desconto Comercial:'}
                      </span>
                      <span className="tabular-nums">-{formatKz(effectiveDiscount)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-slate-800">
                  <span>Incidência Tributável:</span>
                  <span className="tabular-nums font-semibold">{formatKz(effectiveSubtotal)}</span>
                </div>

                <div className="flex justify-between text-slate-800">
                  <span>IVA ({baseFiscal.ivaRate}% — Taxa Normal):</span>
                  <span className="tabular-nums font-semibold">+{formatKz(effectiveIva14)}</span>
                </div>

                <div className="flex justify-between text-red-700 font-semibold">
                  <span>Retenção na Fonte ({baseFiscal.withholdingRate}%):</span>
                  <span className="tabular-nums">-{formatKz(effectiveWithholding65)}</span>
                </div>

                <div className="pt-1.5 mt-1 border-t border-slate-300 flex justify-between text-xs font-bold text-slate-900">
                  <span>TOTAL FACTURA (c/ IVA):</span>
                  <span className="tabular-nums">{formatKz(effectiveTotalInvoice)}</span>
                </div>

                <div className="p-2 rounded bg-slate-900 text-white flex justify-between items-center text-xs font-bold mt-1">
                  <span>LÍQUIDO A PAGAR:</span>
                  <span className="tabular-nums text-amber-300">
                    {formatKz(effectiveNetPayable)}
                  </span>
                </div>
              </div>

              {/* Payment Channel & QR Code Footer */}
              <div className="flex flex-col items-center pt-1 space-y-2 text-center">
                <div className="w-full p-2 rounded bg-slate-50 border border-slate-200 text-[9.5px] text-slate-700 space-y-0.5">
                  <p className="font-bold text-slate-900">
                    MULTICAIXA EXPRESS: {MCX_EXPRESS_OFFICIAL_NUMBER} ({MCX_EXPRESS_BENEFICIARY})
                  </p>
                  {company.bankIban && <p className="truncate">IBAN: {company.bankIban}</p>}
                </div>

                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <QRCodeSVG
                    value={invoice.qrCodePayload}
                    size={thermalDeviceWidth === '58mm_mobile' ? 92 : 108}
                    level="M"
                  />
                </div>

                <p className="text-[9.5px] leading-tight text-slate-600">
                  <strong>{hash4}</strong> — Processado por ALHAN FACTURA · Decreto Presidencial n.º
                  71/25 (Angola)
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl bg-white text-slate-900 p-5 sm:p-8 shadow-sm border border-slate-200 space-y-6">
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
                      <strong>NIF:</strong> {company.nif} · <strong>Regime:</strong>{' '}
                      {company.taxRegime}
                    </p>
                    <p>
                      <strong>Sede:</strong> {company.address}, {company.municipality} —{' '}
                      {company.province}, Angola
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
                      AGT:{' '}
                      {AGT_STATE_LABELS[invoice.agtTransmissionStatus]?.label ||
                        invoice.agtTransmissionStatus}
                    </span>
                  </div>
                  {isPromoActive && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] font-bold">
                      <Percent className="w-3 h-3" />
                      <span>PROMOÇÃO BLACK FRIDAY -60%</span>
                    </div>
                  )}
                  <h4 className="text-xl font-bold text-slate-900 mt-2">
                    {invoice.docType.toUpperCase()}
                  </h4>
                  <p className="text-sm font-mono font-semibold text-sky-700">
                    {invoice.docNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    Série: {invoice.series} · Seq. N.º {invoice.sequentialNumber}
                  </p>
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
                    <strong>Condições:</strong> {invoice.paymentTerms} · <strong>Meio:</strong>{' '}
                    {invoice.paymentMethod}
                  </p>
                  <p className="text-slate-700">
                    <strong>Enquadramento:</strong> IVA 14% · Retenção na Fonte 6,5% (AOA)
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição do Produto / Serviço</th>
                      <th className="py-2.5 px-3 text-right">Qtd.</th>
                      <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desc.</th>
                      <th className="py-2.5 px-3 text-right">IVA (14%)</th>
                      <th className="py-2.5 px-3 text-right">Total c/ IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedItems.map((line, i) => {
                      const lineDisc = isPromoActive
                        ? Math.max(line.discountPercent, BLACK_FRIDAY_DISCOUNT_PERCENT)
                        : line.discountPercent;
                      const lineRate = line.taxRate > 0 ? line.taxRate : 14;
                      const lineNet = line.unitPrice * line.quantity * (1 - lineDisc / 100);
                      const lineTotalWithIva = lineNet * (1 + lineRate / 100);
                      return (
                        <tr key={i}>
                          <td className="py-2.5 px-3 font-mono">{line.code}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {line.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {line.quantity} {line.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {formatKz(line.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-700">
                            {lineDisc}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{lineRate}%</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {formatKz(lineTotalWithIva)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & QR Code Section */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-2 items-start">
                <div className="sm:col-span-6 flex items-start gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
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
                      <strong>Coordenadas Bancárias ({company.bankName}):</strong>{' '}
                      {company.bankIban || 'Não definido'}
                    </p>
                    <p>
                      <strong>Multicaixa Express Oficial:</strong> {MCX_EXPRESS_OFFICIAL_NUMBER} (
                      {MCX_EXPRESS_BENEFICIARY})
                    </p>
                    {invoice.notes && (
                      <p>
                        <strong>Observações:</strong> {invoice.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-6 space-y-2 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {effectiveDiscount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Valor Bruto Ilíquido:</span>
                      <span className="font-mono">{formatKz(grossBeforeDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>
                      {isPromoActive
                        ? 'Desconto Promoção Black Friday (60%):'
                        : 'Descontos Comerciais:'}
                    </span>
                    <span className="font-mono">-{formatKz(effectiveDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal / Incidência Tributável:</span>
                    <span className="font-mono font-semibold">{formatKz(effectiveSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Imposto IVA ({baseFiscal.ivaRate}% — Taxa Normal):</span>
                    <span className="font-mono font-semibold">+{formatKz(effectiveIva14)}</span>
                  </div>
                  <div className="flex justify-between text-red-700 font-semibold">
                    <span>Retenção na Fonte ({baseFiscal.withholdingRate}% — I. Industrial):</span>
                    <span className="font-mono">-{formatKz(effectiveWithholding65)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 flex justify-between items-baseline text-xs font-bold text-slate-800">
                    <span>TOTAL DA FACTURA (c/ IVA 14%):</span>
                    <span className="font-mono">{formatKz(effectiveTotalInvoice)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 text-white flex justify-between items-baseline text-sm font-bold">
                    <span>LÍQUIDO A PAGAR (AOA):</span>
                    <span className="font-mono text-base text-amber-300">
                      {formatKz(effectiveNetPayable)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic pt-1">
                    Por extenso: {valorPorExtensoKz(effectiveNetPayable)}
                  </p>
                </div>
              </div>

              {/* Legal Footer */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {hash4} — Processado por software em{' '}
                  <strong>PREPARAÇÃO PARA CERTIFICAÇÃO AGT</strong> · ALHAN FACTURA v2.5
                </span>
                <span>
                  ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA · Tel: 922 021 211 ·
                  facturao@alhan.pro
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
