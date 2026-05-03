#!/usr/bin/env python3
"""TTS worker: reads plain text from stdin, writes raw PCM audio to stdout.

Output is ALWAYS raw signed 16-bit little-endian PCM at 24kHz mono.
server.js feeds this to ffmpeg for clean MP3 encoding downstream. Keeping
the inter-process handoff in PCM avoids two sources of audible artifacts:

  1. gTTS splits long text at punctuation and returns a separate MP3 per
     segment. Concatenating those MP3s at the byte level (the naive
     approach) produces low-level bleed at every stitch point — the
     "crackle between phrases" the user heard. Decoding each MP3 to PCM
     and splicing in PCM eliminates the seams entirely.
  2. Edge-TTS streams a 48 kbps CBR MP3. Re-encoding that MP3 to MP3
     again (tandem coding) amplifies compression artifacts. Going MP3 ->
     PCM -> clean MP3 once is cleaner than MP3 -> MP3 twice.

Usage:  python3 tts_worker.py [voice]

Voice ids:
  - "gtts" / "gtts:zh-CN" / "gtts:zh-TW"  -> Google Translate TTS
  - "zh-CN-*Neural"                       -> Microsoft Edge neural TTS
"""
import sys
import asyncio
import subprocess
import io

DEFAULT_VOICE = "gtts"
MAX_CHARS = 2500
# PCM format emitted on stdout. server.js ffmpeg input flags must match.
PCM_SAMPLE_RATE = 24000


def mp3_to_pcm(mp3_bytes: bytes) -> bytes:
    """Decode an MP3 blob to raw s16le PCM at PCM_SAMPLE_RATE mono via ffmpeg."""
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-f", "s16le", "-acodec", "pcm_s16le",
            "-ar", str(PCM_SAMPLE_RATE), "-ac", "1",
            "pipe:1",
        ],
        input=mp3_bytes,
        capture_output=True,
    )
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"ffmpeg decode failed: {err}")
    return proc.stdout


def synth_gtts(text: str, lang: str = "zh-CN") -> int:
    """gTTS -> MP3 (segmented internally) -> ffmpeg decode -> PCM to stdout."""
    from gtts import gTTS
    tts = gTTS(text=text, lang=lang, slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    pcm = mp3_to_pcm(buf.getvalue())
    sys.stdout.buffer.write(pcm)
    sys.stdout.buffer.flush()
    return 0


async def synth_edge(text: str, voice: str) -> int:
    """Edge-TTS -> collect MP3 stream -> ffmpeg decode -> PCM to stdout."""
    import edge_tts
    comm = edge_tts.Communicate(text, voice)
    chunks = []
    async for chunk in comm.stream():
        if chunk.get("type") == "audio":
            chunks.append(chunk["data"])
    mp3 = b"".join(chunks)
    if not mp3:
        raise RuntimeError("edge-tts produced no audio")
    pcm = mp3_to_pcm(mp3)
    sys.stdout.buffer.write(pcm)
    sys.stdout.buffer.flush()
    return 0


def main() -> int:
    voice = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VOICE
    text = sys.stdin.read().strip()
    if not text:
        return 0
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    try:
        if voice.startswith("gtts"):
            lang = voice.split(":", 1)[1] if ":" in voice else "zh-CN"
            return synth_gtts(text, lang)
        return asyncio.run(synth_edge(text, voice))
    except Exception as e:
        print(f"tts_worker error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
