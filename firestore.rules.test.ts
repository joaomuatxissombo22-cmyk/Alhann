/**
 * Phase 0 TDD Security Specification Test Suite for ALHAN FACTURA
 * Verifies the "Dirty Dozen" adversarial payloads against Firestore Security Rules.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  email?: string;
  emailVerified?: boolean;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenTestSuite: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Cross-Tenant Read/Scrape on Invoices',
    collection: 'invoices',
    operation: 'get',
    authUid: 'tenant_user_B',
    email: 'b@empresa.ao',
    emailVerified: true,
    docId: 'inv_tenant_A_001',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    name: 'Identity Spoofing on Company Creation',
    collection: 'companies',
    operation: 'create',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'comp_spoofed',
    payload: { ownerId: 'tenant_user_B', name: 'Empresa Spoof Lda', nif: '5401122334' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    name: 'Unverified Email Spoof Attack on Admin',
    collection: 'companies',
    operation: 'get',
    authUid: 'attacker_uid',
    email: 'joaomuatxissombo22@gmail.com',
    emailVerified: false,
    docId: 'comp_tenant_A',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    name: 'Shadow Field Injection on Client Create',
    collection: 'clients',
    operation: 'create',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'client_shadow_01',
    payload: { ownerId: 'tenant_user_A', isVerifiedAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Fiscal Amount Tampering by Company Owner',
    collection: 'invoices',
    operation: 'update',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'inv_tenant_A_001',
    payload: { totalAmount: 100, hashCode: 'TAMPERED_HASH' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Silent Fiscal Tampering by Central ALHAN Admin',
    collection: 'invoices',
    operation: 'update',
    authUid: 'central_admin_uid',
    email: 'joaomuatxissombo22@gmail.com',
    emailVerified: true,
    docId: 'inv_tenant_A_001',
    payload: { totalAmount: 0, status: 'paga' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Direct Deletion of Issued Fiscal Invoice',
    collection: 'invoices',
    operation: 'delete',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'inv_tenant_A_001',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    name: 'Terminal State Bypass on Rectified Invoice',
    collection: 'invoices',
    operation: 'update',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'inv_rectified_001',
    payload: { status: 'paga' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    name: 'Resource Poisoning via Invalid Document ID',
    collection: 'products',
    operation: 'create',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'invalid/id$with*special!chars',
    payload: { ownerId: 'tenant_user_A' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Orphaned Product Creation Without Existing Company',
    collection: 'products',
    operation: 'create',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'prod_orphan_01',
    payload: { ownerId: 'tenant_user_A', companyId: 'non_existent_company_id' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Client-Forged Timestamp Injection',
    collection: 'financial_transactions',
    operation: 'create',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'tx_forged_time',
    payload: { ownerId: 'tenant_user_A', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Audit Log Deletion or Modification Attempt',
    collection: 'audit_logs',
    operation: 'delete',
    authUid: 'tenant_user_A',
    email: 'a@empresa.ao',
    emailVerified: true,
    docId: 'log_001',
    expectedResult: 'PERMISSION_DENIED',
  },
];
