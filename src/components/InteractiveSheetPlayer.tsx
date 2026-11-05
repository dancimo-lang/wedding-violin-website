'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { goldButtonClass, outlineButtonClass } from '@/components/public-button';
import {
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  playbackBpm,
  scaledStepMs,
  stepAfter,
  type LoopRange,
} from '@/lib/sheet-player/playback';
import type { SoundfontPlayer } from 'soundfont-player';

type ScoreNote = { name: string; frequency: number };
type ScoreStep = { notes: ScoreNote[]; ms: number; measure: number };

type Props = {
  scoreUrl: string;
  title: string;
  onUnavailable: () => void;
};

export default function InteractiveSheetPlayer({ scoreUrl, title, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onUnavailableRef = useRef(onUnavailable);
  const stepsRef = useRef<ScoreStep[]>([]);
  const percentRef = useRef(100);
  const volumeRef = useRef(0.8);
  const loopRef = useRef(false);
  const loopRangeRef = useRef<LoopRange>({ from: 1, to: 1 });
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const stepIndexRef = useRef(0);
  const cursorIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const violinRef = useRef<SoundfontPlayer | null>(null);
  const osmdRef = useRef<{
    cursor: {
      reset: () => void;
      next: () => void;
      show: () => void;
      cursorElement?: HTMLElement | null;
    };
    clear: () => void;
  } | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'playing'>('loading');
  const [message, setMessage] = useState('');
  const [writtenBpm, setWrittenBpm] = useState(120);
  const [percent, setPercent] = useState(100);
  const [volume, setVolume] = useState(80);
  const [loop, setLoop] = useState(false);
  const [loopFrom, setLoopFrom] = useState(1);
  const [loopTo, setLoopTo] = useState(1);
  const [measureCount, setMeasureCount] = useState(1);
  const [nowMeasure, setNowMeasure] = useState(1);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    percentRef.current = percent;
  }, [percent]);

  useEffect(() => {
    volumeRef.current = volume / 100;
    if (gainRef.current && audioRef.current) {
      gainRef.current.gain.setTargetAtTime(volume / 100, audioRef.current.currentTime, 0.03);
    }
  }, [volume]);

  useEffect(() => {
    loopRef.current = loop;
    loopRangeRef.current = { from: loopFrom, to: loopTo };
  }, [loop, loopFrom, loopTo]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    async function loadScore() {
      try {
        const [{ OpenSheetMusicDisplay, Fraction, CursorType }, response] = await Promise.all([
          import('opensheetmusicdisplay'),
          fetch(scoreUrl),
        ]);
        if (!response.ok) throw new Error('The score could not be loaded.');
        const extension = scoreUrl.split('?')[0]?.toLowerCase() ?? '';
        const content = extension.endsWith('.mxl') ? await response.blob() : await response.text();
        if (cancelled || !host) return;
        host.replaceChildren();
        const osmd = new OpenSheetMusicDisplay(host, {
          backend: 'svg',
          autoResize: false,
          drawTitle: true,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawPartNames: false,
          drawPartAbbreviations: false,
          drawMeasureNumbers: true,
          followCursor: true,
          cursorsOptions: [{ type: CursorType.Standard, color: '#c9a961', alpha: 0.85, follow: true }],
        });
        await osmd.load(content);
        if (cancelled) {
          osmd.clear();
          return;
        }
        osmd.render();
        osmd.cursor.show();
        const steps: ScoreStep[] = [];
        const cursor = osmd.cursor;
        while (!cursor.Iterator.EndReached) {
          const settings = cursor.Iterator.currentPlaybackSettings();
          const start = cursor.Iterator.CurrentEnrolledTimestamp;
          const measure = cursor.Iterator.CurrentMeasureIndex + 1;
          const notes = cursor.NotesUnderCursor().flatMap((note) => {
            if (note.isRest() || !note.Pitch) return [];
            const name = note.Pitch.ToStringShort();
            const frequency = note.Pitch.Frequency;
            if (!name || !Number.isFinite(frequency)) return [];
            return [{ name, frequency }];
          });
          cursor.next();
          let ms = 500;
          if (!cursor.Iterator.EndReached && start) {
            const delta = Fraction.minus(cursor.Iterator.CurrentEnrolledTimestamp, start);
            const measured = settings.getDurationInMilliseconds(delta);
            if (Number.isFinite(measured) && measured > 20) ms = measured;
          }
          steps.push({ notes, ms, measure });
        }
        if (steps.length === 0) throw new Error('The score has no notes.');
        cursor.reset();
        cursor.show();
        const sheetBpm = osmd.Sheet?.DefaultStartTempoInBpm;
        const bpm = Number.isFinite(sheetBpm) && sheetBpm > 0 ? Math.round(sheetBpm) : 120;
        const lastMeasure = steps.reduce((max, step) => Math.max(max, step.measure), 1);
        osmdRef.current = osmd;
        stepsRef.current = steps;
        stepIndexRef.current = 0;
        cursorIndexRef.current = 0;
        setWrittenBpm(bpm);
        setMeasureCount(lastMeasure);
        setLoopTo(lastMeasure);
        loopRangeRef.current = { from: 1, to: lastMeasure };
        setStatus('ready');
      } catch {
        if (!cancelled) onUnavailableRef.current();
      }
    }

    void loadScore();
    return () => {
      cancelled = true;
      window.clearTimeout(timerRef.current ?? undefined);
      playingRef.current = false;
      violinRef.current?.stop();
      void audioRef.current?.close();
      audioRef.current = null;
      gainRef.current = null;
      violinRef.current = null;
      osmdRef.current?.clear();
      osmdRef.current = null;
    };
  }, [scoreUrl]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status === 'loading') return;
    let frame = 0;
    let lastWidth = host.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = host.clientWidth;
      if (Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (playingRef.current) return;
        const osmd = osmdRef.current as { render?: () => void; cursor?: { reset: () => void; show: () => void } } | null;
        osmd?.render?.();
        osmd?.cursor?.reset();
        osmd?.cursor?.show();
        cursorIndexRef.current = 0;
        stepIndexRef.current = 0;
      });
    });
    observer.observe(host);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [status]);

  function placeCursor(index: number) {
    const osmd = osmdRef.current;
    if (!osmd) return;
    if (index < cursorIndexRef.current) {
      osmd.cursor.reset();
      cursorIndexRef.current = 0;
    }
    while (cursorIndexRef.current < index) {
      osmd.cursor.next();
      cursorIndexRef.current += 1;
    }
    try {
      osmd.cursor.show();
      const marker = osmd.cursor.cursorElement;
      if (marker) {
        marker.style.zIndex = '40';
        marker.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } catch {
      // Keep playing if the highlight cannot be drawn.
    }
  }

  function stopPlayback(resetCursor: boolean) {
    playingRef.current = false;
    window.clearTimeout(timerRef.current ?? undefined);
    timerRef.current = null;
    violinRef.current?.stop();
    if (resetCursor) {
      stepIndexRef.current = 0;
      setNowMeasure(1);
      placeCursor(0);
    }
    setStatus('ready');
  }

  function playTone(note: ScoreNote, when: number, seconds: number) {
    const context = audioRef.current;
    const destination = gainRef.current;
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(note.frequency, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, when);
    noteGain.gain.setValueAtTime(0.0001, when);
    noteGain.gain.exponentialRampToValueAtTime(0.2, when + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(seconds, 0.05));
    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(destination);
    oscillator.start(when);
    oscillator.stop(when + seconds + 0.05);
  }

  function schedule(index: number) {
    const steps = stepsRef.current;
    if (!playingRef.current || index < 0 || index >= steps.length) {
      stopPlayback(true);
      return;
    }
    stepIndexRef.current = index;
    setNowMeasure(steps[index]?.measure ?? 1);
    try {
      placeCursor(index);
    } catch {
      // The highlight is optional. The notes still play.
    }
    const step = steps[index];
    const ms = Math.max(40, scaledStepMs(step.ms, percentRef.current));
    const context = audioRef.current;
    const when = (context?.currentTime ?? 0) + 0.05;
    const seconds = Math.max(0.05, (ms / 1000) * 0.92);
    const violin = violinRef.current;
    for (const note of step.notes) {
      if (violin) violin.play(note.name, when, { duration: seconds, gain: volumeRef.current });
      else playTone(note, when, seconds);
    }
    timerRef.current = window.setTimeout(() => {
      const measures = stepsRef.current.map((item) => item.measure);
      const following = stepAfter(index, measures, loopRef.current ? loopRangeRef.current : null);
      schedule(following);
    }, ms);
  }

  async function startPlayback() {
    if (startingRef.current) return;
    if (playingRef.current) {
      stopPlayback(false);
      return;
    }
    startingRef.current = true;
    try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setMessage('Playback is not available in this browser. The PDF is still here.');
      return;
    }
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    if (!gainRef.current) {
      const gain = context.createGain();
      gain.gain.value = volumeRef.current;
      gain.connect(context.destination);
      gainRef.current = gain;
    }
    // Resume inside the click so iOS allows sound. Later notes use this context.
    void context.resume();
    if (!violinRef.current) {
      setMessage('Loading violin sound…');
      try {
        const soundfont = (await import('soundfont-player')).default;
        const notes = [...new Set(stepsRef.current.flatMap((step) => step.notes.map((note) => note.name)))];
        violinRef.current = await soundfont.instrument(context, 'violin', {
          destination: gainRef.current,
          notes,
          soundfont: 'MusyngKite',
          format: 'mp3',
        });
        setMessage('');
      } catch {
        setMessage('Violin sample unavailable. Playing a simple tone.');
      }
    }
    if (context.state === 'suspended') await context.resume();
    playingRef.current = true;
    setStatus('playing');
    const steps = stepsRef.current;
    const startAt = stepIndexRef.current >= steps.length ? 0 : stepIndexRef.current;
    schedule(startAt);
    } finally {
      startingRef.current = false;
    }
  }

  const bpm = playbackBpm(writtenBpm, percent);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={goldButtonClass} onClick={() => void startPlayback()} disabled={status === 'loading'}>
            {status === 'playing' ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {status === 'playing' ? 'Pause' : 'Play'}
          </button>
          <button type="button" className={outlineButtonClass} onClick={() => stopPlayback(true)} disabled={status === 'loading'}>
            <Square className="h-4 w-4" aria-hidden />
            Stop
          </button>
        </div>
        <label className="block text-sm font-medium text-ink">
          Tempo {bpm} BPM
          <span className="mt-0.5 block font-normal text-ink-soft">{percent}% of the written tempo</span>
          <input
            type="range"
            min={TEMPO_PERCENT_MIN}
            max={TEMPO_PERCENT_MAX}
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
            aria-valuemin={TEMPO_PERCENT_MIN}
            aria-valuemax={TEMPO_PERCENT_MAX}
            aria-valuenow={percent}
            aria-label="Tempo"
            className="mt-2 h-8 w-full accent-gold"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Volume
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            className="mt-2 h-8 w-full accent-gold"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
          Loop
        </label>
        <p className="text-sm text-ink-soft" aria-live="polite">
          Measure {nowMeasure} of {measureCount}
        </p>
          {loop && measureCount > 1 ? (
            <>
              <label className="text-sm text-ink">
                From measure
                <input
                  type="number"
                  min={1}
                  max={measureCount}
                  value={loopFrom}
                  onChange={(event) => setLoopFrom(Number(event.target.value))}
                  className="ml-2 w-16 rounded-lg border border-cream-line bg-cream px-2 py-1 text-ink"
                />
              </label>
              <label className="text-sm text-ink">
                To measure
                <input
                  type="number"
                  min={1}
                  max={measureCount}
                  value={loopTo}
                  onChange={(event) => setLoopTo(Number(event.target.value))}
                  className="ml-2 w-16 rounded-lg border border-cream-line bg-cream px-2 py-1 text-ink"
                />
              </label>
            </>
          ) : null}
        </div>
        {message ? <p className="text-sm text-ink-body">{message}</p> : null}
      </div>
      <div ref={hostRef} className="min-h-40 w-full overflow-x-auto bg-white" aria-label={`${title} interactive score`} />
      {status === 'loading' ? <p className="text-center text-ink-body">Loading score…</p> : null}
    </div>
  );
}
