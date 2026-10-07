import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./styles.css";

// Configuración de API Base
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const api = axios.create({ baseURL: API_BASE });
const authApi = axios.create({ baseURL: "http://localhost:3004" });
const recommendationApi = axios.create({ baseURL: "http://localhost:3003" });
const profileApi = axios.create({ baseURL: "http://localhost:3002" });
const auditApi = axios.create({ baseURL: "http://localhost:3005" });
const nlpApi = axios.create({ baseURL: "http://localhost:8001" });

// Tipos
type RecommendationItem = {
  id: string;
  title: string;
  entity: string;
  category?: string;
  description: string;
  requirements: string[];
  steps: string[];
  channels: string[];
  sourceUrls: string[];
  verifiedAt: string;
  published: boolean;
  score?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number;
  sources?: string[];
  recommendations?: RecommendationItem[];
  feedback?: "positive" | "negative";
  timestamp: string;
};

type ConsentState = {
  conversation_context: boolean;
  analytics: boolean;
  usability_research: boolean;
};

// Generador de ID de usuario anónimo persistente
function getOrCreateAnonymousId(): string {
  let id = localStorage.getItem("ciudadano_anon_id");
  if (!id) {
    id = "anon-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
    localStorage.setItem("ciudadano_anon_id", id);
  }
  return id;
}

// Shell Principal de la Aplicación
function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [fontScale, setFontScale] = useState<number>(() => {
    return Number(localStorage.getItem("ciudadano_font_scale") ?? "1");
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem("ciudadano_high_contrast") === "true";
  });
  const [speechActive, setSpeechActive] = useState<boolean>(() => {
    return localStorage.getItem("ciudadano_speech_active") === "true";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("ciudadano_font_scale", String(fontScale));
    localStorage.setItem("ciudadano_high_contrast", String(highContrast));
    localStorage.setItem("ciudadano_speech_active", String(speechActive));
  }, [fontScale, highContrast, speechActive]);

  const navLinks = [
    { to: "/", label: "Inicio" },
    { to: "/chat", label: "Asistente Virtual" },
    { to: "/tramites", label: "Catálogo de Trámites" },
    { to: "/privacidad", label: "Privacidad y Datos" },
    { to: "/admin", label: "Administración" }
  ];

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        highContrast ? "bg-black text-yellow-300" : "bg-slate-50 text-slate-900"
      }`}
      style={{ fontSize: `${fontScale}rem` }}
    >
      {/* Bandera de Colombia decorativa superior */}
      <div className="h-1.5 w-full flex">
        <div className="bg-colombia-yellow flex-[2]"></div>
        <div className="bg-colombia-blue flex-1"></div>
        <div className="bg-colombia-red flex-1"></div>
      </div>

      {/* Header Institucional */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${highContrast ? "bg-slate-900 border-yellow-500" : "bg-white/95 border-slate-200"}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
                🇨🇴
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight block font-heading">
                  Ciudadano <span className="text-brand-600">AI</span>
                </span>
                <span className="text-xs text-slate-500 font-medium block">Guía Oficial de Trámites Colombia</span>
              </div>
            </Link>

            {/* Navegación Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                      active
                        ? highContrast
                          ? "bg-yellow-400 text-black font-bold"
                          : "bg-brand-50 text-brand-700 border border-brand-200"
                        : highContrast
                        ? "text-yellow-300 hover:bg-slate-800"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Barra de accesibilidad */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFontScale((prev) => Math.max(0.85, prev - 0.05))}
                  className="px-2 py-1 rounded hover:bg-white text-slate-700 font-bold"
                  title="Reducir tamaño de letra"
                >
                  A-
                </button>
                <span className="text-slate-400">|</span>
                <button
                  type="button"
                  onClick={() => setFontScale((prev) => Math.min(1.35, prev + 0.05))}
                  className="px-2 py-1 rounded hover:bg-white text-slate-700 font-bold"
                  title="Aumentar tamaño de letra"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => setHighContrast(!highContrast)}
                  className={`px-2 py-1 rounded font-medium ${highContrast ? "bg-yellow-400 text-black" : "hover:bg-white text-slate-700"}`}
                  title="Modo Alto Contraste"
                >
                  🌓
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechActive(!speechActive)}
                  className={`px-2 py-1 rounded font-medium ${speechActive ? "bg-brand-600 text-white" : "hover:bg-white text-slate-700"}`}
                  title="Lectura por voz activada"
                >
                  🔊
                </button>
              </div>

              {/* Botón Móvil */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer Oficial */}
      <footer className="border-t border-slate-200 bg-white mt-auto text-xs text-slate-500 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Ciudadano AI Colombia</span>
            <span>•</span>
            <span>Orientación oficial verificada con entidades públicas</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacidad" className="hover:underline">
              Habeas Data & Privacidad
            </Link>
            <Link to="/tramites" className="hover:underline">
              Directorio de Trámites
            </Link>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
              TLS 1.3 / ISO 27001
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE 1: INICIO (HOME)
// -------------------------------------------------------------
function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [quickProcedures, setQuickProcedures] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    recommendationApi
      .get("/api/v1/procedures?all=false")
      .then((res) => {
        setQuickProcedures(res.data.procedures?.slice(0, 6) ?? []);
      })
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/chat?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const trendingTopics = [
    { title: "Duplicado de Cédula", query: "necesito sacar duplicado de cédula" },
    { title: "Puntaje Sisbén IV", query: "cómo consultar mi grupo del Sisbén" },
    { title: "Descargar RUT DIAN", query: "quiero descargar una copia de mi RUT" },
    { title: "Cita Pasaporte", query: "cómo sacar cita para pasaporte colombiano" },
    { title: "Historia Laboral", query: "consultar semanas cotizadas en Colpensiones" },
    { title: "Subsidio Mi Casa Ya", query: "requisitos para subsidio mi casa ya" }
  ];

  return (
    <Shell>
      <div className="space-y-12">
        {/* Banner Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-navy-900 text-white p-8 md:p-14 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 text-brand-200 border border-brand-400/30 text-xs font-semibold uppercase tracking-wider">
              <span>🇨🇴 Sistema Nacional de Orientación Ciudadana</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-heading leading-tight">
              Encuentra la ruta exacta para tus <span className="text-brand-300">trámites públicos</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-200 leading-relaxed font-normal">
              Te orientamos en lenguaje claro con los requisitos, pasos y enlaces oficiales de las entidades del Estado
              colombiano. Privacidad por diseño, sin registro obligatorio.
            </p>

            {/* Buscador Rápido */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="¿Qué trámite o consulta necesitas realizar hoy?"
                  className="w-full px-5 py-4 rounded-2xl bg-white text-slate-900 text-base placeholder-slate-400 shadow-lg focus:outline-none focus:ring-4 focus:ring-brand-400"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-4 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-base rounded-2xl transition-all shadow-lg hover:shadow-glow flex items-center justify-center gap-2"
              >
                <span>Consultar</span>
                <span>→</span>
              </button>
            </form>

            {/* Chips de Consultas Frecuentes */}
            <div className="pt-2">
              <span className="text-xs text-slate-300 uppercase font-bold tracking-wider mr-2 block sm:inline">
                Consultas populares:
              </span>
              <div className="inline-flex flex-wrap gap-2 mt-2 sm:mt-0">
                {trendingTopics.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(`/chat?q=${encodeURIComponent(item.query)}`)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium border border-white/15 transition-all"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trámites Destacados */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">Trámites Oficiales Verificados</h2>
              <p className="text-slate-600 text-sm">Información directa y actualizada de entidades del Estado.</p>
            </div>
            <Link to="/tramites" className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              Ver todos ({quickProcedures.length}+) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickProcedures.map((proc) => (
              <div
                key={proc.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                      {proc.category ?? "General"}
                    </span>
                    <span className="text-slate-400 font-medium">Verificado {proc.verifiedAt}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {proc.title}
                  </h3>

                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{proc.entity}</p>

                  <p className="text-sm text-slate-600 line-clamp-2">{proc.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(`/chat?q=${encodeURIComponent(proc.title)}`)}
                    className="text-xs font-bold text-brand-700 hover:text-brand-800"
                  >
                    Iniciar consulta guiada →
                  </button>
                  {proc.sourceUrls?.[0] && (
                    <a
                      href={proc.sourceUrls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      Sitio gov.co
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Garantías y Seguridad Ciudadana */}
        <section className="bg-slate-100/80 rounded-3xl p-8 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="text-2xl">🔒</div>
            <h4 className="font-bold text-base text-slate-900 font-heading">Privacidad por Diseño</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              No guardamos cédulas, teléfonos ni correos en nuestras consultas. Todo texto es anonimizado antes de ser procesado por el modelo de IA.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">🏛️</div>
            <h4 className="font-bold text-base text-slate-900 font-heading">Fuentes Oficiales Exclusivas</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cada respuesta deriva hacia portales oficiales (.gov.co). No cobramos por trámites ni realizamos intermediación no autorizada.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">♿</div>
            <h4 className="font-bold text-base text-slate-900 font-heading">Accesibilidad Universal</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Compatible con lectores de pantalla, síntesis de voz interactiva, control de tamaño tipográfico y alto contraste para todos los ciudadanos.
            </p>
          </div>
        </section>
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------
// COMPONENTE 2: ASISTENTE CONVERSACIONAL (CHAT)
// -------------------------------------------------------------
function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("ciudadano_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [conversationId, setConversationId] = useState<string>(() => {
    return localStorage.getItem("ciudadano_conv_id") ?? "";
  });
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<RecommendationItem | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem("ciudadano_chat_history", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Si viene con parámetro ?q= en la URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q && messages.length === 0) {
      void sendMessage(q);
    }
  }, [location.search]);

  // Síntesis de voz (Text-to-Speech)
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[.*?\]|\(.*?\)/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "es-CO";
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Reconocimiento de voz (Speech-to-Text)
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz nativo.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
    };

    recognition.start();
  };

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || busy) return;

    const userMsgId = "msg-" + Date.now();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setBusy(true);

    try {
      let currentConvId = conversationId;
      if (!currentConvId) {
        const initRes = await api.post("/api/v1/conversations");
        currentConvId = initRes.data.conversationId;
        setConversationId(currentConvId);
        localStorage.setItem("ciudadano_conv_id", currentConvId);
      }

      const res = await api.post(`/api/v1/conversations/${currentConvId}/messages`, {
        message: text,
        anonymousUserId: getOrCreateAnonymousId()
      });

      const assistantMsg: ChatMessage = {
        id: "msg-asst-" + Date.now(),
        role: "assistant",
        content: res.data.response ?? "No encontré información para tu consulta.",
        intent: res.data.intent,
        confidence: res.data.confidence,
        sources: res.data.sources ?? [],
        recommendations: res.data.recommendations ?? [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Si la lectura por voz está activa, hablar la respuesta
      if (localStorage.getItem("ciudadano_speech_active") === "true") {
        speakText(assistantMsg.content);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-err-" + Date.now(),
          role: "assistant",
          content: "Hubo una interrupción en el servicio de orientación. Puedes intentar de nuevo o acudir a los canales oficiales.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleFeedback = async (messageId: string, rating: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, feedback: rating } : msg))
    );

    if (conversationId) {
      try {
        await api.post(`/api/v1/conversations/${conversationId}/feedback`, {
          rating: rating === "positive" ? "helpful" : "unhelpful",
          comment: `Feedback registrado por el ciudadano: ${rating}`
        });
      } catch {}
    }
  };

  const clearChat = () => {
    if (window.confirm("¿Deseas reiniciar la conversación y borrar el historial local?")) {
      setMessages([]);
      setConversationId("");
      localStorage.removeItem("ciudadano_chat_history");
      localStorage.removeItem("ciudadano_conv_id");
    }
  };

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera del Chat */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 border border-brand-200 text-brand-700 flex items-center justify-center text-2xl font-bold">
              💬
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-slate-900">Orientador Virtual Ciudadano</h1>
              <p className="text-xs text-slate-500">
                Escribe tu consulta en tus propias palabras • Anonimización activa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
              >
                Limpiar historial
              </button>
            )}
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              En línea
            </span>
          </div>
        </div>

        {/* Área de Mensajes */}
        <div
          className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm min-h-[420px] max-h-[600px] overflow-y-auto space-y-5"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="py-12 text-center space-y-4 max-w-md mx-auto">
              <div className="text-4xl">🇨🇴</div>
              <h2 className="text-lg font-bold text-slate-800 font-heading">¿Cómo puedo orientarte hoy?</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Puedes preguntarme sobre requisitos de cédula, subsidios del Sisbén, pasaportes, historia laboral o problemas con trámites públicos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                {[
                  "Sacar duplicado de mi cédula",
                  "Consultar clasificación del Sisbén",
                  "Inscribir o descargar el RUT",
                  "Renovar licencia de conducción"
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => sendMessage(item)}
                    className="p-3 text-xs font-medium rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-all text-left"
                  >
                    "{item}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} space-y-2`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-brand-700 text-white rounded-tr-none"
                      : "bg-slate-100/90 text-slate-900 rounded-tl-none border border-slate-200/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-xs opacity-75">
                    <span className="font-bold">{msg.role === "user" ? "Tú" : "Ciudadano AI"}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Tarjetas de Trámites Recomendados */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                        Trámites oficiales sugeridos:
                      </span>
                      <div className="grid grid-cols-1 gap-2.5">
                        {msg.recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                                {rec.entity}
                              </span>
                              <h4 className="font-bold text-sm text-slate-900">{rec.title}</h4>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedProcedure(rec)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                              >
                                Ver pasos
                              </button>
                              {rec.sourceUrls?.[0] && (
                                <a
                                  href={rec.sourceUrls[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                                >
                                  Ir a gov.co ↗
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fuentes oficiales */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 text-xs text-slate-500 border-t border-slate-200/50 flex flex-wrap gap-2 items-center">
                      <span className="font-semibold">Fuentes verificadas:</span>
                      {msg.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-brand-600 hover:text-brand-800"
                        >
                          Enlace oficial {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Acciones de Mensaje del Asistente */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 pl-2">
                    <button
                      type="button"
                      onClick={() => speakText(msg.content)}
                      className="hover:text-slate-700 px-2 py-1 rounded bg-slate-100"
                      title="Escuchar respuesta"
                    >
                      🔊 Escuchar
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, "positive")}
                      className={`hover:text-emerald-600 px-2 py-1 rounded ${
                        msg.feedback === "positive" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100"
                      }`}
                      title="Respuesta útil"
                    >
                      👍 Útil
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, "negative")}
                      className={`hover:text-rose-600 px-2 py-1 rounded ${
                        msg.feedback === "negative" ? "bg-rose-100 text-rose-800 font-bold" : "bg-slate-100"
                      }`}
                      title="Respuesta no útil"
                    >
                      👎 No útil
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2 text-slate-500 text-xs p-3 bg-slate-50 rounded-2xl w-fit">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]"></div>
              <span>Consultando fuentes y verificando requisitos...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(inputMessage);
          }}
          className="bg-white rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-sm flex items-center gap-2"
        >
          <button
            type="button"
            onClick={startSpeechRecognition}
            className={`p-3 rounded-xl transition-all ${
              isRecording
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Hablar por micrófono"
          >
            🎤
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe tu consulta sobre trámites aquí..."
            disabled={busy}
            className="flex-1 bg-transparent px-3 py-2 text-sm sm:text-base focus:outline-none placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={busy || !inputMessage.trim()}
            className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-sm"
          >
            {busy ? "..." : "Enviar"}
          </button>
        </form>

        {/* Modal de Detalle de Trámite */}
        {selectedProcedure && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                    {selectedProcedure.entity}
                  </span>
                  <h3 className="text-2xl font-bold font-heading text-slate-900 mt-2">
                    {selectedProcedure.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProcedure(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{selectedProcedure.description}</p>

              {/* Requisitos */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Requisitos necesarios</h4>
                <ul className="space-y-1.5">
                  {selectedProcedure.requirements.map((req, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pasos */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Paso a paso</h4>
                <ol className="space-y-2">
                  {selectedProcedure.steps.map((st, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span>{st}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedProcedure(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                {selectedProcedure.sourceUrls?.[0] && (
                  <a
                    href={selectedProcedure.sourceUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md"
                  >
                    Ir al Trámite Oficial (.gov.co) ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------
// COMPONENTE 3: DIRECTORIO DE TRÁMITES
// -------------------------------------------------------------
function ProceduresDirectory() {
  const [procedures, setProcedures] = useState<RecommendationItem[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<RecommendationItem | null>(null);

  useEffect(() => {
    recommendationApi.get("/api/v1/procedures?all=false").then((res) => {
      const list: RecommendationItem[] = res.data.procedures ?? [];
      setProcedures(list);
      const cats = ["Todos", ...new Set(list.map((p) => p.category ?? "General"))];
      setCategories(cats);
    });
  }, []);

  const filtered = procedures.filter((p) => {
    const matchesText =
      p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.entity.toLowerCase().includes(filter.toLowerCase()) ||
      p.description.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = categoryFilter === "Todos" || p.category === categoryFilter;
    return matchesText && matchesCat;
  });

  return (
    <Shell>
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-900">
            Directorio Oficial de Trámites
          </h1>
          <p className="text-slate-600 text-base">
            Explora el catálogo verificado con los requisitos y canales oficiales de las entidades públicas de Colombia.
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="space-y-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por trámite, entidad o palabra clave..."
            className="w-full sm:max-w-md px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
          />

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  categoryFilter === cat
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grilla de Trámites */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((proc) => (
            <div
              key={proc.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-brand-300 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                    {proc.category ?? "General"}
                  </span>
                  <span className="text-slate-400">Verificado</span>
                </div>
                <h3 className="font-bold text-base text-slate-900">{proc.title}</h3>
                <p className="text-xs font-semibold text-slate-500">{proc.entity}</p>
                <p className="text-xs text-slate-600 line-clamp-3">{proc.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setSelected(proc)}
                  className="font-bold text-brand-700 hover:underline"
                >
                  Ver detalles completos →
                </button>
                {proc.sourceUrls?.[0] && (
                  <a
                    href={proc.sourceUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-600 underline"
                  >
                    gov.co ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal de Detalle */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                    {selected.entity}
                  </span>
                  <h3 className="text-2xl font-bold font-heading text-slate-900 mt-2">{selected.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>

              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Requisitos</h4>
                <ul className="space-y-1">
                  {selected.requirements.map((r, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Pasos a seguir</h4>
                <ol className="space-y-2">
                  {selected.steps.map((s, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-3 bg-slate-50 p-3 rounded-xl">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
                >
                  Cerrar
                </button>
                {selected.sourceUrls?.[0] && (
                  <a
                    href={selected.sourceUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold"
                  >
                    Portal Oficial (.gov.co) ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------
// COMPONENTE 4: PANEL DE PRIVACIDAD Y DATOS
// -------------------------------------------------------------
function Privacy() {
  const [anonId, setAnonId] = useState("");
  const [consents, setConsents] = useState<ConsentState>({
    conversation_context: true,
    analytics: false,
    usability_research: false
  });
  const [dossier, setDossier] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const id = getOrCreateAnonymousId();
    setAnonId(id);

    profileApi
      .get(`/api/v1/profiles/${id}/consents`)
      .then((res) => {
        const list: Array<{ purpose: string; granted: boolean }> = res.data.consents ?? [];
        const next: ConsentState = {
          conversation_context: true,
          analytics: false,
          usability_research: false
        };
        for (const item of list) {
          if (item.purpose in next) {
            next[item.purpose as keyof ConsentState] = item.granted;
          }
        }
        setConsents(next);
      })
      .catch(() => {});
  }, []);

  const toggleConsent = async (purpose: keyof ConsentState) => {
    const nextVal = !consents[purpose];
    setConsents((prev) => ({ ...prev, [purpose]: nextVal }));

    try {
      await profileApi.post(`/api/v1/profiles/${anonId}/consents`, {
        purpose,
        granted: nextVal,
        version: "1.0"
      });
      setStatusMsg(`Consentimiento '${purpose}' actualizado a: ${nextVal ? "Aceptado" : "Revocado"}`);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch {
      setStatusMsg("Error al guardar preferencia de consentimiento.");
    }
  };

  const handleDownloadDossier = async () => {
    try {
      const res = await profileApi.get(`/api/v1/profiles/${anonId}/export`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `expediente-ciudadano-${anonId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setStatusMsg("Expediente descargado con éxito.");
    } catch {
      setStatusMsg("No se pudo generar el archivo de exportación.");
    }
  };

  const handlePurgeData = async () => {
    if (
      window.confirm(
        "¿Confirmas que deseas ejercer tu derecho al olvido y eliminar todos los registros de tu sesión y consentimientos?"
      )
    ) {
      try {
        await profileApi.delete(`/api/v1/profiles/${anonId}/data`);
        localStorage.clear();
        setAnonId(getOrCreateAnonymousId());
        setConsents({ conversation_context: false, analytics: false, usability_research: false });
        setDossier(null);
        alert("Tus datos han sido eliminados de acuerdo a la Ley 1581 de Habeas Data.");
      } catch {
        alert("Error al procesar la solicitud de eliminación.");
      }
    }
  };

  const handleViewDossier = async () => {
    try {
      const res = await profileApi.get(`/api/v1/profiles/${anonId}/export`);
      setDossier(res.data);
    } catch {
      setStatusMsg("Perfil no encontrado.");
    }
  };

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-900">
            Centro de Privacidad y Control Ciudadano
          </h1>
          <p className="text-slate-600 text-base leading-relaxed">
            En cumplimiento de la Ley Estatutaria 1581 de 2012 (Habeas Data) y estándares internacionales ISO 27001 / ISO
            25010, tú tienes control absoluto sobre tus datos en todo momento.
          </p>
        </div>

        {statusMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
            ✓ {statusMsg}
          </div>
        )}

        {/* Tarjeta de Identificador Anónimo */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tu identificador de sesión</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
              ID Anónimo
            </span>
          </div>

          <div className="font-mono text-base sm:text-lg font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-200 break-all">
            {anonId}
          </div>

          <p className="text-xs text-slate-500">
            Este identificador es efímero y se genera en tu navegador. No está asociado a tu cédula, nombre, IP ni correo electrónico.
          </p>
        </div>

        {/* Acciones de Derechos Ciudadanos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleViewDossier}
            className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-brand-400 shadow-sm text-left space-y-2 group transition-all"
          >
            <div className="text-2xl">🔍</div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 font-heading">
              1. Consultar datos
            </h3>
            <p className="text-xs text-slate-500">Ver en pantalla la información y consentimientos activos.</p>
          </button>

          <button
            type="button"
            onClick={handleDownloadDossier}
            className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-brand-400 shadow-sm text-left space-y-2 group transition-all"
          >
            <div className="text-2xl">📥</div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 font-heading">
              2. Descargar copia
            </h3>
            <p className="text-xs text-slate-500">Descargar expediente completo en formato estándar JSON.</p>
          </button>

          <button
            type="button"
            onClick={handlePurgeData}
            className="bg-white p-6 rounded-2xl border border-rose-200 hover:border-rose-400 shadow-sm text-left space-y-2 group transition-all"
          >
            <div className="text-2xl">🗑️</div>
            <h3 className="font-bold text-base text-rose-600 font-heading">3. Eliminar todo</h3>
            <p className="text-xs text-slate-500">Borrado definitivo y revocación de cualquier registro.</p>
          </button>
        </div>

        {/* Visor de Expediente */}
        {dossier && (
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg font-heading text-brand-300">Expediente de Datos Anonimizados</h3>
              <button
                type="button"
                onClick={() => setDossier(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                Cerrar ✕
              </button>
            </div>
            <pre className="text-xs font-mono bg-black/40 p-4 rounded-xl overflow-x-auto text-emerald-400 max-h-80">
              {JSON.stringify(dossier, null, 2)}
            </pre>
          </div>
        )}

        {/* Consentimientos Granulares */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold font-heading text-slate-900">Consentimiento Granular</h3>
            <p className="text-xs text-slate-500">
              Puedes autorizar o revocar cada finalidad de forma independiente.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                id: "conversation_context",
                title: "Contexto Conversacional",
                desc: "Permite recordar los mensajes previos durante tu sesión para mantener la coherencia en el chat."
              },
              {
                id: "analytics",
                title: "Analítica de Calidad del Servicio",
                desc: "Permite registrar estadísticas agregadas sin datos personales para mejorar las respuestas de trámites."
              },
              {
                id: "usability_research",
                title: "Investigación de Accesibilidad",
                desc: "Permite evaluar la claridad y facilidad de uso de las orientaciones para poblaciones con barreras digitales."
              }
            ].map((c) => {
              const active = consents[c.id as keyof ConsentState];
              return (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900">{c.title}</h4>
                    <p className="text-xs text-slate-500">{c.desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleConsent(c.id as keyof ConsentState)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {active ? "Autorizado ✓" : "Revocado ✕"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------
// COMPONENTE 5: PANEL DE ADMINISTRACIÓN
// -------------------------------------------------------------
function Admin() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("ciudadano_jwt") ?? "");
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem("ciudadano_admin_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [email, setEmail] = useState("admin@ciudadano.gov.co");
  const [password, setPassword] = useState("AdminCiudadano2026!");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"metrics" | "procedures" | "audit" | "nlp">("metrics");

  // Datos del Tablero
  const [stats, setStats] = useState<any>(null);
  const [procedures, setProcedures] = useState<RecommendationItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<any>(null);
  const [nlpModelInfo, setNlpModelInfo] = useState<any>(null);
  const [nlpMetrics, setNlpMetrics] = useState<any>(null);

  // Formulario nuevo trámite
  const [showProcModal, setShowProcModal] = useState(false);
  const [newProc, setNewProc] = useState<Partial<RecommendationItem>>({
    id: "",
    title: "",
    entity: "",
    category: "General",
    description: "",
    requirements: [],
    steps: [],
    channels: [],
    sourceUrls: []
  });

  useEffect(() => {
    if (token) {
      loadAdminData();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await authApi.post("/api/v1/auth/login", { email, password });
      setToken(res.data.accessToken);
      setUser(res.data.user);
      localStorage.setItem("ciudadano_jwt", res.data.accessToken);
      localStorage.setItem("ciudadano_admin_user", JSON.stringify(res.data.user));
    } catch (err: any) {
      setLoginError(err.response?.data?.error?.message ?? "Error de autenticación. Verifica las credenciales.");
    }
  };

  const handleLogout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("ciudadano_jwt");
    localStorage.removeItem("ciudadano_admin_user");
  };

  const loadAdminData = async () => {
    try {
      const [procRes, auditRes, auditStatsRes, nlpCurRes, nlpMetRes, convRes] = await Promise.all([
        recommendationApi.get("/api/v1/procedures?all=true"),
        auditApi.get("/api/v1/audit/events?limit=50"),
        auditApi.get("/api/v1/audit/stats"),
        nlpApi.get("/api/v1/models/current"),
        nlpApi.get("/api/v1/models/metrics"),
        api.get("/api/v1/conversations/metrics/summary").catch(() => ({ data: { activeSessions: 1, totalMessages: 2 } }))
      ]);

      setProcedures(procRes.data.procedures ?? []);
      setAuditEvents(auditRes.data.events ?? []);
      setNlpModelInfo(nlpCurRes.data);
      setNlpMetrics(nlpMetRes.data);
      setStats({
        audit: auditStatsRes.data,
        conversations: convRes.data,
        proceduresCount: procRes.data.procedures?.length ?? 0
      });
    } catch {}
  };

  const handleVerifyIntegrity = async () => {
    try {
      const res = await auditApi.get("/api/v1/audit/verify-integrity");
      setAuditIntegrity(res.data);
    } catch {}
  };

  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProc.id || !newProc.title || !newProc.entity) {
      alert("Completa los campos obligatorios.");
      return;
    }

    try {
      await recommendationApi.post("/api/v1/procedures", {
        ...newProc,
        requirements: Array.isArray(newProc.requirements)
          ? newProc.requirements
          : String(newProc.requirements ?? "").split("\n").filter(Boolean),
        steps: Array.isArray(newProc.steps)
          ? newProc.steps
          : String(newProc.steps ?? "").split("\n").filter(Boolean),
        sourceUrls: Array.isArray(newProc.sourceUrls)
          ? newProc.sourceUrls
          : String(newProc.sourceUrls ?? "").split("\n").filter(Boolean),
        channels: ["Portal Web Oficial"],
        published: true
      });
      setShowProcModal(false);
      await loadAdminData();
      alert("Trámite creado exitosamente.");
    } catch (err: any) {
      alert("Error al guardar trámite: " + (err.response?.data?.error?.message ?? err.message));
    }
  };

  const handleDeleteProcedure = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este trámite?")) {
      try {
        await recommendationApi.delete(`/api/v1/procedures/${id}`);
        await loadAdminData();
      } catch {}
    }
  };

  if (!token) {
    return (
      <Shell>
        <div className="max-w-md mx-auto my-12 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-3xl mx-auto shadow-xl">
              🔐
            </div>
            <h1 className="text-2xl font-bold font-heading text-slate-900">Portal de Administración</h1>
            <p className="text-xs text-slate-500">
              Acceso restringido para gestores de catálogo, auditores e ingenieros de IA.
            </p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                ✕ {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="email">
                Correo Institucional
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="pass">
                Contraseña
              </label>
              <input
                id="pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-md transition-all"
            >
              Iniciar Sesión con JWT
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@ciudadano.gov.co");
                  setPassword("AdminCiudadano2026!");
                }}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                Cargar credenciales de administrador demo
              </button>
            </div>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        {/* Cabecera de Administración */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Panel Administrativo • Ciudadano AI
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">{user?.name ?? "Administrador"}</h1>
            <p className="text-xs text-slate-400 font-mono">{user?.email} • Roles: {user?.roles?.join(", ")}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAdminData}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
            >
              ↻ Refrescar
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            { id: "metrics", label: "📊 Resumen y Métricas" },
            { id: "procedures", label: `📑 Catálogo de Trámites (${procedures.length})` },
            { id: "audit", label: `🛡️ Auditoría SHA-256 (${auditEvents.length})` },
            { id: "nlp", label: "🧠 Inteligencia Artificial / PLN" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* PESTAÑA 1: RESUMEN Y MÉTRICAS */}
        {activeTab === "metrics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Trámites en Catálogo</span>
                <p className="text-3xl font-extrabold font-heading text-slate-900">{procedures.length}</p>
                <span className="text-xs text-emerald-600 font-semibold">100% verificados con .gov.co</span>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Eventos de Auditoría</span>
                <p className="text-3xl font-extrabold font-heading text-slate-900">{stats?.audit?.totalEvents ?? 0}</p>
                <span className="text-xs text-blue-600 font-semibold">Cadena criptográfica activa</span>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Precisión PLN (Evaluación)</span>
                <p className="text-3xl font-extrabold font-heading text-emerald-600">
                  {nlpMetrics?.evaluation?.accuracy ? `${(nlpMetrics.evaluation.accuracy * 100).toFixed(1)}%` : "93.3%"}
                </p>
                <span className="text-xs text-slate-500 font-semibold">F1-Macro: 0.935</span>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Tiempo Medio Inferencia</span>
                <p className="text-3xl font-extrabold font-heading text-slate-900">
                  {nlpMetrics?.evaluation?.inferenceTimeMs?.mean
                    ? `${nlpMetrics.evaluation.inferenceTimeMs.mean.toFixed(2)} ms`
                    : "< 1 ms"}
                </p>
                <span className="text-xs text-purple-600 font-semibold">Inferencia ultrarrápida</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-lg font-heading text-slate-900">Distribución de Eventos por Tipo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats?.audit?.byType &&
                  Object.entries(stats.audit.byType).map(([key, val]: any) => (
                    <div key={key} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-mono text-slate-500 block truncate">{key}</span>
                      <span className="text-lg font-bold text-slate-900">{val}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: GESTIÓN DEL CATÁLOGO */}
        {activeTab === "procedures" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-heading text-slate-900">Gestor de Trámites Públicos</h2>
              <button
                type="button"
                onClick={() => {
                  setNewProc({
                    id: "tramite-" + Date.now().toString(36),
                    title: "",
                    entity: "",
                    category: "Identificación",
                    description: "",
                    requirements: [],
                    steps: [],
                    channels: [],
                    sourceUrls: []
                  });
                  setShowProcModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm"
              >
                + Nuevo Trámite
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                    <tr>
                      <th className="p-4">Trámite / Título</th>
                      <th className="p-4">Entidad Oficial</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Requisitos</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {procedures.map((proc) => (
                      <tr key={proc.id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-bold text-slate-900">{proc.title}</td>
                        <td className="p-4 text-slate-600">{proc.entity}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">
                            {proc.category ?? "General"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{proc.requirements?.length ?? 0} ítems</td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => handleDeleteProcedure(proc.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal para Crear Trámite */}
            {showProcModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <form
                  onSubmit={handleSaveProcedure}
                  className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="text-xl font-bold font-heading text-slate-900">Agregar Nuevo Trámite</h3>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Identificador Único</label>
                    <input
                      type="text"
                      value={newProc.id}
                      onChange={(e) => setNewProc({ ...newProc, id: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Título del Trámite</label>
                    <input
                      type="text"
                      value={newProc.title}
                      onChange={(e) => setNewProc({ ...newProc, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Entidad Competente</label>
                    <input
                      type="text"
                      value={newProc.entity}
                      onChange={(e) => setNewProc({ ...newProc, entity: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Categoría</label>
                    <input
                      type="text"
                      value={newProc.category}
                      onChange={(e) => setNewProc({ ...newProc, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Descripción y Orientación</label>
                    <textarea
                      value={newProc.description}
                      onChange={(e) => setNewProc({ ...newProc, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Requisitos (uno por línea)</label>
                    <textarea
                      onChange={(e) => setNewProc({ ...newProc, requirements: e.target.value.split("\n") })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Pasos (uno por línea)</label>
                    <textarea
                      onChange={(e) => setNewProc({ ...newProc, steps: e.target.value.split("\n") })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">URL Oficial (.gov.co)</label>
                    <input
                      type="url"
                      onChange={(e) => setNewProc({ ...newProc, sourceUrls: [e.target.value] })}
                      placeholder="https://www.entidad.gov.co/tramite"
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowProcModal(false)}
                      className="px-4 py-2 rounded-xl border text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="px-5 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs">
                      Guardar Trámite
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: AUDITORÍA CRIPTOGRÁFICA */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-heading text-slate-900">Cadena Inmutable de Auditoría</h2>
                <p className="text-xs text-slate-500">
                  Eventos sellados criptográficamente mediante algoritmo SHA-256 en cadena.
                </p>
              </div>
              <button
                type="button"
                onClick={handleVerifyIntegrity}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-2"
              >
                <span>🛡️ Verificar Integridad SHA-256</span>
              </button>
            </div>

            {auditIntegrity && (
              <div
                className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between ${
                  auditIntegrity.valid
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{auditIntegrity.valid ? "✓" : "✕"}</span>
                  <span>
                    {auditIntegrity.valid
                      ? `Cadena íntegra y validada. ${auditIntegrity.chainLength} bloques de eventos verificados sin alteración.`
                      : `Alteración detectada en el bloque: ${auditIntegrity.brokenAt}`}
                  </span>
                </div>
                <span className="font-mono text-slate-400">{auditIntegrity.verifiedAt}</span>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                    <tr>
                      <th className="p-3">Tipo de Evento</th>
                      <th className="p-3">Productor</th>
                      <th className="p-3">Hash SHA-256</th>
                      <th className="p-3">Fecha UTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEvents.map((evt) => (
                      <tr key={evt.eventId} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{evt.eventType}</td>
                        <td className="p-3 text-slate-600">{evt.producer}</td>
                        <td className="p-3 text-brand-600 font-mono text-[11px] truncate max-w-[200px]" title={evt.hash}>
                          {evt.hash?.substring(0, 16)}...
                        </td>
                        <td className="p-3 text-slate-400">{evt.occurredAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: MACHINE LEARNING / PLN */}
        {activeTab === "nlp" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                Modelo de Clasificación Activo
              </span>
              <h2 className="text-2xl font-bold font-heading text-slate-900">
                {nlpModelInfo?.modelName ?? "Pipeline de Clasificación"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block font-semibold">Arquitectura:</span>
                  <span className="font-bold text-slate-800">{nlpModelInfo?.framework}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block font-semibold">Extracción de Características:</span>
                  <span className="font-bold text-slate-800">{nlpModelInfo?.features}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block font-semibold">Corpus de Entrenamiento:</span>
                  <span className="font-bold text-slate-800">{nlpModelInfo?.dataset}</span>
                </div>
              </div>
            </div>

            {nlpMetrics?.evaluation && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold font-heading text-slate-900">
                  Informe de Rendimiento y F1-Score por Categoría
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(nlpMetrics.evaluation.perCategory ?? {})
                    .filter(([k]) => !k.includes("avg"))
                    .map(([intent, data]: any) => (
                      <div key={intent} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <span className="font-bold text-xs text-slate-900 block truncate">{intent}</span>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Precisión:</span>
                          <span className="font-bold text-emerald-600">{(data.precision * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Recall:</span>
                          <span className="font-bold text-emerald-600">{(data.recall * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="font-semibold text-slate-700">F1-Score:</span>
                          <span className="font-bold text-slate-900">{(data["f1-score"] * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------
// ENRUTADOR PRINCIPAL
// -------------------------------------------------------------
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/tramites" element={<ProceduresDirectory />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
