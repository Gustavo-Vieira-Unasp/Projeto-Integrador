### RF-001: Software
*Descrição: *
*Prioridade: 
            * Must have:
            * Should have:
            * Could Have:
*Critério de Aceitação:

---

### RF-002: Sensor de Umidade do Solo
*Descrição: * O sistema DEVE ser capaz de captar dados sobre a umidade do solo e DEVE passar tais dados.
*Prioridade: 
            * Must have: 
                * Taxa de Amostragem: O sensor DEVE realizar uma nova leitura a cada 2 minutos (670 análises por dia);
                * Latência Máxima: O atraso (delay) entre a captura do sinal físico e a disponibilidade do dado processado na saída do controlador não deve exceder 500ms;
                * Acurácia: Erro máximo tolerado de 3% (para mais ou para menos) em relação à curva de calibração do fabricante;
            * Should have:
                * Estabilidade de Sinal: Implementação de filtro de média móvel para ignorar picos de ruído eletromagnético em intervalos menores que 100ms;
                * Proteção: Grau de proteção IP67 para operação em solo saturado;
            * Could Have: Modo de baixo consumo (Deep Sleep) entre os intervalos de leitura para preservação de bateria;
*Critério de Aceitação:
            * Teste de Jitter: Em um ciclo de 1 hora, o intervalo entre leituras não deve oscilar mais do que 1% do tempo de amostragem definido;
            * Validação de Delay: Medir via osciloscópio ou log de sistema o tempo entre o trigger do sensor e a escrita no registro de saída, garantindo que seja < 500ms;
            * Prova de Estresse: O sistema deve manter a precisão de leitura mesmo após 24h de exposição a solo com condutividade elétrica variada;

---

### RF-003: Atuador (Elétrico) de Janela
*Descrição: * O sistema DEVE ser capaz de reconhecer temperatura e umidade com 80% de precisão; DEVE ser capaz de abrir e fechar.
*Prioridade: 
            * Must have: O tempo de abrir e fechar NÃO DEVE ultrapassar 10s; 
            * Should have: A protecao contra umidade DEVERIA ser de IPX6;
            * Could Have: 
            * Would have:
*Critério de Aceitação: * [Como eu provarei que isso funciona?]