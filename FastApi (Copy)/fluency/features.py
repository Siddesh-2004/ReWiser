import numpy as np
import soundfile as sf
import torch
import torchaudio.functional as AF
from silero_vad import load_silero_vad, get_speech_timestamps

_model = load_silero_vad()

def load_audio(path, target_sr=16000):
    data, sr = sf.read(path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    wav = torch.from_numpy(data)
    if sr != target_sr:
        wav = AF.resample(wav, sr, target_sr)
    return wav

def extract_features(wav, pause_min=0.25, long_pause=0.5):
    speech = get_speech_timestamps(wav, _model, return_seconds=True)
    if len(speech) == 0:
        return None
    start, end = speech[0]["start"], speech[-1]["end"]
    duration = max(end - start, 1e-6)
    gaps = [speech[i+1]["start"] - speech[i]["end"] for i in range(len(speech)-1)]
    pauses = [g for g in gaps if g >= pause_min]
    runs = [s["end"] - s["start"] for s in speech]
    return {
        "duration": duration,
        "pause_ratio": sum(pauses) / duration,
        "pauses_per_sec": len(pauses) / duration,
        "mean_pause": float(np.mean(pauses)) if pauses else 0.0,
        "longest_pause": max(pauses) if pauses else 0.0,
        "long_pauses_per_sec": sum(p >= long_pause for p in pauses) / duration,
        "mean_run": float(np.mean(runs)),
        "std_run": float(np.std(runs)),
        "n_segments": len(speech),
    }
