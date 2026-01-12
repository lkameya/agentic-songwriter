import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Force dynamic rendering since we use search params
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const songId = searchParams.get('songId');

    const where = songId ? { songId } : {};

    const melodies = await prisma.melody.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy]: order,
      },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            inputEmotion: true,
            inputGenre: true,
          },
        },
      },
    });

    const totalMelodies = await prisma.melody.count({ where });

    return NextResponse.json({ success: true, melodies, total: totalMelodies });
  } catch (error) {
    console.error('Error fetching melodies:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch melodies' }, { status: 500 });
  }
}
