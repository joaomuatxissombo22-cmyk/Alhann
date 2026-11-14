import {
  AuditLog,
  Company,
  SubscriptionPayment,
  SupportTicket,
} from '../types/models';

const PERMANENT_COMPANIES_KEY = 'alhan_permanent_companies_v4';
const PERMANENT_ACTIVE_COMPANY_KEY = 'alhan_permanent_active_company_v4';
const PERMANENT_PAYMENTS_KEY = 'alhan_permanent_sub_payments_v4';
const PERMANENT_TICKETS_KEY = 'alhan_permanent_tickets_v4';
const PERMANENT_AUDIT_KEY = 'alhan_permanent_audit_logs_v4';
const ADMIN_SESSION_TOKEN_KEY = 'alhan_admin_hmac_token_v4';

const LEGACY_COMPANY_KEYS = [
  'alhan_clean_companies_v3',
  'alhan_clean_active_company_v3',
  'alhan_all_clients_companies_v1',
  'alhan_registered_company_v1',
  'alhan_companies_backup_v1',
];

const FICTITIOUS_DEMO_NIFS = new Set([
  '5401192837',
  '5402881920',
  '5409918273',
  '5000112233',
  '5417283910',
  '5403391821',
  '5408821904',
  '5401928374',
  '0000000000',
]);

const FICTITIOUS_DEMO_IDS = new Set([
  'comp_demo_1',
  'comp_demo_2',
  'comp_demo_3',
]);

const FICTITIOUS_NAME_PATTERNS = [
  'kwanza solutions',
  'huílavida',
  'huilavida',
  'planalto agro',
  'empresa de demonstração',
  'empresa demo',
  'cliente fictício',
  'cliente ficticio',
];

/**
 * Returns true ONLY if the company is a real client registration
 * and NOT one of the old seeded demo/fictitious companies.
 */
export function isRealClientCompany(company: Partial<Company> | null | undefined): company is Company {
  if (!company || typeof company !== 'object') return false;
  const id = String(company.id || '').trim();
  const name = String(company.name || '').trim();
  const nif = String(company.nif || '').trim();

  if (!id || !name || name.length < 2 || !nif || nif.length < 5) return false;
  if (FICTITIOUS_DEMO_IDS.has(id)) return false;
  if (FICTITIOUS_DEMO_NIFS.has(nif)) return false;

  const lowerName = name.toLowerCase();
  const lowerComm = String(company.commercialName || '').toLowerCase();
  for (const pattern of FICTITIOUS_NAME_PATTERNS) {
    if (lowerName.includes(pattern) || lowerComm.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Deduplicates and merges multiple arrays of companies, keeping only real companies
 * and preferring the most recently updated entry for each NIF or ID.
 */
export function mergeRealCompanies(...lists: (Company[] | undefined | null)[]): Company[] {
  const byKey = new Map<string, Company>();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!isRealClientCompany(item)) continue;
      const normalizedNif = item.nif.trim().toUpperCase();
      const existing = byKey.get(normalizedNif) || byKey.get(item.id);
      if (!existing) {
        byKey.set(normalizedNif, item);
      } else {
        // Merge fields keeping non-empty values and newest status/dates
        const merged: Company = {
          ...existing,
          ...item,
          id: existing.id || item.id,
          logoUrl: item.logoUrl || existing.logoUrl,
          subscriptionStartDate: item.subscriptionStartDate || existing.subscriptionStartDate,
          subscriptionEndDate: item.subscriptionEndDate || existing.subscriptionEndDate,
        };
        byKey.set(normalizedNif, merged);
      }
    }
  }

  return Array.from(byKey.values());
}

/**
 * IndexedDB Mirror for resilient browser-side permanent storage (survives localStorage clears)
 */
const IDB_NAME = 'AlhanPermanentVaultDB';
const IDB_STORE = 'vault_store';

function openVaultIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIdb(key: string, value: unknown): Promise<void> {
  const db = await openVaultIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readFromIdb<T>(key: string): Promise<T | null> {
  const db = await openVaultIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Loads all real registered companies from current & legacy localStorage keys
 */
export function loadLocalPermanentCompanies(): Company[] {
  if (typeof window === 'undefined') return [];
  const collected: Company[][] = [];

  try {
    const primaryRaw = localStorage.getItem(PERMANENT_COMPANIES_KEY);
    if (primaryRaw) {
      const parsed = JSON.parse(primaryRaw);
      if (Array.isArray(parsed)) collected.push(parsed);
    }
  } catch {
    // ignore
  }

  try {
    const activeRaw = localStorage.getItem(PERMANENT_ACTIVE_COMPANY_KEY);
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (parsed && typeof parsed === 'object') collected.push([parsed as Company]);
    }
  } catch {
    // ignore
  }

  // Also recover any real companies from legacy keys so no client registration is ever lost
  for (const key of LEGACY_COMPANY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        collected.push(parsed);
      } else if (parsed && typeof parsed === 'object') {
        collected.push([parsed as Company]);
      }
    } catch {
      // ignore
    }
  }

  const merged = mergeRealCompanies(...collected);
  if (merged.length > 0) {
    try {
      localStorage.setItem(PERMANENT_COMPANIES_KEY, JSON.stringify(merged));
      localStorage.setItem('alhan_clean_companies_v3', JSON.stringify(merged));
    } catch {
      // ignore
    }
  }
  return merged;
}

/**
 * Saves the real companies list permanently to localStorage, IndexedDB, and syncs to Backend Server Vault
 */
export function savePermanentCompanies(companies: Company[], activeCompany?: Company | null): Company[] {
  const existing = loadLocalPermanentCompanies();
  const cleanList = mergeRealCompanies(companies, existing);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERMANENT_COMPANIES_KEY, JSON.stringify(cleanList));
      localStorage.setItem('alhan_clean_companies_v3', JSON.stringify(cleanList));
      const chosenActive = activeCompany && isRealClientCompany(activeCompany)
        ? activeCompany
        : cleanList[0] || null;
      if (chosenActive) {
        localStorage.setItem(PERMANENT_ACTIVE_COMPANY_KEY, JSON.stringify(chosenActive));
        localStorage.setItem('alhan_clean_active_company_v3', JSON.stringify(chosenActive));
      }
    } catch {
      // ignore quota errors
    }
    void writeToIdb(PERMANENT_COMPANIES_KEY, cleanList);
  }

  return cleanList;
}

/**
 * Removes a specific company explicitly deleted by the Master Admin from all local & server stores
 */
export async function deletePermanentCompany(companyId: string, companyNif?: string): Promise<Company[]> {
  const current = loadLocalPermanentCompanies();
  const filtered = current.filter(
    (c) => c.id !== companyId && (!companyNif || c.nif !== companyNif)
  );

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERMANENT_COMPANIES_KEY, JSON.stringify(filtered));
      localStorage.setItem('alhan_clean_companies_v3', JSON.stringify(filtered));
      for (const key of LEGACY_COMPANY_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    await writeToIdb(PERMANENT_COMPANIES_KEY, filtered);
  }

  try {
    const token = getAdminSessionToken();
    await fetch(`/api/registry/companies/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Alhan-Admin-Token': token } : {}),
      },
    });
  } catch {
    // ignore network error
  }

  return filtered;
}

export function loadLocalPermanentPayments(): SubscriptionPayment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERMANENT_PAYMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePermanentPayments(payments: SubscriptionPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERMANENT_PAYMENTS_KEY, JSON.stringify(payments));
  } catch {
    // ignore
  }
  void writeToIdb(PERMANENT_PAYMENTS_KEY, payments);
}

export function loadLocalPermanentTickets(): SupportTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERMANENT_TICKETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePermanentTickets(tickets: SupportTicket[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERMANENT_TICKETS_KEY, JSON.stringify(tickets));
  } catch {
    // ignore
  }
  void writeToIdb(PERMANENT_TICKETS_KEY, tickets);
}

export function loadLocalPermanentAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERMANENT_AUDIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePermanentAuditLogs(logs: AuditLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERMANENT_AUDIT_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch {
    // ignore
  }
}

export function getAdminSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Synchronizes real companies, payments, tickets, and audit logs with the Backend Server Vault
 * and IndexedDB so that registrations never disappear across browser restarts or sessions.
 */
export async function syncWithPermanentServerVault(localCompanies?: Company[]): Promise<{
  companies: Company[];
  subscriptionPayments: SubscriptionPayment[];
  tickets: SupportTicket[];
  auditLogs: AuditLog[];
}> {
  const fromLocal = loadLocalPermanentCompanies();
  const fromIdb = (await readFromIdb<Company[]>(PERMANENT_COMPANIES_KEY)) || [];
  const combinedLocal = mergeRealCompanies(localCompanies, fromLocal, fromIdb);

  const localPayments = loadLocalPermanentPayments();
  const idbPayments = (await readFromIdb<SubscriptionPayment[]>(PERMANENT_PAYMENTS_KEY)) || [];
  const localTickets = loadLocalPermanentTickets();
  const localAudit = loadLocalPermanentAuditLogs();

  try {
    const token = getAdminSessionToken();
    const res = await fetch('/api/registry/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Alhan-Admin-Token': token } : {}),
      },
      body: JSON.stringify({
        companies: combinedLocal,
        subscriptionPayments: localPayments.length >= idbPayments.length ? localPayments : idbPayments,
        tickets: localTickets,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        companies?: Company[];
        subscriptionPayments?: SubscriptionPayment[];
        tickets?: SupportTicket[];
        auditLogs?: AuditLog[];
      };
      const mergedCompanies = mergeRealCompanies(data.companies, combinedLocal);
      savePermanentCompanies(mergedCompanies);

      const mergedPayments = Array.isArray(data.subscriptionPayments) && data.subscriptionPayments.length > 0
        ? data.subscriptionPayments
        : localPayments;
      savePermanentPayments(mergedPayments);

      const mergedTickets = Array.isArray(data.tickets) && data.tickets.length > 0
        ? data.tickets
        : localTickets;
      savePermanentTickets(mergedTickets);

      const mergedAudit = Array.isArray(data.auditLogs) && data.auditLogs.length > 0
        ? data.auditLogs
        : localAudit;
      savePermanentAuditLogs(mergedAudit);

      return {
        companies: mergedCompanies,
        subscriptionPayments: mergedPayments,
        tickets: mergedTickets,
        auditLogs: mergedAudit,
      };
    }
  } catch {
    // Fallback to local + IndexedDB if server endpoint is unreachable
  }

  savePermanentCompanies(combinedLocal);
  return {
    companies: combinedLocal,
    subscriptionPayments: localPayments.length >= idbPayments.length ? localPayments : idbPayments,
    tickets: localTickets,
    auditLogs: localAudit,
  };
}

/**
 * Registers or updates a single company permanently on the backend server + local vault
 */
export async function registerCompanyPermanently(
  company: Company,
  clientPassword?: string,
  paymentRecord?: SubscriptionPayment
): Promise<Company[]> {
  const updatedLocal = savePermanentCompanies([company], company);
  if (paymentRecord) {
    const existingPay = loadLocalPermanentPayments();
    const nextPay = [
      paymentRecord,
      ...existingPay.filter((p) => p.id !== paymentRecord.id),
    ];
    savePermanentPayments(nextPay);
  }

  try {
    const token = getAdminSessionToken();
    const res = await fetch('/api/registry/companies/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Alhan-Admin-Token': token } : {}),
      },
      body: JSON.stringify({
        company,
        clientPassword,
        paymentRecord,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { companies?: Company[] };
      if (Array.isArray(data.companies)) {
        return savePermanentCompanies(data.companies, company);
      }
    }
  } catch {
    // Saved in localStorage & IndexedDB already
  }

  return updatedLocal;
}
