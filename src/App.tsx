import { Container, Group, Stack, Title } from "@mantine/core";
import { useCallback, useState } from "preact/hooks";
import {
	AlertMessage,
	ConnectionPanel,
	FirmwarePanel,
	LanguageSelector,
	PreferencesPanel,
} from "./components";
import {
	useFirmwareLoader,
	useFlashOperations,
	usePreferences,
	useSerialConnection,
	useTranslation,
} from "./hooks";
import { getErrorMessage } from "./utils/helpers";

export function App() {
	const [baudRate, setBaudRate] = useState(115200);
	const [alert, setAlert] = useState("");

	const serial = useSerialConnection();
	const flash = useFlashOperations(serial, baudRate);
	const prefs = usePreferences(serial);
	const firmware = useFirmwareLoader();
	const { language, setLanguage, t } = useTranslation();

	const runAsync = useCallback(
		async (fn: () => Promise<unknown>, errorContext: string, successMsg?: string) => {
			setAlert("");
			try {
				const result = await fn();
				if (successMsg) {
					setAlert(typeof result === "string" ? result : successMsg);
				}
			} catch (e) {
				console.error(e);
				const message = getErrorMessage(e);
				setAlert(
					message.includes("JSON") ? "Invalid JSON format" : `${errorContext}: ${message}`,
				);
			}
		},
		[],
	);

	const handleDisconnect = useCallback(async () => {
		await serial.disconnect();
		prefs.setPreferences("");
	}, [serial, prefs]);

	const handleProgram = useCallback(() => {
		if (!firmware.firmwareData) {
			setAlert("No firmware loaded. Select a version first.");
			return;
		}
		runAsync(
			() => flash.programFlash(firmware.firmwareData!, firmware.flashAddress),
			"Programming failed",
			"Programming completed successfully!",
		);
	}, [firmware.firmwareData, firmware.flashAddress, flash, runAsync]);

	const isBusy = flash.isErasing || flash.isProgramming;

	return (
		<Container size="md" py="xl">
			<Stack gap="md">
				<Group justify="space-between" align="center">
					<Title order={2}>{t("title")}</Title>
					<LanguageSelector language={language} onChange={setLanguage} />
				</Group>

				<ConnectionPanel
					t={t}
					serial={serial}
					baudRate={baudRate}
					setBaudRate={setBaudRate}
					isBusy={isBusy}
					onConnect={() =>
						runAsync(async () => {
							await serial.connect(baudRate);
							try {
								await prefs.initializeSettings();
							} catch {
								// Settings initialization is non-critical
							}
						}, "Connection failed")
					}
					onDisconnect={() => runAsync(handleDisconnect, "Disconnect failed")}
					onErase={() => runAsync(() => flash.eraseFlash(), "Erase failed")}
					isErasing={flash.isErasing}
				/>

				<AlertMessage message={alert} onDismiss={() => setAlert("")} />

				{serial.isConnected && !flash.isErasing && (
					<>
						<FirmwarePanel
							t={t}
							selectedLabel={firmware.selectedLabel}
							firmwareData={firmware.firmwareData}
							isLoading={firmware.isLoading}
							flashType={firmware.flashType}
							isProgramming={flash.isProgramming}
							progress={flash.progress}
							isBusy={isBusy}
							onSelectFirmware={(label) =>
								runAsync(() => firmware.selectFirmware(label), "Failed to load firmware")
							}
							onChangeFlashType={(type) =>
								runAsync(() => firmware.changeFlashType(type), "Failed to load firmware")
							}
							onProgram={handleProgram}
						/>

						<PreferencesPanel
							t={t}
							preferences={prefs.preferences}
							setPreferences={prefs.setPreferences}
							isLoading={prefs.isLoading}
							isUpdating={prefs.isUpdating}
							onGetSettings={() =>
								runAsync(() => prefs.getAllSettings(), "Error getting settings")
							}
							onGetSettingsKeys={() =>
								runAsync(() => prefs.getAllSettingsKeys(), "Error getting settings keys")
							}
							onUpdateSettings={() =>
								runAsync(
									() => prefs.updateAllSettings(),
									"Error updating settings",
									"Settings updated",
								)
							}
							onPing={() => runAsync(() => prefs.ping(), "PING failed")}
							settingsKeys={prefs.settingsKeys}
							settingsValues={prefs.settingsValues}
							onUpdateSettingValue={prefs.updateSettingValue}
							onSaveSettingsValues={() =>
								runAsync(() => prefs.saveSettingsValues(), "Error saving settings", "Settings saved")
							}
						/>
					</>
				)}
			</Stack>
		</Container>
	);
}
