import { ServerAPI } from "decky-frontend-lib"

export async function callBackend<T>(
	serverApi: ServerAPI,
	method: string,
	args: Record<string, any> = {}
): Promise<T> {
	// Decky callPluginMethod types are a bit loose; cast to keep TS strict-mode happy.
	const res = await serverApi.callPluginMethod(method, args as any)
	if (!res.success) {
		throw new Error(res.result ? JSON.stringify(res.result) : "backend_call_failed")
	}
	return res.result as T
}


