import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { render } from "preact";
import { App } from "./App";

render(
	<MantineProvider>
		<App />
	</MantineProvider>,
	document.getElementById("app")!,
);
