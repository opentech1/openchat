# End-to-End Encryption Implementation Plan for OpenChat

**Status:** Planning Phase
**Target:** Encrypt all new chat messages with true client-side E2E encryption
**Approach:** Password-based encryption with key wrapping pattern
**Migration Strategy:** Leave existing messages unencrypted, only encrypt new messages going forward

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Security Model](#security-model)
3. [Database Schema Changes](#database-schema-changes)
4. [Encryption System Design](#encryption-system-design)
5. [Implementation Phases](#implementation-phases)
6. [User Experience Flow](#user-experience-flow)
7. [Technical Specifications](#technical-specifications)
8. [Password Reset & Recovery](#password-reset--recovery)
9. [Migration Strategy](#migration-strategy)
10. [Security Considerations](#security-considerations)
11. [Testing Plan](#testing-plan)
12. [Rollout Strategy](#rollout-strategy)

---

## Overview & Architecture

### Current State
- Messages stored in **plain text** in Convex database (`messages.content` field)
- Transport encryption only (HTTPS/TLS)
- Server administrators can read all messages
- No client-side encryption for message content

### Target State
- Messages encrypted **client-side** before sending to Convex
- Server stores only encrypted ciphertext
- **Only the user** (with correct password) can decrypt messages
- Server administrators see only encrypted data
- Multi-device support via password entry on each device
- Backward compatible with existing unencrypted messages

### Core Principle (Following Convex's E2E Pattern)
> **"Encrypt on client, decrypt on client, server only stores ciphertext"**

Based on Convex's official guidance:
- Whisper demo: https://whisper-convex.vercel.app/
- Documentation: https://stack.convex.dev/end-to-end-encryption-with-convex
- Source: https://github.com/ldanilek/whisper

---

## Security Model

### Threat Model

**What we protect against:**
- ✅ Server administrator reading messages
- ✅ Database breach exposing message content
- ✅ MITM attacks on message content (beyond TLS)
- ✅ Unauthorized access to Convex database
- ✅ Cloud provider (Convex) reading messages

**What we DON'T protect against:**
- ❌ Compromised client device (keyloggers, malware)
- ❌ User forgetting password without backup
- ❌ XSS attacks injecting malicious code (mitigated by CSP)
- ❌ Physical access to unlocked device

### Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│  CLIENT (Trusted)                               │
│  - User password                                │
│  - Encryption keys in memory                    │
│  - Plaintext messages                           │
│  - Web Crypto API operations                    │
└─────────────────────────────────────────────────┘
                    ▼ Encrypted Data Only
┌─────────────────────────────────────────────────┐
│  NETWORK (HTTPS/TLS)                            │
│  - Encrypted message ciphertext                 │
│  - Encrypted MEK (Master Encryption Key)        │
│  - Metadata (timestamps, chat IDs, user IDs)    │
└─────────────────────────────────────────────────┘
                    ▼ Encrypted Data Only
┌─────────────────────────────────────────────────┐
│  SERVER / CONVEX (Untrusted for E2E)            │
│  - Stores encrypted messages                    │
│  - Stores encrypted MEK                         │
│  - Cannot decrypt without user password         │
│  - Provides access control & sync               │
└─────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### 1. Users Table (Add Encryption Fields)

**File:** `apps/server/convex/schema.ts`

```typescript
users: defineTable({
  externalId: v.string(),           // Better Auth user ID
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NEW: E2E Encryption fields
  encryptedMasterKey: v.optional(v.string()),     // MEK encrypted with KEK (from password)
  encryptionSalt: v.optional(v.string()),         // Salt for PBKDF2 key derivation
  encryptionKeyVersion: v.optional(v.number()),   // Version for key rotation support
  encryptionEnabled: v.optional(v.boolean()),     // Whether user has enabled E2E encryption
  encryptionSetupAt: v.optional(v.number()),      // Timestamp when E2E was enabled
})
  .index("by_external_id", ["externalId"])
  .index("by_email", ["email"]),
```

**Field Explanations:**

| Field | Type | Purpose |
|-------|------|---------|
| `encryptedMasterKey` | string | User's Master Encryption Key (MEK), encrypted with their Password-derived Key (KEK). Base64-encoded JSON: `{iv, ciphertext, authTag}` |
| `encryptionSalt` | string | Random salt for PBKDF2 password→key derivation. Base64-encoded 16 bytes. |
| `encryptionKeyVersion` | number | Allows future key rotation (start with version 1) |
| `encryptionEnabled` | boolean | Whether user opted into E2E encryption |
| `encryptionSetupAt` | number | Unix timestamp when encryption was first enabled |

### 2. Messages Table (Add Encryption Fields)

**File:** `apps/server/convex/schema.ts`

```typescript
messages: defineTable({
  chatId: v.id("chats"),
  clientMessageId: v.optional(v.string()),
  role: v.string(),

  // MODIFIED: Keep existing field for backward compatibility
  content: v.string(),                          // Plain text OR encrypted ciphertext

  // NEW: E2E Encryption fields
  isEncrypted: v.optional(v.boolean()),         // True if content is encrypted
  encryptionIV: v.optional(v.string()),         // AES-GCM initialization vector (base64)
  encryptionKeyVersion: v.optional(v.number()),  // Which MEK version encrypted this

  createdAt: v.number(),
  status: v.optional(v.string()),
  userId: v.optional(v.id("users")),
  deletedAt: v.optional(v.number()),
})
  .index("by_chat", ["chatId", "createdAt"])
  .index("by_client_id", ["chatId", "clientMessageId"])
  .index("by_user", ["userId"]),
```

**Field Explanations:**

| Field | Type | Purpose |
|-------|------|---------|
| `isEncrypted` | boolean | Flag to distinguish encrypted vs. unencrypted messages |
| `encryptionIV` | string | AES-GCM initialization vector (12 bytes, base64). Must be unique per message. |
| `encryptionKeyVersion` | number | References `users.encryptionKeyVersion` - which MEK encrypted this |

---

## Encryption System Design

### Key Hierarchy (Two-Tier Key Wrapping)

```
User Password (in memory only, never stored)
    |
    | PBKDF2 (100,000+ iterations, SHA-256)
    ▼
Password-Derived Key (KEK - Key Encryption Key)
    | 256-bit AES-GCM key
    | Exists only in client memory
    | Used to encrypt/decrypt MEK
    ▼
┌──────────────────────────────────────┐
│  Encrypted MEK                       │
│  Stored in: users.encryptedMasterKey │
│  Format: {iv, ciphertext, authTag}   │
└──────────────────────────────────────┘
    | Decrypt with KEK
    ▼
Master Encryption Key (MEK)
    | 256-bit AES-GCM key
    | Generated once per user
    | Used to encrypt all messages
    ▼
┌──────────────────────────────────────┐
│  Encrypted Message                   │
│  Stored in: messages.content         │
│  Format: base64(ciphertext)          │
└──────────────────────────────────────┘
```

**Why Key Wrapping?**

1. **Password Reset Support**: Change password → re-encrypt MEK with new KEK, old messages still decryptable
2. **Performance**: Derive KEK once per session, not per message
3. **Key Rotation**: Can rotate MEK without re-encrypting all messages immediately
4. **Multi-Device**: Same MEK works on all devices after password entry

### Cryptographic Primitives

| Operation | Algorithm | Parameters |
|-----------|-----------|------------|
| Password → Key Derivation | PBKDF2 | 100,000 iterations, SHA-256, 256-bit output |
| Symmetric Encryption | AES-GCM | 256-bit keys, 12-byte IV, 128-bit auth tag |
| Random Generation | Web Crypto API | `crypto.getRandomValues()` |
| Encoding | Base64 | For binary data storage in JSON |

---

## Implementation Phases

### Phase 1: Core Encryption Infrastructure (Week 1)

**Goal:** Build encryption utilities and test encryption/decryption works

**Tasks:**

1. **Create encryption utility library**
   - File: `apps/web/src/lib/message-encryption.ts`
   - Functions:
     - `deriveKeyFromPassword(password, salt)` → KEK
     - `generateMasterKey()` → MEK
     - `encryptMasterKey(mek, kek)` → encrypted MEK
     - `decryptMasterKey(encryptedMEK, kek)` → MEK
     - `encryptMessage(plaintext, mek)` → {ciphertext, iv}
     - `decryptMessage(ciphertext, iv, mek)` → plaintext
     - `generateSalt()` → random salt

2. **Database schema migration**
   - Update `apps/server/convex/schema.ts`
   - Add new fields to `users` and `messages` tables
   - Deploy schema changes to dev environment
   - Verify backward compatibility

3. **Unit tests**
   - Test encryption/decryption round-trip
   - Test key derivation consistency
   - Test key wrapping/unwrapping
   - Test error handling (wrong password, corrupted data)

**Deliverable:** Working encryption library with 100% test coverage

---

### Phase 2: User Onboarding Flow (Week 2)

**Goal:** Allow users to enable E2E encryption and set encryption password

**Tasks:**

1. **Create encryption setup UI**
   - File: `apps/web/src/components/encryption-setup-modal.tsx`
   - Components:
     - Password input with strength meter
     - Password confirmation
     - Warning about password loss
     - Optional: Recovery code generation

2. **Encryption setup API**
   - Endpoint: `/api/encryption/setup`
   - Server-side:
     - Mutation: `apps/server/convex/encryption.ts:setupEncryption`
     - Accepts: `{encryptedMasterKey, salt, keyVersion}`
     - Stores in `users` table
     - Validates user ownership

3. **Client-side setup flow**
   - Generate random MEK (256-bit)
   - Prompt user for encryption password
   - Derive KEK from password + salt
   - Encrypt MEK with KEK
   - Send encrypted MEK + salt to server
   - Store KEK in session storage (cleared on logout)

4. **Settings UI integration**
   - Add "Enable End-to-End Encryption" toggle in Account Settings
   - Show encryption status indicator
   - Link to encryption documentation

**Deliverable:** Users can enable E2E encryption and set password

---

### Phase 3: Message Encryption (Week 3)

**Goal:** Encrypt new messages before sending to server

**Tasks:**

1. **Modify message sending flow**
   - File: `apps/web/src/app/api/chat/chat-handler.ts`
   - Before sending message:
     ```typescript
     if (userEncryptionEnabled) {
       const mek = await getMEKFromSession();
       const {ciphertext, iv} = await encryptMessage(messageContent, mek);
       messageContent = ciphertext; // Send encrypted
       isEncrypted = true;
     }
     ```

2. **Update `streamUpsert` mutation**
   - File: `apps/server/convex/messages.ts`
   - Accept new fields: `isEncrypted`, `encryptionIV`, `encryptionKeyVersion`
   - Store encrypted content in `messages.content`
   - Set flags appropriately

3. **Streaming encryption**
   - For assistant responses, accumulate plaintext chunks
   - Encrypt accumulated text before DB flush (every 80ms)
   - Client decrypts streamed chunks on receipt

4. **Client-side decryption on display**
   - File: `apps/web/src/components/chat-room.tsx`
   - Before rendering message:
     ```typescript
     if (message.isEncrypted) {
       const mek = await getMEKFromSession();
       const plaintext = await decryptMessage(message.content, message.encryptionIV, mek);
       displayContent = plaintext;
     }
     ```

**Deliverable:** New messages encrypted end-to-end

---

### Phase 4: Session Management (Week 4)

**Goal:** Handle password prompts, session storage, multi-device

**Tasks:**

1. **Password prompt on login**
   - After successful auth, check if user has encryption enabled
   - If yes, show password prompt modal
   - Derive KEK and decrypt MEK
   - Store KEK + MEK in session storage (memory only)

2. **Session storage manager**
   - File: `apps/web/src/lib/encryption-session.ts`
   - Functions:
     - `storeEncryptionKeys(kek, mek)` → sessionStorage
     - `getEncryptionKeys()` → {kek, mek} or null
     - `clearEncryptionKeys()` → clear on logout
     - `isEncryptionUnlocked()` → boolean

3. **Auto-lock after inactivity**
   - Clear keys after 30 minutes of inactivity
   - Re-prompt for password when accessing encrypted chats

4. **Multi-device support**
   - Same flow on every device: login → enter encryption password
   - Encrypted MEK syncs via Convex `users` table
   - Each device independently decrypts MEK with user's password

**Deliverable:** Secure session management with auto-lock

---

### Phase 5: Password Reset & Recovery (Week 5)

**Goal:** Allow password reset while preserving message access

**Tasks:**

1. **Password change flow**
   - UI: Settings → Change Encryption Password
   - Process:
     ```typescript
     // Decrypt MEK with old password
     const mek = await decryptMasterKey(encryptedMEK, oldKEK);

     // Re-encrypt MEK with new password
     const newSalt = generateSalt();
     const newKEK = await deriveKeyFromPassword(newPassword, newSalt);
     const newEncryptedMEK = await encryptMasterKey(mek, newKEK);

     // Update in database
     await updateEncryptionPassword({newEncryptedMEK, newSalt});
     ```

2. **Email-based password reset**
   - **Important:** Resetting password via email **without old password** means:
     - Option A: **Old messages are lost** (most secure, true E2E)
     - Option B: **Server escrow** (store MEK encrypted with server key - less secure)

   - **Recommended:** Option A with warning to user:
     > "If you reset your encryption password, you will LOSE ACCESS to all existing encrypted messages. Consider changing your password in Settings instead if you remember your current password."

3. **Optional: Recovery codes**
   - Generate 16-digit recovery codes during setup
   - User must save offline (print/write down)
   - Encrypt MEK with recovery code as alternative KEK
   - Store as `users.encryptedMEKRecovery` field

**Deliverable:** Password change and recovery options

---

### Phase 6: UI Indicators & User Education (Week 6)

**Goal:** Make encryption status clear to users

**Tasks:**

1. **Visual indicators**
   - Padlock icon on encrypted messages
   - Banner in encrypted chats: "🔒 End-to-end encrypted"
   - Color-coded chat list (encrypted chats highlighted)

2. **Mixed chat handling**
   - Show transition point in chat history
   - e.g., "Messages sent after this point are end-to-end encrypted"

3. **User education**
   - Tooltip explanations
   - Help documentation
   - In-app guide: "What is E2E encryption?"

4. **Settings dashboard**
   - Show encryption status
   - Show number of encrypted vs. unencrypted messages
   - Option to enable/disable (with warnings)

**Deliverable:** Clear UX for encryption status

---

### Phase 7: Migration & Backward Compatibility (Week 7)

**Goal:** Handle existing unencrypted messages gracefully

**Tasks:**

1. **Message display logic**
   - File: `apps/web/src/components/chat-message-item.tsx`
   - Check `message.isEncrypted` flag
   - If true: decrypt with MEK
   - If false/undefined: display plaintext

2. **Optional: Retroactive encryption**
   - Feature: "Encrypt all existing messages"
   - Process:
     - Fetch all unencrypted messages for user
     - Encrypt client-side with MEK
     - Update messages with encrypted content
     - Set `isEncrypted = true`
   - Warning: One-way operation, cannot undo

3. **Search compatibility**
   - Encrypted messages cannot be searched server-side
   - Options:
     - Client-side search only (decrypt locally, then search)
     - Maintain unencrypted search index (privacy trade-off)

**Deliverable:** Seamless handling of mixed encrypted/unencrypted chats

---

### Phase 8: Performance Optimization (Week 8)

**Goal:** Ensure encryption doesn't slow down the app

**Tasks:**

1. **Batch decryption**
   - Decrypt multiple messages in parallel using `Promise.all()`
   - Use Web Workers for heavy decryption (if >100 messages)

2. **Caching decrypted messages**
   - Store decrypted plaintext in React state
   - Clear on component unmount
   - Never cache to localStorage (security risk)

3. **Streaming encryption optimization**
   - Encrypt chunks instead of full message during streaming
   - Update: Currently encrypts entire accumulated message every 80ms - optimize to encrypt only new chunks

4. **Key derivation caching**
   - Derive KEK once per session, store in memory
   - Avoid re-deriving on every message

**Deliverable:** <50ms encryption/decryption latency per message

---

### Phase 9: Security Audit & Testing (Week 9)

**Goal:** Ensure no security vulnerabilities

**Tasks:**

1. **Security checklist**
   - [ ] Keys never logged to console
   - [ ] Keys never sent to server unencrypted
   - [ ] IVs are unique per message (check for reuse)
   - [ ] PBKDF2 iterations ≥100,000
   - [ ] Secure random number generation (crypto.getRandomValues)
   - [ ] Timing-safe password comparison
   - [ ] No keys stored in localStorage (only sessionStorage)
   - [ ] Keys cleared on logout
   - [ ] CSP headers prevent XSS

2. **Penetration testing**
   - Attempt to decrypt messages without password
   - Attempt to access keys via browser dev tools
   - Test for timing attacks on password verification
   - Test for key extraction via XSS (simulate attack)

3. **Edge case testing**
   - Long messages (>10KB)
   - Unicode/emoji content
   - Empty messages
   - Corrupted ciphertext
   - Wrong password scenarios
   - Network interruptions during encryption

4. **Performance testing**
   - Load 1000 encrypted messages
   - Measure decrypt time
   - Test on low-end devices

**Deliverable:** Security audit report + fixes

---

### Phase 10: Rollout & Monitoring (Week 10)

**Goal:** Deploy to production safely

**Tasks:**

1. **Feature flag**
   - Environment variable: `ENABLE_E2E_ENCRYPTION`
   - Start disabled by default
   - Enable for beta testers first

2. **Staged rollout**
   - Week 1: Internal team testing
   - Week 2: 10% of users (beta opt-in)
   - Week 3: 50% of users
   - Week 4: 100% rollout

3. **Monitoring**
   - Track encryption setup rate
   - Monitor decryption error rates
   - Track password reset frequency
   - Measure performance impact

4. **Rollback plan**
   - Keep backward compatibility
   - Can disable encryption without data loss
   - Users keep encrypted messages (just can't create new ones)

**Deliverable:** E2E encryption live in production

---

## User Experience Flow

### First-Time Encryption Setup

```
1. User logs in → Dashboard
2. Banner: "🔒 Secure your chats with end-to-end encryption"
3. Click "Enable" → Modal appears
4. Modal content:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🔐 Enable End-to-End Encryption

   Your messages will be encrypted on your device
   before being sent to our servers. Even we can't
   read your encrypted messages.

   ⚠️ IMPORTANT: If you forget this password,
      your encrypted messages cannot be recovered.

   [ Create Encryption Password ]
   ┌──────────────────────────────────┐
   │ ••••••••••                       │
   └──────────────────────────────────┘
   Password strength: ████░░░░ Medium

   [ Confirm Password ]
   ┌──────────────────────────────────┐
   │ ••••••••••                       │
   └──────────────────────────────────┘

   ☑ I understand I cannot recover my messages
      if I lose this password

   [Cancel]  [Enable Encryption]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. User creates password → Success toast
6. All future messages encrypted automatically
```

### Sending Encrypted Message

```
User → Type message → Click Send
        ↓
Client: Encrypt with MEK
        ↓
API: Store encrypted ciphertext
        ↓
Convex: Save to database
        ↓
Other device: Decrypt with MEK (same password)
        ↓
Display plaintext message
```

### Login on New Device

```
1. User logs in with Better Auth (email/OAuth)
2. System detects user has encryption enabled
3. Modal appears:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🔐 Enter Encryption Password

   Your messages are end-to-end encrypted.
   Enter your encryption password to decrypt them.

   [ Encryption Password ]
   ┌──────────────────────────────────┐
   │                                  │
   └──────────────────────────────────┘

   [Forgot Password?]  [Unlock]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. User enters password
5. Client decrypts MEK from encrypted MEK
6. MEK stored in session (memory only)
7. Messages decrypt as user navigates
```

---

## Technical Specifications

### Encryption Function Details

#### 1. Key Derivation (Password → KEK)

```typescript
/**
 * Derives a 256-bit AES-GCM key from user password using PBKDF2
 * @param password - User's encryption password
 * @param salt - 16-byte random salt (base64)
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromPassword(
  password: string,
  salt: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = base64ToArrayBuffer(salt);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000, // Adjust based on performance testing
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false, // Not extractable (security)
    ["encrypt", "decrypt"]
  );

  return key;
}
```

#### 2. Master Key Generation

```typescript
/**
 * Generates a random 256-bit Master Encryption Key (MEK)
 * @returns CryptoKey for AES-GCM encryption
 */
async function generateMasterKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true, // Extractable (need to wrap it)
    ["encrypt", "decrypt"]
  );
  return key;
}
```

#### 3. Key Wrapping (Encrypt MEK with KEK)

```typescript
/**
 * Encrypts the Master Encryption Key with the Key Encryption Key
 * @param mek - Master Encryption Key (to be wrapped)
 * @param kek - Key Encryption Key (from password)
 * @returns Base64-encoded JSON: {iv, ciphertext}
 */
async function encryptMasterKey(
  mek: CryptoKey,
  kek: CryptoKey
): Promise<string> {
  // Export MEK as raw bytes
  const mekBytes = await crypto.subtle.exportKey("raw", mek);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Encrypt MEK with KEK
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    mekBytes
  );

  // Package as JSON and encode
  const payload = {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  };

  return JSON.stringify(payload);
}
```

#### 4. Key Unwrapping (Decrypt MEK with KEK)

```typescript
/**
 * Decrypts the Master Encryption Key using the Key Encryption Key
 * @param encryptedMEK - Base64-encoded wrapped key
 * @param kek - Key Encryption Key (from password)
 * @returns Unwrapped Master Encryption Key
 * @throws If password is incorrect or data is corrupted
 */
async function decryptMasterKey(
  encryptedMEK: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  // Parse encrypted package
  const payload = JSON.parse(encryptedMEK);
  const iv = base64ToArrayBuffer(payload.iv);
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);

  // Decrypt MEK bytes
  const mekBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    kek,
    ciphertext
  );

  // Import back as CryptoKey
  const mek = await crypto.subtle.importKey(
    "raw",
    mekBytes,
    "AES-GCM",
    false, // Not extractable in memory
    ["encrypt", "decrypt"]
  );

  return mek;
}
```

#### 5. Message Encryption

```typescript
/**
 * Encrypts a plaintext message using the Master Encryption Key
 * @param plaintext - Message content to encrypt
 * @param mek - Master Encryption Key
 * @returns {ciphertext, iv} - Encrypted message and initialization vector
 */
async function encryptMessage(
  plaintext: string,
  mek: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Encrypt message
  const ciphertextBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    mek,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBytes),
    iv: arrayBufferToBase64(iv)
  };
}
```

#### 6. Message Decryption

```typescript
/**
 * Decrypts an encrypted message using the Master Encryption Key
 * @param ciphertext - Base64-encoded encrypted message
 * @param iv - Base64-encoded initialization vector
 * @param mek - Master Encryption Key
 * @returns Decrypted plaintext message
 * @throws If decryption fails (wrong key, corrupted data)
 */
async function decryptMessage(
  ciphertext: string,
  iv: string,
  mek: CryptoKey
): Promise<string> {
  const ciphertextBytes = base64ToArrayBuffer(ciphertext);
  const ivBytes = base64ToArrayBuffer(iv);

  // Decrypt message
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    mek,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}
```

### Data Formats

#### Encrypted MEK Storage Format
```json
{
  "iv": "YWJjZGVmZ2hpams=",
  "ciphertext": "base64encodedencryptedmasterkey=="
}
```

#### Message Database Schema (Encrypted)
```json
{
  "_id": "k123abc",
  "chatId": "c456def",
  "role": "user",
  "content": "ZW5jcnlwdGVkY2lwaGVydGV4dGhlcmU=", // Base64 ciphertext
  "isEncrypted": true,
  "encryptionIV": "cmFuZG9taXZoZXJl",
  "encryptionKeyVersion": 1,
  "createdAt": 1704067200000,
  "userId": "u789xyz"
}
```

---

## Password Reset & Recovery

### Option 1: Password Change (User Remembers Old Password)

**Flow:**
1. User goes to Settings → Change Encryption Password
2. Enter old password
3. Enter new password (2x confirmation)
4. Client-side process:
   - Derive old KEK from old password
   - Decrypt MEK using old KEK
   - Generate new salt
   - Derive new KEK from new password + new salt
   - Encrypt MEK using new KEK
   - Send new encrypted MEK + new salt to server
5. Server updates `users.encryptedMasterKey` and `users.encryptionSalt`
6. Success: All messages remain decryptable with new password

**Security:** ✅ No data loss, fully secure E2E

---

### Option 2: Password Reset via Email (User Forgets Password)

**Two Approaches:**

#### Approach A: True E2E (Recommended) - Data Loss on Reset

**Flow:**
1. User clicks "Forgot Encryption Password?"
2. Warning modal:
   ```
   ⚠️ WARNING: Permanent Data Loss

   If you reset your encryption password without
   knowing your current password, ALL YOUR ENCRYPTED
   MESSAGES WILL BE PERMANENTLY LOST.

   We cannot recover them because they are
   end-to-end encrypted.

   Are you absolutely sure you want to continue?

   [Cancel] [I Understand, Reset Password]
   ```
3. User confirms → Send password reset email
4. User clicks link → Create new encryption password
5. Server-side process:
   - Generate new MEK (old one is lost)
   - Derive KEK from new password + new salt
   - Encrypt new MEK with new KEK
   - Update `users.encryptedMasterKey`, `users.encryptionSalt`, increment `users.encryptionKeyVersion`
6. Result: Old messages are undecryptable (display as "[Message encrypted with lost key]")
7. New messages encrypted with new MEK

**Security:** ✅ True E2E, maximum security
**UX:** ❌ Data loss (but user is warned)

---

#### Approach B: Server Escrow (Less Secure) - No Data Loss

**Flow:**
1. During initial setup, encrypt MEK with **both**:
   - User's password-derived KEK (primary)
   - Server-side master key (backup escrow)
2. Store both encrypted versions:
   - `users.encryptedMasterKey` (password-encrypted)
   - `users.encryptedMasterKeyEscrow` (server-encrypted)
3. On password reset:
   - Server decrypts MEK from escrow using server key
   - User creates new password
   - Server encrypts MEK with new password-derived KEK
   - Sends new encrypted MEK to database
4. Result: User regains access to all old messages

**Security:** ⚠️ **NOT true E2E** - server can decrypt messages
**UX:** ✅ No data loss

---

### Option 3: Recovery Codes (Hybrid)

**Flow:**
1. During encryption setup, generate 10 recovery codes:
   - Each code is 16 characters (e.g., `XXXX-XXXX-XXXX-XXXX`)
   - Derive KEK from each recovery code + salt
   - Encrypt MEK with recovery code KEK
   - Store as `users.encryptedMasterKeyRecovery`
2. Display recovery codes to user:
   ```
   ⚠️ SAVE THESE RECOVERY CODES

   If you forget your password, you can use
   one of these codes to regain access.

   1. ABCD-EFGH-IJKL-MNOP
   2. QRST-UVWX-YZAB-CDEF
   ...

   [Download as TXT] [Print] [I Saved Them]
   ```
3. User must confirm they saved them
4. On password reset:
   - User enters recovery code
   - Client derives KEK from recovery code
   - Decrypts MEK
   - User creates new password
   - Re-encrypt MEK with new password

**Security:** ✅ E2E maintained (if user keeps codes offline)
**UX:** ✅ No data loss (if user saved codes)
**Risk:** ⚠️ If recovery codes leak, messages can be decrypted

---

### Recommended Approach

**Combination Strategy:**

1. **Default:** True E2E (Approach A) - data loss on password reset
2. **Optional:** Recovery codes (Option 3) - user can opt-in during setup
3. **Never:** Server escrow (Approach B) - defeats purpose of E2E

**Reasoning:**
- Maintains true E2E encryption guarantee
- Gives users choice (convenience vs. security)
- Clear warnings about data loss
- Aligns with industry best practices (Signal, WhatsApp E2E)

---

## Migration Strategy

### Handling Existing Unencrypted Messages

**Design Decision:** **Leave old messages unencrypted, only encrypt new ones**

#### Why This Approach?

1. **Performance**: Encrypting thousands of existing messages is slow
2. **Simplicity**: No complex migration jobs
3. **User Choice**: Let users decide if they want to retroactively encrypt
4. **Backward Compatibility**: Old messages remain readable on all devices

#### Implementation Details

**Message Display Logic:**

```typescript
function renderMessage(message: Message, mek: CryptoKey | null): string {
  if (message.isEncrypted) {
    // Encrypted message - decrypt it
    if (!mek) {
      return "[🔒 Enter password to decrypt]";
    }
    try {
      return await decryptMessage(message.content, message.encryptionIV, mek);
    } catch (error) {
      return "[❌ Decryption failed - wrong password?]";
    }
  } else {
    // Unencrypted message - display as-is
    return message.content;
  }
}
```

**Visual Indicators in Chat:**

```
┌─────────────────────────────────────────┐
│ User: Hello, how are you?              │ (Unencrypted - no icon)
│ Assistant: I'm doing well!             │ (Unencrypted)
│                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔒 Messages below are end-to-end       │
│    encrypted                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                         │
│ 🔒 User: This is encrypted              │ (Encrypted - lock icon)
│ 🔒 Assistant: This is also encrypted    │ (Encrypted)
└─────────────────────────────────────────┘
```

---

### Optional: Retroactive Encryption Feature

**User Flow:**
1. User enables E2E encryption
2. Modal appears:
   ```
   Your future messages will be encrypted.

   You have 147 existing unencrypted messages.

   [ ] Also encrypt my existing messages
       (This may take a few minutes)

   [Skip]  [Enable & Encrypt All]
   ```

3. If user chooses "Encrypt All":
   ```typescript
   async function encryptExistingMessages(userId: string, mek: CryptoKey) {
     // Fetch all unencrypted messages for user's chats
     const unencrypted = await convex.query(api.messages.listUnencryptedForUser, {userId});

     // Encrypt each message client-side
     const encrypted = await Promise.all(
       unencrypted.map(async (msg) => {
         const {ciphertext, iv} = await encryptMessage(msg.content, mek);
         return {
           messageId: msg._id,
           encryptedContent: ciphertext,
           encryptionIV: iv,
           encryptionKeyVersion: 1
         };
       })
     );

     // Batch update messages in database
     await convex.mutation(api.messages.batchEncrypt, {updates: encrypted});
   }
   ```

4. Progress indicator shows: "Encrypting messages... 47/147"
5. Success: "✅ All messages encrypted"

**Convex Mutation:**

```typescript
// apps/server/convex/messages.ts
export const batchEncrypt = mutation({
  args: {
    updates: v.array(v.object({
      messageId: v.id("messages"),
      encryptedContent: v.string(),
      encryptionIV: v.string(),
      encryptionKeyVersion: v.number()
    }))
  },
  handler: async (ctx, args) => {
    // Validate ownership for each message
    for (const update of args.updates) {
      const message = await ctx.db.get(update.messageId);
      if (!message) continue;

      // Update message with encrypted content
      await ctx.db.patch(update.messageId, {
        content: update.encryptedContent,
        isEncrypted: true,
        encryptionIV: update.encryptionIV,
        encryptionKeyVersion: update.encryptionKeyVersion
      });
    }
  }
});
```

---

## Security Considerations

### 1. Key Management Security

**✅ Best Practices:**
- Keys never logged to console (production builds)
- Keys never sent to server unencrypted
- Keys derived from passwords never stored (only in memory)
- MEK stored only when wrapped (encrypted)
- Session storage cleared on logout/window close
- Non-extractable keys where possible

**⚠️ Risks & Mitigations:**

| Risk | Mitigation |
|------|------------|
| XSS attack extracts keys from memory | CSP headers, input sanitization, no `eval()` |
| User forgets password | Recovery codes (optional), clear warnings |
| Weak password | Password strength meter, minimum requirements |
| Key reuse across messages | Generate unique IV per message |
| Timing attacks on password verification | Constant-time comparison for password hashes |

---

### 2. IV (Initialization Vector) Uniqueness

**Critical Requirement:** Every encrypted message MUST have a unique IV

**Why:** Reusing an IV with the same key in AES-GCM **completely breaks encryption**

**Mitigation:**
```typescript
// Generate random IV for EVERY message
const iv = new Uint8Array(12);
crypto.getRandomValues(iv); // Cryptographically secure randomness

// Probability of collision with 96-bit IV: ~2^-48 (negligible)
```

**Testing:**
```typescript
// Unit test to verify IV uniqueness
test("Every encrypted message has unique IV", async () => {
  const ivs = new Set();
  for (let i = 0; i < 10000; i++) {
    const {iv} = await encryptMessage("test", mek);
    expect(ivs.has(iv)).toBe(false); // No duplicates
    ivs.add(iv);
  }
});
```

---

### 3. Side-Channel Attacks

**Metadata Leakage:**

Even with E2E encryption, the following metadata is visible to server:
- ❌ Message content (encrypted)
- ✅ Chat participants (userIds)
- ✅ Message timestamps
- ✅ Message length (ciphertext size reveals plaintext size)
- ✅ Message frequency

**Mitigation for Message Length:**
```typescript
// Optional: Add padding to hide message length
function padMessage(plaintext: string): string {
  const blockSize = 128; // bytes
  const paddingLength = blockSize - (plaintext.length % blockSize);
  return plaintext + '\0'.repeat(paddingLength);
}
```

---

### 4. Rollback/Replay Attacks

**Risk:** Attacker replaces new encrypted message with old encrypted message

**Mitigation:**
- Include message timestamp in encrypted payload
- Verify timestamp matches database `createdAt` on decryption
- Use `clientMessageId` for deduplication

**Enhanced Encryption Payload:**
```typescript
type EncryptedPayload = {
  content: string;           // Actual message
  timestamp: number;         // Unix timestamp
  messageId: string;         // Client-generated UUID
  version: number;           // Payload format version
};

// Encrypt entire payload, not just content
const payloadJSON = JSON.stringify(payload);
const {ciphertext, iv} = await encryptMessage(payloadJSON, mek);
```

---

### 5. Forward Secrecy

**Current Design:** No forward secrecy (same MEK encrypts all messages)

**Risk:** If MEK is compromised, all past messages are decryptable

**Future Enhancement:** Ratcheting keys (Signal Protocol-style)
- Generate new MEK periodically (e.g., every 1000 messages)
- Delete old MEKs after re-encrypting with new key
- Not in scope for initial implementation

---

## Testing Plan

### Unit Tests

**File:** `apps/web/src/lib/message-encryption.test.ts`

```typescript
describe("Message Encryption", () => {
  test("Encrypt and decrypt message", async () => {
    const mek = await generateMasterKey();
    const plaintext = "Hello, world!";

    const {ciphertext, iv} = await encryptMessage(plaintext, mek);
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await decryptMessage(ciphertext, iv, mek);
    expect(decrypted).toBe(plaintext);
  });

  test("Decryption fails with wrong key", async () => {
    const mek1 = await generateMasterKey();
    const mek2 = await generateMasterKey();

    const {ciphertext, iv} = await encryptMessage("secret", mek1);

    await expect(
      decryptMessage(ciphertext, iv, mek2)
    ).rejects.toThrow();
  });

  test("Key derivation is deterministic", async () => {
    const password = "test123";
    const salt = generateSalt();

    const kek1 = await deriveKeyFromPassword(password, salt);
    const kek2 = await deriveKeyFromPassword(password, salt);

    // Should derive same key
    const exported1 = await crypto.subtle.exportKey("raw", kek1);
    const exported2 = await crypto.subtle.exportKey("raw", kek2);
    expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
  });

  test("IV is unique per message", async () => {
    const mek = await generateMasterKey();
    const ivs = new Set();

    for (let i = 0; i < 1000; i++) {
      const {iv} = await encryptMessage("test", mek);
      expect(ivs.has(iv)).toBe(false);
      ivs.add(iv);
    }
  });

  test("Handles unicode/emoji correctly", async () => {
    const mek = await generateMasterKey();
    const plaintext = "Hello 👋 世界 🌍";

    const {ciphertext, iv} = await encryptMessage(plaintext, mek);
    const decrypted = await decryptMessage(ciphertext, iv, mek);

    expect(decrypted).toBe(plaintext);
  });

  test("Key wrapping preserves MEK", async () => {
    const password = "secure_password_123";
    const salt = generateSalt();
    const kek = await deriveKeyFromPassword(password, salt);

    const originalMEK = await generateMasterKey();
    const encryptedMEK = await encryptMasterKey(originalMEK, kek);
    const unwrappedMEK = await decryptMasterKey(encryptedMEK, kek);

    // Should be able to decrypt with unwrapped key
    const {ciphertext, iv} = await encryptMessage("test", originalMEK);
    const decrypted = await decryptMessage(ciphertext, iv, unwrappedMEK);

    expect(decrypted).toBe("test");
  });
});
```

---

### Integration Tests

**File:** `apps/web/src/app/api/chat/__tests__/encryption.test.ts`

```typescript
describe("E2E Encryption Integration", () => {
  test("Full flow: setup → send → receive → decrypt", async () => {
    // 1. User enables encryption
    const password = "test_password_123";
    const {userId} = await setupEncryption(password);

    // 2. User sends encrypted message
    const messageContent = "This is a secret message";
    const {messageId} = await sendMessage(userId, messageContent);

    // 3. Fetch message from database
    const dbMessage = await convex.query(api.messages.get, {messageId});
    expect(dbMessage.isEncrypted).toBe(true);
    expect(dbMessage.content).not.toBe(messageContent); // Stored encrypted

    // 4. User on another device enters password and decrypts
    const decrypted = await decryptMessageFlow(userId, messageId, password);
    expect(decrypted).toBe(messageContent);
  });

  test("Password change preserves message access", async () => {
    const oldPassword = "old_password";
    const newPassword = "new_password";

    // Send message with old password
    const {userId, messageId} = await sendEncryptedMessage("secret", oldPassword);

    // Change password
    await changeEncryptionPassword(userId, oldPassword, newPassword);

    // Should still decrypt with new password
    const decrypted = await decryptMessageFlow(userId, messageId, newPassword);
    expect(decrypted).toBe("secret");
  });
});
```

---

### E2E Browser Tests (Playwright)

```typescript
test("User enables encryption and sends message", async ({ page }) => {
  // Login
  await page.goto("/auth/sign-in");
  await page.fill('input[type="email"]', "test@example.com");
  await page.click('button:has-text("Sign In")');

  // Enable encryption
  await page.goto("/dashboard/settings");
  await page.click('button:has-text("Enable End-to-End Encryption")');

  // Enter encryption password
  await page.fill('input[placeholder="Create Encryption Password"]', "secure123");
  await page.fill('input[placeholder="Confirm Password"]', "secure123");
  await page.check('input[type="checkbox"]'); // Acknowledge warning
  await page.click('button:has-text("Enable Encryption")');

  // Wait for success
  await expect(page.locator('text=Encryption enabled')).toBeVisible();

  // Send encrypted message
  await page.goto("/dashboard/chat/new");
  await page.fill('textarea[placeholder="Type a message"]', "This is encrypted");
  await page.click('button[type="submit"]');

  // Verify lock icon appears
  await expect(page.locator('svg.lucide-lock')).toBeVisible();
});
```

---

## Rollout Strategy

### Phase 1: Internal Alpha (Week 1)

- **Audience:** Development team only (5 users)
- **Goal:** Catch critical bugs
- **Feature Flag:** `ENABLE_E2E_ENCRYPTION=alpha`
- **Monitoring:** Manual testing, no metrics

---

### Phase 2: Closed Beta (Week 2-3)

- **Audience:** 50 beta testers (opt-in)
- **Goal:** Test on real user data, gather feedback
- **Feature Flag:** `ENABLE_E2E_ENCRYPTION=beta`
- **Monitoring:**
  - Encryption setup rate
  - Decryption error rate
  - Password reset requests
  - Performance metrics
- **Feedback Channels:**
  - In-app feedback form
  - Discord beta channel
  - Weekly surveys

---

### Phase 3: Public Beta (Week 4-6)

- **Audience:** All users (opt-in from settings)
- **Goal:** Scale testing
- **Feature Flag:** `ENABLE_E2E_ENCRYPTION=public-beta`
- **Banner:** "🔒 Try our new end-to-end encryption (beta)"
- **Monitoring:**
  - Same as Phase 2
  - Error tracking (Sentry)
  - Performance tracking (Web Vitals)

---

### Phase 4: General Availability (Week 7+)

- **Audience:** All users (default off, easy to enable)
- **Feature Flag:** `ENABLE_E2E_ENCRYPTION=ga`
- **Marketing:**
  - Blog post announcement
  - Social media campaign
  - Email to all users
- **Documentation:**
  - Help center articles
  - Video tutorials
  - FAQ section

---

### Phase 5: Default On (Month 3+)

- **Audience:** New users (enabled by default)
- **Goal:** Make E2E encryption the standard
- **Existing Users:** Prompted to enable on next login
- **Monitoring:** Track adoption rate vs. opt-out rate

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Adoption Rate** | 60% of active users within 3 months | Track `users.encryptionEnabled` |
| **Encryption Setup Completion** | >90% of users who start setup complete it | Funnel analysis: start → complete |
| **Decryption Error Rate** | <0.1% of message loads | Track decryption failures |
| **Password Reset Rate** | <5% of users per month | Track password reset requests |
| **Performance Impact** | <100ms encryption latency | Measure encrypt/decrypt time |
| **User Satisfaction** | >4/5 stars on feature survey | Post-rollout survey |

---

## Future Enhancements (Post-MVP)

### Version 2 Features

1. **Encrypted Search**
   - Client-side search index
   - Encrypt search index with MEK
   - Full-text search on decrypted messages

2. **Encrypted Attachments**
   - Extend encryption to file uploads
   - Stream encryption for large files
   - Encrypted thumbnails

3. **Shared Secrets**
   - Multi-party encryption (group chats)
   - Per-chat encryption keys
   - Key exchange protocol

4. **Forward Secrecy**
   - Ratcheting keys (Signal Protocol)
   - Automatic key rotation
   - Delete old keys after use

5. **Encrypted Backups**
   - Export encrypted chat history
   - Encrypted backups to cloud storage
   - Restore from encrypted backup

6. **Hardware Security Keys**
   - WebAuthn integration
   - Store MEK in hardware token
   - Biometric unlock

---

## File Structure (New Files)

```
apps/web/src/lib/
├── encryption/
│   ├── message-encryption.ts          # Core encryption functions
│   ├── key-management.ts              # KEK/MEK derivation and wrapping
│   ├── encryption-session.ts          # Session storage for keys
│   ├── encryption-utils.ts            # Helper functions (base64, etc.)
│   └── __tests__/
│       ├── message-encryption.test.ts
│       └── key-management.test.ts

apps/web/src/components/
├── encryption-setup-modal.tsx         # Initial encryption setup UI
├── encryption-password-prompt.tsx     # Login password prompt
├── encryption-status-indicator.tsx    # Lock icon, banner
└── encryption-settings-panel.tsx      # Settings page section

apps/server/convex/
├── encryption.ts                       # Encryption-related mutations/queries
└── migrations/
    └── 001_add_encryption_fields.ts    # Schema migration script

docs/
└── E2E_ENCRYPTION.md                   # User-facing documentation
```

---

## Documentation Checklist

- [ ] User guide: "How to enable end-to-end encryption"
- [ ] User guide: "How to change your encryption password"
- [ ] User guide: "What if I forget my encryption password?"
- [ ] Developer docs: Architecture overview
- [ ] Developer docs: API reference for encryption functions
- [ ] Security whitepaper (for enterprise customers)
- [ ] FAQ: Common questions about E2E encryption
- [ ] Blog post: Announcement of E2E encryption feature

---

## Open Questions & Decisions Needed

1. **PBKDF2 Iterations:** How many iterations for key derivation?
   - Test performance on target devices
   - Balance security vs. UX (longer = more secure but slower)
   - Recommendation: Start with 100,000, adjust based on testing

2. **Password Requirements:** Enforce minimum password strength?
   - Option A: No requirements (user freedom)
   - Option B: Minimum 8 characters, mixed case + numbers
   - Option C: Zxcvbn-based strength meter with recommendations

3. **Recovery Codes:** Include in MVP or defer to v2?
   - Pros: Better UX, reduces support burden
   - Cons: Complexity, potential security risk if not stored properly
   - Recommendation: Include as optional feature

4. **Encryption for AI Responses:** How to handle streaming?
   - Option A: Encrypt full response after completion
   - Option B: Encrypt chunks as they arrive (complex)
   - Recommendation: Option A (simpler, still secure)

5. **Migration Timeline:** When to show encryption prompts to existing users?
   - Option A: Immediately on next login (aggressive)
   - Option B: Soft prompt in dashboard banner (passive)
   - Option C: Targeted email campaign (gradual)
   - Recommendation: Option B for existing users, Option A for new users

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Users forget passwords** | High | High | Clear warnings, recovery codes (optional), password hints |
| **Performance degradation** | Medium | Medium | Optimize crypto operations, use Web Workers, batch decryption |
| **Browser compatibility issues** | Low | Medium | Feature detection, fallback to unencrypted (with warning) |
| **Key extraction via XSS** | Low | Critical | CSP headers, input sanitization, security audit |
| **Implementation bugs** | Medium | Critical | Extensive testing, security audit, gradual rollout |
| **User confusion about feature** | Medium | Low | Clear UX, help documentation, onboarding flow |

---

## Conclusion

This plan provides a comprehensive, production-ready approach to implementing end-to-end encryption in OpenChat following Convex's recommended patterns and industry best practices.

**Key Principles:**
1. ✅ **Client-side encryption** - Server never sees plaintext
2. ✅ **Password-based with key wrapping** - User-friendly + secure
3. ✅ **Gradual migration** - Backward compatible with unencrypted messages
4. ✅ **Clear user communication** - Warnings about data loss, password importance
5. ✅ **Phased rollout** - Catch issues before widespread deployment

**Next Steps:**
1. Review and approve this plan
2. Create implementation tickets for Phase 1
3. Set up dev environment with encryption enabled
4. Begin implementation starting with encryption utilities
5. Iterate based on testing and feedback

---

**Document Version:** 1.0
**Last Updated:** 2025-11-07
**Owner:** Development Team
**Reviewers:** Security Team, Product Team, UX Team
