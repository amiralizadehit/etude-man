// Idempotent seed: creates or updates the reviewer accounts (create-or-update by email).
// Sign-up is disabled, so accounts are written through Better Auth's internal adapter,
// with passwords hashed by Better Auth itself so sign-in can verify them.
import { auth } from "../src/server/auth";
import { prisma } from "../src/server/db";
import { SEED_ACCOUNTS } from "./seedAccounts";

type AuthContext = Awaited<typeof auth.$context>;

function readSeedPassword(): string {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD is not set (see .env.example)");
  }
  return password;
}

async function upsertAccount(ctx: AuthContext, email: string, name: string, passwordHash: string) {
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  const user =
    existing?.user ??
    (await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "admin" }));

  if (await ctx.internalAdapter.findCredentialAccount(user.id)) {
    await ctx.internalAdapter.updatePassword(user.id, passwordHash);
  } else {
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    });
  }
}

async function main() {
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(readSeedPassword());
  for (const { email, name } of SEED_ACCOUNTS) {
    await upsertAccount(ctx, email, name, passwordHash);
    console.log(`Seeded ${email}`);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
