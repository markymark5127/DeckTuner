import {
	ButtonItem,
	PanelSection,
	PanelSectionRow,
	ToggleField,
} from "@decky/ui"
import React, { useContext, useState } from "react"

import BackButton from "../components/backButton"
import { PluginSettings, ShareDeckContext } from "../context"
import { getSettings, sendSDHQToast, sendShareDeckToast } from "../requests"

const SettingsPage = () => {
	const [currentSettings, setCurrentSettings] = useState(() => getSettings())
	const { setShowSettings } = useContext(ShareDeckContext)

	const updateSetting = (label: keyof PluginSettings, value: any) => {
		const next = { ...currentSettings, [label]: value } as PluginSettings
		window.localStorage.setItem("sharedecky-settings", JSON.stringify(next))
		setCurrentSettings(next)
	}

	const sendToasts = () => {
		if (currentSettings.showShareDeckToasts) sendShareDeckToast()
		if (currentSettings.showSDHQToasts) sendSDHQToast()
	}

	return (
		<React.Fragment>
			<BackButton onClick={() => setShowSettings(false)} />

			<PanelSection title="Settings">
				<PanelSectionRow>
					<div style={{ width: "100%" }}>
						<div style={{ fontWeight: 600 }}>
							Preset CDN Base URL
						</div>
						<div style={{ opacity: 0.75, fontSize: "12px" }}>
							Where curated Battery/Framerate/Graphics presets are
							fetched from (v1 static JSON).
						</div>
						<input
							style={{ width: "100%", marginTop: "6px" }}
							type="text"
							value={currentSettings.presetCdnBaseUrl}
							onChange={(e) =>
								updateSetting(
									"presetCdnBaseUrl",
									e.target.value
								)
							}
						/>
					</div>
				</PanelSectionRow>
				<PanelSectionRow>
					<div style={{ width: "100%" }}>
						<div style={{ fontWeight: 600 }}>
							DeckTuner Service Base URL (v2)
						</div>
						<div style={{ opacity: 0.75, fontSize: "12px" }}>
							Optional. If set, the plugin can open Steam OpenID
							login to your service and upload presets for
							community curation.
						</div>
						<input
							style={{ width: "100%", marginTop: "6px" }}
							type="text"
							value={currentSettings.serviceBaseUrl}
							onChange={(e) =>
								updateSetting(
									"serviceBaseUrl",
									e.target.value
								)
							}
						/>
					</div>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={currentSettings.enableSteamOsApply}
						label="Enable SteamOS Apply (Performance)"
						description="When enabled, the plugin will attempt to apply per-game SteamOS performance settings when you apply a preset."
						onChange={(n) => updateSetting("enableSteamOsApply", n)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={currentSettings.enableGraphicsWriter}
						label="Enable Graphics Writer (Experimental)"
						description="When enabled, presets may attempt best-effort in-game config edits (requires restart)."
						onChange={(n) =>
							updateSetting("enableGraphicsWriter", n)
						}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={currentSettings.showAllApps}
						label="Show Entire Library in Games List"
						description="If enabled, all Steam games in your library will be shown in the Games List. If disabled, only installed games will be shown."
						onChange={(n) => updateSetting("showAllApps", n)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={currentSettings.showShareDeckToasts}
						label="Show ShareDeck Notifications"
						description="Send a notification when opening a game if ShareDeck reports are available."
						onChange={(n) =>
							updateSetting("showShareDeckToasts", n)
						}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={currentSettings.showSDHQToasts}
						label="Show SteamDeckHQ Notifications"
						description="Send a notification when opening a game if SteamDeckHQ has performance-reviewed the game."
						onChange={(n) => updateSetting("showSDHQToasts", n)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						checked={!currentSettings.showAlways}
						label="Only Show on First Open"
						description="If enabled, you will only receive notifications the first time you open a game."
						onChange={(n) => updateSetting("showAlways", !n)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ButtonItem layout="below" onClick={() => sendToasts()}>
						Test Notifications
					</ButtonItem>
				</PanelSectionRow>
			</PanelSection>
		</React.Fragment>
	)
}

export default SettingsPage
