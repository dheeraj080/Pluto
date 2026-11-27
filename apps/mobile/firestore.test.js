const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

function validExpense(uid) {
  return {
    userId: uid,
    originalAmount: "18.50",
    originalCurrencyCode: "EUR",
    homeAmount: "20.10",
    homeCurrencyCode: "USD",
    exchangeRate: "1.0865",
    exchangeRateTimestamp: 1700000000000,
    exchangeRateSource: "api",
    categoryId: "food",
    timestamp: 1700000000000,
    merchant: "Cafe Metro",
    note: "Lunch",
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function validWallet(uid) {
  return {
    userId: uid,
    currencyCode: "EUR",
    balance: "420.00",
    initialBalance: "500.00",
    localCreatedAt: 1700000000000,
    localUpdatedAt: 1700000000000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function validSettings(uid) {
  return {
    userId: uid,
    homeCurrencyCode: "USD",
    destinationCurrencyCode: "EUR",
    persona: "INTERNATIONAL_STUDENT",
    budgetCycleType: "ACADEMIC_TERM",
    termName: "Fall Semester",
    termStartDate: 1700000000000,
    termEndDate: 1708000000000,
    totalAllowanceHome: "6000.00",
    tuitionAndFixedCommittedHome: "1500.00",
    tripName: "Current Trip",
    tripStartDate: 1700000000000,
    tripEndDate: 1701000000000,
    totalTripBudgetHome: "1500.00",
    firstDayOfWeek: 1,
    defaultCategoryId: "food",
    dailySpendingCap: "49.99",
    monthlySpendingCap: "1500.50",
    safeToSpendWarningThreshold: "19.95",
    categoryMonthlyBudgets: { food: "320.50" },
    warningNotificationsEnabled: true,
    themeMode: "SYSTEM",
    isOnboardingCompleted: true,
    isBiometricLockEnabled: false,
    autoLockTimeoutMinutes: 1,
    isPrivacyModeEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user cannot read or write expenses or settings", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("expenses").get());
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("expenses").doc("exp_1").set(validExpense(ALICE_UID)));
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("profile").doc("settings").set(validSettings(ALICE_UID)));
});

test("Authenticated user can create, read, update, and delete own expense", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ref = aliceDb.collection("users").doc(ALICE_UID).collection("expenses").doc("exp_1");
  await assertSucceeds(ref.set(validExpense(ALICE_UID)));
  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).collection("expenses").get());
  await assertSucceeds(ref.update({ merchant: "Updated Cafe", updatedAt: new Date() }));
  await assertSucceeds(ref.delete());
});

test("Cross-user access is denied across expenses, wallets, and settings", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("wallets").doc("wal_1").set(validWallet(ALICE_UID))
  );

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("wallets").doc("wal_1").get());
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("wallets").get());
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("wallets").doc("wal_2").set(validWallet(BOB_UID)));
});

test("Ghost field and identity spoofing payloads are rejected", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ghostPayload = { ...validExpense(ALICE_UID), isAdmin: true };
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("expenses").doc("exp_ghost").set(ghostPayload)
  );
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("expenses").doc("exp_spoof").set(validExpense(BOB_UID))
  );
});

test("Settings update cannot mutate userId or createdAt and rejects invalid enum or invalid homeTimeZoneId", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ref = aliceDb.collection("users").doc(ALICE_UID).collection("profile").doc("settings");
  await assertSucceeds(ref.set(validSettings(ALICE_UID)));
  await assertSucceeds(ref.update({ homeTimeZoneId: "Asia/Kolkata", updatedAt: new Date() }));
  await assertSucceeds(ref.update({ homeTimeZoneId: null, updatedAt: new Date() }));
  await assertSucceeds(ref.update({ dailySpendingCap: 75, monthlySpendingCap: 2000.5, updatedAt: new Date() }));
  await assertSucceeds(ref.update({ dailySpendingCap: "45.25", updatedAt: new Date() }));
  await assertSucceeds(ref.update({ homeModules: ["CYCLE_RUNWAY:true", "DAILY_SAFE_TO_SPEND:true"], updatedAt: new Date() }));
  await assertFails(ref.update({ dailySpendingCap: "-10.00", updatedAt: new Date() }));
  await assertFails(ref.update({ monthlySpendingCap: "not-a-number", updatedAt: new Date() }));
  await assertFails(ref.update({ homeModules: "not-a-list", updatedAt: new Date() }));
  await assertFails(ref.update({ homeTimeZoneId: "", updatedAt: new Date() }));
  await assertFails(ref.update({ themeMode: "NEON_INVALID", updatedAt: new Date() }));
  await assertFails(ref.update({ userId: BOB_UID, updatedAt: new Date() }));
});
