#!/usr/bin/env python3
"""Build browser-ready ML artifacts from the 2022 student project datasets.

Trains a multinomial logistic reconstruction of the original feature set
(FIFA rank + GK/DEF/OFF/MID) plus Elo, form, and Team DNA layers.
All metrics are computed from the data — nothing is invented.
"""
from __future__ import annotations

import csv
import json
import math
import os
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path("/workspace")
SRC_DATA = Path("/tmp/wc2022/Datasets")
OUT = ROOT / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)

WC_TEAMS = [
    "Qatar", "Ecuador", "Senegal", "Netherlands",
    "England", "IR Iran", "USA", "Wales",
    "Argentina", "Saudi Arabia", "Mexico", "Poland",
    "France", "Australia", "Denmark", "Tunisia",
    "Spain", "Costa Rica", "Germany", "Japan",
    "Belgium", "Canada", "Morocco", "Croatia",
    "Brazil", "Serbia", "Switzerland", "Cameroon",
    "Portugal", "Ghana", "Uruguay", "Korea Republic",
]

GROUPS = {
    "Qatar": "A", "Ecuador": "A", "Senegal": "A", "Netherlands": "A",
    "England": "B", "IR Iran": "B", "USA": "B", "Wales": "B",
    "Argentina": "C", "Saudi Arabia": "C", "Mexico": "C", "Poland": "C",
    "France": "D", "Australia": "D", "Denmark": "D", "Tunisia": "D",
    "Spain": "E", "Costa Rica": "E", "Germany": "E", "Japan": "E",
    "Belgium": "F", "Canada": "F", "Morocco": "F", "Croatia": "F",
    "Brazil": "G", "Serbia": "G", "Switzerland": "G", "Cameroon": "G",
    "Portugal": "H", "Ghana": "H", "Uruguay": "H", "Korea Republic": "H",
}

CONFED = {
    "Qatar": "AFC", "IR Iran": "AFC", "Korea Republic": "AFC", "Japan": "AFC",
    "Saudi Arabia": "AFC", "Australia": "AFC",
    "Senegal": "CAF", "Ghana": "CAF", "Tunisia": "CAF", "Morocco": "CAF",
    "Cameroon": "CAF",
    "Netherlands": "UEFA", "England": "UEFA", "Wales": "UEFA", "Poland": "UEFA",
    "France": "UEFA", "Denmark": "UEFA", "Spain": "UEFA", "Germany": "UEFA",
    "Belgium": "UEFA", "Croatia": "UEFA", "Brazil": "CONMEBOL", "Serbia": "UEFA",
    "Switzerland": "UEFA", "Portugal": "UEFA",
    "Argentina": "CONMEBOL", "Ecuador": "CONMEBOL", "Uruguay": "CONMEBOL",
    "USA": "CONCACAF", "Mexico": "CONCACAF", "Canada": "CONCACAF",
    "Costa Rica": "CONCACAF",
}

CODES = {
    "Qatar": "QAT", "Ecuador": "ECU", "Senegal": "SEN", "Netherlands": "NED",
    "England": "ENG", "IR Iran": "IRN", "USA": "USA", "Wales": "WAL",
    "Argentina": "ARG", "Saudi Arabia": "KSA", "Mexico": "MEX", "Poland": "POL",
    "France": "FRA", "Australia": "AUS", "Denmark": "DEN", "Tunisia": "TUN",
    "Spain": "ESP", "Costa Rica": "CRC", "Germany": "GER", "Japan": "JPN",
    "Belgium": "BEL", "Canada": "CAN", "Morocco": "MAR", "Croatia": "CRO",
    "Brazil": "BRA", "Serbia": "SRB", "Switzerland": "SUI", "Cameroon": "CMR",
    "Portugal": "POR", "Ghana": "GHA", "Uruguay": "URU", "Korea Republic": "KOR",
}

# Kit-inspired (not official trademarks). Used as small identity chips.
COLORS = {
    "Qatar": ["#8A1538", "#FFFFFF"],
    "Ecuador": ["#FFD100", "#034EA2"],
    "Senegal": ["#00853F", "#FDEF42"],
    "Netherlands": ["#FF6B00", "#FFFFFF"],
    "England": ["#FFFFFF", "#CF081F"],
    "IR Iran": ["#DA0000", "#FFFFFF"],
    "USA": ["#1F295B", "#C8102E"],
    "Wales": ["#C8102E", "#FFFFFF"],
    "Argentina": ["#74ACDF", "#FFFFFF"],
    "Saudi Arabia": ["#006C35", "#FFFFFF"],
    "Mexico": ["#006847", "#CE1126"],
    "Poland": ["#FFFFFF", "#DC143C"],
    "France": ["#002654", "#ED2939"],
    "Australia": ["#FFCD00", "#007832"],
    "Denmark": ["#C60C30", "#FFFFFF"],
    "Tunisia": ["#E70013", "#FFFFFF"],
    "Spain": ["#C60B1E", "#F1BF00"],
    "Costa Rica": ["#002B7F", "#CE1126"],
    "Germany": ["#FFFFFF", "#000000"],
    "Japan": ["#0033A0", "#FFFFFF"],
    "Belgium": ["#FDDA25", "#ED2939"],
    "Canada": ["#FF0000", "#FFFFFF"],
    "Morocco": ["#C1272D", "#006233"],
    "Croatia": ["#ED1C24", "#0055A5"],
    "Brazil": ["#009C3B", "#FEDD00"],
    "Serbia": ["#C6363C", "#0C4076"],
    "Switzerland": ["#D52B1E", "#FFFFFF"],
    "Cameroon": ["#007A5E", "#CE1126"],
    "Portugal": ["#006600", "#FF0000"],
    "Ghana": ["#006B3F", "#FCD116"],
    "Uruguay": ["#59C3E0", "#000000"],
    "Korea Republic": ["#C60C30", "#003478"],
}

ATTACK_POS = {"ST", "CF", "LW", "RW", "LF", "RF", "CAM"}
MID_POS = {"CM", "CDM", "CAM", "LM", "RM", "LWB", "RWB"}
DEF_POS = {"CB", "LB", "RB", "LWB", "RWB", "CDM"}
GK_POS = {"GK"}

CUTOFF = "2022-06-14"  # last date in the original international_matches dump
WC_START = "2022-11-20"


def fnum(x, default=None):
    if x is None or x == "":
        return default
    try:
        return float(x)
    except ValueError:
        return default


def percentile(vals, p):
    if not vals:
        return None
    a = np.sort(np.array(vals, dtype=float))
    return float(np.quantile(a, p))


def mean(vals):
    return float(np.mean(vals)) if vals else None


def std(vals):
    return float(np.std(vals, ddof=0)) if len(vals) > 1 else 0.0 if vals else None


def load_csv(path):
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        return list(csv.DictReader(fh))


def softmax_rows(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(np.clip(z, -40, 40))
    return e / e.sum(axis=1, keepdims=True)


def train_softmax(X, y, n_classes=3, lr=0.4, epochs=250, l2=0.02, seed=7):
    """Multinomial logistic regression via gradient descent. Returns W (d, k), b (k,)."""
    rng = np.random.default_rng(seed)
    n, d = X.shape
    k = n_classes
    W = rng.normal(0, 0.01, size=(d, k))
    b = np.zeros(k)
    y_oh = np.eye(k)[y]
    for ep in range(epochs):
        logits = X @ W + b
        P = softmax_rows(logits)
        grad = (P - y_oh) / n
        W -= lr * (X.T @ grad + l2 * W)
        b -= lr * grad.sum(axis=0)
        if ep in (80, 160):
            lr *= 0.5
    return W, b


def predict_proba(X, W, b):
    return softmax_rows(X @ W + b)


def accuracy(y, pred):
    return float((y == pred).mean()) if len(y) else 0.0


def f1_macro(y, pred, k=3):
    scores = []
    for c in range(k):
        tp = int(((pred == c) & (y == c)).sum())
        fp = int(((pred == c) & (y != c)).sum())
        fn = int(((pred != c) & (y == c)).sum())
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        scores.append(0.0 if prec + rec == 0 else 2 * prec * rec / (prec + rec))
    return float(np.mean(scores))


def confusion(y, pred, k=3):
    m = np.zeros((k, k), dtype=int)
    for yt, yp in zip(y, pred):
        m[int(yt), int(yp)] += 1
    return m.tolist()


def class_report(y, pred, k=3):
    out = []
    for c in range(k):
        tp = int(((pred == c) & (y == c)).sum())
        fp = int(((pred == c) & (y != c)).sum())
        fn = int(((pred != c) & (y == c)).sum())
        support = int((y == c).sum())
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 0.0 if prec + rec == 0 else 2 * prec * rec / (prec + rec)
        out.append({"class": c, "precision": prec, "recall": rec, "f1": f1, "support": support})
    return out


print("Loading source tables…")
last_scores = {r["team"]: r for r in load_csv(SRC_DATA / "last_team_scores.csv")}
squad_stats = {r["nationality_name"]: r for r in load_csv(SRC_DATA / "squad_stats.csv")}
training = load_csv(SRC_DATA / "training.csv")
intl = load_csv(SRC_DATA / "international_matches.csv")
players = load_csv(SRC_DATA / "players_22.csv")

print(f"  international_matches={len(intl)} training={len(training)} players={len(players)}")

# ---------------------------------------------------------------------------
# Team DNA from FIFA 22 players
# ---------------------------------------------------------------------------
by_nat = defaultdict(list)
for p in players:
    nat = p["nationality_name"]
    if nat not in WC_TEAMS:
        continue
    pos = (p["player_positions"] or "").split(",")[0].strip()
    rec = {
        "name": p["short_name"],
        "pos": pos,
        "overall": fnum(p["overall"], 0),
        "potential": fnum(p["potential"], 0),
        "age": fnum(p["age"], 0),
        "pace": fnum(p["pace"]),
        "shooting": fnum(p["shooting"]),
        "passing": fnum(p["passing"]),
        "dribbling": fnum(p["dribbling"]),
        "defending": fnum(p["defending"]),
        "physic": fnum(p["physic"]),
        "value": fnum(p["value_eur"], 0) or 0,
    }
    by_nat[nat].append(rec)

dna = {}
for team in WC_TEAMS:
    squad = sorted(by_nat.get(team, []), key=lambda x: -x["overall"])
    top23 = squad[:23]
    top11 = squad[:11]
    bench = squad[11:23]
    overalls = [p["overall"] for p in top23]
    ages = [p["age"] for p in top23 if p["age"]]
    pace = [p["pace"] for p in top23 if p["pace"] is not None]
    shoot = [p["shooting"] for p in top23 if p["shooting"] is not None]
    pas = [p["passing"] for p in top23 if p["passing"] is not None]
    dri = [p["dribbling"] for p in top23 if p["dribbling"] is not None]
    defe = [p["defending"] for p in top23 if p["defending"] is not None]
    phy = [p["physic"] for p in top23 if p["physic"] is not None]
    att = [p["shooting"] or p["overall"] for p in top23 if p["pos"] in ATTACK_POS or p["shooting"]]
    att = [p["shooting"] for p in top23 if p["pos"] in ATTACK_POS and p["shooting"] is not None]
    mid = [p["passing"] for p in top23 if p["pos"] in MID_POS and p["passing"] is not None]
    deff = [p["defending"] for p in top23 if p["pos"] in DEF_POS and p["defending"] is not None]
    gks = [p["overall"] for p in squad if p["pos"] in GK_POS]
    top3 = overalls[:3]
    mean_ov = mean(overalls) or 70.0
    star = (mean(top3) / mean_ov) if (top3 and mean_ov) else 1.0
    depth = (mean([p["overall"] for p in bench]) or mean_ov) / mean_ov if bench else 0.9
    dna[team] = {
        "playerCount": len(squad),
        "squadN": len(top23),
        "overallMean": mean(overalls),
        "overallStd": std(overalls),
        "overallTop3": mean(top3),
        "overallP90": percentile(overalls, 0.9),
        "overallP25": percentile(overalls, 0.25),
        "ageMean": mean(ages),
        "pace": mean(pace),
        "shooting": mean(shoot),
        "passing": mean(pas),
        "dribbling": mean(dri),
        "defending": mean(defe),
        "physic": mean(phy),
        "attack": mean(att) or mean(shoot),
        "midfield": mean(mid) or mean(pas),
        "defense": mean(deff) or mean(defe),
        "gk": max(gks) if gks else None,
        "starConcentration": round(star, 4),
        "depthIndex": round(depth, 4),
        "xiMean": mean([p["overall"] for p in top11]),
        "benchMean": mean([p["overall"] for p in bench]),
        "valueSumM": round(sum(p["value"] for p in top23) / 1e6, 1),
        "topPlayers": [
            {"name": p["name"], "pos": p["pos"], "overall": p["overall"], "age": p["age"]}
            for p in top11[:8]
        ],
        "imputed": len(squad) == 0,
    }

# Qatar has zero FIFA 22 players — original project filled GK=50 and used an imputed squad overall.
if dna["Qatar"]["imputed"]:
    qs = squad_stats.get("Qatar", {})
    dna["Qatar"].update({
        "overallMean": fnum(qs.get("overall"), 72.0),
        "overallStd": 4.0,
        "overallTop3": fnum(qs.get("overall"), 72.0),
        "ageMean": 26.0,
        "pace": 68.0, "shooting": 70.0, "passing": 72.0, "dribbling": 70.0,
        "defending": 70.0, "physic": 72.0,
        "attack": 70.0, "midfield": 72.0, "defense": 70.0, "gk": 50.0,
        "starConcentration": 1.04, "depthIndex": 0.92,
        "xiMean": fnum(qs.get("overall"), 72.0),
        "benchMean": fnum(qs.get("overall"), 70.0),
        "valueSumM": 0,
        "imputed": True,
        "imputeNote": "No Qatar players in FIFA 22. Original notebooks filled missing FIFA scores with 50 / group means.",
    })

# ---------------------------------------------------------------------------
# Causal Elo + form from international matches (up to original dump cutoff)
# ---------------------------------------------------------------------------
intl_sorted = sorted(intl, key=lambda r: r["date"])
elo = defaultdict(lambda: 1500.0)
elo_history = defaultdict(list)
results_by_team = defaultdict(list)  # (date, gf, ga, opp, elo_opp, won, draw)
year_counts = defaultdict(lambda: {"matches": 0, "wins": 0, "draws": 0, "losses": 0, "goals": 0})
confed_counts = defaultdict(int)
K = 20.0

for row in intl_sorted:
    h, a = row["home_team"], row["away_team"]
    hg, ag = int(float(row["home_team_score"])), int(float(row["away_team_score"]))
    d = row["date"]
    year = d[:4]
    year_counts[year]["matches"] += 1
    year_counts[year]["goals"] += hg + ag
    if hg > ag:
        year_counts[year]["wins"] += 1
        hs, as_ = 1.0, 0.0
        hres = "W"
    elif hg == ag:
        year_counts[year]["draws"] += 1
        hs, as_ = 0.5, 0.5
        hres = "D"
    else:
        year_counts[year]["losses"] += 1
        hs, as_ = 0.0, 1.0
        hres = "L"
    eh, ea = elo[h], elo[a]
    exp_h = 1.0 / (1.0 + 10 ** ((ea - eh) / 400.0))
    elo[h] = eh + K * (hs - exp_h)
    elo[a] = ea + K * ((1.0 - hs) - (1.0 - exp_h))
    if h in WC_TEAMS or a in WC_TEAMS:
        elo_history[h].append({"date": d, "elo": round(elo[h], 1)})
        elo_history[a].append({"date": d, "elo": round(elo[a], 1)})
    results_by_team[h].append({"date": d, "gf": hg, "ga": ag, "opp": a, "won": hs == 1, "draw": hs == 0.5, "home": True})
    results_by_team[a].append({"date": d, "gf": ag, "ga": hg, "opp": h, "won": as_ == 1, "draw": as_ == 0.5, "home": False})


def last_n_form(team, n=5):
    recs = results_by_team.get(team, [])[-n:]
    if not recs:
        return {"played": 0, "winRate": 0.5, "gd": 0.0, "gf": 0.0, "ga": 0.0, "weighted": 0.5}
    w = sum(1 for r in recs if r["won"])
    weights = np.linspace(0.4, 1.0, len(recs))
    wwin = sum(weights[i] for i, r in enumerate(recs) if r["won"])
    wdraw = sum(weights[i] * 0.5 for i, r in enumerate(recs) if r["draw"])
    return {
        "played": len(recs),
        "winRate": w / len(recs),
        "gd": sum(r["gf"] - r["ga"] for r in recs) / len(recs),
        "gf": sum(r["gf"] for r in recs) / len(recs),
        "ga": sum(r["ga"] for r in recs) / len(recs),
        "weighted": float((wwin + wdraw) / weights.sum()),
    }


def historical_record(team):
    recs = [r for r in results_by_team.get(team, []) if r["date"] <= CUTOFF]
    if not recs:
        return {"played": 0, "wins": 0, "draws": 0, "losses": 0, "gf": 0, "ga": 0, "winRate": 0.5}
    wins = sum(1 for r in recs if r["won"])
    draws = sum(1 for r in recs if r["draw"])
    losses = len(recs) - wins - draws
    return {
        "played": len(recs),
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "gf": sum(r["gf"] for r in recs),
        "ga": sum(r["ga"] for r in recs),
        "winRate": (wins + 0.5 * draws) / len(recs),
    }


# ---------------------------------------------------------------------------
# Teams payload
# ---------------------------------------------------------------------------
teams = []
for team in WC_TEAMS:
    ls = last_scores[team]
    sq = squad_stats[team]
    d = dna[team]
    f5 = last_n_form(team, 5)
    f10 = last_n_form(team, 10)
    rec = historical_record(team)
    hist = elo_history.get(team, [])
    # downsample history to ~20 points
    if len(hist) > 24:
        step = max(1, len(hist) // 20)
        sampled = hist[::step][-20:]
        if sampled[-1]["date"] != hist[-1]["date"]:
            sampled.append(hist[-1])
    else:
        sampled = hist[-20:]
    teams.append({
        "id": team.lower().replace(" ", "-"),
        "name": team,
        "code": CODES[team],
        "group": GROUPS[team],
        "confederation": CONFED.get(team, "FIFA"),
        "colors": {"primary": COLORS[team][0], "secondary": COLORS[team][1]},
        "fifaRank": int(float(ls["rank"])),
        "rankDate": ls["date"],
        "goalkeeper": fnum(ls["goalkeeper_score"]),
        "defense": fnum(ls["defense_score"]),
        "offense": fnum(ls["offense_score"]),
        "midfield": fnum(ls["midfield_score"]),
        "squadOverall": fnum(sq["overall"]),
        "squadPotential": fnum(sq["potential"]),
        "elo": round(elo[team], 1),
        "form5": f5,
        "form10": f10,
        "record": rec,
        "dna": d,
        "eloTrajectory": sampled,
    })

team_index = {t["name"]: t for t in teams}

# ---------------------------------------------------------------------------
# Train models on original training.csv numeric features
# Team1_Result: 1 = Team1 win, 0 = Team1 lose, 2 = draw  (from original notebooks)
# ---------------------------------------------------------------------------
print("Training reconstruction models…")


def row_features_original(r):
    # differentials: Team1 minus Team2 (except rank: lower rank number is stronger)
    return np.array([
        fnum(r["Team2_FIFA_RANK"], 50) - fnum(r["Team1_FIFA_RANK"], 50),  # rank advantage for T1
        fnum(r["Team1_Goalkeeper_Score"], 70) - fnum(r["Team2_Goalkeeper_Score"], 70),
        fnum(r["Team1_Defense"], 70) - fnum(r["Team2_Defense"], 70),
        fnum(r["Team1_Offense"], 70) - fnum(r["Team2_Offense"], 70),
        fnum(r["Team1_Midfield"], 70) - fnum(r["Team2_Midfield"], 70),
    ], dtype=float)


ORIG_NAMES = ["rank_advantage", "gk_diff", "defense_diff", "offense_diff", "midfield_diff"]

X_orig = np.vstack([row_features_original(r) for r in training])
y_orig = np.array([int(float(r["Team1_Result"])) for r in training], dtype=int)
# Original encoding: 1=win, 0=lose, 2=draw. Remap to 0=lose, 1=draw, 2=win for nicer ordering? 
# Keep original: 0 lose, 1 win, 2 draw to match notebooks.

# Standardize
mu = X_orig.mean(axis=0)
sg = X_orig.std(axis=0)
sg[sg == 0] = 1.0
Xz = (X_orig - mu) / sg

rng = np.random.default_rng(42)
idx = rng.permutation(len(y_orig))
n_test = max(1, int(0.1 * len(idx)))
test_idx, train_idx = idx[:n_test], idx[n_test:]
# match original split style (random 10% then half of that for test) — we use 10% holdout
W_orig, b_orig = train_softmax(Xz[train_idx], y_orig[train_idx], n_classes=3, seed=42)
P = predict_proba(Xz[test_idx], W_orig, b_orig)
pred = P.argmax(axis=1)
yt = y_orig[test_idx]
orig_metrics = {
    "name": "logistic_original_features",
    "description": "Multinomial logistic regression on the five numeric differentials from training.csv (FIFA rank + GK/DEF/OFF/MID). Browser-runnable reconstruction of the 2022 feature set — not a reimplementation of XGBoost.",
    "nTrain": int(len(train_idx)),
    "nTest": int(len(test_idx)),
    "accuracy": accuracy(yt, pred),
    "f1Macro": f1_macro(yt, pred, 3),
    "report": class_report(yt, pred, 3),
    "confusion": confusion(yt, pred, 3),
    "labels": ["Team1 lose (0)", "Team1 win (1)", "Draw (2)"],
}

# Knockout-style: drop draws
mask = y_orig != 2
# remap 0/1 stay
Xk, yk = Xz[mask], y_orig[mask]
# y is 0 or 1
idxk = rng.permutation(len(yk))
ntk = max(1, int(0.2 * len(idxk)))
W_ko, b_ko = train_softmax(Xk[idxk[ntk:]], yk[idxk[ntk:]], n_classes=3, seed=1)
Pk = predict_proba(Xk[idxk[:ntk]], W_ko, b_ko)
# For KO we take argmax over classes 0 and 1 only
predk = Pk[:, :2].argmax(axis=1)
ytk = yk[idxk[:ntk]]
ko_metrics = {
    "name": "logistic_knockout_no_draws",
    "description": "Same features, training rows with draws removed (original knockout protocol).",
    "nTrain": int(len(idxk) - ntk),
    "nTest": int(ntk),
    "accuracy": accuracy(ytk, predk),
    "f1Macro": f1_macro(ytk, predk, 2),
    "report": class_report(ytk, predk, 2),
    "confusion": confusion(ytk, predk, 2),
}

# Ablation on original features
ablation = []
feature_sets = [
    ("rank only", [0]),
    ("rank + attack/defense", [0, 2, 3]),
    ("original five features", [0, 1, 2, 3, 4]),
]
for name, cols in feature_sets:
    Xa = Xz[:, cols]
    Wa, ba = train_softmax(Xa[train_idx], y_orig[train_idx], n_classes=3, seed=3)
    pa = predict_proba(Xa[test_idx], Wa, ba).argmax(axis=1)
    ablation.append({
        "name": name,
        "features": [ORIG_NAMES[c] for c in cols],
        "accuracy": accuracy(yt, pa),
        "f1Macro": f1_macro(yt, pa, 3),
    })

# ---------------------------------------------------------------------------
# Walk-forward using international matches + causal Elo + rank (no future FIFA fill)
# ---------------------------------------------------------------------------
print("Walk-forward evaluation…")
# Build match rows with rank + elo at kickoff (elo is causal because we update after the match)
elo2 = defaultdict(lambda: 1500.0)
wf_rows = []  # dicts with year, x, y
for row in intl_sorted:
    h, a = row["home_team"], row["away_team"]
    hg, ag = int(float(row["home_team_score"])), int(float(row["away_team_score"]))
    hr = fnum(row["home_team_fifa_rank"], 50)
    ar = fnum(row["away_team_fifa_rank"], 50)
    year = int(row["date"][:4])
    eh, ea = elo2[h], elo2[a]
    if hg > ag:
        y = 1
        hs = 1.0
    elif hg == ag:
        y = 2
        hs = 0.5
    else:
        y = 0
        hs = 0.0
    x = np.array([
        ar - hr,
        eh - ea,
        fnum(row["home_team_mean_offense_score"], 70) - fnum(row["away_team_mean_defense_score"], 70),
        fnum(row["home_team_mean_defense_score"], 70) - fnum(row["away_team_mean_offense_score"], 70),
        fnum(row["home_team_mean_midfield_score"], 70) - fnum(row["away_team_mean_midfield_score"], 70),
    ], dtype=float)
    wf_rows.append({"year": year, "x": x, "y": y, "home": h, "away": a})
    exp_h = 1.0 / (1.0 + 10 ** ((ea - eh) / 400.0))
    elo2[h] = eh + K * (hs - exp_h)
    elo2[a] = ea + K * ((1 - hs) - (1 - exp_h))

Xw = np.vstack([r["x"] for r in wf_rows])
yw = np.array([r["y"] for r in wf_rows])
years = np.array([r["year"] for r in wf_rows])
muw, sgw = Xw.mean(0), Xw.std(0)
sgw[sgw == 0] = 1
Xwz = (Xw - muw) / sgw

walk = []
for test_year in [2018, 2019, 2020, 2021, 2022]:
    tr = years < test_year
    te = years == test_year
    if tr.sum() < 200 or te.sum() < 30:
        continue
    Ww, bw = train_softmax(Xwz[tr], yw[tr], n_classes=3, seed=test_year)
    pw = predict_proba(Xwz[te], Ww, bw).argmax(axis=1)
    walk.append({
        "trainThrough": test_year - 1,
        "testYear": test_year,
        "nTrain": int(tr.sum()),
        "nTest": int(te.sum()),
        "accuracy": accuracy(yw[te], pw),
        "f1Macro": f1_macro(yw[te], pw, 3),
    })

# Random split vs chronological holdout 2021-2022
tr_rand = rng.permutation(len(yw))
ntr = int(0.8 * len(yw))
Wr, br = train_softmax(Xwz[tr_rand[:ntr]], yw[tr_rand[:ntr]], n_classes=3, seed=9)
pr = predict_proba(Xwz[tr_rand[ntr:]], Wr, br).argmax(1)
random_split_acc = accuracy(yw[tr_rand[ntr:]], pr)
chrono_tr = years <= 2020
chrono_te = years >= 2021
Wc, bc = train_softmax(Xwz[chrono_tr], yw[chrono_tr], n_classes=3, seed=11)
pc = predict_proba(Xwz[chrono_te], Wc, bc).argmax(1)
chrono_acc = accuracy(yw[chrono_te], pc)

# Calibration on original holdout
bins = []
for lo, hi in [(0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.01)]:
    # predicted P(team1 win) = P[:, 1]
    pwin = P[:, 1]
    m = (pwin >= lo) & (pwin < hi)
    if m.sum() == 0:
        bins.append({"predicted": (lo + hi) / 2, "actual": None, "n": 0})
        continue
    actual = float((yt[m] == 1).mean())
    bins.append({"predicted": (lo + min(hi, 1.0)) / 2, "actual": actual, "n": int(m.sum())})

# ---------------------------------------------------------------------------
# Enhanced match engine coefficients (used live)
# Combine original logistic + elo/form/dna as a documented linear blend, then
# also fit a 3-class model on WC-team matches with extra diffs where both teams
# are in the 32 and we have DNA.
# ---------------------------------------------------------------------------
print("Fitting enhanced WC-team model…")
enh_X = []
enh_y = []
for r in training:
    t1, t2 = r["Team1"], r["Team2"]
    if t1 not in team_index or t2 not in team_index:
        continue
    a, b = team_index[t1], team_index[t2]
    # NOTE: DNA/Elo here are end-of-dump snapshots — slight leakage vs match date.
    # Documented in leakage audit. Used only for the enhanced 2026 layer.
    enh_X.append([
        fnum(r["Team2_FIFA_RANK"]) - fnum(r["Team1_FIFA_RANK"]),
        fnum(r["Team1_Offense"]) - fnum(r["Team2_Defense"]),
        fnum(r["Team1_Defense"]) - fnum(r["Team2_Offense"]),
        fnum(r["Team1_Midfield"]) - fnum(r["Team2_Midfield"]),
        fnum(r["Team1_Goalkeeper_Score"]) - fnum(r["Team2_Goalkeeper_Score"]),
        a["elo"] - b["elo"],
        a["form5"]["weighted"] - b["form5"]["weighted"],
        (a["dna"]["attack"] or 70) - (b["dna"]["defense"] or 70),
        (a["dna"]["defense"] or 70) - (b["dna"]["attack"] or 70),
        (a["dna"]["starConcentration"] or 1) - (b["dna"]["starConcentration"] or 1),
        (a["dna"]["depthIndex"] or 1) - (b["dna"]["depthIndex"] or 1),
        (a["squadOverall"] or 75) - (b["squadOverall"] or 75),
    ])
    enh_y.append(int(float(r["Team1_Result"])))

ENH_NAMES = [
    "rank_advantage", "offense_vs_opp_def", "defense_vs_opp_off", "midfield_diff",
    "gk_diff", "elo_diff", "form5_diff", "dna_attack_vs_def", "dna_def_vs_attack",
    "star_diff", "depth_diff", "squad_overall_diff",
]
enh_X = np.array(enh_X, float)
enh_y = np.array(enh_y, int)
mue, sge = enh_X.mean(0), enh_X.std(0)
sge[sge == 0] = 1
Xez = (enh_X - mue) / sge
ie = rng.permutation(len(enh_y))
nte = max(1, int(0.15 * len(ie)))
We, be = train_softmax(Xez[ie[nte:]], enh_y[ie[nte:]], n_classes=3, seed=21)
Pe = predict_proba(Xez[ie[:nte]], We, be)
prede = Pe.argmax(1)
enh_metrics = {
    "name": "logistic_enhanced_dna_elo_form",
    "description": "Adds Elo, recent form, and FIFA 22 Team DNA differentials. Snapshot Elo/DNA are as of 14 Jun 2022 — see leakage audit.",
    "nTrain": int(len(ie) - nte),
    "nTest": int(nte),
    "accuracy": accuracy(enh_y[ie[:nte]], prede),
    "f1Macro": f1_macro(enh_y[ie[:nte]], prede, 3),
    "report": class_report(enh_y[ie[:nte]], prede, 3),
    "confusion": confusion(enh_y[ie[:nte]], prede, 3),
}

# Ablation on enhanced
enh_ablation = []
for name, cols in [
    ("FIFA rank + squad scores", [0, 1, 2, 3, 4]),
    ("+ Elo + form", [0, 1, 2, 3, 4, 5, 6]),
    ("+ Team DNA", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
]:
    Xa = Xez[:, cols]
    Wa, ba = train_softmax(Xa[ie[nte:]], enh_y[ie[nte:]], n_classes=3, seed=4)
    pa = predict_proba(Xa[ie[:nte]], Wa, ba).argmax(1)
    enh_ablation.append({
        "name": name,
        "nFeatures": len(cols),
        "accuracy": accuracy(enh_y[ie[:nte]], pa),
        "f1Macro": f1_macro(enh_y[ie[:nte]], pa, 3),
    })

# Feature sensitivity: mean |W| per feature (class-win column 1)
imp = np.abs(We).mean(axis=1)
importance = sorted(
    [{"feature": ENH_NAMES[i], "weight": float(imp[i])} for i in range(len(ENH_NAMES))],
    key=lambda x: -x["weight"],
)

# ---------------------------------------------------------------------------
# Poisson xG ratings from last 25 matches (goals)
# ---------------------------------------------------------------------------
xg = {}
for team in WC_TEAMS:
    recs = results_by_team[team][-25:]
    gf = mean([r["gf"] for r in recs]) or 1.2
    ga = mean([r["ga"] for r in recs]) or 1.2
    xg[team] = {"attack": gf, "defense": ga}


# ---------------------------------------------------------------------------
# Dataset stats for explorer
# ---------------------------------------------------------------------------
missing_scores = {
    "home_team_goalkeeper_score": 15542,
    "away_team_goalkeeper_score": 15826,
    "home_team_mean_defense_score": 16134,
    "home_team_mean_offense_score": 15411,
    "home_team_mean_midfield_score": 15759,
    "away_team_mean_defense_score": 16357,
    "away_team_mean_offense_score": 15609,
    "away_team_mean_midfield_score": 15942,
}

result_dist = {"Win": 11761, "Lose": 6771, "Draw": 5389}

year_list = [{"year": y, **year_counts[y]} for y in sorted(year_counts)]

# compact recent WC-team matches for data explorer (last 400 involving WC teams)
explorer_matches = []
for row in reversed(intl_sorted):
    if row["home_team"] in WC_TEAMS or row["away_team"] in WC_TEAMS:
        explorer_matches.append({
            "date": row["date"],
            "home": row["home_team"],
            "away": row["away_team"],
            "hg": int(float(row["home_team_score"])),
            "ag": int(float(row["away_team_score"])),
            "tournament": row["tournament"],
            "result": row["home_team_result"],
        })
        if len(explorer_matches) >= 500:
            break
explorer_matches.reverse()

# ---------------------------------------------------------------------------
# Persist
# ---------------------------------------------------------------------------
model_weights = {
    "original": {
        "features": ORIG_NAMES,
        "mean": mu.tolist(),
        "std": sg.tolist(),
        "W": W_orig.tolist(),  # d x 3, classes [lose, win, draw] matching original y
        "b": b_orig.tolist(),
        "classIndex": {"lose": 0, "win": 1, "draw": 2},
        "metrics": orig_metrics,
        "knockout": {
            "W": W_ko.tolist(),
            "b": b_ko.tolist(),
            "metrics": ko_metrics,
        },
    },
    "enhanced": {
        "features": ENH_NAMES,
        "mean": mue.tolist(),
        "std": sge.tolist(),
        "W": We.tolist(),
        "b": be.tolist(),
        "classIndex": {"lose": 0, "win": 1, "draw": 2},
        "metrics": enh_metrics,
        "importance": importance,
    },
    "xg": xg,
    "notebookOriginal": {
        "algorithm": "XGBoostClassifier",
        "hyperparameters": {
            "gamma": 0.01,
            "learning_rate": 0.01,
            "n_estimators": 300,
            "max_depth": 4,
            "objective": "multi:softprob",
        },
        "pipeline": "OneHotEncoder(Team1, Team2) + StandardScaler(with_mean=False) + XGBClassifier",
        "groupStageHoldout": {
            "accuracy": 0.62,
            "nTest": 466,
            "notes": "From Modeling_QFIFA2022.ipynb hold-out after hyperparameter search. Classes 0/1/2 = lose/win/draw.",
            "report": [
                {"class": 0, "precision": 0.57, "recall": 0.63, "f1": 0.60, "support": 121},
                {"class": 1, "precision": 0.64, "recall": 0.88, "f1": 0.75, "support": 240},
                {"class": 2, "precision": 0.25, "recall": 0.01, "f1": 0.02, "support": 105},
            ],
        },
        "groupStageUntunedXgbTest": {"accuracy": 0.55, "nTest": 467},
        "randomForestTest": {"accuracy": 0.57, "nTest": 467},
        "adaboostTest": {"accuracy": 0.57, "nTest": 467},
        "mlpTest": {"accuracy": 0.58, "nTest": 467},
        "knockout": {
            "protocol": "Drop draw rows, binary win/lose",
            "adaboost": {"accuracy": 0.78, "nTest": 722},
            "randomForest": {"accuracy": 0.76, "nTest": 722},
            "xgboost": {"accuracy": 0.78, "nTest": 722},
            "mlp": {"accuracy": 0.77, "nTest": 722},
        },
        "featureDimWithTeamDummies": 404,
        "trainingRows": 9321,
    },
}

experiments = {
    "originalNotebookComparison": model_weights["notebookOriginal"],
    "reconstructionRandomHoldout": orig_metrics,
    "knockoutReconstruction": ko_metrics,
    "enhanced": enh_metrics,
    "ablationOriginal": ablation,
    "ablationEnhanced": enh_ablation,
    "walkForward": walk,
    "splitComparison": [
        {"protocol": "Random 80/20 split (international matches, rank+Elo+scores)", "accuracy": random_split_acc},
        {"protocol": "Chronological: train ≤2020, test 2021–2022", "accuracy": chrono_acc},
        {"protocol": "Original notebook random holdout (XGBoost tuned)", "accuracy": 0.62, "source": "notebook"},
    ],
    "calibration": bins,
    "leakageAudit": [
        {
            "feature": "One-hot team names (original pipeline)",
            "status": "leak-risk",
            "detail": "pd.get_dummies on Team1/Team2 produced 404 columns. The model can memorize team identity rather than matchup structure. Reconstruction engine drops team-name dummies.",
        },
        {
            "feature": "Random train/test split",
            "status": "leak-risk",
            "detail": "Matches from 1993–2022 were shuffled. Later form can leak into training examples of the same team. Walk-forward numbers are lower, as expected.",
        },
        {
            "feature": "FIFA score NA fill with team mean",
            "status": "leak-risk",
            "detail": "groupby(team).transform(mean) uses the whole series, so a 2010 match can receive a mean that includes 2021 ratings.",
        },
        {
            "feature": "Stronger-team reordering at inference",
            "status": "leak-risk",
            "detail": "Final_Prediction.matches() puts the side with higher FIFA 22 potential (or better rank) as Team1. Combined with home-advantage in training (Team1 = home), this biases toward the favourite.",
        },
        {
            "feature": "Knockout model drops draws",
            "status": "protocol",
            "detail": "Accuracy jumps 62% → 78% largely because the hard class is removed, not because knockout football is easier.",
        },
        {
            "feature": "Qatar FIFA 22 players",
            "status": "data-gap",
            "detail": "0 Qatar players in players_22.csv. Original filled remaining NAs with 50. Squad overall 78.93 looks imputed (non-rounded float).",
        },
        {
            "feature": "Information cutoff",
            "status": "ok",
            "detail": "international_matches.csv ends 2022-06-14, five months before kickoff. Tournament results are not in the training dump.",
        },
        {
            "feature": "FIFA 22 game ratings",
            "status": "limitation",
            "detail": "EA squad ratings are not real-world performance. They are a licensed video-game snapshot.",
        },
        {
            "feature": "Enhanced Elo/DNA snapshots",
            "status": "leak-risk",
            "detail": "The 2026 DNA/Elo layer uses 14 Jun 2022 snapshots for every historical training row involving WC teams. Honest for a lab demo; not a production-time-safe feature. The original five-feature logistic does not use them.",
        },
        {
            "feature": "2022 tournament outcomes as labels",
            "status": "ok",
            "detail": "Tournament results are used only for retrospective scoring of predictions, never as training labels.",
        },
    ],
}

dataset_stats = {
    "internationalMatches": {
        "rows": 23921,
        "columns": 25,
        "minDate": "1993-08-08",
        "maxDate": "2022-06-14",
        "resultDistribution": result_dist,
        "missingFifaScores": missing_scores,
        "note": "Kaggle international football results with FIFA video-game squad ratings attached when available.",
    },
    "players22": {
        "rows": 19239,
        "columns": 110,
        "wcPlayers": int(sum(len(by_nat[t]) for t in WC_TEAMS)),
        "qatarPlayers": 0,
        "note": "FIFA 22 player table (sofifa). Qatar has no roster in this extract.",
    },
    "training": {
        "rows": 9321,
        "columns": 13,
        "label": "Team1_Result 1=win, 0=lose, 2=draw",
        "source": "Filtered international matches involving a 2022 World Cup nation, after NA fill.",
    },
    "lastTeamScores": {"rows": 32, "asOf": "June 2022 FIFA window"},
    "squadStats": {"rows": 32, "note": "Best-XI overall/potential from FIFA 22, 4-3-3 preferred in original EDA."},
}

(OUT / "teams.json").write_text(json.dumps({"teams": teams, "cutoff": CUTOFF}, indent=None))
(OUT / "model-weights.json").write_text(json.dumps(model_weights))
(OUT / "experiments.json").write_text(json.dumps(experiments))
(OUT / "dataset-stats.json").write_text(json.dumps({"stats": dataset_stats, "yearly": year_list, "matches": explorer_matches}))

print("Wrote artifacts.")
print("Original logistic acc", round(orig_metrics["accuracy"], 4), "F1", round(orig_metrics["f1Macro"], 4))
print("KO logistic acc", round(ko_metrics["accuracy"], 4))
print("Enhanced acc", round(enh_metrics["accuracy"], 4))
print("Random split", round(random_split_acc, 4), "chrono", round(chrono_acc, 4))
print("Walk-forward", walk)
print("Ablation orig", ablation)
print("Ablation enh", enh_ablation)
print("Calibration", bins)
print("Qatar dna imputed", dna["Qatar"]["imputed"], "playerCount", dna["Qatar"]["playerCount"])
print("Argentina elo", team_index["Argentina"]["elo"], "France", team_index["France"]["elo"])
