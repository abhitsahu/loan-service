import { PrismaClient } from '@prisma/client';
import { generateSchedule } from '../src/app/service/loan/schedule-generation.service';
import { D } from '../src/lib/money';

const prisma = new PrismaClient();

async function main() {
  // Check if any loan already exists — seed is idempotent
  const existing = await prisma.loan.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} loan(s) already exist.`);
    return;
  }

  const principal = D('200000');
  const annualInterestRate = D('18');
  const tenureMonths = 24;
  const disbursementDate = new Date('2025-09-01T00:00:00.000Z');

  const { emiAmount, totalInterest, totalPayable, rows } = generateSchedule({
    principal,
    annualInterestRate,
    tenureMonths,
    disbursementDate,
  });

  const loan = await prisma.$transaction(async (tx) => {
    const l = await tx.loan.create({
      data: {
        principal,
        annualInterestRate,
        tenureMonths,
        disbursementDate,
        emiAmount,
        totalInterest,
        totalPayable,
      },
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

  console.log(`\n✅  Seeded demo loan:`);
  console.log(`   ID:            ${loan.id}`);
  console.log(`   Principal:     ₹2,00,000`);
  console.log(`   Rate:          18% p.a.`);
  console.log(`   Tenure:        24 months`);
  console.log(`   EMI:           ₹${emiAmount.toFixed(2)}`);
  console.log(`\n   Open at: http://localhost:3000/app/loans/${loan.id}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
