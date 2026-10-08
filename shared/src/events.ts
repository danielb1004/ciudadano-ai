import { Kafka, Producer } from "kafkajs";
import { Store } from "./store.js";
import { EventEnvelope, eventSchema, logger } from "./index.js";
type Pending = { event: EventEnvelope; attempts: number; nextAttemptAt: number; dlqSent: boolean };
const queues = new Map<string, Store<Pending>>();
let producer: Producer | undefined, draining = false, timer: ReturnType<typeof setInterval> | undefined;
const schemas: Record<string,string> = { "conversation-service":"conversation", "auth-service":"auth", "catalog-service":"catalog", "recommendation-service":"recommendation", "audit-service":"audit" };
function queue(service: string) {
  const schema = schemas[service]; if (!schema) throw new Error("Unknown event producer");
  let store=queues.get(service); if (!store) { store=new Store<Pending>(schema,"event-outbox");queues.set(service,store); } return store;
}
export function startEventDelivery(service:string) {
  if (!process.env.KAFKA_BROKERS) return;
  queue(service);
  if (!timer) { timer=setInterval(()=>void flushEvents(),1000); timer.unref(); }
  void flushEvents();
}
export async function enqueueEvent(event:EventEnvelope) {
  eventSchema.parse(event);
  await queue(event.producer).set(event.eventId,{event,attempts:0,nextAttemptAt:0,dlqSent:false},365*86400);
  startEventDelivery(event.producer);
  // The HTTP request waits for durable storage, not Kafka delivery.
}
export async function flushEvents() {
  if (draining || !process.env.KAFKA_BROKERS) return;
  draining=true;
  try {
    producer ??= new Kafka({clientId:"citizen-event-outbox",brokers:process.env.KAFKA_BROKERS.split(","),connectionTimeout:3000,requestTimeout:3000,retry:{retries:1}}).producer();
    await producer.connect();
    for (const store of queues.values()) for (const item of (await store.list()).slice(0,100)) {
      const pending=item.value; if(pending.nextAttemptAt>Date.now()) continue;
      const topic=pending.event.eventType.replaceAll(".","-");
      try {
        await producer.send({topic,messages:[{key:pending.event.eventId,value:JSON.stringify(pending.event)}]});
        await store.remove(item.key);
      } catch(error) {
        pending.attempts++; pending.nextAttemptAt=Date.now()+Math.min(60000,1000*2**Math.min(pending.attempts,6));
        if(pending.attempts>=3 && !pending.dlqSent) {
          try { await producer.send({topic:topic+".DLQ",messages:[{key:pending.event.eventId,value:JSON.stringify(pending.event)}]});pending.dlqSent=true; }
          catch { /* Keep the original in the outbox until delivery recovers. */ }
        }
        await store.set(item.key,pending,365*86400);
        logger.warn({eventId:item.key,attempt:pending.attempts},"event delivery deferred");
      }
    }
  } catch(error) { logger.warn({err:error},"event outbox unavailable; pending events retained"); }
  finally { draining=false; }
}
