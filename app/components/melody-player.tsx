'use client';

import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { MelodyStructure } from '@/lib/agent/schemas/melody';

interface MelodyPlayerProps {
  melody: MelodyStructure;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onTimeUpdate?: (currentBeat: number, currentTime: number) => void;
}

export function MelodyPlayer({ melody, onPlay, onPause, onStop, onTimeUpdate }: MelodyPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const synthsRef = useRef<Tone.PolySynth[]>([]);
  const partsRef = useRef<Tone.Part[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    // Set tempo
    Tone.Transport.bpm.value = melody.tempo;

    // Cleanup on unmount
    return () => {
      stopPlayback();
    };
  }, [melody]);

  const startPlayback = async () => {
    // Initialize audio context (required by browsers)
    await Tone.start();

    if (isPaused) {
      // Resume from paused position
      Tone.Transport.start();
      startTimeRef.current = Tone.now() - pausedTimeRef.current;
      setIsPlaying(true);
      setIsPaused(false);
      onPlay?.();
      return;
    }

    // Stop any existing playback
    stopPlayback();

    // Create synths for each track
    synthsRef.current = melody.tracks.map(() => {
      return new Tone.PolySynth(Tone.Synth).toDestination();
    });

    // Convert beats to seconds (60 seconds per minute / tempo = seconds per beat)
    const secondsPerBeat = 60 / melody.tempo;

    // Create parts for each track
    partsRef.current = melody.tracks.map((track, trackIdx) => {
      const synth = synthsRef.current[trackIdx];
      const events: Array<{ time: number; note: string; duration: number; velocity: number }> = [];

      // Convert MIDI notes to Tone.js events
      track.notes.forEach(note => {
        const noteName = Tone.Frequency(note.note, 'midi').toNote();
        const startTimeSeconds = note.startTime * secondsPerBeat;
        const durationSeconds = note.duration * secondsPerBeat;
        const velocity = note.velocity / 127; // Normalize to 0-1

        events.push({
          time: startTimeSeconds,
          note: noteName,
          duration: durationSeconds,
          velocity: velocity,
        });
      });

      // Sort events by time
      events.sort((a, b) => a.time - b.time);

      // Create Tone.Part to schedule notes
      const part = new Tone.Part((time, event) => {
        synth.triggerAttackRelease(event.note, event.duration, time, event.velocity);
      }, events);

      part.start(0);
      return part;
    });

    // Start transport
    startTimeRef.current = Tone.now();
    Tone.Transport.start();
    setIsPlaying(true);
    setIsPaused(false);
    onPlay?.();

    // Update current time
    intervalRef.current = setInterval(() => {
      const elapsed = Tone.Transport.seconds;
      setCurrentTime(elapsed);
      
      // Calculate current beat
      const currentBeat = elapsed / secondsPerBeat;
      
      // Notify parent of time update
      onTimeUpdate?.(currentBeat, elapsed);
      
      const totalDuration = melody.totalBeats * secondsPerBeat;
      
      // Stop when finished
      if (elapsed >= totalDuration) {
        stopPlayback();
      }
    }, 100);
  };

  const pausePlayback = () => {
    Tone.Transport.pause();
    pausedTimeRef.current = Tone.Transport.seconds;
    setIsPlaying(false);
    setIsPaused(true);
    onPause?.();
  };

  const stopPlayback = () => {
    // Stop transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Stop and dispose parts
    partsRef.current.forEach(part => {
      part.stop();
      part.dispose();
    });
    partsRef.current = [];
    
    // Dispose synths
    synthsRef.current.forEach(synth => synth.dispose());
    synthsRef.current = [];
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    pausedTimeRef.current = 0;
    startTimeRef.current = 0;
    onStop?.();
  };

  const totalDuration = melody.totalBeats * (60 / melody.tempo);

  return (
    <div className="melody-player">
      <div className="melody-player-controls">
        {!isPlaying && !isPaused && (
          <button onClick={startPlayback} className="melody-player-button">
            ▶ Play
          </button>
        )}
        {isPlaying && (
          <button onClick={pausePlayback} className="melody-player-button">
            ⏸ Pause
          </button>
        )}
        {isPaused && (
          <button onClick={startPlayback} className="melody-player-button">
            ▶ Resume
          </button>
        )}
        {(isPlaying || isPaused) && (
          <button onClick={stopPlayback} className="melody-player-button">
            ⏹ Stop
          </button>
        )}
      </div>
      
      <div className="melody-player-info">
        <div className="melody-player-time">
          {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} / {Math.floor(totalDuration / 60)}:{(Math.floor(totalDuration % 60)).toString().padStart(2, '0')}
        </div>
        <div className="melody-player-progress">
          <div 
            className="melody-player-progress-bar"
            style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
