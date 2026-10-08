import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.INTERNAL_API_KEY = "integration-internal-key";
process.env.JWT_SECRET = "integration-secret-with-at-least-32-bytes";
process.env.INSTITUTIONAL_MODE = "mock";
delete process.env.POSTGRES_HOST; delete process.env.KAFKA_BROKERS; delete process.env.REDIS_URL;
const servers: Server[] = [];
let auth: any, chat: any, catalog: any, audit: any;
let urls: { [key: string]: string } = {};
let adminToken = "", lastNlpText = "", nlpAvailable = true;
async function serve(app: any) {
  app.set("trust proxy", true);
  const server: Server = app.listen(0,"127.0.0.1"); servers.push(server);
  await new Promise<void>(resolve => server.on("listening",resolve));
  return "http://127.0.0.1:" + (server.address() as any).port;
}
const clientIps = new Map<string,string>();
let nextIp = 1;
async function request(base: string, url: string, method="GET", body?: any, token?: string) {
  const key = token ?? "registration-" + nextIp;
  if (!clientIps.has(key)) clientIps.set(key,"192.0.2." + nextIp++);
  const response = await fetch(base+url,{ method, signal: AbortSignal.timeout(4000), headers: { "content-type":"application/json", "x-forwarded-for":clientIps.get(key)!, ...(token ? { authorization:"Bearer "+token } : {}) }, ...(body!==undefined ? { body:JSON.stringify(body) } : {}) });
  const text=await response.text(); return { status:response.status, body:text ? JSON.parse(text) : undefined };
}
async function profile(granted=true) {
  const created = await request(urls.auth,"/api/v1/profiles","POST",{});
  expect(created.status).toBe(201);
  const user = { id:created.body.id, token:created.body.accessToken };
  if (granted) expect((await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents","POST",{purpose:"conversation_context",version:"1.0",granted:true},user.token)).status).toBe(201);
  return user;
}
async function conversation() {
  const user=await profile(), created=await request(urls.chat,"/api/v1/conversations","POST",{},user.token);
  expect(created.status).toBe(201); return {...user,conversationId:created.body.conversationId};
}
const send=(user:any,message:string)=>request(urls.chat,"/api/v1/conversations/"+user.conversationId+"/messages","POST",{message},user.token);
async function citizen(contact="ciudadano-demo@example.test") {
  const user=await profile();
  const challenge=await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact},user.token);
  expect(challenge.status).toBe(201);
  const verified=await request(urls.auth,"/api/v1/auth/otp/verify","POST",{challengeId:challenge.body.challengeId,code:challenge.body.demoCode},user.token);
  expect(verified.status).toBe(200); return {...user,citizenToken:verified.body.accessToken};
}
beforeAll(async()=>{
  audit=await import("../../services/audit-service/src/index.js"); urls.audit=await serve(audit.app); process.env.AUDIT_URL=urls.audit;
  auth=await import("../../services/auth-service/src/index.js"); await auth.initialized; urls.auth=await serve(auth.app); process.env.AUTH_URL=urls.auth;
  catalog=await import("../../services/catalog-service/src/index.js"); await catalog.initialized; urls.catalog=await serve(catalog.app); process.env.CATALOG_URL=urls.catalog;
  const recommendation=await import("../../services/recommendation-service/src/index.js"); urls.recommendation=await serve(recommendation.app); process.env.RECOMMENDATION_URL=urls.recommendation;
  const nlp=express(); nlp.use(express.json()); nlp.post("/api/v1/classify",(req,res)=>{
    if(!nlpAvailable) return res.status(503).json({});
    lastNlpText=req.body.text;
    const ambiguous=req.body.text.startsWith("ambiguo"), low=req.body.text.startsWith("baja");
    const intent=req.body.text.includes("radicado") ? "VERIFICACION_ESTADO" : "CONSULTA_INFORMATIVA";
    res.json({intent,confidence:ambiguous ? .3 : low ? .69 : .9,entities:{}});
  });
  process.env.NLP_URL=await serve(nlp);
  chat=await import("../../services/conversation-service/src/index.js"); urls.chat=await serve(chat.app); process.env.CONVERSATION_URL=urls.chat;
  const login=await request(urls.auth,"/api/v1/auth/login","POST",{email:"admin@ciudadano.gov.co",password:"AdminCiudadano2026!"}); expect(login.status).toBe(200); adminToken=login.body.accessToken;
});
afterAll(async()=>{ vi.restoreAllMocks(); await Promise.all(servers.map(server=>new Promise<void>(resolve=>{ server.close(()=>resolve()); server.closeAllConnections(); }))); });
describe("Word CP-01 to CP-14 and access control",()=>{
  it("CP-01 returns requirements, cost, time, dated official sources",async()=>{
    const user=await conversation(), result=await send(user,"duplicado cédula");
    expect(result.status).toBe(200); expect(result.body.response).toMatch(/Requisitos:[\s\S]*Costo:[\s\S]*Tiempo estimado:/);
    expect(result.body.sources[0]).toMatch(/^https:\/\//); expect(result.body.response).toMatch(/Fuente actualizada:/); expect(result.body.recommendations.length).toBeLessThanOrEqual(3);
  });
  it("CP-02 accepts Colombian expressions and accents",async()=>{ const user=await conversation(); expect((await send(user,"Necesito sacar el duplicado de mi cédula")).body.recommendations[0].id).toBe("cedula-duplicado"); });
  it("CP-03 clarifies when confidence is 0.69",async()=>{ const user=await conversation(), r=await send(user,"baja confianza"); expect(r.body.requiresClarification).toBe(true); expect(r.body.clarificationOptions).toHaveLength(2); });
  it("CP-04 refers after two unsuccessful clarifications",async()=>{ const user=await conversation(); await send(user,"ambiguo uno"); const r=await send(user,"ambiguo dos"); expect(r.body.requiresReferral).toBe(true); expect(r.body.response).toMatch(/dos intentos/); expect(r.body.sources).toContain("https://www.gov.co/"); });
  it("CP-05 follows the procedure from the preceding turn",async()=>{ const user=await conversation(); await send(user,"duplicado cédula"); const r=await send(user,"¿Cuánto cuesta?"); expect(r.body.recommendations[0].id).toBe("cedula-duplicado"); expect(lastNlpText).toContain("Duplicado"); });
  it("CP-06 anonymizes identifiers before NLP",async()=>{ const user=await conversation(); await send(user,"duplicado cédula 1012345678, +57 300 123 4567, persona@example.com"); expect(lastNlpText).not.toContain("1012345678"); expect(lastNlpText).not.toContain("persona@example.com"); expect(lastNlpText).not.toContain("300 123 4567"); });
  it("CP-07 does not create a conversation without consent",async()=>{ const user=await profile(false), r=await request(urls.chat,"/api/v1/conversations","POST",{},user.token); expect(r.status).toBe(403); expect(r.body.error.code).toBe("CONSENT_REQUIRED"); });
  it("CP-08 issues a 15-minute citizen token and consumes the code",async()=>{
    const user=await profile(), challenge=await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact:"otp-once@example.test"},user.token);
    const body={challengeId:challenge.body.challengeId,code:challenge.body.demoCode};
    const r=await request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token); expect(r.body.expiresIn).toBe(900);
    const claims=JSON.parse(Buffer.from(r.body.accessToken.split(".")[1],"base64url").toString()); expect(claims.exp-claims.iat).toBe(900);
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token)).status).toBe(401);
  });
  it("CP-09 blocks after three failures and cannot bypass by requesting another code",async()=>{
    const user=await profile(), contact="otp-lock@example.test", challenge=await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact},user.token);
    const body={challengeId:challenge.body.challengeId,code:challenge.body.demoCode==="000000"?"111111":"000000"};
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token)).status).toBe(401);
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token)).status).toBe(401);
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token)).status).toBe(429);
    expect((await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact},user.token)).status).toBe(429);
  });
  it("CP-10 reports institutional outages without partial state",async()=>{
    const user=await citizen(); process.env.MOCK_STATUS_UNAVAILABLE="true";
    try { const r=await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"DEMO-001"},user.citizenToken); expect(r.status).toBe(503); expect(r.body.state).toBeUndefined(); }
    finally { delete process.env.MOCK_STATUS_UNAVAILABLE; }
  });
  it("CP-11 refers an absent procedure to an official channel",async()=>{ const user=await conversation(), r=await send(user,"certificado marciano inexistente"); expect(r.body.requiresReferral).toBe(true); });
  it("CP-12 associates feedback with the assistant message",async()=>{
    const user=await conversation(), response=await send(user,"duplicado cédula");
    const r=await request(urls.chat,"/api/v1/conversations/"+user.conversationId+"/feedback","POST",{rating:"unhelpful",messageId:response.body.messageId,comment:"Error en los requisitos"},user.token); expect(r.status).toBe(202);
    const report=await chat.feedback.get(r.body.feedbackId); expect(report.messageId).toBe(response.body.messageId);
  });
  it("CP-13 expires sessions after fifteen minutes",async()=>{
    const user=await conversation(), session=await chat.sessions.get(user.conversationId);
    session.expiresAt=Date.now()-1; await chat.sessions.set(user.conversationId,session,-1);
    expect((await send(user,"duplicado cedula")).status).toBe(410); expect(await chat.sessions.get(user.conversationId)).toBeUndefined();
  });
  it("CP-14 exports real session data and a receipt",async()=>{
    const user=await conversation(); await send(user,"duplicado cédula");
    const r=await request(urls.auth,"/api/v1/profiles/"+user.id+"/export","GET",undefined,user.token);
    expect(r.status).toBe(200); expect(r.body.receiptId).toBeTruthy(); expect(r.body.conversations.sessions[0].messages).toHaveLength(2);
  });
  it("denies cross-citizen session and profile access",async()=>{ const user=await conversation(), other=await profile(); expect((await request(urls.chat,"/api/v1/conversations/"+user.conversationId,"GET",undefined,other.token)).status).toBe(403); expect((await request(urls.auth,"/api/v1/profiles/"+user.id+"/export","GET",undefined,other.token)).status).toBe(403); });
  it("revocation removes the context and prevents further processing",async()=>{ const user=await conversation(); await send(user,"duplicado cédula"); const r=await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents","POST",{purpose:"conversation_context",version:"1.0",granted:false},user.token); expect(r.status).toBe(201); expect(await chat.sessions.get(user.conversationId)).toBeUndefined(); });
  it("purges profile, sessions and feedback together",async()=>{ const user=await conversation(), response=await send(user,"duplicado cédula"); await request(urls.chat,"/api/v1/conversations/"+user.conversationId+"/feedback","POST",{rating:"unhelpful",messageId:response.body.messageId},user.token); const r=await request(urls.auth,"/api/v1/profiles/"+user.id+"/data","DELETE",undefined,user.token); expect(r.status).toBe(200); expect(r.body.receiptId).toBeTruthy(); expect((await request(urls.auth,"/api/v1/profiles/"+user.id,"GET",undefined,user.token)).status).toBe(404); expect(await chat.sessions.get(user.conversationId)).toBeUndefined(); expect((await chat.feedback.list()).some((x:any)=>x.value.profileId===user.id)).toBe(false); });
  it("denies requests of a different verified identity",async()=>{ const user=await citizen("other-citizen@example.test"); expect((await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"DEMO-001"},user.citizenToken)).status).toBe(403); });
  it("returns a clearly labeled simulated state for its owner",async()=>{ const user=await citizen(); const r=await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"DEMO-001"},user.citizenToken); expect(r.status).toBe(200); expect(r.body.simulated).toBe(true); expect(r.body.updatedAt).toBeTruthy(); });
  it("requires citizen authentication for status and admin authorization for writes",async()=>{ const user=await profile(); expect((await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"DEMO-001"},user.token)).status).toBe(403); expect((await request(urls.catalog,"/api/v1/procedures","POST",{},user.token)).status).toBe(403); expect((await request(urls.audit,"/api/v1/audit/events")).status).toBe(401); });
  it("creates, versions and deactivates a catalog entry",async()=>{
    const id="integration-"+randomUUID().slice(0,8), body={id,title:"Trámite de integración",entity:"Entidad de prueba",description:"Ficha de prueba de integración",requirements:["Documento"],steps:["Consultar"],channels:["Portal"],sourceUrls:["https://www.gov.co/"],verifiedAt:new Date().toISOString().slice(0,10),cost:"Gratuito en el escenario de prueba",estimatedTime:"Un día en el escenario de prueba",hours:"Horario de prueba"};
    expect((await request(urls.catalog,"/api/v1/procedures","POST",body,adminToken)).status).toBe(201);
    expect((await request(urls.catalog,"/api/v1/procedures/"+id,"PUT",{title:"Trámite modificado"},adminToken)).body.version).toBe(2);
    expect((await request(urls.catalog,"/api/v1/procedures/"+id+"/versions","GET",undefined,adminToken)).body.versions).toHaveLength(2);
    expect((await request(urls.catalog,"/api/v1/procedures/"+id,"DELETE",undefined,adminToken)).status).toBe(204);
    expect((await request(urls.catalog,"/api/v1/procedures/"+id)).status).toBe(404);
  });
  it("rejects unofficial sources and messages longer than 500 characters",async()=>{ expect((await request(urls.catalog,"/api/v1/procedures","POST",{id:"bad-source"},adminToken)).status).toBe(400); const user=await conversation(); expect((await send(user,"a".repeat(501))).status).toBe(400); });
  it("uses a controlled fallback when NLP fails",async()=>{ const user=await conversation(); nlpAvailable=false; try { const r=await send(user,"duplicado cédula"); expect(r.body.requiresReferral).toBe(true); expect(r.body.response).toMatch(/no está disponible/); } finally { nlpAvailable=true; } });
  it("verifies the persisted audit chain and provides actual metrics",async()=>{ const chain=await request(urls.audit,"/api/v1/audit/verify-integrity","GET",undefined,adminToken); expect(chain.body.valid).toBe(true); expect(chain.body.chainLength).toBeGreaterThan(10); const metrics=await request(urls.chat,"/api/v1/conversations/metrics/summary","GET",undefined,adminToken); expect(metrics.body.totalMessages).toBeGreaterThan(0); expect(metrics.body.meanLatencyMs).toBeGreaterThan(0); });
});

describe("administración, recuperación y validación adicional",()=>{
  it("rota refresh tokens y rechaza su reutilización",async()=>{
    const login=await request(urls.auth,"/api/v1/auth/login","POST",{email:"admin@ciudadano.gov.co",password:"AdminCiudadano2026!"});
    const token=login.body.refreshToken;
    expect((await request(urls.auth,"/api/v1/auth/refresh","POST",{refreshToken:token})).status).toBe(200);
    expect((await request(urls.auth,"/api/v1/auth/refresh","POST",{refreshToken:token})).status).toBe(401);
    expect((await request(urls.auth,"/api/v1/auth/logout","POST",{refreshToken:token})).status).toBe(204);
  });
  it("bloquea el login después de tres credenciales incorrectas",async()=>{
    const body={email:"missing@example.test",password:"WrongPassword123!"};
    expect((await request(urls.auth,"/api/v1/auth/login","POST",body)).status).toBe(401);
    expect((await request(urls.auth,"/api/v1/auth/login","POST",body)).status).toBe(401);
    expect((await request(urls.auth,"/api/v1/auth/login","POST",body)).status).toBe(429);
    expect((await request(urls.auth,"/api/v1/auth/login","POST",body)).status).toBe(429);
    expect((await request(urls.auth,"/api/v1/auth/login","POST",{})).status).toBe(400);
  });
  it("solo permite crear y listar administradores autorizados",async()=>{
    const body={email:"admin-"+randomUUID()+"@example.test",password:"LongAdminPassword123!",name:"Operador",roles:["operator"],permissions:["catalog_read"]};
    expect((await request(urls.auth,"/api/v1/auth/admins","POST",body,adminToken)).status).toBe(201);
    expect((await request(urls.auth,"/api/v1/auth/admins","POST",body,adminToken)).status).toBe(409);
    expect((await request(urls.auth,"/api/v1/auth/admins","POST",{},adminToken)).status).toBe(400);
    const result=await request(urls.auth,"/api/v1/auth/admins","GET",undefined,adminToken);
    expect(result.body.admins.length).toBeGreaterThan(1);expect(result.body.admins[0].passwordHash).toBeUndefined();
    expect((await request(urls.auth,"/api/v1/auth/me","GET",undefined,adminToken)).body.kind).toBe("admin");
    expect((await request(urls.auth,"/api/v1/auth/me")).status).toBe(401);
  });
  it("actualiza preferencias, conserva decisiones y revoca por ID",async()=>{
    const user=await profile();
    expect((await request(urls.auth,"/api/v1/profiles/"+user.id,"PATCH",{preferences:{fontScale:1.2,highContrast:true}},user.token)).body.preferences.fontScale).toBe(1.2);
    expect((await request(urls.auth,"/api/v1/profiles/"+user.id,"PATCH",{preferences:{fontScale:8}},user.token)).status).toBe(400);
    const c=await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents","POST",{purpose:"analytics",version:"1.0",granted:true},user.token);
    expect((await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents/"+c.body.id,"DELETE",undefined,user.token)).status).toBe(204);
    expect((await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents/missing","DELETE",undefined,user.token)).status).toBe(404);
    expect((await request(urls.auth,"/api/v1/profiles/"+user.id+"/consents","POST",{purpose:"invalid",version:"1.0",granted:true},user.token)).status).toBe(400);
  });
  it("rechaza perfiles, estados y códigos con formato inválido",async()=>{
    const user=await profile();
    expect((await request(urls.auth,"/api/v1/profiles","POST",{preferences:{fontScale:9}})).status).toBe(400);
    expect((await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact:"invalid"},user.token)).status).toBe(400);
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",{code:"x"},user.token)).status).toBe(400);
    const owner=await citizen("no-record@example.test");
    expect((await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"!"},owner.citizenToken)).status).toBe(400);
    expect((await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"MISSING"},owner.citizenToken)).status).toBe(404);
  });
  it("rechaza un OTP vencido y permite un único ganador concurrente",async()=>{
    const user=await profile(),c=await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact:"concurrent@example.test"},user.token);
    const body={challengeId:c.body.challengeId,code:c.body.demoCode};
    const outcomes=await Promise.all([request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token),request(urls.auth,"/api/v1/auth/otp/verify","POST",body,user.token)]);
    expect(outcomes.map(x=>x.status).sort()).toEqual([200,401]);
    const expired=await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact:"expired@example.test"},user.token);
    const found=(await auth.challenges.list()).find((x:any)=>x.value.id===expired.body.challengeId);found.value.expiresAt=Date.now()-1;await auth.challenges.set(found.key,found.value);
    expect((await request(urls.auth,"/api/v1/auth/otp/verify","POST",{challengeId:expired.body.challengeId,code:expired.body.demoCode},user.token)).status).toBe(401);
  });
  it("no expone estados después de revocar consentimiento",async()=>{
    const owner=await citizen("revocation@example.test");
    await request(urls.auth,"/api/v1/profiles/"+owner.id+"/consents","POST",{purpose:"conversation_context",version:"1.0",granted:false},owner.token);
    expect((await request(urls.catalog,"/api/v1/requests/status","POST",{radicado:"DEMO-001"},owner.citizenToken)).status).toBe(403);
  });
  it("publica catálogo, entidades, categorías y búsqueda sin exponer fichas inactivas",async()=>{
    for(const path of ["/api/v1/procedures","/api/v1/procedures/search?q=pasaporte","/api/v1/entities","/api/v1/categories"])expect((await request(urls.catalog,path)).status).toBe(200);
    expect((await request(urls.catalog,"/api/v1/procedures?all=true")).status).toBe(403);
    expect((await request(urls.catalog,"/api/v1/procedures?all=true","GET",undefined,adminToken)).body.total).toBeGreaterThan(0);
    expect((await request(urls.catalog,"/api/v1/procedures/missing/versions","GET",undefined,adminToken)).status).toBe(404);
    expect((await request(urls.catalog,"/api/v1/procedures/missing","PUT",{},adminToken)).status).toBe(404);
    expect((await request(urls.catalog,"/api/v1/procedures/missing","DELETE",undefined,adminToken)).status).toBe(404);
  });
  it("filtra y resume auditoría sin guardar texto sensible",async()=>{
    const user=await conversation();await send(user,"duplicado cédula");
    const event=await request(urls.audit,"/api/v1/audit/events?limit=2&type=conversation.intent.classified&producer=conversation-service","GET",undefined,adminToken);
    expect(event.body.events.length).toBeGreaterThan(0);expect(event.body.events[0].payload.text).toBeUndefined();
    expect((await request(urls.audit,"/api/v1/audit/conversations/"+user.conversationId,"GET",undefined,adminToken)).body.events.length).toBeGreaterThan(0);
    expect((await request(urls.audit,"/api/v1/audit/security","GET",undefined,adminToken)).body.events.length).toBeGreaterThan(0);
    expect((await request(urls.audit,"/api/v1/audit/stats","GET",undefined,adminToken)).body.totalEvents).toBeGreaterThan(0);
    expect((await request(urls.chat,"/api/v1/conversations/feedback/review","GET",undefined,adminToken)).status).toBe(200);
  });
  it("elimina una conversación propia y rechaza feedback inexistente",async()=>{
    const user=await conversation();
    expect((await request(urls.chat,"/api/v1/conversations/"+user.conversationId+"/feedback","POST",{messageId:randomUUID(),rating:"negative"},user.token)).status).toBe(400);
    expect((await request(urls.chat,"/api/v1/conversations/"+user.conversationId,"DELETE",undefined,user.token)).status).toBe(204);
    expect((await request(urls.chat,"/api/v1/conversations/"+user.conversationId,"GET",undefined,user.token)).status).toBe(410);
  });
});

it("renueva acceso anónimo de quince minutos sin recrear el perfil",async()=>{
  const created=await fetch(urls.auth+"/api/v1/profiles",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
  const cookie=created.headers.get("set-cookie")!.split(";")[0],data=await created.json();
  const claims=JSON.parse(Buffer.from(data.accessToken.split(".")[1],"base64url").toString());expect(claims.exp-claims.iat).toBe(900);
  const renewed=await fetch(urls.auth+"/api/v1/profiles/token/refresh",{method:"POST",headers:{"content-type":"application/json",cookie},body:"{}"});
  expect(renewed.status).toBe(200);expect((await renewed.json()).id).toBe(data.id);
  await request(urls.auth,"/api/v1/profiles/"+data.id+"/data","DELETE",undefined,data.accessToken);
  expect((await fetch(urls.auth+"/api/v1/profiles/token/refresh",{method:"POST",headers:{cookie}})).status).toBe(401);
});
it("rechaza identidad antes del consentimiento",async()=>{
  const user=await profile(false);
  expect((await request(urls.auth,"/api/v1/auth/otp/request","POST",{contact:"without-consent@example.test"},user.token)).status).toBe(403);
});
