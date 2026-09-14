/**
 * United States English: the source locale.
 *
 * Every other locale mirrors this shape. The `Translation` type is derived from
 * this object, so a missing or misspelled key in a translation is a compile
 * error rather than a runtime fallback.
 */
export const enUS = {
	app: {
		name: 'rux',
		tagline: 'Windows system inspector and cleaner',
		machine: 'Machine',
		elevatedBadge: 'admin',
		userBadge: 'user',
		readOnlyBadge: 'read-only',
		working: 'working...',
		cancelled: 'Cancelled.',
		nothingSelected: 'Nothing selected.',
		scanning: 'Scanning...',
		refreshing: 'refreshing...',
		language: 'Language',
		quit: 'quit',
		help: 'help',
	},

	views: {
		startup: 'Startup',
		wsl: 'WSL',
		leftovers: 'Leftovers',
		junk: 'Junk',
		hardware: 'Hardware',
	},

	startup: {
		columns: {name: 'NAME', source: 'SOURCE', status: 'STATUS', memory: 'MEM', publisher: 'PUBLISHER'},
		summary: '{{total}} entries',
		running: '{{count}} running',
		disabled: '{{count}} disabled',
		missing: '{{count}} missing',
		empty: 'No entries match the current filter.',
		status: {
			running: 'running',
			stopped: 'stopped',
			disabled: 'disabled',
			missing: 'missing',
		},
		detail: {
			status: 'Status',
			command: 'Command',
			executable: 'Executable',
			publisher: 'Publisher',
			processes: 'Processes',
			registered: 'Registered',
			file: 'File',
			startupSkipped: 'startup skipped',
			notRunning: 'not running',
			processCount: '{{count}} process',
			processCountPlural: '{{count}} processes',
			matchedBy: 'matched by {{reason}}',
			missingOnDisk: 'missing on disk - this entry fails silently at logon',
			modified: 'modified {{date}}',
			unknown: 'unknown',
		},
		match: {
			path: 'exact path',
			command: 'launcher target',
			name: 'executable name',
			directory: 'install folder',
		},
		source: {
			'run-user': 'Run (user)',
			'run-once-user': 'RunOnce (user)',
			'run-machine': 'Run (machine)',
			'run-once-machine': 'RunOnce (machine)',
			'run-machine-x86': 'Run (machine x86)',
			'run-once-machine-x86': 'RunOnce (machine x86)',
			'startup-folder-user': 'Startup folder (user)',
			'startup-folder-machine': 'Startup folder (machine)',
			'scheduled-task': 'Scheduled task',
		},
		confirm: {
			enable: 'Enable "{{name}}"?',
			disable: 'Disable "{{name}}"?',
			remove: 'Remove "{{name}}" permanently?',
		},
		cannotToggle: '{{source}} entries cannot be toggled - remove them instead.',
		mutated: '{{name}} -> {{mutation}}',
	},

	residue: {
		columns: {leftover: 'LEFTOVER', kind: 'KIND', size: 'SIZE', pointsAt: 'POINTS AT'},
		summary: '{{total}} leftovers',
		selected: '{{count}} selected',
		empty: 'No leftovers found with the current filter.',
		emptyHint: 'Press D for a deeper scan.',
		classes: {
			startup: 'Startup entry',
			uninstall: 'Uninstall key',
			service: 'Service',
			task: 'Scheduled task',
			shortcut: 'Shortcut',
			apppath: 'App path',
			firewall: 'Firewall rule',
			directory: 'Folder',
		},
		reasons: {
			startup: 'A startup entry in {{location}} points at a file that no longer exists',
			uninstall: 'An uninstall entry left behind; its files are gone{{publisher}}',
			service: 'Service "{{displayName}}" points at a missing binary (state: {{state}})',
			task: 'A scheduled task in {{path}} runs a missing program',
			shortcut: 'A shortcut in {{folder}} targets a missing file',
			apppath: 'An App Paths entry resolves to a missing program',
			firewall: 'A firewall rule ({{direction}}) for a program that no longer exists',
			emptyDirectory: 'An empty folder left in {{root}} after an uninstall',
			unclaimedDirectory: 'A program folder in {{root}} that no installed program claims',
		},
		detail: {
			why: 'Why',
			pointsAt: 'Points at',
			removes: 'Removes',
			risk: 'Risk',
			recovery: 'Recovery',
			needsAdmin: 'needs admin',
			riskSafe: 'safe - the target it references no longer exists',
			riskReview: 'review - heuristic match, confirm before removing',
			recoveryNote: 'backed up before removal; restore with "rux restore"',
		},
		confirmRemove: 'Remove {{count}} leftover?',
		confirmRemovePlural: 'Remove {{count}} leftovers?',
		backedUpFirst: 'Backed up first.',
		willPromptAdmin: 'Windows will ask for administrator rights.',
		removed: 'Removed {{removed}} of {{total}}.',
		removeFailed: '{{count}} failed.',
		backupCreated: 'Backup {{id}}.',
		nothingSafe: 'Nothing safe to remove.',
		selectHint: 'Nothing selected. Press space, or A for every safe item.',
	},

	junk: {
		columns: {location: 'LOCATION', category: 'CATEGORY', files: 'FILES', size: 'SIZE'},
		summary: '{{total}} locations',
		reclaimable: '{{size}} reclaimable',
		selectedSize: '{{size}} selected',
		empty: 'No junk found.',
		categories: {
			'user-temp': 'User temp',
			'system-temp': 'System temp',
			'windows-update': 'Windows Update',
			'delivery-optimization': 'Delivery Optimization',
			prefetch: 'Prefetch',
			'thumbnail-cache': 'Thumbnail cache',
			'icon-cache': 'Icon cache',
			'error-reports': 'Error reports',
			'crash-dumps': 'Crash dumps',
			'recycle-bin': 'Recycle Bin',
			'font-cache': 'Font cache',
			'event-logs': 'Event logs',
			'browser-cache': 'Browser cache',
			'package-manager-cache': 'Package manager cache',
			'installer-cache': 'Installer cache',
			'log-files': 'Log files',
		},
		targets: {
			userTemp: 'Your temporary files. Windows and installers write here and rarely clean up.',
			windowsTemp: 'The system temporary folder, used by installers running as SYSTEM.',
			windowsUpdateCache: 'Downloaded update packages. Windows re-downloads them if needed.',
			deliveryOptimization: 'Update fragments cached for peer sharing.',
			prefetch: 'Application launch traces. Windows rebuilds them over the next few boots.',
			thumbnailCache: 'Explorer thumbnail databases, rebuilt on demand.',
			inetCache: 'The Windows internet cache used by system components.',
			errorReportsUser: 'Crash reports queued for your user account.',
			errorReportsMachine: 'Crash reports queued machine-wide.',
			crashDumps: 'Per-application crash dumps.',
			memoryDump: 'The full kernel memory dump from the last blue screen.',
			minidump: 'Small kernel dumps from previous blue screens.',
			recycleBin: 'Everything currently in the Recycle Bin.',
			fontCache: 'The font service cache, rebuilt automatically.',
			cbsLogs: 'Component servicing logs from Windows updates.',
			dismLogs: 'Deployment image servicing logs.',
			edgeCache: 'Microsoft Edge browsing cache.',
			chromeCache: 'Google Chrome browsing cache.',
			firefoxCache: 'Mozilla Firefox profile caches.',
			npmCache: 'The npm package cache. npm refills it on the next install.',
			nugetCache: 'The NuGet global package folder. Restores will re-download.',
			pipCache: 'The pip wheel cache.',
			yarnCache: 'The Yarn package cache.',
			installerDownloads: 'Installer payloads kept after setup finished.',
			windowsOld: 'The previous Windows installation kept after an upgrade.',
		},
		notes: {
			partialRead: 'Partially readable; some files are in use.',
		},
		confirmClean: 'Clear {{count}} location?',
		confirmCleanPlural: 'Clear {{count}} locations?',
		freed: 'Freed {{size}} across {{count}} locations.',
		cleanFailed: '{{count}} failed.',
		notReversible: 'This deletes files permanently and is not backed up.',
		riskSafe: 'safe - regenerated automatically, nothing is lost',
		riskReview: 'review - confirm you do not need this data first',
	},

	hardware: {
		columns: {impact: 'IMPACT', area: 'AREA', title: 'RECOMMENDATION'},
		graphics: 'Graphics',
		displays: 'Displays',
		drivers: 'Drivers',
		system: 'System',
		wsl: 'WSL',
		wslNotInstalled: 'WSL is not installed on this machine.',
		wslDistributions: 'Distributions',
		wslConfig: 'Configuration',
		wslDefault: 'default',
		notSet: 'not set',
		recommendations: 'Recommendations',
		noRecommendations: 'No recommendations. Everything rux checks looks correct.',
		adapter: 'Adapter',
		integrated: 'integrated',
		discrete: 'discrete',
		vram: 'VRAM',
		driver: 'driver',
		resolution: 'Resolution',
		refreshRate: 'Refresh rate',
		colorDepth: 'Color depth',
		native: 'native',
		deviceCount: '{{count}} devices',
		healthy: '{{count}} healthy',
		problems: '{{count}} with problems',
		cpu: 'CPU',
		memory: 'Memory',
		free: 'free',
		storage: 'Storage',
		secureBoot: 'Secure Boot',
		virtualization: 'Virtualization',
		powerPlan: 'Power plan',
		enabled: 'enabled',
		disabled: 'disabled',
		unknown: 'unknown',
		impact: {
			critical: 'critical',
			high: 'high',
			medium: 'medium',
			low: 'low',
			info: 'info',
		},
		detail: {
			finding: 'Finding',
			advice: 'Advice',
			where: 'Where',
			command: 'Command',
			evidence: 'Evidence',
		},
	},

	recommendations: {
		graphics: {
			hybridNoPreference: {
				title: 'No per-application GPU preferences are set',
				finding:
					'This machine has both {{discrete}} and {{integrated}}, but Windows has no per-application GPU preference recorded.',
				advice:
					'Assign demanding applications to the high-performance GPU so they stop rendering on the integrated adapter.',
			},
			hagsDisabled: {
				title: 'Hardware-accelerated GPU scheduling is off',
				finding: 'The GPU scheduling mode is disabled while a discrete GPU is present.',
				advice:
					'Turning it on lets the GPU manage its own memory and can lower latency on supported hardware.',
			},
			gameDvrEnabled: {
				title: 'Background game recording is on',
				finding: 'Game DVR is recording in the background.',
				advice:
					'Turning it off removes a constant capture overhead that costs frame time in every application.',
			},
			gameModeDisabled: {
				title: 'Game Mode is off',
				finding: 'Windows Game Mode is disabled.',
				advice: 'Game Mode limits background work while a game has focus.',
			},
			staleDriver: {
				title: 'The graphics driver is out of date',
				finding: '{{model}} is running driver {{version}}, which is {{days}} days old.',
				advice:
					'Graphics drivers ship fixes and performance work monthly. Install the current one from the vendor.',
			},
			noController: {
				title: 'No graphics adapter detected',
				finding: 'rux could not read any graphics adapter from this system.',
				advice: 'This is expected inside some virtual machines and remote sessions.',
			},
		},
		display: {
			refreshBelowMaximum: {
				title: 'A display is running below its maximum refresh rate',
				finding: '{{display}} is set to {{current}} Hz but supports {{maximum}} Hz.',
				advice: 'Raising the refresh rate makes all motion visibly smoother at no cost.',
			},
			nonNativeResolution: {
				title: 'A display is not at its native resolution',
				finding: '{{display}} is set to {{current}} but its panel is {{native}}.',
				advice:
					'A non-native resolution is scaled by the panel and looks soft. Prefer native plus DPI scaling.',
			},
			lowColorDepth: {
				title: 'A display is running at reduced color depth',
				finding: '{{display}} is at {{depth}}-bit color.',
				advice: 'Set 32-bit color to avoid visible banding in gradients.',
			},
		},
		driver: {
			devicesInError: {
				title: 'Devices are reporting driver errors',
				finding: '{{count}} devices report a Device Manager error code.',
				advice:
					'These devices are not working. Reinstall or update their drivers, starting with the vendor package.',
			},
			devicesDegraded: {
				title: 'Devices are reporting driver warnings',
				finding: '{{count}} devices report a non-fatal Device Manager problem.',
				advice: 'These usually resolve by reinstalling the driver or reconnecting the device.',
			},
			staleCritical: {
				title: 'Core drivers have not been updated in years',
				finding: '{{count}} drivers for core components are more than three years old.',
				advice: 'Check Windows Update optional updates, then the vendor site, for newer packages.',
			},
			unsigned: {
				title: 'Unsigned drivers are installed',
				finding: '{{count}} installed drivers are not digitally signed.',
				advice:
					'Unsigned drivers run in the kernel without a verified origin. Replace them with signed packages.',
			},
			allHealthy: {
				title: 'All devices report healthy drivers',
				finding: 'All {{count}} inspected devices report a working, signed driver.',
				advice: 'Nothing to do here.',
			},
		},
		wsl: {
			version1Only: {
				title: 'Only WSL 1 distributions are installed',
				finding: 'Every installed distribution runs on WSL 1, which has no real Linux kernel.',
				advice:
					'WSL 2 brings a real kernel, full system call compatibility and GPU access. Convert with "wsl --set-version <name> 2".',
			},
			noConfig: {
				title: 'WSL is running entirely on defaults',
				finding:
					'No .wslconfig exists, so WSL 2 may claim up to {{defaultMemory}} GB of memory and all {{cores}} logical processors.',
				advice:
					'Create a .wslconfig with explicit memory and processor limits so the Linux VM cannot starve Windows under load.',
			},
			memoryTooLow: {
				title: 'The WSL memory limit is very low',
				finding: 'WSL is capped at {{limit}} GB of memory.',
				advice:
					'Language servers, compilers and containers need headroom. Raise the limit to at least 4 GB, or 8 GB for container work.',
			},
			memoryStarvesHost: {
				title: 'The WSL memory limit leaves Windows too little',
				finding: 'WSL may take {{limit}} GB of the {{host}} GB installed, leaving Windows short.',
				advice:
					'Reserve at least 8 GB for Windows itself; otherwise the host pages to disk while the Linux VM sits idle.',
			},
			processorsTooLow: {
				title: 'WSL has very few processors assigned',
				finding: 'WSL is limited to {{assigned}} processors while the host has {{host}}.',
				advice:
					'Parallel builds serialise at this limit. Assign roughly half to three quarters of the host processors.',
			},
			processorsAllCores: {
				title: 'WSL is assigned every processor',
				finding: 'WSL may use all {{assigned}} of the {{host}} host processors.',
				advice:
					'Leaving one or two processors to Windows keeps the desktop responsive during long Linux builds.',
			},
			swapDisabled: {
				title: 'WSL swap is disabled',
				finding: 'Swap is set to 0 while the memory limit is modest.',
				advice:
					'A small swap file prevents the Linux out-of-memory killer from terminating builds at peak usage.',
			},
			gpuDisabled: {
				title: 'GPU access is disabled for WSL',
				finding: 'gpuSupport is turned off in .wslconfig.',
				advice: 'Enabling it gives CUDA, ROCm and OpenGL workloads inside Linux direct access to the GPU.',
			},
			nestedVirtualizationDisabled: {
				title: 'Nested virtualization is disabled for WSL',
				finding: 'The host supports virtualization but nestedVirtualization is off.',
				advice: 'Enable it to run virtual machines, KVM or nested containers inside the distribution.',
			},
			sparseVhdOff: {
				title: 'WSL virtual disks do not shrink automatically',
				finding: 'sparseVhd is not enabled, so the WSL virtual disk keeps space after files are deleted.',
				advice: 'Enabling sparseVhd lets the virtual disk release freed space back to Windows.',
			},
			virtualizationOff: {
				title: 'Hardware virtualization is disabled, WSL 2 cannot run',
				finding: 'WSL 2 requires virtualization extensions, which the firmware reports as disabled.',
				advice: 'Enable VT-x or AMD-V in firmware. Without it, WSL 2 will not start at all.',
			},
		},
		system: {
			secureBootOff: {
				title: 'Secure Boot is disabled',
				finding: 'The firmware reports Secure Boot as disabled.',
				advice:
					'Secure Boot blocks unsigned boot code. Enable it in firmware unless a tool you rely on needs it off.',
			},
			virtualizationOff: {
				title: 'Hardware virtualization is disabled',
				finding: 'The processor reports virtualization support as disabled in firmware.',
				advice:
					'Enable VT-x or AMD-V in firmware to run containers, emulators and virtual machines at full speed.',
			},
			memoryPressure: {
				title: 'Free memory is low',
				finding: 'Only {{percent}} percent of system memory is available.',
				advice: 'Close unused applications, or reduce what starts with Windows.',
			},
			powerSaverPlan: {
				title: 'A power saving plan is active',
				finding: 'The active power plan is "{{plan}}".',
				advice:
					'Power saving caps processor and GPU clocks. Switch to Balanced or High performance while plugged in.',
			},
		},
	},

	actions: {
		graphicsSettings: 'Settings > System > Display > Graphics',
		advancedDisplaySettings: 'Settings > System > Display > Advanced display',
		displaySettings: 'Settings > System > Display',
		gameCaptureSettings: 'Settings > Gaming > Captures',
		gameModeSettings: 'Settings > Gaming > Game Mode',
		deviceManager: 'Device Manager',
		windowsUpdateOptional: 'Settings > Windows Update > Advanced > Optional updates',
		firmwareSettings: 'Firmware setup (UEFI/BIOS)',
		powerSettings: 'Settings > System > Power and battery',
		vendorDriverPage: "The GPU vendor's driver download page",
		ruxStartup: 'The rux startup view',
		terminal: 'A terminal',
		wslConfigFile: 'The .wslconfig file in your user profile',
	},

	backups: {
		title: 'Backups',
		empty: 'No backups. rux creates one every time it removes something.',
		item: '{{id}}  {{count}} items  {{date}}',
		restoreHint: 'Restore one with: rux restore <id>',
		restored: 'Restored {{count}}.',
		restoreFailed: '{{count}} failed.',
		purged: 'Deleted backup {{id}}.',
		needsId: 'A backup id is required. Run "rux backups" to list them.',
	},

	keys: {
		title: 'Keys',
		switchView: 'switch view',
		move: 'move selection',
		firstLast: 'jump to first / last',
		search: 'search (Esc clears, Enter keeps)',
		filter: 'cycle filter',
		sort: 'cycle sort',
		toggleEntry: 'enable or disable the entry',
		removeEntry: 'remove the entry permanently',
		select: 'select or deselect',
		selectSafe: 'select every safe item',
		selectAll: 'select everything, review items included',
		selectNone: 'clear the selection',
		apply: 'apply to the selected items',
		rescan: 'rescan',
		deepScan: 'toggle deep scan',
		includeTasks: 'include or drop scheduled tasks',
		language: 'switch language',
		help: 'toggle this help',
		quit: 'quit',
	},

	cli: {
		description: 'Windows system inspector and cleaner',
		platformError: 'rux supports Windows only.',
		ttyError: 'rux needs an interactive terminal. Use --list or --json when piping.',
		dryRunHeader: 'Dry run - nothing will be changed. {{count}} items would be removed:',
		dryRunElevated: '{{count}} of them are machine-wide and would need administrator rights.',
		removeHint: 'Run with --yes to remove the safe ones (each is backed up first).',
		cleanHint: 'Run with --yes to clear the safe ones.',
		safeCount: '{{count}} safe',
		reviewCount: '{{count}} need review',
	},
} as const;

/**
 * Widens the literal types `as const` produces back to `string`, while keeping
 * the key structure intact. A translation must therefore define exactly the same
 * keys, but is free to carry any text.
 */
type Localized<T> = {
	readonly [K in keyof T]: T[K] extends string ? string : Localized<T[K]>;
};

export type Translation = Localized<typeof enUS>;
