import '../../test/setup.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database.js';
import { jobsRepo } from './jobs.js';

beforeEach(() => {
  db.prepare(`DELETE FROM job_queue`).run();
});

describe('jobsRepo', () => {
  it('enqueue + findById round-trips', () => {
    const job = jobsRepo.enqueue({ kind: 'test.x', payload: { hello: 'world' } });
    const found = jobsRepo.findById(job.id);
    expect(found?.kind).toBe('test.x');
    expect(jobsRepo.parsePayload(found!)).toEqual({ hello: 'world' });
    expect(found?.status).toBe('pending');
    expect(found?.attempts).toBe(0);
  });

  it('claimNext returns the oldest pending job and bumps attempts', () => {
    jobsRepo.enqueue({ kind: 'a' });
    jobsRepo.enqueue({ kind: 'b' });
    const j1 = jobsRepo.claimNext('worker-1');
    expect(j1?.kind).toBe('a');
    expect(j1?.attempts).toBe(1);
    expect(j1?.status).toBe('running');
    const j2 = jobsRepo.claimNext('worker-1');
    expect(j2?.kind).toBe('b');
  });

  it('claimNext returns undefined when queue empty', () => {
    expect(jobsRepo.claimNext('w')).toBeUndefined();
  });

  it('two workers do not double-claim the same job', () => {
    jobsRepo.enqueue({ kind: 'x' });
    const a = jobsRepo.claimNext('worker-1');
    const b = jobsRepo.claimNext('worker-2');
    expect(a).toBeDefined();
    expect(b).toBeUndefined();   // already claimed
  });

  it('markSucceeded transitions to succeeded', () => {
    const job = jobsRepo.enqueue({ kind: 'x' });
    jobsRepo.claimNext('w');
    jobsRepo.markSucceeded(job.id, { score: 42 });
    const after = jobsRepo.findById(job.id);
    expect(after?.status).toBe('succeeded');
    expect(after?.finished_at).not.toBeNull();
  });

  it('markFailed retries with backoff while attempts < max_attempts', () => {
    const job = jobsRepo.enqueue({ kind: 'x', maxAttempts: 3 });
    jobsRepo.claimNext('w');   // attempts -> 1
    jobsRepo.markFailed(job.id, 'transient');
    const after = jobsRepo.findById(job.id)!;
    expect(after.status).toBe('pending');
    expect(after.last_error).toBe('transient');
    // run_at advanced into the future
    expect(new Date(after.run_at + 'Z').getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('markFailed marks dead after max_attempts', () => {
    const job = jobsRepo.enqueue({ kind: 'x', maxAttempts: 2 });
    jobsRepo.claimNext('w');               // attempts=1
    jobsRepo.markFailed(job.id, 'e1');
    // Manually flip back to pending (since markFailed put it pending again)
    db.prepare(`UPDATE job_queue SET status='pending', run_at=datetime('now') WHERE id=?`).run(job.id);
    jobsRepo.claimNext('w');               // attempts=2
    jobsRepo.markFailed(job.id, 'e2');
    const after = jobsRepo.findById(job.id)!;
    expect(after.status).toBe('dead');
  });

  it('reclaimStuck rescues jobs whose worker died', () => {
    const job = jobsRepo.enqueue({ kind: 'x' });
    jobsRepo.claimNext('worker-dead');
    // Force locked_at to be in the past
    db.prepare(`UPDATE job_queue SET locked_at = datetime('now','-10 minutes') WHERE id = ?`).run(job.id);
    const reclaimed = jobsRepo.reclaimStuck();
    expect(reclaimed).toBe(1);
    const after = jobsRepo.findById(job.id)!;
    expect(after.status).toBe('pending');
    expect(after.locked_at).toBeNull();
  });

  it('stats counts by status', () => {
    jobsRepo.enqueue({ kind: 'a' });
    jobsRepo.enqueue({ kind: 'a' });
    jobsRepo.markSucceeded(jobsRepo.claimNext('w')!.id);
    const stats = jobsRepo.stats();
    expect(stats.running).toBe(0);
    expect(stats.succeeded).toBe(1);
    expect(stats.pending).toBe(1);
  });
});
