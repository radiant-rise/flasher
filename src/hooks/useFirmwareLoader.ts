import { useCallback, useState } from "preact/hooks";
import { releases } from "../data/releases";
import type { FlashType } from "../types";
import { arrayBufferToBinaryString } from "../utils/helpers";

export function useFirmwareLoader() {
	const [selectedLabel, setSelectedLabel] = useState("");
	const [firmwareData, setFirmwareData] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [flashType, setFlashType] = useState<FlashType>("fw");

	const loadFirmware = useCallback(async (label: string, type: FlashType) => {
		setFirmwareData(null);
		if (!label) return;

		const release = releases.find((r) => r.label === label);
		if (!release) {
			throw new Error(`Unknown firmware: ${label}`);
		}

		setIsLoading(true);
		try {
			const fileName = type === "fw" ? "image.bin" : "image-merged.bin";
			const response = await fetch(
				`./data/${release.target}/${release.version}/${fileName}`,
			);
			if (!response.ok) {
				throw new Error(`Failed to load firmware: ${response.status}`);
			}
			setFirmwareData(arrayBufferToBinaryString(await response.arrayBuffer()));
		} finally {
			setIsLoading(false);
		}
	}, []);

	const selectFirmware = useCallback(
		async (label: string) => {
			setSelectedLabel(label);
			await loadFirmware(label, flashType);
		},
		[loadFirmware, flashType],
	);

	const changeFlashType = useCallback(
		async (type: FlashType) => {
			if (type === flashType) return;
			setFlashType(type);
			if (selectedLabel) {
				await loadFirmware(selectedLabel, type);
			}
		},
		[flashType, selectedLabel, loadFirmware],
	);

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
