/** ID único do dispositivo ESP32 */
export type DeviceId = string;

/** Leitura do DHT22*/
export interface LeituraDHT22 {
  temperatura_c: number;
  umidade_ar_pct: number;
}

/** Leitura do sensor capacitivo de solo */
export interface LeituraSolo {
  umidade_solo_pct: number;
}

/** Leitura do LDR */

 export interface LeituraLDR {
  luminosidade_lux: number;
}

/**  Estado do atuador (relé + bomba) */
export interface EstadoAtuador {
  irrigacao_ativa: boolean;
  
  corrente_a: number | null;
}

/** Nível da bateria solar —*/
export interface EstadoEnergia {
  bateria_pct: number;
}


export interface PayloadLeitura
  extends LeituraDHT22,
    LeituraSolo,
    LeituraLDR {
  device_id: DeviceId;
  
  timestamp: string;
  
  bateria_pct?: number;
}

 
export type CenarioMock = 'normal' | 'pico' | 'offline' | 'parcial';

/** para representar sensores offline ou parcialmente disponíveis. */
export interface PayloadMock {
  device_id: DeviceId;
  timestamp: string;
  cenario: CenarioMock;
  temperatura_c: number | null;
  umidade_ar_pct: number | null;
  umidade_solo_pct: number | null;
  luminosidade_lux: number | null;
  bateria_pct: number | null;
}


export interface RespostaLeitura extends PayloadLeitura {
  id: string;
  /** pra quem ta lendo e não entender a ideia é que ele indica se a leitura passou na validação do servidor */
  valido: boolean;

  motivo_rejeicao?: string;
}


export type ResultadoFetch =
  | { ok: true; dados: PayloadMock }
  | { ok: false; erro: string };