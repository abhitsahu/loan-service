'use client';

import { useState, FormEvent } from 'react';
import { loanClient } from '@/app/api/client/loan-client';

interface Props {
  loanId: string;
  onSuccess: () => void;
}

export function PaymentForm({ loanId, onSuccess }: Props) {
  const [amount, setAmount]         = useState('');
  const [paymentDate, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference]    = useState('');
  const [busy, setBusy]              = useState(false);
  const [error, setError]            = useState('');
  const [success, setSuccess]        = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    try {
      const res = await loanClient.recordPayment(loanId, {
        amount,
        paymentDate,
        reference: reference || undefined,
      });

      if (!res.success) {
        setError(
          res.error.details?.map((d) => `${d.field}: ${d.message}`).join(', ') ??
          res.error.message,
        );
      } else {
        const allocated = parseFloat(res.data.payment.allocatedAmount);
        const unalloc   = parseFloat(res.data.payment.unallocatedAmount);
        setSuccess(
          `Payment recorded. Allocated: ₹${allocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` +
          (unalloc > 0 ? ` | Unallocated surplus: ₹${unalloc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''),
        );
        setAmount('');
        setReference('');
        onSuccess();
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Unexpected error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="payment-form">
      <h3 style={{ marginBottom: '1.25rem' }}>Record Payment</h3>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <span>⚠</span> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <span>✓</span> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pay-amount">Amount (₹)</label>
            <input
              id="pay-amount"
              type="text"
              className="form-input mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 9985.99"
              required
              pattern="^\d+(\.\d{1,2})?$"
              title="Numeric value with up to 2 decimal places"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pay-date">Payment Date</label>
            <input
              id="pay-date"
              type="date"
              className="form-input"
              value={paymentDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="pay-ref">Reference (optional)</label>
          <input
            id="pay-ref"
            type="text"
            className="form-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. UPI/1234"
          />
        </div>

        <button
          id="btn-record-payment"
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ alignSelf: 'flex-start', minWidth: '160px' }}
        >
          {busy
            ? <><span className="spinner" style={{ width: '1rem', height: '1rem' }} /> Processing…</>
            : '↑ Record Payment'}
        </button>
      </form>
    </div>
  );
}
