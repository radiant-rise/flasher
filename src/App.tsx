import CryptoJS from "crypto-js";
import {
	ESPLoader,
	type FlashOptions,
	type LoaderOptions,
	Transport,
} from "esptool-js";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { serial as serialPolyfill } from "web-serial-polyfill";
import releasesData from "./firmwares/releases.json";

type ReleasesData = Record<string, string[]>;
type FlashType = "fw" | "full";

interface Release {
	target: string;
	version: string;
	label: string;
}

const releases: Release[] = Object.entries(releasesData as ReleasesData).flatMap(
	([target, versions]) =>
		versions.slice(0, 5).map((version) => ({
			target,
			version,
			label: `${target}-${version}`,
		})),
);

const serialLib =
	!navigator.serial && (navigator as { usb?: unknown }).usb
		? serialPolyfill
		: navigator.serial;

const terminal = {
	clean() {},
	writeLine: console.log,
	write: console.log,
};

const COMMAND_TIMEOUT_MS = 2000;
const POST_FLASH_DELAY_MS = 1000;
const POST_PROGRAM_DELAY_MS = 2000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let result = "";
	for (const byte of bytes) {
		result += String.fromCharCode(byte);
	}
	return result;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function useSerialConnection() {
	const [isConnected, setIsConnected] = useState(false);
	const [chip, setChip] = useState<string | null>(null);

	const transportRef = useRef<Transport | null>(null);
	const espLoaderRef = useRef<ESPLoader | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const portRef = useRef<any>(null);
	const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
	const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

	const closeNativeSerial = useCallback(async () => {
		const reader = readerRef.current;
		const writer = writerRef.current;
		const port = portRef.current;

		readerRef.current = null;
		writerRef.current = null;

		if (reader) {
			try {
				await reader.cancel();
			} catch {}
			try {
				reader.releaseLock();
			} catch {}
		}

		if (writer) {
			try {
				writer.releaseLock();
			} catch {}
		}

		if (port) {
			try {
				await port.close();
			} catch {}
		}
	}, []);

	const setupNativeSerial = useCallback(async (baud: number) => {
		let port = portRef.current;
		if (!port) {
			if (!serialLib) {
				throw new Error("Web Serial API not available");
			}
			port = await serialLib.requestPort({});
			portRef.current = port;
		}

		await port.open({ baudRate: baud });
		writerRef.current = port.writable.getWriter();
		readerRef.current = port.readable.getReader();
		setChip("Native Connection");
	}, []);

	const cleanupESPTool = useCallback(async () => {
		const transport = transportRef.current;
		transportRef.current = null;
		espLoaderRef.current = null;

		if (transport) {
			try {
				await transport.disconnect();
			} catch {}
		}
	}, []);

	const setupESPTool = useCallback(async (baud: number): Promise<string> => {
		const port = portRef.current;
		if (!port) throw new Error("No device available");

		const transport = new Transport(port, true);
		transportRef.current = transport;

		const loader = new ESPLoader({
			transport,
			baudrate: baud,
			terminal,
			debugLogging: false,
			romBaudrate: baud,
		} as LoaderOptions);
		espLoaderRef.current = loader;

		const detectedChip = await loader.main();
		setChip(detectedChip);
		return detectedChip;
	}, []);

	const connect = useCallback(async (baud: number) => {
		await setupNativeSerial(baud);
		setIsConnected(true);
	}, [setupNativeSerial]);

	const disconnect = useCallback(async () => {
		await closeNativeSerial();
		await cleanupESPTool();
		portRef.current = null;
		setIsConnected(false);
		setChip(null);
	}, [closeNativeSerial, cleanupESPTool]);

	const sendCommand = useCallback(async (command: string): Promise<string> => {
		const writer = writerRef.current;
		const reader = readerRef.current;

		if (!writer || !reader) {
			throw new Error("Serial connection not established");
		}

		await writer.write(textEncoder.encode(`${command}\n`));

		let response = "";
		const deadline = Date.now() + COMMAND_TIMEOUT_MS;

		while (true) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) break;

			const timeoutId = setTimeout(() => reader.cancel(), remaining);

			try {
				const { done, value } = await reader.read();
				clearTimeout(timeoutId);

				if (done) break;
				if (value) {
					response += textDecoder.decode(value, { stream: true });
					if (response.includes("END") || response.includes("ERROR")) break;
				}
			} catch {
				clearTimeout(timeoutId);
				break;
			}
		}

		return response.trim();
	}, []);

	const withESPTool = useCallback(async <T,>(
		baud: number,
		fn: (loader: ESPLoader) => Promise<T>,
		postDelay = POST_FLASH_DELAY_MS,
	): Promise<T> => {
		await closeNativeSerial();
		await setupESPTool(baud);

		const loader = espLoaderRef.current;
		if (!loader) throw new Error("ESP loader not initialized");

		try {
			return await fn(loader);
		} finally {
			await cleanupESPTool();
			await delay(postDelay);
			await setupNativeSerial(baud);
		}
	}, [closeNativeSerial, setupESPTool, cleanupESPTool, setupNativeSerial]);

	useEffect(() => {
		return () => {
			readerRef.current?.cancel().catch(() => {});
			writerRef.current?.releaseLock();
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
		withESPTool,
	};
}

function useFlashOperations(
	serial: ReturnType<typeof useSerialConnection>,
	baudrate: number,
) {
	const [isErasing, setIsErasing] = useState(false);
	const [isProgramming, setIsProgramming] = useState(false);
	const [progress, setProgress] = useState(0);

	const eraseFlash = useCallback(async () => {
		setIsErasing(true);
		try {
			await serial.withESPTool(baudrate, (loader) => loader.eraseFlash());
		} finally {
			setIsErasing(false);
		}
	}, [serial, baudrate]);

	const programFlash = useCallback(async (fileData: string, address: number) => {
		setIsProgramming(true);
		setProgress(0);
		try {
			await serial.withESPTool(
				baudrate,
				async (loader) => {
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
				},
				POST_PROGRAM_DELAY_MS,
			);
		} finally {
			setIsProgramming(false);
			setProgress(0);
		}
	}, [serial, baudrate]);

	return { isErasing, isProgramming, progress, eraseFlash, programFlash };
}

function usePreferences(serial: ReturnType<typeof useSerialConnection>) {
	const [preferences, setPreferences] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const fetchPreferences = useCallback(async (command: string) => {
		setIsLoading(true);
		try {
			const response = await serial.sendCommand(command);
			if (!response) throw new Error("No response received from device");
			try {
				setPreferences(JSON.stringify(JSON.parse(response), null, 2));
			} catch {
				setPreferences(response);
			}
		} finally {
			setIsLoading(false);
		}
	}, [serial]);

	const getAllSettings = useCallback(() => fetchPreferences("GET_PREFS"), [fetchPreferences]);
	const getAllSettingsKeys = useCallback(() => fetchPreferences("GET_PREF_KEYS"), [fetchPreferences]);

	const updateAllSettings = useCallback(async () => {
		const trimmed = preferences.trim();
		if (!trimmed) throw new Error("No preferences data");

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new Error("Invalid JSON format");
		}

		setIsUpdating(true);
		try {
			const response = await serial.sendCommand(`SET_PREFS:${JSON.stringify(parsed)}`);
			if (response.includes("ERROR")) throw new Error(`Update failed: ${response}`);
			return `Response: ${response}`;
		} finally {
			setIsUpdating(false);
		}
	}, [serial, preferences]);

	const ping = useCallback(async () => {
		const response = await serial.sendCommand("PING");
		setPreferences(response);
	}, [serial]);

	return {
		preferences,
		setPreferences,
		isLoading,
		isUpdating,
		getAllSettings,
		getAllSettingsKeys,
		updateAllSettings,
		ping,
	};
}

function useFirmwareLoader() {
	const [selectedLabel, setSelectedLabel] = useState("");
	const [firmwareData, setFirmwareData] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [flashType, setFlashType] = useState<FlashType>("fw");

	const loadFirmware = useCallback(async (label: string, type: FlashType) => {
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
				throw new Error(`Failed to load firmware: ${response.status}`);
			}
			setFirmwareData(arrayBufferToBinaryString(await response.arrayBuffer()));
		} finally {
			setIsLoading(false);
		}
	}, []);

	const selectFirmware = useCallback(async (label: string) => {
		setSelectedLabel(label);
		await loadFirmware(label, flashType);
	}, [loadFirmware, flashType]);

	const changeFlashType = useCallback(async (type: FlashType) => {
		if (type === flashType) return;
		setFlashType(type);
		if (selectedLabel) {
			await loadFirmware(selectedLabel, type);
		}
	}, [flashType, selectedLabel, loadFirmware]);

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

export function App() {
	const [baudrate, setBaudrate] = useState(115200);
	const [alert, setAlert] = useState("");

	const serial = useSerialConnection();
	const flash = useFlashOperations(serial, baudrate);
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
				setAlert(message.includes("JSON") ? "Invalid JSON format" : `${errorContext}: ${message}`);
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
	const prefsBusy = prefs.isLoading || prefs.isUpdating;

	return (
		<div>
			<h3>Flasher</h3>

			{!serial.isConnected ? (
				<div>
					<label>Baudrate: </label>
					<select
						value={baudrate}
						onChange={(e) => setBaudrate(Number((e.target as HTMLSelectElement).value))}
					>
						<option value={921600}>921600</option>
						<option value={460800}>460800</option>
						<option value={230400}>230400</option>
						<option value={115200}>115200</option>
					</select>
					<button onClick={() => runAsync(() => serial.connect(baudrate), "Connection failed")}>
						Connect
					</button>
				</div>
			) : (
				<div>
					<p>Connected to: {serial.chip}</p>
					<button
						onClick={() => runAsync(handleDisconnect, "Disconnect failed")}
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
									() => firmware.selectFirmware((e.target as HTMLSelectElement).value),
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
									runAsync(() => firmware.changeFlashType("fw"), "Failed to load firmware")
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
									runAsync(() => firmware.changeFlashType("full"), "Failed to load firmware")
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

					<button onClick={handleProgram} disabled={isBusy || !firmware.firmwareData}>
						{flash.isProgramming ? "Programming..." : "Program"}
					</button>

					<hr />

					<h4>Device Preferences</h4>

					<div>
						<button
							onClick={() => runAsync(() => prefs.getAllSettings(), "Error getting settings")}
							disabled={prefsBusy}
						>
							{prefs.isLoading ? "Loading..." : "Get Settings"}
						</button>

						<button
							onClick={() =>
								runAsync(() => prefs.updateAllSettings(), "Error updating settings", "Settings updated")
							}
							disabled={prefsBusy || !prefs.preferences.trim()}
						>
							{prefs.isUpdating ? "Updating..." : "Update Settings"}
						</button>

						<button
							onClick={() => runAsync(() => prefs.getAllSettingsKeys(), "Error getting settings keys")}
							disabled={prefsBusy}
						>
							{prefs.isLoading ? "Loading..." : "Get Settings Keys"}
						</button>

						<button onClick={() => runAsync(() => prefs.ping(), "PING failed")} disabled={prefsBusy}>
							PING
						</button>
					</div>

					<textarea
						value={prefs.preferences}
						onChange={(e) => prefs.setPreferences((e.target as HTMLTextAreaElement).value)}
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
