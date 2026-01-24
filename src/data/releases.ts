import type { Release, ReleasesData } from "../types";
import releasesData from "../firmwares/releases.json";

export const releases: Release[] = Object.entries(releasesData as ReleasesData).flatMap(
	([target, versions]) =>
		versions.slice(0, 5).map((version) => ({
			target,
			version,
			label: `${target}-${version}`,
		})),
);
