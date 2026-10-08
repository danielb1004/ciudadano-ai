# Estado del ensayo JMeter

Pendiente de ejecución real. Plan: testing/jmeter/conversation-load.jmx, 500 usuarios virtuales, rampa 60 s, duración 300 s, consultas repetidas y tokens propios por perfil con consentimiento.

El analizador procesa un JTL real y omite 60 s iniciales por defecto. Informa errores y p50/p95/p99; CPU/memoria quedan vacíos si no existe monitoreo separado. Distribuir IP de clientes para respetar el límite 60/min/IP. No se afirma la media 743 ms del Word ni simultaneidad a partir de la configuración del plan.
