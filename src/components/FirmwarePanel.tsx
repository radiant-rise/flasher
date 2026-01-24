import { releases } from "../data/releases";
import type { FlashType } from "../types";

interface Props {
	selectedLabel: string;
	firmwareData: string | null;
	isLoading: boolean;
	flashType: FlashType;
	isProgramming: boolean;
	progress: number;
	isBusy: boolean;
	onSelectFirmware: (label: string) => void;
	onChangeFlashType: (type: FlashType) => void;
	onProgram: () => void;
}

export function FirmwarePanel({
	selectedLabel,
	firmwareData,
	isLoading,
	flashType,
	isProgramming,
	progress,
	isBusy,
	onSelectFirmware,
	onChangeFlashType,
	onProgram,
}: Props) {
	return (
		<div>
			<div>
				<label>Firmware Version: </label>
				<select
					value={selectedLabel}
					onChange={(e) => onSelectFirmware((e.target as HTMLSelectElement).value)}
					disabled={isLoading}
				>
					<option value="">Select firmware version...</option>
					{releases.map((r) => (
						<option key={r.label} value={r.label}>
							{r.label}
						</option>
					))}
				</select>{" "}
				<label>
					<input
						type="radio"
						name="flashType"
						value="fw"
						checked={flashType === "fw"}
						onChange={() => onChangeFlashType("fw")}
						disabled={isLoading}
					/>
					Only FW
				</label>
				<label>
					<input
						type="radio"
						name="flashType"
						value="full"
						checked={flashType === "full"}
						onChange={() => onChangeFlashType("full")}
						disabled={isLoading}
					/>
					Full
				</label>
				{isLoading && <span> Loading firmware...</span>}
				{firmwareData && <span> ✓ Firmware loaded</span>}
			</div>

			{isProgramming && (
				<div>
					<progress value={progress} max="100" />
					<div>{Math.round(progress)}%</div>
				</div>
			)}

			<button onClick={onProgram} disabled={isBusy || !firmwareData}>
				{isProgramming ? "Programming..." : "Program"}
			</button>
		</div>
	);
}
