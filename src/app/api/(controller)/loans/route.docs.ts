/**
 * @swagger
 * /loans:
 *   get:
 *     summary: List loans
 *     description: Returns all loans ordered by creation date (newest first).
 *     tags: [Loans]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of loans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LoanSummary'
 *       401:
 *         $ref: '#/components/responses/Unauthenticated'
 *   post:
 *     summary: Create a loan
 *     description: >
 *       Creates a new loan and generates the full EMI repayment schedule.
 *       Formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1).
 *       Money is stored as NUMERIC(20,6) in PostgreSQL — never float.
 *     tags: [Loans]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [principal, annualInterestRate, tenureMonths, disbursementDate]
 *             properties:
 *               principal:
 *                 type: string
 *                 description: Loan principal in INR (₹50,000–₹10,00,000).
 *                 example: "200000"
 *               annualInterestRate:
 *                 type: string
 *                 description: Annual interest rate (0–100).
 *                 example: "18"
 *               tenureMonths:
 *                 type: integer
 *                 description: Tenure in months (3–36).
 *                 example: 24
 *               disbursementDate:
 *                 type: string
 *                 format: date
 *                 description: Disbursement date. First EMI falls on the same day of the following month.
 *                 example: "2025-09-01"
 *           example:
 *             principal: "200000"
 *             annualInterestRate: "18"
 *             tenureMonths: 24
 *             disbursementDate: "2025-09-01"
 *     responses:
 *       201:
 *         description: Loan created with full schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/LoanDetail'
 *       401:
 *         $ref: '#/components/responses/Unauthenticated'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
