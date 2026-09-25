"""Словарь модели и эталоны для демо ApiExplorer (SPEC.md §7.7) из настоящего бэкенда Academic Profile.

Вызывается из scripts/academic-api.ts. Первый аргумент — папка backend_academic клона
github.com/brainstorm-sirius/academic-profile. На вход (stdin) — выдуманная база, сценарий запросов, адреса для
EmailStr, строки для TF-IDF и секрет JWT; на выход (stdout) — словарь TF-IDF модели команды и ответы оригинала.

Бэкенд поднимается как есть (app/main.py через TestClient) на временной SQLite. Рекомендер получает датасет из тех же
выдуманных учёных: профили — ModelTrainer.load_data из train_model.py, векторы — обученный vectorizer.pkl команды,
KNN — ModelTrainer.train_knn, загрузка — CollaborationRecommender.load_model.
"""

import json
import math
import os
import pickle
import sys
import tempfile
import warnings
from pathlib import Path

backend = Path(sys.argv[1]).resolve()
data = json.load(sys.stdin)
tmp = Path(tempfile.mkdtemp(prefix="academic-api-"))
os.environ["DATABASE_URL"] = f"sqlite:///{tmp / 'users.db'}"
os.environ["SECRET_KEY"] = data["secret"]
sys.path.insert(0, str(backend))
warnings.filterwarnings("ignore")

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from pydantic import EmailStr, TypeAdapter, ValidationError  # noqa: E402

from app import auth, main, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from train_model import ModelTrainer  # noqa: E402

# --- словарь модели команды ---
with open(backend / "model" / "vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)
params = vectorizer.get_params()
assert params["ngram_range"] == (1, 2) and params["lowercase"] and params["norm"] == "l2", params
assert params["token_pattern"] == r"(?u)\b\w\w+\b" and params["analyzer"] == "word", params
assert params["use_idf"] and params["smooth_idf"] and not params["sublinear_tf"], params
assert params["stop_words"] == "english" and params["preprocessor"] is None and params["tokenizer"] is None, params

terms = [""] * len(vectorizer.vocabulary_)
for term, i in vectorizer.vocabulary_.items():
    terms[i] = term
# idf = ln((1 + n) / (1 + df)) + 1: храним целые df и n — короче, чем 1 000 чисел double
n_docs = data["n_docs"]
df_counts = [round((1 + n_docs) / math.exp(v - 1) - 1) for v in vectorizer.idf_]
restored = [math.log((1 + n_docs) / (1 + d)) + 1 for d in df_counts]
assert max(abs(a - b) for a, b in zip(restored, vectorizer.idf_)) < 1e-12, "idf is not ln((1+n)/(1+df))+1"
model = {"terms": terms, "df": df_counts, "n_docs": n_docs, "stop_words": sorted(vectorizer.get_stop_words())}

# --- база ---
models.Base.metadata.create_all(bind=engine)
db = SessionLocal()
for u in data["users"]:
    u = dict(u)
    password = u.pop("password")
    db.add(models.User(**u, password_hash=auth.get_password_hash(password)))
db.add_all(models.Author(**a) for a in data["authors"])
db.add_all(models.AuthorInterest(**a) for a in data["author_interests"])
db.add_all(models.UserPublication(**p) for p in data["user_publications"])
db.commit()
db.close()

# --- рекомендер на выдуманных учёных ---
rows = [
    {
        "Author_ID": a["author_id"],
        "Author_Name": a["author_name"],
        "Interests_List": a["interests_list"],
        "Keywords_List": a["keywords_list"],
        "Interests_Count": a["interests_count"],
        "Articles_Count": a["articles_count"],
        "Main_Interest": a["main_interest"],
        "Cluster": a["cluster"],
    }
    for a in data["author_interests"]
]
csv_path = tmp / "authors_scientific_interests.csv"
pd.DataFrame(rows).to_csv(csv_path, index=False)
trainer = ModelTrainer(str(csv_path), str(tmp / "model"))
trainer.load_data()
assert [str(x) for x in trainer.df["Author_ID"]] == [r["Author_ID"] for r in rows], "Author_ID parsed as numbers"
trainer.vectorizer = vectorizer
trainer.author_vectors = vectorizer.transform(trainer.df["author_profile"].fillna("").tolist())
trainer.train_knn()
trainer.save_model()
main.recommender.load_model(str(tmp / "model"))

# --- сценарий ---
client = TestClient(main.app, raise_server_exceptions=False)
token = None
ghost = auth.create_access_token({"sub": "999"})
responses = []
for r in data["scenario"]:
    headers = {}
    if r.get("auth") == "token":
        headers["Authorization"] = f"Bearer {token}"
    elif r.get("auth") == "bad":
        headers["Authorization"] = "Bearer not-a-token"
    elif r.get("auth") == "ghost":
        headers["Authorization"] = f"Bearer {ghost}"
    kwargs = {"headers": headers, "params": r.get("query")}
    if "body" in r:
        headers["Content-Type"] = "application/json"
        kwargs["content"] = r["body"].encode("utf-8")
    if "file" in r:
        kwargs["files"] = {"file": (r["file"]["name"], r["file"]["text"].encode("utf-8"), "text/csv")}
    res = client.request(r["method"], r["path"], **kwargs)
    is_json = res.headers.get("content-type", "").startswith("application/json")
    body = res.json() if is_json else res.text
    if r["path"] == "/auth/login" and res.status_code == 200:
        token = body["access_token"]
    responses.append({"status": res.status_code, "body": body, "www_authenticate": res.headers.get("www-authenticate")})

# --- EmailStr, TF-IDF, JWT ---
email = TypeAdapter(EmailStr)
emails = []
for e in data["emails"]:
    try:
        emails.append({"input": e, "ok": email.validate_python(e)})
    except ValidationError as ex:
        emails.append({"input": e, "error": json.loads(ex.json(include_url=False))[0]})

tfidf = []
for s in data["tfidf"]:
    row = vectorizer.transform([s]).tocoo()
    tfidf.append({"input": s, "vector": {str(int(i)): float(v) for i, v in zip(row.col, row.data)}})

claims = {"sub": "1"}
claims.update({"exp": data["jwt_exp"]})
jwt_golden = {"secret": data["secret"], "claims": claims, "token": jwt.encode(claims, data["secret"], algorithm=auth.ALGORITHM)}

json.dump(
    {"model": model, "golden": {"responses": responses, "emails": emails, "tfidf": tfidf, "jwt": jwt_golden}},
    sys.stdout,
    ensure_ascii=False,
)
