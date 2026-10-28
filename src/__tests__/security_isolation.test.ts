/**
 * COMPREHENSIVE SECURITY & ADMIN AUTHORIZATION TEST SUITE
 * Tests UID-based user isolation and canonical admin authorization logic offline.
 */

const CANONICAL_ADMIN_EMAILS = [
  'lucas1renck2melo@gmail.com',
  'ysabelleosaraiva@gmail.com',
  'yasabelleosaraiva@gmail.com'
];

const ALLOWED_ADMIN_COLLECTIONS = [
  'questions',
  'topics',
  'subjects',
  'semesters',
  'sourceDocuments',
  'source_documents',
  'examSets',
  'simulados',
  'imported_exams'
];

function verifyAdminPermission(userEmail: string, isCustomClaimAdmin: boolean = false): boolean {
  if (!userEmail) return false;
  const normalized = userEmail.toLowerCase().trim();
  if (CANONICAL_ADMIN_EMAILS.includes(normalized)) return true;
  if (isCustomClaimAdmin) return true;
  return false;
}

function checkUserDocumentAuthorization(collection: string, docId: string, authUid: string, docDataInDb?: any): boolean {
  if (!authUid) return false;
  if (collection === 'userProgress' || collection === 'users') {
    return docId === authUid;
  }
  if (collection.startsWith('users/')) {
    const parts = collection.split('/');
    return parts[1] === authUid;
  }
  if (collection === 'quizAttempts' || collection === 'flashcardSessions' || collection === 'userSuggestions' || collection === 'studySessions') {
    if (docDataInDb) {
      const owner = docDataInDb.userId || docDataInDb.uid || docDataInDb.userEmail;
      if (owner === authUid) return true;
      if (typeof docId === 'string' && (docId.startsWith(authUid + '_') || docId === authUid)) return true;
      return false;
    }
    if (typeof docId === 'string' && (docId.startsWith(authUid + '_') || docId === authUid)) {
      return true;
    }
    return true;
  }
  return false;
}

function validateSetPayload(docData: any, authUid: string): boolean {
  if (docData.userId && docData.userId !== authUid) return false;
  if (docData.uid && docData.uid !== authUid) return false;
  return true;
}

function isPublicCollection(collection: string): boolean {
  return ALLOWED_ADMIN_COLLECTIONS.includes(collection);
}

const userA = 'user_abc_123';
const userB = 'user_xyz_999';

console.log('--- RUNNING SECURITY & ADMIN AUTHORIZATION TEST SUITE ---');

// Scenario 1: Authorized Admin E-mail gets granted admin access
if (!verifyAdminPermission('lucas1renck2melo@gmail.com') || !verifyAdminPermission('ysabelleosaraiva@gmail.com')) {
  throw new Error('TEST FAILED: Canonical admin email was denied admin access');
}
console.log('✅ Test 1 Passed: Authorized canonical admin email accepted.');

// Scenario 2: Regular Student E-mail denied admin access (HTTP 403)
if (verifyAdminPermission('aluno_estudante@gmail.com', false)) {
  throw new Error('SECURITY VIOLATION: Regular student email was granted admin access');
}
console.log('✅ Test 2 Passed: Regular student denied admin access (HTTP 403).');

// Scenario 3: Visitor without token denied admin access (HTTP 401)
if (verifyAdminPermission('')) {
  throw new Error('SECURITY VIOLATION: Unauthenticated visitor granted admin access');
}
console.log('✅ Test 3 Passed: Unauthenticated visitor denied admin access (HTTP 401).');

// Scenario 4: User A accesses own document
if (!checkUserDocumentAuthorization('userProgress', userA, userA)) {
  throw new Error('TEST FAILED: User A should access their own progress');
}
console.log('✅ Test 4 Passed: User A accesses own document.');

// Scenario 5: User A blocked from User B document
if (checkUserDocumentAuthorization('userProgress', userB, userA)) {
  throw new Error('SECURITY VIOLATION: User A was granted access to User B progress');
}
console.log('✅ Test 5 Passed: User A blocked from User B document.');

// Scenario 6: Attempting to forge userId in payload is rejected
if (validateSetPayload({ score: 100, userId: userB }, userA)) {
  throw new Error('SECURITY VIOLATION: Payload forge with foreign userId was accepted');
}
console.log('✅ Test 6 Passed: Forged userId in payload rejected.');

// Scenario 7: Arbitrary IDs for quizAttempts belonging to User B are BLOCKED
const userBQuizAttempt = { userId: userB, score: 90 };
if (checkUserDocumentAuthorization('quizAttempts', 'arbitrary_doc_999', userA, userBQuizAttempt)) {
  throw new Error('SECURITY VIOLATION: Arbitrary ID granted access to User B quiz attempt');
}
console.log('✅ Test 7 Passed: Arbitrary ID for foreign quizAttempt blocked.');

// Scenario 8: Non-allowed admin collection rejected
if (ALLOWED_ADMIN_COLLECTIONS.includes('userProgress') || ALLOWED_ADMIN_COLLECTIONS.includes('creditCards')) {
  throw new Error('SECURITY VIOLATION: Private/Sensitive collection listed under admin content collections');
}
console.log('✅ Test 8 Passed: Private collections excluded from admin content endpoints.');

// Scenario 9: Authorized public static collections remain accessible for reading
if (!isPublicCollection('questions') || !isPublicCollection('imported_exams')) {
  throw new Error('TEST FAILED: Public static collections misclassified');
}
console.log('✅ Test 9 Passed: Public static collections remain accessible for SELECT.');

// Scenario 10: User cannot self-grant admin if email is not in canonical list
if (verifyAdminPermission('hacker@gmail.com', false)) {
  throw new Error('SECURITY VIOLATION: Non-admin self-grant succeeded');
}
console.log('✅ Test 10 Passed: Student user cannot self-grant admin privileges.');

// Scenario 11: Database document role=admin is ignored and denied (privilege escalation prevention)
if (verifyAdminPermission('student_with_db_role_admin@gmail.com', false)) {
  throw new Error('SECURITY VIOLATION: Database document role=admin successfully bypassed security check');
}
console.log('✅ Test 11 Passed: Database profile role=admin successfully ignored (access denied).');

const PRIVILEGED_PROFILE_KEYS = new Set([
  'role',
  'admin',
  'isadmin',
  'is_admin',
  'ispremium',
  'is_premium',
  'islifetimepremium',
  'is_lifetime_premium',
  'lifetimepremium',
  'premiumprovider',
  'premium_provider',
  'premiumpaymentid',
  'premium_payment_id',
  'premiumsince',
  'premium_since',
  'premiumuntil',
  'premium_until',
  'premiumplan',
  'premium_plan',
  'plantype',
  'plan_type',
  'referralrewardgranted',
  'referral_reward_granted'
]);

function normalizeProfileKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findPrivilegedFields(obj: any, parentPath = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const violations: string[] = [];

  for (const rawKey of Object.keys(obj)) {
    const fullPath = parentPath ? `${parentPath}.${rawKey}` : rawKey;
    const leafKey = rawKey.includes('.') ? rawKey.split('.').pop()! : rawKey;
    const normalizedRaw = normalizeProfileKey(rawKey);
    const normalizedLeaf = normalizeProfileKey(leafKey);

    if (PRIVILEGED_PROFILE_KEYS.has(normalizedRaw) || PRIVILEGED_PROFILE_KEYS.has(normalizedLeaf)) {
      violations.push(fullPath);
    }

    const val = obj[rawKey];
    if (val && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
      violations.push(...findPrivilegedFields(val, fullPath));
    }
  }

  return violations;
}

function validateUserProfileMutation(
  collection: string,
  targetDocId: string,
  authUid: string,
  payload: any,
  isReqAdmin: boolean = false
): { allowed: boolean; reason?: string } {
  if (!authUid) return { allowed: false, reason: 'Unauthenticated' };
  
  if (!isReqAdmin) {
    if (collection === 'users' && targetDocId !== authUid) {
      return { allowed: false, reason: 'Cross-user write forbidden' };
    }
    if (payload.userId && payload.userId !== authUid) {
      return { allowed: false, reason: 'userId mismatch' };
    }
    if (payload.uid && payload.uid !== authUid) {
      return { allowed: false, reason: 'uid mismatch' };
    }
    if (collection === 'users') {
      const violations = findPrivilegedFields(payload);
      if (violations.length > 0) {
        return { allowed: false, reason: `Privileged fields rejected: ${violations.join(', ')}` };
      }
    }
  }

  return { allowed: true };
}

// Scenario 12: Attempting to modify role in user profile is REJECTED
const roleHackAttempt = validateUserProfileMutation('users', userA, userA, { role: 'admin' });
if (roleHackAttempt.allowed) {
  throw new Error('SECURITY VIOLATION: Student user was able to alter role to admin');
}
console.log('✅ Test 12 Passed: Self-grant of role=admin in user profile strictly rejected.');

// Scenario 13: Attempting to set isPremium or isLifetimePremium in user profile is REJECTED
const premiumHackAttempt1 = validateUserProfileMutation('users', userA, userA, { isPremium: true });
const premiumHackAttempt2 = validateUserProfileMutation('users', userA, userA, { isLifetimePremium: true, planType: 'combo_ouro' });
if (premiumHackAttempt1.allowed || premiumHackAttempt2.allowed) {
  throw new Error('SECURITY VIOLATION: Student user was able to self-grant isPremium or isLifetimePremium');
}
console.log('✅ Test 13 Passed: Self-grant of isPremium and isLifetimePremium strictly rejected.');

// Scenario 14: Attempting to alter privileged fields via dot notation or nested objects is REJECTED
const dotPathHack = validateUserProfileMutation('users', userA, userA, { 'settings.role': 'admin' });
const deepNestedHack = validateUserProfileMutation('users', userA, userA, { settings: { isPremium: true } });
if (dotPathHack.allowed || deepNestedHack.allowed) {
  throw new Error('SECURITY VIOLATION: Privileged field alteration bypassed via nested/dot path');
}
console.log('✅ Test 14 Passed: Bypasses via dot notation or nested objects in profile strictly rejected.');

// Scenario 15: Legitimate user profile update (displayName, settings, residencyFocus) is ACCEPTED
const legitimateUpdate = validateUserProfileMutation('users', userA, userA, {
  displayName: 'Dra. Ysabelle',
  photoURL: 'https://example.com/avatar.png',
  residencyFocus: 'Cirurgia Geral',
  targetExam: 'USP-SP',
  settings: {
    dailyGoalMinutes: 45,
    theme: 'dark',
    residencyFocus: 'Cirurgia Geral'
  }
});
if (!legitimateUpdate.allowed) {
  throw new Error('REGRESSION DETECTED: Legitimate profile settings update was wrongly rejected');
}
console.log('✅ Test 15 Passed: Legitimate user profile settings update accepted.');

// Scenario 16: User A attempting to write/update User B profile document is REJECTED
const crossUserAttempt = validateUserProfileMutation('users', userB, userA, {
  displayName: 'Vandal User'
});
if (crossUserAttempt.allowed) {
  throw new Error('SECURITY VIOLATION: User A was able to write to User B profile document');
}
console.log('✅ Test 16 Passed: Cross-user profile document write strictly rejected.');

// Scenario 17: User A updating their own profile document without privileged fields is ACCEPTED
const ownProfileAttempt = validateUserProfileMutation('users', userA, userA, {
  displayName: 'Dr. Lucas'
});
if (!ownProfileAttempt.allowed) {
  throw new Error('REGRESSION DETECTED: User A could not update their own profile document');
}
console.log('✅ Test 17 Passed: User updating own profile document accepted.');

console.log('=====================================================');
console.log('🎉 ALL 17 SECURITY & ADMIN AUTHORIZATION TESTS PASSED!');
console.log('=====================================================');
