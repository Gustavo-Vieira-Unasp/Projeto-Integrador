set -e

mkdir -p docs/test-strategy/evidencias

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="docs/test-strategy/evidencias/run-${TIMESTAMP}.txt"

echo "===========================================" | tee "$LOG_FILE"
echo "Teste de Contrato - API Horta Ref" | tee -a "$LOG_FILE"
echo "Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "Issue #3 - Riscos #3 e #4" | tee -a "$LOG_FILE"
echo "===========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Verificando API em http://localhost:8000..." | tee -a "$LOG_FILE"
if curl -s -f -o /dev/null http://localhost:8000/; then
    echo "✓ API está respondendo" | tee -a "$LOG_FILE"
else
    echo "✗ API não está disponível!" | tee -a "$LOG_FILE"
    echo "Execute: cd aula-13/assets/api-horta-ref/ && uvicorn main:app --reload" | tee -a "$LOG_FILE"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"

echo "Executando pytest - test_api_leituras.py" | tee -a "$LOG_FILE"
echo "-------------------------------------------" | tee -a "$LOG_FILE"

pytest test-strategy/contract/test_api_leituras.py \
    --tb=short \
    -v \
    2>&1 | tee -a "$LOG_FILE"

PYTEST_EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"
echo "===========================================" | tee -a "$LOG_FILE"
echo "Fim da execução: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "Exit code: $PYTEST_EXIT_CODE" | tee -a "$LOG_FILE"
echo "Log salvo em: $LOG_FILE" | tee -a "$LOG_FILE"
echo "===========================================" | tee -a "$LOG_FILE"

exit $PYTEST_EXIT_CODE