import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FileCheck2,
  FileSpreadsheet,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import { BillingCycleType, PlanIdType, SubscriptionPlanConfig } from '../types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  BLACK_FRIDAY_DISCOUNT_PERCENT,
  calcularPrecoCiclo,
  calcularPrecoOriginalSemBlackFriday,
  formatKz,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
} from '../lib/angolaUtils';
import { PWAInstallButton } from './PWAInstallBanner';
import escritorioAlhanImg from '../assets/images/Escrit_rio_moderno_da_ALHAN_FACTURA_ab5ac85c.png';
import reuniaoAlhanImg from '../assets/images/Reuni_o_Corporativa_ALHAN__Inova__o_em_Angola_3d80e89b.png';

declare module 'react' {
  interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
  }
}

interface LandingPageProps {
  plans: SubscriptionPlanConfig[];
  onSignInGoogle: (selectedPlan?: PlanIdType, selectedCycle?: BillingCycleType) => Promise<void>;
  onOpenLoginModal?: () => void;
  onOpenRegisterModal?: (selectedPlan?: PlanIdType, selectedCycle?: BillingCycleType) => void;
  isSigningIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  plans,
  onSignInGoogle,
  onOpenLoginModal,
  onOpenRegisterModal,
  isSigningIn,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycleType>('mensal');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legalModal, setLegalModal] = useState<'termos' | 'privacidade' | 'sobre' | null>(null);
  const [contactSent, setContactSent] = useState(false);
  const [contactForm, setContactForm] = useState({
    empresa: '',
    nif: '',
    telefone: '',
    email: '',
    mensagem: '',
  });
  const [heroImgError, setHeroImgError] = useState(false);
  const [featureImgError, setFeatureImgError] = useState(false);

  const cycleLabel: Record<BillingCycleType, string> = {
    mensal: '/ mês (Promo Black Friday -60%)',
    trimestral: '/ trimestre (Promo Black Friday -60%)',
    semestral: '/ semestre (Promo Black Friday -60%)',
    anual: '/ ano (Promo Black Friday -60%)',
  };

  const faqs = [
    {
      q: 'O ALHAN FACTURA cumpre os requisitos do Decreto Presidencial n.º 71/25 da AGT?',
      a: 'Sim. A arquitectura do ALHAN FACTURA foi integralmente desenhada segundo o Regime Jurídico das Facturas (Decreto Presidencial n.º 71/25), incluindo séries de facturação, assinatura criptográfica Hash SHA-256 encadeada, código QR oficial e exportação SAF-T (AO) versão 1.01_01. O módulo de transmissão electrónica encontra-se claramente identificado como PREPARAÇÃO PARA CERTIFICAÇÃO AGT até à homologação oficial.',
    },
    {
      q: 'Os dados da minha empresa estão isolados de outras empresas na plataforma?',
      a: 'Absolutamente. O sistema utiliza uma arquitectura SaaS Multi-Tenant Zero-Trust com isolamento criptográfico por empresa (ownerId e companyId). Nenhuma empresa consegue visualizar, consultar ou alterar clientes, facturas, produtos ou movimentos financeiros de outra entidade.',
    },
    {
      q: 'Posso emitir facturas ou consultar documentos críticos quando a ligação à Internet falha?',
      a: 'Sim. O ALHAN FACTURA integra tecnologia Progressive Web App (PWA) com cache local cifrado e fila de sincronização offline. Caso ocorra uma quebra de ligação, os documentos críticos ficam salvaguardados localmente e sincronizam automaticamente assim que a ligação é restabelecida.',
    },
    {
      q: 'É possível alterar ou eliminar uma factura depois de emitida?',
      a: 'Não. Em estrito cumprimento da legislação fiscal angolana, as facturas emitidas são imutáveis e não podem ser eliminadas nem pelo proprietário da empresa nem pelo administrador central da ALHAN. Qualquer rectificação deve ser efectuada através da emissão de uma Nota de Crédito ou Nota de Débito referenciando o documento original.',
    },
    {
      q: 'Quais são os meios de pagamento aceites para as subscrições do ALHAN FACTURA?',
      a: `O canal oficial prioritário de subscrição é o MULTICAIXA EXPRESS através do número ${MCX_EXPRESS_OFFICIAL_NUMBER} (Beneficiário: ${MCX_EXPRESS_BENEFICIARY}), suportando quer validação automática via gateway quer confirmação administrativa com anexo de comprovativo. Aceitamos também Transferência Bancária IBAN e TPA/POS.`,
    },
  ];

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.empresa || !contactForm.telefone) return;
    setContactSent(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-slate-950 text-white border-b border-slate-800">
        {/* Zone 1: Brand mark with official ALHAN logo */}
        <a
          href="#top"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          <img
            src={ALHAN_OFFICIAL_LOGO_URL}
            alt="ALHAN Logo"
            className="h-8 w-auto rounded bg-white px-1.5 py-0.5 object-contain"
          />
          <span>ALHAN FACTURA</span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#funcionalidades"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Funcionalidades
          </a>
          <a
            href="#integracao-agt"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Integração AGT
          </a>
          <a
            href="#planos"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Planos
          </a>
          <a
            href="#seguranca"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Segurança
          </a>
          <a
            href="#suporte"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Suporte
          </a>
        </nav>

        {/* Zone 3: Primary actions (Iniciar Sessão + Criar Conta) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => (onOpenLoginModal ? onOpenLoginModal() : onSignInGoogle())}
            disabled={isSigningIn}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSigningIn ? 'A autenticar...' : 'Iniciar Sessão'}
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenRegisterModal
                ? onOpenRegisterModal('profissional', 'mensal')
                : onSignInGoogle('profissional', 'mensal')
            }
            className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Criar Conta
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="bg-slate-950 text-white pt-12 pb-16 lg:py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Column: Proposition & CTAs */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <p className="text-xs font-medium text-amber-400 tracking-wide">
                  CAMPANHA BLACK FRIDAY ACTIVA: 60% DE DESCONTO EM TODOS OS PLANOS E SUBSCRIÇÕES · AOA (Kz)
                </p>

                <h1
                  className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12] font-display"
                  style={{ textWrap: 'balance' }}
                >
                  Facturação Electrónica, SAF-T AO e Gestão Empresarial para Angola
                </h1>

                <p className="text-base text-slate-300 leading-relaxed max-w-2xl">
                  Plataforma SaaS multi-empresa desenvolvida para comerciantes, prestadores de serviços, PME e grandes empresas em Angola. Emita facturas em A4 e talão térmico (móvel e computador) com IVA de 14%, retenção na fonte de 6,5% e exportação SAF-T AO em conformidade com o Decreto Presidencial n.º 71/25 da AGT.
                </p>
              </div>

              <div className="space-y-6 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRegisterModal
                        ? onOpenRegisterModal('profissional', 'mensal')
                        : onSignInGoogle('profissional', 'mensal')
                    }
                    disabled={isSigningIn}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
                  >
                    <span>Criar Conta Empresarial</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => (onOpenLoginModal ? onOpenLoginModal() : onSignInGoogle())}
                    className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Iniciar Sessão
                  </button>

                  <PWAInstallButton />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>Criptografia Ponta a Ponta TLS 1.3 & AES-256</span>
                  <span aria-hidden="true">·</span>
                  <span>Suporte Offline PWA</span>
                  <span aria-hidden="true">·</span>
                  <span>Fuso Horário Africa/Luanda</span>
                </div>
              </div>
            </div>

            {/* Right Column: High-Impact ALHAN FACTURA Modern Office Asset */}
            <div className="lg:col-span-5 flex items-center">
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
                {!heroImgError ? (
                  <img
                    src={
                      escritorioAlhanImg ||
                      '/assets/aistudio/Escrit_rio_moderno_da_ALHAN_FACTURA_ab5ac85c.png'
                    }
                    alt="Escritório Moderno da ALHAN FACTURA — Soluções de Facturação para Empresas Angolanas"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-auto object-cover block"
                  />
                ) : (
                  <div className="h-64 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-950 flex items-center justify-center p-8">
                    <Building2 className="w-20 h-20 text-sky-500/40" />
                  </div>
                )}
                <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-1.5">
                  <p className="text-[11px] font-mono text-sky-400">
                    DECRETO PRESIDENCIAL N.º 71/25 · SAF-T (AO) 1.01_01
                  </p>
                  <p className="text-xs font-semibold text-white">
                    Controlo em Tempo Real para Empresas em todas as 21 Províncias de Angola
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Assinatura Hash SHA-256 · Código QR Oficial · IVA 14% e Retenção 6,5%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative KPI Strip Below Hero Split */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-2xl font-bold font-mono tabular-nums text-white">11 Tipos</p>
              <p className="text-xs text-slate-400 mt-1">
                Documentos Fiscais e Comerciais (Factura, Factura-Recibo, NC, ND, Proforma, Guias)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-2xl font-bold font-mono tabular-nums text-sky-400">100% XML</p>
              <p className="text-xs text-slate-400 mt-1">
                Validação Estrutural SAF-T AO (Facturação, Contabilidade e Inventário)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-2xl font-bold font-mono tabular-nums text-white">AES-256 + SHA-256</p>
              <p className="text-xs text-slate-400 mt-1">
                Criptografia de Dados Sensíveis, Hash Fiscal Encadeado e Isolamento Multi-Tenant
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">24/7 Offline</p>
              <p className="text-xs text-slate-400 mt-1">
                Continuidade Operacional via PWA com Sincronização Automática Imediata
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Bento Grid */}
      <section id="funcionalidades" className="py-16 lg:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-12">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold text-sky-700">
              ARQUITECTURA INTEGRADA DE GESTÃO EMPRESARIAL
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight font-display">
              Todos os Módulos Fiscais, Comerciais e Financeiros Numa Única Plataforma
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Construído especificamente para a realidade tributária e operacional de Angola, eliminando sistemas fragmentados e folhas de cálculo vulneráveis.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Marquee Capability 1 (Spans 2 cols) */}
            <div className="lg:col-span-2 p-7 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-sky-700">
                    01. Facturação Electrónica & Documentos Comerciais
                  </span>
                  <FileCheck2 className="w-5 h-5 text-sky-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Emissão Sequencial Inviolável em Formato A4 e Talão Térmico 80mm
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Emita Facturas, Facturas-Recibo, Facturas Proforma, Recibos, Notas de Crédito, Notas de Débito, Orçamentos, Guias de Remessa, Guias de Transporte, Avisos de Cobrança e Facturas Globais. Cálculo automático de IVA (14%, 7%, 5% ou Isento), valor por extenso em Kwanzas, indicação automática de ORIGINAL na primeira impressão, assinatura Hash e Código QR.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Exportação PDF Instantânea</span>
                <span aria-hidden="true">·</span>
                <span>Envio por E-mail e WhatsApp</span>
                <span aria-hidden="true">·</span>
                <span>Rectificação Exclusiva por Nota de Crédito/Débito</span>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="p-7 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-sky-700">
                    02. Exportação SAF-T AO Oficial
                  </span>
                  <FileSpreadsheet className="w-5 h-5 text-sky-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Validador Estrutural XML Integrado
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Geração de ficheiros SAF-T AO de Facturação, Contabilidade e Inventário com verificação prévia de campos obrigatórios (NIF, série, Hash, saldos de imposto) e relatório de conformidade antes da submissão no portal da AGT.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                Esquema AO_1.01_01 · Arquivo Histórico Seguro
              </div>
            </div>

            {/* Capability 3 */}
            <div className="p-7 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-sky-700">
                    03. Inventário, Produtos & Armazéns
                  </span>
                  <Warehouse className="w-5 h-5 text-sky-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Controlo de Stock e Alertas de Ruptura
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Registo de produtos e serviços com código de barras, margem de lucro, preço de compra e venda. Entradas automáticas por compras a fornecedores, saídas por facturação, transferências entre armazéns e valorização de existências.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                Multi-Armazém · Alertas de Stock Mínimo
              </div>
            </div>

            {/* Marquee Capability 4 (Spans 2 cols) */}
            <div className="lg:col-span-2 p-7 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-sky-700">
                    04. Tesouraria, Clientes, Fornecedores & Relatórios Analíticos
                  </span>
                  <TrendingUp className="w-5 h-5 text-sky-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Controlo de Dívidas, Fluxo de Caixa e Exportação PDF/Excel
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Gestão de contas correntes de clientes, limites de crédito, recebimentos parciais ou totais, despesas, contas bancárias, caixa e reconciliação de movimentos (Transferência Bancária, Numerário, TPA/POS e Multicaixa Express). Relatórios filtráveis por datas, séries, operadores e estabelecimentos.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>7 Perfis de Permissão por Empresa</span>
                <span aria-hidden="true">·</span>
                <span>Auditoria Imutável de Operações</span>
                <span aria-hidden="true">·</span>
                <span>Controlo Multi-Estabelecimento e Filiais</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AGT Integration & Proof Section */}
      <section id="integracao-agt" className="py-16 lg:py-24 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-mono font-semibold text-amber-400">
                MÓDULO OFICIAL · API DE FACTURAÇÃO ELECTRÓNICA DA AGT (DECRETO PRESIDENCIAL N.º 71/25)
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight font-display">
                Integração Oficial com o Portal do Parceiro AGT e Assinatura Criptográfica JWS
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                O ALHAN FACTURA implementa os contratos técnicos oficiais da Administração Geral Tributária (AGT) com proxy seguro no servidor, assinatura digital JWS (RFC 7515), gestão de séries e distinção rigorosa dos estados fiscais (Rascunho, Pendente de transmissão, Recebida pela AGT, Em processamento, Validada, Rejeitada e Erro de comunicação).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700">
                  <h4 className="text-sm font-semibold text-white">7 Serviços Oficiais da API AGT</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed font-mono">
                    registarFactura · obterEstado · listarFacturas · consultarFactura · solicitarSerie · listarSeries · validarDocumento
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700">
                  <h4 className="text-sm font-semibold text-white">Segurança JWS & Contingência</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Chaves privadas e certificados geridos exclusivamente no backend. Fila controlada de transmissão, protecção contra duplicados e reconciliação automática.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shadow-xl">
                {!featureImgError ? (
                  <img
                    src={
                      reuniaoAlhanImg ||
                      '/assets/aistudio/Reuni_o_Corporativa_ALHAN__Inova__o_em_Angola_3d80e89b.png'
                    }
                    alt="Reunião Corporativa ALHAN — Inovação, Tecnologia e Resultados em Angola"
                    onError={() => setFeatureImgError(true)}
                    className="w-full h-auto object-cover block"
                  />
                ) : (
                  <div className="w-full h-56 bg-slate-800 flex items-center justify-center">
                    <ShieldCheck className="w-12 h-12 text-sky-400" />
                  </div>
                )}
                <div className="p-5 space-y-3 bg-slate-950/90 border-t border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-sky-400">
                      ALHAN — Inovação · Tecnologia · Resultados
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Juntos, construímos um futuro digital para as empresas em Angola
                    </p>
                  </div>
                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "Antes do ALHAN FACTURA demorávamos 4 dias por mês a consolidar a facturação das nossas 3 filiais e a validar o ficheiro SAF-T AO. Hoje emitimos facturas em A4 e talão térmico em segundos, reduzimos as rupturas de stock em 68% e exportamos o SAF-T sem erros de estrutura."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial Plans & Subscriptions */}
      <section id="planos" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-10">
          {/* Black Friday 60% Banner */}
          <div className="p-5 rounded-xl bg-slate-950 text-white border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-mono font-bold text-amber-400">
                PROMOÇÃO ESPECIAL BLACK FRIDAY — {BLACK_FRIDAY_DISCOUNT_PERCENT}% DE DESCONTO IMEDIATO
              </p>
              <h3 className="text-base sm:text-lg font-bold">
                Todos os Planos ALHAN FACTURA com 60% de Desconto Aplicado Automaticamente
              </h3>
              <p className="text-xs text-slate-300">
                Subscreva pelo canal oficial Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER} — Beneficiário: {MCX_EXPRESS_BENEFICIARY}) e garanta 60% de redução na sua subscrição empresarial.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenRegisterModal
                  ? onOpenRegisterModal('profissional', billingCycle)
                  : onSignInGoogle('profissional', billingCycle)
              }
              className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 text-center cursor-pointer"
            >
              Aproveitar Black Friday (-60%)
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold text-sky-700">
                PLANOS COMERCIAIS E SUBSCRIÇÕES EM KWANZAS (AOA) · PROMOÇÃO BLACK FRIDAY -60%
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight font-display">
                Escolha o Plano Ideal para a Dimensão da Sua Empresa
              </h2>
              <p className="text-sm text-slate-600">
                Pagamento oficial via <strong>MULTICAIXA EXPRESS: {MCX_EXPRESS_OFFICIAL_NUMBER}</strong> (Beneficiário: <strong>{MCX_EXPRESS_BENEFICIARY}</strong>), com activação imediata após validação e emissão automática de recibo.
              </p>
            </div>

            {/* Interactive Billing Cadence Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
              {(['mensal', 'trimestral', 'semestral', 'anual'] as BillingCycleType[]).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 capitalize ${
                    billingCycle === cycle
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const isHighlighted = plan.id === 'profissional';
              const originalPrice = calcularPrecoOriginalSemBlackFriday(plan.monthlyPriceKz, billingCycle);
              const totalCyclePrice = calcularPrecoCiclo(plan.monthlyPriceKz, billingCycle, true);
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl p-7 flex flex-col justify-between border ${
                    isHighlighted
                      ? 'bg-slate-900 text-white border-sky-500 shadow-lg'
                      : 'bg-white text-slate-900 border-slate-200'
                  }`}
                >
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-bold tracking-tight">{plan.name}</h3>
                        <span className="text-xs font-mono font-bold text-amber-500">
                          BLACK FRIDAY -60%
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          isHighlighted ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {plan.audience}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/20">
                      <p
                        className={`text-xs font-mono line-through ${
                          isHighlighted ? 'text-slate-400' : 'text-slate-400'
                        }`}
                      >
                        Antes: {formatKz(originalPrice)}
                      </p>
                      <p className="text-3xl font-bold font-mono tabular-nums text-amber-500">
                        {formatKz(totalCyclePrice)}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          isHighlighted ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Facturado {cycleLabel[billingCycle]} · Limite: {plan.maxUsers} utilizador(es) / {plan.maxEstablishments} estab.
                      </p>
                    </div>

                    <ul className="space-y-2.5 text-xs pt-2">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isHighlighted ? 'text-sky-400' : 'text-sky-700'
                            }`}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-200/20">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenRegisterModal
                          ? onOpenRegisterModal(plan.id, billingCycle)
                          : onSignInGoogle(plan.id, billingCycle)
                      }
                      disabled={isSigningIn}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isHighlighted
                          ? 'bg-sky-600 hover:bg-sky-500 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      Subscrever {plan.name} (-60% Black Friday)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* End-to-End Encryption & Data Security Section */}
      <section id="seguranca" className="py-16 lg:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-8">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-semibold text-sky-700">
              SEGURANÇA BANCÁRIA E PROTECÇÃO DE DADOS EMPRESARIAIS
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-display">
              Criptografia de Ponta a Ponta, Isolamento Multi-Empresa e Imutabilidade Fiscal
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Concebido com arquitectura de segurança defensiva para proteger os segredos comerciais, dados bancários e histórico tributário de cada empresa cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lock className="w-4 h-4 text-sky-700" />
                <span>Criptografia Ponta a Ponta (TLS 1.3 & AES-256)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Todas as comunicações entre o navegador/dispositivo móvel e a nuvem utilizam canais cifrados TLS 1.3 (HTTPS obrigatório). Os documentos fiscais, credenciais e cópias de segurança são cifrados em repouso com AES-256 e assinados digitalmente com SHA-256.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
                <span>Isolamento Multi-Tenant & Imutabilidade</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Regras formais de controlo de acesso Baseado em Atributos (ABAC) garantem que cada empresa acede exclusivamente aos seus próprios registos. As facturas emitidas estão bloqueadas contra eliminação ou edição silenciosa, mesmo perante administradores centrais.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Building2 className="w-4 h-4 text-sky-700" />
                <span>Backups Automáticos & Retenção Fiscal</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Política de retenção legal dos documentos fiscais, registo de auditoria imutável (quem fez o quê e quando) e sincronização constante com armazenamento local PWA para continuidade de negócio sem interrupções.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ & Direct Commercial Support Section */}
      <section id="suporte" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: FAQ */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-sky-700">PERGUNTAS FREQUENTES</p>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-display">
                Esclarecimentos sobre Facturação, AGT e Subscrições
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-white border border-slate-200 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Commercial Contact & Technical Support */}
          <div className="lg:col-span-5">
            <div className="p-7 rounded-xl bg-white border border-slate-200 space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-sky-700">
                  CONTACTOS COMERCIAIS & SUPORTE TÉCNICO ALHAN
                </p>
                <h3 className="text-lg font-bold text-slate-900">
                  Fale com a Equipa ALHAN em Angola
                </h3>
                <p className="text-xs text-slate-500">
                  ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>
                    <strong>Telefone / Linha Directa:</strong> +244 922 021 211
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>
                    <strong>E-mail Oficial:</strong> facturao@alhan.pro
                  </span>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href="https://wa.me/244922021211?text=Ol%C3%A1%20ALHAN%20FACTURA%2C%20pretendo%20informa%C3%A7%C3%B5es%20sobre%20a%20subscri%C3%A7%C3%A3o%20empresarial."
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Atendimento via WhatsApp (922 021 211)
                  </a>
                  <a
                    href="mailto:facturao@alhan.pro?subject=Pedido%20Comercial%20ALHAN%20FACTURA"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Enviar E-mail
                  </a>
                </div>
              </div>

              {contactSent ? (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold">Pedido comercial registado com sucesso!</p>
                  <p>
                    A equipa da ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA entrará em contacto através do número {contactForm.telefone} ou e-mail {contactForm.email}.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleContactSubmit}
                  toolname="request_alhan_commercial_proposal"
                  tooldescription="Solicita proposta comercial ou demonstração técnica do software ALHAN FACTURA para empresas em Angola."
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nome da Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.empresa}
                      onChange={(e) => setContactForm({ ...contactForm, empresa: e.target.value })}
                      placeholder="Ex.: Comércio Geral Luanda, Lda"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">NIF</label>
                      <input
                        type="text"
                        value={contactForm.nif}
                        onChange={(e) => setContactForm({ ...contactForm, nif: e.target.value })}
                        placeholder="Ex.: 5401122334"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Telefone (Angola) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={contactForm.telefone}
                        onChange={(e) => setContactForm({ ...contactForm, telefone: e.target.value })}
                        placeholder="Ex.: 923 000 000"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      E-mail Corporativo *
                    </label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="geral@suaempresa.ao"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mensagem ou Pedido de Demonstração
                    </label>
                    <textarea
                      rows={2}
                      value={contactForm.mensagem}
                      onChange={(e) => setContactForm({ ...contactForm, mensagem: e.target.value })}
                      placeholder="Indique o número de estabelecimentos e utilizadores pretendidos..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold transition-colors"
                  >
                    Solicitar Proposta Comercial
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-slate-950 text-slate-400 py-10 px-6 lg:px-12 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <img
                src={ALHAN_OFFICIAL_LOGO_URL}
                alt="ALHAN Logo"
                className="h-7 w-auto rounded bg-white px-1.5 py-0.5 object-contain"
              />
              <p className="font-bold text-white text-sm font-display">ALHAN FACTURA</p>
            </div>
            <p>
              Propriedade de <strong>ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA</strong> · Luanda, República de Angola
            </p>
            <p>
              Contactos Oficiais:{' '}
              <a href="tel:+244922021211" className="text-sky-400 hover:underline">
                +244 922 021 211
              </a>{' '}
              ·{' '}
              <a href="mailto:facturao@alhan.pro" className="text-sky-400 hover:underline">
                facturao@alhan.pro
              </a>{' '}
              · Multicaixa Express:{' '}
              <a href="tel:+244927496287" className="text-amber-400 hover:underline font-mono">
                {MCX_EXPRESS_OFFICIAL_NUMBER}
              </a>{' '}
              ({MCX_EXPRESS_BENEFICIARY})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                setLegalModal('sobre');
              }}
              className="hover:text-white transition-colors"
            >
              Sobre Nós
            </a>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('suporte')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors"
            >
              Contactos
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                setLegalModal('termos');
              }}
              className="hover:text-white transition-colors"
            >
              Termos de Utilização
            </a>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                setLegalModal('privacidade');
              }}
              className="hover:text-white transition-colors"
            >
              Política de Privacidade e Criptografia
            </a>
            <a href="/llms.txt" className="hover:text-white transition-colors font-mono">
              llms.txt
            </a>
          </div>
        </div>
      </footer>

      {/* Legal & About Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {legalModal === 'termos'
                  ? 'Termos e Condições de Utilização — ALHAN FACTURA'
                  : legalModal === 'sobre'
                  ? 'Sobre a ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA'
                  : 'Política de Privacidade, Protecção de Dados e Criptografia'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>
            {legalModal === 'termos' ? (
              <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
                <p>
                  <strong>1. Identificação do Fornecedor:</strong> O software SaaS ALHAN FACTURA é propriedade exclusiva de ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA, com sede em Angola, contactável através do telefone 922 021 211 e do e-mail facturao@alhan.pro.
                </p>
                <p>
                  <strong>2. Responsabilidade Fiscal e Imutabilidade:</strong> Cada empresa registada é responsável pela exactidão do seu NIF, enquadramento em IVA e séries de facturação. Em cumprimento do Decreto Presidencial n.º 71/25, os documentos fiscais emitidos são imutáveis e não podem ser eliminados.
                </p>
                <p>
                  <strong>3. Estado de Certificação AGT:</strong> Até à conclusão do processo formal de certificação junto da Administração Geral Tributária (AGT), o módulo de transmissão opera em modo de PREPARAÇÃO PARA CERTIFICAÇÃO AGT, não devendo nenhuma emissão ser apresentada como validada fiscalmente pela AGT antes da activação das credenciais oficiais de produção.
                </p>
              </div>
            ) : legalModal === 'sobre' ? (
              <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
                <p>
                  A <strong>ALHAN CONSULTORIA E PRESTAÇÃO DE SERVIÇOS, LDA</strong> é uma empresa angolana sediada em Luanda, especializada no desenvolvimento de soluções empresariais de facturação electrónica, gestão comercial, inventário e conformidade fiscal com a Administração Geral Tributária (AGT).
                </p>
                <p>
                  O sistema <strong>ALHAN FACTURA</strong> suporta emissão em formato A4 e Talão Térmico (80mm Computador / 58mm Telemóvel), cálculo automático de IVA de 14% e Retenção na Fonte de 6,5%, exportação SAF-T (AO) e subscrição via Multicaixa Express (<strong>{MCX_EXPRESS_OFFICIAL_NUMBER} — Beneficiário: {MCX_EXPRESS_BENEFICIARY}</strong>).
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
                <p>
                  <strong>1. Isolamento Multi-Empresa:</strong> Os dados inseridos por cada empresa no ALHAN FACTURA encontram-se logicamente e criptograficamente isolados. Nenhuma empresa terceira tem permissão de leitura ou listagem sobre os seus registos.
                </p>
                <p>
                  <strong>2. Criptografia Ponta a Ponta e em Repouso:</strong> Todas as transmissões ocorrem sob HTTPS/TLS 1.3 e os dados armazenados e cópias de segurança utilizam cifra simétrica AES-256 e resumos criptográficos SHA-256.
                </p>
                <p>
                  <strong>3. Retenção Legal:</strong> Os documentos fiscais e ficheiros SAF-T AO são conservados pelo período legalmente exigido pelo Código Geral Tributário de Angola, com cópias de segurança diárias automatizadas.
                </p>
              </div>
            )}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
              >
                Compreendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
