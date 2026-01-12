import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

// GET: Retrieve a specific song by ID (only if owned by user)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id || null;

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

    // Check ownership - return 404 if not owned by user (prevent enumeration)
    if (song.userId !== userId) {
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
      language: song.language,
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

// DELETE: Delete a song by ID (only if owned by user)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id || null;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Check ownership first
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

    if (song.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
        },
        { status: 403 }
      );
    }

    // Delete the song
    await prisma.song.delete({
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