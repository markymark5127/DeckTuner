import { staticClasses } from "@decky/ui"
import { definePlugin } from "@decky/api"
import { useContext } from "react"
import { FaCogs } from "react-icons/fa"

import { ShareDeckContext, ShareDeckProvider } from "./context"
import GamePicker from "./pages/gamePicker"
import GameReports from "./pages/reportViewer"
import SettingsPage from "./pages/settings"
import {
	getReports,
	getSDHQReview,
	getSettings,
	getToastedGames,
	sendSDHQToast,
	sendShareDeckToast,
} from "./requests"

// Bump this when debugging Decky load/deploy issues so you can confirm
// the Steam Deck is actually loading your newest frontend bundle.
const FRONTEND_BUILD_MARKER = "decktuner-frontend-marker-2025-12-18-a"

// This is a hack to remove ShareDeck-y (the old name for this plugin)
// if (window.DeckyPluginLoader?.hasPlugin("ShareDeck-y"))
// 	//@ts-ignore
// 	window.DeckyPluginLoader?.unloadPlugin("ShareDeck-y")

const ShareDecky = () => {
	// removePlugin("ShareDeck-y")

	const { selectedGame, showSettings } = useContext(ShareDeckContext)

	if (showSettings) return <SettingsPage />

	if (selectedGame === null) return <GamePicker />

	return <GameReports />
}

export default definePlugin(() => {
	console.log(`[DeckTuner] loaded frontend bundle: ${FRONTEND_BUILD_MARKER}`)
	const onGameChange = SteamClient.GameSessions.RegisterForAppLifetimeNotifications(
		// Using GameSessions.Register... because Apps.RegisterForGameActionStart
		// runs immediately upon hitting play, but toasts won't play sounds at that time.
		(appState) => {
			if (!appState.bRunning) return

			const userSettings = getSettings()
			const appId = appState.unAppID

			// Handle repeat toasts
			if (!userSettings.showAlways) {
				let toastedGames = getToastedGames()
				if (toastedGames.includes(appId)) return

				toastedGames.push(appId)
				window.localStorage.setItem(
					"sharedecky-toasted-games",
					JSON.stringify(toastedGames)
				)
			}

			// Send toasts
			if (userSettings.showShareDeckToasts) {
				getReports(appId).then((reports) => {
					if (reports.length > 0) sendShareDeckToast()
				})
			}

			if (userSettings.showSDHQToasts) {
				getSDHQReview(appId, ["none"]).then((review) => {
					if (review !== null) sendSDHQToast()
				})
			}
		}
	)

	return {
		name: "DeckTuner",
		titleView: <div className={staticClasses.Title}>DeckTuner</div>,
		content: (
			<ShareDeckProvider>
				<ShareDecky />
			</ShareDeckProvider>
		),
		icon: <FaCogs />,
		alwaysRender: true,
		onDismount() {
			onGameChange.unregister()
		},
	}
})
