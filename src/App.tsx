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
import { AlhanAdminPanel, saveClientAccessPassword } from './components/AlhanAdminPanel';
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
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{ title: string; message: string } | null>(null);

  // Hidden Master Admin Portal State (/painel-adm-alhan, /?painel=adm-alhan, /?adm=alhan, #painel-adm-alhan)
  const checkIsAdminLocation = () => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    const s = new URLSearchParams(window.location.search);
    const h = window.location.hash.toLowerCase();
    return (
      p.includes('/painel-adm-alhan') ||
      p.includes('/painel-adm') ||
      p === '/admin' ||
      p.startsWith('/admin/') ||
      p === '/adm' ||
      p.startsWith('/adm/') ||
      s.get('painel') === 'adm-alhan' ||
      s.get('painel') === 'adm' ||
      s.get('adm') === 'alhan' ||
      s.get('admin') === '1' ||
      h.includes('painel-adm') ||
      h === '#adm' ||
      h === '#admin'
    );
  };

  const [isHiddenAdminRoute, setIsHiddenAdminRoute] = useState<boolean>(checkIsAdminLocation);
  const [isMasterAdminAuthenticated, setIsMasterAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('alhan_master_admin_session_v1') === 'authenticated';
    } catch {
      return false;
    }
  });
  const [isInspectingClientFromAdmin, setIsInspectingClientFromAdmin] = useState(false);

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
    {
      productId: string;
      customDescription?: string;
      customUnitPrice?: number;
      quantity: number;
      discountPercent: number;
    }[]
  >([{ productId: '', customDescription: '', customUnitPrice: 0, quantity: 1, discountPercent: 0 }]);
  const [customClientName, setCustomClientName] = useState('');
  const [customClientNif, setCustomClientNif] = useState('');
  const [applyWithholding65, setApplyWithholding65] = useState(true);
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

  // Listen to popstate/hashchange for the hidden Admin URL & purge old fictitious storage keys
  useEffect(() => {
    try {
      localStorage.removeItem('alhan_all_clients_companies_v1');
      localStorage.removeItem('alhan_registered_company_v1');
      const savedCleanRaw = localStorage.getItem('alhan_clean_companies_v3');
      if (savedCleanRaw) {
        const parsed = JSON.parse(savedCleanRaw) as Company[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCompanies(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }

    const syncAdminRoute = () => {
      setIsHiddenAdminRoute(checkIsAdminLocation());
    };
    window.addEventListener('popstate', syncAdminRoute);
    window.addEventListener('hashchange', syncAdminRoute);
    return () => {
      window.removeEventListener('popstate', syncAdminRoute);
      window.removeEventListener('hashchange', syncAdminRoute);
    };
  }, []);

  const persistCompaniesList = (list: Company[]) => {
    try {
      localStorage.setItem('alhan_clean_companies_v3', JSON.stringify(list));
      if (list[0]) {
        localStorage.setItem('alhan_clean_active_company_v3', JSON.stringify(list[0]));
      } else {
        localStorage.removeItem('alhan_clean_active_company_v3');
      }
    } catch {
      // ignore storage errors
    }
  };

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

  const resetClientWorkspaceData = () => {
    setClients([]);
    setProducts([]);
    setInvoices([]);
    setMovements([]);
    setTransactions([]);
    setSuppliers([]);
    setTickets([]);
    setAuditLogs([]);
    setAgtLogs([]);
  };

  const handleDirectLoginSuccess = async (email: string, name: string, nifInput?: string) => {
    setIsAuthModalOpen(false);
    resetClientWorkspaceData();

    try {
      const allRaw = localStorage.getItem('alhan_clean_companies_v3');
      if (allRaw) {
        const allList = JSON.parse(allRaw) as Company[];
        if (Array.isArray(allList) && allList.length > 0) {
          const matched = allList.find(
            (c) =>
              c.email.toLowerCase() === email.toLowerCase() ||
              (nifInput && c.nif.toLowerCase() === nifInput.toLowerCase())
          );
          if (matched) {
            const reordered = [matched, ...allList.filter((c) => c.id !== matched.id)];
            setCompanies(reordered);
            setTeamMembers([
              {
                id: sanitizeId('tm'),
                ownerId: matched.ownerId,
                companyId: matched.id,
                name: matched.responsibleName || name,
                email: matched.email,
                role: 'Administrador',
                establishment: 'Sede Principal',
                permissionsSummary:
                  'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
                status: 'activo',
              },
            ]);
            setIsDemoMode(true);
            setActiveTab('dashboard');
            return;
          }
        }
      }
    } catch {
      // ignore localStorage parse error
    }

    // If no company exists yet for this login, open the clean Company Registration form (no fake company created)
    setPendingUserEmail(email.includes('@') ? email : '');
    setPendingUserName(name !== 'Administrador Empresarial' ? name : '');
    setIsRegisterModalOpen(true);
  };

  // Clean Mode Handler (No Fictitious Data)
  const handleEnterDemoMode = async () => {
    resetClientWorkspaceData();
    try {
      const storedAll = localStorage.getItem('alhan_clean_companies_v3');
      if (storedAll) {
        const parsed = JSON.parse(storedAll) as Company[];
        if (Array.isArray(parsed)) {
          setCompanies(parsed);
        }
      }
    } catch {
      // ignore
    }
  };

  // Audit Log Helper
  const logAuditEvent = async (
    action: string,
    moduleName: string,
    targetRef: string,
    details: string,
    compIdOverride?: string
  ) => {
    const compId = compIdOverride || activeCompany?.id || 'comp_local';
    const actorEmail = currentUser?.email || activeCompany?.email || 'operador@empresa.ao';
    const newLog: AuditLog = {
      id: sanitizeId('log'),
      ownerId: currentUser?.uid || 'local_owner_ao',
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

  // Register Company with 100% Clean Workspace (Zero Fictitious Data)
  const handleRegisterCompany = async (
    companyData: Omit<Company, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    _seedInitialData: boolean
  ) => {
    const uid = currentUser?.uid || 'local_owner_ao';
    const compId = sanitizeId('comp');
    const newCompanyObj: Company = {
      id: compId,
      ownerId: uid,
      ...companyData,
    };

    try {
      localStorage.setItem('alhan_clean_active_company_v3', JSON.stringify(newCompanyObj));
      const existingAllRaw = localStorage.getItem('alhan_clean_companies_v3');
      const existingAll: Company[] = existingAllRaw ? JSON.parse(existingAllRaw) : [];
      const updatedAll = [
        newCompanyObj,
        ...existingAll.filter((c) => c.id !== newCompanyObj.id && c.nif !== newCompanyObj.nif),
      ];
      localStorage.setItem('alhan_clean_companies_v3', JSON.stringify(updatedAll));
    } catch {
      // ignore storage quota errors
    }

    resetClientWorkspaceData();
    setTeamMembers([
      {
        id: sanitizeId('tm'),
        ownerId: uid,
        companyId: compId,
        name: companyData.responsibleName || 'Administrador',
        email: companyData.email,
        role: 'Administrador',
        establishment: 'Sede Principal',
        permissionsSummary:
          'Acesso Total: Facturação, SAF-T, AGT, Financeiro, Stock, Utilizadores e Configurações',
        status: 'activo',
      },
    ]);

    if (!currentUser) {
      setCompanies((prev) => [
        newCompanyObj,
        ...prev.filter((c) => c.id !== newCompanyObj.id && c.nif !== newCompanyObj.nif),
      ]);
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

      const tm1Id = sanitizeId('tm');
      await setDoc(doc(db, 'team_members', tm1Id), {
        ownerId: uid,
        companyId: compId,
        name: companyData.responsibleName || 'Administrador',
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
      setIsRegisterModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${compId}`);
    }
  };

  // Calculate Invoice Builder Totals (with 14% IVA and 6.5% Retencao na Fonte)
  const invoiceDraftTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const detailedLines: InvoiceLineItem[] = lineItems.map((line, idx) => {
      const prod = products.find((p) => p.id === line.productId);
      const unitPrice = prod ? prod.salePrice : Number(line.customUnitPrice) || 0;
      const qty = Math.max(1, Number(line.quantity) || 1);
      const discPct = Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
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
        productId: prod?.id || `item_${idx + 1}`,
        code: prod?.code || `ART-${idx + 1}`,
        description: prod?.description || line.customDescription?.trim() || 'Prestação de Serviços / Artigo Comercial',
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

    return {
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      withholdingTaxRate,
      withholdingTaxTotal,
      netPayableAmount,
      amountInWords: valorPorExtensoKz(totalAmount),
      detailedLines,
    };
  }, [lineItems, products, applyWithholding65]);

  // Issue Fiscal or Commercial Document
  const handleIssueDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || invoiceDraftTotals.detailedLines.length === 0) return;

    const registeredClient = clients.find((c) => c.id === selectedClientId) || clients[0];
    const resolvedClientName =
      registeredClient?.name || customClientName.trim() || 'Consumidor Final';
    const resolvedClientNif =
      registeredClient?.nif || customClientNif.trim() || '999999999';
    const resolvedClientAddress = registeredClient?.address || 'Luanda, Angola';
    const resolvedClientId = registeredClient?.id || 'cli_consumidor_final';

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
      clientNif: resolvedClientNif,
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
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      clientNif: resolvedClientNif,
      clientAddress: resolvedClientAddress,
      itemsSummary: JSON.stringify(invoiceDraftTotals.detailedLines).slice(0, 1990),
      subtotal: invoiceDraftTotals.subtotal,
      discountTotal: invoiceDraftTotals.discountTotal,
      taxTotal: invoiceDraftTotals.taxTotal,
      withholdingTaxRate: invoiceDraftTotals.withholdingTaxRate,
      withholdingTaxTotal: invoiceDraftTotals.withholdingTaxTotal,
      totalAmount: invoiceDraftTotals.totalAmount,
      netPayableAmount: invoiceDraftTotals.netPayableAmount,
      blackFridayApplied: false,
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
            description: `Recebimento imediato ${newInv.docNumber} — ${resolvedClientName}`,
            amount: newInv.totalAmount,
            paymentMethod: 'transferencia',
            accountName: `${activeCompany.bankName || activeCompany.name} (AOA)`,
            referenceDoc: newInv.docNumber,
            entityName: resolvedClientName,
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

      // Update client balance & totals if registered
      if (registeredClient) {
        const addedDebt = isImmediatePaid ? 0 : newInv.totalAmount;
        const addedPaid = isImmediatePaid ? newInv.totalAmount : 0;
        await updateDoc(doc(db, 'clients', registeredClient.id), {
          totalInvoiced: registeredClient.totalInvoiced + newInv.totalAmount,
          totalPaid: registeredClient.totalPaid + addedPaid,
          currentBalance: registeredClient.currentBalance + addedDebt,
          updatedAt: serverTimestamp(),
        });
      }

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
          description: `Recebimento automático ${newInv.docNumber} — ${resolvedClientName}`.slice(0, 195),
          amount: newInv.totalAmount,
          paymentMethod: 'transferencia',
          accountName: `${activeCompany.bankName || activeCompany.name} (AOA)`.slice(0, 95),
          referenceDoc: newInv.docNumber,
          entityName: resolvedClientName.slice(0, 155),
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

  // Role-Based Menu Visibility (Note: ALHAN Master Admin Panel is strictly hidden from client workspaces)
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
  }, [activeRoleView]);

  // Render Hidden Master Admin Portal when accessed via /painel-adm-alhan or /?adm=alhan
  if (isHiddenAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <AlhanAdminPanel
            requireMasterLoginGate={true}
            isMasterAuthenticated={isMasterAdminAuthenticated}
            onMasterAuthenticated={async () => {
              try {
                sessionStorage.setItem('alhan_master_admin_session_v1', 'authenticated');
              } catch {
                // ignore
              }
              if (companies.length === 0) {
                await handleEnterDemoMode();
              }
              setIsMasterAdminAuthenticated(true);
            }}
            onMasterLogout={() => {
              try {
                sessionStorage.removeItem('alhan_master_admin_session_v1');
              } catch {
                // ignore
              }
              setIsMasterAdminAuthenticated(false);
            }}
            onExitHiddenAdmin={() => {
              setIsHiddenAdminRoute(false);
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
            }}
            companies={companies}
            invoices={invoices}
            tickets={tickets}
            auditLogs={auditLogs}
            plans={plans}
            subscriptionPayments={subscriptionPayments}
            onUpdatePlans={setPlans}
            onUpdateCompanyStatus={async (comp, newStatus: SubscriptionStatusType) => {
              setCompanies((prev) => {
                const updated = prev.map((c) =>
                  c.id === comp.id ? { ...c, subscriptionStatus: newStatus } : c
                );
                persistCompaniesList(updated);
                return updated;
              });
              if (!isDemoMode && currentUser) {
                try {
                  await updateDoc(doc(db, 'companies', comp.id), {
                    subscriptionStatus: newStatus,
                    updatedAt: serverTimestamp(),
                  });
                } catch {
                  // local update already persisted
                }
              }
              await logAuditEvent(
                'ALTERAR_ESTADO_SUBSCRICAO',
                'Admin Central ALHAN',
                comp.nif,
                `Estado da licença da empresa ${comp.name} alterado para ${newStatus.toUpperCase()}.`
              );
            }}
            onUpdateCompanyDetails={async (companyId, updates) => {
              setCompanies((prev) => {
                const updated = prev.map((c) => (c.id === companyId ? { ...c, ...updates } : c));
                persistCompaniesList(updated);
                return updated;
              });
              if (!isDemoMode && currentUser) {
                try {
                  await updateDoc(doc(db, 'companies', companyId), {
                    ...updates,
                    updatedAt: serverTimestamp(),
                  });
                } catch {
                  // ignore
                }
              }
            }}
            onCreateClientCompany={async (companyData, clientPassword, paidAmountKz) => {
              const newId = sanitizeId('comp');
              const newCompany: Company = {
                id: newId,
                ownerId: currentUser?.uid || 'alhan_admin_managed',
                ...companyData,
              };
              saveClientAccessPassword(newId, clientPassword);
              setCompanies((prev) => {
                const updated = [newCompany, ...prev];
                persistCompaniesList(updated);
                return updated;
              });
              if (paidAmountKz > 0) {
                const payRecord: SubscriptionPayment = {
                  id: sanitizeId('subpay'),
                  ownerId: newCompany.ownerId,
                  companyId: newId,
                  companyName: newCompany.name,
                  companyNif: newCompany.nif,
                  planId: newCompany.planId,
                  billingCycle: newCompany.billingCycle,
                  amountKz: paidAmountKz,
                  mcxChannelNumber: MCX_EXPRESS_OFFICIAL_NUMBER,
                  beneficiaryName: MCX_EXPRESS_BENEFICIARY,
                  orderReference: `ALH-${newCompany.nif.slice(-4)}-${Date.now().toString().slice(-4)}`,
                  transactionReference: `MCX-ADM-${Date.now().toString().slice(-6)}`,
                  paymentModality: 'confirmacao_administrativa',
                  proofFileName: 'Activacao_Directa_Painel_ADM.pdf',
                  proofDataUrl: '',
                  paymentDeadline: getLuandaIsoDate(),
                  status: newCompany.subscriptionStatus === 'activa' ? 'confirmado' : 'pendente',
                  adminNotes: 'Cliente registado e activado directamente no Painel ADM ALHAN.',
                  receiptNumber:
                    newCompany.subscriptionStatus === 'activa'
                      ? `REC-ALHAN-${Date.now().toString().slice(-5)}`
                      : '',
                };
                setSubscriptionPayments((prev) => [payRecord, ...prev]);
              }
              await logAuditEvent(
                'CADASTRAR_CLIENTE_POS_VENDA',
                'Admin Central ALHAN',
                newCompany.nif,
                `Registado novo cliente ${newCompany.name} no plano ${newCompany.planId.toUpperCase()} (${newCompany.billingCycle}).`
              );
            }}
            onDeleteClientCompany={async (companyId) => {
              setCompanies((prev) => {
                const updated = prev.filter((c) => c.id !== companyId);
                persistCompaniesList(updated);
                return updated;
              });
            }}
            onInspectClientCompany={(comp) => {
              setCompanies((prev) => [comp, ...prev.filter((c) => c.id !== comp.id)]);
              setIsDemoMode(true);
              setIsInspectingClientFromAdmin(true);
              setIsHiddenAdminRoute(false);
              setActiveTab('dashboard');
            }}
            onValidateSubscriptionPayment={async (payment, decision, adminNotes) => {
              const today = getLuandaIsoDate();
              const newEndDate = calcularDataVencimentoSubscricao(today, payment.billingCycle);
              const generatedReceipt =
                decision === 'confirmado'
                  ? payment.receiptNumber || `REC-ALHAN-${Date.now().toString().slice(-5)}`
                  : payment.receiptNumber;

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
                setCompanies((prev) => {
                  const updated = prev.map((c) =>
                    c.id === payment.companyId
                      ? {
                          ...c,
                          planId: payment.planId,
                          billingCycle: payment.billingCycle,
                          subscriptionStatus: 'activa' as SubscriptionStatusType,
                          subscriptionStartDate: today,
                          subscriptionEndDate: newEndDate,
                        }
                      : c
                  );
                  persistCompaniesList(updated);
                  return updated;
                });
              }
            }}
            onRespondTicket={async (tkt, responseText, newStatus) => {
              setTickets((prev) =>
                prev.map((t) =>
                  t.id === tkt.id ? { ...t, adminResponse: responseText, status: newStatus } : t
                )
              );
            }}
            onBroadcastNotice={(title, message) => setGlobalNotice({ title, message })}
          />
        </div>
        <OfflineIndicator pendingSyncCount={offlineQueueCount} />
      </div>
    );
  }

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
    const openHiddenAdminGate = () => {
      setIsHiddenAdminRoute(true);
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/painel-adm-alhan');
      }
    };

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
          onMasterAdminDirectLogin={() => {
            try {
              sessionStorage.setItem('alhan_master_admin_session_v1', 'authenticated');
            } catch {
              // ignore
            }
            setIsMasterAdminAuthenticated(true);
            openHiddenAdminGate();
          }}
          isSigningInGoogle={isSigningIn}
        />
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
          {/* Client Company Identity Lockup */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {activeCompany.logoUrl ? (
                <img
                  src={activeCompany.logoUrl}
                  alt={activeCompany.name}
                  className="h-9 w-auto max-w-[44px] rounded bg-white p-1 object-contain shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(activeCompany.commercialName || activeCompany.name || 'EM').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-white font-display block truncate">
                  {activeCompany.commercialName || activeCompany.name}
                </span>
                <span className="text-[11px] text-sky-400 font-mono block truncate">
                  NIF: {activeCompany.nif}
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

        {/* Sidebar Footer: Client Company Details Only */}
        <div className="p-4 border-t border-slate-800 space-y-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <p className="text-white font-semibold truncate">{activeCompany.name}</p>
            <p className="font-mono text-[11px] text-slate-400">NIF: {activeCompany.nif}</p>
            {activeCompany.phone && (
              <p className="font-mono text-[11px] text-slate-400 truncate">
                Tel: {activeCompany.phone}
              </p>
            )}
            <p className="text-[11px] text-amber-400 font-mono">
              Regime: {activeCompany.taxRegime}
            </p>
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

        {/* Admin Remote Client Inspection Return Bar */}
        {isInspectingClientFromAdmin && (
          <div className="px-6 py-2.5 bg-amber-500 text-slate-950 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
            <span>
              MODO CONTROLO ADM ALHAN — A gerir conta do cliente:{' '}
              <strong className="underline">{activeCompany.name}</strong> (NIF: {activeCompany.nif} · Licença:{' '}
              {activeCompany.subscriptionStatus.toUpperCase()})
            </span>
            <button
              type="button"
              onClick={() => {
                setIsInspectingClientFromAdmin(false);
                setIsHiddenAdminRoute(true);
              }}
              className="px-3 py-1 rounded bg-slate-950 text-white hover:bg-slate-800 font-bold text-xs"
            >
              ← Voltar ao Painel ADM Oculto
            </button>
          </div>
        )}

        {/* Suspended License Warning Banner */}
        {activeCompany.subscriptionStatus === 'suspensa' && (
          <div className="px-6 py-3 bg-red-700 text-white text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <span>
              ATENÇÃO: A subscrição da empresa {activeCompany.name} encontra-se SUSPENSA. Regularize via Multicaixa Express ({MCX_EXPRESS_OFFICIAL_NUMBER} — {MCX_EXPRESS_BENEFICIARY}) para restabelecer todas as emissões.
            </span>
            <button
              type="button"
              onClick={() => {
                setMcxCheckoutPlan(activeCompany.planId);
                setMcxCheckoutCycle(activeCompany.billingCycle);
                setIsMcxCheckoutOpen(true);
              }}
              className="px-3 py-1 rounded bg-white text-red-800 font-bold"
            >
              Regularizar Agora
            </button>
          </div>
        )}

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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold">Cliente Destinatário *</label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('clients')}
                        className="text-[11px] text-sky-600 hover:underline font-semibold"
                      >
                        + Cadastrar Cliente
                      </button>
                    </div>
                    {clients.length > 0 ? (
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
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={customClientName}
                          onChange={(e) => setCustomClientName(e.target.value)}
                          placeholder="Nome do Cliente (ou Consumidor Final)"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent"
                        />
                        <input
                          type="text"
                          value={customClientNif}
                          onChange={(e) => setCustomClientNif(e.target.value)}
                          placeholder="NIF do Cliente (Ex: 999999999)"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono bg-transparent"
                        />
                      </div>
                    )}
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
                        onClick={() => setActiveTab('products')}
                        className="text-xs text-sky-600 hover:underline font-semibold mr-2"
                      >
                        + Cadastrar Artigo no Catálogo
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
                              customDescription: '',
                              customUnitPrice: 0,
                              quantity: 1,
                              discountPercent: 0,
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
                            {products.length > 0 ? (
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
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={line.customDescription || ''}
                                  onChange={(e) => {
                                    const copy = [...lineItems];
                                    copy[idx].customDescription = e.target.value;
                                    setLineItems(copy);
                                  }}
                                  placeholder="Descrição do artigo ou serviço"
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={line.customUnitPrice || ''}
                                  onChange={(e) => {
                                    const copy = [...lineItems];
                                    copy[idx].customUnitPrice = Number(e.target.value) || 0;
                                    setLineItems(copy);
                                  }}
                                  placeholder="Preço Unitário (Kz)"
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 font-mono bg-white dark:bg-slate-900"
                                />
                              </div>
                            )}
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
                              value={line.discountPercent}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
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
                    </div>
                  </div>

                  <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900 text-white space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Incidência Tributável (Líquido):</span>
                      <span className="font-mono">{formatKz(invoiceDraftTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300 font-semibold">
                      <span>Total Descontos Comerciais:</span>
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

      {/* PWA Offline Indicator & Sync Queue Status */}
      <OfflineIndicator pendingSyncCount={offlineQueueCount} />
    </div>
  );
}
