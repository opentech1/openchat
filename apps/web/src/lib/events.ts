export const FOCUS_COMPOSER_EVENT = "openchat:focus-composer" as const;
export const PREFILL_COMPOSER_EVENT = "openchat:prefill-composer" as const;

export type PrefillComposerEventDetail = {
	text: string;
};
