import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('consentimiento, consulta, seguimiento, exportación y eliminación', async ({ page }) => {
  await page.goto('/chat');
  const input = page.getByRole('textbox', {name:'Consulta sobre trámites'});
  await expect(input).toBeEnabled();
  await page.getByRole('button', {name:'Acepto e inicio la conversación'}).click();
  await expect(input).toBeEnabled();
  await input.fill('Necesito sacar el pasaporte en Bogotá');
  await page.getByRole('button', {name:'Enviar', exact:true}).click();
  await expect(page.getByText(/Costo: /).first()).toBeVisible();
  await input.fill('¿Cuáles son los requisitos?');
  await page.getByRole('button', {name:'Enviar', exact:true}).click();
  await expect(page.getByText(/Requisitos:/).last()).toBeVisible();
  await page.goto('/privacidad');
  await page.getByRole('button', {name:/Consultar datos/i}).click();
  await expect(page.getByText('Expediente de Datos Anonimizados')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:/Descargar copia/i}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  page.once('dialog', dialog=>dialog.accept());
  await page.getByRole('button', {name:/Eliminar todo/i}).click();
  await expect(page.getByText(/eliminados|eliminada/i).first()).toBeVisible();
});
for (const path of ['/', '/chat', '/tramites', '/privacidad', '/admin']) {
  test('accesibilidad automática y ancho móvil '+path, async ({page})=>{
    await page.setViewportSize({width:320,height:780});
    await page.goto(path); await page.waitForTimeout(700);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addScriptTag({content:readFileSync('node_modules/axe-core/axe.min.js','utf8')});
    const result = await page.evaluate(async()=> await (window as any).axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
    expect(result.violations.map((v:any)=>({id:v.id, nodes:v.nodes.map((n:any)=>n.target)}))).toEqual([]);
  });
}

test('OTP y estado simulado de una solicitud propia', async ({page})=>{
  await page.goto('/chat');await page.getByRole('button',{name:'Acepto e inicio la conversación'}).click();
  await page.getByText('Consultar el estado de una solicitud propia',{exact:true}).click();
  await page.getByLabel('Correo de verificación').fill('ciudadano-demo@example.test');
  await page.getByRole('button',{name:'Solicitar código'}).click();
  const code=await page.locator('[role="status"] strong').textContent();
  await page.getByLabel('Código de seis dígitos').fill(code!);
  await page.getByRole('button',{name:'Verificar código'}).click();
  await page.getByLabel('Número de radicado').fill('DEMO-001');
  await page.getByRole('button',{name:'Consultar estado',exact:true}).click();
  await expect(page.getByText('Resultado simulado del prototipo académico')).toBeVisible();
  await expect(page.getByText('Estado: En revisión',{exact:true})).toBeVisible();
});
test('catálogo con diálogo accesible a 1920 px',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/tramites');
  await page.getByRole('button',{name:/Ver detalles/i}).first().click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(page.locator(':focus')).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
