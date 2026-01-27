import { TextInput, Box } from "@mantine/core";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { useEffect, useRef, useState } from "preact/hooks";
import type { LatLngExpression, LeafletMouseEvent, Map, Marker as LeafletMarker } from "leaflet";
import L from "leaflet";

// Fix for default marker icons in leaflet with Vite
// @ts-ignore
import iconUrl from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
// @ts-ignore
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const markerIcon = L.icon({
	iconUrl,
	iconRetinaUrl,
	shadowUrl,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
});

interface Props {
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

function parseCoordinates(value: string): [number, number] | null {
	const parts = value.split(",").map((s) => s.trim());
	if (parts.length !== 2) return null;
	const latStr = parts[0];
	const lonStr = parts[1];
	if (latStr === undefined || lonStr === undefined) return null;
	const lat = Number.parseFloat(latStr);
	const lon = Number.parseFloat(lonStr);
	if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
	return [lat, lon];
}

function formatCoordinates(lat: number, lon: number): string {
	return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function DraggableMarker({
	position,
	onPositionChange,
	disabled,
}: {
	position: LatLngExpression;
	onPositionChange: (lat: number, lon: number) => void;
	disabled?: boolean;
}) {
	const markerRef = useRef<LeafletMarker>(null);

	useMapEvents({
		click(e: LeafletMouseEvent) {
			if (!disabled) {
				onPositionChange(e.latlng.lat, e.latlng.lng);
			}
		},
	});

	return (
		<Marker
			position={position}
			draggable={!disabled}
			icon={markerIcon}
			ref={markerRef}
			eventHandlers={{
				dragend: () => {
					const marker = markerRef.current;
					if (marker) {
						const latlng = marker.getLatLng();
						onPositionChange(latlng.lat, latlng.lng);
					}
				},
			}}
		/>
	);
}

export function GeoCoordinatePicker({ label, value, onChange, disabled }: Props) {
	const mapRef = useRef<Map>(null);
	const [localValue, setLocalValue] = useState(value);
	const coords = parseCoordinates(value);
	const defaultCenter: [number, number] = [59.437, 24.7536]; // Tallinn
	const position: [number, number] = coords ?? defaultCenter;

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	useEffect(() => {
		if (coords && mapRef.current) {
			mapRef.current.setView(coords, mapRef.current.getZoom());
		}
	}, [coords?.[0], coords?.[1]]);

	const handleTextChange = (e: { currentTarget: HTMLInputElement }) => {
		const newValue = e.currentTarget.value;
		setLocalValue(newValue);
		const parsed = parseCoordinates(newValue);
		if (parsed) {
			onChange(newValue);
		}
	};

	const handleTextBlur = () => {
		const parsed = parseCoordinates(localValue);
		if (parsed) {
			onChange(formatCoordinates(parsed[0], parsed[1]));
		} else if (localValue.trim() === "") {
			onChange("");
		} else {
			setLocalValue(value);
		}
	};

	const handlePositionChange = (lat: number, lon: number) => {
		if (disabled) return;
		const formatted = formatCoordinates(lat, lon);
		setLocalValue(formatted);
		onChange(formatted);
	};

	return (
		<Box>
			<TextInput
				label={label}
				value={localValue}
				onChange={handleTextChange}
				onBlur={handleTextBlur}
				placeholder="lat, lon (e.g., 59.437, 24.7536)"
				disabled={disabled}
			/>
			<Box mt="xs" style={{ height: 200, borderRadius: 8, overflow: "hidden" }}>
				<MapContainer
					center={position}
					zoom={10}
					style={{ height: "100%", width: "100%" }}
					ref={mapRef}
				>
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					<DraggableMarker position={position} onPositionChange={handlePositionChange} disabled={disabled ?? false} />
				</MapContainer>
			</Box>
		</Box>
	);
}
