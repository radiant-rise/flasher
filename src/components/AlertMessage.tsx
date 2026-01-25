import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "preact/hooks";

interface Props {
	message: string;
	onDismiss: () => void;
}

export function AlertMessage({ message, onDismiss }: Props) {
	const lastShownMessage = useRef("");
	const onDismissRef = useRef(onDismiss);
	onDismissRef.current = onDismiss;

	useEffect(() => {
		if (message && message !== lastShownMessage.current) {
			const isError = /failed|error|invalid/i.test(message);

			notifications.show({
				message,
				color: isError ? "red" : "green",
				onClose: () => onDismissRef.current(),
			});
		}
		lastShownMessage.current = message;
	}, [message]);

	return null;
}
