import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
if (existsSync(".env")) process.loadEnvFile(".env");
const env = { ...process.env, NODE_ENV: "development", INSTITUTIONAL_MODE: process.env.INSTITUTIONAL_MODE ?? "mock", NLP_BACKEND: process.env.NLP_BACKEND ?? "rules" };
delete env.PORT;
if (env.USE_INFRASTRUCTURE !== "true") { delete env.POSTGRES_HOST; delete env.REDIS_URL; delete env.KAFKA_BROKERS; env.TRUSTED_PROXIES = "loopback"; }
const children = [];
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Ejecuta npm run dev.");
const python = env.PYTHON_EXECUTABLE ?? (process.platform === "win32" ? path.resolve(".venv/Scripts/python.exe") : path.resolve(".venv/bin/python"));
if (!existsSync(python)) throw new Error("Crea .venv e instala services/nlp-service/requirements.txt. Consulta README.");
function launch(command, args, cwd = process.cwd()) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit", windowsHide: true }); children.push(child);
  child.on("error", error => { console.error(error.message); shutdown(1); });
  child.on("exit", code => { if (code && !closing) shutdown(code); });
}
let closing = false;
function shutdown(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill(); process.exitCode = code; }
for (const service of ["audit-service", "auth-service", "catalog-service", "recommendation-service", "conversation-service"]) launch(process.execPath, [npmCli, "run", "dev", "--workspace", "services/" + service]);
launch(python, ["-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8001"], path.resolve("services/nlp-service"));
launch(process.execPath, [npmCli,"run","dev","--workspace","frontend"]);
process.once("SIGTERM",()=>shutdown()); process.once("SIGINT",()=>shutdown());
