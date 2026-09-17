/**
 * @swagger
 * /loans/{loanId}:
 *   get:
 *     summary: Get a loan
 *     description: >
 *       Returns the full repayment schedule (per-installment breakdown),
 *       current loan position (outstanding principal, overdue amount, next due),
 *       and payment history. Pass ?asOf=YYYY-MM-DD to compute position at a past date.
 *     tags: [Loans]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: loanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: asOf
 *         in: query
 *         required: false
 *         description: Compute position as of this date (defaults to today).
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Loan detail
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
 *                     loan:
 *                       $ref: '#/components/schemas/LoanDetail'
 *                     schedule:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InstallmentRow'
 *                     position:
 *                       $ref: '#/components/schemas/LoanPosition'
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PaymentRecord'
 *       401:
 *         $ref: '#/components/responses/Unauthenticated'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
