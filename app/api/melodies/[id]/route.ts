import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const melody = await prisma.melody.findUnique({
      where: { id },
      include: {
        song: true,
      },
    });

    if (!melody) {
      return NextResponse.json({ success: false, error: 'Melody not found' }, { status: 404 });
    }

    // Parse JSON strings back to objects
    const parsedMelody = {
      ...melody,
      midiStructure: JSON.parse(melody.midiStructure),
      song: {
        ...melody.song,
        creativeBrief: melody.song.creativeBrief ? JSON.parse(melody.song.creativeBrief) : null,
        songStructure: JSON.parse(melody.song.songStructure),
        evaluation: melody.song.evaluation ? JSON.parse(melody.song.evaluation) : null,
        trace: melody.song.trace ? JSON.parse(melody.song.trace) : [],
      },
    };

    return NextResponse.json({ success: true, melody: parsedMelody });
  } catch (error) {
    console.error(`Error fetching melody ${params.id}:`, error);
    return NextResponse.json({ success: false, error: 'Failed to fetch melody' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.melody.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, message: 'Melody deleted successfully' });
  } catch (error) {
    console.error(`Error deleting melody ${params.id}:`, error);
    return NextResponse.json({ success: false, error: 'Failed to delete melody' }, { status: 500 });
  }
}
