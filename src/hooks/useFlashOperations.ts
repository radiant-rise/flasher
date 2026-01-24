import CryptoJS from "crypto-js";
import type { FlashOptions } from "esptool-js";
import { useCallback, useState } from "preact/hooks";
import { POST_PROGRAM_DELAY_MS } from "../utils/serial";
import type { SerialConnection } from "./useSerialConnection";

export function useFlashOperations(serial: SerialConnection, baudrate: number) {
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

	const programFlash = useCallback(
		async (fileData: string, address: number) => {
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
		},
		[serial, baudrate],
	);

	return { isErasing, isProgramming, progress, eraseFlash, programFlash };
}
