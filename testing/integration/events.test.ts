import { afterAll, beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({entries:new Map<string,any>(),send:vi.fn(async()=>{}),connect:vi.fn(async()=>{})}));
vi.mock("kafkajs",()=>({Kafka:class {producer(){return {connect:state.connect,send:state.send};}}}));
vi.mock("../../shared/src/store.js",()=>({Store:class {
  async set(key:string,value:any){state.entries.set(key,structuredClone(value));}
  async list(){return [...state.entries].map(([key,value])=>({key,value}));}
  async remove(key:string){state.entries.delete(key);}
}}));
import { enqueueEvent, flushEvents } from "../../shared/src/events";
import { makeEvent } from "../../shared/src/index";
beforeEach(()=>{state.entries.clear();state.send.mockReset().mockResolvedValue(undefined);state.connect.mockReset().mockResolvedValue(undefined);process.env.KAFKA_BROKERS="mock:9092";process.env.LOG_LEVEL="silent";});
afterAll(()=>{delete process.env.KAFKA_BROKERS;});
const drain=async()=>{await new Promise(resolve=>setTimeout(resolve,5));await flushEvents();await new Promise(resolve=>setTimeout(resolve,5));};
it("entrega el evento persistido y elimina solo después de confirmar",async()=>{
  const event=makeEvent("conversation.started","conversation-service",{});await enqueueEvent(event);await drain();
  expect(state.send).toHaveBeenCalledWith(expect.objectContaining({topic:"conversation-started"}));expect(state.entries.size).toBe(0);
});
it("conserva pendientes si Kafka no conecta",async()=>{
  state.connect.mockRejectedValue(new Error("offline"));const event=makeEvent("profile.created","auth-service",{});await enqueueEvent(event);await drain();
  expect(state.entries.has(event.eventId)).toBe(true);
});
it("reintenta y envía a DLQ sin perder el original",async()=>{
  state.send.mockRejectedValue(new Error("offline"));const event=makeEvent("procedure.updated","catalog-service",{});await enqueueEvent(event);await drain();
  for(let i=0;i<3;i++){const pending=state.entries.get(event.eventId);pending.nextAttemptAt=0;await drain();}
  expect(state.entries.get(event.eventId).attempts).toBeGreaterThanOrEqual(3);
  expect(state.send.mock.calls.some((call:any)=>call[0].topic==="procedure-updated.DLQ")).toBe(true);
});
it("entrega después de recuperar Kafka",async()=>{
  state.connect.mockRejectedValue(new Error("offline"));const event=makeEvent("profile.created","auth-service",{});await enqueueEvent(event);await drain();
  state.connect.mockResolvedValue(undefined);await drain();expect(state.entries.has(event.eventId)).toBe(false);
});
it("rechaza un productor sin cola configurada",async()=>{
  await expect(enqueueEvent(makeEvent("unknown.created","unknown",{}))).rejects.toThrow("Unknown");
});
