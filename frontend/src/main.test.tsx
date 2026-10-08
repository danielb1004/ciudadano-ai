import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
vi.mock("./api", () => {
  const api={get:vi.fn(async()=>({data:{procedures:[],consents:[]}})),post:vi.fn(async()=>({data:{}})),patch:vi.fn(),delete:vi.fn()};
  return {api,authApi:api,catalogApi:api,profileApi:api,auditApi:api,nlpApi:api,ensureProfile:vi.fn(async()=>"test-profile"),apiError:()=> "Servicio no disponible"};
});
import { App } from "./main";
beforeEach(()=>{localStorage.clear();sessionStorage.clear();HTMLElement.prototype.scrollIntoView=vi.fn();});
afterEach(cleanup);
const open=(path:string)=>render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
describe("interfaz ciudadana real",()=>{
  it("ofrece inicio y navegación",()=>{open("/");expect(screen.getByRole("link",{name:"Saltar al contenido principal"})).toBeInTheDocument();expect(screen.getByRole("heading",{level:1})).toBeInTheDocument();});
  it("permite redactar y bloquea el envío hasta aceptar consentimiento",async()=>{open("/chat");expect(screen.getByRole("textbox",{name:"Consulta sobre trámites"})).toBeEnabled();expect(screen.getByRole("button",{name:"Enviar"})).toBeDisabled();const button=await screen.findByRole("button",{name:"Acepto e inicio la conversación"});expect(button).toBeInTheDocument();});
  it("restringe consulta a 500 caracteres",()=>{open("/chat");expect(screen.getByRole("textbox",{name:"Consulta sobre trámites"})).toHaveAttribute("maxlength","500");});
  it("permite abrir navegación móvil",()=>{open("/");fireEvent.click(screen.getByRole("button",{name:"Abrir menú"}));expect(screen.getAllByRole("link",{name:"Asistente Virtual"}).length).toBe(2);});
  it("no precarga una contraseña administrativa",()=>{open("/admin");expect(screen.getByLabelText("Contraseña")).toHaveValue("");});
  it("ofrece controles de los datos propios",()=>{open("/privacidad");expect(screen.getByRole("button",{name:/Consultar datos/})).toBeInTheDocument();expect(screen.getByRole("button",{name:/Eliminar todo/})).toBeInTheDocument();});
});
