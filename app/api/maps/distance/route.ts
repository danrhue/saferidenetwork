import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { origin, destination } = await request.json();

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is missing' }, { status: 500 });
  }

  try {
    // Improve geocoding with region bias for US and better handling
    const geocodeParams = `&key=${apiKey}&region=US&components=country:US`;

    // Step 1: Geocode origin (more flexible)
    const geoOriginUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(origin)}${geocodeParams}`;
    const geoOriginRes = await fetch(geoOriginUrl);
    const geoOriginData = await geoOriginRes.json();

    if (geoOriginData.status !== 'OK' || !geoOriginData.results?.length) {
      return NextResponse.json({ error: `Could not find pickup location "${origin}". Try adding city and state (e.g., "123 Main St, Chicago, IL").` }, { status: 400 });
    }

    const originLocation = geoOriginData.results[0].geometry.location;
    const originLatLng = `${originLocation.lat},${originLocation.lng}`;

    // Step 2: Geocode destination
    const geoDestUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}${geocodeParams}`;
    const geoDestRes = await fetch(geoDestUrl);
    const geoDestData = await geoDestRes.json();

    if (geoDestData.status !== 'OK' || !geoDestData.results?.length) {
      return NextResponse.json({ error: `Could not find dropoff location "${destination}". Try adding city and state (e.g., "456 Oak Ave, Austin, TX").` }, { status: 400 });
    }

    const destLocation = geoDestData.results[0].geometry.location;
    const destLatLng = `${destLocation.lat},${destLocation.lng}`;

    // Step 3: Use Distance Matrix with precise lat/lng for better accuracy
    const distUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originLatLng)}&destinations=${encodeURIComponent(destLatLng)}&units=imperial&key=${apiKey}`;
    const distRes = await fetch(distUrl);
    const distData = await distRes.json();

    if (distData.status !== 'OK' || !distData.rows?.[0]?.elements?.[0]) {
      return NextResponse.json({ error: 'Could not calculate distance between the locations. Please verify the addresses.' }, { status: 400 });
    }

    const element = distData.rows[0].elements[0];
    if (element.status !== 'OK') {
      let errorMsg = 'Could not calculate route between locations.';
      if (element.status === 'ZERO_RESULTS') errorMsg = 'No driving route found between these locations.';
      else if (element.status === 'NOT_FOUND') errorMsg = 'One of the locations could not be resolved.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const distanceMiles = element.distance.value / 1609.34; // meters to miles
    const durationMinutes = Math.round(element.duration.value / 60);

    return NextResponse.json({
      distanceMiles: parseFloat(distanceMiles.toFixed(1)),
      durationMinutes,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to calculate distance using Google Maps. Please try again or enter addresses with city and state.' }, { status: 500 });
  }
}
