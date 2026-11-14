import glob, json, os
import pandas as pd
from features import load_audio, extract_features

root = "speechocean762"
scores = {}
for p in glob.glob(f"{root}/**/scores.json", recursive=True):
    scores.update(json.load(open(p)))

wavs = {os.path.splitext(os.path.basename(p))[0]: p
        for p in glob.glob(f"{root}/**/*.WAV", recursive=True)}
print("audio files:", len(wavs), "| scored:", len(scores))

rows = []
for utt, info in scores.items():
    if len(rows) >= 1500:
        break
    if utt not in wavs:
        continue
    feats = extract_features(load_audio(wavs[utt]))
    if feats is None:
        continue
    feats.update(utt=utt, speaker=utt[:4], fluency=info["fluency"])
    rows.append(feats)
    if len(rows) % 100 == 0:
        print(len(rows), "done")

pd.DataFrame(rows).to_csv("features.csv", index=False)
print("saved features.csv")
