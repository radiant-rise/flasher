import { useCallback, useState } from "preact/hooks";
import { delay } from "../utils/helpers";
import type { SerialConnection } from "./useSerialConnection";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractResponse(text: string, command: string): string {
	const escaped = escapeRegex(command);
	const pattern = new RegExp(`${escaped}:RESPONSE\\s*([\\s\\S]*?)\\s*END`);
	const match = text.match(pattern);
	return match?.[1]?.trim() ?? text;
}

function hasValidResponse(text: string, command: string): boolean {
	const escaped = escapeRegex(command);
	return new RegExp(`${escaped}:RESPONSE[\\s\\S]*END`).test(text);
}

function parseJson<T>(content: string, fallback: T): T {
	try {
		return JSON.parse(content) as T;
	} catch {
		return fallback;
	}
}

function flattenObject(obj: unknown, prefix = ""): Record<string, string> {
	const result: Record<string, string> = {};
	if (obj === null || typeof obj !== "object") return result;

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			Object.assign(result, flattenObject(value, fullKey));
		} else {
			result[fullKey] = String(value);
		}
	}
	return result;
}

function unflattenObject(flat: Record<string, string>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(flat)) {
		const parts = key.split(".");
		let current: Record<string, unknown> = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]!;
			current[part] ??= {};
			current = current[part] as Record<string, unknown>;
		}

		const numValue = Number(value);
		current[parts.at(-1)!] = !Number.isNaN(numValue) && value.trim() !== "" ? numValue : value;
	}

	return result;
}

export function usePreferences(serial: SerialConnection) {
	const [preferences, setPreferences] = useState("");
	const [settingsKeys, setSettingsKeys] = useState<string[]>([]);
	const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const sendCommandWithRetry = useCallback(
		async (command: string): Promise<string> => {
			for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
				const response = await serial.sendCommand(command);
				if (response && hasValidResponse(response, command)) {
					return response;
				}
				if (attempt < MAX_RETRIES) {
					await delay(RETRY_DELAY_MS);
				}
			}
			throw new Error(`No valid response after ${MAX_RETRIES} retries`);
		},
		[serial],
	);

	const fetchPreferences = useCallback(
		async (command: string) => {
			setIsLoading(true);
			try {
				const response = await sendCommandWithRetry(command);
				const content = extractResponse(response, command);
				const formatted = parseJson(content, null);
				setPreferences(formatted ? JSON.stringify(formatted, null, 2) : content);
			} finally {
				setIsLoading(false);
			}
		},
		[sendCommandWithRetry],
	);

	const getAllSettings = useCallback(
		() => fetchPreferences("GET_PREFS"),
		[fetchPreferences],
	);

	const getAllSettingsKeys = useCallback(
		() => fetchPreferences("GET_PREF_KEYS"),
		[fetchPreferences],
	);

	const updateSettingValue = useCallback((key: string, value: string) => {
		setSettingsValues((prev) => ({ ...prev, [key]: value }));
	}, []);

	const saveSettingsValues = useCallback(async () => {
		setIsUpdating(true);
		try {
			const nested = unflattenObject(settingsValues);
			const response = await serial.sendCommand(`SET_PREFS:${JSON.stringify(nested)}`);
			if (response.includes("ERROR")) {
				throw new Error(`Update failed: ${extractResponse(response, "SET_PREFS")}`);
			}
			return extractResponse(response, "SET_PREFS");
		} finally {
			setIsUpdating(false);
		}
	}, [serial, settingsValues]);

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
			if (response.includes("ERROR")) {
				throw new Error(`Update failed: ${extractResponse(response, "SET_PREFS")}`);
			}
			return extractResponse(response, "SET_PREFS");
		} finally {
			setIsUpdating(false);
		}
	}, [serial, preferences]);

	const ping = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await serial.sendCommand("PING");
			setPreferences(extractResponse(response, "PING"));
		} finally {
			setIsLoading(false);
		}
	}, [serial]);

	const initializeSettings = useCallback(async () => {
		setIsLoading(true);
		try {
			const keysResponse = await sendCommandWithRetry("GET_PREF_KEYS");
			const keysContent = extractResponse(keysResponse, "GET_PREF_KEYS");
			const keys = parseJson<string[]>(keysContent, []);
			setSettingsKeys(keys);

			if (keys.length > 0) {
				const valuesResponse = await sendCommandWithRetry("GET_PREFS");
				const valuesContent = extractResponse(valuesResponse, "GET_PREFS");
				const parsed = parseJson<Record<string, unknown>>(valuesContent, {});
				setSettingsValues(flattenObject(parsed));
			}
		} finally {
			setIsLoading(false);
		}
	}, [sendCommandWithRetry]);

	return {
		preferences,
		setPreferences,
		isLoading,
		isUpdating,
		getAllSettings,
		getAllSettingsKeys,
		updateAllSettings,
		ping,
		settingsKeys,
		settingsValues,
		updateSettingValue,
		saveSettingsValues,
		initializeSettings,
	};
}
