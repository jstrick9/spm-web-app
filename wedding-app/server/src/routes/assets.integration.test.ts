import '../test/setup.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { assetsRepo } from '../db/repos/assets.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { try { db.prepare('DELETE FROM asset_capabilities').run(); db.prepare('DELETE FROM assets').run(); } catch {} });
async function register(label:string) { const r=await app.inject({ method:'POST',url:'/api/auth/register',payload:{email:`asset-${label}-${Math.random().toString(36).slice(2)}@x.test`,password:'testpass123',fullName:label,orgName:`${label} org`},headers:{'content-type':'application/json'} }); return { token:r.json().token as string, orgId:r.json().organizationId as string }; }

describe('asset delivery authorization', () => {
  it('denies a different organization and permits the owning organization', async () => {
    const owner=await register('owner'), outsider=await register('outsider');
    const asset=assetsRepo.create({organization_id:owner.orgId,event_id:null,owner_type:'couple_document',owner_id:'doc-a',storage_key:'https://example.com/legacy.pdf',original_filename:'legacy.pdf',mime_type:'application/pdf',visibility:'private',publish_status:'draft',created_by:null});
    const denied=await app.inject({method:'GET',url:`/api/assets/${asset.id}/content`,headers:{authorization:`Bearer ${outsider.token}`}});
    expect(denied.statusCode).toBe(403);
    const allowed=await app.inject({method:'GET',url:`/api/assets/${asset.id}/content`,headers:{authorization:`Bearer ${owner.token}`}});
    expect(allowed.statusCode).toBe(302);
  });
  it('requires a valid, unexpired capability for a non-public asset', async () => {
    const owner=await register('capability');
    const asset=assetsRepo.create({organization_id:owner.orgId,event_id:null,owner_type:'vendor_coi',owner_id:'vendor-a',storage_key:'https://example.com/coi.pdf',original_filename:'coi.pdf',mime_type:'application/pdf',visibility:'capability',publish_status:'approved',created_by:null});
    expect((await app.inject({method:'GET',url:`/api/public/assets/${asset.id}/content`})).statusCode).toBe(401);
    const issued=assetsRepo.issueCapability(asset.id,'vendor','2999-01-01T00:00:00.000Z');
    expect((await app.inject({method:'GET',url:`/api/public/assets/${asset.id}/content?token=${issued.token}`})).statusCode).toBe(302);
    assetsRepo.revokeCapability(issued.row.id);
    expect((await app.inject({method:'GET',url:`/api/public/assets/${asset.id}/content?token=${issued.token}`})).statusCode).toBe(401);
  });
});
