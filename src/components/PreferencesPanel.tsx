import { Button, Card, Group, NumberInput, PasswordInput, Popover, Select, Stack, Switch, Tabs, TagsInput, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useState } from "preact/hooks";
import timezones from "../data/zones.json";
import { GeoCoordinatePicker } from "./GeoCoordinatePicker";

const TIMEZONE_OPTIONS = Object.keys(timezones).map((tz) => ({ value: tz, label: tz }));

const WEATHER_UNIT_OPTIONS = [
	{ value: "m", label: "Metric (m)" },
	{ value: "e", label: "Imperial (e)" },
];

interface SettingConfig {
	label: string;
	tooltip?: string;
}

// Translation-ready settings configuration
// To add i18n support, replace string values with t("key") calls
const SETTINGS_CONFIG: Record<string, SettingConfig> = {
	"display.brightness": {
		label: "Display Brightness",
		tooltip: "Set display brightness level (1-16)",
	},
	"wifi.ssid": {
		label: "WiFi Network",
		tooltip: "The name of your WiFi network",
	},
	"wifi.password": {
		label: "WiFi Password",
	},
	"weather.units": {
		label: "Weather Units",
		tooltip: "Choose between metric (Celsius) or imperial (Fahrenheit)",
	},
	"weather.geocode": {
		label: "Location",
		tooltip: "Geographic coordinates for weather data",
	},
	"datetime.timezone": {
		label: "Timezone",
		tooltip: "Your local timezone for date and time display",
	},
	"finance.symbols": {
		label: "Stock Symbols",
		tooltip: "Enter stock ticker symbols. Find symbols on Yahoo Finance.",
	},
	"weather.apikey": {
		label: "Weather API Key",
		tooltip: "API key for accessing weather data services",
	},
	"request.user_agent": {
		label: "User Agent",
		tooltip: "Custom User-Agent string for HTTP requests",
	},
	"datetime.ntp_servers": {
		label: "NTP Servers",
		tooltip: "Network Time Protocol servers for time synchronization",
	}
};

function SettingLabel({ settingKey }: { settingKey: string }) {
	const config = SETTINGS_CONFIG[settingKey];
	const label = config?.label ?? settingKey;
	const tooltip = config?.tooltip;

	if (!tooltip) {
		return <>{label}</>;
	}

	return (
		<Group gap={4}>
			<Text size="sm" fw={500}>{label}</Text>
			<Popover width={250} position="top" withArrow shadow="md" zIndex={1000}>
				<Popover.Target>
					<Text component="span" size="xs" c="dimmed" style={{ cursor: "help" }}>[?]</Text>
				</Popover.Target>
				<Popover.Dropdown>
					<Text size="xs">{tooltip}</Text>
				</Popover.Dropdown>
			</Popover>
		</Group>
	);
}

interface SettingsTabsProps {
	settingsKeys: string[];
	settingsValues: Record<string, string>;
	onUpdateSettingValue: (key: string, value: string) => void;
	disabled: boolean;
}

function SettingsTabs({ settingsKeys, settingsValues, onUpdateSettingValue, disabled }: SettingsTabsProps) {
	const weatherKeys = settingsKeys.filter((k) => k.startsWith("weather."));
	const financeKeys = settingsKeys.filter((k) => k.startsWith("finance."));
	const generalKeys = settingsKeys.filter((k) => !k.startsWith("weather.") && !k.startsWith("finance."));

	const renderSetting = (key: string) => {
		const value = settingsValues[key] ?? "";

		if (key === "display.brightness") {
			const numValue = value === "" ? "" : Number(value);
			return (
				<NumberInput
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={Number.isNaN(numValue) ? "" : numValue}
					onChange={(val: string | number) => onUpdateSettingValue(key, String(val))}
					min={1}
					max={16}
					disabled={disabled}
				/>
			);
		}

		if (key === "wifi.password") {
			return (
				<PasswordInput
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={value}
					onChange={(e: { currentTarget: HTMLInputElement }) =>
						onUpdateSettingValue(key, e.currentTarget.value)
					}
					disabled={disabled}
				/>
			);
		}

		if (key === "weather.units") {
			return (
				<Select
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={value || null}
					onChange={(val: string | null) => onUpdateSettingValue(key, val ?? "")}
					data={WEATHER_UNIT_OPTIONS}
					disabled={disabled}
				/>
			);
		}

		if (key === "datetime.timezone") {
			return (
				<Select
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={value || "Europe/Tallinn"}
					onChange={(val: string | null) => onUpdateSettingValue(key, val ?? "")}
					data={TIMEZONE_OPTIONS}
					searchable
					disabled={disabled}
				/>
			);
		}

		if (key === "weather.geocode") {
			return (
				<GeoCoordinatePicker
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={value}
					onChange={(val: string) => onUpdateSettingValue(key, val)}
					disabled={disabled}
				/>
			);
		}

		if (key === "finance.symbols") {
			const tagsValue = value ? value.split(",").filter(Boolean) : [];
			return (
				<TagsInput
					key={key}
					label={<SettingLabel settingKey={key} />}
					value={tagsValue}
					onChange={(tags: string[]) => onUpdateSettingValue(key, tags.join(","))}
					disabled={disabled}
				/>
			);
		}

		return (
			<TextInput
				key={key}
				label={<SettingLabel settingKey={key} />}
				value={value}
				onChange={(e: { currentTarget: HTMLInputElement }) =>
					onUpdateSettingValue(key, e.currentTarget.value)
				}
				disabled={disabled}
			/>
		);
	};

	const defaultTab = generalKeys.length > 0 ? "general" : weatherKeys.length > 0 ? "weather" : "finance";

	return (
		<Tabs defaultValue={defaultTab}>
			<Tabs.List>
				{generalKeys.length > 0 && <Tabs.Tab value="general">General</Tabs.Tab>}
				{weatherKeys.length > 0 && <Tabs.Tab value="weather">Weather</Tabs.Tab>}
				{financeKeys.length > 0 && <Tabs.Tab value="finance">Finance</Tabs.Tab>}
			</Tabs.List>

			{generalKeys.length > 0 && (
				<Tabs.Panel value="general" pt="md">
					<Stack gap="sm">
						{generalKeys.map(renderSetting)}
					</Stack>
				</Tabs.Panel>
			)}

			{weatherKeys.length > 0 && (
				<Tabs.Panel value="weather" pt="md">
					<Stack gap="sm">
						{weatherKeys.map(renderSetting)}
					</Stack>
				</Tabs.Panel>
			)}

			{financeKeys.length > 0 && (
				<Tabs.Panel value="finance" pt="md">
					<Stack gap="sm">
						{financeKeys.map(renderSetting)}
					</Stack>
				</Tabs.Panel>
			)}
		</Tabs>
	);
}

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
						<SettingsTabs
							settingsKeys={settingsKeys}
							settingsValues={settingsValues}
							onUpdateSettingValue={onUpdateSettingValue}
							disabled={isBusy}
						/>
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
