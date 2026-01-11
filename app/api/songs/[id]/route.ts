import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

// GET: Retrieve a specific song by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const song = await prisma.song.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!song) {
      return NextResponse.json(
        {
          success: false,
          error: 'Song not found',
        },
        { status: 404 }
      );
    }

    // Parse JSON strings back to objects for the response
    const songWithParsedData = {
      id: song.id,
      title: song.title,
      inputLyrics: song.inputLyrics,
      inputEmotion: song.inputEmotion,
      inputGenre: song.inputGenre,
      creativeBrief: song.creativeBrief ? JSON.parse(song.creativeBrief) as CreativeBrief : null,
      songStructure: JSON.parse(song.songStructure) as SongStructure,
      evaluation: song.evaluation ? JSON.parse(song.evaluation) as LyricsEvaluation : null,
      trace: song.trace ? JSON.parse(song.trace) as unknown[] : null,
      iterationCount: song.iterationCount,
      qualityScore: song.qualityScore,
      createdAt: song.createdAt.toISOString(),
      updatedAt: song.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      song: songWithParsedData,
    });
  } catch (error) {
    console.error('Error fetching song:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch song',
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a song by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const song = await prisma.song.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting song:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete song',
      },
      { status: 500 }
    );
  }
}