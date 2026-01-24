import { Badge, Button, Card, Group, Select, Text } from "@mantine/core";
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

const BAUD_RATES = [
	{ value: "921600", label: "921600" },
	{ value: "460800", label: "460800" },
	{ value: "230400", label: "230400" },
	{ value: "115200", label: "115200" },
];

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
			<Card withBorder>
				<Group align="flex-end">
					<Select
						label="Baud rate"
						data={BAUD_RATES}
						value={String(baudRate)}
						onChange={(value: string | null) => value && setBaudRate(Number(value))}
						w={120}
					/>
					<Button onClick={onConnect}>Connect</Button>
				</Group>
			</Card>
		);
	}

	return (
		<Card withBorder>
			<Group justify="space-between">
				<Group>
					<Text>Connected to:</Text>
					<Badge variant="light" color="green" size="lg">
						{serial.chip}
					</Badge>
				</Group>
				<Group>
					<Button variant="outline" onClick={onDisconnect} disabled={isBusy}>
						Disconnect
					</Button>
					<Button color="red" onClick={onErase} disabled={isBusy} loading={isErasing}>
						Erase Flash
					</Button>
				</Group>
			</Group>
		</Card>
	);
}
