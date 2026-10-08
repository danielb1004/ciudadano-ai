import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const existing=existsSync(".env") ? readFileSync(".env","utf8") : "";
let result=existing;
const replacements={"replace-with-32-byte-secret":randomBytes(48).toString("hex"),"replace-with-64-hex-characters":randomBytes(32).toString("hex"),"replace-with-internal-key":randomBytes(32).toString("hex"),"replace-with-audit-key":randomBytes(32).toString("hex"),"replace-with-identity-key":randomBytes(32).toString("hex"),"change-me-in-secret-store":randomBytes(24).toString("hex")};
for(const line of readFileSync(".env.example","utf8").split(/\r?\n/)) {
  const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if(!match) continue;
  if(new RegExp("^"+match[1]+"=","m").test(existing)) continue;
  let value=match[2];for(const [from,to] of Object.entries(replacements)) value=value.replaceAll(from,to);
  result+=(result.endsWith("\n")||!result?"":"\n")+match[1]+"="+value+"\n";
}
writeFileSync(".env",result,{mode:0o600});
console.log("Configuración local preparada; valores existentes conservados y secretos nuevos generados.");
