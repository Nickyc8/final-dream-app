export async function GET() {
  try {
    const response = await fetch("http://127.0.0.1:8000/plot-data-3d", {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error || "Backend request failed." },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Something went wrong while loading the dream universe." },
      { status: 500 }
    );
  }
}
