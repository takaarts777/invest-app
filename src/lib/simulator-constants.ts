// Split out from simulator.ts (which is "server-only") so client
// components can import this constant without pulling the server-only
// business logic — and its Prisma/market.ts dependency chain — into the
// browser bundle.
export const STARTING_CASH_JPY = 500_000;
