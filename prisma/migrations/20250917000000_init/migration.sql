-- ---------- extensions ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types are NOT defined in the DB.
-- Valid values are enforced by CHECK constraints below.
-- App-layer source of truth: src/app/api/model/enums/

-- ---------- loans ----------
CREATE TABLE loans (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    principal             NUMERIC(14,2) NOT NULL,
    annual_interest_rate  NUMERIC(6,4)  NOT NULL,
    tenure_months         INTEGER       NOT NULL,
    disbursement_date     DATE          NOT NULL,
    emi_amount            NUMERIC(14,2) NOT NULL,
    total_interest        NUMERIC(14,2) NOT NULL,
    total_payable         NUMERIC(14,2) NOT NULL,
    status                TEXT          NOT NULL DEFAULT 'ACTIVE',
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT loans_status_valid            CHECK (status IN ('ACTIVE', 'CLOSED')),
    CONSTRAINT loans_principal_positive      CHECK (principal > 0),
    CONSTRAINT loans_principal_in_range      CHECK (principal BETWEEN 50000 AND 1000000),
    CONSTRAINT loans_rate_non_negative       CHECK (annual_interest_rate >= 0 AND annual_interest_rate < 100),
    CONSTRAINT loans_tenure_in_range         CHECK (tenure_months BETWEEN 3 AND 36),
    CONSTRAINT loans_emi_positive            CHECK (emi_amount > 0),
    CONSTRAINT loans_totals_non_negative     CHECK (total_interest >= 0 AND total_payable > 0),
    CONSTRAINT loans_totals_consistent       CHECK (total_payable = principal + total_interest)
);

-- ---------- installments ----------
CREATE TABLE installments (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id             UUID          NOT NULL,
    installment_number  INTEGER       NOT NULL,
    due_date            DATE          NOT NULL,
    opening_balance     NUMERIC(14,2) NOT NULL,
    principal_component NUMERIC(14,2) NOT NULL,
    interest_component  NUMERIC(14,2) NOT NULL,
    total_due           NUMERIC(14,2) NOT NULL,
    closing_balance     NUMERIC(14,2) NOT NULL,
    principal_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,
    interest_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_paid         NUMERIC(14,2) NOT NULL DEFAULT 0,
    status              TEXT          NOT NULL DEFAULT 'PENDING',
    settled_on          DATE          NULL,

    CONSTRAINT installments_loan_fk
        FOREIGN KEY (loan_id) REFERENCES loans(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT installments_status_valid      CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID')),
    CONSTRAINT installments_unique_seq        UNIQUE (loan_id, installment_number),
    CONSTRAINT installments_number_positive   CHECK (installment_number >= 1),
    CONSTRAINT installments_components_nonneg
        CHECK (principal_component >= 0 AND interest_component >= 0),
    CONSTRAINT installments_total_consistent
        CHECK (total_due = principal_component + interest_component),
    CONSTRAINT installments_paid_consistent
        CHECK (amount_paid = principal_paid + interest_paid),
    CONSTRAINT installments_no_overpay
        CHECK (principal_paid <= principal_component
           AND interest_paid  <= interest_component),
    CONSTRAINT installments_status_matches_amount CHECK (
        (status = 'PENDING'        AND amount_paid = 0)
     OR (status = 'PARTIALLY_PAID' AND amount_paid > 0 AND amount_paid < total_due)
     OR (status = 'PAID'           AND amount_paid = total_due)
    ),
    CONSTRAINT installments_settled_on_iff_paid
        CHECK ((status = 'PAID') = (settled_on IS NOT NULL))
);

-- ---------- payments ----------
CREATE TABLE payments (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id             UUID          NOT NULL,
    amount              NUMERIC(14,2) NOT NULL,
    payment_date        DATE          NOT NULL,
    idempotency_key     TEXT          NOT NULL,
    allocated_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    unallocated_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT payments_loan_fk
        FOREIGN KEY (loan_id) REFERENCES loans(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT payments_amount_positive    CHECK (amount > 0),
    CONSTRAINT payments_split_consistent   CHECK (allocated_amount + unallocated_amount = amount),
    CONSTRAINT payments_split_nonneg       CHECK (allocated_amount >= 0 AND unallocated_amount >= 0),
    CONSTRAINT payments_idempotency_unique UNIQUE (loan_id, idempotency_key)
);

-- ---------- payment_allocations ----------
CREATE TABLE payment_allocations (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id     UUID          NOT NULL,
    installment_id UUID          NOT NULL,
    component      TEXT          NOT NULL,
    amount         NUMERIC(14,2) NOT NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT alloc_payment_fk
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    CONSTRAINT alloc_installment_fk
        FOREIGN KEY (installment_id) REFERENCES installments(id) ON DELETE CASCADE,

    CONSTRAINT alloc_component_valid  CHECK (component IN ('INTEREST', 'PRINCIPAL')),
    CONSTRAINT alloc_amount_positive  CHECK (amount > 0),
    CONSTRAINT alloc_unique_leg       UNIQUE (payment_id, installment_id, component)
);

-- ---------- indexes ----------
CREATE INDEX idx_installments_loan_due
    ON installments (loan_id, due_date, installment_number);

CREATE INDEX idx_installments_open_by_loan
    ON installments (loan_id, installment_number)
    WHERE status <> 'PAID';

CREATE INDEX idx_payments_loan_date
    ON payments (loan_id, payment_date DESC, created_at DESC);

CREATE INDEX idx_alloc_installment
    ON payment_allocations (installment_id);

CREATE INDEX idx_alloc_payment
    ON payment_allocations (payment_id);
