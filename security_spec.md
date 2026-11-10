# ALHAN FACTURA — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Multi-Tenant Isolation (`ownerId` & `companyId`)**: No user can read, list, create, update, or delete records belonging to another company (`resource.data.ownerId == request.auth.uid`).
2. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Fiscal Document Immutability (Decreto Presidencial n.º 71/25)**:
   - Documents in `/invoices/{invoiceId}` can **NEVER** be deleted (`allow delete: if false;`).
   - Core fiscal fields (`docNumber`, `series`, `sequentialNumber`, `subtotal`, `taxTotal`, `totalAmount`, `hashCode`, `emitterNif`, `clientNif`, `ownerId`, `companyId`, `createdAt`) can **NEVER** be modified after emission, not even by the central ALHAN administrator.
   - Only status/payment tracking fields (`status`, `paidAmount`, `printCount`, `agtTransmissionStatus`, `updatedAt`) can be updated by the company owner (`ownerId`), and once `status == 'rectificada'`, no further updates are permitted.
4. **Append-Only Audit Trail**: Documents in `/audit_logs/{logId}` can be created by verified owners, read by owners or central ALHAN admins, and **NEVER** updated or deleted (`allow update, delete: if false;`).
5. **Relational Consistency**: Every child entity (`clients`, `products`, `invoices`, `inventory_movements`, `financial_transactions`, `suppliers`, `team_members`, `support_tickets`, `audit_logs`) must reference an existing `/companies/{companyId}` owned by `request.auth.uid` on creation.

## 2. The "Dirty Dozen" Payloads (Designed to Break Identity, Integrity, and State)
1. **Payload 1 (Cross-Tenant Read/Scrape)**: Authenticated user `uid_B` attempts `list` or `get` on `/invoices` or `/clients` where `ownerId == "uid_A"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Identity Spoofing on Create)**: User `uid_A` creates a `Company` or `Invoice` with `ownerId: "uid_B"`. -> `PERMISSION_DENIED`
3. **Payload 3 (Unverified Email Spoof)**: User with `email: "joaomuatxissombo22@gmail.com"` but `email_verified: false` attempts admin access or document creation. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow Field Injection)**: User creates a `Client` with an undeclared field `"isSuperAdmin": true`. -> `PERMISSION_DENIED`
5. **Payload 5 (Fiscal Tampering by Company Owner)**: Owner attempts to `update` an issued `Invoice`'s `totalAmount` or `hashCode`. -> `PERMISSION_DENIED`
6. **Payload 6 (Silent Fiscal Tampering by Central Admin)**: Central ALHAN Admin attempts to `update` or `delete` a tenant's `Invoice`. -> `PERMISSION_DENIED`
7. **Payload 7 (Invoice Deletion)**: Owner attempts `deleteDoc` on `/invoices/inv_01`. -> `PERMISSION_DENIED`
8. **Payload 8 (Terminal State Bypass on Invoice)**: Owner attempts to update an `Invoice` whose `existing().status == 'rectificada'`. -> `PERMISSION_DENIED`
9. **Payload 9 (Resource Poisoning / Denial of Wallet)**: Attacker passes a 200-char or special-char document ID `inv_$$$...` or a 10,000-char string in `itemsSummary`. -> `PERMISSION_DENIED`
10. **Payload 10 (Orphaned Tenant Record)**: User attempts to create a `Product` with `companyId: "non_existent_company"`. -> `PERMISSION_DENIED`
11. **Payload 11 (Timestamp Forgery)**: User sends a past or future `createdAt` or `updatedAt` timestamp (`!= request.time`). -> `PERMISSION_DENIED`
12. **Payload 12 (Audit Log Tampering)**: User attempts to `update` or `delete` a record in `/audit_logs/{logId}`. -> `PERMISSION_DENIED`
