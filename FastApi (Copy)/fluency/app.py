import os, tempfile
import joblib
import numpy as np
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
from silero_vad import get_speech_timestamps
from faster_whisper import WhisperModel
from features import load_audio, extract_features, _model as vad_model

st.title("Speech Fluency Checker")
model, cols = joblib.load("fluency_model.joblib")


@st.cache_resource
def get_whisper():
    return WhisperModel("tiny.en", device="cpu", compute_type="int8", local_files_only=True)


audio_file = st.file_uploader("Upload your answer (WAV)", type=["wav", "flac", "ogg"])

if audio_file:
    st.audio(audio_file)
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.name)[1]) as f:
        f.write(audio_file.read())
        path = f.name
    try:
        wav = load_audio(path)
        with st.spinner("Transcribing..."):
            segments, _ = get_whisper().transcribe(wav.numpy(), language="en")
            text = " ".join(s.text.strip() for s in segments)
    finally:
        os.remove(path)

    feats = extract_features(wav)
    if feats is None:
        st.warning("No speech detected.")
        st.stop()

    words = len(text.split())
    feats["wps"] = words / feats["duration"]
    feats["run_words"] = words / feats["n_segments"]

    X = pd.DataFrame([[feats[c] for c in cols]], columns=cols)
    pred = float(model.predict(X)[0])
    # model predicts roughly 5-10; map to 0-100 for display
    score = int(np.clip((pred - 5) / 5 * 100, 0, 100))

    st.header(f"Fluency score: {score}/100")
    st.caption("Trained on speechocean762 (Mandarin-L1 read speech, 1,500 clips). "
               "Indian-English interview performance is untested. Treat as an estimate.")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Words/sec", f"{feats['wps']:.2f}")
    c2.metric("Pause ratio", f"{feats['pause_ratio']:.0%}")
    c3.metric("Longest pause", f"{feats['longest_pause']:.1f}s")
    c4.metric("Pauses/min", f"{feats['pauses_per_sec'] * 60:.1f}")

    tips = []
    if feats["wps"] < 1.8:
        tips.append("Your speaking pace is slow. Try to speak a little faster and more steadily.")
    if feats["pause_ratio"] > 0.2:
        tips.append("You spend a lot of time in silence. Try to keep your thoughts flowing.")
    if feats["longest_pause"] > 1.0:
        tips.append(f"Your longest pause was {feats['longest_pause']:.1f}s. Try a phrase like 'let me think about that' instead of silence.")
    if feats["pauses_per_sec"] * 60 > 15:
        tips.append("You pause often. Practice finishing full sentences before stopping.")
    st.subheader("Feedback")
    for t in tips or ["Good flow. No major problems detected."]:
        st.write("• " + t)

    with st.expander("Transcript (Whisper)"):
        st.write(text)

    speech = get_speech_timestamps(wav, vad_model, return_seconds=True)
    fig, ax = plt.subplots(figsize=(10, 1.5))
    for s in speech:
        ax.axvspan(s["start"], s["end"], color="green", alpha=0.6)
    ax.set_xlim(0, len(wav) / 16000)
    ax.set_yticks([])
    ax.set_xlabel("Time (s) | green = speaking, white = silence")
    st.pyplot(fig)
