"""Genera mapa_velas.html (gráfica interactiva) a partir de results/patrones_velas.json."""
import html
import json
from pathlib import Path

HERE = Path(__file__).parent
data = json.loads((HERE.parent / "results" / "patrones_velas.json").read_text())
pine = (HERE / "oro_scalping_setups.pine").read_text()
tpl = (HERE / "mapa_velas.template.html").read_text()
out = tpl.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__PINE__", html.escape(pine))
(HERE / "mapa_velas.html").write_text(out)
print("ok", len(out))
