import CryptoJS from "crypto-js";
import {
	ESPLoader,
	type FlashOptions,
	type LoaderOptions,
	Transport,
} from "esptool-js";
import { useEffect, useRef, useState } from "preact/hooks";
import { serial } from "web-serial-polyfill";
import releasesData from "./firmwares/releases.json";

type ReleasesData = Record<string, string[]>;
type FlashType = "fw" | "full";

const releases = Object.entries(releasesData as ReleasesData).flatMap(
	([target, versions]) =>
		versions
			.slice(0, 5)
			.map((version) => ({ target, version, label: `${target}-${version}` })),
);

const serialLib =
	!navigator.serial && (navigator as { usb?: unknown }).usb
		? serial
		: navigator.serial;

const terminal = {
	clean() {},
	writeLine: console.log,
	write: console.log,
};

const COMMAND_TIMEOUT_MS = 2000;
const POST_FLASH_DELAY_MS = 1000;
const POST_PROGRAM_DELAY_MS = 2000;

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunks: string[] = [];
	const chunkSize = 8192;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
	}
	return chunks.join("");
}

function useSerialConnection(baudrate: string) {
	const [isConnected, setIsConnected] = useState(false);
	const [chip, setChip] = useState<string | null>(null);

	const transportRef = useRef<Transport | null>(null);
	const espLoaderRef = useRef<ESPLoader | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const portRef = useRef<any>(null);
	const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
	const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
		null,
	);
	const baudrateRef = useRef(baudrate);
	baudrateRef.current = baudrate;

	const closeNativeSerial = async () => {
		try {
			await readerRef.current?.cancel();
		} catch {}
		try {
			readerRef.current?.releaseLock();
		} catch {}
		readerRef.current = null;

		try {
			await writerRef.current?.close();
		} catch {}
		writerRef.current = null;

		try {
			await portRef.current?.close();
		} catch {}
	};

	const setupNativeSerial = async () => {
		if (!portRef.current) {
			portRef.current = (await serialLib?.requestPort({})) ?? null;
		}
		if (!portRef.current) {
			throw new Error("No serial port available");
		}
		await portRef.current.open({ baudRate: Number(baudrateRef.current) });
		writerRef.current = portRef.current.writable!.getWriter();
		readerRef.current = portRef.current.readable!.getReader();
		setChip("Native Connection");
	};

	const cleanupESPTool = async () => {
		try {
			await transportRef.current?.disconnect();
		} catch {}
		transportRef.current = null;
		espLoaderRef.current = null;
	};

	const setupESPTool = async (): Promise<string> => {
		if (!portRef.current) throw new Error("No device available");

		transportRef.current = new Transport(portRef.current, true);
		espLoaderRef.current = new ESPLoader({
			transport: transportRef.current,
			baudrate: Number(baudrateRef.current),
			terminal,
			debugLogging: false,
			romBaudrate: Number(baudrateRef.current),
		} as LoaderOptions);

		const detectedChip = await espLoaderRef.current.main();
		setChip(detectedChip);
		return detectedChip;
	};

	const connect = async () => {
		await setupNativeSerial();
		setIsConnected(true);
	};

	const disconnect = async () => {
		await closeNativeSerial();
		await cleanupESPTool();
		portRef.current = null;
		setIsConnected(false);
		setChip(null);
	};

	const sendCommand = async (command: string): Promise<string> => {
		if (!writerRef.current || !readerRef.current) {
			throw new Error("Native serial not connected");
		}

		await writerRef.current.write(new TextEncoder().encode(`${command}\n`));

		let response = "";
		const decoder = new TextDecoder();
		const deadline = Date.now() + COMMAND_TIMEOUT_MS;

		while (Date.now() < deadline) {
			const result = await Promise.race([
				readerRef.current.read(),
				new Promise<null>((resolve) =>
					setTimeout(() => resolve(null), deadline - Date.now()),
				),
			]);

			if (result === null) break;
			if (result.done) break;
			if (result.value?.length) {
				response += decoder.decode(result.value, { stream: true });
				if (response.includes("END") || response.includes("ERROR")) break;
			}
		}

		return response.trim();
	};

	useEffect(() => {
		return () => {
			readerRef.current?.cancel().catch(() => {});
			readerRef.current?.releaseLock();
			writerRef.current?.close().catch(() => {});
			portRef.current?.close().catch(() => {});
			transportRef.current?.disconnect().catch(() => {});
		};
	}, []);

	return {
		isConnected,
		chip,
		connect,
		disconnect,
		sendCommand,
		setupESPTool,
		cleanupESPTool,
		setupNativeSerial,
		closeNativeSerial,
		espLoaderRef,
	};
}

function useFlashOperations(serial: ReturnType<typeof useSerialConnection>) {
	const [isErasing, setIsErasing] = useState(false);
	const [isProgramming, setIsProgramming] = useState(false);
	const [progress, setProgress] = useState(0);

	const withESPTool = async <T,>(
		fn: (loader: ESPLoader) => Promise<T>,
		delay = POST_FLASH_DELAY_MS,
	): Promise<T> => {
		await serial.closeNativeSerial();
		await serial.setupESPTool();
		const loader = serial.espLoaderRef.current;
		if (!loader) throw new Error("ESP loader not initialized");
		try {
			return await fn(loader);
		} finally {
			await serial.cleanupESPTool();
			await new Promise((r) => setTimeout(r, delay));
			await serial.setupNativeSerial();
		}
	};

	const eraseFlash = async () => {
		setIsErasing(true);
		try {
			await withESPTool((loader) => loader.eraseFlash());
		} finally {
			setIsErasing(false);
		}
	};

	const programFlash = async (fileData: string, address: number) => {
		setIsProgramming(true);
		setProgress(0);
		try {
			await withESPTool(async (loader) => {
				await loader.writeFlash({
					fileArray: [{ data: fileData, address }],
					flashSize: "keep",
					flashMode: "keep",
					flashFreq: "keep",
					eraseAll: false,
					compress: true,
					reportProgress: (_, written, total) => {
						setProgress((written / total) * 100);
					},
					calculateMD5Hash: (image) =>
						CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)).toString(),
				} as FlashOptions);
				await loader.after("hard_reset");
			}, POST_PROGRAM_DELAY_MS);
		} finally {
			setIsProgramming(false);
			setProgress(0);
		}
	};

	return { isErasing, isProgramming, progress, eraseFlash, programFlash };
}

function usePreferences(serial: ReturnType<typeof useSerialConnection>) {
	const [preferences, setPreferences] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const getAllSettings = async () => {
		setIsLoading(true);
		try {
			const response = await serial.sendCommand("GET_PREFS");
			if (!response) throw new Error("No response received from device");
			try {
				setPreferences(JSON.stringify(JSON.parse(response), null, 2));
			} catch {
				setPreferences(response);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const getAllSettingsKeys = async () => {
		setIsLoading(true);
		try {
			const response = await serial.sendCommand("GET_PREF_KEYS");
			if (!response) throw new Error("No response received from device");
			try {
				setPreferences(JSON.stringify(JSON.parse(response), null, 2));
			} catch {
				setPreferences(response);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const updateAllSettings = async () => {
		const trimmed = preferences.trim();
		if (!trimmed) throw new Error("No preferences data!");

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new Error("Invalid JSON format");
		}

		setIsUpdating(true);
		try {
			const response = await serial.sendCommand(
				`SET_PREFS:${JSON.stringify(parsed)}`,
			);
			if (response.includes("ERROR")) throw new Error(`Update failed: ${response}`);
			return `Response: ${response}`;
		} finally {
			setIsUpdating(false);
		}
	};

	return {
		preferences,
		setPreferences,
		isLoading,
		isUpdating,
		getAllSettings,
		getAllSettingsKeys,
		updateAllSettings,
	};
}

function useFirmwareLoader() {
	const [selectedLabel, setSelectedLabel] = useState("");
	const [firmwareData, setFirmwareData] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [flashType, setFlashType] = useState<FlashType>("fw");

	const loadFirmware = async (label: string, type: FlashType) => {
		setFirmwareData(null);
		if (!label) return;

		const release = releases.find((r) => r.label === label);
		if (!release) return;

		const fileName = type === "fw" ? "image.bin" : "image-merged.bin";
		setIsLoading(true);
		try {
			const response = await fetch(
				`./firmwares/${release.target}/${release.version}/${fileName}`,
			);
			if (!response.ok) {
				throw new Error(
					`Failed to load firmware: ${response.status} ${response.statusText}`,
				);
			}
			const binary = arrayBufferToBinaryString(await response.arrayBuffer());
			setFirmwareData(binary);
		} finally {
			setIsLoading(false);
		}
	};

	const selectFirmware = async (label: string) => {
		setSelectedLabel(label);
		await loadFirmware(label, flashType);
	};

	const changeFlashType = async (type: FlashType) => {
		if (type === flashType) return;
		setFlashType(type);
		if (selectedLabel) {
			await loadFirmware(selectedLabel, type);
		}
	};

	const flashAddress = flashType === "fw" ? 0x10000 : 0x0;

	return {
		selectedLabel,
		firmwareData,
		isLoading,
		selectFirmware,
		flashType,
		changeFlashType,
		flashAddress,
	};
}

function getErrorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	return String(e);
}

export function App() {
	const [baudrate, setBaudrate] = useState("115200");
	const [alert, setAlert] = useState("");

	const serial = useSerialConnection(baudrate);
	const flash = useFlashOperations(serial);
	const prefs = usePreferences(serial);
	const firmware = useFirmwareLoader();

	const handleError = (e: unknown, context: string) => {
		console.error(e);
		const message = getErrorMessage(e);
		setAlert(
			message.includes("JSON") ? "Invalid JSON format" : `${context}: ${message}`,
		);
	};

	const runAsync = async (
		fn: () => Promise<unknown>,
		errorContext: string,
		successMsg?: string,
	) => {
		setAlert("");
		try {
			const result = await fn();
			if (successMsg) setAlert(typeof result === "string" ? result : successMsg);
		} catch (e) {
			handleError(e, errorContext);
		}
	};

	const isBusy = flash.isErasing || flash.isProgramming;
	const prefsBusy = prefs.isLoading || prefs.isUpdating;

	return (
		<div>
			<h3>Flasher</h3>

			{!serial.isConnected ? (
				<div>
					<label>Baudrate: </label>
					<select
						value={baudrate}
						onChange={(e) => setBaudrate((e.target as HTMLSelectElement).value)}
					>
						<option value="921600">921600</option>
						<option value="460800">460800</option>
						<option value="230400">230400</option>
						<option value="115200">115200</option>
					</select>
					<button onClick={() => runAsync(() => serial.connect(), "Connection failed")}>
						Connect
					</button>
				</div>
			) : (
				<div>
					<p>Connected to: {serial.chip}</p>
					<button
						onClick={() =>
							runAsync(async () => {
								await serial.disconnect();
								prefs.setPreferences("");
							}, "Disconnect failed")
						}
						disabled={isBusy}
					>
						Disconnect
					</button>
					<button
						onClick={() => runAsync(() => flash.eraseFlash(), "Erase failed")}
						disabled={isBusy}
					>
						{flash.isErasing ? "Erasing..." : "Erase Flash"}
					</button>
				</div>
			)}

			{alert && (
				<div>
					{alert}
					<button onClick={() => setAlert("")}>×</button>
				</div>
			)}

			{serial.isConnected && !flash.isErasing && (
				<div>
					<div>
						<label>Firmware Version: </label>
						<select
							value={firmware.selectedLabel}
							onChange={(e) =>
								runAsync(
									() =>
										firmware.selectFirmware(
											(e.target as HTMLSelectElement).value,
										),
									"Failed to load firmware",
								)
							}
							disabled={firmware.isLoading}
						>
							<option value="">Select firmware version...</option>
							{releases.map((r) => (
								<option key={r.label} value={r.label}>
									{r.label}
								</option>
							))}
						</select>{" "}
						<label>
							<input
								type="radio"
								name="flashType"
								value="fw"
								checked={firmware.flashType === "fw"}
								onChange={() =>
									runAsync(
										() => firmware.changeFlashType("fw"),
										"Failed to load firmware",
									)
								}
								disabled={firmware.isLoading}
							/>
							Only FW
						</label>
						<label>
							<input
								type="radio"
								name="flashType"
								value="full"
								checked={firmware.flashType === "full"}
								onChange={() =>
									runAsync(
										() => firmware.changeFlashType("full"),
										"Failed to load firmware",
									)
								}
								disabled={firmware.isLoading}
							/>
							Full
						</label>
						{firmware.isLoading && <span> Loading firmware...</span>}
						{firmware.firmwareData && <span> ✓ Firmware loaded</span>}
					</div>

					{flash.isProgramming && (
						<div>
							<progress value={flash.progress} max="100" />
							<div>{Math.round(flash.progress)}%</div>
						</div>
					)}

					<button
						onClick={() => {
							if (!firmware.firmwareData) {
								setAlert("No firmware loaded! Please select a version first.");
								return;
							}
							runAsync(
								() =>
									flash.programFlash(firmware.firmwareData!, firmware.flashAddress),
								"Programming failed",
								"Programming completed successfully!",
							);
						}}
						disabled={flash.isProgramming || !firmware.firmwareData || firmware.isLoading}
					>
						{flash.isProgramming ? "Programming..." : "Program"}
					</button>

					<hr />

					<h4>Device Preferences</h4>

					<div>
						<button
							onClick={() =>
								runAsync(() => prefs.getAllSettings(), "Error getting settings")
							}
							disabled={prefsBusy}
						>
							{prefs.isLoading ? "Loading..." : "Get Settings"}
						</button>

						<button
							onClick={() =>
								runAsync(
									() => prefs.updateAllSettings(),
									"Error updating settings",
									"Settings updated",
								)
							}
							disabled={prefsBusy || !prefs.preferences.trim()}
						>
							{prefs.isUpdating ? "Updating..." : "Update Settings"}
						</button>

						<button
							onClick={() =>
								runAsync(() => prefs.getAllSettingsKeys(), "Error getting settings keys")
							}
							disabled={prefsBusy}
						>
							{prefs.isLoading ? "Loading..." : "Get Settings Keys"}
						</button>

						<button
							onClick={() =>
								runAsync(
									async () => prefs.setPreferences(await serial.sendCommand("PING")),
									"PING failed",
								)
							}
							disabled={prefsBusy}
						>
							PING
						</button>
					</div>

					<textarea
						value={prefs.preferences}
						onChange={(e) =>
							prefs.setPreferences((e.target as HTMLTextAreaElement).value)
						}
						placeholder="Device preferences will appear here..."
						rows={15}
						cols={80}
						disabled={prefsBusy}
					/>
				</div>
			)}
		</div>
	);
}
