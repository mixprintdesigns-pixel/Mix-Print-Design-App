import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations).
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when the email is unknown so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("mixprint-dummy-password-0");
  return dummyHash;
}
