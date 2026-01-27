import { Badge, Button, Card, Group, Loader, Progress, Radio, Select, Stack, Text } from "@mantine/core";
import { releases } from "../data/releases";
import type { TranslationFunction } from "../hooks";
import type { FlashType } from "../types";

interface Props {
	t: TranslationFunction;
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

const FIRMWARE_OPTIONS = releases.map((r) => ({
	value: r.label,
	label: r.label,
}));

export function FirmwarePanel({
	t,
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
		<Card withBorder>
			<Stack gap="xs">
				<Group justify="space-between">
					<Group>
						<Select
							label={t("firmwareVersion")}
							placeholder={t("selectFirmwareVersion")}
							data={FIRMWARE_OPTIONS}
							value={selectedLabel || null}
							onChange={(value: string | null) => value && onSelectFirmware(value)}
							disabled={isLoading}
						/>

						<Radio.Group
							value={flashType}
							onChange={(value: string) => onChangeFlashType(value as FlashType)}
						>
							<Group>
								<Radio value="fw" label={t("onlyFW")} disabled={isLoading} />
								<Radio value="full" label={t("fullFW")} disabled={isLoading} />
							</Group>
						</Radio.Group>

						{isLoading && <Loader size="sm" />}
						{firmwareData && (
							<Badge color="green" variant="light">
								{t("firmwareLoaded")}
							</Badge>
						)}
					</Group>
					<Group>
						<Button
							onClick={onProgram}
							disabled={isBusy || !firmwareData}
							loading={isProgramming}
						>
							{t("program")}
						</Button>
					</Group>
				</Group>

				{isProgramming && (
					<Stack gap="xs">
						<Progress value={progress} animated />
						<Text size="sm" ta="center">
							{Math.round(progress)}%
						</Text>
					</Stack>
				)}
			</Stack>
		</Card>
	);
}
