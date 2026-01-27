import { Badge, Button, Card, Group, Select, Text } from "@mantine/core";
import type { SerialConnection, TranslationFunction } from "../hooks";

interface Props {
	t: TranslationFunction;
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
	t,
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
				<Group>
					<Select
						label={t("baudRate")}
						data={BAUD_RATES}
						value={String(baudRate)}
						onChange={(value: string | null) => value && setBaudRate(Number(value))}
					/>
					<Button onClick={onConnect}>{t("connect")}</Button>
				</Group>
			</Card>
		);
	}

	return (
		<Card withBorder>
			<Group justify="space-between">
				<Group>
					<Text>{t("connectedTo")}</Text>
					<Badge variant="light" color="green" size="lg">
						{serial.chip}
					</Badge>
				</Group>
				<Group>
					<Button variant="outline" onClick={onDisconnect} disabled={isBusy}>
						{t("disconnect")}
					</Button>
					<Button color="red" onClick={onErase} disabled={isBusy} loading={isErasing}>
						{t("eraseFlash")}
					</Button>
				</Group>
			</Group>
		</Card>
	);
}
