/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Função construtora clássica para emular a classe Chart perfeitamente
const MockChart = function() {
  return {
    destroy: vi.fn(),
    update: vi.fn()
  };
};

describe('Dashboard PHorta - Validação Comportamental da UI (Matriz A1.6 / RE-04)', () => {
  
  beforeEach(() => {
    // 1. Monta a estrutura base do DOM idêntica ao index.html
    document.body.innerHTML = `
      <div id="nav-container"></div>
      <main id="app-container" class="w-full max-w-6xl mx-auto p-4 space-y-6"></main>
    `;

    // 2. Injeta o construtor clássico no escopo global para o script CDN simulado
    globalThis.Chart = MockChart;
    window.Chart = MockChart;
    
    // 3. Reseta o cache de módulos do Vitest para isolar os estados de cada teste
    vi.resetModules();
  });

  test('Deve renderizar o Estado Feliz nominal com telemetria ativa e Navbar [ Online ]', async () => {
    await import('./appController.js');

    const navContainer = document.getElementById('nav-container');
    const appContainer = document.getElementById('app-container');

    expect(navContainer.innerHTML).toContain('[ Online ]');
    expect(appContainer.innerHTML).toContain('Telemetry Router:');
    expect(appContainer.innerHTML).toContain('Umid. Solo');
    expect(appContainer.innerHTML).not.toContain('HTTP Request Failure');
  });

  test('Deve chavear para o Estado de Erro e conter o fluxo reativo de Retry Connection', async () => {
    await import('./appController.js');

    const btnToggleError = document.getElementById('btn-toggle-error');
    expect(btnToggleError).not.toBeNull();

    // Interação 1: Ativa o estado de erro simulado da API
    btnToggleError.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const appContainer = document.getElementById('app-container');
    
    expect(appContainer.innerHTML).toContain('HTTP Request Failure');
    expect(appContainer.innerHTML).toContain('O endpoint de telemetria falhou em retornar o payload JSON.');

    // Encontra o botão de Retry instanciado no container de erro
    const btnRetry = document.getElementById('btn-retry');
    expect(btnRetry).not.toBeNull();

    // Interação 2: Simula o restabelecimento do sinal desligando o chaveador de erro
    // Isso garante que o clique em Retry possa re-renderizar o estado estável
    btnToggleError.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    // Interação 3: Dispara o Retry Connection reativo
    btnRetry.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    // Verificação Final: O erro deve sumir e o dashboard nominal deve retornar à tela
    expect(appContainer.innerHTML).not.toContain('HTTP Request Failure');
    expect(appContainer.innerHTML).toContain('Telemetry Router:');
  });
});