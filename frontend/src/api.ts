import axios from "axios";
const baseURL = import.meta.env.VITE_API_URL ?? "";
export const api = axios.create({ baseURL, withCredentials: true });
export const authApi = api;
export const catalogApi = api;
export const profileApi = api;
export const auditApi = api;
export const nlpApi = api;
let verifiedProfile = "";
let creating: Promise<string> | undefined;
export async function ensureProfile(): Promise<string> {
  const token = sessionStorage.getItem("ciudadano_profile_token"), id = localStorage.getItem("ciudadano_anon_id");
  if (token && id) {
    let valid=false;
    try { valid=JSON.parse(atob(token.split(".")[1])).exp*1000>Date.now(); } catch {}
    if (valid) {
      if (verifiedProfile===id) return id;
      try {
        await axios.get(baseURL+"/api/v1/profiles/"+id,{headers:{Authorization:"Bearer "+token},withCredentials:true});
        verifiedProfile=id;return id;
      } catch(error:any) {
        if (![401,404].includes(error.response?.status)) throw error;
        sessionStorage.removeItem("ciudadano_profile_token");
      }
    }
  }
  creating ??= (async () => {
    if (id) {
      try {
        const refreshed = await axios.post(baseURL + "/api/v1/profiles/token/refresh", {}, { withCredentials: true });
        sessionStorage.setItem("ciudadano_profile_token", refreshed.data.accessToken);
        localStorage.setItem("ciudadano_anon_id", refreshed.data.id);
        verifiedProfile = refreshed.data.id; return refreshed.data.id as string;
      } catch (error: any) {
        if (error.response?.status !== 401) throw error;
      }
    }
    const response = await axios.post(baseURL + "/api/v1/profiles", {}, { withCredentials: true });
    const profile = response.data;
    localStorage.setItem("ciudadano_anon_id", profile.id);
    sessionStorage.setItem("ciudadano_profile_token", profile.accessToken);
    localStorage.removeItem("ciudadano_conv_id");
    sessionStorage.removeItem("ciudadano_chat_history");
    verifiedProfile = profile.id; return profile.id as string;
  })().finally(() => { creating = undefined; });
  return creating;
}
api.interceptors.request.use(async config => {
  const url = config.url ?? "", method = config.method ?? "get";
  const admin = url.includes("/audit") || url.includes("/metrics/summary") || url.includes("/feedback/review") || url.includes("all=true") || url.includes("/versions") || (url.includes("/procedures") && method !== "get") || url.includes("/auth/admins");
  const citizen = url.includes("/requests/status");
  if (!admin && !citizen && (url.includes("/profiles/") || url.includes("/conversations") || url.includes("/auth/otp/"))) await ensureProfile();
  const token = admin ? sessionStorage.getItem("ciudadano_jwt") : citizen ? sessionStorage.getItem("ciudadano_citizen_token") : sessionStorage.getItem("ciudadano_profile_token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
export const apiError = (error: any) => error.response?.data?.error?.message ?? error.response?.data?.detail ?? "El servicio no está disponible. Intenta de nuevo o usa el canal oficial.";
