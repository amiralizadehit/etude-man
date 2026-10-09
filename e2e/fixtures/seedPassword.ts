/** Password of the seeded accounts (see .env.example). */
export function seedPassword(): string {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD is not set (see .env.example)");
  return password;
}
