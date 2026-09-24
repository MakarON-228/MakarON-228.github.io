"""Оценки сложности реакций моделью CatBoost проекта sibur-ml (SPEC.md §7.8).

Вызывается из scripts/alumina-complexity.ts: на вход (stdin) — имена признаков и строки признаков по id реакции,
на выход (stdout) — {id: оценка}. Модель — models/complexity_model.cbm, путь первым аргументом.
"""

import json
import sys

import pandas as pd
from catboost import CatBoostRegressor

data = json.load(sys.stdin)
model = CatBoostRegressor()
model.load_model(sys.argv[1])
ids = list(data["rows"])
frame = pd.DataFrame([data["rows"][i] for i in ids], columns=data["features"])
json.dump(dict(zip(ids, map(float, model.predict(frame)))), sys.stdout)
