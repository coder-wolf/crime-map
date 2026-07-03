import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const col = await getCollection('incidents');
    const docs = await col.find({}).project({ _id: 0, id: 1, lat: 1, lng: 1, crimeType: 1, age: 1 }).toArray();
    return NextResponse.json(docs);
  } catch (e) {
    console.error('GET /api/incidents error:', e);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, lat, lng, crimeType, age } = body;
    if (!id || lat == null || lng == null || !crimeType || !age) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const col = await getCollection('incidents');
    await col.insertOne({ _id: new ObjectId(), id, lat, lng, crimeType, age, createdAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/incidents error:', e);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const col = await getCollection('incidents');
    await col.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/incidents error:', e);
    return NextResponse.json({ error: 'Failed to clear incidents' }, { status: 500 });
  }
}
