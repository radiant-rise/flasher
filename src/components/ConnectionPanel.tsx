import type { SerialConnection } from "../hooks";

interface Props {
	serial: SerialConnection;
	baudRate: number;
	setBaudRate: (baudRate: number) => void;
	isBusy: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
	onErase: () => void;
	isErasing: boolean;
}

export function ConnectionPanel({
	serial,
	baudRate,
	setBaudRate,
	isBusy,
	onConnect,
	onDisconnect,
	onErase,
	isErasing,
}: Props) {
	if (!serial.isConnected) {
		return (
			<div>
				<label>Baud rate: </label>
				<select
					value={baudRate}
					onChange={(e) => setBaudRate(Number((e.target as HTMLSelectElement).value))}
				>
					<option value={921600}>921600</option>
					<option value={460800}>460800</option>
					<option value={230400}>230400</option>
					<option value={115200}>115200</option>
				</select>
				<button onClick={onConnect}>Connect</button>
			</div>
		);
	}

	return (
		<div>
			<p>Connected to: {serial.chip}</p>
			<button onClick={onDisconnect} disabled={isBusy}>
				Disconnect
			</button>
			<button onClick={onErase} disabled={isBusy}>
				{isErasing ? "Erasing..." : "Erase Flash"}
			</button>
		</div>
	);
}
