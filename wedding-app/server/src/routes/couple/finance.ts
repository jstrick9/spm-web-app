import { auditRepo, contractsRepo, coupleRequestsRepo, eventsRepo, paymentLinksRepo } from '../../db/repos/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { canWriteCoupleData, changeOrderSchema, coupleContractSignSchema, financeQuestionSchema, parseEventMetadata, safeContract, safePayment, safeRequest } from './shared.js';
import { broadcastSSE } from '../sse.js';

export async function coupleFinanceRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-finance', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const contracts = contractsRepo.listForEvent(eventId).map(safeContract);
    const payments = paymentLinksRepo.listForEvent(eventId).map(safePayment);
    const totalContracted = contracts.reduce((sum, c) => sum + (c.amountCents || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amountCents, 0);
    const paid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amountCents, 0);
    const pending = payments.filter((p) => ['pending', 'processing'].includes(p.status)).reduce((sum, p) => sum + p.amountCents, 0);
    const openBalance = Math.max(0, Math.max(totalContracted, totalPayments) - paid);
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest).filter((r) => ['finance_question', 'change_order_request'].includes(r.requestType));
    // MODULE-06 FI-13: no audit row per read — this endpoint is polled by the
    // couple hub and per-GET audits would flood audit_logs with view noise.
    // (Mutations — sign, questions, change orders — remain audited.)
    return {
      contracts,
      payments,
      totals: { contractedCents: totalContracted, scheduledPaymentCents: totalPayments, paidCents: paid, pendingCents: pending, openBalanceCents: openBalance },
      refundCancellationPolicy: metadata.refundCancellationPolicy || metadata.cancellationPolicy || 'Ask the venue to confirm cancellation/refund policy for your agreement.',
      paymentScheduleExplanation: 'This is a client-safe schedule from venue-created invoices/payment links. Internal budgets, vendor margins, revenue forecasts, and owner finance notes are hidden.',
      hiddenFields: ['Internal venue budget', 'Vendor margins', 'Revenue forecast', 'Owner finance notes', 'Internal payment reconciliation notes'],
      changeOrders: requests.filter((r) => r.requestType === 'change_order_request'),
      questions: requests.filter((r) => r.requestType === 'finance_question'),
      paymentMethodVault: { status: 'not_configured', note: 'Payment method vaulting requires a connected payment provider and venue policy approval.' },
    };
  });

  app.post('/api/events/:eventId/couple-finance/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = financeQuestionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'finance_question', note: parsed.data.question, metadata: { sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, source: 'couple_finance_center' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-finance/change-order', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = changeOrderSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'change_order_request', note: parsed.data.note, metadata: { changeType: parsed.data.changeType, label: parsed.data.label, estimatedAmountCents: parsed.data.estimatedAmountCents, source: 'couple_finance_center' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-finance/contracts/:contractId/sign', { preHandler: requireAuth }, async (req) => {
    const { eventId, contractId } = req.params as { eventId: string; contractId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const contract = contractsRepo.findById(contractId);
    if (!contract || contract.event_id !== eventId) throw NotFound('contract-not-found');
    const parsed = coupleContractSignSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // MODULE-06 FI-09: an e-signature is evidentiary — never overwrite one.
    if (contract.status === 'signed') throw BadRequest('contract-already-signed');
    const updated = contractsRepo.update(contractId, { status: 'signed', signedAt: new Date().toISOString(), signature: parsed.data.signature, signerIp: req.ip });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.contract.sign', targetType: 'contract', targetId: contractId, ip: req.ip });
    // MODULE-06 FI-07: the venue must see the signature land in real time.
    broadcastSSE(event.organization_id, 'contract.signed', { eventId, contractId, signer: parsed.data.signature }, req.auth!.userId);
    return { contract: updated ? safeContract(updated) : null };
  });

  app.get('/api/events/:eventId/couple-finance/packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const contracts = contractsRepo.listForEvent(eventId).map(safeContract);
    const payments = paymentLinksRepo.listForEvent(eventId).map(safePayment);
    const text = [`${event.title} — Contract & Payment Packet`, '', 'Contracts:', ...contracts.map((c) => `- ${c.title}: ${c.status}${c.signedAt ? ` signed ${c.signedAt}` : ''}`), '', 'Payments / receipts:', ...payments.map((p) => `- ${p.label}: ${p.status} ${p.amountCents / 100} due ${p.dueDate || 'TBD'}${p.paidAt ? ` paid ${p.paidAt}` : ''}`)].join('\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="couple_contract_payment_packet_${eventId}.txt"`);
    return reply.send(text);
  });

}
