import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import "leaflet/dist/leaflet.css";
import { render } from "preact";
import { App } from "./App";

render(
	<MantineProvider>
		<ModalsProvider>
			<Notifications position="bottom-right" />
			<App />
		</ModalsProvider>
	</MantineProvider>,
	document.getElementById("app")!,
);
