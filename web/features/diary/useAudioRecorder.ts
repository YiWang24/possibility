"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "paused";

export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  recordedAt: string;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/mpeg",
];

function preferredMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

function baseMimeType(value: string): string {
  return value.split(";", 1)[0]?.toLowerCase() || "audio/webm";
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const recordedAtRef = useRef("");
  const stopResolverRef = useRef<((result: RecordingResult) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      durationRef.current += 250;
      setDurationMs(durationRef.current);
    }, 250);
  }, [clearTimer]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。");
      return;
    }
    setState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const preferred = preferredMimeType();
      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      durationRef.current = 0;
      setDurationMs(0);
      recordedAtRef.current = new Date().toISOString();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTimer();
        const mimeType = baseMimeType(recorder.mimeType || preferred);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const resolve = stopResolverRef.current;
        stopResolverRef.current = null;
        stopTracks();
        recorderRef.current = null;
        chunksRef.current = [];
        setState("idle");
        resolve?.({
          blob,
          mimeType,
          durationMs: durationRef.current,
          recordedAt: recordedAtRef.current,
        });
      };
      recorder.onerror = () => {
        clearTimer();
        stopTracks();
        recorderRef.current = null;
        setState("idle");
        setError("录音意外中断，请重新尝试。");
      };

      recorder.start(1000);
      setState("recording");
      startTimer();
    } catch (cause) {
      stopTracks();
      setState("idle");
      const denied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError");
      setError(
        denied
          ? "没有获得麦克风权限，请在浏览器设置中允许后重试。"
          : "无法启动麦克风，请检查设备后重试。",
      );
    }
  }, [startTimer, state, stopTracks, clearTimer]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    clearTimer();
    setState("paused");
  }, [clearTimer]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startTimer();
    setState("recording");
  }, [startTimer]);

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;
    return new Promise<RecordingResult>((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopResolverRef.current = () => undefined;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    clearTimer();
    stopTracks();
    chunksRef.current = [];
    recorderRef.current = null;
    durationRef.current = 0;
    setDurationMs(0);
    setState("idle");
    setError(null);
  }, [clearTimer, stopTracks]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, [clearTimer, stopTracks]);

  return {
    state,
    durationMs,
    error,
    isRecording: state === "recording" || state === "paused",
    start,
    pause,
    resume,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
