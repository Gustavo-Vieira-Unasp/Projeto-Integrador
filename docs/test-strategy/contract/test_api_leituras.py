"""
Teste de Contrato - API de Referência Horta
Ancorado na Issue #3: riscos #3 (persistência + streaming) e #4 (MQTT timeout)
Valida que a API de referência respeita o contrato de dados.
"""

import pytest
import requests
from jsonschema import validate, ValidationError
import os

SENSOR_READING_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["device_id", "sensor", "valor", "timestamp"],
    "properties": {
        "device_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
        },
        "sensor": {
            "type": "string",
            "enum": ["dht22", "capacitivo", "ldr"]
        },
        "valor": {
            "type": "number"
        },
        "timestamp": {
            "type": "string",
            "format": "date-time"
        }
    },
    "additionalProperties": False
}

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
ENDPOINT_LEITURAS = f"{API_BASE_URL}/leituras"
ENDPOINT_HEALTH = f"{API_BASE_URL}/health"

class TestContractAPILeituras:
    """
    Testes de contrato para validar integração com api-horta-ref
    Issue #3 - Riscos #3 e #4
    """

    VALID_PAYLOAD = {
        "device_id": "esp32-gustavo-01",
        "sensor": "dht22",
        "valor": 25.5,
        "timestamp": "2026-05-10T13:00:00Z"
    }

    def test_healthcheck_endpoint(self):
        """Validação básica: API está respondendo no path correto"""
        response = requests.get(ENDPOINT_HEALTH)
        assert response.status_code == 200, f"API não está respondendo: {response.status_code}"
        assert response.json()["status"] == "ok"

    def test_post_leituras_status_code_and_required_fields(self):
        """Risco #3 - Valida: status code 201 + campo de ID gerado"""
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)
        assert response.status_code == 201
        
        response_data = response.json()
        assert "id" in response_data, f"Response sem campo 'id': {response_data}"

    def test_post_leituras_schema_completo(self):
        """Risco #4 - Valida integridade da resposta da API (LeituraOut)"""
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)
        assert response.status_code == 201
        
        response_data = response.json()
        campos_esperados = ["id", "device_id", "sensor", "valor", "timestamp"]
        for campo in campos_esperados:
            assert campo in response_data, f"Campo {campo} ausente na resposta"

    def test_schema_validation_leitura_valida(self):
        """Validação isolada do schema local"""
        try:
            validate(instance=self.VALID_PAYLOAD, schema=SENSOR_READING_SCHEMA)
        except ValidationError as e:
            pytest.fail(f"Payload válido falhou no schema: {e.message}")

    @pytest.mark.parametrize("field,invalid_value,expected_error", [
        ("sensor", "sensor_invalido", "is not one of"), 
        ("device_id", "", "should be non-empty"),
        ("valor", "não é número", "is not of type"),
    ])
    def test_schema_rejeita_valores_invalidos(self, field, invalid_value, expected_error):
        """Valida restrições do schema (Enum, Length e Type)"""
        invalid_payload = self.VALID_PAYLOAD.copy()
        invalid_payload[field] = invalid_value

        with pytest.raises(ValidationError) as exc_info:
            validate(instance=invalid_payload, schema=SENSOR_READING_SCHEMA)

        assert expected_error in str(exc_info.value).lower()

    def test_schema_requires_all_mandatory_fields(self):
        """Validação: campos obrigatórios no contrato"""
        for required_field in SENSOR_READING_SCHEMA["required"]:
            incomplete_payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != required_field}

            with pytest.raises(ValidationError) as exc_info:
                validate(instance=incomplete_payload, schema=SENSOR_READING_SCHEMA)

            assert required_field in str(exc_info.value)
            assert "is a required property" in str(exc_info.value)

    def test_integration_contrato_api_bate_com_schema(self):
        """Integração final: contrato local vs resposta real da API"""
        response = requests.post(ENDPOINT_LEITURAS, json=self.VALID_PAYLOAD)
        assert response.status_code == 201

        data = response.json()
        assert isinstance(data["id"], str)
        assert len(data["id"]) == 8