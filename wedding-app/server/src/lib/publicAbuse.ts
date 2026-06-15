import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { auditRepo } from '../db/repos/audit.js';
import { BadRequest } from './errors.js';

const HONEYPOT_FIELDS = ['website', 'company', 'url', 'hp', '_hp', '_gotcha', 'confirmEmail'];


export function publicRequestFingerprint(req: FastifyRequest) {
  const raw = [req.ip || '', req.headers['user-agent'] || '', req.headers['accept-language'] || ''].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function hasFilledHoneypot(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  for (const field of HONEYPOT_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.trim().length > 0) return field;
    if (value != null && typeof value !== 'string') return field;
  }
  return null;
}

export function assertNoPublicHoneypot(req: FastifyRequest, input: {
  organizationId?: string;
  action: string;
  targetType: string;
  targetId?: string;
}) {
  const field = hasFilledHoneypot(req.body);
  if (!field) return;
  auditRepo.log({
    organizationId: input.organizationId,
    action: `public.abuse.${input.action}`,
    targetType: input.targetType,
    targetId: input.targetId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    details: { reason: 'honeypot-filled', field, deviceSession: publicRequestFingerprint(req) },
  });
  throw BadRequest('spam-detected');
}

export function auditPublicSubmission(req: FastifyRequest, input: {
  organizationId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  auditRepo.log({
    organizationId: input.organizationId,
    action: `public.${input.action}`,
    targetType: input.targetType,
    targetId: input.targetId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    details: { ...(input.details || {}), deviceSession: publicRequestFingerprint(req) },
  });
}
