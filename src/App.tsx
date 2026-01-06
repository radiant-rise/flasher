import CryptoJS from "crypto-js";
import {
	ESPLoader,
	type FlashOptions,
	type LoaderOptions,
	Transport,
} from "esptool-js";
import { useEffect, useRef, useState } from "preact/hooks";
import { serial } from "web-serial-polyfill";
import tDisplays3releases from "./firmwares/dashboard-lilygo-t-displays3-releases.json";

const serialLib =
	!navigator.serial && (navigator as any).usb ? serial : navigator.serial;

const terminal = {
	clean() {},
	writeLine: console.log,
	write: console.log,
};

function useSerialConnection(baudrate: string) {
	const [isConnected, setIsConnected] = useState(false);
	const [chip, setChip] = useState<string | null>(null);

	const transportRef = useRef<Transport | null>(null);
	const espLoaderRef = useRef<ESPLoader | null>(null);
	const portRef = useRef<any>(null);
	const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
	const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
	const baudrateRef = useRef(baudrate);
	baudrateRef.current = baudrate;

	const closeNativeSerial = async () => {
		await readerRef.current?.cancel();
		readerRef.current?.releaseLock();
		readerRef.current = null;
		await writerRef.current?.close();
		writerRef.current = null;
		await portRef.current?.close();
		portRef.current = null;
	};

	const setupNativeSerial = async () => {
		portRef.current = await serialLib?.requestPort({});
		await portRef.current.open({ baudRate: parseInt(baudrateRef.current) });
		writerRef.current = portRef.current.writable.getWriter();
		readerRef.current = portRef.current.readable.getReader();
		setChip("Native Connection");
	};

	const cleanupESPTool = async () => {
		await transportRef.current?.disconnect();
		transportRef.current = null;
		espLoaderRef.current = null;
	};

	const setupESPTool = async () => {
		if (!portRef.current) throw new Error("No device available");

		transportRef.current = new Transport(portRef.current, true);
		espLoaderRef.current = new ESPLoader({
			transport: transportRef.current,
			baudrate: parseInt(baudrateRef.current),
			terminal,
			debugLogging: false,
			romBaudrate: parseInt(baudrateRef.current),
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
		const deadline = Date.now() + 2000;

		while (Date.now() < deadline) {
			try {
				const result = await readerRef.current.read();
				if (result.value?.length) {
					response += decoder.decode(result.value);
					if (response.includes("END") || response.includes("ERROR")) break;
				}
				if (result.done) break;
			} catch {
				await new Promise((r) => setTimeout(r, 100));
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

	const withESPTool = async <T,>(fn: () => Promise<T>, delay = 1000): Promise<T> => {
		await serial.closeNativeSerial();
		await serial.setupESPTool();
		try {
			return await fn();
		} finally {
			await serial.cleanupESPTool();
			await new Promise((r) => setTimeout(r, delay));
			await serial.setupNativeSerial();
		}
	};

	const eraseFlash = async () => {
		setIsErasing(true);
		try {
			await withESPTool(() => serial.espLoaderRef.current!.eraseFlash());
		} finally {
			setIsErasing(false);
		}
	};

	const programFlash = async (fileData: string) => {
		setIsProgramming(true);
		setProgress(0);
		try {
			await withESPTool(async () => {
				await serial.espLoaderRef.current!.writeFlash({
					fileArray: [{ data: fileData, address: 0x10000 }],
					flashSize: "keep",
					flashMode: "keep",
					flashFreq: "keep",
					eraseAll: false,
					compress: true,
					reportProgress: (_: number, written: number, total: number) => {
						setProgress((written / total) * 100);
					},
					calculateMD5Hash: (image: string) =>
						CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)).toString(),
				} as FlashOptions);
				await serial.espLoaderRef.current!.after("hard_reset");
			}, 2000);
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
			const response = await serial.sendCommand("GET_ALL_PREFS");
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
		if (!preferences.trim()) throw new Error("No preferences data!");
		setIsUpdating(true);
		try {
			const response = await serial.sendCommand(
				`SET_ALL_PREFS:${JSON.stringify(JSON.parse(preferences))}`,
			);
			if (response.includes("ERROR")) throw new Error(`Update failed: ${response}`);
			return `Response: ${response}`;
		} finally {
			setIsUpdating(false);
		}
	};

	return { preferences, setPreferences, isLoading, isUpdating, getAllSettings, updateAllSettings };
}

function useFirmwareLoader() {
	const [selectedVersion, setSelectedVersion] = useState("");
	const [firmwareData, setFirmwareData] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const selectVersion = async (version: string) => {
		setSelectedVersion(version);
		setFirmwareData(null);
		if (!version) return;

		setIsLoading(true);
		try {
			const response = await fetch(`./firmwares/${version}/dashboard-lilygo-t-displays3.bin`);
			if (!response.ok) {
				throw new Error(`Failed to load firmware: ${response.status} ${response.statusText}`);
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			setFirmwareData(String.fromCharCode(...bytes));
		} finally {
			setIsLoading(false);
		}
	};

	return { selectedVersion, firmwareData, isLoading, selectVersion };
}

export function App() {
	const [baudrate, setBaudrate] = useState("115200");
	const [alert, setAlert] = useState("");

	const serial = useSerialConnection(baudrate);
	const flash = useFlashOperations(serial);
	const prefs = usePreferences(serial);
	const firmware = useFirmwareLoader();

	const handleError = (e: any, context: string) => {
		console.error(e);
		setAlert(e.message?.includes("JSON") ? "Invalid JSON format" : `${context}: ${e.message}`);
	};

	const runAsync = async (fn: () => Promise<any>, errorContext: string, successMsg?: string) => {
		setAlert("");
		try {
			const result = await fn();
			if (successMsg) setAlert(result ?? successMsg);
		} catch (e: any) {
			handleError(e, errorContext);
		}
	};

	const prefsBusy = prefs.isLoading || prefs.isUpdating;

	return (
		<div>
			<h3>Flasher</h3>

			{!serial.isConnected ? (
				<div>
					<label>Baudrate: </label>
					<select value={baudrate} onChange={(e) => setBaudrate((e.target as HTMLSelectElement).value)}>
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
					<button onClick={() => runAsync(async () => { await serial.disconnect(); prefs.setPreferences(""); }, "Disconnect failed")}>
						Disconnect
					</button>
					<button onClick={() => runAsync(() => flash.eraseFlash(), "Erase failed")} disabled={flash.isErasing}>
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
							value={firmware.selectedVersion}
							onChange={(e) => runAsync(() => firmware.selectVersion((e.target as HTMLSelectElement).value), "Failed to load firmware")}
							disabled={firmware.isLoading}
						>
							<option value="">Select firmware version...</option>
							{tDisplays3releases.map((r) => (
								<option key={r.version} value={r.version}>{r.version}</option>
							))}
						</select>
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
							runAsync(() => flash.programFlash(firmware.firmwareData!), "Programming failed", "Programming completed successfully!");
						}}
						disabled={flash.isProgramming || !firmware.firmwareData || firmware.isLoading}
					>
						{flash.isProgramming ? "Programming..." : "Program"}
					</button>

					<hr />

					<h4>Device Preferences</h4>

					<div>
						<button onClick={() => runAsync(() => prefs.getAllSettings(), "Error getting settings")} disabled={prefsBusy}>
							{prefs.isLoading ? "Loading..." : "Get All Settings"}
						</button>

						<button
							onClick={() => runAsync(() => prefs.updateAllSettings(), "Error updating settings", "Settings updated")}
							disabled={prefsBusy || !prefs.preferences.trim()}
						>
							{prefs.isUpdating ? "Updating..." : "Update All Settings"}
						</button>

						<button onClick={() => runAsync(async () => prefs.setPreferences(await serial.sendCommand("PING")), "PING failed")} disabled={prefsBusy}>
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
