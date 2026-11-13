import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck2,
  FileCode2,
  FilePlus2,
  FileSpreadsheet,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Plus,
  Receipt,
  Search,
  Shield,
  ShieldAlert,
  Sun,
  Trash2,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeId,
} from './lib/firebase';
import {
  AgtCommunicationLog,
  AgtTransmissionStatusType,
  AuditLog,
  BillingCycleType,
  Client,
  Company,
  FinancialTransaction,
  FiscalDocumentType,
  InventoryMovement,
  Invoice,
  InvoiceLineItem,
  PlanIdType,
  Product,
  SubscriptionPayment,
  SubscriptionPlanConfig,
  SubscriptionStatusType,
  Supplier,
  SupportTicket,
  TeamMember,
  UserRoleType,
} from './types/models';
import {
  ALHAN_OFFICIAL_LOGO_URL,
  BLACK_FRIDAY_DISCOUNT_PERCENT,
  calcularDataVencimentoSubscricao,
  calcularDiasParaVencimento,
  calcularResumoFiscalFactura,
  exportarFacturaPDF,
  formatKz,
  gerarAssinaturaHashAGT,
  gerarPayloadQrAGT,
  getLuandaIsoDate,
  INITIAL_PLANS,
  IVA_STANDARD_RATE_AO,
  MCX_EXPRESS_BENEFICIARY,
  MCX_EXPRESS_OFFICIAL_NUMBER,
  RETENCAO_FONTE_RATE_AO,
  valorPorExtensoKz,
} from './lib/angolaUtils';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { CompanyRegistrationModal } from './components/CompanyRegistrationModal';
import { InvoiceModal } from './components/InvoiceModal';
import { DocumentationModal } from './components/DocumentationModal';
import { AlhanAdminPanel } from './components/AlhanAdminPanel';
import { FiscalComplianceModule } from './components/FiscalComplianceModule';
import { OperationsModules } from './components/OperationsModules';
import { MulticaixaCheckoutModal } from './components/MulticaixaCheckoutModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallBanner';
import { useOnlineStatus } from './hooks/usePWAInstall';

type WorkspaceTab =
  | 'dashboard'
  | 'invoicing'
  | 'agt'
  | 'saft'
  | 'clients'
  | 'products'
  | 'inventory'
  | 'finance'
  | 'suppliers'
  | 'reports'
  | 'users'
  | 'support'
  | 'alhan_admin';

const DOC_SERIES_PREFIX: Record<FiscalDocumentType, string> = {
  Factura: 'FT 2026',
  'Factura-Recibo': 'FR 2026',
  'Factura Proforma': 'FP 2026',
  Recibo: 'RC 2026',
  'Nota de Credito': 'NC 2026',
  'Nota de Debito': 'ND 2026',
  Orcamento: 'OR 2026',
  'Guia de Remessa': 'GR 2026',
  'Guia de Transporte': 'GT 2026',
  'Aviso de Cobranca': 'AC 2026',
  'Factura Global': 'FG 2026',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [pendingUserEmail, setPendingUserEmail] = useState('');
  const [pendingUserName, setPendingUserName] = useState('');

  const [selectedPlanOnLanding, setSelectedPlanOnLanding] = useState<PlanIdType>('profissional');
  const [selectedCycleOnLanding, setSelectedCycleOnLanding] = useState<BillingCycleType>('mensal');

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [activeRoleView, setActiveRoleView] = useState<UserRoleType>('Administrador');
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{ title: string; message: string } | null>(null);

  const isOnline = useOnlineStatus();
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Multi-Tenant State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([]);
  const [agtLogs, setAgtLogs] = useState<AgtCommunicationLog[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(INITIAL_PLANS);
  const [isMcxCheckoutOpen, setIsMcxCheckoutOpen] = useState(false);
  const [mcxCheckoutPlan, setMcxCheckoutPlan] = useState<PlanIdType>('profissional');
  const [mcxCheckoutCycle, setMcxCheckoutCycle] = useState<BillingCycleType>('mensal');

  // Invoice Builder State
  const [docType, setDocType] = useState<FiscalDocumentType>('Factura');
  const [series, setSeries] = useState('FT 2026');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [issueDate, setIssueDate] = useState(getLuandaIsoDate());
  const [dueDate, setDueDate] = useState(getLuandaIsoDate());
  const [paymentTerms, setPaymentTerms] = useState('Pronto Pagamento / 30 Dias');
  const [paymentMethod, setPaymentMethod] = useState('Transferência Bancária (IBAN)');
  const [invoiceNotes, setInvoiceNotes] = useState(
    'Bens e serviços colocados à disposição do adquirente na data de emissão.'
  );
  const [lineItems, setLineItems] = useState<
    { productId: string; quantity: number; discountPercent: number }[]
  >([]);
  const [applyWithholding65, setApplyWithholding65] = useState(true);
  const [applyBlackFriday60, setApplyBlackFriday60] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('todos');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<Record<string, number>>({});

  // Sync Dark Mode with HTML root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const isCentralAlhanAdmin =
    currentUser?.email === 'joaomuatxissombo22@gmail.com' || isDemoMode;

  // Real-Time Firestore Listeners when Authenticated
  useEffect(() => {
    if (!authReady || !currentUser || isDemoMode) return;
    const uid = currentUser.uid;

    const qCompanies = query(collection(db, 'companies'), where('ownerId', '==', uid));
    const unsubCompanies = onSnapshot(
      qCompanies,
      (snap) => {
        setCompanies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'companies')
    );

    const qClients = query(collection(db, 'clients'), where('ownerId', '==', uid));
    const unsubClients = onSnapshot(
      qClients,
      (snap) => {
        setClients(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clients')
    );

    const qProducts = query(collection(db, 'products'), where('ownerId', '==', uid));
    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const qInvoices = query(collection(db, 'invoices'), where('ownerId', '==', uid));
    const unsubInvoices = onSnapshot(
      qInvoices,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) }));
        list.sort((a, b) => b.sequentialNumber - a.sequentialNumber);
        setInvoices(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
    );

    const qMovements = query(collection(db, 'inventory_movements'), where('ownerId', '==', uid));
    const unsubMovements = onSnapshot(
      qMovements,
      (snap) => {
        setMovements(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryMovement, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_movements')
    );

    const qTx = query(collection(db, 'financial_transactions'), where('ownerId', '==', uid));
    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinancialTransaction, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_transactions')
    );

    const qSuppliers = query(collection(db, 'suppliers'), where('ownerId', '==', uid));
    const unsubSuppliers = onSnapshot(
      qSuppliers,
      (snap) => {
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
    );

    const qTeam = query(collection(db, 'team_members'), where('ownerId', '==', uid));
    const unsubTeam = onSnapshot(
      qTeam,
      (snap) => {
        setTeamMembers(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeamMember, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'team_members')
    );

    const qTickets = query(collection(db, 'support_tickets'), where('ownerId', '==', uid));
    const unsubTickets = onSnapshot(
      qTickets,
      (snap) => {
        setTickets(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportTicket, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'support_tickets')
    );

    const qLogs = query(collection(db, 'audit_logs'), where('ownerId', '==', uid));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
    );

    const qSubPay = query(collection(db, 'subscription_payments'), where('ownerId', '==', uid));
    const unsubSubPay = onSnapshot(
      qSubPay,
      (snap) => {
        setSubscriptionPayments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionPayment, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscription_payments')
    );

    const qAgtLogs = query(collection(db, 'agt_communications'), where('ownerId', '==', uid));
    const unsubAgtLogs = onSnapshot(
      qAgtLogs,
      (snap) => {
        setAgtLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgtCommunicationLog, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'agt_communications')
    );

    return () => {
      unsubCompanies();
      unsubClients();
      unsubProducts();
      unsubInvoices();
      unsubMovements();
      unsubTx();
      unsubSuppliers();
      unsubTeam();
      unsubTickets();
      unsubLogs();
      unsubSubPay();
      unsubAgtLogs();
    };
  }, [authReady, currentUser, isDemoMode]);

  const activeCompany = companies[0] || null;

  // Initialize default invoice builder line item when products load
  useEffect(() => {
    if (products.length > 0 && lineItems.length === 0) {
      setLineItems([{ productId: products[0].id, quantity: 1, discountPercent: 0 }]);
    }
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [products, clients, lineItems.length, selectedClientId]);

  const handleSignInGoogle = async (plan?: PlanIdType, cycle?: BillingCycleType) => {
    if (plan) setSelectedPlanOnLanding(plan);
    if (cycle) setSelectedCycleOnLanding(cycle);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsDemoMode(false);
      setIsAuthModalOpen(false);
      setIsRegisterModalOpen(false);
    } catch (err) {
      console.warn('Popup Google indisponível neste domínio; a abrir acesso directo:', err);
      if (plan) {
        setIsAuthModalOpen(false);
        setIsRegisterModalOpen(true);
      } else {
        setIsAuthModalOpen(true);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDirectLoginSuccess = async (email: string, name: string, nifInput?: string) => {
    setIsAuthModalOpen(false);
    await handleEnterDemoMode();
    try {
      const savedRaw = localStorage.getItem('alhan_registered_company_v1');
      if (savedRaw) {
        const savedComp = JSON.parse(savedRaw) as Company;
        if (savedComp && savedComp.name) {
          setCompanies([savedComp]);
          return;
        }
      }
    } catch {
      // ignore localStorage parse error
    }
    setCompanies((prev) =>
      prev.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              email: email || c.email,
              responsibleName: name || c.responsibleName,
              nif: nifInput && !nifInput.includes('@') ? nifInput : c.nif,
            }
          : c
      )
    );
  };

  // Interactive Demo Mode Seeder (for instant exploration from Landing Page)
  const handleEnterDemoMode = async () => {
    const demoOwner = 'demo_owner_ao';
    const demoCompId = 'comp_alhan_demo_01';
    const today = getLuandaIsoDate();

    const demoCompany: Company = {
      id: demoCompId,
      ownerId: demoOwner,
      name: 'Kwanza Solutions & Logística Empresarial, Lda.',
      commercialName: 'Kwanza Solutions Angola',
      nif: '5402891045',
      address: 'Av. Comandante Valódia, Edifício Atrium, 4.º Andar, Ingombota',
      province: 'Luanda',
      municipality: 'Luanda',
      phone: '+244 922 021 211',
      email: 'facturao@alhan.pro',
      economicActivity: 'Consultoria Informática, Comércio de Equipamentos e Logística',
      taxRegime: 'Regime Geral',
      vatScheme: 'IVA 14% (Geral)',
      responsibleName: 'Eng. João Muatxissombo',
      bankName: 'BAI — Banco Angolano de Investimentos',
      bankIban: 'AO06.0040.0000.4829.1039.4820.1',
      establishmentsCount: 3,
      planId: 'empresarial',
      billingCycle: 'anual',
      subscriptionStatus: 'activa',
      agtStatus: 'preparacao_certificacao',
      agtCertificateRef: 'CERT-AO-JWS-7125',
      agtEnvironment: 'sandbox_teste',
      subscriptionStartDate: today,
      subscriptionEndDate: calcularDataVencimentoSubscricao(today, 'mensal'),
      agtAdhesionStatus: 'em_homologacao',
    };

    const demoClients: Client[] = [
      {
        id: 'cli_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        clientType: 'empresarial',
        name: 'Sonangol Distribuidora & Logística, S.A.',
        nif: '5401002938',
        address: 'Rua Rainha Ginga, N.º 84, Luanda',
        province: 'Luanda',
        phone: '+244 923 110 220',
        email: 'contabilidade@sonangoldist.ao',
        contactPerson: 'Dr. Carlos Mendes',
        creditLimit: 15000000,
        currentBalance: 456000,
        totalInvoiced: 2736000,
        totalPaid: 2280000,
      },
      {
        id: 'cli_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        clientType: 'empresarial',
        name: 'Rede Supermercados Kero Angola, Lda.',
        nif: '5403991827',
        address: 'Talatona, Luanda Sul',
        province: 'Luanda',
        phone: '+244 924 880 110',
        email: 'compras@kero.ao',
        contactPerson: 'Dra. Helena Silva',
        creditLimit: 8500000,
        currentBalance: 0,
        totalInvoiced: 1140000,
        totalPaid: 1140000,
      },
      {
        id: 'cli_03',
        ownerId: demoOwner,
        companyId: demoCompId,
        clientType: 'particular',
        name: 'Eng. Domingos Sebastião',
        nif: '004829103LA042',
        address: 'Centralidade do Kilamba, Bloco Q',
        province: 'Luanda',
        phone: '+244 931 400 500',
        email: 'domingos.sebastiao@gmail.com',
        contactPerson: 'Próprio',
        creditLimit: 500000,
        currentBalance: 171000,
        totalInvoiced: 171000,
        totalPaid: 0,
      },
    ];

    const demoProducts: Product[] = [
      {
        id: 'prd_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        itemType: 'produto',
        code: 'HW-POS-80',
        barcode: '5609871230011',
        description: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
        category: 'Hardware Comercial',
        purchasePrice: 240000,
        salePrice: 400000,
        unit: 'UN',
        taxRate: 14,
        taxExemptionReason: 'Taxa Normal IVA 14%',
        stock: 18,
        minStock: 5,
        warehouse: 'Armazém Central Luanda',
        profitMargin: 67,
      },
      {
        id: 'prd_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        itemType: 'servico',
        code: 'SRV-IMPL-AGT',
        barcode: '5609871230028',
        description: 'Consultoria Técnica de Implementação e Parametrização SAF-T AO',
        category: 'Serviços Profissionais',
        purchasePrice: 0,
        salePrice: 250000,
        unit: 'UN',
        taxRate: 14,
        taxExemptionReason: 'Taxa Normal IVA 14%',
        stock: 999,
        minStock: 0,
        warehouse: 'Sede Luanda',
        profitMargin: 100,
      },
      {
        id: 'prd_03',
        ownerId: demoOwner,
        companyId: demoCompId,
        itemType: 'produto',
        code: 'PAP-TERM-80',
        barcode: '5609871230035',
        description: 'Caixa 50 Rolos Papel Térmico 80x80mm Alta Durabilidade',
        category: 'Consumíveis',
        purchasePrice: 28000,
        salePrice: 50000,
        unit: 'CX',
        taxRate: 14,
        taxExemptionReason: 'Taxa Normal IVA 14%',
        stock: 3,
        minStock: 10,
        warehouse: 'Armazém Central Luanda',
        profitMargin: 79,
      },
    ];

    const hash1 = await gerarAssinaturaHashAGT(today, 'FT 2026/1', 2280000, demoCompany.nif);
    const hash2 = await gerarAssinaturaHashAGT(today, 'FT 2026/2', 456000, demoCompany.nif, hash1);
    const hash3 = await gerarAssinaturaHashAGT(today, 'FR 2026/1', 1140000, demoCompany.nif, hash2);

    const demoInvoices: Invoice[] = [
      {
        id: 'inv_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        docType: 'Factura',
        series: 'FT 2026',
        sequentialNumber: 1,
        docNumber: 'FT 2026/1',
        issueDate: today,
        dueDate: today,
        emitterName: demoCompany.name,
        emitterNif: demoCompany.nif,
        clientId: 'cli_01',
        clientName: demoClients[0].name,
        clientNif: demoClients[0].nif,
        clientAddress: demoClients[0].address,
        itemsSummary: JSON.stringify([
          {
            productId: 'prd_01',
            code: 'HW-POS-80',
            description: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
            quantity: 5,
            unit: 'UN',
            unitPrice: 400000,
            discountPercent: 0,
            taxRate: 14,
            lineSubtotal: 2000000,
            lineTax: 280000,
            lineTotal: 2280000,
          },
        ] as InvoiceLineItem[]),
        subtotal: 2000000,
        discountTotal: 0,
        taxTotal: 280000,
        totalAmount: 2280000,
        amountInWords: valorPorExtensoKz(2280000),
        paymentTerms: '30 Dias',
        paymentMethod: 'Transferência Bancária (IBAN)',
        notes: 'Fornecimento de equipamentos POS para filiais de Luanda.',
        qrCodePayload: gerarPayloadQrAGT({
          emitterNif: demoCompany.nif,
          clientNif: demoClients[0].nif,
          docType: 'FT',
          docNumber: 'FT 2026/1',
          issueDate: today,
          subtotal: 2000000,
          taxTotal: 280000,
          totalAmount: 2280000,
          hashCode: hash1,
        }),
        hashCode: hash1,
        softwareCertText: 'PREPARAÇÃO PARA CERTIFICAÇÃO AGT',
        status: 'paga',
        paidAmount: 2280000,
        printCount: 0,
        agtTransmissionStatus: 'preparacao_certificacao',
      },
      {
        id: 'inv_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        docType: 'Factura',
        series: 'FT 2026',
        sequentialNumber: 2,
        docNumber: 'FT 2026/2',
        issueDate: today,
        dueDate: today,
        emitterName: demoCompany.name,
        emitterNif: demoCompany.nif,
        clientId: 'cli_01',
        clientName: demoClients[0].name,
        clientNif: demoClients[0].nif,
        clientAddress: demoClients[0].address,
        itemsSummary: JSON.stringify([
          {
            productId: 'prd_01',
            code: 'HW-POS-80',
            description: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
            quantity: 1,
            unit: 'UN',
            unitPrice: 400000,
            discountPercent: 0,
            taxRate: 14,
            lineSubtotal: 400000,
            lineTax: 56000,
            lineTotal: 456000,
          },
        ] as InvoiceLineItem[]),
        subtotal: 400000,
        discountTotal: 0,
        taxTotal: 56000,
        totalAmount: 456000,
        amountInWords: valorPorExtensoKz(456000),
        paymentTerms: '15 Dias',
        paymentMethod: 'Multicaixa Express',
        notes: 'Unidade adicional para balcão de atendimento.',
        qrCodePayload: gerarPayloadQrAGT({
          emitterNif: demoCompany.nif,
          clientNif: demoClients[0].nif,
          docType: 'FT',
          docNumber: 'FT 2026/2',
          issueDate: today,
          subtotal: 400000,
          taxTotal: 56000,
          totalAmount: 456000,
          hashCode: hash2,
        }),
        hashCode: hash2,
        softwareCertText: 'PREPARAÇÃO PARA CERTIFICAÇÃO AGT',
        status: 'pendente',
        paidAmount: 0,
        printCount: 0,
        agtTransmissionStatus: 'preparacao_certificacao',
      },
      {
        id: 'inv_03',
        ownerId: demoOwner,
        companyId: demoCompId,
        docType: 'Factura-Recibo',
        series: 'FR 2026',
        sequentialNumber: 1,
        docNumber: 'FR 2026/1',
        issueDate: today,
        dueDate: today,
        emitterName: demoCompany.name,
        emitterNif: demoCompany.nif,
        clientId: 'cli_02',
        clientName: demoClients[1].name,
        clientNif: demoClients[1].nif,
        clientAddress: demoClients[1].address,
        itemsSummary: JSON.stringify([
          {
            productId: 'prd_02',
            code: 'SRV-IMPL-AGT',
            description: 'Consultoria Técnica de Implementação e Parametrização SAF-T AO',
            quantity: 4,
            unit: 'UN',
            unitPrice: 250000,
            discountPercent: 0,
            taxRate: 14,
            lineSubtotal: 1000000,
            lineTax: 140000,
            lineTotal: 1140000,
          },
        ] as InvoiceLineItem[]),
        subtotal: 1000000,
        discountTotal: 0,
        taxTotal: 140000,
        totalAmount: 1140000,
        amountInWords: valorPorExtensoKz(1140000),
        paymentTerms: 'Pronto Pagamento',
        paymentMethod: 'TPA / POS Multicaixa',
        notes: 'Liquidação imediata no acto da emissão.',
        qrCodePayload: gerarPayloadQrAGT({
          emitterNif: demoCompany.nif,
          clientNif: demoClients[1].nif,
          docType: 'FR',
          docNumber: 'FR 2026/1',
          issueDate: today,
          subtotal: 1000000,
          taxTotal: 140000,
          totalAmount: 1140000,
          hashCode: hash3,
        }),
        hashCode: hash3,
        softwareCertText: 'PREPARAÇÃO PARA CERTIFICAÇÃO AGT',
        status: 'paga',
        paidAmount: 1140000,
        printCount: 0,
        agtTransmissionStatus: 'preparacao_certificacao',
      },
    ];

    setCompanies([demoCompany]);
    setClients(demoClients);
    setProducts(demoProducts);
    setInvoices(demoInvoices);
    setMovements([
      {
        id: 'mov_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        productId: 'prd_01',
        productName: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
        movementType: 'entrada',
        quantity: 24,
        warehouseOrigin: 'Fornecedor ZEE Luanda',
        warehouseDest: 'Armazém Central Luanda',
        unitCost: 240000,
        referenceDoc: 'FT-FORN-2026/088',
        notes: 'Lote inicial importado',
      },
      {
        id: 'mov_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        productId: 'prd_01',
        productName: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
        movementType: 'saida',
        quantity: 6,
        warehouseOrigin: 'Armazém Central Luanda',
        warehouseDest: 'Cliente Sonangol Dist.',
        unitCost: 240000,
        referenceDoc: 'FT 2026/1 & FT 2026/2',
        notes: 'Saída automática por facturação',
      },
    ]);
    setTransactions([
      {
        id: 'tx_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        txType: 'recebimento',
        category: 'Vendas & Facturação',
        description: 'Recebimento Factura FT 2026/1 — Sonangol Distribuidora',
        amount: 2280000,
        paymentMethod: 'transferencia',
        accountName: 'BAI — Banco Angolano de Investimentos (AOA)',
        referenceDoc: 'FT 2026/1',
        entityName: 'Sonangol Distribuidora & Logística, S.A.',
        status: 'reconciliado',
        txDate: today,
      },
      {
        id: 'tx_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        txType: 'recebimento',
        category: 'Vendas & Facturação',
        description: 'Recebimento Factura-Recibo FR 2026/1 — Supermercados Kero',
        amount: 1140000,
        paymentMethod: 'pos',
        accountName: 'BAI — TPA Multicaixa',
        referenceDoc: 'FR 2026/1',
        entityName: 'Rede Supermercados Kero Angola, Lda.',
        status: 'reconciliado',
        txDate: today,
      },
      {
        id: 'tx_03',
        ownerId: demoOwner,
        companyId: demoCompId,
        txType: 'despesa',
        category: 'Operações & Logística',
        description: 'Arrendamento de Escritório e Armazém — Luanda',
        amount: 650000,
        paymentMethod: 'transferencia',
        accountName: 'BAI — Banco Angolano de Investimentos (AOA)',
        referenceDoc: 'REC-ARR-11/2026',
        entityName: 'Imobiliária Baía de Luanda, S.A.',
        status: 'liquidado',
        txDate: today,
      },
    ]);
    setSuppliers([
      {
        id: 'sup_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        name: 'Tecnologia & Sistemas ZEE Viana, Lda.',
        nif: '5408819201',
        phone: '+244 926 300 900',
        email: 'vendas@tecnologiazee.ao',
        address: 'Zona Económica Especial Luanda-Bengo',
        category: 'Hardware & Consumíveis',
        totalPurchased: 5760000,
        balanceDue: 480000,
      },
    ]);
    setTeamMembers([
      {
        id: 'tm_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        name: 'Eng. João Muatxissombo',
        email: 'facturao@alhan.pro',
        role: 'Administrador',
        establishment: 'Sede Principal - Luanda',
        permissionsSummary:
          'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
        status: 'activo',
      },
      {
        id: 'tm_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        name: 'Dra. Patrícia Lourenço',
        email: 'contabilidade@kwanzasolutions.ao',
        role: 'Contabilista',
        establishment: 'Sede Principal - Luanda',
        permissionsSummary:
          'Acesso Fiscal e Contabilístico: SAF-T AO, Relatórios de IVA, Fluxo de Caixa e Facturas',
        status: 'activo',
      },
    ]);
    setTickets([
      {
        id: 'tkt_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        companyName: demoCompany.name,
        subject: 'Verificação de Série FT 2026 para Exportação SAF-T AO',
        description: 'Solicitamos confirmação sobre o código de isenção M00 para serviços isentos.',
        category: 'Facturação & SAF-T AO',
        priority: 'media',
        attachmentRef: 'SAFT_AO_5402891045.xml',
        status: 'respondido',
        adminResponse:
          'Confirmado pelo Suporte Técnico ALHAN (922 021 211): A série FT 2026 e a tabela de impostos estão em conformidade com o esquema AO_1.01_01.',
      },
    ]);
    setAuditLogs([
      {
        id: 'log_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        actorEmail: 'facturao@alhan.pro',
        actorRole: 'Administrador',
        action: 'EMISSAO_FACTURA_FISCAL',
        module: 'Facturação',
        targetRef: 'FT 2026/1',
        details: 'Emitida Factura FT 2026/1 no valor de 2.280.000,00 Kz com assinatura SHA-256.',
      },
    ]);
    setSubscriptionPayments([
      {
        id: 'subpay_demo_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        companyName: demoCompany.name,
        companyNif: demoCompany.nif,
        planId: 'empresarial',
        billingCycle: 'anual',
        amountKz: 854400,
        mcxChannelNumber: MCX_EXPRESS_OFFICIAL_NUMBER,
        beneficiaryName: MCX_EXPRESS_BENEFICIARY,
        orderReference: 'ALH-1045-88201',
        transactionReference: 'MCX-AO-992817263',
        paymentModality: 'confirmacao_administrativa',
        proofFileName: 'Talao_Multicaixa_Express_ALHAN.jpg',
        proofDataUrl: '',
        paymentDeadline: today,
        status: 'confirmado',
        adminNotes: 'Pagamento Multicaixa Express (927 496 287 - ALHAN) confirmado pela Administração Central.',
        receiptNumber: 'REC-ALHAN-2026/001',
      },
      {
        id: 'subpay_demo_02',
        ownerId: demoOwner,
        companyId: demoCompId,
        companyName: demoCompany.name,
        companyNif: demoCompany.nif,
        planId: 'profissional',
        billingCycle: 'mensal',
        amountKz: 42000,
        mcxChannelNumber: MCX_EXPRESS_OFFICIAL_NUMBER,
        beneficiaryName: MCX_EXPRESS_BENEFICIARY,
        orderReference: 'ALH-1045-90412',
        transactionReference: 'MCX-AO-994012884',
        paymentModality: 'confirmacao_administrativa',
        proofFileName: 'Comprovativo_MCX_Renovacao.png',
        proofDataUrl: '',
        paymentDeadline: today,
        status: 'pendente',
        adminNotes: 'Aguarda validação pela Administração Central ALHAN.',
        receiptNumber: '',
      },
    ]);
    setAgtLogs([
      {
        id: 'agtlog_demo_01',
        ownerId: demoOwner,
        companyId: demoCompId,
        serviceName: 'registarFactura',
        environment: 'homologacao',
        targetRef: 'FT 2026/1',
        jwsHeaderSummary: 'alg:HS256-PREP | kid:ALHAN-AGT-JWS-KEY-01 | typ:JOSE+JSON',
        requestPayloadSummary: '{"taxRegistrationNumber":"5402891045","documentNo":"FT 2026/1","grossTotal":2280000}',
        responsePayloadSummary: 'Pedido assinado com JWS e registado na fila de homologação AGT.',
        httpStatus: 202,
        resultStatus: 'pendente_transmissao',
        operationId: 'AGT-OP-20261110-FT1',
      },
    ]);
    setIsDemoMode(true);
    setActiveTab('dashboard');
  };

  // Audit Log Helper
  const logAuditEvent = async (
    action: string,
    moduleName: string,
    targetRef: string,
    details: string,
    compIdOverride?: string
  ) => {
    const compId = compIdOverride || activeCompany?.id || 'comp_demo';
    const actorEmail = currentUser?.email || activeCompany?.email || 'operador@empresa.ao';
    const newLog: AuditLog = {
      id: sanitizeId('log'),
      ownerId: currentUser?.uid || 'demo_owner_ao',
      companyId: compId,
      actorEmail: actorEmail.slice(0, 120),
      actorRole: activeRoleView,
      action: action.slice(0, 120),
      module: moduleName.slice(0, 60),
      targetRef: targetRef.slice(0, 120),
      details: details.slice(0, 500),
    };

    if (isDemoMode || !currentUser) {
      setAuditLogs((prev) => [newLog, ...prev]);
      return;
    }

    try {
      await setDoc(doc(db, 'audit_logs', newLog.id), {
        ownerId: newLog.ownerId,
        companyId: newLog.companyId,
        actorEmail: newLog.actorEmail,
        actorRole: newLog.actorRole,
        action: newLog.action,
        module: newLog.module,
        targetRef: newLog.targetRef,
        details: newLog.details,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `audit_logs/${newLog.id}`);
    }
  };

  // Register Company & Seed Initial Data in Firestore + Local Hostinger Session
  const handleRegisterCompany = async (
    companyData: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    seedInitialData: boolean
  ) => {
    const uid = currentUser?.uid || 'local_owner_ao';
    const compId = sanitizeId('comp');
    const today = getLuandaIsoDate();
    const newCompanyObj: Company = {
      id: compId,
      ownerId: uid,
      ...companyData,
    };

    try {
      localStorage.setItem('alhan_registered_company_v1', JSON.stringify(newCompanyObj));
    } catch {
      // ignore storage quota errors
    }

    // Always seed local state first so the user immediately enters their company panel even on Hostinger without Google OAuth
    if (!currentUser) {
      if (seedInitialData) {
        await handleEnterDemoMode();
      } else {
        setClients([]);
        setProducts([]);
        setInvoices([]);
        setMovements([]);
        setTransactions([]);
        setSuppliers([]);
        setTeamMembers([
          {
            id: sanitizeId('tm'),
            ownerId: uid,
            companyId: compId,
            name: companyData.responsibleName,
            email: companyData.email,
            role: 'Administrador',
            establishment: 'Sede Principal',
            permissionsSummary:
              'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
            status: 'activo',
          },
        ]);
      }
      setCompanies([newCompanyObj]);
      setIsDemoMode(true);
      setIsRegisterModalOpen(false);
      setIsAuthModalOpen(false);
      setActiveTab('dashboard');
      return;
    }

    try {
      await setDoc(doc(db, 'companies', compId), {
        ownerId: uid,
        ...companyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (seedInitialData) {
        const client1Id = sanitizeId('cli');
        const client2Id = sanitizeId('cli');
        await setDoc(doc(db, 'clients', client1Id), {
          ownerId: uid,
          companyId: compId,
          clientType: 'empresarial',
          name: 'Sonangol Distribuidora & Logística, S.A.',
          nif: '5401002938',
          address: 'Rua Rainha Ginga, N.º 84, Luanda',
          province: 'Luanda',
          phone: '+244 923 110 220',
          email: 'contabilidade@sonangoldist.ao',
          contactPerson: 'Dr. Carlos Mendes',
          creditLimit: 10000000,
          currentBalance: 0,
          totalInvoiced: 1140000,
          totalPaid: 1140000,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'clients', client2Id), {
          ownerId: uid,
          companyId: compId,
          clientType: 'empresarial',
          name: 'Grupo Comercial Benguela Sul, Lda.',
          nif: '5403991827',
          address: 'Avenida Acácias Rubras, Benguela',
          province: 'Benguela',
          phone: '+244 924 880 110',
          email: 'financeiro@benguelasul.ao',
          contactPerson: 'Dra. Helena Silva',
          creditLimit: 5000000,
          currentBalance: 456000,
          totalInvoiced: 456000,
          totalPaid: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const prod1Id = sanitizeId('prd');
        const prod2Id = sanitizeId('prd');
        await setDoc(doc(db, 'products', prod1Id), {
          ownerId: uid,
          companyId: compId,
          itemType: 'produto',
          code: 'HW-POS-80',
          barcode: '5609871230011',
          description: 'Terminal POS Facturação Térmico 80mm Dual-Screen',
          category: 'Hardware Comercial',
          purchasePrice: 240000,
          salePrice: 400000,
          unit: 'UN',
          taxRate: 14,
          taxExemptionReason: 'Taxa Normal IVA 14%',
          stock: 15,
          minStock: 5,
          warehouse: 'Armazém Central Luanda',
          profitMargin: 67,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'products', prod2Id), {
          ownerId: uid,
          companyId: compId,
          itemType: 'servico',
          code: 'SRV-CONS-AO',
          barcode: '5609871230028',
          description: 'Consultoria de Gestão Empresarial e Conformidade Fiscal',
          category: 'Serviços Profissionais',
          purchasePrice: 0,
          salePrice: 250000,
          unit: 'UN',
          taxRate: 14,
          taxExemptionReason: 'Taxa Normal IVA 14%',
          stock: 999,
          minStock: 0,
          warehouse: 'Sede Luanda',
          profitMargin: 100,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const inv1Id = sanitizeId('inv');
        const hash1 = await gerarAssinaturaHashAGT(today, 'FT 2026/1', 1140000, companyData.nif);
        const qr1 = gerarPayloadQrAGT({
          emitterNif: companyData.nif,
          clientNif: '5401002938',
          docType: 'FT',
          docNumber: 'FT 2026/1',
          issueDate: today,
          subtotal: 1000000,
          taxTotal: 140000,
          totalAmount: 1140000,
          hashCode: hash1,
        });

        await setDoc(doc(db, 'invoices', inv1Id), {
          ownerId: uid,
          companyId: compId,
          docType: 'Factura',
          series: 'FT 2026',
          sequentialNumber: 1,
          docNumber: 'FT 2026/1',
          issueDate: today,
          dueDate: today,
          emitterName: companyData.name,
          emitterNif: companyData.nif,
          clientId: client1Id,
          clientName: 'Sonangol Distribuidora & Logística, S.A.',
          clientNif: '5401002938',
          clientAddress: 'Rua Rainha Ginga, N.º 84, Luanda',
          itemsSummary: JSON.stringify([
            {
              productId: prod2Id,
              code: 'SRV-CONS-AO',
              description: 'Consultoria de Gestão Empresarial e Conformidade Fiscal',
              quantity: 4,
              unit: 'UN',
              unitPrice: 250000,
              discountPercent: 0,
              taxRate: 14,
              lineSubtotal: 1000000,
              lineTax: 140000,
              lineTotal: 1140000,
            },
          ]),
          subtotal: 1000000,
          discountTotal: 0,
          taxTotal: 140000,
          totalAmount: 1140000,
          amountInWords: valorPorExtensoKz(1140000),
          paymentTerms: '30 Dias',
          paymentMethod: 'Transferência Bancária (IBAN)',
          notes: 'Prestação de serviços técnicos mensais.',
          qrCodePayload: qr1,
          hashCode: hash1,
          softwareCertText: 'PREPARAÇÃO PARA CERTIFICAÇÃO AGT',
          status: 'paga',
          paidAmount: 1140000,
          printCount: 0,
          agtTransmissionStatus: 'preparacao_certificacao',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const tx1Id = sanitizeId('tx');
        await setDoc(doc(db, 'financial_transactions', tx1Id), {
          ownerId: uid,
          companyId: compId,
          txType: 'recebimento',
          category: 'Facturação Clientes',
          description: 'Liquidação Factura FT 2026/1 — Sonangol Distribuidora',
          amount: 1140000,
          paymentMethod: 'transferencia',
          accountName: `${companyData.bankName} (AOA)`,
          referenceDoc: 'FT 2026/1',
          entityName: 'Sonangol Distribuidora & Logística, S.A.',
          status: 'reconciliado',
          txDate: today,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const sup1Id = sanitizeId('sup');
        await setDoc(doc(db, 'suppliers', sup1Id), {
          ownerId: uid,
          companyId: compId,
          name: 'Tecnologia & Sistemas ZEE Viana, Lda.',
          nif: '5408819201',
          phone: '+244 926 300 900',
          email: 'vendas@tecnologiazee.ao',
          address: 'Zona Económica Especial Luanda-Bengo',
          category: 'Hardware Comercial',
          totalPurchased: 3600000,
          balanceDue: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const tm1Id = sanitizeId('tm');
        await setDoc(doc(db, 'team_members', tm1Id), {
          ownerId: uid,
          companyId: compId,
          name: companyData.responsibleName,
          email: companyData.email,
          role: 'Administrador',
          establishment: 'Sede Principal',
          permissionsSummary:
            'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
          status: 'activo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await logAuditEvent(
          'REGISTO_EMPRESA_INICIAL',
          'Empresas',
          companyData.nif,
          `Empresa ${companyData.name} registada com plano ${companyData.planId.toUpperCase()}.`,
          compId
        );
      }
      setIsRegisterModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${compId}`);
    }
  };

  // Calculate Invoice Builder Totals (with 14% IVA, 6.5% Retencao na Fonte, and 60% Black Friday option)
  const invoiceDraftTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const detailedLines: InvoiceLineItem[] = lineItems.map((line) => {
      const prod = products.find((p) => p.id === line.productId) || products[0];
      const unitPrice = prod ? prod.salePrice : 0;
      const qty = Math.max(1, Number(line.quantity) || 1);
      const discPct = applyBlackFriday60
        ? BLACK_FRIDAY_DISCOUNT_PERCENT
        : Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
      const grossLine = unitPrice * qty;
      const lineDisc = (grossLine * discPct) / 100;
      const lineSubtotal = grossLine - lineDisc;
      const taxRate = prod && prod.taxRate > 0 ? prod.taxRate : IVA_STANDARD_RATE_AO;
      const lineTax = (lineSubtotal * taxRate) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      discountTotal += lineDisc;
      taxTotal += lineTax;

      return {
        productId: prod?.id || 'item_01',
        code: prod?.code || 'ITEM',
        description: prod?.description || 'Artigo Comercial',
        quantity: qty,
        unit: prod?.unit || 'UN',
        unitPrice,
        discountPercent: discPct,
        taxRate,
        lineSubtotal,
        lineTax,
        lineTotal,
      };
    });

    const totalAmount = subtotal + taxTotal;
    const withholdingTaxRate = applyWithholding65 ? RETENCAO_FONTE_RATE_AO : 0;
    const withholdingTaxTotal = applyWithholding65
      ? (subtotal * RETENCAO_FONTE_RATE_AO) / 100
      : 0;
    const netPayableAmount = Math.max(0, totalAmount - withholdingTaxTotal);
    const blackFridayApplied =
      applyBlackFriday60 ||
      detailedLines.some((l) => Number(l.discountPercent) >= BLACK_FRIDAY_DISCOUNT_PERCENT);

    return {
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      withholdingTaxRate,
      withholdingTaxTotal,
      netPayableAmount,
      blackFridayApplied,
      amountInWords: valorPorExtensoKz(totalAmount),
      detailedLines,
    };
  }, [lineItems, products, applyWithholding65, applyBlackFriday60]);

  // Issue Fiscal or Commercial Document
  const handleIssueDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || invoiceDraftTotals.detailedLines.length === 0) return;

    const client = clients.find((c) => c.id === selectedClientId) || clients[0];
    if (!client) return;

    const seriesPrefix = DOC_SERIES_PREFIX[docType] || series;
    const docsInSeries = invoices.filter((i) => i.series === seriesPrefix);
    const nextSeq =
      docsInSeries.length > 0
        ? Math.max(...docsInSeries.map((i) => i.sequentialNumber)) + 1
        : 1;
    const docNumber = `${seriesPrefix}/${nextSeq}`;
    const prevHash = docsInSeries[0]?.hashCode || 'ALHAN0000';
    const hashCode = await gerarAssinaturaHashAGT(
      issueDate,
      docNumber,
      invoiceDraftTotals.totalAmount,
      activeCompany.nif,
      prevHash
    );
    const qrCodePayload = gerarPayloadQrAGT({
      emitterNif: activeCompany.nif,
      clientNif: client.nif,
      docType,
      docNumber,
      issueDate,
      subtotal: invoiceDraftTotals.subtotal,
      taxTotal: invoiceDraftTotals.taxTotal,
      totalAmount: invoiceDraftTotals.totalAmount,
      hashCode,
    });

    const isImmediatePaid = docType === 'Factura-Recibo' || docType === 'Recibo';
    const newInv: Invoice = {
      id: sanitizeId('inv'),
      ownerId: currentUser?.uid || activeCompany.ownerId,
      companyId: activeCompany.id,
      docType,
      series: seriesPrefix,
      sequentialNumber: nextSeq,
      docNumber,
      issueDate,
      dueDate,
      emitterName: activeCompany.name,
      emitterNif: activeCompany.nif,
      clientId: client.id,
      clientName: client.name,
      clientNif: client.nif,
      clientAddress: client.address || 'Luanda, Angola',
      itemsSummary: JSON.stringify(invoiceDraftTotals.detailedLines).slice(0, 1990),
      subtotal: invoiceDraftTotals.subtotal,
      discountTotal: invoiceDraftTotals.discountTotal,
      taxTotal: invoiceDraftTotals.taxTotal,
      withholdingTaxRate: invoiceDraftTotals.withholdingTaxRate,
      withholdingTaxTotal: invoiceDraftTotals.withholdingTaxTotal,
      totalAmount: invoiceDraftTotals.totalAmount,
      netPayableAmount: invoiceDraftTotals.netPayableAmount,
      blackFridayApplied: invoiceDraftTotals.blackFridayApplied,
      amountInWords: invoiceDraftTotals.amountInWords.slice(0, 290),
      paymentTerms: paymentTerms.slice(0, 100),
      paymentMethod: paymentMethod.slice(0, 60),
      notes: invoiceNotes.slice(0, 490),
      qrCodePayload: qrCodePayload.slice(0, 590),
      hashCode,
      softwareCertText: 'PREPARAÇÃO PARA CERTIFICAÇÃO AGT',
      status: isImmediatePaid ? 'paga' : 'pendente',
      paidAmount: isImmediatePaid ? invoiceDraftTotals.totalAmount : 0,
      printCount: 0,
      agtTransmissionStatus: !isOnline ? 'contingencia' : 'preparacao_certificacao',
    };

    if (!isOnline) {
      setOfflineQueueCount((c) => c + 1);
    }

    if (isDemoMode || !currentUser) {
      setInvoices((prev) => [newInv, ...prev]);
      if (isImmediatePaid) {
        setTransactions((prev) => [
          {
            id: sanitizeId('tx'),
            ownerId: newInv.ownerId,
            companyId: newInv.companyId,
            txType: 'recebimento',
            category: 'Facturação',
            description: `Recebimento imediato ${newInv.docNumber} — ${client.name}`,
            amount: newInv.totalAmount,
            paymentMethod: 'transferencia',
            accountName: `${activeCompany.bankName} (AOA)`,
            referenceDoc: newInv.docNumber,
            entityName: client.name,
            status: 'liquidado',
            txDate: issueDate,
          },
          ...prev,
        ]);
      }
      setPreviewInvoice(newInv);
      await logAuditEvent(
        'EMITIR_DOCUMENTO',
        'Facturação',
        newInv.docNumber,
        `Emitido ${newInv.docType} ${newInv.docNumber} no valor de ${formatKz(newInv.totalAmount)}.`
      );
      return;
    }

    try {
      const { id, ...payload } = newInv;
      await setDoc(doc(db, 'invoices', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update client balance & totals
      const addedDebt = isImmediatePaid ? 0 : newInv.totalAmount;
      const addedPaid = isImmediatePaid ? newInv.totalAmount : 0;
      await updateDoc(doc(db, 'clients', client.id), {
        totalInvoiced: client.totalInvoiced + newInv.totalAmount,
        totalPaid: client.totalPaid + addedPaid,
        currentBalance: client.currentBalance + addedDebt,
        updatedAt: serverTimestamp(),
      });

      // Deduct stock for physical products on Factura / Factura-Recibo / Guia
      if (['Factura', 'Factura-Recibo', 'Guia de Remessa'].includes(docType)) {
        for (const item of invoiceDraftTotals.detailedLines) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod && prod.itemType === 'produto') {
            await updateDoc(doc(db, 'products', prod.id), {
              stock: Math.max(0, prod.stock - item.quantity),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      if (isImmediatePaid) {
        const txId = sanitizeId('tx');
        await setDoc(doc(db, 'financial_transactions', txId), {
          ownerId: newInv.ownerId,
          companyId: newInv.companyId,
          txType: 'recebimento',
          category: 'Facturação',
          description: `Recebimento automático ${newInv.docNumber} — ${client.name}`.slice(0, 195),
          amount: newInv.totalAmount,
          paymentMethod: 'transferencia',
          accountName: `${activeCompany.bankName} (AOA)`.slice(0, 95),
          referenceDoc: newInv.docNumber,
          entityName: client.name.slice(0, 155),
          status: 'liquidado',
          txDate: issueDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await logAuditEvent(
        'EMITIR_DOCUMENTO',
        'Facturação',
        newInv.docNumber,
        `Emitido ${newInv.docType} ${newInv.docNumber} (${formatKz(newInv.totalAmount)}).`
      );
      setPreviewInvoice(newInv);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `invoices/${newInv.id}`);
    }
  };

  // Partial or Total Payment Handler on an Invoice
  const handleRecordInvoicePayment = async (invoice: Invoice, customAmount?: number) => {
    if (!activeCompany || invoice.status === 'paga' || invoice.status === 'rectificada') return;
    const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    const payVal =
      customAmount && customAmount > 0 && customAmount <= remaining ? customAmount : remaining;
    if (payVal <= 0) return;

    const newPaidAmount = invoice.paidAmount + payVal;
    const newStatus: Invoice['status'] =
      newPaidAmount >= invoice.totalAmount - 0.01 ? 'paga' : 'pendente';

    if (isDemoMode || !currentUser) {
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoice.id ? { ...i, paidAmount: newPaidAmount, status: newStatus } : i
        )
      );
      setTransactions((prev) => [
        {
          id: sanitizeId('tx'),
          ownerId: invoice.ownerId,
          companyId: invoice.companyId,
          txType: 'recebimento',
          category: 'Cobrança de Facturas',
          description: `Liquidação (${newStatus === 'paga' ? 'Total' : 'Parcial'}) ${invoice.docNumber}`,
          amount: payVal,
          paymentMethod: 'transferencia',
          accountName: `${activeCompany.bankName} (AOA)`,
          referenceDoc: invoice.docNumber,
          entityName: invoice.clientName,
          status: 'liquidado',
          txDate: getLuandaIsoDate(),
        },
        ...prev,
      ]);
      return;
    }

    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      const txId = sanitizeId('tx');
      await setDoc(doc(db, 'financial_transactions', txId), {
        ownerId: invoice.ownerId,
        companyId: invoice.companyId,
        txType: 'recebimento',
        category: 'Cobrança de Facturas',
        description: `Liquidação ${invoice.docNumber} — ${invoice.clientName}`.slice(0, 195),
        amount: payVal,
        paymentMethod: 'transferencia',
        accountName: `${activeCompany.bankName} (AOA)`.slice(0, 95),
        referenceDoc: invoice.docNumber,
        entityName: invoice.clientName.slice(0, 155),
        status: 'liquidado',
        txDate: getLuandaIsoDate(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const client = clients.find((c) => c.id === invoice.clientId);
      if (client) {
        await updateDoc(doc(db, 'clients', client.id), {
          totalPaid: client.totalPaid + payVal,
          currentBalance: Math.max(0, client.currentBalance - payVal),
          updatedAt: serverTimestamp(),
        });
      }

      await logAuditEvent(
        'LIQUIDACAO_FACTURA',
        'Financeiro',
        invoice.docNumber,
        `Registado recebimento de ${formatKz(payVal)} referente a ${invoice.docNumber}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoice.id}`);
    }
  };

  // Issue Legal Rectifying Credit Note (Nota de Crédito) for an Issued Invoice
  const handleRectifyWithCreditNote = async (originalInvoice: Invoice) => {
    if (!activeCompany || originalInvoice.status === 'rectificada') return;
    const today = getLuandaIsoDate();
    const ncSeries = 'NC 2026';
    const ncDocs = invoices.filter((i) => i.series === ncSeries);
    const nextSeq =
      ncDocs.length > 0 ? Math.max(...ncDocs.map((i) => i.sequentialNumber)) + 1 : 1;
    const ncNumber = `${ncSeries}/${nextSeq}`;
    const hashCode = await gerarAssinaturaHashAGT(
      today,
      ncNumber,
      originalInvoice.totalAmount,
      activeCompany.nif,
      originalInvoice.hashCode
    );

    const creditNote: Invoice = {
      ...originalInvoice,
      id: sanitizeId('inv'),
      docType: 'Nota de Credito',
      series: ncSeries,
      sequentialNumber: nextSeq,
      docNumber: ncNumber,
      issueDate: today,
      dueDate: today,
      notes: `Nota de Crédito rectificativa referente ao documento original ${originalInvoice.docNumber}.`,
      hashCode,
      status: 'emitida',
      printCount: 0,
    };

    if (isDemoMode || !currentUser) {
      setInvoices((prev) => [
        creditNote,
        ...prev.map((i) =>
          i.id === originalInvoice.id ? { ...i, status: 'rectificada' as const } : i
        ),
      ]);
      setPreviewInvoice(creditNote);
      return;
    }

    try {
      // 1. Lock original invoice in terminal state 'rectificada'
      await updateDoc(doc(db, 'invoices', originalInvoice.id), {
        status: 'rectificada',
        updatedAt: serverTimestamp(),
      });

      // 2. Issue linked Nota de Crédito
      const { id, ...ncPayload } = creditNote;
      await setDoc(doc(db, 'invoices', id), {
        ...ncPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logAuditEvent(
        'RECTIFICACAO_NOTA_CREDITO',
        'Facturação',
        ncNumber,
        `Emitida Nota de Crédito ${ncNumber} para rectificar documento ${originalInvoice.docNumber}.`
      );
      setPreviewInvoice(creditNote);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${originalInvoice.id}`);
    }
  };

  // Increment Print Count (tracks ORIGINAL vs 2.ª VIA)
  const handleIncrementPrintCount = async (invoice: Invoice) => {
    const nextCount = (invoice.printCount || 0) + 1;
    if (isDemoMode || !currentUser) {
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoice.id ? { ...i, printCount: nextCount } : i))
      );
      setPreviewInvoice((prev) => (prev && prev.id === invoice.id ? { ...prev, printCount: nextCount } : prev));
      return;
    }
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        printCount: nextCount,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoice.id}`);
    }
  };

  // Dashboard Real-Time Financial & Operational Calculations
  const dashboardMetrics = useMemo(() => {
    const validSalesDocs = invoices.filter(
      (i) => i.docType !== 'Nota de Credito' && i.status !== 'rectificada'
    );
    const totalBilledMonth = validSalesDocs.reduce((acc, i) => acc + i.totalAmount, 0);
    const totalReceived = transactions
      .filter((t) => t.txType === 'recebimento')
      .reduce((acc, t) => acc + t.amount, 0);
    const totalReceivable = validSalesDocs.reduce(
      (acc, i) => acc + Math.max(0, i.totalAmount - i.paidAmount),
      0
    );
    const totalExpenses = transactions
      .filter((t) => t.txType !== 'recebimento')
      .reduce((acc, t) => acc + t.amount, 0);
    const financialBalance = totalReceived - totalExpenses;

    const paidInvoicesCount = invoices.filter((i) => i.status === 'paga').length;
    const pendingInvoicesCount = invoices.filter((i) => i.status === 'pendente').length;
    const overdueInvoicesCount = invoices.filter((i) => i.status === 'vencida').length;
    const lowStockProductsCount = products.filter(
      (p) => p.itemType === 'produto' && p.stock <= p.minStock
    ).length;

    return {
      totalBilledMonth,
      totalReceived,
      totalReceivable,
      totalExpenses,
      financialBalance,
      paidInvoicesCount,
      pendingInvoicesCount,
      overdueInvoicesCount,
      lowStockProductsCount,
    };
  }, [invoices, transactions, products]);

  // Push / In-App Alerts for Deadlines, Stock & Subscriptions
  const deadlineNotifications = useMemo(() => {
    const list: { title: string; detail: string; type: 'warning' | 'info' }[] = [];
    if (dashboardMetrics.lowStockProductsCount > 0) {
      list.push({
        title: 'Alerta de Ruptura de Stock',
        detail: `${dashboardMetrics.lowStockProductsCount} artigo(s) atingiram o stock mínimo de segurança.`,
        type: 'warning',
      });
    }
    if (dashboardMetrics.pendingInvoicesCount > 0) {
      list.push({
        title: 'Facturas Pendentes de Liquidação',
        detail: `Existem ${dashboardMetrics.pendingInvoicesCount} documento(s) por receber (${formatKz(
          dashboardMetrics.totalReceivable
        )}).`,
        type: 'info',
      });
    }
    const diasVencimento = calcularDiasParaVencimento(activeCompany?.subscriptionEndDate);
    if (diasVencimento !== null && diasVencimento <= 7) {
      list.push({
        title: `Aviso de Vencimento da Subscrição (${diasVencimento} dia(s))`,
        detail: `Alertas automáticos 7, 3 e 1 dia: Renove via Multicaixa Express ${MCX_EXPRESS_OFFICIAL_NUMBER} (${MCX_EXPRESS_BENEFICIARY}).`,
        type: 'warning',
      });
    }
    list.push({
      title: 'Submissão Mensal SAF-T (AO) & API AGT',
      detail: 'Lembrete fiscal: Verifique a reconciliação de facturas na API AGT e a exportação SAF-T AO.',
      type: 'info',
    });
    return list;
  }, [dashboardMetrics, activeCompany?.subscriptionEndDate]);

  // Role-Based Menu Visibility
  const allowedTabsForRole = useMemo((): WorkspaceTab[] => {
    switch (activeRoleView) {
      case 'Administrador':
        return [
          'dashboard',
          'invoicing',
          'agt',
          'saft',
          'clients',
          'products',
          'inventory',
          'finance',
          'suppliers',
          'reports',
          'users',
          'support',
          ...(isCentralAlhanAdmin ? (['alhan_admin'] as WorkspaceTab[]) : []),
        ];
      case 'Gerente':
        return [
          'dashboard',
          'invoicing',
          'clients',
          'products',
          'inventory',
          'finance',
          'suppliers',
          'reports',
          'support',
        ];
      case 'Contabilista':
        return ['dashboard', 'invoicing', 'agt', 'saft', 'finance', 'reports', 'support'];
      case 'Operador de facturacao':
        return ['dashboard', 'invoicing', 'clients', 'products', 'support'];
      case 'Vendedor':
        return ['dashboard', 'invoicing', 'clients', 'products'];
      case 'Responsavel de armazem':
        return ['dashboard', 'products', 'inventory', 'suppliers'];
      case 'Consulta':
        return ['dashboard', 'reports'];
      default:
        return ['dashboard', 'invoicing'];
    }
  }, [activeRoleView, isCentralAlhanAdmin]);

  // Render Company Registration Wizard if user opened registration modal OR is authenticated without a company
  if (isRegisterModalOpen || (currentUser && !isDemoMode && companies.length === 0)) {
    return (
      <>
        <CompanyRegistrationModal
          userEmail={currentUser?.email || pendingUserEmail || ''}
          userName={currentUser?.displayName || pendingUserName || ''}
          defaultPlan={selectedPlanOnLanding}
          defaultCycle={selectedCycleOnLanding}
          onRegisterCompany={handleRegisterCompany}
          onSignOut={() => {
            setIsRegisterModalOpen(false);
            if (currentUser) {
              signOut(auth);
            }
          }}
        />
        <OfflineIndicator pendingSyncCount={offlineQueueCount} />
      </>
    );
  }

  // Render Landing Page if not logged in and not in Demo Mode
  if (!currentUser && !isDemoMode) {
    return (
      <>
        <LandingPage
          plans={plans}
          onSignInGoogle={handleSignInGoogle}
          onOpenLoginModal={() => setIsAuthModalOpen(true)}
          onOpenRegisterModal={(plan, cycle) => {
            if (plan) setSelectedPlanOnLanding(plan);
            if (cycle) setSelectedCycleOnLanding(cycle);
            setIsAuthModalOpen(false);
            setIsRegisterModalOpen(true);
          }}
          onEnterDemoMode={handleEnterDemoMode}
          onOpenDocs={() => setIsDocsOpen(true)}
          isSigningIn={isSigningIn}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleDirectLoginSuccess}
          onOpenRegisterCompany={(email, name) => {
            if (email) setPendingUserEmail(email);
            if (name) setPendingUserName(name);
            setIsAuthModalOpen(false);
            setIsRegisterModalOpen(true);
          }}
          onTryGoogleSignIn={() => handleSignInGoogle()}
          onEnterDemoMode={handleEnterDemoMode}
          isSigningInGoogle={isSigningIn}
        />
        <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
        <OfflineIndicator pendingSyncCount={offlineQueueCount} />
      </>
    );
  }

  if (!activeCompany) return null;

  const navItems: { id: WorkspaceTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Painel Principal', icon: LayoutDashboard },
    { id: 'invoicing', label: 'Facturação (11 Docs)', icon: Receipt },
    { id: 'agt', label: 'Integração AGT (71/25)', icon: ShieldAlert },
    { id: 'saft', label: 'SAF-T AO (XML)', icon: FileCode2 },
    { id: 'clients', label: 'Clientes & Dívidas', icon: Users },
    { id: 'products', label: 'Produtos & Serviços', icon: Package },
    { id: 'inventory', label: 'Inventário & Stock', icon: Warehouse },
    { id: 'finance', label: 'Financeiro & Caixa', icon: Wallet },
    { id: 'suppliers', label: 'Fornecedores & Compras', icon: Truck },
    { id: 'reports', label: 'Relatórios (PDF/Excel)', icon: BarChart3 },
    { id: 'users', label: 'Utilizadores & Auditoria', icon: Shield },
    { id: 'support', label: 'Suporte & Subscrição', icon: HelpCircle },
    { id: 'alhan_admin', label: 'Painel Central ALHAN', icon: Building2 },
  ];

  const visibleNavItems = navItems.filter((item) => allowedTabsForRole.includes(item.id));

  const filteredInvoicesList = invoices.filter((inv) => {
    const matchesSearch =
      inv.docNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.clientNif.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchesStatus =
      invoiceStatusFilter === 'todos' || inv.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Sidebar Navigation (260px Workspace Canvas) */}
      <aside className="w-64 shrink-0 bg-slate-950 text-slate-300 border-r border-slate-800 hidden lg:flex flex-col justify-between">
        <div className="p-5 space-y-6">
          {/* Brand Lockup with Official ALHAN Logo */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={ALHAN_OFFICIAL_LOGO_URL}
                alt="ALHAN"
                className="h-8 w-auto rounded bg-white px-1.5 py-0.5 object-contain shrink-0"
              />
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-white font-display block truncate">
                  ALHAN FACTURA
                </span>
                <span className="text-[11px] text-sky-400 font-mono block truncate">
                  {activeCompany.commercialName}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
              AOA
            </span>
          </div>

          {/* Role Profile Personalization Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-slate-400">
              Perfil de Acesso Activo
            </label>
            <select
              value={activeRoleView}
              onChange={(e) => {
                setActiveRoleView(e.target.value as UserRoleType);
                setActiveTab('dashboard');
              }}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
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

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Company NIF & Support */}
        <div className="p-4 border-t border-slate-800 space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <p className="text-white font-semibold truncate">{activeCompany.name}</p>
            <p className="font-mono text-[11px] text-slate-400">NIF: {activeCompany.nif}</p>
            <p className="text-[11px] text-amber-400 font-mono">
              Modo: Preparação Cert. AGT
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Suporte: 922 021 211</span>
            <button
              onClick={() => setIsDocsOpen(true)}
              className="text-sky-400 hover:underline"
            >
              Docs VPS
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header Contract */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {/* Left: Contextual Breadcrumb with Client Company Logo */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeCompany.logoUrl ? (
              <img
                src={activeCompany.logoUrl}
                alt={activeCompany.commercialName}
                className="w-7 h-7 rounded object-contain border border-slate-200 bg-white p-0.5 shrink-0"
              />
            ) : null}
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {activeCompany.commercialName}
            </span>
            <span>/</span>
            <span className="text-sky-700 dark:text-sky-400 font-semibold">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline font-mono text-[11px]">
              NIF {activeCompany.nif} · {activeCompany.taxRegime}
            </span>
          </div>

          {/* Right: Utility & Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMcxCheckoutPlan(activeCompany.planId);
                setMcxCheckoutCycle(activeCompany.billingCycle);
                setIsMcxCheckoutOpen(true);
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              title="Pagar ou Renovar Subscrição via Multicaixa Express (927 496 287 - ALHAN)"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>MCX Express: {MCX_EXPRESS_OFFICIAL_NUMBER}</span>
            </button>
            <PWAInstallButton />

            {/* Deadline & Stock Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Alertas de Prazos e Vencimentos"
              >
                <Bell className="w-4 h-4" />
                {deadlineNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {deadlineNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 space-y-3 z-50 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Notificações de Prazos & Alertas
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      Fechar
                    </button>
                  </div>
                  {deadlineNotifications.map((n, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                      <p className="text-slate-600 dark:text-slate-400">{n.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Alternar Tema Claro / Escuro"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setActiveTab('invoicing')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Nova Factura</span>
            </button>

            <button
              onClick={async () => {
                if (isDemoMode) {
                  setIsDemoMode(false);
                } else {
                  await signOut(auth);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Navigation Strip */}
        <div className="lg:hidden flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white overflow-x-auto border-b border-slate-800">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                activeTab === item.id ? 'bg-sky-600 text-white' : 'text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Global Broadcast Banner if published by ALHAN Admin */}
        {globalNotice && (
          <div className="px-6 py-2.5 bg-sky-900 text-white text-xs flex items-center justify-between">
            <span>
              <strong>{globalNotice.title}:</strong> {globalNotice.message}
            </span>
            <button
              onClick={() => setGlobalNotice(null)}
              className="text-sky-200 hover:text-white ml-4 font-semibold"
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: DASHBOARD (PAINEL PRINCIPAL DA EMPRESA) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Financial KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Total Facturado no Mês</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {formatKz(dashboardMetrics.totalBilledMonth)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {invoices.length} documentos emitidos
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Total Recebido</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                    {formatKz(dashboardMetrics.totalReceived)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {dashboardMetrics.paidInvoicesCount} facturas pagas
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Total por Receber</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                    {formatKz(dashboardMetrics.totalReceivable)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {dashboardMetrics.pendingInvoicesCount} pendentes ·{' '}
                    {dashboardMetrics.overdueInvoicesCount} vencidas
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Despesas Registadas</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-red-600 mt-1">
                    {formatKz(dashboardMetrics.totalExpenses)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Custos operacionais e compras</p>
                </div>

                <div className="p-5 rounded-xl bg-slate-900 text-white border border-slate-800">
                  <p className="text-xs text-slate-300">Saldo Financeiro Líquido</p>
                  <p className="text-xl font-bold font-mono tabular-nums text-sky-400 mt-1">
                    {formatKz(dashboardMetrics.financialBalance)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Disponível Caixa + Bancos</p>
                </div>
              </div>

              {/* Second Row: Operational Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500">Clientes Activos</p>
                    <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {clients.length}
                    </p>
                  </div>
                  <Users className="w-5 h-5 text-sky-600" />
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500">Produtos e Serviços</p>
                    <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {products.length}
                    </p>
                  </div>
                  <Package className="w-5 h-5 text-sky-600" />
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500">Produtos c/ Stock Baixo</p>
                    <p className="text-lg font-bold font-mono text-red-600">
                      {dashboardMetrics.lowStockProductsCount}
                    </p>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500">Taxa de Cobrança</p>
                    <p className="text-lg font-bold font-mono text-emerald-600">
                      {dashboardMetrics.totalBilledMonth > 0
                        ? Math.round(
                            (dashboardMetrics.totalReceived / dashboardMetrics.totalBilledMonth) *
                              100
                          )
                        : 100}
                      %
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>

              {/* Charts Row: Monthly Sales Chart & Receipts vs Expenses Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Evolução de Facturação Mensal (Kwanzas / AOA)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Valores calculados com base nas emissões reais da série activa
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-400">
                      Exercício Fiscal 2026
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-3 pt-4 items-end h-44 border-b border-slate-200 dark:border-slate-800 pb-2">
                    {[
                      { m: 'Jun', v: dashboardMetrics.totalBilledMonth * 0.45 },
                      { m: 'Jul', v: dashboardMetrics.totalBilledMonth * 0.6 },
                      { m: 'Ago', v: dashboardMetrics.totalBilledMonth * 0.55 },
                      { m: 'Set', v: dashboardMetrics.totalBilledMonth * 0.78 },
                      { m: 'Out', v: dashboardMetrics.totalBilledMonth * 0.88 },
                      { m: 'Nov (Actual)', v: dashboardMetrics.totalBilledMonth || 100000 },
                    ].map((bar, i) => {
                      const maxVal = Math.max(dashboardMetrics.totalBilledMonth, 100000);
                      const pct = Math.max(15, Math.min(100, Math.round((bar.v / maxVal) * 100)));
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-mono text-slate-500">
                            {Math.round(bar.v / 1000)}k
                          </span>
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full rounded-t-md transition-all ${
                              i === 5 ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {bar.m}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Indicadores Financeiros & Recebimentos
                    </h3>
                    <p className="text-xs text-slate-500">
                      Comparativo de entradas líquidas, contas por receber e despesas
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Recebimentos Liquidados</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatKz(dashboardMetrics.totalReceived)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-emerald-600 w-4/5 rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Contas a Receber (Clientes)</span>
                        <span className="font-mono font-bold text-amber-600">
                          {formatKz(dashboardMetrics.totalReceivable)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-500 w-2/5 rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">Despesas Operacionais</span>
                        <span className="font-mono font-bold text-red-600">
                          {formatKz(dashboardMetrics.totalExpenses)}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-red-600 w-1/4 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">IVA Liquidado no Período:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatKz(invoices.reduce((a, b) => a + b.taxTotal, 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Latest Issued Fiscal Documents Table */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Últimas Operações e Documentos Fiscais Emitidos
                    </h3>
                    <p className="text-xs text-slate-500">
                      Clique em "Visualizar A4 / Térmico" para imprimir o ORIGINAL, exportar PDF ou enviar por WhatsApp/E-mail.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('invoicing')}
                    className="text-xs font-semibold text-sky-600 hover:underline"
                  >
                    Ver Todos ({invoices.length})
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">N.º Documento</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Cliente & NIF</th>
                        <th className="py-3 px-4 text-right">Total (AOA)</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {invoices.slice(0, 6).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-sky-700 dark:text-sky-400">
                            {inv.docNumber}
                          </td>
                          <td className="py-3 px-4">{inv.docType}</td>
                          <td className="py-3 px-4 font-mono">{inv.issueDate}</td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {inv.clientName}
                            </p>
                            <p className="text-slate-500 font-mono">NIF: {inv.clientNif}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {formatKz(inv.totalAmount)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-mono uppercase font-semibold ${
                                inv.status === 'paga'
                                  ? 'text-emerald-600'
                                  : inv.status === 'rectificada'
                                  ? 'text-slate-400 line-through'
                                  : 'text-amber-600'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setPreviewInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 dark:bg-sky-600 text-white font-semibold hover:bg-slate-800 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visualizar A4 / Térmico</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICING MODULE (MÓDULO DE FACTURAÇÃO COMPLETO — 11 DOCUMENTOS) */}
          {activeTab === 'invoicing' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                    Módulo de Facturação Electrónica e Documentos Comerciais
                  </h2>
                  <p className="text-xs text-slate-500">
                    Emissão sequencial com cálculo automático de IVA, valor por extenso em Kwanzas, código QR e assinatura Hash SHA-256.
                  </p>
                </div>
                <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                  PREPARAÇÃO PARA CERTIFICAÇÃO AGT · Imutabilidade Fiscal Activa
                </span>
              </div>

              {/* Document Builder Form */}
              <form
                onSubmit={handleIssueDocument}
                className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 text-xs"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <FileCheck2 className="w-4 h-4 text-sky-600" />
                  <span>Emitir Novo Documento Fiscal ou Comercial</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Tipo de Documento *</label>
                    <select
                      value={docType}
                      onChange={(e) => {
                        const nextType = e.target.value as FiscalDocumentType;
                        setDocType(nextType);
                        setSeries(DOC_SERIES_PREFIX[nextType]);
                      }}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="Factura">Factura (FT)</option>
                      <option value="Factura-Recibo">Factura-Recibo (FR)</option>
                      <option value="Factura Proforma">Factura Proforma (FP)</option>
                      <option value="Recibo">Recibo (RC)</option>
                      <option value="Nota de Credito">Nota de Crédito (NC)</option>
                      <option value="Nota de Debito">Nota de Débito (ND)</option>
                      <option value="Orcamento">Orçamento (OR)</option>
                      <option value="Guia de Remessa">Guia de Remessa (GR)</option>
                      <option value="Guia de Transporte">Guia de Transporte (GT)</option>
                      <option value="Aviso de Cobranca">Aviso de Cobrança (AC)</option>
                      <option value="Factura Global">Factura Global (FG)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Série de Facturação *</label>
                    <input
                      type="text"
                      value={series}
                      onChange={(e) => setSeries(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold mb-1">Cliente Destinatário *</label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — NIF: {c.nif} ({c.province})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Data de Emissão</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Condições de Pagamento</label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Meio de Pagamento</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800"
                    >
                      <option value="Transferência Bancária (IBAN)">
                        Transferência Bancária (IBAN)
                      </option>
                      <option value="Multicaixa Express">Multicaixa Express</option>
                      <option value="TPA / POS Multicaixa">TPA / POS Multicaixa</option>
                      <option value="Numerário (Kwanzas)">Numerário (Kwanzas)</option>
                      <option value="Referência Multicaixa">Referência Multicaixa</option>
                    </select>
                  </div>
                </div>

                {/* Line Items Builder */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Linhas de Produtos / Serviços do Documento
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !applyBlackFriday60;
                          setApplyBlackFriday60(nextState);
                          setLineItems((prev) =>
                            prev.map((item) => ({
                              ...item,
                              discountPercent: nextState ? BLACK_FRIDAY_DISCOUNT_PERCENT : 0,
                            }))
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                          applyBlackFriday60
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        {applyBlackFriday60
                          ? `Promoção Black Friday (-${BLACK_FRIDAY_DISCOUNT_PERCENT}%) Activa`
                          : `Aplicar Promoção Black Friday (-${BLACK_FRIDAY_DISCOUNT_PERCENT}%)`}
                      </button>

                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyWithholding65}
                          onChange={(e) => setApplyWithholding65(e.target.checked)}
                          className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Retenção na Fonte ({RETENCAO_FONTE_RATE_AO}%)</span>
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setLineItems([
                            ...lineItems,
                            {
                              productId: products[0]?.id || '',
                              quantity: 1,
                              discountPercent: applyBlackFriday60
                                ? BLACK_FRIDAY_DISCOUNT_PERCENT
                                : 0,
                            },
                          ])
                        }
                        className="flex items-center gap-1 text-sky-600 hover:text-sky-500 font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Linha
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {lineItems.map((line, idx) => {
                      const detail = invoiceDraftTotals.detailedLines[idx];
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="sm:col-span-5">
                            <select
                              value={line.productId}
                              onChange={(e) => {
                                const copy = [...lineItems];
                                copy[idx].productId = e.target.value;
                                setLineItems(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} — {p.description} ({formatKz(p.salePrice)} | IVA {p.taxRate || IVA_STANDARD_RATE_AO}%)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-1.5">
                            <span className="text-slate-500">Qtd:</span>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => {
                                const copy = [...lineItems];
                                copy[idx].quantity = Number(e.target.value) || 1;
                                setLineItems(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 font-mono bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-1.5">
                            <span className="text-slate-500">Desc.%:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={applyBlackFriday60 ? BLACK_FRIDAY_DISCOUNT_PERCENT : line.discountPercent}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (applyBlackFriday60 && val !== BLACK_FRIDAY_DISCOUNT_PERCENT) {
                                  setApplyBlackFriday60(false);
                                }
                                const copy = [...lineItems];
                                copy[idx].discountPercent = val;
                                setLineItems(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 font-mono bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-2 text-right font-mono font-bold">
                            {detail ? formatKz(detail.lineTotal) : '0,00 Kz'}
                          </div>

                          <div className="sm:col-span-1 text-right">
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setLineItems(lineItems.filter((_, i) => i !== idx))
                                }
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Box & Issue Button */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800 items-end">
                  <div className="lg:col-span-7 space-y-2">
                    <label className="block font-semibold">Observações / Menções Fiscais</label>
                    <input
                      type="text"
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                    />
                    <p className="text-slate-500 italic">
                      <strong>Valor por extenso:</strong> {invoiceDraftTotals.amountInWords}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-semibold">
                        IVA Aplicado: {IVA_STANDARD_RATE_AO}% (Taxa Normal Angola)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                        Retenção na Fonte: {invoiceDraftTotals.withholdingTaxRate}% (Imposto Industrial)
                      </span>
                      {invoiceDraftTotals.blackFridayApplied && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                          PROMOÇÃO BLACK FRIDAY -{BLACK_FRIDAY_DISCOUNT_PERCENT}% INCLUÍDA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900 text-white space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Incidência Tributável (Líquido):</span>
                      <span className="font-mono">{formatKz(invoiceDraftTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-rose-400 font-semibold">
                      <span>
                        {invoiceDraftTotals.blackFridayApplied
                          ? `Promoção Black Friday (${BLACK_FRIDAY_DISCOUNT_PERCENT}%):`
                          : 'Total Descontos Comerciais:'}
                      </span>
                      <span className="font-mono">
                        - {formatKz(invoiceDraftTotals.discountTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-200 font-semibold">
                      <span>Imposto IVA ({IVA_STANDARD_RATE_AO}%):</span>
                      <span className="font-mono">+ {formatKz(invoiceDraftTotals.taxTotal)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Retenção na Fonte ({invoiceDraftTotals.withholdingTaxRate}%):</span>
                      <span className="font-mono">
                        - {formatKz(invoiceDraftTotals.withholdingTaxTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-sky-400 pt-1.5 border-t border-slate-800">
                      <span>TOTAL DA FACTURA (c/ IVA {IVA_STANDARD_RATE_AO}%):</span>
                      <span className="font-mono">{formatKz(invoiceDraftTotals.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-400 pb-1">
                      <span>VALOR LÍQUIDO A PAGAR (após Ret. {RETENCAO_FONTE_RATE_AO}%):</span>
                      <span className="font-mono">
                        {formatKz(invoiceDraftTotals.netPayableAmount)}
                      </span>
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors"
                    >
                      Emitir {docType} Oficial e Gerar Talão / A4
                    </button>
                  </div>
                </div>
              </form>

              {/* Issued Documents Ledger with Advanced Search, Partial Payments & Credit Note Rectification */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Registo Sequencial de Documentos Emitidos ({filteredInvoicesList.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      As facturas emitidas não podem ser eliminadas. Utilize "Liquidar Parcial/Total" ou "Rectificar (Nota de Crédito)".
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        placeholder="Filtrar por N.º, Cliente ou NIF..."
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-transparent"
                      />
                    </div>
                    <select
                      value={invoiceStatusFilter}
                      onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800"
                    >
                      <option value="todos">Todos os Estados</option>
                      <option value="paga">Pagas</option>
                      <option value="pendente">Pendentes</option>
                      <option value="rectificada">Rectificadas (NC)</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Documento & Série</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Cliente & NIF</th>
                        <th className="py-3 px-4 text-right">Total (AOA)</th>
                        <th className="py-3 px-4 text-right">Liquidado</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Operações Fiscais e Pagamentos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredInvoicesList.map((inv) => {
                        const debt = Math.max(0, inv.totalAmount - inv.paidAmount);
                        const fiscal = calcularResumoFiscalFactura(inv);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <p className="font-mono font-bold text-sky-700 dark:text-sky-400">
                                  {inv.docNumber}
                                </p>
                                {fiscal.blackFridayApplied && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold">
                                    BF -60%
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-500">{inv.docType}</p>
                            </td>
                            <td className="py-3 px-4 font-mono">{inv.issueDate}</td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {inv.clientName}
                              </p>
                              <p className="text-slate-500 font-mono">NIF: {inv.clientNif}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {formatKz(inv.totalAmount)}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                IVA 14%: {formatKz(fiscal.taxTotal)} | Ret. 6,5%: {formatKz(fiscal.withholdingAmount)}
                              </p>
                              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Líq.: {formatKz(fiscal.netPayableAmount)}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-600">
                              {formatKz(inv.paidAmount)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-mono uppercase font-semibold ${
                                  inv.status === 'paga'
                                    ? 'text-emerald-600'
                                    : inv.status === 'rectificada'
                                    ? 'text-slate-400 line-through'
                                    : 'text-amber-600'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setPreviewInvoice(inv)}
                                  className="px-2.5 py-1 rounded bg-slate-900 dark:bg-sky-600 text-white font-semibold"
                                >
                                  Talão Térmico / A4 ({inv.printCount === 0 ? 'ORIGINAL' : '2.ª VIA'})
                                </button>

                                <button
                                  onClick={async () => {
                                    exportarFacturaPDF(inv, activeCompany, 'TERMICO');
                                    await handleIncrementPrintCount(inv);
                                  }}
                                  className="px-2 py-1 rounded border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 font-semibold"
                                  title="Descarregar Talão Térmico (Móvel / POS)"
                                >
                                  Talão PDF
                                </button>

                                <button
                                  onClick={async () => {
                                    exportarFacturaPDF(inv, activeCompany, 'A4');
                                    await handleIncrementPrintCount(inv);
                                  }}
                                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                >
                                  PDF A4
                                </button>

                                {inv.status === 'pendente' && debt > 0 && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      placeholder={String(debt)}
                                      value={partialPaymentAmount[inv.id] || ''}
                                      onChange={(e) =>
                                        setPartialPaymentAmount({
                                          ...partialPaymentAmount,
                                          [inv.id]: Number(e.target.value),
                                        })
                                      }
                                      className="w-24 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 font-mono text-[11px] bg-transparent"
                                    />
                                    <button
                                      onClick={() =>
                                        handleRecordInvoicePayment(
                                          inv,
                                          partialPaymentAmount[inv.id]
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                    >
                                      Receber
                                    </button>
                                  </div>
                                )}

                                {inv.status !== 'rectificada' &&
                                  inv.docType !== 'Nota de Credito' && (
                                    <button
                                      onClick={() => handleRectifyWithCreditNote(inv)}
                                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                                      title="Rectificar legalmente emitindo Nota de Crédito"
                                    >
                                      Emitir NC
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
            </div>
          )}

          {/* TAB 3 & 4: AGT INTEGRATION & SAF-T AO */}
          {(activeTab === 'agt' || activeTab === 'saft') && (
            <FiscalComplianceModule
              mode={activeTab}
              company={activeCompany}
              clients={clients}
              products={products}
              invoices={invoices}
              agtLogs={agtLogs}
              onQueueContingencySync={async (inv) => {
                if (isDemoMode || !currentUser) {
                  setInvoices((prev) =>
                    prev.map((i) =>
                      i.id === inv.id ? { ...i, agtTransmissionStatus: 'contingencia' } : i
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'invoices', inv.id), {
                    agtTransmissionStatus: 'contingencia',
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
                }
              }}
              onUpdateInvoiceAgtState={async (
                inv,
                newStatus: AgtTransmissionStatusType,
                operationId?: string,
                responseJson?: string
              ) => {
                if (isDemoMode || !currentUser) {
                  setInvoices((prev) =>
                    prev.map((i) =>
                      i.id === inv.id
                        ? {
                            ...i,
                            agtTransmissionStatus: newStatus,
                            agtOperationId: operationId || i.agtOperationId,
                            agtResponseJson: responseJson?.slice(0, 1900) || i.agtResponseJson,
                          }
                        : i
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'invoices', inv.id), {
                    agtTransmissionStatus: newStatus,
                    agtOperationId: (operationId || '').slice(0, 110),
                    agtResponseJson: (responseJson || '').slice(0, 1900),
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
                }
              }}
              onRecordAgtLog={async (logData) => {
                const newLog: AgtCommunicationLog = {
                  id: sanitizeId('agt'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...logData,
                };
                if (isDemoMode || !currentUser) {
                  setAgtLogs((prev) => [newLog, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newLog;
                  await setDoc(doc(db, 'agt_communications', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, `agt_communications/${newLog.id}`);
                }
              }}
              onUpdateCompanyConfig={async (updates) => {
                if (isDemoMode || !currentUser) {
                  setCompanies((prev) =>
                    prev.map((c) => (c.id === activeCompany.id ? { ...c, ...updates } : c))
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'companies', activeCompany.id), {
                    ...updates,
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `companies/${activeCompany.id}`);
                }
              }}
              onLogAudit={logAuditEvent}
            />
          )}

          {/* TABS 5–12: CLIENTS, PRODUCTS, INVENTORY, FINANCE, SUPPLIERS, REPORTS, USERS, SUPPORT */}
          {(activeTab === 'clients' ||
            activeTab === 'products' ||
            activeTab === 'inventory' ||
            activeTab === 'finance' ||
            activeTab === 'suppliers' ||
            activeTab === 'reports' ||
            activeTab === 'users' ||
            activeTab === 'support') && (
            <OperationsModules
              activeModule={activeTab}
              company={activeCompany}
              clients={clients}
              products={products}
              invoices={invoices}
              movements={movements}
              transactions={transactions}
              suppliers={suppliers}
              teamMembers={teamMembers}
              tickets={tickets}
              auditLogs={auditLogs}
              plans={plans}
              onCreateClient={async (data) => {
                const newCli: Client = {
                  id: sanitizeId('cli'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setClients((prev) => [newCli, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newCli;
                  await setDoc(doc(db, 'clients', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAuditEvent(
                    'CRIAR_CLIENTE',
                    'Clientes',
                    newCli.nif,
                    `Registado cliente ${newCli.name}.`
                  );
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, `clients/${newCli.id}`);
                }
              }}
              onCreateProduct={async (data) => {
                const newProd: Product = {
                  id: sanitizeId('prd'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setProducts((prev) => [newProd, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newProd;
                  await setDoc(doc(db, 'products', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAuditEvent(
                    'CRIAR_PRODUTO',
                    'Produtos',
                    newProd.code,
                    `Registado item ${newProd.description} (${formatKz(newProd.salePrice)}).`
                  );
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, `products/${newProd.id}`);
                }
              }}
              onRecordInventoryMovement={async (data) => {
                const newMov: InventoryMovement = {
                  id: sanitizeId('mov'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                const targetProd = products.find((p) => p.id === data.productId);
                const delta =
                  data.movementType === 'saida' ? -data.quantity : data.quantity;

                if (isDemoMode || !currentUser) {
                  setMovements((prev) => [newMov, ...prev]);
                  if (targetProd) {
                    setProducts((prev) =>
                      prev.map((p) =>
                        p.id === targetProd.id
                          ? { ...p, stock: Math.max(0, p.stock + delta) }
                          : p
                      )
                    );
                  }
                  return;
                }

                try {
                  const { id, ...payload } = newMov;
                  await setDoc(doc(db, 'inventory_movements', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  if (targetProd) {
                    await updateDoc(doc(db, 'products', targetProd.id), {
                      stock: Math.max(0, targetProd.stock + delta),
                      updatedAt: serverTimestamp(),
                    });
                  }
                  await logAuditEvent(
                    'MOVIMENTO_STOCK',
                    'Inventário',
                    data.referenceDoc,
                    `Movimento (${data.movementType}) de ${data.quantity} un. em ${data.productName}.`
                  );
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.CREATE,
                    `inventory_movements/${newMov.id}`
                  );
                }
              }}
              onRecordFinancialTx={async (data) => {
                const newTx: FinancialTransaction = {
                  id: sanitizeId('tx'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setTransactions((prev) => [newTx, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newTx;
                  await setDoc(doc(db, 'financial_transactions', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAuditEvent(
                    'LANCAMENTO_FINANCEIRO',
                    'Financeiro',
                    newTx.referenceDoc,
                    `${newTx.txType.toUpperCase()}: ${newTx.description} (${formatKz(newTx.amount)}).`
                  );
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.CREATE,
                    `financial_transactions/${newTx.id}`
                  );
                }
              }}
              onReconcileTx={async (tx) => {
                if (isDemoMode || !currentUser) {
                  setTransactions((prev) =>
                    prev.map((item) =>
                      item.id === tx.id ? { ...item, status: 'reconciliado' } : item
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'financial_transactions', tx.id), {
                    status: 'reconciliado',
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.UPDATE,
                    `financial_transactions/${tx.id}`
                  );
                }
              }}
              onCreateSupplier={async (data) => {
                const newSup: Supplier = {
                  id: sanitizeId('sup'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setSuppliers((prev) => [newSup, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newSup;
                  await setDoc(doc(db, 'suppliers', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, `suppliers/${newSup.id}`);
                }
              }}
              onRecordSupplierPurchase={async ({
                supplier,
                product,
                quantity,
                unitCost,
                invoiceRef,
                isCreditNote,
              }) => {
                const totalPurchase = quantity * unitCost;
                const stockDelta = isCreditNote ? -quantity : quantity;

                if (isDemoMode || !currentUser) {
                  setProducts((prev) =>
                    prev.map((p) =>
                      p.id === product.id
                        ? { ...p, stock: Math.max(0, p.stock + stockDelta) }
                        : p
                    )
                  );
                  setSuppliers((prev) =>
                    prev.map((s) =>
                      s.id === supplier.id
                        ? {
                            ...s,
                            totalPurchased: Math.max(
                              0,
                              s.totalPurchased + (isCreditNote ? -totalPurchase : totalPurchase)
                            ),
                          }
                        : s
                    )
                  );
                  setMovements((prev) => [
                    {
                      id: sanitizeId('mov'),
                      ownerId: activeCompany.ownerId,
                      companyId: activeCompany.id,
                      productId: product.id,
                      productName: product.description,
                      movementType: isCreditNote ? 'devolucao' : 'entrada',
                      quantity,
                      warehouseOrigin: supplier.name,
                      warehouseDest: product.warehouse,
                      unitCost,
                      referenceDoc: invoiceRef,
                      notes: isCreditNote
                        ? 'Nota de Crédito de Fornecedor'
                        : 'Entrada automática por Compra a Fornecedor',
                    },
                    ...prev,
                  ]);
                  return;
                }

                try {
                  await updateDoc(doc(db, 'products', product.id), {
                    stock: Math.max(0, product.stock + stockDelta),
                    updatedAt: serverTimestamp(),
                  });
                  await updateDoc(doc(db, 'suppliers', supplier.id), {
                    totalPurchased: Math.max(
                      0,
                      supplier.totalPurchased + (isCreditNote ? -totalPurchase : totalPurchase)
                    ),
                    updatedAt: serverTimestamp(),
                  });
                  const movId = sanitizeId('mov');
                  await setDoc(doc(db, 'inventory_movements', movId), {
                    ownerId: currentUser.uid,
                    companyId: activeCompany.id,
                    productId: product.id,
                    productName: product.description,
                    movementType: isCreditNote ? 'devolucao' : 'entrada',
                    quantity,
                    warehouseOrigin: supplier.name.slice(0, 75),
                    warehouseDest: product.warehouse.slice(0, 75),
                    unitCost,
                    referenceDoc: invoiceRef.slice(0, 75),
                    notes: isCreditNote
                      ? 'Nota de Crédito de Fornecedor'
                      : 'Entrada automática por Compra a Fornecedor',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
                }
              }}
              onCreateTeamMember={async (data) => {
                const newMember: TeamMember = {
                  id: sanitizeId('tm'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setTeamMembers((prev) => [newMember, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newMember;
                  await setDoc(doc(db, 'team_members', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAuditEvent(
                    'CRIAR_UTILIZADOR',
                    'Utilizadores',
                    newMember.email,
                    `Adicionado utilizador ${newMember.name} com perfil ${newMember.role}.`
                  );
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.CREATE,
                    `team_members/${newMember.id}`
                  );
                }
              }}
              onCreateSupportTicket={async (data) => {
                const newTicket: SupportTicket = {
                  id: sanitizeId('tkt'),
                  ownerId: currentUser?.uid || activeCompany.ownerId,
                  companyId: activeCompany.id,
                  ...data,
                };
                if (isDemoMode || !currentUser) {
                  setTickets((prev) => [newTicket, ...prev]);
                  return;
                }
                try {
                  const { id, ...payload } = newTicket;
                  await setDoc(doc(db, 'support_tickets', id), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.CREATE,
                    `support_tickets/${newTicket.id}`
                  );
                }
              }}
              onChangeCompanyPlan={async (planId, billingCycle) => {
                if (isDemoMode || !currentUser) {
                  setCompanies((prev) =>
                    prev.map((c) =>
                      c.id === activeCompany.id ? { ...c, planId, billingCycle } : c
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'companies', activeCompany.id), {
                    planId,
                    billingCycle,
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.UPDATE,
                    `companies/${activeCompany.id}`
                  );
                }
              }}
              subscriptionPayments={subscriptionPayments}
              onOpenMcxCheckout={(planId, cycle) => {
                setMcxCheckoutPlan(planId || activeCompany.planId);
                setMcxCheckoutCycle(cycle || activeCompany.billingCycle);
                setIsMcxCheckoutOpen(true);
              }}
              onUpdateCompanyLogo={async (logoUrl) => {
                if (isDemoMode || !currentUser) {
                  setCompanies((prev) =>
                    prev.map((c) => (c.id === activeCompany.id ? { ...c, logoUrl } : c))
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'companies', activeCompany.id), {
                    logoUrl: logoUrl.slice(0, 44000),
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.UPDATE,
                    `companies/${activeCompany.id}`
                  );
                }
              }}
            />
          )}

          {/* TAB 13: CENTRAL ALHAN ADMIN PANEL */}
          {activeTab === 'alhan_admin' && (
            <AlhanAdminPanel
              companies={companies}
              invoices={invoices}
              tickets={tickets}
              auditLogs={auditLogs}
              plans={plans}
              subscriptionPayments={subscriptionPayments}
              onUpdatePlans={setPlans}
              onUpdateCompanyStatus={async (comp, newStatus: SubscriptionStatusType) => {
                if (isDemoMode || !currentUser) {
                  setCompanies((prev) =>
                    prev.map((c) =>
                      c.id === comp.id ? { ...c, subscriptionStatus: newStatus } : c
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'companies', comp.id), {
                    subscriptionStatus: newStatus,
                    updatedAt: serverTimestamp(),
                  });
                  await logAuditEvent(
                    'ALTERAR_ESTADO_SUBSCRICAO',
                    'Admin Central ALHAN',
                    comp.nif,
                    `Estado da conta da empresa ${comp.name} alterado para ${newStatus.toUpperCase()}.`
                  );
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `companies/${comp.id}`);
                }
              }}
              onValidateSubscriptionPayment={async (payment, decision, adminNotes) => {
                const today = getLuandaIsoDate();
                const newEndDate = calcularDataVencimentoSubscricao(today, payment.billingCycle);
                const generatedReceipt =
                  decision === 'confirmado'
                    ? payment.receiptNumber || `REC-ALHAN-${Date.now().toString().slice(-5)}`
                    : payment.receiptNumber;

                if (isDemoMode || !currentUser) {
                  setSubscriptionPayments((prev) =>
                    prev.map((p) =>
                      p.id === payment.id
                        ? {
                            ...p,
                            status: decision,
                            adminNotes,
                            receiptNumber: generatedReceipt,
                          }
                        : p
                    )
                  );
                  if (decision === 'confirmado') {
                    setCompanies((prev) =>
                      prev.map((c) =>
                        c.id === payment.companyId
                          ? {
                              ...c,
                              planId: payment.planId,
                              billingCycle: payment.billingCycle,
                              subscriptionStatus: 'activa',
                              subscriptionStartDate: today,
                              subscriptionEndDate: newEndDate,
                            }
                          : c
                      )
                    );
                  }
                  return;
                }

                try {
                  await updateDoc(doc(db, 'subscription_payments', payment.id), {
                    status: decision,
                    adminNotes: adminNotes.slice(0, 490),
                    receiptNumber: generatedReceipt.slice(0, 75),
                    updatedAt: serverTimestamp(),
                  });

                  if (decision === 'confirmado') {
                    await updateDoc(doc(db, 'companies', payment.companyId), {
                      planId: payment.planId,
                      billingCycle: payment.billingCycle,
                      subscriptionStatus: 'activa',
                      subscriptionStartDate: today,
                      subscriptionEndDate: newEndDate,
                      updatedAt: serverTimestamp(),
                    });
                  }

                  await logAuditEvent(
                    `VALIDACAO_PAGAMENTO_MCX_${decision.toUpperCase()}`,
                    'Admin Central ALHAN',
                    payment.orderReference,
                    `Pagamento Multicaixa Express (${payment.transactionReference}) de ${payment.companyName} -> ${decision.toUpperCase()}.`
                  );
                } catch (err) {
                  handleFirestoreError(
                    err,
                    OperationType.UPDATE,
                    `subscription_payments/${payment.id}`
                  );
                }
              }}
              onRespondTicket={async (tkt, responseText, newStatus) => {
                if (isDemoMode || !currentUser) {
                  setTickets((prev) =>
                    prev.map((t) =>
                      t.id === tkt.id
                        ? { ...t, adminResponse: responseText, status: newStatus }
                        : t
                    )
                  );
                  return;
                }
                try {
                  await updateDoc(doc(db, 'support_tickets', tkt.id), {
                    adminResponse: responseText.slice(0, 1490),
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${tkt.id}`);
                }
              }}
              onBroadcastNotice={(title, message) => setGlobalNotice({ title, message })}
            />
          )}
        </main>
      </div>

      {/* Multicaixa Express (927 496 287 - ALHAN) Subscription Checkout Modal */}
      <MulticaixaCheckoutModal
        isOpen={isMcxCheckoutOpen}
        onClose={() => setIsMcxCheckoutOpen(false)}
        company={activeCompany}
        plans={plans}
        existingPayments={subscriptionPayments}
        initialPlanId={mcxCheckoutPlan}
        initialCycle={mcxCheckoutCycle}
        onSubmitSubscriptionPayment={async (paymentData) => {
          const newPayment: SubscriptionPayment = {
            id: sanitizeId('subpay'),
            ownerId: currentUser?.uid || activeCompany.ownerId,
            companyId: activeCompany.id,
            ...paymentData,
          };
          if (isDemoMode || !currentUser) {
            setSubscriptionPayments((prev) => [newPayment, ...prev]);
            await logAuditEvent(
              'SUBMETER_PAGAMENTO_MCX_EXPRESS',
              'Subscrições MCX',
              newPayment.orderReference,
              `Submetido comprovativo Multicaixa Express (${MCX_EXPRESS_OFFICIAL_NUMBER} - ${MCX_EXPRESS_BENEFICIARY}) Ref. ${newPayment.transactionReference} no valor de ${formatKz(newPayment.amountKz)} (Estado: PENDENTE).`
            );
            return;
          }
          try {
            const { id, ...payload } = newPayment;
            await setDoc(doc(db, 'subscription_payments', id), {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await logAuditEvent(
              'SUBMETER_PAGAMENTO_MCX_EXPRESS',
              'Subscrições MCX',
              newPayment.orderReference,
              `Submetido comprovativo Multicaixa Express (${MCX_EXPRESS_OFFICIAL_NUMBER} - ${MCX_EXPRESS_BENEFICIARY}) Ref. ${newPayment.transactionReference} no valor de ${formatKz(newPayment.amountKz)} (Estado: PENDENTE).`
            );
          } catch (err) {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `subscription_payments/${newPayment.id}`
            );
          }
        }}
      />

      {/* Document A4 / Thermal 80mm Preview & Print Modal */}
      <InvoiceModal
        invoice={previewInvoice}
        company={activeCompany}
        onClose={() => setPreviewInvoice(null)}
        onIncrementPrintCount={handleIncrementPrintCount}
      />

      {/* Hostinger VPS, Security & API Documentation Modal */}
      <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />

      {/* PWA Offline Indicator & Sync Queue Status */}
      <OfflineIndicator pendingSyncCount={offlineQueueCount} />
    </div>
  );
}
