/**
 * Cenários cobertos - pequena checklist:
 *   normal  — leituras dentro das faixas nominais do SRS
 *   pico    — valores próximos aos limites máximos dos sensores
 *   offline — dispositivo sem comunicação, nenhum sensor reportando
 *   parcial — subset de sensores disponível (ex.: LDR com falha de leitura)
 */

import type { CenarioMock, PayloadMock } from '../types/sensor';


function isoAgora(offsetMinutos = 0): string {

  const d = new Date(Date.now() + offsetMinutos * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  
}


function variar(base: number, amplitude: number, min: number, max: number): number {

  const ruido = (Math.random() * 2 - 1) * amplitude;
  return parseFloat(Math.min(max, Math.max(min, base + ruido)).toFixed(1));
}


export const leituraNormal = (): PayloadMock => ({

  device_id: 'esp32-horta-01',
  timestamp: isoAgora(),
  cenario: 'normal',
  temperatura_c:    variar(28.5, 0.5, -40, 80),
  umidade_ar_pct:   variar(65.0, 1.0,   0, 100),
  umidade_solo_pct: variar(42.0, 1.5,   0, 100),
  luminosidade_lux: variar(4200, 100,   10, 10000),
  bateria_pct:      variar(78.0, 1.0,   0, 100),

});


export const leituraPico = (): PayloadMock => ({

  device_id: 'esp32-horta-01',
  timestamp: isoAgora(),
  cenario: 'pico',
  temperatura_c:    variar(79.0, 0.3, -40, 80),  
  umidade_ar_pct:   variar(97.0, 0.5,   0, 100),
  umidade_solo_pct: variar(12.0, 0.8,   0, 100),  
  luminosidade_lux: variar(9800, 80,    10, 10000), 
  bateria_pct:      variar(22.0, 1.0,   0, 100), 

});




export const leituraOffline = (): PayloadMock => ({

  device_id: 'esp32-horta-01',
  timestamp: isoAgora(-5),
  cenario: 'offline',
  temperatura_c:    null,
  umidade_ar_pct:   null,
  umidade_solo_pct: null,
  luminosidade_lux: null,
  bateria_pct:      null,

});



export const leituraParcial = (): PayloadMock => ({

  device_id: 'esp32-horta-01',
  timestamp: isoAgora(),
  cenario: 'parcial',

  temperatura_c:    variar(26.0, 0.5, -40, 80),

  umidade_ar_pct:   variar(70.0, 1.0,   0, 100),

  umidade_solo_pct: variar(55.0, 1.5,   0, 100),

  luminosidade_lux: null,                         

  bateria_pct:      variar(85.0, 1.0,   0, 100),
});



export const historicoMock: PayloadMock[] = [
  { ...leituraNormal(), timestamp: isoAgora(-10) },

  { ...leituraNormal(), timestamp: isoAgora(-8)  },

  { ...leituraNormal(), timestamp: isoAgora(-6)  },

  { ...leituraParcial(), timestamp: isoAgora(-4) },
  
  { ...leituraOffline(), timestamp: isoAgora(-2) },
  
  { ...leituraNormal(), timestamp: isoAgora(0)   }, 
];



export const mockPorCenario: Record<CenarioMock, () => PayloadMock> = {
  normal:  leituraNormal,
  pico:    leituraPico,
  offline: leituraOffline,
  parcial: leituraParcial,
};