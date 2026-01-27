import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import "leaflet/dist/leaflet.css";
import { render } from "preact";
import { App } from "./App";

render(
	<MantineProvider>
		<Notifications position="bottom-right" />
		<App />
	</MantineProvider>,
	document.getElementById("app")!,
);
