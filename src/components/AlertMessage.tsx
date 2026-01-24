interface Props {
	message: string;
	onDismiss: () => void;
}

export function AlertMessage({ message, onDismiss }: Props) {
	if (!message) return null;

	return (
		<div>
			{message}
			<button onClick={onDismiss}>×</button>
		</div>
	);
}
