import { Anchor, Button, Card, Group, NumberInput, PasswordInput, Popover, Select, Stack, Switch, TagsInput, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useState } from "preact/hooks";
import timezones from "../data/zones.json";
import { GeoCoordinatePicker } from "./GeoCoordinatePicker";

const TIMEZONE_OPTIONS = Object.keys(timezones).map((tz) => ({ value: tz, label: tz }));

const WEATHER_UNIT_OPTIONS = [
	{ value: "m", label: "Metric (m)" },
	{ value: "e", label: "Imperial (e)" },
];

interface Props {
	preferences: string;
	setPreferences: (value: string) => void;
	isLoading: boolean;
	isUpdating: boolean;
	onGetSettings: () => void;
	onGetSettingsKeys: () => void;
	onUpdateSettings: () => void;
	onPing: () => void;
	settingsKeys: string[];
	settingsValues: Record<string, string>;
	onUpdateSettingValue: (key: string, value: string) => void;
	onSaveSettingsValues: () => void;
}

export function PreferencesPanel({
	preferences,
	setPreferences,
	isLoading,
	isUpdating,
	onGetSettings,
	onGetSettingsKeys,
	onUpdateSettings,
	onPing,
	settingsKeys,
	settingsValues,
	onUpdateSettingValue,
	onSaveSettingsValues,
}: Props) {
	const [advanced, setAdvanced] = useState(false);
	const isBusy = isLoading || isUpdating;

	return (
		<Card withBorder>
			<Stack gap="md">
				<Group justify="space-between">
					<Title order={4}>Device Preferences</Title>
					<Switch
						label="Advanced"
						checked={advanced}
						onChange={(e: { currentTarget: HTMLInputElement }) => setAdvanced(e.currentTarget.checked)}
					/>
				</Group>

				{advanced ? (
					<>
						<Group>
							<Button
								variant="outline"
								onClick={onGetSettings}
								disabled={isBusy}
								loading={isLoading}
							>
								Get Settings
							</Button>

							<Button
								onClick={onUpdateSettings}
								disabled={isBusy || !preferences.trim()}
								loading={isUpdating}
							>
								Update Settings
							</Button>

							<Button variant="outline" onClick={onGetSettingsKeys} disabled={isBusy}>
								Get Settings Keys
							</Button>

							<Button variant="light" onClick={onPing} disabled={isBusy}>
								PING
							</Button>
						</Group>

						<Textarea
							value={preferences}
							onChange={(e: { currentTarget: HTMLTextAreaElement }) => setPreferences(e.currentTarget.value)}
							placeholder="Device preferences will appear here..."
							minRows={15}
							autosize
							disabled={isBusy}
						/>
					</>
				) : settingsKeys.length > 0 ? (
					<>
						<Stack gap="sm">
							{settingsKeys.map((key) => {
								const value = settingsValues[key] ?? "";

								if (key === "display.brightness") {
									const numValue = value === "" ? "" : Number(value);
									return (
										<NumberInput
											key={key}
											label={key}
											value={Number.isNaN(numValue) ? "" : numValue}
											onChange={(val: string | number) => onUpdateSettingValue(key, String(val))}
											min={1}
											max={16}
											disabled={isBusy}
										/>
									);
								}

								if (key === "wifi.password") {
									return (
										<PasswordInput
											key={key}
											label={key}
											value={value}
											onChange={(e: { currentTarget: HTMLInputElement }) =>
												onUpdateSettingValue(key, e.currentTarget.value)
											}
											disabled={isBusy}
										/>
									);
								}

								if (key === "weather.units") {
									return (
										<Select
											key={key}
											label={key}
											value={value || null}
											onChange={(val: string | null) => onUpdateSettingValue(key, val ?? "")}
											data={WEATHER_UNIT_OPTIONS}
											disabled={isBusy}
										/>
									);
								}

								if (key === "datetime.timezone") {
									return (
										<Select
											key={key}
											label={key}
											value={value || "Europe/Tallinn"}
											onChange={(val: string | null) => onUpdateSettingValue(key, val ?? "")}
											data={TIMEZONE_OPTIONS}
											searchable
											disabled={isBusy}
										/>
									);
								}

								if (key === "weather.geocode") {
									return (
										<GeoCoordinatePicker
											key={key}
											label={key}
											value={value}
											onChange={(val: string) => onUpdateSettingValue(key, val)}
											disabled={isBusy}
										/>
									);
								}

								if (key === "finance.symbols") {
									const tagsValue = value ? value.split(",").filter(Boolean) : [];
									return (
										<TagsInput
											key={key}
											label={
												<Group gap={4}>
													<Text size="sm" fw={500}>Symbols</Text>
													<Popover width={250} position="top" withArrow shadow="md">
														<Popover.Target>
															<Text size="xs" c="dimmed" style={{ cursor: "help" }}>[i]</Text>
														</Popover.Target>
														<Popover.Dropdown>
															<Text size="xs">
																Enter stock ticker symbols.{" "}
																<Anchor href="https://finance.yahoo.com/lookup" target="_blank" rel="noopener noreferrer" size="xs">
																	Find symbols on Yahoo Finance
																</Anchor>
															</Text>
														</Popover.Dropdown>
													</Popover>
												</Group>
											}
											value={tagsValue}
											onChange={(tags: string[]) => onUpdateSettingValue(key, tags.join(","))}
											disabled={isBusy}
										/>
									);
								}

								return (
									<TextInput
										key={key}
										label={key}
										value={value}
										onChange={(e: { currentTarget: HTMLInputElement }) =>
											onUpdateSettingValue(key, e.currentTarget.value)
										}
										disabled={isBusy}
									/>
								);
							})}
						</Stack>
						<Button
							onClick={onSaveSettingsValues}
							disabled={isBusy}
							loading={isUpdating}
						>
							Update Settings
						</Button>
					</>
				) : (
					<Text c="dimmed" size="sm">
						No settings available. Use Advanced mode to fetch settings.
					</Text>
				)}
			</Stack>
		</Card>
	);
}
