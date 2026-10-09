// Idempotent seed: creates or updates the reviewer accounts (create-or-update by email)
// gives every account the verified book exercise, and gives the demo account sample history.
// Sign-up is disabled, so accounts are written through Better Auth's internal adapter,
// with passwords hashed by Better Auth itself so sign-in can verify them.
import { readFileSync } from "node:fs";
import { listPlayableWrittenMidis, normalizeMusicXml } from "../src/shared/musicxml";
import { generateSampleAttempts } from "../src/shared/sampleHistory";
import { auth } from "../src/server/auth";
import { prisma } from "../src/server/db";
import { BOOK_EXERCISE, DEMO_EMAIL, SAMPLE_WEAK_PAIRS, SEED_ACCOUNTS } from "./seedAccounts";

type AuthContext = Awaited<typeof auth.$context>;

function readSeedPassword(): string {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD is not set (see .env.example)");
  }
  return password;
}

async function upsertAccount(ctx: AuthContext, email: string, name: string, passwordHash: string): Promise<string> {
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
  return user.id;
}

/** Create-or-update by (user, seed source, name), so re-seeding refreshes the MusicXML. */
async function upsertBookExercise(userId: string, musicXml: string): Promise<string> {
  const existing = await prisma.exercise.findFirst({
    where: { userId, source: "seed", name: BOOK_EXERCISE.name },
    select: { id: true },
  });
  if (existing) {
    await prisma.exercise.update({ where: { id: existing.id }, data: { musicXml } });
    return existing.id;
  }
  const created = await prisma.exercise.create({ data: { userId, name: BOOK_EXERCISE.name, source: "seed", musicXml } });
  return created.id;
}

/** Replaces the demo account's sample attempts (only rows flagged sample), so re-seeding stays idempotent. */
async function replaceSampleHistory(userId: string, exerciseId: string, musicXml: string) {
  const sampleAttempts = generateSampleAttempts(listPlayableWrittenMidis(musicXml), {
    weakPairs: SAMPLE_WEAK_PAIRS,
    attemptCount: 6,
    seed: 42,
    now: new Date(),
  });
  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { userId, sample: true } }),
    ...sampleAttempts.map(({ startedAt, finishedAt, noteEvents }) =>
      prisma.attempt.create({
        data: { userId, exerciseId, startedAt, finishedAt, completed: true, sample: true, noteEvents: { createMany: { data: noteEvents } } },
      }),
    ),
  ]);
}

async function main() {
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(readSeedPassword());
  const bookMusicXml = normalizeMusicXml(readFileSync(BOOK_EXERCISE.path, "utf8"));
  for (const { email, name } of SEED_ACCOUNTS) {
    const userId = await upsertAccount(ctx, email, name, passwordHash);
    const bookExerciseId = await upsertBookExercise(userId, bookMusicXml);
    if (email === DEMO_EMAIL) await replaceSampleHistory(userId, bookExerciseId, bookMusicXml);
    console.log(`Seeded ${email}`);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
