import { Container, Stack, Title } from "@mantine/core";
import { useCallback, useState } from "preact/hooks";
import {
	AlertMessage,
	ConnectionPanel,
	FirmwarePanel,
	PreferencesPanel,
} from "./components";
import {
	useFirmwareLoader,
	useFlashOperations,
	usePreferences,
	useSerialConnection,
} from "./hooks";
import { getErrorMessage } from "./utils/helpers";

export function App() {
	const [baudRate, setBaudRate] = useState(115200);
	const [alert, setAlert] = useState("");

	const serial = useSerialConnection();
	const flash = useFlashOperations(serial, baudRate);
	const prefs = usePreferences(serial);
	const firmware = useFirmwareLoader();

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
				<Title order={2}>Flasher</Title>

				<ConnectionPanel
					serial={serial}
					baudRate={baudRate}
					setBaudRate={setBaudRate}
					isBusy={isBusy}
					onConnect={() => runAsync(() => serial.connect(baudRate), "Connection failed")}
					onDisconnect={() => runAsync(handleDisconnect, "Disconnect failed")}
					onErase={() => runAsync(() => flash.eraseFlash(), "Erase failed")}
					isErasing={flash.isErasing}
				/>

				<AlertMessage message={alert} onDismiss={() => setAlert("")} />

				{serial.isConnected && !flash.isErasing && (
					<>
						<FirmwarePanel
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
						/>
					</>
				)}
			</Stack>
		</Container>
	);
}
