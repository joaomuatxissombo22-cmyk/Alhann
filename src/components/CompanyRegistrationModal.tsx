import React, { useState } from 'react';
import { Building2, CheckCircle2, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AgtAdhesionStatusType,
  BillingCycleType,
  Company,
  PlanIdType,
  TaxRegimeType,
  VatSchemeType,
} from '../types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  calcularDataVencimentoSubscricao,
  comprimirImagemParaBase64,
  getLuandaIsoDate,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
  PROVINCIAS_ANGOLA,
} from '../lib/angolaUtils';

interface CompanyRegistrationProps {
  userEmail: string;
  userName: string;
  defaultPlan: PlanIdType;
  defaultCycle: BillingCycleType;
  onRegisterCompany: (
    companyData: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    seedInitialData: boolean
  ) => Promise<void>;
  onSignOut: () => void;
}

export const CompanyRegistrationModal: React.FC<CompanyRegistrationProps> = ({
  userEmail,
  userName,
  defaultPlan,
  defaultCycle,
  onRegisterCompany,
  onSignOut,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [seedData, setSeedData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [form, setForm] = useState({
    name: 'Kwanza Comércio Geral & Prestação de Serviços, Lda.',
    commercialName: 'Kwanza Solutions Angola',
    nif: '5402891045',
    address: 'Avenida Comandante Valódia, Edifício Atrium, 4.º Andar, Ingombota',
    province: 'Luanda',
    municipality: 'Luanda',
    phone: '+244 923 450 890',
    email: userEmail || 'geral@kwanzasolutions.ao',
    economicActivity: 'Comércio a Grosso, Consultoria Técnica e Prestação de Serviços Mercantis',
    taxRegime: 'Regime Geral' as TaxRegimeType,
    vatScheme: 'IVA 14% (Geral)' as VatSchemeType,
    responsibleName: userName || 'Eng. João Muatxissombo',
    bankName: 'BAI — Banco Angolano de Investimentos',
    bankIban: 'AO06.0040.0000.4829.1039.4820.1',
    establishmentsCount: 2,
    planId: defaultPlan,
    billingCycle: defaultCycle,
    agtAdhesionStatus: 'em_homologacao' as AgtAdhesionStatusType,
    agtCertificateRef: 'CERT-AO-JWS-7125',
    logoUrl: '',
  });

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setErrorMsg(null);
    try {
      const compressed = await comprimirImagemParaBase64(file, 280, 32000);
      setForm((prev) => ({ ...prev, logoUrl: compressed }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar o logótipo.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.name.trim() || !form.nif.trim() || form.nif.trim().length < 5) {
      setErrorMsg(
        'Por favor, indique uma denominação social e um NIF válido (mínimo 5 caracteres alfanuméricos).'
      );
      return;
    }
    setSubmitting(true);
    try {
      const todayIso = getLuandaIsoDate();
      const endDateIso = calcularDataVencimentoSubscricao(todayIso, form.billingCycle);
      await onRegisterCompany(
        {
          name: form.name.trim().slice(0, 160),
          commercialName: form.commercialName.trim().slice(0, 160),
          nif: form.nif.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30),
          address: form.address.trim().slice(0, 250),
          province: form.province,
          municipality: form.municipality.trim().slice(0, 80),
          phone: form.phone.trim().slice(0, 40),
          email: form.email.trim().slice(0, 120),
          economicActivity: form.economicActivity.trim().slice(0, 160),
          taxRegime: form.taxRegime,
          vatScheme: form.vatScheme,
          responsibleName: form.responsibleName.trim().slice(0, 120),
          bankName: form.bankName.trim().slice(0, 100),
          bankIban: form.bankIban.trim().slice(0, 60),
          establishmentsCount: Math.max(1, Math.min(500, Number(form.establishmentsCount) || 1)),
          planId: form.planId,
          billingCycle: form.billingCycle,
          subscriptionStatus: 'activa',
          agtStatus: 'preparacao_certificacao',
          agtCertificateRef: form.agtCertificateRef.trim().slice(0, 100) || 'CERT-AO-PREP-7125',
          agtEnvironment: 'sandbox_teste',
          logoUrl: form.logoUrl || '',
          subscriptionStartDate: todayIso,
          subscriptionEndDate: endDateIso,
          agtAdhesionStatus: form.agtAdhesionStatus,
        },
        seedData
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registar empresa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 py-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={ALHAN_OFFICIAL_LOGO_URL}
              alt="ALHAN Logo"
              className="h-10 w-auto rounded-lg bg-white px-2 py-1 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight font-display">
                Registo Oficial de Empresa no ALHAN FACTURA
              </h1>
              <p className="text-xs text-slate-300">
                Configuração Multi-Tenant · Moeda: Kwanza (AOA) · Multicaixa Express Oficial: {MCX_EXPRESS_OFFICIAL_NUMBER} ({MCX_EXPRESS_BENEFICIARY})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs font-medium text-slate-300 hover:text-white underline self-start sm:self-auto"
          >
            Terminar Sessão
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Legal Identity & Company Logo */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              1. Identificação Legal, Logótipo da Empresa e Adesão Fiscal AGT
            </h2>

            {/* Company Logo Upload Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logótipo da Empresa"
                    className="w-16 h-16 rounded-lg object-contain bg-white border border-slate-300 p-1 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-200 text-slate-600 flex flex-col items-center justify-center border border-dashed border-slate-400 shrink-0">
                    <Building2 className="w-6 h-6" />
                    <span className="text-[9px] font-semibold mt-0.5">Sem Logo</span>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    Logótipo Oficial da Empresa (Impresso nas Facturas A4 e no Painel)
                  </p>
                  <p className="text-slate-500">
                    Carregue a imagem da sua marca empresarial (PNG ou JPG). Será optimizada automaticamente para impressão fiscal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  <span>{logoUploading ? 'A processar...' : 'Carregar Logótipo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logoUrl: '' })}
                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                    title="Remover logótipo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome ou Denominação Social *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  NIF (Contribuinte AGT) *
                </label>
                <input
                  type="text"
                  required
                  value={form.nif}
                  onChange={(e) => setForm({ ...form, nif: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Comercial *</label>
                <input
                  type="text"
                  required
                  value={form.commercialName}
                  onChange={(e) => setForm({ ...form, commercialName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Actividade Económica Principal (CAE) *
                </label>
                <input
                  type="text"
                  required
                  value={form.economicActivity}
                  onChange={(e) => setForm({ ...form, economicActivity: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Regime Fiscal *</label>
                <select
                  value={form.taxRegime}
                  onChange={(e) => setForm({ ...form, taxRegime: e.target.value as TaxRegimeType })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  <option value="Regime Geral">Regime Geral</option>
                  <option value="Regime Simplificado">Regime Simplificado</option>
                  <option value="Regime de Exclusão">Regime de Exclusão</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Enquadramento em IVA *
                </label>
                <select
                  value={form.vatScheme}
                  onChange={(e) => setForm({ ...form, vatScheme: e.target.value as VatSchemeType })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  <option value="IVA 14% (Geral)">IVA 14% (Geral)</option>
                  <option value="IVA 7% (Simplificado)">IVA 7% (Simplificado)</option>
                  <option value="IVA 5% (Cesta Básica)">IVA 5% (Cesta Básica)</option>
                  <option value="Isento de IVA">Isento de IVA</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsável da Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={form.responsibleName}
                  onChange={(e) => setForm({ ...form, responsibleName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Estado de Adesão à Facturação Electrónica AGT
                </label>
                <select
                  value={form.agtAdhesionStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      agtAdhesionStatus: e.target.value as AgtAdhesionStatusType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  <option value="em_homologacao">
                    Em Homologação / Testes no Portal do Parceiro AGT
                  </option>
                  <option value="aderente_activo">
                    Contribuinte Aderente Activo (Comunicação API AGT)
                  </option>
                  <option value="nao_aderente">
                    Em Preparação / Submissão via Ficheiro SAF-T (AO)
                  </option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ref. Certificado / Chave Fiscal
                </label>
                <input
                  type="text"
                  value={form.agtCertificateRef}
                  onChange={(e) => setForm({ ...form, agtCertificateRef: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Contacts */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              2. Sede Social, Contactos e Estabelecimentos Comerciais
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Endereço Completo da Sede *
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Província *</label>
                <select
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  {PROVINCIAS_ANGOLA.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Município *</label>
                <input
                  type="text"
                  required
                  value={form.municipality}
                  onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone *</label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Oficial *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Banking & Subscription */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              3. Coordenadas Bancárias (Impressas nas Facturas) e Plano Contratado
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Banco Principal</label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">IBAN (AO06...)</label>
                <input
                  type="text"
                  value={form.bankIban}
                  onChange={(e) => setForm({ ...form, bankIban: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  N.º Estabelecimentos
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.establishmentsCount}
                  onChange={(e) =>
                    setForm({ ...form, establishmentsCount: Number(e.target.value) || 1 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Plano Subscrito (Promoção Black Friday -60% Aplicada)
                </label>
                <select
                  value={form.planId}
                  onChange={(e) => setForm({ ...form, planId: e.target.value as PlanIdType })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  <option value="starter">PLANO STARTER — 7.400 Kz/mês (Antes: 18.500 Kz · -60% Black Friday)</option>
                  <option value="profissional">PLANO PROFISSIONAL — 16.800 Kz/mês (Antes: 42.000 Kz · -60% Black Friday)</option>
                  <option value="empresarial">PLANO EMPRESARIAL — 35.600 Kz/mês (Antes: 89.000 Kz · -60% Black Friday)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Periodicidade de Facturação da Subscrição
                </label>
                <select
                  value={form.billingCycle}
                  onChange={(e) =>
                    setForm({ ...form, billingCycle: e.target.value as BillingCycleType })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:border-sky-600 focus:outline-none"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral (-5%)</option>
                  <option value="semestral">Semestral (-10%)</option>
                  <option value="anual">Anual (-20%)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 flex items-start justify-between gap-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={seedData}
                onChange={(e) => setSeedData(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <div>
                <span className="font-bold text-slate-900 block">
                  Pré-carregar catálogo inicial de produtos, clientes, fornecedores e facturas de exemplo em Angola
                </span>
                <span className="text-slate-600 block mt-0.5">
                  Recomendado para testar de imediato todos os módulos (Facturação, API AGT, SAF-T AO, Inventário, Tesouraria e Relatórios) com movimentos reais gravados na base de dados.
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Área privada isolada criptograficamente · Nenhuma outra empresa terá acesso aos seus dados.
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || logoUploading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting ? 'A criar ambiente empresarial...' : 'Concluir Registo e Aceder ao Painel'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
