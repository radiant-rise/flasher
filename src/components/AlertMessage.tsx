import { Alert } from "@mantine/core";

interface Props {
	message: string;
	onDismiss: () => void;
}

export function AlertMessage({ message, onDismiss }: Props) {
	if (!message) return null;

	const lowerMsg = message.toLowerCase();
	const isError = lowerMsg.includes("failed") || lowerMsg.includes("error") || lowerMsg.includes("invalid");

	return (
		<Alert
			color={isError ? "red" : "green"}
			variant="light"
			withCloseButton
			onClose={onDismiss}
		>
			{message}
		</Alert>
	);
}
