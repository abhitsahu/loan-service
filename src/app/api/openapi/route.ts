import { NextResponse } from 'next/server';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Loan Repayment Service',
      version: '1.0.0',
      description: 'REST API for MSME lending — creates loans, generates repayment schedules, and records payments with full allocation tracking.',
    },
    servers: [{ url: '/api', description: 'Local dev' }],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token. Obtain via `firebase.auth().currentUser.getIdToken()`.',
        },
      },
      responses: {
        Unauthenticated: { description: 'Unauthenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        NotFound:        { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        ValidationError: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'object', properties: { code: { type: 'string', example: 'LOAN_NOT_FOUND' }, message: { type: 'string' } } },
          },
        },
        LoanSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['ACTIVE', 'CLOSED'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        LoanDetail: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            principal: { type: 'string', example: '200000.00' },
            annualInterestRate: { type: 'string', example: '18.00' },
            tenureMonths: { type: 'integer', example: 24 },
            disbursementDate: { type: 'string', format: 'date', example: '2025-09-01' },
            emiAmount: { type: 'string', example: '9984.82' },
            totalInterest: { type: 'string', example: '39635.69' },
            totalPayable: { type: 'string', example: '239635.69' },
            status: { type: 'string', enum: ['ACTIVE', 'CLOSED'] },
          },
        },
        InstallmentRow: {
          type: 'object',
          properties: {
            installmentNumber: { type: 'integer', example: 1 },
            dueDate: { type: 'string', format: 'date', example: '2025-10-01' },
            openingBalance: { type: 'string', example: '200000.00' },
            principalComponent: { type: 'string', example: '6984.82' },
            interestComponent: { type: 'string', example: '3000.00' },
            totalDue: { type: 'string', example: '9984.82' },
            amountPaid: { type: 'string', example: '0.00' },
            remainingDue: { type: 'string', example: '9984.82' },
            closingBalance: { type: 'string', example: '193015.18' },
            status: { type: 'string', enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'] },
            settledOn: { type: 'string', format: 'date', nullable: true },
            isOverdue: { type: 'boolean', example: true },
            daysPastDue: { type: 'integer', example: 351 },
          },
        },
        LoanPosition: {
          type: 'object',
          properties: {
            outstandingPrincipal: { type: 'string', example: '200000.00' },
            outstandingTotal: { type: 'string', example: '239635.69' },
            totalPaid: { type: 'string', example: '0.00' },
            nextDueDate: { type: 'string', format: 'date', nullable: true, example: '2025-10-01' },
            nextDueAmount: { type: 'string', nullable: true, example: '9984.82' },
            overdueAmount: { type: 'string', example: '119817.84' },
            overdueInstallmentCount: { type: 'integer', example: 12 },
            daysPastDue: { type: 'integer', example: 351 },
            asOf: { type: 'string', format: 'date', example: '2026-09-17' },
          },
        },
        PaymentRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            loanId: { type: 'string', format: 'uuid' },
            amount: { type: 'string', example: '9984.82' },
            paymentDate: { type: 'string', format: 'date', example: '2026-09-17' },
            allocatedAmount: { type: 'string', example: '9984.82' },
            unallocatedAmount: { type: 'string', example: '0.00' },
          },
        },
        AllocationLine: {
          type: 'object',
          properties: {
            installmentNumber: { type: 'integer', example: 1 },
            component: { type: 'string', enum: ['INTEREST', 'PRINCIPAL'] },
            amount: { type: 'string', example: '3000.00' },
          },
        },
      },
    },
  },
  // Scans all route.docs.ts files for @swagger annotations
  apis: [
    path.join(process.cwd(), 'src/app/api/(controller)/**/*.docs.ts'),
  ],
};

const spec = swaggerJsdoc(options);

export function GET() {
  return NextResponse.json(spec);
}
