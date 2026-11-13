import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Monitor,
  Printer,
  Receipt,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { Company, Invoice, InvoiceLineItem } from '../types/models';
import {
  AGT_STATE_LABELS,
  calcularResumoFiscalFactura,
  exportarFacturaPDF,
  formatKz,
  IVA_STANDARD_RATE_AO,
  RETENCAO_FONTE_RATE_AO,
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
  const [format, setFormat] = useState<'A4' | 'TERMICO_80MM' | 'TERMICO_58MM'>('A4');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!invoice) return null;

  let items: InvoiceLineItem[] = [];
  try {
    items = JSON.parse(invoice.itemsSummary);
  } catch {
    items = [];
  }

  const isOriginal = (invoice.printCount || 0) === 0;
  const viaLabel = isOriginal ? 'ORIGINAL' : `2.ª VIA (${invoice.printCount + 1}.ª Impressão)`;
  const fiscal = calcularResumoFiscalFactura(invoice);
  const hash4 = `${invoice.hashCode[0] || 'A'}${invoice.hashCode[10] || 'L'}${invoice.hashCode[20] || 'H'}${invoice.hashCode[30] || 'N'}`;
  const agtStateInfo =
    AGT_STATE_LABELS[invoice.agtTransmissionStatus] || AGT_STATE_LABELS.pendente_transmissao;

  const handlePrint = async () => {
    await onIncrementPrintCount(invoice);
    window.print();
  };

  const handleDownloadPdf = async (pdfMode: 'A4' | 'TERMICO') => {
    exportarFacturaPDF(invoice, company, pdfMode);
    await onIncrementPrintCount(invoice);
  };

  const handleShareWhatsApp = () => {
    const text = [
      `*${company.name.toUpperCase()}*`,
      `NIF: ${company.nif}`,
      `Documento: *${invoice.docType.toUpperCase()} ${invoice.docNumber}*`,
      `Cliente: ${invoice.clientName} (NIF: ${invoice.clientNif || '999999999'})`,
      `Data de Emissão: ${invoice.issueDate}`,
      `Incidência Tributável: ${formatKz(fiscal.subtotal)}`,
      fiscal.discountTotal > 0 ? `Desconto Comercial: - ${formatKz(fiscal.discountTotal)}` : null,
      `IVA (${IVA_STANDARD_RATE_AO}%): + ${formatKz(fiscal.taxTotal)}`,
      `Retenção na Fonte (${RETENCAO_FONTE_RATE_AO}%): - ${formatKz(fiscal.withholdingAmount)}`,
      `*Total da Factura: ${formatKz(fiscal.totalAmount)}*`,
      `*Valor Líquido a Pagar: ${formatKz(fiscal.netPayableAmount)}*`,
      company.bankIban ? `IBAN (${company.bankName}): ${company.bankIban}` : null,
      `Hash SHA-256: ${hash4}-${invoice.hashCode.slice(0, 12)}`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareFeedback('Documento preparado para envio via WhatsApp.');
  };

  const handleShareEmail = () => {
    const subject = `${invoice.docType} ${invoice.docNumber} — ${company.name}`;
    const body = [
      `Exmo.(a) Sr.(a) ${invoice.clientName},`,
      '',
      `Enviamos os dados referentes ao documento fiscal ${invoice.docType} n.º ${invoice.docNumber}, emitido em ${invoice.issueDate}:`,
      '',
      `- Emitente: ${company.name} (NIF: ${company.nif})`,
      `- Destinatário: ${invoice.clientName} (NIF: ${invoice.clientNif || '999999999'})`,
      `- Incidência Tributável: ${formatKz(fiscal.subtotal)}`,
      `- IVA (${IVA_STANDARD_RATE_AO}%): ${formatKz(fiscal.taxTotal)}`,
      `- Retenção na Fonte (${RETENCAO_FONTE_RATE_AO}%): ${formatKz(fiscal.withholdingAmount)}`,
      `- Total da Factura: ${formatKz(fiscal.totalAmount)}`,
      `- Valor Líquido a Pagar: ${formatKz(fiscal.netPayableAmount)} (${valorPorExtensoKz(fiscal.netPayableAmount)})`,
      company.bankIban ? `- Coordenadas Bancárias (${company.bankName}): ${company.bankIban}` : '',
      `- Controlo Criptográfico SHA-256: ${hash4} (${invoice.hashCode.slice(0, 16)})`,
      '',
      'Com os melhores cumprimentos,',
      company.name,
      company.phone ? `Tel.: ${company.phone}` : '',
      company.email ? `E-mail: ${company.email}` : '',
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShareFeedback('Cliente de e-mail aberto com os dados fiscais do documento.');
  };

  const isThermal = format === 'TERMICO_80MM' || format === 'TERMICO_58MM';
  const isMobile58 = format === 'TERMICO_58MM';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl my-auto space-y-3">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFormat('A4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                format === 'A4'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Factura A4 (210 × 297 mm)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('TERMICO_80MM')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                format === 'TERMICO_80MM'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Talão Térmico 80mm (Computador)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('TERMICO_58MM')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                format === 'TERMICO_58MM'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Talão Térmico 58mm (Móvel)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadPdf('A4')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF A4</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPdf('TERMICO')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>PDF Talão Térmico</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir ({isOriginal ? 'ORIGINAL' : '2.ª VIA'})</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors border border-slate-700"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleShareEmail}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition-colors border border-slate-700"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>E-mail</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="no-print px-4 py-2 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs flex items-center justify-between">
            <span>{shareFeedback}</span>
            <button
              type="button"
              onClick={() => setShareFeedback(null)}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Document Preview Surface (Readjusted A4 & Thermal 80mm / 58mm) */}
        <div className="flex justify-center overflow-x-auto py-1">
          {isThermal ? (
            /* TALÃO TÉRMICO REAJUSTADO (80MM COMPUTADOR POS / 58MM DISPOSITIVO MÓVEL) */
            <div
              className={`${
                isMobile58
                  ? 'w-[228px] sm:w-[242px] p-3 text-[10px]'
                  : 'w-[304px] sm:w-[324px] p-4 text-[11px]'
              } max-w-full bg-white text-slate-950 rounded-sm shadow-2xl border border-slate-300 font-mono leading-snug space-y-2.5 mx-auto invoice-print-container`}
            >
              {/* Company Header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2.5 space-y-1">
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-9 w-auto object-contain mx-auto mb-1 rounded"
                  />
                )}
                <p className="font-bold text-xs uppercase tracking-tight break-words">
                  {company.name}
                </p>
                {company.commercialName && company.commercialName !== company.name && (
                  <p className="text-[10px] text-slate-700 font-semibold break-words">
                    {company.commercialName}
                  </p>
                )}
                <p className="font-bold">NIF: {company.nif}</p>
                {company.address && (
                  <p className="text-[10px] text-slate-700 break-words">
                    {company.address} — {company.municipality}, {company.province}
                  </p>
                )}
                {(company.phone || company.email) && (
                  <p className="text-[10px] text-slate-700 break-words">
                    {[company.phone ? `Tel: ${company.phone}` : '', company.email || '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <div className="pt-1 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-slate-900 text-white font-bold text-[9px] uppercase">
                    {isOriginal ? 'ORIGINAL' : '2.ª VIA'}
                  </span>
                  <span className="px-1.5 py-0.5 border border-slate-400 text-[9px] font-bold">
                    {isMobile58 ? '58MM MÓVEL' : '80MM POS'}
                  </span>
                </div>
              </div>

              {/* Document Metadata & Client */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between gap-2">
                  <span className="font-bold uppercase">{invoice.docType}:</span>
                  <span className="font-bold">{invoice.docNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Data Emissão:</span>
                  <span>{invoice.issueDate}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Meio Pag.:</span>
                  <span className="truncate max-w-[140px] text-right">{invoice.paymentMethod}</span>
                </div>
                <div className="pt-1 border-t border-dotted border-slate-300 mt-1">
                  <p className="truncate font-semibold">Cliente: {invoice.clientName}</p>
                  <p className="font-bold">
                    NIF Cliente: {invoice.clientNif || '999999999 (Consumidor Final)'}
                  </p>
                </div>
              </div>

              {/* Line Items */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-1.5">
                <div className="flex justify-between font-bold text-[9px] border-b border-slate-300 pb-1 uppercase">
                  <span>Artigo / Qtd x Preço</span>
                  <span>Total (Kz)</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5 text-[10px]">
                    <p className="font-semibold text-slate-900 break-words leading-tight">
                      {item.code ? `[${item.code}] ` : ''}
                      {item.description}
                    </p>
                    <div className="flex justify-between text-slate-700">
                      <span>
                        {item.quantity}x {formatKz(item.unitPrice)} (IVA {item.taxRate || 14}%)
                        {item.discountPercent > 0 ? ` -${item.discountPercent}%` : ''}
                      </span>
                      <span className="font-bold text-slate-950">{formatKz(item.lineTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tax & Totals Breakdown */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Incidência Líquida:</span>
                  <span>{formatKz(fiscal.subtotal)}</span>
                </div>
                {fiscal.discountTotal > 0 && (
                  <div className="flex justify-between text-slate-800">
                    <span>Desconto Comercial:</span>
                    <span>- {formatKz(fiscal.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>IVA ({fiscal.ivaRate}%):</span>
                  <span>+ {formatKz(fiscal.taxTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Retenção Fonte ({fiscal.withholdingRate}%):</span>
                  <span>- {formatKz(fiscal.withholdingAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-900">
                  <span>TOTAL FACTURA:</span>
                  <span>{formatKz(fiscal.totalAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-[11px] bg-slate-900 text-white px-1.5 py-1 rounded-xs">
                  <span>LÍQUIDO A PAGAR:</span>
                  <span>{formatKz(fiscal.netPayableAmount)}</span>
                </div>
                <p className="text-[9px] text-slate-600 italic leading-tight pt-0.5">
                  Extenso: {valorPorExtensoKz(fiscal.netPayableAmount)}
                </p>
              </div>

              {/* Payment Coordinates (Client Company Only) */}
              {(company.bankIban || company.bankName || company.phone) && (
                <div className="border-b border-dashed border-slate-400 pb-2 text-[9px] space-y-0.5">
                  <p className="font-bold uppercase text-slate-800">Coordenadas de Pagamento:</p>
                  {company.bankName && <p>Banco: {company.bankName}</p>}
                  {company.bankIban && <p className="break-all">IBAN: {company.bankIban}</p>}
                  {company.phone && <p>Contacto: {company.phone}</p>}
                </div>
              )}

              {/* QR Code & Hash */}
              <div className="text-center space-y-1.5 pt-1">
                <div className="flex justify-center">
                  <QRCodeSVG
                    value={invoice.qrCodePayload || invoice.docNumber}
                    size={isMobile58 ? 84 : 100}
                    level="M"
                  />
                </div>
                <p className="text-[9px] font-bold">
                  {hash4} — Hash SHA-256: {invoice.hashCode.slice(0, 12)}
                </p>
                <p className="text-[8px] text-slate-600">
                  Regime Jurídico das Facturas · D.P. n.º 71/25 · {agtStateInfo.label}
                </p>
                <p className="text-[8px] font-semibold text-slate-700 uppercase">
                  {company.name} · NIF {company.nif}
                </p>
              </div>
            </div>
          ) : (
            /* FACTURA A4 OFICIAL REAJUSTADA (210MM X 297MM PROPORÇÃO PADRÃO A4) */
            <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 rounded-sm shadow-2xl border border-slate-300 p-6 sm:p-10 flex flex-col justify-between text-[11px] leading-relaxed mx-auto invoice-print-container">
              {/* Top & Middle Content Wrapper */}
              <div className="space-y-6">
                {/* 1. Top Header: Client Company Identity & Document Badge */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-5">
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex items-center gap-3">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt={`Logótipo ${company.name}`}
                          className="h-14 w-auto max-w-[150px] object-contain rounded border border-slate-200 bg-white p-1"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0">
                          {(company.commercialName || company.name || 'EM').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight leading-snug">
                          {company.name}
                        </h2>
                        {company.commercialName && company.commercialName !== company.name && (
                          <p className="text-xs font-semibold text-sky-700">
                            {company.commercialName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-0.5 pt-1">
                      <p>
                        <strong>NIF:</strong> <span className="font-mono font-bold">{company.nif}</span> ·{' '}
                        <strong>Regime Fiscal:</strong> {company.taxRegime} ({company.vatScheme})
                      </p>
                      {company.address && (
                        <p>
                          <strong>Endereço:</strong> {company.address}, {company.municipality} —{' '}
                          {company.province}, Angola
                        </p>
                      )}
                      {(company.phone || company.email) && (
                        <p>
                          {company.phone && (
                            <>
                              <strong>Contacto:</strong> {company.phone}
                            </>
                          )}
                          {company.phone && company.email && ' · '}
                          {company.email && (
                            <>
                              <strong>E-mail:</strong> {company.email}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-1.5 shrink-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{viaLabel}</span>
                    </div>
                    <h3 className="text-xl font-bold font-mono text-slate-900 uppercase pt-0.5">
                      {invoice.docType}
                    </h3>
                    <p className="text-sm font-mono font-bold text-sky-700">{invoice.docNumber}</p>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>
                        <strong>Série:</strong> <span className="font-mono">{invoice.series}</span>
                      </p>
                      <p>
                        <strong>Data de Emissão:</strong>{' '}
                        <span className="font-mono">{invoice.issueDate}</span>
                      </p>
                      <p>
                        <strong>Vencimento:</strong>{' '}
                        <span className="font-mono">{invoice.dueDate}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Client & Payment Terms Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Exmo.(s) Sr.(s) / Entidade Destinatária
                    </p>
                    <p className="text-sm font-bold text-slate-900">{invoice.clientName}</p>
                    <p className="text-[11px] text-slate-700 font-mono">
                      <strong>NIF do Adquirente:</strong>{' '}
                      {invoice.clientNif || '999999999 (Consumidor Final)'}
                    </p>
                    <p className="text-[11px] text-slate-700">
                      <strong>Endereço:</strong> {invoice.clientAddress || 'Luanda, Angola'}
                    </p>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Condições Comerciais e Liquidação
                    </p>
                    <p className="text-[11px] text-slate-700">
                      <strong>Condição de Pagamento:</strong> {invoice.paymentTerms}
                    </p>
                    <p className="text-[11px] text-slate-700">
                      <strong>Meio de Pagamento:</strong> {invoice.paymentMethod}
                    </p>
                    <p className="text-[11px] text-slate-700">
                      <strong>Moeda Fiscal:</strong> Kwanza Angolano — AOA (Kz)
                    </p>
                  </div>
                </div>

                {/* 3. Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-[10px] font-bold uppercase text-slate-700 bg-slate-100/80">
                        <th className="py-2.5 px-2.5">Código</th>
                        <th className="py-2.5 px-2.5">Descrição do Artigo / Serviço</th>
                        <th className="py-2.5 px-2 text-right">Qtd.</th>
                        <th className="py-2.5 px-2 text-right">Preço Unit. (Kz)</th>
                        <th className="py-2.5 px-2 text-right">Desc.</th>
                        <th className="py-2.5 px-2 text-right">Taxa IVA</th>
                        <th className="py-2.5 px-2.5 text-right">Total (Kz)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-2.5 font-mono text-slate-600">{item.code}</td>
                          <td className="py-2.5 px-2.5 font-medium text-slate-900">
                            {item.description}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {formatKz(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {item.discountPercent > 0 ? `${item.discountPercent}%` : '0%'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {item.taxRate || IVA_STANDARD_RATE_AO}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900">
                            {formatKz(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Tax Summary, Bank Coordinates & QR Code */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t-2 border-slate-900">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-slate-500">
                        Valor Líquido por Extenso (Moeda Oficial AOA)
                      </p>
                      <p className="text-xs font-semibold text-slate-900 italic">
                        « {valorPorExtensoKz(fiscal.netPayableAmount)} »
                      </p>
                    </div>

                    {(company.bankName || company.bankIban || company.phone || invoice.notes) && (
                      <div className="p-3.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                        <p className="font-bold text-slate-800 uppercase text-[10px]">
                          Coordenadas Bancárias e Pagamento ({company.name})
                        </p>
                        {(company.bankName || company.bankIban) && (
                          <p className="font-mono text-slate-700">
                            {company.bankName ? `${company.bankName}` : ''}
                            {company.bankName && company.bankIban ? ' · IBAN: ' : ''}
                            {company.bankIban || ''}
                          </p>
                        )}
                        {company.phone && (
                          <p className="font-mono text-slate-700">
                            Contacto Empresarial: <strong>{company.phone}</strong>
                          </p>
                        )}
                        {invoice.notes && (
                          <p className="text-slate-600 pt-1">
                            <strong>Observações:</strong> {invoice.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tax Summary Table (Quadro Resumo de Impostos) */}
                    <div className="rounded-lg border border-slate-200 overflow-hidden text-[10px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-2.5">Imposto / Retenção</th>
                            <th className="py-1.5 px-2.5 text-right">Taxa</th>
                            <th className="py-1.5 px-2.5 text-right">Incidência (AOA)</th>
                            <th className="py-1.5 px-2.5 text-right">Valor Imposto (AOA)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          <tr>
                            <td className="py-1.5 px-2.5 font-sans font-medium">
                              IVA — Regime Geral Angola
                            </td>
                            <td className="py-1.5 px-2.5 text-right">{fiscal.ivaRate}%</td>
                            <td className="py-1.5 px-2.5 text-right">{formatKz(fiscal.subtotal)}</td>
                            <td className="py-1.5 px-2.5 text-right font-bold">
                              {formatKz(fiscal.taxTotal)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 px-2.5 font-sans font-medium">
                              Retenção na Fonte (Lei Industrial)
                            </td>
                            <td className="py-1.5 px-2.5 text-right">{fiscal.withholdingRate}%</td>
                            <td className="py-1.5 px-2.5 text-right">{formatKz(fiscal.subtotal)}</td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-amber-800">
                              - {formatKz(fiscal.withholdingAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-1">
                      <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                      <div>
                        <p className="font-mono font-bold text-slate-800">
                          {hash4} — Assinatura Digital SHA-256: {invoice.hashCode.slice(0, 24)}...
                        </p>
                        <p>
                          Documento emitido em conformidade com o Decreto Presidencial n.º 71/25 · SAF-T (AO) 1.01_01
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Financial Totals & QR Code */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Incidência Tributável (Líquido):</span>
                        <span className="font-mono font-semibold">{formatKz(fiscal.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Descontos Comerciais:</span>
                        <span className="font-mono font-semibold">
                          - {formatKz(fiscal.discountTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300 font-semibold">
                          Imposto IVA ({fiscal.ivaRate}%):
                        </span>
                        <span className="font-mono font-semibold text-sky-300">
                          + {formatKz(fiscal.taxTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-300 font-semibold">
                          Retenção na Fonte ({fiscal.withholdingRate}%):
                        </span>
                        <span className="font-mono font-semibold text-amber-300">
                          - {formatKz(fiscal.withholdingAmount)}
                        </span>
                      </div>
                      <div className="border-t border-slate-700 pt-2 flex justify-between text-xs font-bold">
                        <span>TOTAL DA FACTURA (AOA):</span>
                        <span className="font-mono text-sky-400">{formatKz(fiscal.totalAmount)}</span>
                      </div>
                      <div className="bg-slate-950/90 p-2 rounded-lg border border-emerald-500/40 flex justify-between text-xs font-bold">
                        <span className="text-emerald-300">LÍQUIDO A PAGAR:</span>
                        <span className="font-mono text-emerald-400">
                          {formatKz(fiscal.netPayableAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                        <span>Liquidado: {formatKz(invoice.paidAmount)}</span>
                        <span>
                          Pendente: {formatKz(Math.max(0, fiscal.netPayableAmount - invoice.paidAmount))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                        <p className="font-bold text-slate-900 uppercase">Código QR Fiscal AGT</p>
                        <p>Verificação de autenticidade</p>
                        <p className="font-mono text-[9px] text-slate-500">
                          {invoice.docNumber} · NIF {company.nif}
                        </p>
                      </div>
                      <div className="p-1.5 bg-white rounded border border-slate-200 shrink-0">
                        <QRCodeSVG
                          value={invoice.qrCodePayload || invoice.docNumber}
                          size={78}
                          level="M"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Bottom Legal Footer (Client Company Identity Only) */}
              <div className="pt-4 mt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
                <span>
                  Emitido por <strong>{company.name}</strong> · NIF {company.nif}
                  {company.phone ? ` · Tel: ${company.phone}` : ''}
                  {company.email ? ` · ${company.email}` : ''}
                </span>
                <span className="font-mono">
                  Processado por programa validado · D.P. n.º 71/25 · Página 1 de 1
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
