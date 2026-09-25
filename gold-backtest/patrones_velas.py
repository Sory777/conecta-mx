"""
Patrones de velas japonesas en el oro y su "continuidad":
  - para cada patrón con nombre, qué tan seguido el precio sigue en la dirección esperada
    1 vela y 3 velas después;
  - rachas: tras N velas seguidas del mismo color, probabilidad de que la siguiente repita.

Uso:  python3 patrones_velas.py  -> results/patrones_velas.csv, results/rachas_velas.csv,
                                     results/patrones_velas.json (para la gráfica)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from backtest import atr

HERE = Path(__file__).parent
OUT = HERE / "results"
TFS = ("M1", "M5", "M15", "H1", "H4", "D1")


def load(tf):
    df = pd.read_csv(HERE / "data" / f"xauusd_{tf}.csv")
    df["time"] = pd.to_datetime(df.time, utc=True, format="ISO8601")
    return df.set_index("time").sort_index()


def patterns(df):
    """Devuelve {nombre: (Serie booleana, dirección esperada +1/-1)}.
    Mismas reglas que el indicador de TradingView (tradingview/oro_scalping_setups.pine)."""
    o, h, l, c = df.open, df.high, df.low, df.close
    body = (c - o).abs()
    rng = (h - l).replace(0, np.nan)
    upper = h - np.maximum(o, c)
    lower = np.minimum(o, c) - l
    bull, bear = c > o, c < o
    avg_body = body.rolling(14).mean()
    down_trend = c.shift(1) < c.shift(6)   # contexto: 5 velas bajando
    up_trend = c.shift(1) > c.shift(6)
    o1, c1, h1, l1 = o.shift(1), c.shift(1), h.shift(1), l.shift(1)
    body1 = body.shift(1)
    bull1, bear1 = bull.shift(1, fill_value=False), bear.shift(1, fill_value=False)

    hammer_shape = (lower >= 2 * body) & (upper <= 0.3 * body.clip(lower=1e-9) + 0.1 * rng) & (body > 0.05 * rng)
    inv_shape = (upper >= 2 * body) & (lower <= 0.3 * body.clip(lower=1e-9) + 0.1 * rng) & (body > 0.05 * rng)
    doji = body <= 0.1 * rng
    marubozu = body >= 0.9 * rng

    big1 = body1 > avg_body.shift(1)
    mid1 = (o1 + c1) / 2
    star_small = body.shift(1) < 0.3 * avg_body.shift(1)

    p = {
        "Martillo": (hammer_shape & down_trend, 1),
        "Hombre colgado": (hammer_shape & up_trend, -1),
        "Martillo invertido": (inv_shape & down_trend, 1),
        "Estrella fugaz": (inv_shape & up_trend, -1),
        "Envolvente alcista": (bull & bear1 & (c >= o1) & (o <= c1) & (body > body1), 1),
        "Envolvente bajista": (bear & bull1 & (c <= o1) & (o >= c1) & (body > body1), -1),
        "Harami alcista": (bull & bear1 & big1 & (c < o1) & (o > c1), 1),
        "Harami bajista": (bear & bull1 & big1 & (c > o1) & (o < c1), -1),
        "Pauta penetrante": (bull & bear1 & big1 & (o < c1) & (c > mid1) & (c < o1), 1),
        "Nube oscura": (bear & bull1 & big1 & (o > c1) & (c < mid1) & (c > o1), -1),
        "Estrella de la mañana": (bear.shift(2, fill_value=False) & (body.shift(2) > avg_body.shift(2)) & star_small
                                  & bull & (c > (o.shift(2) + c.shift(2)) / 2), 1),
        "Estrella de la tarde": (bull.shift(2, fill_value=False) & (body.shift(2) > avg_body.shift(2)) & star_small
                                 & bear & (c < (o.shift(2) + c.shift(2)) / 2), -1),
        "Tres soldados blancos": (bull & bull1 & bull.shift(2, fill_value=False) & (c > c1) & (c1 > c.shift(2))
                                  & (body > 0.5 * rng) & (body1 > 0.5 * rng.shift(1)), 1),
        "Tres cuervos negros": (bear & bear1 & bear.shift(2, fill_value=False) & (c < c1) & (c1 < c.shift(2))
                                & (body > 0.5 * rng) & (body1 > 0.5 * rng.shift(1)), -1),
        "Marubozu alcista": (bull & marubozu & (body > avg_body), 1),
        "Marubozu bajista": (bear & marubozu & (body > avg_body), -1),
        "Pinzas de suelo": (((l - l1).abs() <= 0.05 * rng) & bear1 & bull & down_trend, 1),
        "Pinzas de techo": (((h - h1).abs() <= 0.05 * rng) & bull1 & bear & up_trend, -1),
        "Doji": (doji, 0),
    }
    return {k: (v.fillna(False).astype(bool), d) for k, (v, d) in p.items()}


def continuation(df):
    a = atr(df)
    nxt1 = df.close.shift(-1) - df.close
    nxt3 = df.close.shift(-3) - df.close
    rows = []
    base_up1 = (nxt1 > 0).mean()
    for name, (mask, d) in patterns(df).items():
        m = mask & nxt3.notna()
        n = int(m.sum())
        if n == 0:
            rows.append(dict(patron=name, direccion=d, n=0)); continue
        if d == 0:  # doji: medimos si "sigue" la vela anterior (continuidad de la tendencia previa)
            prev = np.sign(df.close.shift(1) - df.close.shift(2))
            s1, s3 = np.sign(nxt1[m]) == prev[m], np.sign(nxt3[m]) == prev[m]
            mv = (nxt3[m] * prev[m] / a[m]).mean()
        else:
            s1, s3 = np.sign(nxt1[m]) == d, np.sign(nxt3[m]) == d
            mv = (nxt3[m] * d / a[m]).mean()
        rows.append(dict(
            patron=name, direccion=d, n=n,
            sigue_1_vela_pct=round(100 * s1.mean(), 1),
            sigue_3_velas_pct=round(100 * s3.mean(), 1),
            mov_3_velas_atr=round(mv, 3),
        ))
    return pd.DataFrame(rows), round(100 * base_up1, 1)


def streaks(df, max_k=7):
    color = np.sign(df.close - df.open)
    out = []
    run = 0
    runs = []
    for i in range(len(color)):
        if i and color.iloc[i] == color.iloc[i - 1] and color.iloc[i] != 0:
            run += 1
        else:
            run = 1 if color.iloc[i] != 0 else 0
        runs.append(run)
    runs = pd.Series(runs, index=df.index)
    nxt_same = (color.shift(-1) == color)
    valid = color.shift(-1).notna() & (color != 0)
    for k in range(1, max_k + 1):
        m = valid & (runs == k) if k < max_k else valid & (runs >= k)
        for side, lab in ((1, "verdes"), (-1, "rojas")):
            mm = m & (color == side)
            n = int(mm.sum())
            out.append(dict(velas_seguidas=f"{k}{'+' if k == max_k else ''}", color=lab, n=n,
                            prob_siguiente_igual_pct=round(100 * nxt_same[mm].mean(), 1) if n else None))
    return pd.DataFrame(out)


def main():
    pd.set_option("display.width", 200)
    all_p, all_s, meta = [], [], {}
    for tf in TFS:
        df = load(tf)
        p, base = continuation(df)
        p.insert(0, "tf", tf)
        s = streaks(df)
        s.insert(0, "tf", tf)
        all_p.append(p); all_s.append(s)
        meta[tf] = dict(velas=len(df), desde=str(df.index[0]), hasta=str(df.index[-1]), base_alcista_pct=base)
        print(f"\n{'=' * 90}\n{tf}: {len(df)} velas  ({df.index[0]:%Y-%m-%d} → {df.index[-1]:%Y-%m-%d})  "
              f"velas que suben después de cualquier vela: {base}%")
        print(p.drop(columns="tf").to_string(index=False))
        print(s.drop(columns="tf").pivot(index="velas_seguidas", columns="color", values="prob_siguiente_igual_pct").to_string())
    P, S = pd.concat(all_p), pd.concat(all_s)
    P.to_csv(OUT / "patrones_velas.csv", index=False)
    S.to_csv(OUT / "rachas_velas.csv", index=False)
    (OUT / "patrones_velas.json").write_text(json.dumps(dict(
        meta=meta,
        patrones=P.replace({np.nan: None}).to_dict("records"),
        rachas=S.replace({np.nan: None}).to_dict("records"),
    ), ensure_ascii=False))


if __name__ == "__main__":
    main()
