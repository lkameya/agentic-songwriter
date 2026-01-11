import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { SongStructure } from '@/lib/agent/schemas/song-structure';
import { CreativeBrief } from '@/lib/agent/schemas/creative-brief';
import { LyricsEvaluation } from '@/lib/agent/schemas/evaluation';

// GET: Retrieve all songs (with optional pagination)
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    const songs = await prisma.song.findMany({
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: order,
      },
    });

    const total = await prisma.song.count();

    // Parse JSON strings back to objects for the response
    const songsWithParsedData = songs.map((song) => ({
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
    }));

    return NextResponse.json({
      success: true,
      songs: songsWithParsedData,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching songs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch songs',
      },
      { status: 500 }
    );
  }
}

// POST: Save a new song
const SaveSongSchema = z.object({
  title: z.string().optional(),
  inputLyrics: z.string().min(1),
  inputEmotion: z.string().min(1),
  inputGenre: z.string().optional(),
  creativeBrief: z.any().optional(), // CreativeBrief or null
  songStructure: z.any(), // SongStructure
  evaluation: z.any().optional(), // LyricsEvaluation or null
  trace: z.array(z.any()).optional(),
  iterationCount: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = SaveSongSchema.parse(body);

    // Extract title from songStructure if not provided
    const title = validatedData.title || (validatedData.songStructure as SongStructure)?.title || null;

    // Extract quality score from evaluation if available
    const qualityScore = validatedData.evaluation?.quality || null;

    // Create song in database
    const song = await prisma.song.create({
      data: {
        title,
        inputLyrics: validatedData.inputLyrics,
        inputEmotion: validatedData.inputEmotion,
        inputGenre: validatedData.inputGenre || null,
        creativeBrief: validatedData.creativeBrief ? JSON.stringify(validatedData.creativeBrief) : null,
        songStructure: JSON.stringify(validatedData.songStructure),
        evaluation: validatedData.evaluation ? JSON.stringify(validatedData.evaluation) : null,
        trace: validatedData.trace ? JSON.stringify(validatedData.trace) : null,
        iterationCount: validatedData.iterationCount,
        qualityScore,
      },
    });

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
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving song:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save song',
      },
      { status: 500 }
    );
  }
}