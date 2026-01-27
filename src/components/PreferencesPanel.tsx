import { Button, Card, Group, NumberInput, PasswordInput, Popover, Select, Stack, Switch, Tabs, TagsInput, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useState } from "preact/hooks";
import timezones from "../data/zones.json";
import type { TranslationFunction } from "../hooks";
import { GeoCoordinatePicker } from "./GeoCoordinatePicker";

const TIMEZONE_OPTIONS = Object.keys(timezones).map((tz) => ({ value: tz, label: tz }));

interface SettingTranslationKeys {
	labelKey: string;
	tooltipKey?: string;
}

const SETTINGS_TRANSLATION_KEYS: Record<string, SettingTranslationKeys> = {
	"display.brightness": {
		labelKey: "settings.displayBrightness",
		tooltipKey: "settings.displayBrightnessTooltip",
	},
	"wifi.ssid": {
		labelKey: "settings.wifiNetwork",
		tooltipKey: "settings.wifiNetworkTooltip",
	},
	"wifi.password": {
		labelKey: "settings.wifiPassword",
	},
	"weather.units": {
		labelKey: "settings.weatherUnits",
		tooltipKey: "settings.weatherUnitsTooltip",
	},
	"weather.geocode": {
		labelKey: "settings.location",
		tooltipKey: "settings.locationTooltip",
	},
	"datetime.timezone": {
		labelKey: "settings.timezone",
		tooltipKey: "settings.timezoneTooltip",
	},
	"finance.symbols": {
		labelKey: "settings.stockSymbols",
		tooltipKey: "settings.stockSymbolsTooltip",
	},
	"weather.apikey": {
		labelKey: "settings.weatherApiKey",
		tooltipKey: "settings.weatherApiKeyTooltip",
	},
	"request.user_agent": {
		labelKey: "settings.userAgent",
		tooltipKey: "settings.userAgentTooltip",
	},
	"datetime.ntp_servers": {
		labelKey: "settings.ntpServers",
		tooltipKey: "settings.ntpServersTooltip",
	}
};

function SettingLabel({ settingKey, t }: { settingKey: string; t: TranslationFunction }) {
	const config = SETTINGS_TRANSLATION_KEYS[settingKey];
	const label = config ? t(config.labelKey) : settingKey;
	const tooltip = config?.tooltipKey ? t(config.tooltipKey) : undefined;

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
	t: TranslationFunction;
	settingsKeys: string[];
	settingsValues: Record<string, string>;
	onUpdateSettingValue: (key: string, value: string) => void;
	disabled: boolean;
}

function SettingsTabs({ t, settingsKeys, settingsValues, onUpdateSettingValue, disabled }: SettingsTabsProps) {
	const weatherKeys = settingsKeys.filter((k) => k.startsWith("weather."));
	const financeKeys = settingsKeys.filter((k) => k.startsWith("finance."));
	const generalKeys = settingsKeys.filter((k) => !k.startsWith("weather.") && !k.startsWith("finance."));

	const weatherUnitOptions = [
		{ value: "m", label: t("weatherUnitsMetric") },
		{ value: "e", label: t("weatherUnitsImperial") },
	];

	const renderSetting = (key: string) => {
		const value = settingsValues[key] ?? "";

		if (key === "display.brightness") {
			const numValue = value === "" ? "" : Number(value);
			return (
				<NumberInput
					key={key}
					label={<SettingLabel settingKey={key} t={t} />}
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
					label={<SettingLabel settingKey={key} t={t} />}
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
					label={<SettingLabel settingKey={key} t={t} />}
					value={value || null}
					onChange={(val: string | null) => onUpdateSettingValue(key, val ?? "")}
					data={weatherUnitOptions}
					disabled={disabled}
				/>
			);
		}

		if (key === "datetime.timezone") {
			return (
				<Select
					key={key}
					label={<SettingLabel settingKey={key} t={t} />}
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
					label={<SettingLabel settingKey={key} t={t} />}
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
					label={<SettingLabel settingKey={key} t={t} />}
					value={tagsValue}
					onChange={(tags: string[]) => onUpdateSettingValue(key, tags.join(","))}
					disabled={disabled}
				/>
			);
		}

		return (
			<TextInput
				key={key}
				label={<SettingLabel settingKey={key} t={t} />}
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
				{generalKeys.length > 0 && <Tabs.Tab value="general">{t("general")}</Tabs.Tab>}
				{weatherKeys.length > 0 && <Tabs.Tab value="weather">{t("weather")}</Tabs.Tab>}
				{financeKeys.length > 0 && <Tabs.Tab value="finance">{t("finance")}</Tabs.Tab>}
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
	t: TranslationFunction;
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
	t,
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
					<Title order={4}>{t("devicePreferences")}</Title>
					<Switch
						label={t("advanced")}
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
								{t("getSettings")}
							</Button>

							<Button
								onClick={onUpdateSettings}
								disabled={isBusy || !preferences.trim()}
								loading={isUpdating}
							>
								{t("updateSettings")}
							</Button>

							<Button variant="outline" onClick={onGetSettingsKeys} disabled={isBusy}>
								{t("getSettingsKeys")}
							</Button>

							<Button variant="light" onClick={onPing} disabled={isBusy}>
								{t("ping")}
							</Button>
						</Group>

						<Textarea
							value={preferences}
							onChange={(e: { currentTarget: HTMLTextAreaElement }) => setPreferences(e.currentTarget.value)}
							placeholder={t("preferencesPlaceholder")}
							minRows={15}
							autosize
							disabled={isBusy}
						/>
					</>
				) : settingsKeys.length > 0 ? (
					<>
						<SettingsTabs
							t={t}
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
							{t("updateSettings")}
						</Button>
					</>
				) : (
					<Text c="dimmed" size="sm">
						{t("noSettingsAvailable")}
					</Text>
				)}
			</Stack>
		</Card>
	);
}
