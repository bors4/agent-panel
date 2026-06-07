import { ref, computed, onUnmounted } from "vue";
import { cleanText, transcribeAudio } from "@/api/client";

/**
 * Максимальная длительность записи (5 минут) — защита от бесконечного роста audioChunks.
 */
const MAX_RECORDING_MS = 5 * 60 * 1000;

/**
 * Composable для голосового ввода.
 * Поддерживает два режима:
 *   1. Web Speech API (браузер) — по умолчанию
 *   2. Серверный ASR (whisper.cpp / faster-whisper) — при useServerAsr: true
 *
 * В обоих случаях сырой текст очищается от слов-паразитов через LLM.
 *
 * @param {{ onResult?: (cleanedText: string) => void, useServerAsr?: boolean, language?: string }} [options]
 */
export function useVoiceInput(options = {}) {
  const isRecording = ref(false);
  const isProcessing = ref(false);
  const transcript = ref("");
  const interimTranscript = ref("");
  const error = ref(null);

  // Язык: берём из options или navigator.language, fallback "ru-RU"
  const language = options.language || (typeof navigator !== "undefined" && navigator.language) || "ru-RU";

  /** @type {SpeechRecognition|null} */
  let recognition = null;
  /** @type {MediaRecorder|null} */
  let mediaRecorder = null;
  /** @type {MediaStream|null} */
  let activeStream = null;
  /** @type {AbortController|null} */
  let cleanAbort = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let maxDurationTimer = null;
  const audioChunks = [];

  const isSupported = computed(() => {
    if (typeof window === "undefined") return false;
    if (options.useServerAsr) {
      return typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined";
    }
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  });

  // ─── Web Speech API mode ───────────────────────────────────────────────

  function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SpeechRecognition();
    r.lang = language;
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;

    r.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        transcript.value += final;
      }
      interimTranscript.value = interim;
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        interimTranscript.value = "";
        return;
      }
      error.value = `Ошибка распознавания: ${event.error}`;
      interimTranscript.value = "";
      isRecording.value = false;
    };

    r.onend = () => {
      isRecording.value = false;
      interimTranscript.value = "";
      const raw = transcript.value.trim();
      if (raw) {
        processText(raw);
      }
    };

    return r;
  }

  function startWebSpeech() {
    error.value = null;
    transcript.value = "";
    interimTranscript.value = "";
    recognition = createRecognition();
    try {
      recognition.start();
      isRecording.value = true;
    } catch (e) {
      error.value = `Не удалось начать запись: ${e.message}`;
      isRecording.value = false;
    }
  }

  function stopWebSpeech() {
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
  }

  // ─── Server ASR mode (MediaRecorder) ───────────────────────────────────

  async function startServerAsr() {
    error.value = null;
    transcript.value = "";
    interimTranscript.value = "";
    audioChunks.length = 0;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream = stream;
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // НЕМЕДЛЕННАЯ очистка треков — предотвращает утечку даже при unmount во время onstop
        if (activeStream) {
          activeStream.getTracks().forEach((t) => t.stop());
          activeStream = null;
        }
        isRecording.value = false;
        clearMaxDurationTimer();

        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        audioChunks.length = 0;
        await transcribeAndClean(audioBlob);
      };

      mediaRecorder.start();
      isRecording.value = true;
      startMaxDurationTimer();
    } catch (e) {
      // Cleanup при ошибке getUserMedia
      if (stream) stream.getTracks().forEach((t) => t.stop());
      activeStream = null;
      error.value = `Микрофон недоступен: ${e.message}`;
      isRecording.value = false;
    }
  }

  function stopServerAsr() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  }

  // ─── Max duration guard (L-15) ─────────────────────────────────────────

  function startMaxDurationTimer() {
    clearMaxDurationTimer();
    maxDurationTimer = setTimeout(() => {
      if (isRecording.value) {
        error.value = `Максимум ${MAX_RECORDING_MS / 60000} мин записи. Отправляю...`;
        stopRecording();
      }
    }, MAX_RECORDING_MS);
  }

  function clearMaxDurationTimer() {
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  }

  // ─── Transcribe + clean (signal propagated) ────────────────────────────

  async function transcribeAndClean(audioBlob) {
    isProcessing.value = true;
    error.value = null;
    cleanAbort = new AbortController();
    try {
      const result = await transcribeAudio(audioBlob, language, cleanAbort.signal);
      const rawText = (result.text || "").trim();
      if (!rawText) {
        error.value = "Речь не распознана";
        return;
      }
      transcript.value = rawText;

      // Clean text via LLM (signal propagated)
      const cleanResult = await cleanText(rawText, cleanAbort.signal);
      const cleaned = (cleanResult.cleaned || "").trim() || rawText;
      options.onResult?.(cleaned);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.warn("[useVoiceInput] server ASR failed:", e);
      error.value = `Ошибка ASR: ${e.message}`;
    } finally {
      isProcessing.value = false;
      cleanAbort = null;
    }
  }

  // ─── Common ────────────────────────────────────────────────────────────

  async function processText(rawText) {
    isProcessing.value = true;
    error.value = null;
    cleanAbort = new AbortController();
    try {
      const result = await cleanText(rawText, cleanAbort.signal);
      const cleaned = (result.cleaned || "").trim() || rawText;
      options.onResult?.(cleaned);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.warn("[useVoiceInput] cleanText failed, using raw:", e);
      options.onResult?.(rawText);
    } finally {
      isProcessing.value = false;
      cleanAbort = null;
    }
  }

  function startRecording() {
    if (!isSupported.value) {
      error.value = options.useServerAsr
        ? "MediaRecorder не поддерживается в этом браузере"
        : "Распознавание речи не поддерживается в этом браузере";
      return;
    }
    if (options.useServerAsr) {
      startServerAsr();
    } else {
      startWebSpeech();
    }
  }

  function stopRecording() {
    if (options.useServerAsr) {
      stopServerAsr();
    } else {
      stopWebSpeech();
    }
  }

  function toggleRecording() {
    if (isRecording.value) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function cancel() {
    if (recognition) {
      try {
        recognition.abort();
      } catch {}
      recognition = null;
    }
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch {}
    }
    // НЕМЕДЛЕННАЯ очистка stream треков (даже если onstop ещё не сработал)
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
    if (cleanAbort) {
      cleanAbort.abort();
      cleanAbort = null;
    }
    clearMaxDurationTimer();
    isRecording.value = false;
    isProcessing.value = false;
    transcript.value = "";
    interimTranscript.value = "";
    audioChunks.length = 0;
  }

  onUnmounted(() => {
    cancel();
  });

  return {
    isRecording,
    isProcessing,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    cancel,
  };
}
