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
  // Sort sections by order to ensure correct sequence
  const sections = [...songStructure.sections].sort((a, b) => a.order - b.order);
  const lines: LineInfo[] = [];
  
  // First pass: collect all non-empty lines to calculate total
  let totalNonEmptyLines = 0;
  sections.forEach((section) => {
    const sectionLines = section.content.split('\n');
    totalNonEmptyLines += sectionLines.filter(line => line.trim()).length;
  });
  
  // Calculate beats per line (distribute total beats across all non-empty lines)
  const beatsPerLine = totalNonEmptyLines > 0 ? totalBeats / totalNonEmptyLines : 4;
  const beatsPerEmptyLine = 0.5; // Minimal time for empty lines
  
  let currentBeatPosition = 0;
  let globalLineIndex = 0;
  
  // Second pass: create line entries for each section, preserving all lines (including empty ones)
  sections.forEach((section, sectionIdx) => {
    // Split by newlines - this preserves the exact line structure
    const sectionLines = section.content.split('\n');
    
    sectionLines.forEach((line, lineIdxInSection) => {
      const isEmpty = !line.trim();
      const lineBeats = isEmpty ? beatsPerEmptyLine : beatsPerLine;
      
      lines.push({
        sectionIndex: sectionIdx,
        lineIndex: lineIdxInSection, // Line index within this section
        text: line.trim() || '\u00A0', // Use non-breaking space for empty lines
        startBeat: currentBeatPosition,
        endBeat: currentBeatPosition + lineBeats,
        sectionType: section.type,
      });
      
      currentBeatPosition += lineBeats;
      if (!isEmpty) {
        globalLineIndex++;
      }
    });
  });

  // Find which line is currently active
  const activeLine = lines.find(
    line => currentBeat >= line.startBeat && currentBeat < line.endBeat
  );

  // Group lines back into sections for display - each section gets its own lines
  const sectionsWithLines = sections
    .map((section, sectionIdx) => {
      // Filter lines that belong to this specific section
      const sectionLines = lines.filter(line => line.sectionIndex === sectionIdx);
      return {
        section,
        sectionIndex: sectionIdx,
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
          const isInSection = activeLine && 
            activeLine.sectionIndex === sectionData.sectionIndex &&
            currentBeat >= sectionData.startBeat && 
            currentBeat < sectionData.endBeat;
          
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
                  // Check if this is the active line using sectionIndex and lineIndex
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
