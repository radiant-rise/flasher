export function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let result = "";
	for (const byte of bytes) {
		result += String.fromCharCode(byte);
	}
	return result;
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
