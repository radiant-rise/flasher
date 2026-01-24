import { ESPLoader, type LoaderOptions, Transport } from "esptool-js";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { delay } from "../utils/helpers";
import {
	COMMAND_TIMEOUT_MS,
	POST_FLASH_DELAY_MS,
	serialLib,
	terminal,
	textDecoder,
	textEncoder,
} from "../utils/serial";

export function useSerialConnection() {
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
			} catch {
				// Ignore - reader may already be released
			}
			try {
				reader.releaseLock();
			} catch {
				// Ignore - lock may already be released
			}
		}

		if (writer) {
			try {
				writer.releaseLock();
			} catch {
				// Ignore - lock may already be released
			}
		}

		if (port) {
			try {
				await port.close();
			} catch {
				// Ignore - port may already be closed
			}
		}
	}, []);

	const setupNativeSerial = useCallback(async (baudRate: number) => {
		let port = portRef.current;
		if (!port) {
			if (!serialLib) {
				throw new Error("Web Serial API not available");
			}
			port = await serialLib.requestPort({});
			portRef.current = port;
		}

		await port.open({ baudRate });
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
			} catch {
				// Ignore - transport may already be disconnected
			}
		}
	}, []);

	const setupESPTool = useCallback(async (baudRate: number): Promise<string> => {
		const port = portRef.current;
		if (!port) throw new Error("No device available");

		const transport = new Transport(port, true);
		transportRef.current = transport;

		const loader = new ESPLoader({
			transport,
			baudrate: baudRate,
			terminal,
			debugLogging: false,
			romBaudrate: baudRate,
		} as LoaderOptions);
		espLoaderRef.current = loader;

		const detectedChip = await loader.main();
		setChip(detectedChip);
		return detectedChip;
	}, []);

	const connect = useCallback(
		async (baudRate: number) => {
			await setupNativeSerial(baudRate);
			setIsConnected(true);
		},
		[setupNativeSerial],
	);

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

		while (Date.now() < deadline) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) break;

			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
				timeoutId = setTimeout(() => resolve({ done: true, value: undefined }), remaining);
			});

			try {
				const result = await Promise.race([reader.read(), timeoutPromise]);
				clearTimeout(timeoutId);

				if (result.done) break;
				if (result.value) {
					response += textDecoder.decode(result.value, { stream: true });
					if (response.includes("END") || response.includes("ERROR")) break;
				}
			} catch {
				clearTimeout(timeoutId);
				break;
			}
		}

		return response.trim();
	}, []);

	const withESPTool = useCallback(
		async <T,>(
			baudRate: number,
			fn: (loader: ESPLoader) => Promise<T>,
			postDelay = POST_FLASH_DELAY_MS,
		): Promise<T> => {
			await closeNativeSerial();
			await setupESPTool(baudRate);

			const loader = espLoaderRef.current;
			if (!loader) throw new Error("ESP loader not initialized");

			try {
				return await fn(loader);
			} finally {
				await cleanupESPTool();
				await delay(postDelay);
				await setupNativeSerial(baudRate);
			}
		},
		[closeNativeSerial, setupESPTool, cleanupESPTool, setupNativeSerial],
	);

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

export type SerialConnection = ReturnType<typeof useSerialConnection>;
