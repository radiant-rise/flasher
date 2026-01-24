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

	const connect = useCallback(
		async (baud: number) => {
			await setupNativeSerial(baud);
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

	const withESPTool = useCallback(
		async <T,>(
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
