import { ServerAPI } from "decky-frontend-lib"

export async function uploadPresetToService(
	serverApi: ServerAPI,
	serviceBaseUrl: string,
	payload: any
): Promise<void> {
	const base = serviceBaseUrl.replace(/\/$/, "")
	const url = `${base}/api/presets`

	// Use Decky's fetchNoCors (same pattern as ShareDeck fetch) to avoid CORS headaches.
	const res = await serverApi.fetchNoCors<{ body: string }>(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!res.success) {
		throw new Error("upload_failed")
	}
}


