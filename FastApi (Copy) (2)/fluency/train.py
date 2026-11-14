import joblib
import pandas as pd
from scipy.stats import pearsonr, spearmanr
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("features.csv")
X = df.drop(columns=["utt", "speaker", "fluency"])
y = df["fluency"]
groups = df["speaker"]

models = {
    "ridge": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
    "gradient_boosting": GradientBoostingRegressor(n_estimators=200, max_depth=3),
}
for name, m in models.items():
    pred = cross_val_predict(m, X, y, groups=groups, cv=GroupKFold(5))
    print(f"{name}: Pearson={pearsonr(y, pred)[0]:.3f}  Spearman={spearmanr(y, pred)[0]:.3f}")

best = models["gradient_boosting"].fit(X, y)
joblib.dump((best, list(X.columns)), "fluency_model.joblib")
print("saved fluency_model.joblib")
