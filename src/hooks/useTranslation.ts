import { useCallback, useEffect, useState } from "preact/hooks";
import translations from "../data/translations.json";

export type Language = "EN" | "ES" | "EE" | "RU";

export const LANGUAGES: Language[] = ["EN", "ES", "EE", "RU"];

const STORAGE_KEY = "flasher-language";
const DEFAULT_LANGUAGE: Language = "EN";

type NestedTranslation = string | Record<string, string>;
type Translations = Record<string, NestedTranslation>;

function getStoredLanguage(): Language {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && LANGUAGES.includes(stored as Language)) {
			return stored as Language;
		}
	} catch {
		// localStorage may be unavailable in some environments
	}
	return DEFAULT_LANGUAGE;
}

function resolveKey(translations: Translations, key: string): string | undefined {
	const parts = key.split(".");
	if (parts.length === 1) {
		const value = translations[key];
		return typeof value === "string" ? value : undefined;
	}

	const [first, ...rest] = parts;
	let current: NestedTranslation | undefined = translations[first!];

	for (const part of rest) {
		if (typeof current === "object" && current !== null) {
			current = current[part];
		} else {
			return undefined;
		}
	}

	return typeof current === "string" ? current : undefined;
}

export function useTranslation() {
	const [language, setLanguage] = useState<Language>(getStoredLanguage);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, language);
		} catch {
			// localStorage may be unavailable
		}
	}, [language]);

	const t = useCallback(
		(key: string): string => {
			const langTranslations = translations[language] as Translations;
			const resolved = resolveKey(langTranslations, key);
			if (resolved !== undefined) return resolved;

			// Fallback to English if key not found in current language
			if (language !== DEFAULT_LANGUAGE) {
				const fallback = resolveKey(translations[DEFAULT_LANGUAGE] as Translations, key);
				if (fallback !== undefined) return fallback;
			}

			return key;
		},
		[language],
	);

	return { language, setLanguage, t };
}

export type TranslationFunction = ReturnType<typeof useTranslation>["t"];
