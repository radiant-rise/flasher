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
		<>
			<hr />
			<h4>Device Preferences</h4>

			<div>
				<button onClick={onGetSettings} disabled={isBusy}>
					{isLoading ? "Loading..." : "Get Settings"}
				</button>

				<button onClick={onUpdateSettings} disabled={isBusy || !preferences.trim()}>
					{isUpdating ? "Updating..." : "Update Settings"}
				</button>

				<button onClick={onGetSettingsKeys} disabled={isBusy}>
					{isLoading ? "Loading..." : "Get Settings Keys"}
				</button>

				<button onClick={onPing} disabled={isBusy}>
					PING
				</button>
			</div>

			<textarea
				value={preferences}
				onChange={(e) => setPreferences((e.target as HTMLTextAreaElement).value)}
				placeholder="Device preferences will appear here..."
				rows={15}
				cols={80}
				disabled={isBusy}
			/>
		</>
	);
}
