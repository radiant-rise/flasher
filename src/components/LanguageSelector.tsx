import { Select } from "@mantine/core";
import { type Language, LANGUAGES } from "../hooks";

interface Props {
	language: Language;
	onChange: (lang: Language) => void;
}

const LANGUAGE_OPTIONS = LANGUAGES.map((lang: Language) => ({ value: lang, label: lang }));

export function LanguageSelector({ language, onChange }: Props) {
	return (
		<Select
			aria-label="Language"
			data={LANGUAGE_OPTIONS}
			value={language}
			onChange={(value: string | null) => value && onChange(value as Language)}
			w={70}
			size="xs"
		/>
	);
}
