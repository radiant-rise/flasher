import { useCallback, useState } from "preact/hooks";
import type { SerialConnection } from "./useSerialConnection";

export function usePreferences(serial: SerialConnection) {
	const [preferences, setPreferences] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const fetchPreferences = useCallback(
		async (command: string) => {
			setIsLoading(true);
			try {
				const response = await serial.sendCommand(command);
				if (!response) throw new Error("No response received from device");
				setPreferences(tryFormatJson(response));
			} finally {
				setIsLoading(false);
			}
		},
		[serial],
	);

	function tryFormatJson(text: string): string {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}

	const getAllSettings = useCallback(
		() => fetchPreferences("GET_PREFS"),
		[fetchPreferences],
	);

	const getAllSettingsKeys = useCallback(
		() => fetchPreferences("GET_PREF_KEYS"),
		[fetchPreferences],
	);

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
