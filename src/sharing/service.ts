import { fetchNoCors } from "@decky/api"

export async function uploadPresetToService(
	serviceBaseUrl: string,
	payload: any
): Promise<void> {
	const base = serviceBaseUrl.replace(/\/$/, "")
	const url = `${base}/api/presets`

	// Use Decky's fetchNoCors (same pattern as ShareDeck fetch) to avoid CORS headaches.
	const res = await fetchNoCors(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!res.ok) {
		throw new Error("upload_failed")
	}
}


