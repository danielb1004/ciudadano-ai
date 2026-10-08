import React, { useState } from "react";
import { api, ensureProfile, apiError } from "./api";
export function RequestStatus() {
  const [contact,setContact] = useState(""), [code,setCode] = useState(""), [radicado,setRadicado] = useState("");
  const [challenge,setChallenge] = useState(""), [demoCode,setDemoCode] = useState(""), [verified,setVerified] = useState(false);
  const [message,setMessage] = useState(""), [result,setResult] = useState<any>(null), [busy,setBusy] = useState(false);
  const perform = async (operation: () => Promise<void>) => { setBusy(true); setMessage(""); try { await operation(); } catch(error) { setMessage(apiError(error)); } finally { setBusy(false); } };
  return <details className="bg-white border border-slate-200 rounded-2xl p-5">
    <summary className="font-bold cursor-pointer">Consultar el estado de una solicitud propia</summary>
    <p className="text-sm my-3">El acceso requiere verificar tu identidad. El código vence en cinco minutos; la sesión autenticada dura quince minutos. Este orientador no reemplaza los canales oficiales.</p>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(async () => {
      await ensureProfile(); const response = await api.post("/api/v1/auth/otp/request", { contact });
      setChallenge(response.data.challengeId); setDemoCode(response.data.demoCode ?? ""); setVerified(false); setResult(null);
      setMessage(response.data.mode === "simulated" ? "Simulación académica: el código se muestra aquí; no se envió un correo. Para el radicado DEMO-001 usa ciudadano-demo@example.test." : "Código enviado. Revisa tu correo.");
    }); }}>
      <label className="block text-sm">Correo de verificación
        <input type="email" required value={contact} onChange={e=>setContact(e.target.value)} placeholder="tu-correo@ejemplo.com" className="block w-full border rounded-lg p-2 mt-1" />
      </label>
      <button disabled={busy} className="bg-brand-700 text-white rounded-lg p-2">Solicitar código</button>
    </form>
    {demoCode && <p className="my-3 text-sm" role="status">Código de demostración: <strong>{demoCode}</strong></p>}
    {challenge && !verified && <form className="space-y-3 mt-4" onSubmit={event=>{event.preventDefault(); void perform(async()=>{
      const response=await api.post("/api/v1/auth/otp/verify",{challengeId:challenge,code}); sessionStorage.setItem("ciudadano_citizen_token",response.data.accessToken);
      setVerified(true); setCode(""); setDemoCode(""); setMessage("Identidad verificada por quince minutos.");
    });}}>
      <label className="block text-sm">Código de seis dígitos
        <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} className="block border rounded-lg p-2 mt-1" />
      </label>
      <button disabled={busy} className="bg-brand-700 text-white rounded-lg p-2">Verificar código</button>
    </form>}
    {verified && <form className="space-y-3 mt-4" onSubmit={event=>{event.preventDefault(); void perform(async()=>{
      setResult(null); const response=await api.post("/api/v1/requests/status",{radicado}); setResult(response.data);
    });}}>
      <label className="block text-sm">Número de radicado
        <input required value={radicado} onChange={e=>setRadicado(e.target.value)} maxLength={50} className="block border rounded-lg p-2 mt-1" />
      </label>
      <button disabled={busy} className="bg-brand-700 text-white rounded-lg p-2">Consultar estado</button>
    </form>}
    {message && <p role="status" className="text-sm my-3">{message}</p>}
    {result && <div role="status" className="bg-slate-50 rounded-xl p-4 my-3 space-y-2">
      {result.simulated && <p className="font-semibold">Resultado simulado del prototipo académico</p>}
      <p>Estado: {result.state}</p><p>Última actualización: {result.updatedAt}</p><p>Entidad: {result.entity}</p>
      <a className="underline" href={result.channel} target="_blank" rel="noreferrer">Canal oficial de seguimiento</a>
    </div>}
  </details>;
}
