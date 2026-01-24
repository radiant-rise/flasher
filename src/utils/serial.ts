import { serial as serialPolyfill } from "web-serial-polyfill";

export const serialLib =
	!navigator.serial && (navigator as { usb?: unknown }).usb
		? serialPolyfill
		: navigator.serial;

export const terminal = {
	clean() {},
	writeLine: console.log,
	write: console.log,
};

export const COMMAND_TIMEOUT_MS = 2000;
export const POST_FLASH_DELAY_MS = 1000;
export const POST_PROGRAM_DELAY_MS = 2000;

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();
