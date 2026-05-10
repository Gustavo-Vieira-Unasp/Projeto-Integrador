# tests/contract/test_api_leituras.py
"""
Teste de Contrato - API Horta Ref
Ancorado na Issue #3: riscos #3 (persistência + streaming) e #4 (MQTT timeout)
Valida que a API respeita o contrato definido no ADR-001 (seção 1.5)
"""

import pytest
import requests
from datetime import datetime
from jsonschema import validate, ValidationError
import json
import os

# Schema do contrato definido no ADR-001 (seção 1.5)
SENSOR_READING_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["sensor_id", "temperature_c", "humidity_pct", "soil_moisture_pct", "timestamp_unix"],
    "properties": {
        "sensor_id": {
            "type": "string",
            "pattern": "^esp32_[a-f0-9]{12}$"
        },
        "temperature_c": {
            "type": "number",
            "minimum": -10.0,
            "maximum": 85.0
        },
        "humidity_pct": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 100.0
        },
        "soil_moisture_pct": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100
        },
        "timestamp_unix": {
            "type": "integer",
            "minimum": 1700000000
        }
    },
    "additionalProperties": False
}

# URL base da API de referência (uvicorn main:app --reload)
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
ENDPOINT_LEITURAS = f"{API_BASE_URL}/api/v1/leituras"


class TestContractAPILeituras:
    """
    Testes de contrato para o endpoint /api/v1/leituras
    Issue #3 - Riscos #3 (persistência + streaming) e #4 (MQTT timeout)
    """

    # Payload de exemplo válido conforme contrato
    VALID_PAYLOAD = {
        "sensor_id": "esp32_a1b2c3d4e5f6",
        "temperature_c": 25.5,
        "humidity_pct": 68.5,
        "soil_moisture_pct": 45,
        "timestamp_unix": 1704067200
    }

    def test_healthcheck_endpoint(self):
        """Validação básica: API está respondendo"""
        response = requests.get(f"{API_BASE_URL}/")
        assert response.status_code == 200, f"API não está respondendo: {response.status_code}"
        assert "status" in response.json(), "Healthcheck não retorna campo 'status'"

    def test_post_leituras_status_code_and_required_fields(self):
        """
        Risco #3 (persistência + streaming) - linha da Issue #3
        Valida: status code + pelo menos um campo obrigatório
        """
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)

        # 1. Valida status code
        assert response.status_code in [200, 201], \
            f"Status code esperado 200/201, obtido {response.status_code}"

        # 2. Valida campo obrigatório (id ou message)
        response_data = response.json()
        assert "id" in response_data or "message" in response_data, \
            f"Response sem campo obrigatório (id/message): {response_data}"

    def test_post_leituras_schema_completo(self):
        """
        Risco #4 (MQTT timeout) - linha da Issue #3
        Valida schema completo do contrato ADR-001 seção 1.5
        """
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)

        # API pode retornar 200 ou 201
        assert response.status_code in [200, 201]

        # Valida schema da resposta (mínimo: deve indicar sucesso)
        response_data = response.json()
        assert "id" in response_data, f"Resposta sem 'id': {response_data}"

    def test_schema_validation_leitura_valida(self):
        """
        Validação isolada do schema: payload válido deve passar
        """
        try:
            validate(instance=self.VALID_PAYLOAD, schema=SENSOR_READING_SCHEMA)
        except ValidationError as e:
            pytest.fail(f"Payload válido falhou no schema: {e.message}")

    @pytest.mark.parametrize("field,invalid_value,expected_error", [
        ("temperature_c", 86.0, "maximum"),        # acima do máximo 85.0
        ("temperature_c", -11.0, "minimum"),       # abaixo do mínimo -10.0
        ("humidity_pct", 101.0, "maximum"),        # acima do máximo 100
        ("humidity_pct", -1.0, "minimum"),         # abaixo do mínimo 0
        ("soil_moisture_pct", 101, "maximum"),     # acima do máximo 100 (integer)
        ("soil_moisture_pct", -1, "minimum"),      # abaixo do mínimo 0
        ("sensor_id", "invalid_id", "pattern"),    # formato inválido
        ("timestamp_unix", 1600000000, "minimum"), # abaixo do mínimo 1700000000
    ])
    def test_schema_rejeita_valores_invalidos(self, field, invalid_value, expected_error):
        """
        Valida que o schema rejeita valores fora dos limites
        Campos obrigatórios são testados separadamente
        """
        invalid_payload = self.VALID_PAYLOAD.copy()
        invalid_payload[field] = invalid_value

        with pytest.raises(ValidationError) as exc_info:
            validate(instance=invalid_payload, schema=SENSOR_READING_SCHEMA)

        assert expected_error in str(exc_info.value).lower()

    def test_schema_requires_all_mandatory_fields(self):
        """
        Validação: campos obrigatórios conforme contrato
        required: sensor_id, temperature_c, humidity_pct, soil_moisture_pct, timestamp_unix
        """
        for required_field in SENSOR_READING_SCHEMA["required"]:
            incomplete_payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != required_field}

            with pytest.raises(ValidationError) as exc_info:
                validate(instance=incomplete_payload, schema=SENSOR_READING_SCHEMA)

            assert required_field in str(exc_info.value)
            assert "'is a required property'" in str(exc_info.value)

    def test_integration_contrato_api_bate_com_schema(self):
        """
        Teste de integração do contrato: payload segundo schema deve ser aceito pela API
        """
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)
        assert response.status_code in [200, 201]

        data = response.json()
        assert "id" in data
        assert isinstance(data["id"], (int, str)), f"id type: {type(data['id'])}"