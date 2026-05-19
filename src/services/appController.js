import { 
  gerarHistoricoTemporal, 
  renderNavbar, 
  renderCardSensor, 
  renderSidePanels, 
  renderControlesTeste 
} from './appRenderService.js';

let cenarioAtual = 'normal';
let simularErroConexao = false;
let filtroPeriodoHoras = 24; 
let bombaManualAtiva = false;
let historicoCompleto = gerarHistoricoTemporal();
let pontoSelecionado = null; 
let chartInstance = null;
let temporizadorRealtime = null;

const navContainer = document.getElementById('nav-container');
const appContainer = document.getElementById('app-container');

function obterPontosFiltrados() {
  const agora = new Date();
  const horas = agora.getHours();
  const minutos = agora.getMinutes();
  
  const minutosTotaisDoDia = (horas * 60) + minutos;
  let indiceMaximo = Math.floor(minutosTotaisDoDia / 2);
  
  if (indiceMaximo >= historicoCompleto.length) {
    indiceMaximo = historicoCompleto.length - 1;
  }
  
  const pontosAteAgora = historicoCompleto.slice(0, indiceMaximo + 1);
  const pontosAExibir = (filtroPeriodoHoras * 30); 
  
  if (pontosAteAgora.length > pontosAExibir) {
    return pontosAteAgora.slice(pontosAteAgora.length - pontosAExibir);
  }
  return pontosAteAgora;
}

async function processarCicloUI() {
  const pontosDisponiveis = obterPontosFiltrados();
  const ultimoPontoRealtime = pontosDisponiveis[pontosDisponiveis.length - 1] || historicoCompleto[0];

  if (!pontoSelecionado || !pontosDisponiveis.some(p => p.horario === pontoSelecionado.horario)) {
    pontoSelecionado = ultimoPontoRealtime;
  }

  navContainer.innerHTML = renderNavbar(cenarioAtual);

  if (simularErroConexao) {
    renderizarTelaErro();
    return;
  }

  renderizarDashboardCompleto(ultimoPontoRealtime);
  inicializarGrafico(pontosDisponiveis);
}

function renderizarTelaErro() {
  appContainer.innerHTML = `
    <div class="bg-red-950/20 border border-red-900/40 p-5 rounded-lg shadow-xl mt-4">
      <h3 class="text-red-400 font-mono font-bold text-sm flex items-center gap-2">⚠️ Uncaught SyntaxError: HTTP Request Failure</h3>
      <p class="text-slate-400 font-mono text-xs mt-1">O endpoint de telemetria falhou em retornar o payload JSON.</p>
      <button id="btn-retry" class="mt-3 px-3 py-1 bg-red-900 hover:bg-red-800 border border-red-700 text-red-200 font-mono text-xs rounded transition-colors">Retry Connection</button>
    </div>
    <div class="mt-4">${renderControlesTeste(cenarioAtual, simularErroConexao)}</div>`;
  vincularEventos();
}

function renderizarDashboardCompleto(ultimoPontoRealtime) {
  const isOffline = cenarioAtual === 'offline';
  const dados = isOffline ? {
    temperatura_c: null, umidade_ar_pct: null, umidade_solo_pct: null, luminosidade_lux: null, bateria_pct: null, i2c_ok: false
  } : { ...pontoSelecionado };

  if (bombaManualAtiva && !isOffline) {
    dados.umidade_solo_pct = Math.min(100, parseFloat((dados.umidade_solo_pct + 12).toFixed(1)));
  }

  appContainer.innerHTML = `
    <div class="text-[11px] font-mono text-slate-500 select-none">
      Telemetry Router: <span class="text-slate-300 font-bold text-xs">esp32-horta-01</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      
      <div class="lg:col-span-2 space-y-5">
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${renderCardSensor('Umid. Solo', dados.umidade_solo_pct, '%', cenarioAtual, dados.umidade_solo_pct <= 52 ? 'Solo Seco' : 'Úmido')}
          ${renderCardSensor('Umid. Ar', dados.umidade_ar_pct, '%', cenarioAtual, dados.umidade_ar_pct < 40 ? 'Ar Seco' : 'Agradável')}
          ${renderCardSensor('Temperatura', dados.temperatura_c, '°C', cenarioAtual, 'Agradável')}
        </div>

        <div class="bg-[#0f172a] border border-slate-800/80 p-4 rounded-lg shadow-md space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tendências em tempo real</span>
            
            <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span class="text-slate-500 px-1 font-bold text-[9px] uppercase tracking-wider">Janela:</span>
              ${[0.5, 1, 6, 24].map(h => {
                const label = h === 0.5 ? '30m' : `${h}h`;
                return `
                  <button data-horas="${h}" class="btn-periodo px-2 py-0.5 rounded font-bold transition-all ${filtroPeriodoHoras === h ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200'}" >${label}</button>
                `;
              }).join('')}
            </div>
          </div>
          <p class="text-[9px] font-mono text-slate-500 -mt-1">Gráfico multissérie | Eixo Y Esq: % | Eixo Y Dir: Lux</p>
          <div class="h-52 w-full">
            <canvas id="analiseChart"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
        ${renderSidePanels(dados, cenarioAtual, bombaManualAtiva)}
      </div>
    </div>

    ${renderControlesTeste(cenarioAtual, simularErroConexao)}
  `;

  vincularEventos();
}

function inicializarGrafico(pontosDisponiveis) {
  const ctx = document.getElementById('analiseChart');
  if (!ctx) return;

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pontosDisponiveis.map(p => p.horario),
      datasets: [
        {
          label: 'Umid. Solo (%)',
          data: pontosDisponiveis.map(p => p.umidade_solo_pct),
          borderColor: '#34d399',
          backgroundColor: 'transparent',
          tension: 0.1,
          yAxisID: 'yLeft',
          pointRadius: pontosDisponiveis.length > 100 ? 0.5 : 2
        },
        {
          label: 'Luz (Lux)',
          data: pontosDisponiveis.map(p => (cenarioAtual === 'parcial' ? null : p.luminosidade_lux)),
          borderColor: '#eab308',
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.1,
          yAxisID: 'yRight',
          pointRadius: pontosDisponiveis.length > 100 ? 0.5 : 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          pontoSelecionado = pontosDisponiveis[index];
          processarCicloUI();
        }
      },
      scales: {
        x: { 
          grid: { color: '#1e293b/40' }, 
          ticks: { 
            color: '#64748b', 
            font: { size: 8, family: 'mono' },
            callback: function(val, index) {
              const modulo = filtroPeriodoHoras <= 1 ? 10 : 30;
              return index % modulo === 0 ? this.getLabelForValue(val) : '';
            }
          } 
        },
        yLeft: { min: 20, max: 100, grid: { color: '#1e293b/40' }, ticks: { color: '#34d399', font: { size: 8 } } },
        yRight: { min: 0, max: 10000, grid: { drawOnChartArea: false }, ticks: { color: '#eab308', font: { size: 8 } } }
      }
    }
  });
}

function vincularEventos() {
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) btnRetry.addEventListener('click', processarCicloUI);

  document.querySelectorAll('.btn-periodo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      filtroPeriodoHoras = parseFloat(e.target.getAttribute('data-horas'));
      processarCicloUI();
    });
  });

  const btnBomba = document.getElementById('btn-toggle-bomba');
  if (btnBomba) {
    btnBomba.addEventListener('click', () => {
      bombaManualAtiva = !bombaManualAtiva;
      processarCicloUI();
    });
  }

  document.querySelectorAll('.btn-cenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      cenarioAtual = e.target.getAttribute('data-cenario');
      simularErroConexao = false;
      processarCicloUI();
    });
  });

  const btnToggleError = document.getElementById('btn-toggle-error');
  if (btnToggleError) {
    btnToggleError.addEventListener('click', () => {
      simularErroConexao = !simularErroConexao;
      processarCicloUI();
    });
  }
}

function inicializarEngineRealtime() {
  if (temporizadorRealtime) clearInterval(temporizadorRealtime);
  temporizadorRealtime = setInterval(processarCicloUI, 120000); 
}

processarCicloUI();
inicializarEngineRealtime();