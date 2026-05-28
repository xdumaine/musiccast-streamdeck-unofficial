(function () {
	const fields = Array.from(document.querySelectorAll("[data-global-color]"));
	if (fields.length === 0) return;

	const client = window.SDPIComponents?.streamDeckClient;
	if (!client) return;

	let globalSettings = {};
	const timers = new Map();

	function getColor(settings, key) {
		return settings?.colors?.[key] ?? "";
	}

	function setColor(settings, key, value) {
		return {
			...settings,
			colors: {
				...(settings.colors ?? {}),
				[key]: value,
			},
		};
	}

	function paint(settings) {
		for (const field of fields) {
			if (document.activeElement === field) continue;
			field.value = getColor(settings, field.dataset.globalColor);
		}
	}

	function save(field) {
		const key = field.dataset.globalColor;
		const next = setColor(globalSettings, key, field.value.trim());
		globalSettings = next;
		client.setGlobalSettings(next);
	}

	for (const field of fields) {
		field.addEventListener("input", () => {
			const existing = timers.get(field);
			if (existing) clearTimeout(existing);
			timers.set(
				field,
				setTimeout(() => {
					timers.delete(field);
					save(field);
				}, 250)
			);
		});
		field.addEventListener("change", () => save(field));
		field.addEventListener("blur", () => save(field));
	}

	client.didReceiveGlobalSettings.subscribe((ev) => {
		globalSettings = ev.payload.settings ?? {};
		paint(globalSettings);
	});

	client.getGlobalSettings().then((settings) => {
		globalSettings = settings ?? {};
		paint(globalSettings);
	});
})();
