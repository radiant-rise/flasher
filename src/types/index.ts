export type ReleasesData = Record<string, string[]>;
export type FlashType = "fw" | "full";

export interface Release {
	target: string;
	version: string;
	label: string;
}
