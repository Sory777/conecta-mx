"""
Backtest de estrategias de scalping en oro (M1 / M5 / M15, datos eToro).

Motor barra a barra:
  - la señal se calcula al cierre de una vela y se entra a la APERTURA de la siguiente;
  - stop y objetivo fijos en múltiplos de ATR (o del rango, según la estrategia);
  - si una vela toca stop y objetivo a la vez se asume el STOP (conservador);
  - salida por tiempo máximo (max_bars) si no toca ninguno;
  - coste por operación en USD/oz (spread + deslizamiento), restado en cada trade.

Uso:  python3 scalping.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

from backtest import atr, rsi, max_streak

HERE = Path(__file__).parent
OUT = HERE / "results"
OUT.mkdir(exist_ok=True)

COSTS = (0.30, 0.50)  # spread eToro 0.20 + deslizamiento de 0.10 / 0.30

SESSIONS = {
    "Asia 00-07": (0, 7),
    "Londres 07-12": (7, 12),
    "NY 12-17": (12, 17),
    "Tarde NY 17-21": (17, 21),
    "Todo el día": (0, 24),
}


def load(tf):
    df = pd.read_csv(HERE / "data" / f"xauusd_{tf}.csv")
    df["time"] = pd.to_datetime(df.time, utc=True, format="ISO8601")
    return df.set_index("time").sort_index()


# ---------------------------------------------------------------- motor
def run(df, signal, stop_dist, tgt_dist, cost, max_bars=12, hours=(0, 24)):
    """signal: Serie +1/-1/0 al cierre de cada vela. stop/tgt_dist: Series en USD."""
    o, h, l, c = df.open.values, df.high.values, df.low.values, df.close.values
    hrs = df.index.hour.values
    sig, sd, td = signal.values, stop_dist.values, tgt_dist.values
    trades, i, n = [], 0, len(df)
    while i < n - 1:
        s = sig[i]
        if s == 0 or np.isnan(sd[i]) or not (hours[0] <= hrs[i + 1] < hours[1]):
            i += 1
            continue
        e = o[i + 1]
        stop, tgt = e - s * sd[i], e + s * td[i]
        exit_px, j = None, i + 1
        while j < n and j <= i + max_bars:
            if (s == 1 and l[j] <= stop) or (s == -1 and h[j] >= stop):
                exit_px = stop; break
            if (s == 1 and h[j] >= tgt) or (s == -1 and l[j] <= tgt):
                exit_px = tgt; break
            j += 1
        if exit_px is None:
            j = min(j, n - 1)
            exit_px = c[j]
        trades.append(dict(time=df.index[i + 1], side=s, pnl_usd=s * (exit_px - e) - cost))
        i = j + 1  # una posición a la vez
    return pd.DataFrame(trades)


def summarize(t, name):
    if len(t) == 0:
        return dict(estrategia=name, trades=0)
    p = t.pnl_usd
    wins, losses = p[p > 0], p[p <= 0]
    eq = p.cumsum()
    return dict(
        estrategia=name,
        trades=len(p),
        win_rate=round(100 * len(wins) / len(p), 1),
        pnl_total_usd_oz=round(p.sum(), 2),
        prom_usd_oz=round(p.mean(), 3),
        profit_factor=round(wins.sum() / -losses.sum(), 2) if losses.sum() < 0 else np.inf,
        max_dd_usd_oz=round((eq - eq.cummax()).min(), 2),
        racha_perd=int(max_streak(p <= 0)),
    )


# ---------------------------------------------------------------- señales
def ema_pullback(df, fast=9, slow=21, trend=50):
    """Tendencia: EMA9>EMA21>EMA50. Entrada cuando la vela toca la EMA21 y cierra a favor."""
    ef, es, et = (df.close.ewm(span=x, adjust=False).mean() for x in (fast, slow, trend))
    up = (ef > es) & (es > et) & (df.low <= es) & (df.close > es) & (df.close > df.open)
    dn = (ef < es) & (es < et) & (df.high >= es) & (df.close < es) & (df.close < df.open)
    return up.astype(int) - dn.astype(int)


def bollinger_reversion(df, n=20, k=2.0, rsi_n=7, lo=20, hi=80):
    """Contra-tendencia: cierre fuera de la banda + RSI extremo."""
    m, sd = df.close.rolling(n).mean(), df.close.rolling(n).std()
    r = rsi(df.close, rsi_n)
    up = (df.close < m - k * sd) & (r < lo)
    dn = (df.close > m + k * sd) & (r > hi)
    return up.astype(int) - dn.astype(int)


def momentum_breakout(df, n=12, body=0.6):
    """Vela de impulso (cuerpo ≥60% del rango) que rompe el máximo/mínimo de n velas."""
    rng = (df.high - df.low).replace(0, np.nan)
    strong = (df.close - df.open).abs() / rng >= body
    up = strong & (df.close > df.high.rolling(n).max().shift())
    dn = strong & (df.close < df.low.rolling(n).min().shift())
    return up.astype(int) - dn.astype(int)


def session_vwap_reversion(df, k=1.5):
    """'VWAP' sin volumen: media del precio típico desde el inicio del día UTC.
    Entrar cuando el precio se aleja k·ATR de ella, buscando regreso."""
    tp = (df.high + df.low + df.close) / 3
    day = df.index.floor("D")
    vw = tp.groupby(day).cumsum() / tp.groupby(day).cumcount().add(1)
    a = atr(df)
    up = df.close < vw - k * a
    dn = df.close > vw + k * a
    return up.astype(int) - dn.astype(int)


def orb(df, start_h, start_m, minutes=15, rr=1.5, tf_min=5):
    """Opening Range Breakout: rango de los primeros `minutes` desde start_h:start_m UTC."""
    sig = pd.Series(0, index=df.index)
    sd = pd.Series(np.nan, index=df.index)
    for day, g in df.groupby(df.index.date):
        t0 = pd.Timestamp(day, tz="UTC") + pd.Timedelta(hours=start_h, minutes=start_m)
        rng = g[(g.index >= t0) & (g.index < t0 + pd.Timedelta(minutes=minutes))]
        after = g[(g.index >= t0 + pd.Timedelta(minutes=minutes)) &
                  (g.index < t0 + pd.Timedelta(minutes=minutes + 120))]
        if len(rng) < max(1, minutes // tf_min) or len(after) == 0:
            continue
        top, bot = rng.high.max(), rng.low.min()
        for ts, row in after.iterrows():
            if row.close > top:
                sig[ts], sd[ts] = 1, row.close - bot; break
            if row.close < bot:
                sig[ts], sd[ts] = -1, top - row.close; break
    return sig, sd, sd * rr


# ---------------------------------------------------------------- main
def main():
    pd.set_option("display.width", 220)
    rows, trades_best = [], {}
    for tf, max_bars in (("M1", 30), ("M5", 12), ("M15", 8)):
        df = load(tf)
        a = atr(df)
        span = f"{df.index[0]:%d-%b %H:%M} → {df.index[-1]:%d-%b %H:%M} UTC"
        print(f"\n{'=' * 100}\n{tf}: {len(df)} velas, {span}, ATR medio {a.mean():.2f} USD")
        strategies = {
            "Retroceso EMA 9/21/50": (ema_pullback(df), a * 1.0, a * 1.5),
            "Reversión Bollinger+RSI": (bollinger_reversion(df), a * 1.0, a * 1.0),
            "Ruptura vela de impulso": (momentum_breakout(df), a * 1.0, a * 2.0),
            "Reversión a 'VWAP' diaria": (session_vwap_reversion(df), a * 1.0, a * 1.5),
        }
        if tf in ("M5", "M15"):
            tfm = 5 if tf == "M5" else 15
            s, sd, td = orb(df, 7, 0, 15, 1.5, tfm)
            strategies["ORB Londres 07:00 (15 min)"] = (s, sd, td)
            s, sd, td = orb(df, 13, 30, 15, 1.5, tfm)
            strategies["ORB Nueva York 13:30 (15 min)"] = (s, sd, td)
        for name, (sig, sd, td) in strategies.items():
            sess_list = ["Todo el día"] if name.startswith("ORB") else list(SESSIONS)
            for sess in sess_list:
                for cost in COSTS:
                    t = run(df, sig, sd, td, cost, max_bars, SESSIONS[sess])
                    r = summarize(t, name)
                    r.update(tf=tf, sesion=sess, coste=cost)
                    rows.append(r)
                    if cost == COSTS[0]:
                        trades_best[(tf, name, sess)] = t

    res = pd.DataFrame(rows)
    cols = ["tf", "estrategia", "sesion", "coste", "trades", "win_rate", "pnl_total_usd_oz",
            "prom_usd_oz", "profit_factor", "max_dd_usd_oz", "racha_perd"]
    res = res[cols]
    res.to_csv(OUT / "scalping_resultados.csv", index=False)

    main_cost = res[res.coste == COSTS[0]]
    print(f"\n{'=' * 100}\nTODAS LAS COMBINACIONES (coste {COSTS[0]} USD/oz)\n")
    print(main_cost.sort_values(["tf", "estrategia", "sesion"]).to_string(index=False))

    ok = main_cost[(main_cost.trades >= 15) & (main_cost.profit_factor > 1.2)]
    print(f"\n{'=' * 100}\nCANDIDATAS (≥15 trades y PF>1.2 con coste {COSTS[0]}): {len(ok)} de {len(main_cost)}")
    print(ok.sort_values("profit_factor", ascending=False).to_string(index=False))

    # ¿sobreviven con más coste?
    hi = res[res.coste == COSTS[1]].set_index(["tf", "estrategia", "sesion"])
    print(f"\nMismas candidatas con coste {COSTS[1]} USD/oz:")
    for _, r in ok.iterrows():
        k = (r.tf, r.estrategia, r.sesion)
        print(f"  {k}: PF {r.profit_factor} → {hi.loc[k].profit_factor}, "
              f"P&L {r.pnl_total_usd_oz} → {hi.loc[k].pnl_total_usd_oz} USD/oz")

    # consistencia: misma estrategia+sesión en varias temporalidades
    agg = main_cost[main_cost.trades >= 5].groupby(["estrategia", "sesion"]).agg(
        tfs=("tf", "count"),
        tfs_ganadoras=("pnl_total_usd_oz", lambda x: int((x > 0).sum())),
        pf_mediano=("profit_factor", "median"),
    )
    print(f"\n{'=' * 100}\nCONSISTENCIA ENTRE TEMPORALIDADES (M1/M5/M15)\n")
    print(agg.sort_values(["tfs_ganadoras", "pf_mediano"], ascending=False).to_string())
    agg.to_csv(OUT / "scalping_consistencia.csv")


if __name__ == "__main__":
    main()
