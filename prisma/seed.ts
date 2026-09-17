import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import { generateSchedule } from '../src/app/service/loan/schedule-generation.service';
import { D } from '../src/lib/money';

const prisma = new PrismaClient();

// ── Firebase Admin init ──────────────────────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const TEST_EMAIL    = process.env.TEST_USER_EMAIL    ?? 'test@loan-service.dev';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'Test@123456';

async function seedFirebaseUser() {
  initFirebase();
  try {
    const existing = await admin.auth().getUserByEmail(TEST_EMAIL);
    console.log(`   Firebase user already exists: ${existing.email} (uid: ${existing.uid})`);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/user-not-found') {
      const user = await admin.auth().createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, emailVerified: true });
      console.log(`   Firebase user created: ${user.email} (uid: ${user.uid})`);
    } else {
      throw err;
    }
  }
}

// ── Loan + schedule seed ─────────────────────────────────────────────────────
async function seedLoan() {
  const existing = await prisma.loan.count();
  if (existing > 0) {
    console.log(`   Loan seed skipped — ${existing} loan(s) already exist.`);
    return null;
  }

  const principal        = D('200000');
  const annualInterestRate = D('18');
  const tenureMonths     = 24;
  const disbursementDate = new Date('2025-09-01T00:00:00.000Z');

  const { emiAmount, totalInterest, totalPayable, rows } = generateSchedule({
    principal,
    annualInterestRate,
    tenureMonths,
    disbursementDate,
  });

  const loan = await prisma.$transaction(async (tx) => {
    const l = await tx.loan.create({
      data: { principal, annualInterestRate, tenureMonths, disbursementDate, emiAmount, totalInterest, totalPayable },
    });
    await tx.installment.createMany({
      data: rows.map((r) => ({
        loanId: l.id,
        installmentNumber: r.installmentNumber,
        dueDate: r.dueDate,
        openingBalance: r.openingBalance,
        principalComponent: r.principalComponent,
        interestComponent: r.interestComponent,
        totalDue: r.totalDue,
        closingBalance: r.closingBalance,
      })),
    });
    return l;
  });

  return loan;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nSeeding…\n');

  console.log('Firebase test user');
  await seedFirebaseUser();

  console.log('\nDemo loan');
  const loan = await seedLoan();
  if (loan) {
    console.log(`   ID:     ${loan.id}`);
    console.log(`   Open:   http://localhost:3000/app/loans/${loan.id}`);
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`   Test account`);
  console.log(`   Email:    ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log(`   Docs:     http://localhost:3000/app/docs`);
  console.log(`─────────────────────────────────────────\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
