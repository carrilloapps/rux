import type {Translation} from '@/i18n/locales/en-US';

/**
 * Venezuelan Spanish.
 *
 * Typed as `Translation`, so this file cannot drift from the source locale: a
 * missing or renamed key fails the build instead of silently falling back.
 * Wording follows Venezuelan usage ("computadora", "usted" avoided in favour of
 * direct imperatives, no peninsular "ordenador" or vosotros forms).
 */
export const esVE: Translation = {
	app: {
		name: 'rux',
		tagline: 'Inspector y limpiador de sistema para Windows',
		machine: 'Equipo',
		elevatedBadge: 'admin',
		userBadge: 'usuario',
		readOnlyBadge: 'solo lectura',
		working: 'trabajando...',
		cancelled: 'Cancelado.',
		nothingSelected: 'Nada seleccionado.',
		scanning: 'Analizando...',
		refreshing: 'actualizando...',
		language: 'Idioma',
		quit: 'salir',
		help: 'ayuda',
	},

	views: {
		startup: 'Inicio',
		wsl: 'WSL',
		leftovers: 'Residuos',
		junk: 'Basura',
		hardware: 'Hardware',
	},

	startup: {
		columns: {name: 'NOMBRE', source: 'ORIGEN', status: 'ESTADO', memory: 'MEM', publisher: 'EDITOR'},
		summary: '{{total}} entradas',
		running: '{{count}} activas',
		disabled: '{{count}} desactivadas',
		missing: '{{count}} rotas',
		empty: 'Ninguna entrada coincide con el filtro actual.',
		status: {
			running: 'activa',
			stopped: 'detenida',
			disabled: 'desactivada',
			missing: 'rota',
		},
		detail: {
			status: 'Estado',
			command: 'Comando',
			executable: 'Ejecutable',
			publisher: 'Editor',
			processes: 'Procesos',
			registered: 'Registrada en',
			file: 'Archivo',
			startupSkipped: 'Windows la omite al iniciar',
			notRunning: 'no esta en ejecucion',
			processCount: '{{count}} proceso',
			processCountPlural: '{{count}} procesos',
			matchedBy: 'detectado por {{reason}}',
			missingOnDisk: 'no existe en disco - esta entrada falla en silencio al iniciar sesion',
			modified: 'modificado {{date}}',
			unknown: 'desconocido',
		},
		match: {
			path: 'ruta exacta',
			command: 'destino del lanzador',
			name: 'nombre del ejecutable',
			directory: 'carpeta de instalacion',
		},
		source: {
			'run-user': 'Run (usuario)',
			'run-once-user': 'RunOnce (usuario)',
			'run-machine': 'Run (equipo)',
			'run-once-machine': 'RunOnce (equipo)',
			'run-machine-x86': 'Run (equipo x86)',
			'run-once-machine-x86': 'RunOnce (equipo x86)',
			'startup-folder-user': 'Carpeta de inicio (usuario)',
			'startup-folder-machine': 'Carpeta de inicio (equipo)',
			'scheduled-task': 'Tarea programada',
		},
		confirm: {
			enable: 'Activar "{{name}}"?',
			disable: 'Desactivar "{{name}}"?',
			remove: 'Eliminar "{{name}}" de forma permanente?',
		},
		cannotToggle: 'Las entradas de {{source}} no se pueden alternar - hay que eliminarlas.',
		mutated: '{{name}} -> {{mutation}}',
	},

	residue: {
		columns: {leftover: 'RESIDUO', kind: 'TIPO', size: 'TAMANO', pointsAt: 'APUNTA A'},
		summary: '{{total}} residuos',
		selected: '{{count}} seleccionados',
		empty: 'No se encontraron residuos con el filtro actual.',
		emptyHint: 'Presiona D para un analisis profundo.',
		classes: {
			startup: 'Entrada de inicio',
			uninstall: 'Clave de desinstalacion',
			service: 'Servicio',
			task: 'Tarea programada',
			shortcut: 'Acceso directo',
			apppath: 'Ruta de aplicacion',
			firewall: 'Regla de firewall',
			directory: 'Carpeta',
		},
		reasons: {
			startup: 'Una entrada de inicio en {{location}} apunta a un archivo que ya no existe',
			uninstall: 'Quedo una entrada de desinstalacion; sus archivos ya no estan{{publisher}}',
			service: 'El servicio "{{displayName}}" apunta a un binario inexistente (estado: {{state}})',
			task: 'Una tarea programada en {{path}} ejecuta un programa que ya no existe',
			shortcut: 'Un acceso directo en {{folder}} apunta a un archivo inexistente',
			apppath: 'Una entrada de App Paths resuelve a un programa inexistente',
			firewall: 'Una regla de firewall ({{direction}}) para un programa que ya no existe',
			emptyDirectory: 'Carpeta vacia que quedo en {{root}} tras una desinstalacion',
			unclaimedDirectory: 'Carpeta de programa en {{root}} que ningun programa instalado reclama',
		},
		detail: {
			why: 'Motivo',
			pointsAt: 'Apunta a',
			removes: 'Elimina',
			risk: 'Riesgo',
			recovery: 'Recuperacion',
			needsAdmin: 'requiere admin',
			riskSafe: 'seguro - el destino al que apunta ya no existe',
			riskReview: 'revisar - coincidencia heuristica, confirma antes de eliminar',
			recoveryNote: 'se respalda antes de eliminar; restaura con "rux restore"',
		},
		confirmRemove: 'Eliminar {{count}} residuo?',
		confirmRemovePlural: 'Eliminar {{count}} residuos?',
		backedUpFirst: 'Se respalda primero.',
		willPromptAdmin: 'Windows va a pedir permisos de administrador.',
		removed: 'Se eliminaron {{removed}} de {{total}}.',
		removeFailed: '{{count}} fallaron.',
		backupCreated: 'Respaldo {{id}}.',
		nothingSafe: 'No hay nada seguro que eliminar.',
		selectHint: 'Nada seleccionado. Presiona espacio, o A para todo lo seguro.',
	},

	junk: {
		columns: {location: 'UBICACION', category: 'CATEGORIA', files: 'ARCHIVOS', size: 'TAMANO'},
		summary: '{{total}} ubicaciones',
		reclaimable: '{{size}} recuperables',
		selectedSize: '{{size}} seleccionados',
		empty: 'No se encontro basura.',
		categories: {
			'user-temp': 'Temporales del usuario',
			'system-temp': 'Temporales del sistema',
			'windows-update': 'Windows Update',
			'delivery-optimization': 'Optimizacion de entrega',
			prefetch: 'Prefetch',
			'thumbnail-cache': 'Cache de miniaturas',
			'icon-cache': 'Cache de iconos',
			'error-reports': 'Informes de errores',
			'crash-dumps': 'Volcados de fallo',
			'recycle-bin': 'Papelera de reciclaje',
			'font-cache': 'Cache de fuentes',
			'event-logs': 'Registros de eventos',
			'browser-cache': 'Cache del navegador',
			'package-manager-cache': 'Cache de gestores de paquetes',
			'installer-cache': 'Cache de instaladores',
			'log-files': 'Archivos de registro',
		},
		targets: {
			userTemp: 'Tus archivos temporales. Windows y los instaladores escriben aqui y casi nunca limpian.',
			windowsTemp: 'Carpeta temporal del sistema, usada por instaladores que corren como SYSTEM.',
			windowsUpdateCache: 'Paquetes de actualizacion descargados. Windows los vuelve a bajar si hacen falta.',
			deliveryOptimization: 'Fragmentos de actualizaciones guardados para compartir en red.',
			prefetch: 'Trazas de arranque de aplicaciones. Windows las reconstruye en los siguientes inicios.',
			thumbnailCache: 'Bases de datos de miniaturas del Explorador, se rehacen solas.',
			inetCache: 'Cache de internet que usan los componentes del sistema.',
			errorReportsUser: 'Informes de fallo en cola para tu cuenta.',
			errorReportsMachine: 'Informes de fallo en cola para todo el equipo.',
			crashDumps: 'Volcados de fallo por aplicacion.',
			memoryDump: 'Volcado completo de memoria del ultimo pantallazo azul.',
			minidump: 'Volcados pequenos de pantallazos azules anteriores.',
			recycleBin: 'Todo lo que hay ahora en la Papelera de reciclaje.',
			fontCache: 'Cache del servicio de fuentes, se reconstruye sola.',
			cbsLogs: 'Registros de mantenimiento de componentes de Windows Update.',
			dismLogs: 'Registros de mantenimiento de imagenes DISM.',
			edgeCache: 'Cache de navegacion de Microsoft Edge.',
			chromeCache: 'Cache de navegacion de Google Chrome.',
			firefoxCache: 'Caches de perfiles de Mozilla Firefox.',
			npmCache: 'Cache de paquetes de npm. npm la rellena en la proxima instalacion.',
			nugetCache: 'Carpeta global de paquetes NuGet. Los restores vuelven a descargar.',
			pipCache: 'Cache de wheels de pip.',
			yarnCache: 'Cache de paquetes de Yarn.',
			installerDownloads: 'Cargas de instaladores que quedaron despues de instalar.',
			windowsOld: 'La instalacion anterior de Windows que quedo tras una actualizacion.',
		},
		notes: {
			partialRead: 'Lectura parcial; algunos archivos estan en uso.',
		},
		confirmClean: 'Limpiar {{count}} ubicacion?',
		confirmCleanPlural: 'Limpiar {{count}} ubicaciones?',
		freed: 'Se liberaron {{size}} en {{count}} ubicaciones.',
		cleanFailed: '{{count}} fallaron.',
		notReversible: 'Esto borra archivos de forma permanente y no se respalda.',
		riskSafe: 'seguro - se regenera solo, no se pierde nada',
		riskReview: 'revisar - confirma que no necesitas estos datos',
	},

	hardware: {
		columns: {impact: 'IMPACTO', area: 'AREA', title: 'RECOMENDACION'},
		graphics: 'Graficos',
		displays: 'Pantallas',
		drivers: 'Controladores',
		system: 'Sistema',
		wsl: 'WSL',
		wslNotInstalled: 'WSL no esta instalado en este equipo.',
		wslDistributions: 'Distribuciones',
		wslConfig: 'Configuracion',
		wslDefault: 'predeterminada',
		notSet: 'sin definir',
		recommendations: 'Recomendaciones',
		noRecommendations: 'Sin recomendaciones. Todo lo que rux revisa esta correcto.',
		adapter: 'Adaptador',
		integrated: 'integrada',
		discrete: 'dedicada',
		vram: 'VRAM',
		driver: 'controlador',
		resolution: 'Resolucion',
		refreshRate: 'Frecuencia de actualizacion',
		colorDepth: 'Profundidad de color',
		native: 'nativa',
		deviceCount: '{{count}} dispositivos',
		healthy: '{{count}} sanos',
		problems: '{{count}} con problemas',
		cpu: 'CPU',
		memory: 'Memoria',
		free: 'libres',
		storage: 'Almacenamiento',
		secureBoot: 'Arranque seguro',
		virtualization: 'Virtualizacion',
		powerPlan: 'Plan de energia',
		enabled: 'activado',
		disabled: 'desactivado',
		unknown: 'desconocido',
		impact: {
			critical: 'critico',
			high: 'alto',
			medium: 'medio',
			low: 'bajo',
			info: 'info',
		},
		detail: {
			finding: 'Hallazgo',
			advice: 'Recomendacion',
			where: 'Donde',
			command: 'Comando',
			evidence: 'Evidencia',
		},
	},

	recommendations: {
		graphics: {
			hybridNoPreference: {
				title: 'No hay preferencias de GPU por aplicacion',
				finding:
					'Este equipo tiene {{discrete}} y {{integrated}}, pero Windows no tiene ninguna preferencia de GPU por aplicacion.',
				advice:
					'Asigna las aplicaciones exigentes a la GPU de alto rendimiento para que dejen de renderizar en la integrada.',
			},
			hagsDisabled: {
				title: 'La planificacion de GPU acelerada por hardware esta apagada',
				finding: 'El modo de planificacion de GPU esta desactivado aunque hay una GPU dedicada.',
				advice:
					'Activarla deja que la GPU gestione su propia memoria y puede bajar la latencia en hardware compatible.',
			},
			gameDvrEnabled: {
				title: 'La grabacion de juegos en segundo plano esta activa',
				finding: 'Game DVR esta grabando en segundo plano.',
				advice:
					'Apagarlo quita una carga de captura constante que resta rendimiento en todas las aplicaciones.',
			},
			gameModeDisabled: {
				title: 'El Modo de juego esta apagado',
				finding: 'El Modo de juego de Windows esta desactivado.',
				advice: 'El Modo de juego limita el trabajo en segundo plano mientras un juego tiene el foco.',
			},
			staleDriver: {
				title: 'El controlador de graficos esta desactualizado',
				finding: '{{model}} usa el controlador {{version}}, que tiene {{days}} dias.',
				advice:
					'Los controladores de graficos traen correcciones y mejoras cada mes. Instala el actual desde el fabricante.',
			},
			noController: {
				title: 'No se detecto adaptador de graficos',
				finding: 'rux no pudo leer ningun adaptador de graficos en este sistema.',
				advice: 'Es lo esperado dentro de algunas maquinas virtuales y sesiones remotas.',
			},
		},
		display: {
			refreshBelowMaximum: {
				title: 'Una pantalla esta por debajo de su frecuencia maxima',
				finding: '{{display}} esta en {{current}} Hz pero admite {{maximum}} Hz.',
				advice: 'Subir la frecuencia hace todo el movimiento visiblemente mas fluido sin costo alguno.',
			},
			nonNativeResolution: {
				title: 'Una pantalla no esta en su resolucion nativa',
				finding: '{{display}} esta en {{current}} pero su panel es {{native}}.',
				advice:
					'Una resolucion no nativa la escala el panel y se ve borrosa. Usa la nativa con escalado DPI.',
			},
			lowColorDepth: {
				title: 'Una pantalla usa profundidad de color reducida',
				finding: '{{display}} esta en color de {{depth}} bits.',
				advice: 'Configura color de 32 bits para evitar bandas visibles en los degradados.',
			},
		},
		driver: {
			devicesInError: {
				title: 'Hay dispositivos con errores de controlador',
				finding: '{{count}} dispositivos reportan un codigo de error del Administrador de dispositivos.',
				advice:
					'Esos dispositivos no estan funcionando. Reinstala o actualiza sus controladores, empezando por el paquete del fabricante.',
			},
			devicesDegraded: {
				title: 'Hay dispositivos con advertencias de controlador',
				finding: '{{count}} dispositivos reportan un problema no fatal del Administrador de dispositivos.',
				advice: 'Suelen resolverse reinstalando el controlador o reconectando el dispositivo.',
			},
			staleCritical: {
				title: 'Controladores centrales sin actualizar en anos',
				finding: '{{count}} controladores de componentes centrales tienen mas de tres anos.',
				advice: 'Revisa las actualizaciones opcionales de Windows Update y luego el sitio del fabricante.',
			},
			unsigned: {
				title: 'Hay controladores sin firmar instalados',
				finding: '{{count}} controladores instalados no estan firmados digitalmente.',
				advice:
					'Un controlador sin firmar corre en el kernel sin origen verificado. Reemplazalos por paquetes firmados.',
			},
			allHealthy: {
				title: 'Todos los dispositivos reportan controladores sanos',
				finding: 'Los {{count}} dispositivos revisados reportan un controlador firmado y funcionando.',
				advice: 'No hay nada que hacer aqui.',
			},
		},
		wsl: {
			version1Only: {
				title: 'Solo hay distribuciones WSL 1 instaladas',
				finding: 'Todas las distribuciones instaladas corren en WSL 1, que no tiene un kernel Linux real.',
				advice:
					'WSL 2 trae kernel real, compatibilidad completa de llamadas al sistema y acceso a GPU. Convierte con "wsl --set-version <nombre> 2".',
			},
			noConfig: {
				title: 'WSL esta corriendo solo con valores por defecto',
				finding:
					'No existe .wslconfig, asi que WSL 2 puede tomar hasta {{defaultMemory}} GB de memoria y los {{cores}} procesadores logicos.',
				advice:
					'Crea un .wslconfig con limites explicitos de memoria y procesadores para que la VM de Linux no ahogue a Windows bajo carga.',
			},
			memoryTooLow: {
				title: 'El limite de memoria de WSL es muy bajo',
				finding: 'WSL esta limitado a {{limit}} GB de memoria.',
				advice:
					'Los servidores de lenguaje, compiladores y contenedores necesitan margen. Sube el limite a 4 GB como minimo, u 8 GB si usas contenedores.',
			},
			memoryStarvesHost: {
				title: 'El limite de memoria de WSL deja muy poco a Windows',
				finding: 'WSL puede tomar {{limit}} GB de los {{host}} GB instalados, dejando a Windows corto.',
				advice:
					'Reserva al menos 8 GB para Windows; si no, el host pagina a disco mientras la VM de Linux esta ociosa.',
			},
			processorsTooLow: {
				title: 'WSL tiene muy pocos procesadores asignados',
				finding: 'WSL esta limitado a {{assigned}} procesadores mientras el equipo tiene {{host}}.',
				advice:
					'Las compilaciones en paralelo se serializan con ese limite. Asigna entre la mitad y tres cuartos de los procesadores del equipo.',
			},
			processorsAllCores: {
				title: 'WSL tiene asignados todos los procesadores',
				finding: 'WSL puede usar los {{assigned}} procesadores de los {{host}} del equipo.',
				advice:
					'Dejar uno o dos procesadores a Windows mantiene el escritorio con respuesta durante compilaciones largas en Linux.',
			},
			swapDisabled: {
				title: 'El swap de WSL esta desactivado',
				finding: 'El swap esta en 0 mientras el limite de memoria es modesto.',
				advice:
					'Un archivo de swap pequeno evita que el asesino por falta de memoria de Linux mate compilaciones en los picos.',
			},
			gpuDisabled: {
				title: 'El acceso a GPU esta desactivado en WSL',
				finding: 'gpuSupport esta apagado en .wslconfig.',
				advice: 'Activarlo da a las cargas CUDA, ROCm y OpenGL dentro de Linux acceso directo a la GPU.',
			},
			nestedVirtualizationDisabled: {
				title: 'La virtualizacion anidada esta desactivada en WSL',
				finding: 'El equipo soporta virtualizacion pero nestedVirtualization esta apagado.',
				advice:
					'Activala para correr maquinas virtuales, KVM o contenedores anidados dentro de la distribucion.',
			},
			sparseVhdOff: {
				title: 'Los discos virtuales de WSL no se reducen solos',
				finding:
					'sparseVhd no esta activado, asi que el disco virtual de WSL retiene el espacio despues de borrar archivos.',
				advice: 'Activar sparseVhd permite que el disco virtual devuelva a Windows el espacio liberado.',
			},
			virtualizationOff: {
				title: 'La virtualizacion por hardware esta desactivada, WSL 2 no puede correr',
				finding: 'WSL 2 requiere extensiones de virtualizacion y el firmware las reporta como desactivadas.',
				advice: 'Activa VT-x o AMD-V en el firmware. Sin eso, WSL 2 no arranca.',
			},
		},
		system: {
			secureBootOff: {
				title: 'El Arranque seguro esta desactivado',
				finding: 'El firmware reporta el Arranque seguro como desactivado.',
				advice:
					'El Arranque seguro bloquea codigo de arranque sin firmar. Activalo en el firmware salvo que alguna herramienta que uses lo impida.',
			},
			virtualizationOff: {
				title: 'La virtualizacion por hardware esta desactivada',
				finding: 'El procesador reporta el soporte de virtualizacion como desactivado en el firmware.',
				advice:
					'Activa VT-x o AMD-V en el firmware para correr contenedores, emuladores y maquinas virtuales a toda velocidad.',
			},
			memoryPressure: {
				title: 'Queda poca memoria libre',
				finding: 'Solo esta disponible el {{percent}} por ciento de la memoria del sistema.',
				advice: 'Cierra aplicaciones que no uses, o reduce lo que arranca con Windows.',
			},
			powerSaverPlan: {
				title: 'Hay un plan de ahorro de energia activo',
				finding: 'El plan de energia activo es "{{plan}}".',
				advice:
					'El ahorro de energia limita las frecuencias del procesador y la GPU. Cambia a Equilibrado o Alto rendimiento cuando estes conectado.',
			},
		},
	},

	actions: {
		graphicsSettings: 'Configuracion > Sistema > Pantalla > Graficos',
		advancedDisplaySettings: 'Configuracion > Sistema > Pantalla > Pantalla avanzada',
		displaySettings: 'Configuracion > Sistema > Pantalla',
		gameCaptureSettings: 'Configuracion > Juegos > Capturas',
		gameModeSettings: 'Configuracion > Juegos > Modo de juego',
		deviceManager: 'Administrador de dispositivos',
		windowsUpdateOptional: 'Configuracion > Windows Update > Opciones avanzadas > Actualizaciones opcionales',
		firmwareSettings: 'Configuracion del firmware (UEFI/BIOS)',
		powerSettings: 'Configuracion > Sistema > Energia y bateria',
		vendorDriverPage: 'La pagina de descargas del fabricante de la GPU',
		ruxStartup: 'La vista de inicio de rux',
		terminal: 'Una terminal',
		wslConfigFile: 'El archivo .wslconfig en tu perfil de usuario',
	},

	backups: {
		title: 'Respaldos',
		empty: 'No hay respaldos. rux crea uno cada vez que elimina algo.',
		item: '{{id}}  {{count}} elementos  {{date}}',
		restoreHint: 'Restaura uno con: rux restore <id>',
		restored: 'Se restauraron {{count}}.',
		restoreFailed: '{{count}} fallaron.',
		purged: 'Se elimino el respaldo {{id}}.',
		needsId: 'Hace falta un id de respaldo. Ejecuta "rux backups" para listarlos.',
	},

	keys: {
		title: 'Teclas',
		switchView: 'cambiar de vista',
		move: 'mover la seleccion',
		firstLast: 'ir al primero / ultimo',
		search: 'buscar (Esc limpia, Enter mantiene)',
		filter: 'rotar filtro',
		sort: 'rotar orden',
		toggleEntry: 'activar o desactivar la entrada',
		removeEntry: 'eliminar la entrada de forma permanente',
		select: 'seleccionar o quitar seleccion',
		selectSafe: 'seleccionar todo lo seguro',
		selectAll: 'seleccionar todo, incluido lo de revisar',
		selectNone: 'limpiar la seleccion',
		apply: 'aplicar a lo seleccionado',
		rescan: 'volver a analizar',
		deepScan: 'alternar analisis profundo',
		includeTasks: 'incluir o quitar tareas programadas',
		language: 'cambiar de idioma',
		help: 'mostrar u ocultar esta ayuda',
		quit: 'salir',
	},

	cli: {
		description: 'Inspector y limpiador de sistema para Windows',
		platformError: 'rux solo funciona en Windows.',
		ttyError: 'rux necesita una terminal interactiva. Usa --list o --json cuando redirijas la salida.',
		dryRunHeader: 'Simulacion - no se va a cambiar nada. Se eliminarian {{count}} elementos:',
		dryRunElevated: '{{count}} de ellos son a nivel de equipo y necesitarian permisos de administrador.',
		removeHint: 'Ejecuta con --yes para eliminar los seguros (cada uno se respalda primero).',
		cleanHint: 'Ejecuta con --yes para limpiar los seguros.',
		safeCount: '{{count}} seguros',
		reviewCount: '{{count}} para revisar',
	},
};
