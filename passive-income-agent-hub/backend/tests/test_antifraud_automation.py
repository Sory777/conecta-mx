from app.agents.antifraud import classify, scan_text
from app.agents.automation import assess
from app.models import Opportunity, Platform


def codes(text):
    return {f["code"] for f in scan_text(text)}


def test_scan_detects_critical_signals():
    assert "rentabilidad_garantizada" in codes("Obtén ganancias garantizadas cada semana")
    assert "rendimiento_diario_fijo" in codes("Gana 3% diario con nuestro robot")
    assert "deposito_para_retirar" in codes("Debes hacer un depósito de 50 USD para retirar tus ganancias")
    assert "frase_semilla" in codes("Ingresa tu frase semilla para sincronizar la billetera")
    assert "reclutamiento_obligatorio" in codes("Invita a 5 amigos para retirar tu saldo")


def test_scan_ignores_normal_text_and_moderate_apy():
    assert codes("Pagamos por encuesta completada vía PayPal. Mínimo de retiro 5 USD.") == set()
    assert "apy_extremo" not in codes("Staking con 5% APY variable")
    assert "apy_extremo" in codes("Hasta 350% APY")


def test_classify_is_skeptical():
    assert classify([{"severity": "CRITICO"}], {})[0] == "DESCARTAR"
    assert classify([{"severity": "ALTO"}], {})[0] == "ALTO"
    # sin señales pero sin verificaciones ⇒ MEDIO, nunca BAJO por defecto
    level, reason = classify([], {})
    assert level == "MEDIO" and "verificaciones pendientes" in reason
    ok = {"domain_age_days": 3000, "https": True, "tos_url": "https://x.com/tos", "platform_verified": True,
          "requires_investment": False}
    assert classify([], ok)[0] == "BAJO"


def test_automation_respects_tos_and_policy():
    p = Platform(name="X", tos_prohibits_automation=None)
    o = Opportunity(title="x", category="depin", platform=p)
    assert assess(o)["level"] == 0  # términos no verificados
    p.tos_prohibits_automation = False
    assert assess(o)["level"] == 100
    p.tos_prohibits_automation = True
    assert assess(o)["level"] == 0
    survey = Opportunity(title="s", category="encuestas", platform=Platform(name="S", tos_prohibits_automation=False))
    a = assess(survey)
    assert a["level"] == 0 and any("fraude" in c for c in a["cannot_automate"])
