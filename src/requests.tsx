import { Navigation, QuickAccessTab, staticClasses } from "@decky/ui"
import { fetchNoCors, toaster } from "@decky/api"

import sdhqlogo from "../assets/sdhqlogo.jpg"
import sharedecklogo from "../assets/sharedecklogo.png"
import { SDHQ_REPORT_ENDPOINT, SHAREDECK_REPORT_ENDPOINT } from "./constants"
import { PluginSettings, Report, ReportInterface } from "./context"
import { SDHQReport } from "./pages/sdhqReport"

export const getReports = async (
	appId: number | string
) => {
	const url = SHAREDECK_REPORT_ENDPOINT.replace("${appid}", `${appId}`)
	const res = await fetchNoCors(url, { method: "GET" })
	if (!res.ok) return []

	const text = await res.text()
	const reports = JSON.parse(text) as ReportInterface[]
	return reports.map((reportData) => new Report(reportData))
}

export const getSDHQReview = async (
	appId: number | string,
	fields: string[]
) => {
	const url = SDHQ_REPORT_ENDPOINT.replace("${appid}", `${appId}`)
	const fieldsParam = `&_fields=${fields.join()}`

	const res = await fetchNoCors(`${url}${fieldsParam}`, {
		headers: { "User-Agent": "PostmanRuntime/7.30.0" },
		method: "GET",
	})
	if (!res.ok) return null

	const text = await res.text()
	const reports = JSON.parse(text) as Partial<SDHQReport>[]
	return reports.length > 0 ? reports[0] : null
}

const getLocalStorageItem = <T,>(key: string, def: T): T => {
	const rawData = window.localStorage.getItem(key)
	if (rawData) return JSON.parse(rawData)

	return def
}

export const getToastedGames = (): number[] => {
	return getLocalStorageItem("sharedecky-toasted-games", [] as number[])
}

export const getSettings = (): PluginSettings => {
	return getLocalStorageItem("sharedecky-settings", {
		showShareDeckToasts: true,
		showSDHQToasts: true,
		showAlways: false,
		showAllApps: false,
		presetCdnBaseUrl:
			"https://example.invalid/decktuner-presets/v1", // user configurable
		serviceBaseUrl: "",
		enableGraphicsWriter: false,
		enableSteamOsApply: true,
	})
}

const sendToast = (title: string, img: string) => {
	toaster.toast({
		title: title,
		body: "Open DeckTuner Plugin for details...",
		className: staticClasses.FullHeight,
		playSound: true,
		sound: 8,
		eType: 1,
		onClick: () => {
			console.log("tapped")
			Navigation.OpenQuickAccessMenu(QuickAccessTab.Decky)
		},
		// duration: 1000000,  // For debugging/styling
		logo: <img height="40px" src={img} />,
	})
}

export const sendShareDeckToast = () => {
	sendToast("ShareDeck Reports Available", sharedecklogo)
}

export const sendSDHQToast = () => {
	sendToast("SteamDeckHQ Review Available", sdhqlogo)
}
