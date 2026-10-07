import { randomUUID } from "node:crypto";
import { createBaseApp, logger, makeEvent, publishEvent, Intent, Recommendation } from "@ciudadano-ai/shared";
import { z } from "zod";

export interface ExtendedRecommendation extends Recommendation {
  category?: string;
}

// Catálogo enriquecido de trámites oficiales de Colombia verificados con entidades gubernamentales
const catalog: ExtendedRecommendation[] = [
  {
    id: "cedula-duplicado",
    title: "Duplicado de la cédula de ciudadanía",
    entity: "Registraduría Nacional del Estado Civil",
    category: "Identificación",
    description: "Orientación y requisitos para solicitar el duplicado de la cédula de ciudadanía por pérdida, hurto o deterioro.",
    requirements: [
      "Conocer el número de documento de identidad",
      "Comprobante de pago de la tarifa vigente por duplicado (PSE o banco autorizado)",
      "Fotografía reciente si el trámite se realiza en oficina presencial sin captura web"
    ],
    steps: [
      "Ingresa al portal web oficial de trámites de la Registraduría",
      "Selecciona la opción 'Duplicado de cédula en línea'",
      "Realiza el pago electrónico mediante PSE o descarga el recibo bancario",
      "Selecciona la sede donde deseas reclamar el documento una vez esté listo"
    ],
    channels: ["Portal Web Registraduría", "Sedes de Registradurías municipales y auxiliares"],
    sourceUrls: ["https://www.registraduria.gov.co/-Cedula-de-ciudadania-.html"],
    verifiedAt: "2026-01-15",
    published: true
  },
  {
    id: "cedula-digital",
    title: "Expedición y activación de la cédula digital",
    entity: "Registraduría Nacional del Estado Civil",
    category: "Identificación",
    description: "Trámite para obtener la cédula digital en policarbonato y activarla en el dispositivo móvil inteligente.",
    requirements: [
      "Ser ciudadano colombiano mayor de 18 años",
      "Pago de tarifa de cédula digital o documento inicial para quienes cumplen mayoría de edad (gratuita)",
      "Dispositivo móvil compatible con la app 'Cédula Digital Colombia'"
    ],
    steps: [
      "Agenda tu cita o acude a la Registraduría autorizada para enrolamiento biométrico",
      "Toma de fotografía, huellas dactilares y firma digital en la sede",
      "Recibe la cédula física en policarbonato",
      "Descarga la app oficial y activa la versión digital con reconocimiento facial"
    ],
    channels: ["Sedes de la Registraduría", "App Cédula Digital Colombia"],
    sourceUrls: ["https://www.registraduria.gov.co/-Cedula-Digital-.html"],
    verifiedAt: "2026-02-01",
    published: true
  },
  {
    id: "sisben-consulta",
    title: "Consulta y actualización del Sisbén IV",
    entity: "Departamento Nacional de Planeación (DNP)",
    category: "Programas Sociales",
    description: "Consulta de grupo de clasificación socioeconómica (A, B, C, D) y solicitud de nueva encuesta o actualización de datos.",
    requirements: [
      "Documento de identidad original del jefe de hogar y de los integrantes",
      "Recibo reciente de servicio público de energía o agua del lugar de residencia",
      "Dirección exacta y datos de contacto actualizados"
    ],
    steps: [
      "Ingresa a la página oficial de consulta del Sisbén",
      "Ingresa tu tipo y número de documento para consultar tu ficha y grupo",
      "Si requieres actualización o nueva encuesta, acude a la oficina local del Sisbén en tu alcaldía municipal o realiza la solicitud por el portal ciudadano Sisbén"
    ],
    channels: ["Portal Ciudadano Sisbén", "Oficinas locales de Sisbén en cada Alcaldía"],
    sourceUrls: ["https://www.sisben.gov.co/"],
    verifiedAt: "2026-01-10",
    published: true
  },
  {
    id: "dian-rut",
    title: "Inscripción y actualización del RUT",
    entity: "Dirección de Impuestos y Aduanas Nacionales (DIAN)",
    category: "Tributario",
    description: "Inscripción en el Registro Único Tributario (RUT), actualización de responsabilidades económicas y descarga de copia en PDF.",
    requirements: [
      "Cédula de ciudadanía escaneada en formato PDF",
      "Dirección de correo electrónico activa y número telefónico",
      "Información sobre la actividad económica principal (código CIIU)"
    ],
    steps: [
      "Accede a www.dian.gov.co y selecciona 'Asignación de citas' o 'Inscripción RUT virtual'",
      "Diligencia el formulario interactivo con tus datos personales y comerciales",
      "Valida tu identidad y adjunta los documentos solicitados",
      "Descarga el documento RUT oficial en formato PDF con marca de agua 'Copia Certificada'"
    ],
    channels: ["Portal web DIAN MUISCA", "Puntos de contacto y kioscos de autogestión DIAN"],
    sourceUrls: ["https://www.dian.gov.co/impuestos/personas/Paginas/rut.aspx"],
    verifiedAt: "2026-01-20",
    published: true
  },
  {
    id: "cancilleria-pasaporte",
    title: "Expedición y renovación del Pasaporte colombiano",
    entity: "Ministerio de Relaciones Exteriores (Cancillería)",
    category: "Viajes y Migración",
    description: "Orientación para agendamiento de cita, requisitos y expedición del pasaporte ordinario o ejecutivo en Colombia.",
    requirements: [
      "Cédula de ciudadanía vigente en formato físico o cédula digital",
      "Pasaporte anterior si se trata de una renovación",
      "Pago del impuesto nacional y departamental correspondiente"
    ],
    steps: [
      "Diligencia el formulario de prerregistro en el sitio web de la Cancillería",
      "Agenda tu cita virtual en la sede de Cancillería o Gobernación departamental",
      "Acude puntualmente con tu documento a la toma fotográfica y biométrica",
      "Realiza el pago en los bancos autorizados o por PSE",
      "Reclama tu pasaporte en el plazo estipulado (usualmente 24 a 48 horas hábiles)"
    ],
    channels: ["Sedes Cancillería Bogotá", "Gobernaciones departamentales autorizadas"],
    sourceUrls: ["https://www.cancilleria.gov.co/tramites_servicios/pasaportes"],
    verifiedAt: "2026-02-10",
    published: true
  },
  {
    id: "transito-licencia",
    title: "Renovación y expedición de licencia de conducción",
    entity: "Ministerio de Transporte / RUNT",
    category: "Transporte",
    description: "Requisitos y procedimiento para obtener o refrendar la licencia de conducción para moto o vehículo particular/público.",
    requirements: [
      "Estar inscrito y activo en el Registro Único Nacional de Tránsito (RUNT)",
      "Estar a paz y salvo por concepto de multas e infracciones de tránsito (SIMIT)",
      "Examen psicosensométrico aprobado en un Centro de Reconocimiento de Conductores (CRC) certificado",
      "Certificado de aptitud en conducción de un CEA para primera vez"
    ],
    steps: [
      "Consulta tu estado y multas en www.simit.org.co y el RUNT",
      "Realiza el examen médico en un CRC autorizado de tu ciudad",
      "Agenda cita en el Organismo de Tránsito o Ventanilla Única de Movilidad",
      "Paga los derechos de trámite y recibe tu documento plástico"
    ],
    channels: ["Organismos de Tránsito Municipales", "Ventanillas Únicas de Servicios"],
    sourceUrls: ["https://www.runt.gov.co/"],
    verifiedAt: "2026-01-25",
    published: true
  },
  {
    id: "policia-antecedentes",
    title: "Certificado de antecedentes judiciales",
    entity: "Policía Nacional de Colombia",
    category: "Certificaciones",
    description: "Consulta y descarga inmediata del certificado de antecedentes judiciales para trámites laborales o institucionales.",
    requirements: [
      "Cédula de ciudadanía o extranjería",
      "Aceptar los términos y condiciones de consulta"
    ],
    steps: [
      "Ingresa al portal de antecedentes de la Policía Nacional",
      "Acepta el tratamiento de datos y selecciona tu tipo de documento",
      "Digita tu número de identificación y resuelve el código de seguridad",
      "Genera e imprime el certificado en línea de forma gratuita e inmediata"
    ],
    channels: ["Portal Web Policía Nacional"],
    sourceUrls: ["https://antecedentes.policia.gov.co:7005/WebJudicial/"],
    verifiedAt: "2026-01-05",
    published: true
  },
  {
    id: "procuraduria-antecedentes",
    title: "Certificado de antecedentes disciplinarios",
    entity: "Procuraduría General de la Nación",
    category: "Certificaciones",
    description: "Expedición gratuita en línea del certificado de antecedentes disciplinarios ordinario y especial.",
    requirements: [
      "Tipo y número de identificación personal o NIT para personas jurídicas"
    ],
    steps: [
      "Ingresa a www.procuraduria.gov.co en la sección 'Certificado de antecedentes'",
      "Elige el tipo de certificado (ordinario o especial)",
      "Ingresa el número de documento y responde la pregunta de seguridad",
      "Descarga el archivo PDF firmado digitalmente"
    ],
    channels: ["Portal Web Procuraduría General"],
    sourceUrls: ["https://www.procuraduria.gov.co/Pages/Generacion-de-antecedentes.aspx"],
    verifiedAt: "2026-01-08",
    published: true
  },
  {
    id: "colpensiones-historia",
    title: "Consulta de historia laboral y semanas cotizadas",
    entity: "Colpensiones",
    category: "Pensión y Cesantías",
    description: "Descarga del reporte consolidado de semanas cotizadas al Régimen de Prima Media y estado pensional.",
    requirements: [
      "Registro previo en la Oficina Virtual de Colpensiones",
      "Usuario y contraseña segura con autenticación en dos pasos"
    ],
    steps: [
      "Ingresa a la Sede Electrónica de Colpensiones",
      "Inicia sesión con tu documento y clave",
      "Selecciona 'Descargar Historia Laboral Unificada'",
      "Revisa los períodos cotizados por tus empleadores o de forma independiente"
    ],
    channels: ["Sede Electrónica Colpensiones", "Puntos de Atención Colpensiones (PAC)"],
    sourceUrls: ["https://www.colpensiones.gov.co/"],
    verifiedAt: "2026-02-05",
    published: true
  },
  {
    id: "ejercito-libreta",
    title: "Definición de situación militar y libreta militar",
    entity: "Comando de Reclutamiento del Ejército Nacional",
    category: "Identificación",
    description: "Inscripción, citación, liquidación de cuota de compensación militar y expedición de libreta militar o tarjeta provisional.",
    requirements: [
      "Varones colombianos mayores de 18 años",
      "Registro civil de nacimiento, cédula de ciudadanía y diploma de bachiller",
      "Documentación que acredite causales de exención de ley si aplica"
    ],
    steps: [
      "Regístrate en la plataforma www.libretamilitar.mil.co",
      "Carga los documentos solicitados en formato digital",
      "Presenta la evaluación psicofísica en el Distrito Militar correspondiente",
      "Cancela la cuota de compensación militar si no estás exento y descarga la constancia"
    ],
    channels: ["Portal Web Libreta Militar", "Distritos Militares en todo el país"],
    sourceUrls: ["https://www.libretamilitar.mil.co/"],
    verifiedAt: "2026-01-18",
    published: true
  },
  {
    id: "adres-bdua",
    title: "Consulta de afiliación en salud (BDUA / ADRES)",
    entity: "Administradora de los Recursos del Sistema General de Seguridad Social en Salud (ADRES)",
    category: "Salud",
    description: "Verificación de la EPS actual en la que te encuentras afiliado (contributivo o subsidiado) y estado de los derechos en salud.",
    requirements: [
      "Tipo de documento de identidad y número correspondiente"
    ],
    steps: [
      "Ingresa a la consulta BDUA en www.adres.gov.co",
      "Selecciona tu tipo de identificación y digita el número",
      "Resuelve el captcha de seguridad",
      "Revisa tu EPS asignada, fecha de afiliación y régimen actual"
    ],
    channels: ["Portal Oficial ADRES"],
    sourceUrls: ["https://www.adres.gov.co/consulte-su-eps"],
    verifiedAt: "2026-01-12",
    published: true
  },
  {
    id: "minvivienda-micasaya",
    title: "Postulación al subsidio de vivienda Mi Casa Ya",
    entity: "Ministerio de Vivienda, Ciudad y Territorio",
    category: "Vivienda",
    description: "Orientación para acceder al subsidio concurrente a la cuota inicial y cobertura de tasa de interés para compra de vivienda VIS.",
    requirements: [
      "Tener clasificación vigente en el Sisbén IV (grupos A1 a D20)",
      "No ser propietario de vivienda en el territorio nacional",
      "No haber sido beneficiario de subsidios familiares de vivienda",
      "Contar con un crédito hipotecario o leasing habitacional preaprobado"
    ],
    steps: [
      "Ubica el proyecto de Vivienda de Interés Social (VIS) de tu preferencia",
      "Acude a la entidad financiera o cooperativa para solicitar el crédito",
      "La entidad financiera realiza la postulación del hogar en la plataforma de MinVivienda",
      "Verifica el estado de la asignación en la página oficial del ministerio"
    ],
    channels: ["Entidades Financieras", "Cajas de Compensación Familiar", "Portal MinVivienda"],
    sourceUrls: ["https://minvivienda.gov.co/viceministerio-de-vivienda/mi-casa-ya"],
    verifiedAt: "2026-01-30",
    published: true
  },
  {
    id: "mineducacion-convalidacion",
    title: "Convalidación de títulos de educación superior del exterior",
    entity: "Ministerio de Educación Nacional",
    category: "Educación",
    description: "Reconocimiento oficial en Colombia de diplomas de pregrado y posgrado obtenidos en instituciones extranjeras.",
    requirements: [
      "Diploma original apostillado o legalizado por vía consular",
      "Certificado oficial de calificaciones y plan de estudios traducido oficialmente si aplica",
      "Pago de la tarifa de convalidación vigente"
    ],
    steps: [
      "Crea tu usuario en el Sistema VUMEN del Ministerio de Educación",
      "Diligencia el formulario y carga la documentación escaneada en alta calidad",
      "Paga los derechos de convalidación por PSE",
      "Realiza el seguimiento del trámite hasta la emisión de la resolución oficial"
    ],
    channels: ["Plataforma VUMEN Mineducación"],
    sourceUrls: ["https://www.mineducacion.gov.co/portal/convalidaciones/"],
    verifiedAt: "2026-02-02",
    published: true
  },
  {
    id: "sic-registro-marca",
    title: "Registro de marca y propiedad industrial",
    entity: "Superintendencia de Industria y Comercio (SIC)",
    category: "Comercio y Empresa",
    description: "Protección legal de signos distintivos, nombres comerciales y marcas de productos o servicios en Colombia.",
    requirements: [
      "Identificación clara de los productos o servicios según la Clasificación de Niza",
      "Búsqueda previa de antecedentes marcarios",
      "Pago de la tasa oficial de solicitud de marca"
    ],
    steps: [
      "Realiza la búsqueda de antecedentes en la plataforma SIPI",
      "Radica la solicitud de registro con el logotipo o denominación",
      "Realiza el pago de la tasa electrónica con descuento virtual",
      "Haz seguimiento a la publicación en la Gaceta de la Propiedad Industrial"
    ],
    channels: ["Plataforma SIPI - SIC"],
    sourceUrls: ["https://www.sic.gov.co/propiedad-industrial/marcas"],
    verifiedAt: "2026-01-22",
    published: true
  },
  {
    id: "dps-renta-ciudadana",
    title: "Consulta de beneficiarios de Renta Ciudadana",
    entity: "Departamento para la Prosperidad Social (DPS)",
    category: "Programas Sociales",
    description: "Verificación de inclusión en los listados de transferencias monetarias para hogares en situación de pobreza extrema.",
    requirements: [
      "Pertenecer a los grupos priorizados del Sisbén IV (Grupo A)",
      "Cédula de ciudadanía del titular del hogar"
    ],
    steps: [
      "Ingresa a la página oficial rentaciudadana.prosperidadsocial.gov.co",
      "Selecciona 'Consulte aquí si está registrado'",
      "Ingresa tus datos y valida la fecha de nacimiento",
      "Firma electrónicamente el acta de compromisos y consulta la modalidad de pago asignada (Banco Agrario o billetera digital)"
    ],
    channels: ["Portal DPS Renta Ciudadana", "Puntos Banco Agrario de Colombia"],
    sourceUrls: ["https://rentaciudadana.prosperidadsocial.gov.co/"],
    verifiedAt: "2026-02-08",
    published: true
  }
];

const input = z.object({
  intent: Intent.optional(),
  query: z.string().max(2000).default(""),
  entities: z.record(z.unknown()).default({})
});

const procedureInput = z.object({
  id: z.string().min(3),
  title: z.string().min(5),
  entity: z.string().min(3),
  category: z.string().default("General"),
  description: z.string().min(10),
  requirements: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string().url()).default([]),
  verifiedAt: z.string().default(() => new Date().toISOString().split("T")[0]),
  published: z.boolean().default(true)
});

const app = createBaseApp("recommendation-service");

const terms = (text: string) =>
  text
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\W+/)
    .filter(Boolean);

export function rankRecommendations(query: string, intent?: string): ExtendedRecommendation[] {
  const words = new Set(terms(query));
  const publishedItems = catalog.filter((item) => item.published);

  if (!query.trim()) {
    return publishedItems;
  }

  return publishedItems
    .map((item) => {
      const titleTerms = terms(item.title);
      const entityTerms = terms(item.entity);
      const categoryTerms = terms(item.category ?? "");
      const descTerms = terms(item.description);

      let score = 0;
      for (const w of words) {
        if (titleTerms.includes(w)) score += 3.0;
        if (entityTerms.includes(w)) score += 2.0;
        if (categoryTerms.includes(w)) score += 1.5;
        if (descTerms.includes(w)) score += 1.0;
      }

      if (intent === "SOLICITUD_TRAMITE") score += 0.5;
      if (intent === "CONSULTA_INFORMATIVA") score += 0.2;

      return { ...item, score };
    })
    .filter((item) => (item.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// Búsqueda de recomendaciones
app.post("/api/v1/recommendations", (req, res) => {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Consulta inválida." } });
  const recommendations = rankRecommendations(parsed.data.query, parsed.data.intent);
  void publishEvent(makeEvent("recommendation.generated", "recommendation-service", { count: recommendations.length, intent: parsed.data.intent }));
  res.json({ recommendations, deterministic: true, generatedAt: new Date().toISOString() });
});

// Listado de trámites con búsqueda opcional
app.get("/api/v1/procedures/search", (req, res) => {
  const q = String(req.query.q ?? "");
  res.json({ results: rankRecommendations(q) });
});

// Obtener todos los trámites (con opción de incluir no publicados para admin)
app.get("/api/v1/procedures", (req, res) => {
  const all = req.query.all === "true";
  const items = all ? catalog : catalog.filter((item) => item.published);
  res.json({ procedures: items, total: items.length });
});

// Detalle de un trámite por ID
app.get("/api/v1/procedures/:id", (req, res) => {
  const result = catalog.find((item) => item.id === req.params.id);
  if (!result) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no encontrado o no verificado." } });
  res.json(result);
});

// Crear nuevo trámite (Admin)
app.post("/api/v1/procedures", (req, res) => {
  const parsed = procedureInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Datos de trámite inválidos." } });
  const existing = catalog.find((item) => item.id === parsed.data.id);
  if (existing) return res.status(409).json({ error: { code: "CONFLICT", message: "Ya existe un trámite con este ID." } });
  const procedure: ExtendedRecommendation = parsed.data;
  catalog.push(procedure);
  void publishEvent(makeEvent("procedure.created", "recommendation-service", { procedureId: procedure.id, title: procedure.title }));
  res.status(201).json(procedure);
});

// Actualizar trámite existente (Admin)
app.put("/api/v1/procedures/:id", (req, res) => {
  const index = catalog.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no encontrado." } });
  const parsed = procedureInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Actualización inválida." } });
  catalog[index] = { ...catalog[index], ...parsed.data };
  void publishEvent(makeEvent("procedure.updated", "recommendation-service", { procedureId: req.params.id }));
  res.json(catalog[index]);
});

// Eliminar trámite (Admin)
app.delete("/api/v1/procedures/:id", (req, res) => {
  const index = catalog.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Trámite no encontrado." } });
  const deleted = catalog.splice(index, 1)[0];
  void publishEvent(makeEvent("procedure.deleted", "recommendation-service", { procedureId: req.params.id }));
  res.status(204).send();
});

// Lista de entidades oficiales
app.get("/api/v1/entities", (_req, res) => {
  res.json({ entities: [...new Set(catalog.filter((item) => item.published).map((item) => item.entity))] });
});

// Lista de categorías
app.get("/api/v1/categories", (_req, res) => {
  res.json({ categories: [...new Set(catalog.filter((item) => item.published).map((item) => item.category ?? "General"))] });
});

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3003);
  const server = app.listen(port, () => logger.info({ port }, "recommendation-service listening"));
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
