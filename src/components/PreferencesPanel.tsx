import { Button, Card, Group, Stack, Textarea, Title } from "@mantine/core";

interface Props {
	preferences: string;
	setPreferences: (value: string) => void;
	isLoading: boolean;
	isUpdating: boolean;
	onGetSettings: () => void;
	onGetSettingsKeys: () => void;
	onUpdateSettings: () => void;
	onPing: () => void;
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
}: Props) {
	const isBusy = isLoading || isUpdating;

	return (
		<Card withBorder>
			<Stack gap="md">
				<Title order={4}>Device Preferences</Title>

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
			</Stack>
		</Card>
	);
}
