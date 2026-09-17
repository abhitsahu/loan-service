import { Prisma } from '@prisma/client';

/** Shorthand constructor — accepts string | number | Decimal */
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Round to 2 decimal places, HALF_UP (banker-safe for monetary values) */
export const round2 = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Serialise to JSON — always produces exactly 2 dp, e.g. "9985.99" */
export const toApi = (v: Prisma.Decimal): string => v.toFixed(2);

/** min of two Decimals */
export const minD = (a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal =>
  a.lessThan(b) ? a : b;

/** max of two Decimals */
export const maxD = (a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal =>
  a.greaterThan(b) ? a : b;

export const isZero = (v: Prisma.Decimal): boolean => v.isZero();

export const ZERO = D(0);
