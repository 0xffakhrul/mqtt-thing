import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/passwords.js';

describe('passwords', () => {
  it('never stores the password itself', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).not.toContain('hunter2');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('hunter2', hash)).toBe(true);
    expect(await verifyPassword('hunter3', hash)).toBe(false);
  });

  it('salts every hash, so the same password hashes differently', async () => {
    expect(await hashPassword('hunter2')).not.toBe(await hashPassword('hunter2'));
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('hunter2', 'not-a-hash')).toBe(false);
  });
});
