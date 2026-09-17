/**
 * @swagger
 * /loans/{loanId}/payments:
 *   post:
 *     summary: Record a payment
 *     description: >
 *       Allocates a payment against the loan's open installments.
 *       Allocation order: oldest-due-first, interest before principal (FIFO + interest-priority).
 *       Underpayment: partially settles the oldest open installment; status becomes PARTIALLY_PAID.
 *       Overpayment: cascades forward across installments; any remainder beyond all open installments
 *       is stored as unallocatedAmount (surplus) on the payment.
 *       Duplicate protection: two-layer idempotency — explicit Idempotency-Key header takes priority;
 *       otherwise a SHA-256 fingerprint of loanId|amount|paymentDate|reference is derived automatically.
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: loanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: Idempotency-Key
 *         in: header
 *         required: false
 *         description: Client-supplied idempotency key. If omitted, one is derived from the request body.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, paymentDate]
 *             properties:
 *               amount:
 *                 type: string
 *                 description: Payment amount in INR (must be > 0, max 2 decimal places).
 *                 example: "9984.82"
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 description: Logical date the payment occurred (YYYY-MM-DD). Used for overdue calculation.
 *                 example: "2026-09-17"
 *               reference:
 *                 type: string
 *                 description: Optional payment reference (e.g. UPI transaction ID).
 *                 example: "UPI/2212"
 *           example:
 *             amount: "9984.82"
 *             paymentDate: "2026-09-17"
 *             reference: "UPI/2212"
 *     responses:
 *       201:
 *         description: Payment recorded and allocated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payment:
 *                       $ref: '#/components/schemas/PaymentRecord'
 *                     allocations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AllocationLine'
 *                     position:
 *                       $ref: '#/components/schemas/LoanPosition'
 *       401:
 *         $ref: '#/components/responses/Unauthenticated'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Loan already closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
