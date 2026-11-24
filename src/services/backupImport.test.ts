import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock minimal browser localStorage in Node test runtime
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
};

import { db } from './db.ts';
import {
  AI_CHAT_AND_PARSER_MODELS,
  GOOGLE_GEMINI_SPECIALIZED_MODELS,
  resolveAllowedAiModel,
} from '../constants/aiModels.ts';

const BACKUP_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/ak_finance_backup_2026-11-24_20-07-33_44c11e10.json'
);

test('Inspect real 405-record backup JSON reports accurate Sent, Local Unsent, and Server Ignored counts', () => {
  const raw = fs.readFileSync(BACKUP_PATH, 'utf8');
  const inspection = db.inspectBackupJson(raw);

  assert.equal(inspection.valid, true);
  assert.equal(inspection.version, 4);
  assert.equal(inspection.paymentsCount, 405);
  assert.equal(inspection.sentCount, 370);
  assert.equal(inspection.localCount, 35);
  assert.equal(inspection.serverIgnoredCount, 33);
});

test('Import real backup JSON places all 405 records into exact original stores and NEVER auto-enables server mode', async () => {
  store.clear();
  const raw = fs.readFileSync(BACKUP_PATH, 'utf8');
  const res = await db.importFullBackupJson(raw, 'merge');

  assert.equal(res.success, true);
  assert.equal(res.count, 405);
  assert.equal(res.localCount, 35);

  // Settings: preserves webhook URL, forces mode='local' so imported records are NEVER auto-synced
  const settings = await db.getSettings();
  assert.equal(settings.mode, 'local');
  assert.equal(settings.serverUrl, 'https://verifi-server-milr.onrender.com/webhook/sms');

  // All 405 payments restored (including 2 hidden via overrides: #2 and #3)
  const allIncludingHidden = await db.getAllPayments(true);
  assert.equal(allIncludingHidden.length, 405);

  const localUnsynced = allIncludingHidden.filter(p => p.syncStatus === 'local');
  assert.equal(localUnsynced.length, 35);

  const visiblePayments = await db.getAllPayments(false);
  assert.equal(visiblePayments.length, 403);

  // Exact override preserved (#31 -> Nebiyu Mohammed, #2/#3 hidden)
  const rec31 = allIncludingHidden.find(p => p.id === '31');
  assert.equal(rec31?.counterparty, 'Nebiyu Mohammed');
  assert.equal(allIncludingHidden.find(p => p.id === '2')?.isHidden, true);
  assert.equal(allIncludingHidden.find(p => p.id === '3')?.isHidden, true);

  // Identical text messages at different timestamps (#236 and #237) both preserved
  assert.ok(allIncludingHidden.some(p => p.id === '236'));
  assert.ok(allIncludingHidden.some(p => p.id === '237'));

  // Opening balances restored
  const opening = await db.getOpeningBalances();
  assert.equal(opening.Telebirr, 2020.06);
  assert.equal(opening.CBE, 300);

  // Replace mode clears cleanly and restores exact 405 again
  const replaceRes = await db.importFullBackupJson(raw, 'replace');
  assert.equal(replaceRes.success, true);
  assert.equal(replaceRes.count, 405);
  assert.equal((await db.getAllPayments(true)).length, 405);
});

test('AI model registry exposes active Google & Gemini models and zero deprecated 1.5/2.0 IDs', () => {
  const allIds = [
    ...AI_CHAT_AND_PARSER_MODELS.map(m => m.id),
    ...GOOGLE_GEMINI_SPECIALIZED_MODELS.map(m => m.id),
  ];
  assert.ok(allIds.length >= 20);
  for (const id of allIds) {
    assert.ok(!/gemini-(1\.5|2\.0)-/i.test(id), `Deprecated model found: ${id}`);
  }
  assert.equal(resolveAllowedAiModel('gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(resolveAllowedAiModel('gemini-4-neon'), 'gemini-4-neon');
  assert.equal(resolveAllowedAiModel('gemini-1.5-pro'), 'gemini-4-hydrogen');
});
