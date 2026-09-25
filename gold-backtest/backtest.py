"""
Backtest del oro (XAU/USD) — patrones horarios, estacionales y estrategias.

Datos: velas de eToro (instrumento 18, "Gold Non Expiry") en data/ y la serie
mensual larga de datasets/gold-prices (1833-hoy, se usa desde 1971).

Uso:  python3 backtest.py            -> imprime el reporte y escribe results/*.csv
"""
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "results"
OUT.mkdir(exist_ok=True)

# Coste por operación ida+vuelta en USD por onza: spread eToro (~0.20) + deslizamiento.
COST = 0.50


def load(tf):
    df = pd.read_csv(DATA / f"xauusd_{tf}.csv", parse_dates=["time"]).set_index("time")
    return df.sort_index()


# ---------------------------------------------------------------- utilidades
def atr(df, n=14):
    pc = df.close.shift()
    tr = pd.concat([df.high - df.low, (df.high - pc).abs(), (df.low - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean()


def rsi(s, n):
    d = s.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn)


def stats(trades, name, bars_per_year=None, equity=None):
    """trades: Serie de retornos (%) por operación, ya netos de costes."""
    t = pd.Series(trades, dtype=float).dropna()
    if len(t) == 0:
        return dict(estrategia=name, trades=0)
    eq = (1 + t / 100).cumprod()
    dd = (eq / eq.cummax() - 1).min() * 100
    wins, losses = t[t > 0], t[t <= 0]
    pf = wins.sum() / -losses.sum() if len(losses) and losses.sum() != 0 else np.inf
    return dict(
        estrategia=name,
        trades=len(t),
        win_rate=round(100 * len(wins) / len(t), 1),
        ret_total_pct=round((eq.iloc[-1] - 1) * 100, 1),
        prom_trade_pct=round(t.mean(), 3),
        profit_factor=round(pf, 2),
        max_dd_pct=round(dd, 1),
        peor_trade_pct=round(t.min(), 2),
        racha_perdedora_max=int(max_streak(t <= 0)),
    )


def max_streak(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best


def net(entry, exit_, side=1):
    """Retorno % neto de costes."""
    return side * (exit_ - entry) / entry * 100 - COST / entry * 100


# ---------------------------------------------------------------- 1. patrones
def hourly_profile(h1):
    r = (h1.close / h1.open - 1) * 100
    rng = (h1.high - h1.low) / h1.open * 100
    g = pd.DataFrame({"ret": r, "rng": rng, "up": r > 0}).groupby(h1.index.hour)
    out = pd.DataFrame({
        "ret_prom_pct": g.ret.mean().round(4),
        "t_stat": (g.ret.mean() / (g.ret.std() / np.sqrt(g.ret.count()))).round(2),
        "pct_velas_alcistas": (100 * g.up.mean()).round(1),
        "rango_prom_pct": g.rng.mean().round(3),
        "n": g.ret.count(),
    })
    out.index.name = "hora_utc"
    return out


def session_profile(h4):
    r = (h4.close / h4.open - 1) * 100
    rng = (h4.high - h4.low) / h4.open * 100
    g = pd.DataFrame({"ret": r, "rng": rng, "up": r > 0}).groupby(h4.index.hour)
    out = pd.DataFrame({
        "ret_prom_pct": g.ret.mean().round(4),
        "t_stat": (g.ret.mean() / (g.ret.std() / np.sqrt(g.ret.count()))).round(2),
        "pct_alcistas": (100 * g.up.mean()).round(1),
        "rango_prom_pct": g.rng.mean().round(3),
        "n": g.ret.count(),
    })
    out.index.name = "bloque_4h_inicio_utc"
    return out


def weekday_profile(d1):
    r = d1.close.pct_change() * 100
    d = d1.assign(r=r).dropna()
    d = d[d.index.dayofweek < 5]
    g = d.groupby(d.index.dayofweek).r
    out = pd.DataFrame({
        "ret_prom_pct": g.mean().round(3),
        "t_stat": (g.mean() / (g.std() / np.sqrt(g.count()))).round(2),
        "pct_alcistas": (100 * g.apply(lambda x: (x > 0).mean())).round(1),
        "n": g.count(),
    })
    out.index = ["Lun", "Mar", "Mié", "Jue", "Vie"][: len(out)]
    return out


def monthly_seasonality():
    m = pd.read_csv(DATA / "gold_monthly_long.csv")
    m["Date"] = pd.to_datetime(m.Date)
    m = m.set_index("Date").Price
    r = (m.pct_change() * 100).loc["1971":].dropna()
    g = r.groupby(r.index.month)
    out = pd.DataFrame({
        "ret_prom_pct": g.mean().round(2),
        "mediana_pct": g.median().round(2),
        "pct_alcistas": (100 * g.apply(lambda x: (x > 0).mean())).round(1),
        "t_stat": (g.mean() / (g.std() / np.sqrt(g.count()))).round(2),
        "n_años": g.count(),
    })
    out.index = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return out


# ---------------------------------------------------------------- 2. estrategias diarias
def buy_and_hold(d1):
    s = stats([net(d1.close.iloc[0], d1.close.iloc[-1])], "Comprar y mantener")
    # el DD de una sola operación es 0: medirlo vela a vela
    s["max_dd_pct"] = round((d1.close / d1.close.cummax() - 1).min() * 100, 1)
    return s


def sma_trend(d1, fast=20, slow=50):
    f, s = d1.close.rolling(fast).mean(), d1.close.rolling(slow).mean()
    long_ = (f > s).astype(int)
    trades, entry = [], None
    for i in range(slow, len(d1)):
        sig = long_.iloc[i - 1]  # señal de ayer, se ejecuta a la apertura de hoy
        px = d1.open.iloc[i]
        if sig and entry is None:
            entry = px
        elif not sig and entry is not None:
            trades.append(net(entry, px)); entry = None
    if entry is not None:
        trades.append(net(entry, d1.close.iloc[-1]))
    return stats(trades, f"Tendencia SMA{fast}/{slow} (solo largos)")


def donchian(d1, n_in=20, n_out=10, atr_mult=2.0):
    hi = d1.high.rolling(n_in).max().shift()
    lo = d1.low.rolling(n_out).min().shift()
    a = atr(d1).shift()
    trades, entry, stop = [], None, None
    for i in range(n_in + 15, len(d1)):
        row = d1.iloc[i]
        if entry is None:
            if row.high > hi.iloc[i]:
                entry = max(row.open, hi.iloc[i])
                stop = entry - atr_mult * a.iloc[i]
        else:
            exit_lvl = max(stop, lo.iloc[i])
            if row.low < exit_lvl:
                trades.append(net(entry, min(row.open, exit_lvl))); entry = None
    if entry is not None:
        trades.append(net(entry, d1.close.iloc[-1]))
    return stats(trades, f"Ruptura Donchian {n_in}/{n_out} + stop {atr_mult}ATR")


def rsi2_pullback(d1, buy_th=10, exit_th=70, trend=200):
    r = rsi(d1.close, 2)
    ma = d1.close.rolling(trend).mean()
    trades, entry, held = [], None, 0
    for i in range(trend, len(d1) - 1):
        if entry is None:
            if r.iloc[i] < buy_th and d1.close.iloc[i] > ma.iloc[i]:
                entry, held = d1.open.iloc[i + 1], 0
        else:
            held += 1
            if r.iloc[i] > exit_th or held >= 10:
                trades.append(net(entry, d1.open.iloc[i + 1])); entry = None
    return stats(trades, f"Retroceso RSI(2)<{buy_th} con precio>SMA{trend}")


def rsi2_short(d1, sell_th=90, exit_th=30, trend=200):
    r = rsi(d1.close, 2)
    ma = d1.close.rolling(trend).mean()
    trades, entry, held = [], None, 0
    for i in range(trend, len(d1) - 1):
        if entry is None:
            if r.iloc[i] > sell_th and d1.close.iloc[i] < ma.iloc[i]:
                entry, held = d1.open.iloc[i + 1], 0
        else:
            held += 1
            if r.iloc[i] < exit_th or held >= 10:
                trades.append(net(entry, d1.open.iloc[i + 1], side=-1)); entry = None
    return stats(trades, f"Venta RSI(2)>{sell_th} con precio<SMA{trend}")


# ---------------------------------------------------------------- 3. estrategias intradía
def asian_range_breakout(h1, asia=(0, 6), trade_until=16, rr=1.5, trend=None):
    """Rango asiático 00-06 UTC; entrar en ruptura durante Londres/NY, stop al otro extremo.
    trend: Serie diaria (+1/-1) conocida al cierre de ayer; si se da, solo opera a favor."""
    trades = []
    for day, g in h1.groupby(h1.index.date):
        bias = 0
        if trend is not None:
            prev = trend.loc[:pd.Timestamp(day, tz="UTC") - pd.Timedelta(seconds=1)]
            if len(prev) == 0:
                continue
            bias = prev.iloc[-1]
        a = g[(g.index.hour >= asia[0]) & (g.index.hour < asia[1])]
        s = g[(g.index.hour >= asia[1]) & (g.index.hour < trade_until)]
        if len(a) < 5 or len(s) < 3:
            continue
        top, bot = a.high.max(), a.low.min()
        width = top - bot
        pos = None
        for _, row in s.iterrows():
            if pos is None:
                if row.high > top and bias >= 0:
                    pos = (1, top, bot, top + rr * width)
                elif row.low < bot and bias <= 0:
                    pos = (-1, bot, top, bot - rr * width)
                if pos is None:
                    continue
            side, entry, stop, tgt = pos
            # conservador: si la vela toca stop y objetivo, se asume stop primero
            if (side == 1 and row.low <= stop) or (side == -1 and row.high >= stop):
                trades.append(net(entry, stop, side)); pos = "done"; break
            if (side == 1 and row.high >= tgt) or (side == -1 and row.low <= tgt):
                trades.append(net(entry, tgt, side)); pos = "done"; break
        if isinstance(pos, tuple):
            trades.append(net(pos[1], s.close.iloc[-1], pos[0]))
    tag = " + filtro tendencia D1" if trend is not None else ""
    return stats(trades, f"Ruptura rango asiático (00-06 UTC), R:R {rr}{tag}")


def session_hold(h1, start, end, side=1, label=""):
    """Abrir al inicio de la hora `start` UTC y cerrar al final de la hora `end-1`."""
    trades = []
    for day, g in h1.groupby(h1.index.date):
        a = g[g.index.hour == start]
        b = g[g.index.hour == end - 1]
        if len(a) and len(b):
            trades.append(net(a.open.iloc[0], b.close.iloc[0], side))
    return stats(trades, label or f"{'Largo' if side == 1 else 'Corto'} {start:02d}-{end:02d} UTC")


def ny_open_momentum(h1, hour=13):
    """Operar a favor de la vela de apertura de NY (13 UTC) durante 3 horas."""
    trades = []
    for day, g in h1.groupby(h1.index.date):
        a = g[g.index.hour == hour]
        b = g[g.index.hour == hour + 3]
        if len(a) and len(b):
            side = 1 if a.close.iloc[0] > a.open.iloc[0] else -1
            trades.append(net(a.close.iloc[0], b.close.iloc[0], side))
    return stats(trades, "Momentum vela apertura NY (13 UTC), 3h")


# ---------------------------------------------------------------- 4. robustez
def walk_forward(d1, fn, **kw):
    half = len(d1) // 2
    a = fn(d1.iloc[:half], **kw)
    b = fn(d1.iloc[half - 250:], **kw)  # 250 barras de calentamiento para medias
    return a, b


def param_grid_donchian(d1):
    rows = []
    for n_in in (10, 20, 40, 55):
        for n_out in (5, 10, 20):
            for m in (1.5, 2.0, 3.0):
                s = donchian(d1, n_in, n_out, m)
                rows.append(dict(entrada=n_in, salida=n_out, atr=m, trades=s["trades"],
                                 ret=s.get("ret_total_pct"), pf=s.get("profit_factor"),
                                 dd=s.get("max_dd_pct")))
    return pd.DataFrame(rows)


def monte_carlo(trades_pct, n=5000, seed=1):
    rng = np.random.default_rng(seed)
    t = np.asarray(trades_pct) / 100
    dds, rets = [], []
    for _ in range(n):
        s = rng.choice(t, size=len(t), replace=True)
        eq = np.cumprod(1 + s)
        dds.append((eq / np.maximum.accumulate(eq) - 1).min())
        rets.append(eq[-1] - 1)
    return dict(prob_perder=round(100 * np.mean(np.array(rets) < 0), 1),
                dd_p95=round(100 * np.percentile(dds, 5), 1),
                ret_p5=round(100 * np.percentile(rets, 5), 1),
                ret_mediana=round(100 * np.median(rets), 1))


def donchian_trades(d1, n_in=20, n_out=10, atr_mult=2.0):
    hi = d1.high.rolling(n_in).max().shift()
    lo = d1.low.rolling(n_out).min().shift()
    a = atr(d1).shift()
    trades, entry, stop = [], None, None
    for i in range(n_in + 15, len(d1)):
        row = d1.iloc[i]
        if entry is None:
            if row.high > hi.iloc[i]:
                entry = max(row.open, hi.iloc[i]); stop = entry - atr_mult * a.iloc[i]
        else:
            lvl = max(stop, lo.iloc[i])
            if row.low < lvl:
                trades.append(net(entry, min(row.open, lvl))); entry = None
    if entry is not None:
        trades.append(net(entry, d1.close.iloc[-1]))
    return trades


# ---------------------------------------------------------------- main
def main():
    pd.set_option("display.width", 200)
    d1, h4, h1 = load("D1"), load("H4"), load("H1")

    print("=" * 90)
    print(f"DATOS  D1: {d1.index[0].date()} → {d1.index[-1].date()} ({len(d1)} velas)")
    print(f"       H4: {h4.index[0].date()} → {h4.index[-1].date()} ({len(h4)} velas)")
    print(f"       H1: {h1.index[0].date()} → {h1.index[-1].date()} ({len(h1)} velas)")
    print(f"Coste asumido por operación: {COST} USD/oz (spread + deslizamiento)")

    sections = {
        "estacionalidad_mensual_1971_hoy": monthly_seasonality(),
        "dia_semana_D1": weekday_profile(d1),
        "bloques_4h_H4": session_profile(h4),
        "hora_utc_H1": hourly_profile(h1),
    }
    for k, v in sections.items():
        print("\n" + "=" * 90 + f"\n{k}\n" + v.to_string())
        v.to_csv(OUT / f"{k}.csv")

    daily = pd.DataFrame([
        buy_and_hold(d1),
        sma_trend(d1, 20, 50),
        sma_trend(d1, 50, 200),
        donchian(d1, 20, 10, 2.0),
        donchian(d1, 55, 20, 3.0),
        rsi2_pullback(d1),
        rsi2_short(d1),
    ])
    print("\n" + "=" * 90 + "\nESTRATEGIAS DIARIAS (D1, ~4 años)\n" + daily.to_string(index=False))
    daily.to_csv(OUT / "estrategias_diarias.csv", index=False)

    intraday = pd.DataFrame([
        asian_range_breakout(h1, rr=1.0),
        asian_range_breakout(h1, rr=1.5),
        asian_range_breakout(h1, rr=2.0),
        asian_range_breakout(h1, rr=1.5, trend=np.sign(d1.close - d1.close.rolling(50).mean())),
        session_hold(h1, 0, 7, 1, "Largo sesión Asia 00-07 UTC"),
        session_hold(h1, 7, 13, 1, "Largo sesión Londres 07-13 UTC"),
        session_hold(h1, 13, 21, 1, "Largo sesión NY 13-21 UTC"),
        session_hold(h1, 13, 21, -1, "Corto sesión NY 13-21 UTC"),
        ny_open_momentum(h1),
    ])
    print("\n" + "=" * 90 + "\nESTRATEGIAS INTRADÍA (H1, ~6 semanas — muestra MUY pequeña)\n"
          + intraday.to_string(index=False))
    intraday.to_csv(OUT / "estrategias_intradia.csv", index=False)

    # sesiones con H4 (7 meses) para tener más muestra
    h4_sess = pd.DataFrame([
        session_hold(h4.rename_axis("time"), s, s + 1, 1, f"Largo bloque H4 {s:02d}-{s + 4:02d} UTC")
        for s in (0, 4, 8, 12, 16, 20)
    ])
    print("\n" + "=" * 90 + "\nLARGO POR BLOQUE DE 4H (H4, ~7 meses)\n" + h4_sess.to_string(index=False))

    print("\n" + "=" * 90 + "\nWALK-FORWARD (1ª mitad vs 2ª mitad de D1)")
    wf = []
    for fn, kw in [(donchian, dict(n_in=20, n_out=10, atr_mult=2.0)),
                   (sma_trend, dict(fast=20, slow=50)),
                   (rsi2_pullback, {}),
                   (buy_and_hold, {})]:
        a, b = walk_forward(d1, fn, **kw)
        wf.append({"estrategia": a["estrategia"], "periodo": "1ª mitad", **{k: a.get(k) for k in ("trades", "ret_total_pct", "profit_factor", "max_dd_pct")}})
        wf.append({"estrategia": b["estrategia"], "periodo": "2ª mitad", **{k: b.get(k) for k in ("trades", "ret_total_pct", "profit_factor", "max_dd_pct")}})
    wf = pd.DataFrame(wf)
    print(wf.to_string(index=False))
    wf.to_csv(OUT / "walk_forward.csv", index=False)

    grid = param_grid_donchian(d1)
    print("\n" + "=" * 90 + "\nSENSIBILIDAD DE PARÁMETROS — Donchian (36 combinaciones)")
    print(f"Combinaciones rentables: {(grid.ret > 0).sum()}/{len(grid)} | "
          f"PF mediano {grid.pf.median():.2f} | ret mediano {grid.ret.median():.1f}%")
    print(grid.sort_values("pf", ascending=False).head(8).to_string(index=False))
    grid.to_csv(OUT / "grid_donchian.csv", index=False)

    mc = monte_carlo(donchian_trades(d1))
    print("\n" + "=" * 90 + "\nMONTE CARLO (5000 remuestreos de las operaciones Donchian 20/10)")
    print(mc)


if __name__ == "__main__":
    main()
