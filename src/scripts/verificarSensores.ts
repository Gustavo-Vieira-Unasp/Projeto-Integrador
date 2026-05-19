import { fetchSensorData, isMockAtivo } from '../services/sensorService';

async function rodarVerificacao() {
  console.log(`Mock Ativo: ${isMockAtivo()}`);
  
  const normal = await fetchSensorData('normal');
  console.log('Cenário Normal OK?', normal.ok);

  const parcial = await fetchSensorData('parcial');
  console.log('Luminosidade Parcial (deve ser null):', parcial.ok ? parcial.dados.luminosidade_lux : 'Erro');
}

rodarVerificacao();