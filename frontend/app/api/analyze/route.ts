export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dreamText = body.dreamText;

    if (!dreamText || !dreamText.trim()) {
      return Response.json(
        { error: "Dream text is required." },
        { status: 400 }
      );
    }

    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dreamText }),
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
      { error: "Something went wrong while analyzing the dream." },
      { status: 500 }
    );
  }
}