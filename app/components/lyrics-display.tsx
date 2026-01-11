'use client';

import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { MelodyStructure } from '@/lib/agent/schemas/melody';

interface LyricsDisplayProps {
  songStructure: SongStructure;
  currentBeat: number;
  totalBeats: number;
  melodyStructure?: MelodyStructure;
}

interface LineInfo {
  sectionIndex: number;
  lineIndex: number;
  text: string;
  startBeat: number;
  endBeat: number;
  sectionType: string;
}

export function LyricsDisplay({ songStructure, currentBeat, totalBeats, melodyStructure }: LyricsDisplayProps) {
  // Build a flat list of all lines with their timing
  const sections = songStructure.sections.sort((a, b) => a.order - b.order);
  const lines: LineInfo[] = [];
  
  // First pass: collect all non-empty lines to calculate total
  let totalLines = 0;
  sections.forEach((section) => {
    const sectionLines = section.content.split('\n').filter(line => line.trim() || line === '');
    totalLines += sectionLines.filter(line => line.trim()).length || 1;
  });
  
  // Calculate beats per line (distribute total beats across all lines)
  const beatsPerLine = totalLines > 0 ? totalBeats / totalLines : 4;
  const beatsPerEmptyLine = 0.5; // Minimal time for empty lines
  
  let currentBeatPosition = 0;
  
  sections.forEach((section, sectionIdx) => {
    const sectionLines = section.content.split('\n').filter(line => line.trim() || line === '');
    
    sectionLines.forEach((line, lineIdx) => {
      const isEmpty = !line.trim();
      // If no lines in song, use default
      const lineBeats = isEmpty ? beatsPerEmptyLine : (totalLines > 0 ? beatsPerLine : 4);
      
      lines.push({
        sectionIndex: sectionIdx,
        lineIndex: lineIdx,
        text: line || '\u00A0',
        startBeat: currentBeatPosition,
        endBeat: currentBeatPosition + lineBeats,
        sectionType: section.type,
      });
      
      currentBeatPosition += lineBeats;
    });
  });

  // Find which line is currently active
  const activeLineIndex = lines.findIndex(
    line => currentBeat >= line.startBeat && currentBeat < line.endBeat
  );
  const activeLine = activeLineIndex >= 0 ? lines[activeLineIndex] : null;

  // Group lines back into sections for display - preserve original section order
  const sectionsWithLines = sections
    .map((section, sectionIdx) => {
      const sectionLines = lines.filter(line => line.sectionIndex === sectionIdx);
      return {
        section,
        sectionIndex: sectionIdx, // Preserve original section index
        lines: sectionLines,
        startBeat: sectionLines[0]?.startBeat || 0,
        endBeat: sectionLines[sectionLines.length - 1]?.endBeat || 0,
      };
    })
    .filter(sectionData => sectionData.lines.length > 0); // Only show sections with lines

  return (
    <div className="lyrics-display">
      <h3 className="song-title-display">{songStructure.title}</h3>
      <div className="lyrics-sections">
        {sectionsWithLines.map((sectionData) => {
          const isInSection = currentBeat >= sectionData.startBeat && currentBeat < sectionData.endBeat;
          
          return (
            <div
              key={sectionData.sectionIndex}
              className={`lyrics-section ${isInSection ? 'lyrics-section-playing' : ''}`}
            >
              <div className="lyrics-section-header">
                <span className="lyrics-section-type">{sectionData.section.type.toUpperCase()}</span>
              </div>
              <div className="lyrics-section-content">
                {sectionData.lines.map((lineInfo) => {
                  // Check if this is the active line using the stored sectionIndex and lineIndex
                  const isActiveLine = activeLine?.sectionIndex === sectionData.sectionIndex && 
                                     activeLine?.lineIndex === lineInfo.lineIndex;
                  
                  return (
                    <div
                      key={`${sectionData.sectionIndex}-${lineInfo.lineIndex}`}
                      className={`lyrics-line ${isActiveLine ? 'lyrics-line-active' : ''}`}
                    >
                      {lineInfo.text}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
