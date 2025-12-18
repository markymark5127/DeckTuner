import {
	ButtonItem,
	Navigation,
	PanelSection,
	PanelSectionRow,
	Router,
} from "@decky/ui"
import { toaster } from "@decky/api"
import { useContext, useEffect, useState } from "react"

import BackButton from "../components/backButton"
import LoadingPanel from "../components/loadingPanel"
import { Scrollable, scrollableRef, ScrollArea } from "../components/Scrollable"
import { PluginSettings, Report, ShareDeckContext } from "../context"
import { getReports, getSDHQReview, getSettings } from "../requests"
import { fetchCuratedPresets } from "../presets/curated"
import {
	PresetCategory,
	Preset,
	CuratedPresetsDocV1,
} from "../presets/types"
import {
	clearPresetOverride,
	resolveEffectivePreset,
	setPresetOverride,
} from "../presets/storage"
import {
	applyPreset,
	discoverSteamOsStorage,
	recordModeStart,
	recordModeStop,
} from "../presets/apply"
import { SHAREDECK_NEW_REPORT_URL } from "../constants"
import { ReportElement } from "./reportElement"
import { SDHQHeader, SDHQReport, SDHQReportElement } from "./sdhqReport"
import { uploadPresetToService } from "../sharing/service"

const GameReports = () => {
	const { selectedGame, setSelectedGame } = useContext(ShareDeckContext)
	const [loadingSharedeck, setLoadingSharedeck] = useState(true)
	const [loadingSDHQ, setLoadingSDHQ] = useState(true)
	const [sdhqReport, setSdhqReport] = useState<SDHQReport | null>(null)
	const [reports, setReports] = useState<Report[]>([])
	const [selectedReport, setSelectedReport] = useState<Report | null>(null)
	const [selectedSDHQ, setSelectedSDHQ] = useState(false)
	const ref = scrollableRef()

	const [userSettings] = useState<PluginSettings>(() => getSettings())
	const [curated, setCurated] = useState<CuratedPresetsDocV1 | null>(null)
	const [curatedSource, setCuratedSource] = useState<
		"network" | "cache" | "none"
	>("none")
	const [presetCategory, setPresetCategory] =
		useState<PresetCategory>("battery_saver")
	const [effectivePreset, setEffectivePreset] = useState<Preset | null>(null)
	const [presetSource, setPresetSource] = useState<
		"override" | "curated" | "none"
	>("none")

	const [recordSessionId, setRecordSessionId] = useState<string | null>(
		null
	)
	const [recordResults, setRecordResults] = useState<any[] | null>(null)

	useEffect(() => {
		if (typeof selectedGame?.appId === "number") {
			getReports(selectedGame.appId).then((res) => {
				if (res !== undefined) setReports(res)
				setLoadingSharedeck(false)
			})
			getSDHQReview(selectedGame.appId, [
				"acf.optimized_and_recommended_settings.steamos_settings",
				"link",
				"acf.optimized_and_recommended_settings.proton_version",
				"acf.optimized_and_recommended_settings.game_settings",
				"acf.optimized_and_recommended_settings.projected_battery_usage_and_temperature",
				"acf.sdhq_rating,excerpt.rendered",
			]).then((res) => {
				if (res !== undefined) setSdhqReport(res as SDHQReport)
				setLoadingSDHQ(false)
			})

			fetchCuratedPresets(
				selectedGame.appId,
				userSettings.presetCdnBaseUrl
			).then(({ doc, source }) => {
				setCurated(doc)
				setCuratedSource(source)
			})
		} else {
			setLoadingSharedeck(false)
			setLoadingSDHQ(false)
		}
	}, [selectedGame])

	useEffect(() => {
		if (typeof selectedGame?.appId !== "number") return
		resolveEffectivePreset(curated, selectedGame.appId, presetCategory).then(
			({ preset, source }) => {
				setEffectivePreset(preset)
				setPresetSource(source)
			}
		)
	}, [curated, presetCategory, selectedGame])

	if (loadingSharedeck || loadingSDHQ)
		return (
			<div>
				<BackButton onClick={() => setSelectedGame(null)} />
				<LoadingPanel />
			</div>
		)

	if (selectedReport) {
		return (
			<div>
				<BackButton onClick={() => setSelectedReport(null)} />
				<Scrollable ref={ref}>
					<ScrollArea scrollable={ref}>
						<PanelSection
							title={selectedGame?.title}
						></PanelSection>
						<ReportElement report={selectedReport} />
					</ScrollArea>
				</Scrollable>
			</div>
		)
	}

	if (selectedSDHQ) {
		return (
			<div>
				<BackButton onClick={() => setSelectedSDHQ(false)} />
				<Scrollable ref={ref}>
					<ScrollArea scrollable={ref}>
						<SDHQReportElement report={sdhqReport!} />
					</ScrollArea>
					<PanelSection>
						<PanelSectionRow>
							<ButtonItem
								layout="below"
								onClick={() => openWeb(sdhqReport!.link)}
							>
								Open in SteamDeckHQ
							</ButtonItem>
						</PanelSectionRow>
					</PanelSection>
				</Scrollable>
			</div>
		)
	}

	return (
		<div>
			<BackButton onClick={() => setSelectedGame(null)} />
			<PanelSectionRow>
				<h2 style={{ marginBottom: "0px", marginTop: "-12px" }}>
					{selectedGame?.title}
				</h2>
			</PanelSectionRow>
			{typeof selectedGame?.appId === "number" ? (
				<PanelSection title="DeckTuner Presets">
					<PanelSectionRow>
						<div style={{ width: "100%" }}>
							<div style={{ opacity: 0.75, fontSize: "12px" }}>
								Curated presets source: {curatedSource}. Active
								preset source: {presetSource}.
							</div>
							<select
								style={{ width: "100%", marginTop: "8px" }}
								value={presetCategory}
								onChange={(e) =>
									setPresetCategory(
										e.target.value as PresetCategory
									)
								}
							>
								<option value="battery_saver">
									Battery Saver
								</option>
								<option value="framerate">Framerate</option>
								<option value="graphics">Graphics</option>
							</select>
						</div>
					</PanelSectionRow>
					<PanelSectionRow>
						{effectivePreset ? (
							<div style={{ width: "100%" }}>
								<div style={{ fontWeight: 600 }}>
									{effectivePreset.label}
								</div>
								{effectivePreset.notes ? (
									<div
										style={{
											opacity: 0.75,
											fontSize: "12px",
										}}
									>
										{effectivePreset.notes}
									</div>
								) : null}
								{effectivePreset.steamos ? (
									<div
										style={{
											marginTop: "8px",
											opacity: 0.9,
											fontSize: "12px",
										}}
									>
										<div>
											FPS cap:{" "}
											{effectivePreset.steamos.fpsLimit ??
												"—"}
										</div>
										<div>
											Refresh:{" "}
											{effectivePreset.steamos
												.refreshRateHz ?? "—"}
										</div>
										<div>
											TDP:{" "}
											{effectivePreset.steamos
												.tdpLimitW ?? "—"}
										</div>
									</div>
								) : null}
							</div>
						) : (
							<div style={{ opacity: 0.75 }}>
								No preset available for this game/category yet.
							</div>
						)}
					</PanelSectionRow>
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							disabled={!effectivePreset}
							onClick={async () => {
								if (!effectivePreset) return
								const r = await applyPreset(
									userSettings,
									selectedGame.appId!,
									effectivePreset,
									false
								)
									toaster.toast({
									title: "Preset applied",
									body:
										r.restart_required
											? "Restart recommended to apply all settings."
											: "Applied.",
									playSound: true,
									sound: 8,
									eType: r.failed.length > 0 ? 2 : 0,
								})
							}}
						>
							Apply Preset
						</ButtonItem>
					</PanelSectionRow>
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							disabled={!effectivePreset}
							onClick={async () => {
								if (!effectivePreset) return
								await setPresetOverride(
									selectedGame.appId!,
									presetCategory,
									effectivePreset
								)
									toaster.toast({
									title: "Saved override",
									body: "This preset is now pinned locally for this category.",
									playSound: true,
									sound: 8,
									eType: 0,
								})
								const res = await resolveEffectivePreset(
									curated,
									selectedGame.appId!,
									presetCategory
								)
								setEffectivePreset(res.preset)
								setPresetSource(res.source)
							}}
						>
							Save as Local Override
						</ButtonItem>
					</PanelSectionRow>
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							onClick={async () => {
								await clearPresetOverride(
									selectedGame.appId!,
									presetCategory
								)
								const res = await resolveEffectivePreset(
									curated,
									selectedGame.appId!,
									presetCategory
								)
								setEffectivePreset(res.preset)
								setPresetSource(res.source)
									toaster.toast({
									title: "Override cleared",
									body: "Reverted to curated preset (if available).",
									playSound: true,
									sound: 8,
									eType: 0,
								})
							}}
						>
							Reset Override
						</ButtonItem>
					</PanelSectionRow>
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							disabled={!effectivePreset}
							onClick={async () => {
								if (!effectivePreset) return
								try {
									await navigator.clipboard.writeText(
										JSON.stringify(
											{
												appid: selectedGame.appId!,
												category: presetCategory,
												preset: effectivePreset,
											},
											null,
											2
										)
									)
									toaster.toast({
										title: "Copied",
										body: "Preset JSON copied to clipboard.",
										playSound: true,
										sound: 8,
										eType: 0,
									})
								} catch (e: any) {
									toaster.toast({
										title: "Copy failed",
										body:
											e?.message ??
											"Clipboard unavailable",
										playSound: true,
										sound: 8,
										eType: 2,
									})
								}
							}}
						>
							Copy preset JSON (for sharing)
						</ButtonItem>
					</PanelSectionRow>
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							onClick={() => {
								const url =
											SHAREDECK_NEW_REPORT_URL.replace(
										"${appid}",
										selectedGame.appId!.toString()
									)
								openWeb(url)
							}}
						>
							Open ShareDeck submission page
						</ButtonItem>
					</PanelSectionRow>
					{userSettings.serviceBaseUrl ? (
						<div>
							<PanelSectionRow>
								<ButtonItem
									layout="below"
									onClick={() => {
										openWeb(
											`${userSettings.serviceBaseUrl.replace(
												/\/$/,
												""
											)}/auth/steam`
										)
									}}
								>
									Login to DeckTuner service (Steam)
								</ButtonItem>
							</PanelSectionRow>
							<PanelSectionRow>
								<ButtonItem
									layout="below"
									disabled={!effectivePreset}
									onClick={async () => {
										if (!effectivePreset) return
										try {
											await uploadPresetToService(
												userSettings.serviceBaseUrl,
												{
													appid: selectedGame.appId!,
													category: presetCategory,
													preset: effectivePreset,
													source: presetSource,
												}
											)
											toaster.toast({
												title: "Uploaded",
												body: "Sent preset to DeckTuner service.",
												playSound: true,
												sound: 8,
												eType: 0,
											})
										} catch (e: any) {
											toaster.toast({
												title: "Upload failed",
												body:
													e?.message ??
													"Service unavailable",
												playSound: true,
												sound: 8,
												eType: 2,
											})
										}
									}}
								>
									Upload preset to DeckTuner service
								</ButtonItem>
							</PanelSectionRow>
						</div>
					) : null}
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							onClick={async () => {
								try {
									const r = await discoverSteamOsStorage()
									toaster.toast({
										title: "Discovery complete",
										body: `Matches: ${r.matches?.length ?? 0}. See logs for details.`,
										playSound: true,
										sound: 8,
										eType: 0,
									})
								} catch (e: any) {
									toaster.toast({
										title: "Discovery failed",
										body:
											e?.message ??
											"Unknown error",
										playSound: true,
										sound: 8,
										eType: 2,
									})
								}
							}}
						>
							Debug: Discover SteamOS Profile Storage
						</ButtonItem>
					</PanelSectionRow>
					{userSettings.enableGraphicsWriter ? (
						<div>
							<PanelSectionRow>
								<ButtonItem
									layout="below"
									disabled={!!recordSessionId}
									onClick={async () => {
										const appid = selectedGame.appId!
										const roots = [
											`~/.local/share/Steam/steamapps/compatdata/${appid}/pfx/drive_c/users/steamuser/AppData/Local`,
											`~/.local/share/Steam/steamapps/compatdata/${appid}/pfx/drive_c/users/steamuser/AppData/Roaming`,
											`~/.local/share/Steam/steamapps/compatdata/${appid}/pfx/drive_c/users/steamuser/Documents`,
											`~/.local/share/Steam/steamapps/compatdata/${appid}/pfx/drive_c/users/steamuser/Saved Games`,
											"~/.config",
											"~/.local/share",
										]
										const r = await recordModeStart(appid, roots)
										setRecordSessionId(r.session_id)
										setRecordResults(null)
										toaster.toast({
											title: "Record mode started",
											body: "Change one in-game setting, then stop recording.",
											playSound: true,
											sound: 8,
											eType: 0,
										})
									}}
								>
									Record Mode: Start
								</ButtonItem>
							</PanelSectionRow>
							<PanelSectionRow>
								<ButtonItem
									layout="below"
									disabled={!recordSessionId}
									onClick={async () => {
										if (!recordSessionId) return
										const r = await recordModeStop(recordSessionId)
										setRecordResults(r.changed ?? [])
										setRecordSessionId(null)
										toaster.toast({
											title: "Record mode stopped",
											body: `Changed files: ${r.changed_count ?? 0}`,
											playSound: true,
											sound: 8,
											eType: 0,
										})
									}}
								>
									Record Mode: Stop & Analyze
								</ButtonItem>
							</PanelSectionRow>
							{recordResults ? (
								<PanelSectionRow>
									<div
										style={{
											width: "100%",
											opacity: 0.9,
											fontSize: "12px",
										}}
									>
										<div style={{ fontWeight: 600 }}>
											Record results (top matches)
										</div>
										{recordResults
											.slice(0, 5)
											.map((it, idx) => (
												<div
													key={`${it.path}-${idx}`}
													style={{
														marginTop: "6px",
													}}
												>
													<div
														style={{
															opacity: 0.8,
														}}
													>
														{it.change}: {it.path}
													</div>
													{it.diff?.changed?.length ? (
														<div
															style={{
																opacity: 0.75,
															}}
														>
															Changed keys:{" "}
															{it.diff.changed
																.slice(0, 5)
																.map((c: any) =>
																	c.key
																		? c.key
																		: `${c.section ?? ""}:${c.key}`
																)
																.join(", ")}
														</div>
													) : null}
												</div>
											))}
									</div>
								</PanelSectionRow>
							) : null}
							{recordResults?.length ? (
								<PanelSectionRow>
									<ButtonItem
										layout="below"
										disabled={!effectivePreset}
										onClick={async () => {
											if (!effectivePreset) return
											const appid = selectedGame.appId!
											const top = recordResults[0]
											const p: string = top.path
											const lower = p.toLowerCase()
											let adapter: any = "ini"
											if (lower.endsWith(".json"))
												adapter = "json"
											else if (lower.endsWith(".cfg"))
												adapter = "cfg"
											else if (lower.endsWith(".ini"))
												adapter = "ini"
											else adapter = "regex"

											const compatMarker = `/compatdata/${appid}/pfx/`
											let pathSpec: any = null
											if (p.includes(compatMarker)) {
												pathSpec = {
													type: "proton_prefix",
													relative: p.split(
														compatMarker
													)[1],
												}
											} else if (
												p.includes("/.config/")
											) {
												pathSpec = {
													type: "linux_config",
													relative: p.split(
														"/.config/"
													)[1],
												}
											} else if (
												p.includes(
													"/.local/share/"
												)
											) {
												pathSpec = {
													type: "linux_share",
													relative: p.split(
														"/.local/share/"
													)[1],
												}
											} else {
												pathSpec = {
													type: "absolute",
													path: p,
												}
											}

											const patches =
												top.diff?.changed?.map(
													(c: any) => ({
														section: c.section,
														key: c.key,
														value: c.after,
													})
												) ?? []

											const nextPreset: Preset = {
												...effectivePreset,
												graphics: {
													applyMode: "best_effort",
													targets: [
														{
															adapter,
															path: pathSpec,
															patches,
														},
													],
												},
												requiresRestart: true,
											}

											await setPresetOverride(
												appid,
												presetCategory,
												nextPreset
											)
											toaster.toast({
												title: "Mapping attached",
												body: "Saved as a local override with a generated graphics target.",
												playSound: true,
												sound: 8,
												eType: 0,
											})

											const res =
												await resolveEffectivePreset(
													curated,
													appid,
													presetCategory
												)
											setEffectivePreset(res.preset)
											setPresetSource(res.source)
										}}
									>
										Attach top match to this preset
									</ButtonItem>
								</PanelSectionRow>
							) : null}
						</div>
					) : null}
				</PanelSection>
			) : null}
			{sdhqReport ? (
				<PanelSection title="SteamDeckHQ">
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							onClick={() => setSelectedSDHQ(true)}
						>
							<SDHQHeader report={sdhqReport} />
						</ButtonItem>
					</PanelSectionRow>
				</PanelSection>
			) : null}
			<PanelSection title="ShareDeck Reports">
				{reports.map((report) => (
					<PanelSectionRow>
						<ButtonItem
							layout="below"
							onClick={() => setSelectedReport(report)}
						>
							{report.playtime} |{" "}
							<small>
								{report.power_draw}w | {report.fps} |{" "}
								{report.graphics_preset}
							</small>
						</ButtonItem>
					</PanelSectionRow>
				))}
				<PanelSectionRow>
					{reports.length === 0
						? "No ShareDeck Reports were found for this game. Maybe you can add one? Check out https://sharedeck.games"
						: "Using your own configuration? Share it at https://sharedeck.games"}
					{/* <ButtonItem
						onClick={() =>
							openWeb(
								SHAREDECK_NEW_REPORT_URL.replaceAll(
									"${appid}",
									selectedGame?.appId?.toString() || ""
								)
							)
						}
						layout="below"
						label={
							reports.length === 0
								? "No Reports were found for this game. Maybe you can add one?"
								: "Using your own configuration? Share it here!"
						}
					>
						Submit Report
					</ButtonItem> */}
				</PanelSectionRow>
			</PanelSection>
		</div>
	)

	return <div></div>
}

export default GameReports

function openWeb(url: string) {
	Navigation.NavigateToExternalWeb(url)
	Router.CloseSideMenus()
}
