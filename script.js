const REPO_NAME = "Spreading-Codes";
const dashboard = document.getElementById("github-dashboard");
const teamMembers = document.getElementById("team-members");
const teamCollaborators = document.getElementById("team-collaborators");
const roadmapIntro = document.getElementById("roadmap-intro");
const roadmapMermaid = document.getElementById("roadmap-mermaid");
const roadmapCurrent = document.getElementById("roadmap-current");
const roadmapNav = document.getElementById("roadmap-nav");
const roadmapDetails = document.getElementById("roadmap-details");
const heroStarsCanvas = document.getElementById("hero-stars");
const heroCopy = document.querySelector(".hero-copy");
const latestWorkPath =
	window.siteConfig?.latestWorkPath || "./data/latest-work.json";
const teamMembersPath =
	window.siteConfig?.teamMembersPath || "./data/team-members.json";
const roadmapPath = window.siteConfig?.roadmapPath || "./data/roadmap.json";
const HERO_STARS_MAX_DPR = 1.75;
const HERO_STARS_SEED = 28411;
const HERO_STARS_ANIMATION_FPS = 18;
const HERO_STARS_MAX_PLACEMENT_ATTEMPTS = 20;
const SPARKLE_SVG = `
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path fill="#ffffff" d="M12 1.75L14.56 9.44L22.25 12L14.56 14.56L12 22.25L9.44 14.56L1.75 12L9.44 9.44Z"/>
	</svg>
`;
const heroStarsMotionQuery =
	window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

let roadmapState = null;
let heroStarfieldState = null;
let heroStarfieldFrame = 0;
let heroStarfieldAnimationFrame = 0;

const sparkleSprite = new Image();

sparkleSprite.decoding = "async";
sparkleSprite.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
	SPARKLE_SVG,
)}`;

function clampNumber(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function createSeededRandom(seed) {
	let state = seed >>> 0;

	return () => {
		state += 0x6d2b79f5;
		let result = Math.imul(state ^ (state >>> 15), 1 | state);

		result ^=
			result +
			Math.imul(result ^ (result >>> 7), 61 | result);

		return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
	};
}

function readCanvasNumber(canvas, datasetKey, fallback, min, max) {
	const value = Number(canvas.dataset[datasetKey]);

	if (!Number.isFinite(value)) {
		return fallback;
	}

	return clampNumber(value, min, max);
}

function getHeroQuietZone(canvas) {
	if (!heroCopy) {
		return null;
	}

	const canvasRect = canvas.getBoundingClientRect();
	const copyRect = heroCopy.getBoundingClientRect();

	if (
		!canvasRect.width ||
		!canvasRect.height ||
		!copyRect.width ||
		!copyRect.height
	) {
		return null;
	}

	const paddingX = 56;
	const paddingTop = 40;
	const paddingBottom = 72;

	return {
		left: Math.max(0, copyRect.left - canvasRect.left - paddingX),
		right: Math.min(
			canvasRect.width,
			copyRect.right - canvasRect.left + paddingX,
		),
		top: Math.max(0, copyRect.top - canvasRect.top - paddingTop),
		bottom: Math.min(
			canvasRect.height,
			copyRect.bottom - canvasRect.top + paddingBottom,
		),
	};
}

function isInsideQuietZone(x, y, quietZone) {
	if (!quietZone) {
		return false;
	}

	return (
		x >= quietZone.left &&
		x <= quietZone.right &&
		y >= quietZone.top &&
		y <= quietZone.bottom
	);
}

function getStarPlacementWeight(x, y, width, height, quietZone) {
	const xRatio = width ? x / width : 0;
	const yRatio = height ? y / height : 0;
	const topBias = 1 - yRatio;
	let weight = 0.6 + topBias * 0.7;

	if (xRatio < 0.2 || xRatio > 0.8) {
		weight += 0.18;
	}

	if (isInsideQuietZone(x, y, quietZone)) {
		weight *= 0.07;
	}

	return clampNumber(weight, 0.04, 0.98);
}

function selectStarPosition(random, canvas, quietZone) {
	const rect = canvas.getBoundingClientRect();
	const width = rect.width || window.innerWidth || 1;
	const height = rect.height || window.innerHeight || 1;
	let bestCandidate = {
		xRatio: clampNumber(random(), 0.02, 0.98),
		yRatio: clampNumber(random(), 0.03, 0.97),
		weight: 0,
	};

	for (
		let attempt = 0;
		attempt < HERO_STARS_MAX_PLACEMENT_ATTEMPTS;
		attempt += 1
	) {
		const xRatio = clampNumber(random(), 0.02, 0.98);
		const yRatio = clampNumber(random(), 0.03, 0.97);
		const x = xRatio * width;
		const y = yRatio * height;
		const weight = getStarPlacementWeight(
			x,
			y,
			width,
			height,
			quietZone,
		);

		if (weight > bestCandidate.weight) {
			bestCandidate = { xRatio, yRatio, weight };
		}

		if (random() <= weight) {
			return { xRatio, yRatio };
		}
	}

	return {
		xRatio: bestCandidate.xRatio,
		yRatio: bestCandidate.yRatio,
	};
}

function buildHeroStars(canvas) {
	const count = Math.round(
		readCanvasNumber(canvas, "starCount", 75, 0, 200),
	);
	const minSize = readCanvasNumber(canvas, "starMinSize", 2, 1, 24);
	const maxSize = readCanvasNumber(
		canvas,
		"starMaxSize",
		10,
		minSize,
		30,
	);
	const minOpacity = readCanvasNumber(
		canvas,
		"starMinOpacity",
		0.3,
		0.05,
		0.5,
	);
	const maxOpacity = readCanvasNumber(
		canvas,
		"starMaxOpacity",
		0.8,
		minOpacity,
		1,
	);
	const quietZone = getHeroQuietZone(canvas);
	const random = createSeededRandom(HERO_STARS_SEED + count);

	return Array.from({ length: count }, (_, index) => {
		const position = selectStarPosition(random, canvas, quietZone);
		const baseOpacity =
			minOpacity + random() * (maxOpacity - minOpacity);
		const minTwinkleOpacity = clampNumber(
			baseOpacity * (0.4 + random() * 0.18),
			0.08,
			maxOpacity,
		);
		const maxTwinkleOpacity = clampNumber(
			baseOpacity + 0.16 + random() * 0.22,
			minTwinkleOpacity + 0.08,
			1,
		);

		return {
			xRatio: position.xRatio,
			yRatio: position.yRatio,
			size: minSize + random() * (maxSize - minSize),
			opacity: baseOpacity,
			minOpacity,
			maxOpacity,
			minTwinkleOpacity,
			maxTwinkleOpacity,
			twinkleRange: 0.22 + random() * 0.24,
			twinklePhase: random() * Math.PI * 2,
			twinkleSpeed: 0.0018,
			// pulseScale: 0.88 + random() * 0.38,
			pulseDrift: 0.0008 + random() * 0.0014,
			shimmerOffset: random() * Math.PI * 2 + index * 0.35,
			rotation: random() * Math.PI,
		};
	});
}

function drawHeroStars(timestamp = 0) {
	if (
		!heroStarfieldState ||
		!sparkleSprite.complete ||
		!sparkleSprite.naturalWidth
	) {
		return;
	}

	const { canvas, context, stars } = heroStarfieldState;
	const rect = canvas.getBoundingClientRect();

	if (!rect.width || !rect.height) {
		return;
	}

	const dpr = Math.min(window.devicePixelRatio || 1, HERO_STARS_MAX_DPR);
	const width = Math.round(rect.width * dpr);
	const height = Math.round(rect.height * dpr);

	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}

	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.scale(dpr, dpr);
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";

	for (const star of stars) {
		const x = star.xRatio * rect.width;
		const y = star.yRatio * rect.height;
		const primaryPulse =
			(Math.sin(
				timestamp * star.twinkleSpeed +
					star.twinklePhase,
			) +
				1) /
			2;
		const secondaryPulse =
			(Math.sin(
				timestamp * star.pulseDrift +
					star.shimmerOffset,
			) +
				1) /
			2;
		const twinkleMix = clampNumber(
			primaryPulse * 0.72 + secondaryPulse * 0.28,
			0,
			1,
		);
		const opacity =
			star.minTwinkleOpacity +
			(star.maxTwinkleOpacity - star.minTwinkleOpacity) *
				twinkleMix;
		const scale = 0.82;
		const size = star.size * scale;

		context.save();
		context.translate(x, y);
		context.rotate(star.rotation);
		context.globalAlpha = opacity;
		context.drawImage(
			sparkleSprite,
			-size / 2,
			-size / 2,
			size,
			size,
		);
		context.restore();
	}
	context.globalAlpha = 1;
}

function stopHeroStarsAnimation() {
	if (!heroStarfieldAnimationFrame) {
		return;
	}

	window.cancelAnimationFrame(heroStarfieldAnimationFrame);
	heroStarfieldAnimationFrame = 0;
}

function animateHeroStars(timestamp) {
	if (!heroStarfieldState || heroStarfieldState.isReducedMotion) {
		heroStarfieldAnimationFrame = 0;
		return;
	}

	if (
		!heroStarfieldState.lastFrameTime ||
		timestamp - heroStarfieldState.lastFrameTime >=
			1000 / HERO_STARS_ANIMATION_FPS
	) {
		heroStarfieldState.lastFrameTime = timestamp;
		drawHeroStars(timestamp);
	}

	heroStarfieldAnimationFrame =
		window.requestAnimationFrame(animateHeroStars);
}

function startHeroStarsAnimation() {
	if (
		!heroStarfieldState ||
		heroStarfieldState.isReducedMotion ||
		document.hidden ||
		heroStarfieldAnimationFrame
	) {
		return;
	}

	heroStarfieldState.lastFrameTime = 0;
	heroStarfieldAnimationFrame =
		window.requestAnimationFrame(animateHeroStars);
}

function scheduleHeroStarsRender() {
	if (!heroStarfieldState) {
		return;
	}

	if (heroStarfieldFrame) {
		window.cancelAnimationFrame(heroStarfieldFrame);
	}

	heroStarfieldFrame = window.requestAnimationFrame(() => {
		heroStarfieldFrame = 0;
		drawHeroStars(performance.now());
	});
}

function syncHeroStarsMotionPreference() {
	if (!heroStarfieldState) {
		return;
	}

	heroStarfieldState.isReducedMotion = Boolean(
		heroStarsMotionQuery?.matches,
	);

	if (heroStarfieldState.isReducedMotion) {
		stopHeroStarsAnimation();
		scheduleHeroStarsRender();
		return;
	}

	startHeroStarsAnimation();
}

function handleHeroStarsResize() {
	if (!heroStarfieldState) {
		return;
	}

	heroStarfieldState.stars = buildHeroStars(heroStarsCanvas);
	scheduleHeroStarsRender();
}

function handleHeroStarsVisibilityChange() {
	if (!heroStarfieldState) {
		return;
	}

	if (document.hidden) {
		stopHeroStarsAnimation();
		return;
	}

	handleHeroStarsResize();
	startHeroStarsAnimation();
}

function initializeHeroStars() {
	if (!heroStarsCanvas) {
		return;
	}

	const context = heroStarsCanvas.getContext("2d", {
		alpha: true,
		desynchronized: true,
	});

	if (!context) {
		return;
	}

	heroStarfieldState = {
		canvas: heroStarsCanvas,
		context,
		stars: buildHeroStars(heroStarsCanvas),
		isReducedMotion: Boolean(heroStarsMotionQuery?.matches),
		lastFrameTime: 0,
	};

	if ("ResizeObserver" in window) {
		const observer = new ResizeObserver(() => {
			handleHeroStarsResize();
		});

		observer.observe(heroStarsCanvas);

		if (heroCopy) {
			observer.observe(heroCopy);
		}

		heroStarfieldState.observer = observer;
	} else {
		window.addEventListener("resize", handleHeroStarsResize, {
			passive: true,
		});
	}

	document.addEventListener(
		"visibilitychange",
		handleHeroStarsVisibilityChange,
	);

	if (heroStarsMotionQuery) {
		heroStarsMotionQuery.addEventListener?.(
			"change",
			syncHeroStarsMotionPreference,
		);
	}

	if (sparkleSprite.complete && sparkleSprite.naturalWidth) {
		scheduleHeroStarsRender();
		startHeroStarsAnimation();
		return;
	}

	sparkleSprite.addEventListener(
		"load",
		() => {
			scheduleHeroStarsRender();
			startHeroStarsAnimation();
		},
		{ once: true },
	);
}

function formatDate(value) {
	if (!value) {
		return "Date unavailable";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "Date unavailable";
	}

	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
}

function createAvatarUrl(name) {
	return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10131d&color=e4e5ee`;
}

function createExternalLink(href, label, title, className) {
	const link = document.createElement("a");

	link.className = className;
	link.href = href;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.title = title;

	if (label) {
		link.textContent = label;
	}

	return link;
}

function createIconImage(label, src) {
	const image = document.createElement("img");

	image.className = "social-icon";
	image.src = src;
	image.alt = `${label} icon`;
	image.title = `${label} icon`;

	return image;
}

function normalizeTeamPayload(payload) {
	if (payload && Array.isArray(payload.members)) {
		return {
			members: payload.members,
			collaborators: Array.isArray(payload.collaborators)
				? payload.collaborators
				: [],
			roles: payload.roles || {},
			roleColors: payload.roleColors || {},
			socialIcons: payload.socialIcons || {},
		};
	}

	if (payload && typeof payload === "object") {
		return {
			members: Object.entries(payload).map(
				([name, member]) => ({
					name,
					role: member.role,
					roleLabel: member.roleLabel,
					imageUrl: member.imageUrl,
					links: {
						github: member.githubUrl,
						linkedin: member.linkedinUrl,
					},
				}),
			),
			collaborators: [],
			roles: {},
			roleColors: {},
			socialIcons: {},
		};
	}

	return {
		members: [],
		collaborators: [],
		roles: {},
		roleColors: {},
		socialIcons: {},
	};
}

function normalizeLatestWork(payload) {
	const repo = payload?.repo;

	if (!repo) {
		return null;
	}

	const activity = Array.isArray(repo.activity)
		? repo.activity
		: repo.workflow
			? [repo.workflow]
			: [];

	return {
		generatedAt: payload.generatedAt,
		repo: {
			...repo,
			activity,
			workflow: repo.workflow || activity[0] || null,
		},
	};
}

function normalizeRoadmapPayload(payload) {
	if (!payload || !Array.isArray(payload.milestones)) {
		return null;
	}

	const milestones = payload.milestones.map((milestone, index) => ({
		...milestone,
		gateways: Array.isArray(milestone.gateways)
			? milestone.gateways
			: [],
		deliverables: Array.isArray(milestone.deliverables)
			? milestone.deliverables
			: [],
		shortLabel: milestone.shortLabel || milestone.title,
		status: milestone.status || "upcoming",
		id: milestone.id || `milestone-${index + 1}`,
	}));

	const currentMilestoneId =
		payload.currentMilestoneId || milestones[0]?.id;
	const selectedMilestoneId =
		milestones.find(
			(milestone) => milestone.id === currentMilestoneId,
		)?.id ||
		milestones[0]?.id ||
		null;

	return {
		intro: payload.intro || "",
		currentMilestoneId,
		selectedMilestoneId,
		milestones,
	};
}

function buildRoadmapDiagram(state) {
	const lines = [
		"flowchart TD",
		"classDef completed fill:#0f1421,stroke:#6d88ff,stroke-width:1.5px,color:#edf0ff;",
		"classDef current fill:#121a2b,stroke:#8da2ff,stroke-width:2.5px,color:#edf0ff;",
		"classDef next fill:#111827,stroke:#7ee7ff,stroke-width:2px,color:#edf0ff;",
		"classDef checkpoint fill:#111827,stroke:#7ee7ff,stroke-dasharray: 6 4,color:#edf0ff;",
		"classDef final fill:#171327,stroke:#c18dff,stroke-width:2px,color:#edf0ff;",
		"classDef upcoming fill:#0b0d14,stroke:#334164,stroke-width:1px,color:#c8d0f4;",
		"classDef selected stroke:#ffffff,stroke-width:3px,color:#ffffff;",
	];

	state.milestones.forEach((milestone, index) => {
		const label = `${milestone.period}<br/><b>${milestone.shortLabel}</b>`;
		lines.push(`${milestone.id}["${label}"]`);

		if (index > 0) {
			lines.push(
				`${state.milestones[index - 1].id} --> ${milestone.id}`,
			);
		}

		lines.push(`class ${milestone.id} ${milestone.status};`);

		if (milestone.id === state.selectedMilestoneId) {
			lines.push(`class ${milestone.id} selected;`);
		}

		lines.push(
			`click ${milestone.id} selectRoadmapMilestone "Open ${milestone.title}"`,
		);
	});

	return lines.join("\n");
}

async function renderRoadmapDiagram() {
	if (!roadmapMermaid || !roadmapState || !window.mermaid) {
		return;
	}

	const graphId = `roadmap-graph-${Date.now()}`;
	const graphDefinition = buildRoadmapDiagram(roadmapState);
	const renderResult = await window.mermaid.render(
		graphId,
		graphDefinition,
	);

	roadmapMermaid.innerHTML = renderResult.svg;
}

function renderRoadmapCurrent() {
	if (!roadmapCurrent || !roadmapState) {
		return;
	}

	const current = roadmapState.milestones.find(
		(milestone) => milestone.id === roadmapState.currentMilestoneId,
	);

	if (!current) {
		roadmapCurrent.innerHTML =
			'<p class="loading-copy">Current milestone unavailable.</p>';
		return;
	}

	roadmapCurrent.innerHTML = `
		<p class="group-label">You are here</p>
		<p class="roadmap-current-title">${current.title}</p>
		<p class="roadmap-current-meta">${current.period}${current.gateways.length ? ` · ${current.gateways.join(", ")}` : ""}</p>
	`;
}

function renderRoadmapNav() {
	if (!roadmapNav || !roadmapState) {
		return;
	}

	const fragment = document.createDocumentFragment();

	roadmapState.milestones.forEach((milestone) => {
		const button = document.createElement("button");

		button.type = "button";
		button.className = "roadmap-nav-item";
		button.dataset.milestoneId = milestone.id;
		button.setAttribute(
			"aria-pressed",
			String(
				milestone.id ===
					roadmapState.selectedMilestoneId,
			),
		);

		if (milestone.id === roadmapState.selectedMilestoneId) {
			button.classList.add("is-selected");
		}

		if (milestone.id === roadmapState.currentMilestoneId) {
			button.classList.add("is-current");
		}

		button.innerHTML = `
			<span class="roadmap-nav-period">${milestone.period}</span>
			<span class="roadmap-nav-title">${milestone.title}</span>
		`;

		button.addEventListener("click", () => {
			selectRoadmapMilestone(milestone.id);
		});

		fragment.appendChild(button);
	});

	roadmapNav.replaceChildren(fragment);
}

function renderRoadmapDetails() {
	if (!roadmapDetails || !roadmapState) {
		return;
	}

	const selected = roadmapState.milestones.find(
		(milestone) =>
			milestone.id === roadmapState.selectedMilestoneId,
	);

	if (!selected) {
		roadmapDetails.innerHTML =
			'<p class="loading-copy">Milestone details unavailable.</p>';
		return;
	}

	const gatewayText = selected.gateways.length
		? selected.gateways.join(" · ")
		: "Key checkpoint";
	const deliverables = selected.deliverables
		.map((item) => `<li>${item}</li>`)
		.join("");
	const hereBadge =
		selected.id === roadmapState.currentMilestoneId
			? '<span class="roadmap-badge">You are here</span>'
			: "";

	roadmapDetails.innerHTML = `
		<div class="roadmap-detail-header">
			<p class="roadmap-phase">${selected.period}</p>
			${hereBadge}
		</div>
		<h3 class="roadmap-title">${selected.title}</h3>
		<p class="roadmap-text">${selected.summary}</p>
		<p class="roadmap-detail-meta">${gatewayText}</p>
		<ul class="roadmap-deliverables">${deliverables}</ul>
	`;
}

async function renderRoadmap() {
	renderRoadmapCurrent();
	renderRoadmapNav();
	renderRoadmapDetails();
	await renderRoadmapDiagram();
}

async function selectRoadmapMilestone(id) {
	if (!roadmapState) {
		return;
	}

	roadmapState.selectedMilestoneId = id;
	await renderRoadmap();
}

window.selectRoadmapMilestone = selectRoadmapMilestone;

function createTimelineItem(item) {
	const entry = document.createElement("li");
	const link = document.createElement(item.htmlUrl ? "a" : "div");
	const top = document.createElement("div");
	const title = document.createElement("p");
	const status = document.createElement("p");
	const meta = document.createElement("p");

	entry.className = "activity-item";
	link.className = "activity-link";
	top.className = "activity-topline";
	title.className = "activity-title";
	status.className = "activity-status";
	meta.className = "activity-meta";

	if (item.htmlUrl) {
		link.href = item.htmlUrl;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.title = `Open ${item.name} workflow run`;
	}

	title.textContent = item.name || "Workflow update";
	status.textContent = `${item.status || "unknown"} · ${item.conclusion || "in progress"}`;
	meta.textContent = `${item.branch || "unknown branch"} · ${formatDate(item.updatedAt)}`;

	top.append(title, status);
	link.append(top, meta);
	entry.appendChild(link);

	return entry;
}

function createRepoCard(payload) {
	const repo = payload.repo;
	const workflow = repo.workflow;
	const article = document.createElement("article");
	const copy = document.createElement("div");
	const titleRow = document.createElement("div");
	const title = document.createElement("h3");
	const meta = document.createElement("p");
	const description = document.createElement("p");
	const updated = document.createElement("p");
	const links = document.createElement("div");
	const timelineHeader = document.createElement("p");
	const timeline = document.createElement("ol");

	article.className = "repo-card";
	copy.className = "repo-copy";
	titleRow.className = "repo-title-row";
	title.className = "repo-title";
	meta.className = "repo-meta";
	description.className = "repo-description";
	updated.className = "repo-updated";
	links.className = "repo-links";
	timelineHeader.className = "timeline-label";
	timeline.className = "activity-timeline";

	title.textContent = repo.name || REPO_NAME;
	meta.textContent = workflow
		? `Latest workflow: ${workflow.name} · ${workflow.status} · ${workflow.conclusion || "in progress"}`
		: "No workflow run data available yet.";
	description.textContent =
		repo.description || "No repository description available.";
	updated.textContent = `Last updated ${formatDate(workflow?.updatedAt || repo.updatedAt || payload.generatedAt)}`;
	timelineHeader.textContent = "Activity timeline";

	titleRow.appendChild(title);
	copy.append(titleRow, meta, description, updated);

	if (repo.htmlUrl) {
		links.appendChild(
			createExternalLink(
				repo.htmlUrl,
				"Repository",
				`Open ${repo.name} repository`,
				"repo-link",
			),
		);
	}

	if (workflow?.htmlUrl) {
		links.appendChild(
			createExternalLink(
				workflow.htmlUrl,
				"Workflow run",
				`Open latest ${repo.name} workflow run`,
				"repo-link",
			),
		);
	}

	if (repo.activity.length) {
		const items = repo.activity.map((item) =>
			createTimelineItem(item),
		);
		timeline.append(...items);
		copy.append(timelineHeader, timeline);
	}

	article.append(copy, links);

	return article;
}

function createSocialLink(name, platform, href, iconMap) {
	if (!href) {
		return null;
	}

	const label = platform === "github" ? "GitHub" : "LinkedIn";
	const link = createExternalLink(
		href,
		"",
		`Open ${name} ${label} profile`,
		"personlink",
	);
	const icon = iconMap?.[platform];
	const text = document.createElement("span");

	text.className = "personlink-label";
	text.textContent = label;

	if (icon) {
		link.appendChild(createIconImage(label, icon));
	}

	link.appendChild(text);

	return link;
}

function createTeamCard(member, teamMeta) {
	const name = member.name;
	const article = document.createElement("article");
	const image = document.createElement("img");
	const summary = document.createElement("div");
	const title = document.createElement("h3");
	const role = document.createElement("p");
	const actions = document.createElement("div");
	const roleKey = member.roleLabel || member.role.toLowerCase();
	const roleText = teamMeta.roles?.[roleKey] || member.role;
	const roleColor = teamMeta.roleColors?.[roleKey];

	article.className = "personcard";
	image.className = "profilepic";
	image.src = member.imageUrl || createAvatarUrl(name);
	image.alt = `${name} profile photo`;
	image.title = `${name} profile photo`;

	summary.className = "person-summary";
	title.className = "personname";
	title.textContent = name;
	role.className = "teamrole";
	role.textContent = roleText;
	role.setAttribute("aria-label", roleKey);

	if (roleColor && !roleKey.includes("lead")) {
		role.style.color = roleColor;
	}

	actions.className = "person-actions";

	const githubLink = createSocialLink(
		name,
		"github",
		member.links?.github,
		teamMeta.socialIcons,
	);
	const linkedinLink = createSocialLink(
		name,
		"linkedin",
		member.links?.linkedin,
		teamMeta.socialIcons,
	);

	if (githubLink) {
		actions.appendChild(githubLink);
	}

	if (linkedinLink) {
		actions.appendChild(linkedinLink);
	}

	summary.append(title, role);
	article.append(image, summary, actions);

	return article;
}

function renderDashboardMessage(message) {
	if (!dashboard) {
		return;
	}

	const paragraph = document.createElement("p");

	paragraph.className = "dashboard-message";
	paragraph.textContent = message;
	dashboard.replaceChildren(paragraph);
}

function renderTeamMessage(target, message) {
	if (!target) {
		return;
	}

	const paragraph = document.createElement("p");

	paragraph.className = "team-message";
	paragraph.textContent = message;
	target.replaceChildren(paragraph);
}

function renderTeamGroup(target, people, emptyMessage, teamMeta) {
	if (!target) {
		return;
	}

	if (!people.length) {
		renderTeamMessage(target, emptyMessage);
		return;
	}

	const cards = people.map((member) => createTeamCard(member, teamMeta));

	target.replaceChildren(...cards);
}

async function loadTeamMembers() {
	try {
		const response = await fetch(
			`${teamMembersPath}?t=${Date.now()}`,
			{
				cache: "no-store",
			},
		);

		if (!response.ok) {
			throw new Error(
				`Failed to load team members: ${response.status}`,
			);
		}

		const payload = await response.json();
		const teamMeta = normalizeTeamPayload(payload);

		renderTeamGroup(
			teamMembers,
			teamMeta.members,
			"Team members are temporarily unavailable. Update data/team-members.json to refresh this section.",
			teamMeta,
		);
		renderTeamGroup(
			teamCollaborators,
			teamMeta.collaborators,
			"No collaborators have been added yet.",
			teamMeta,
		);
	} catch (error) {
		renderTeamMessage(
			teamMembers,
			"Team members are temporarily unavailable. Update data/team-members.json to refresh this section.",
		);
		renderTeamMessage(
			teamCollaborators,
			"Collaborators are temporarily unavailable. Update data/team-members.json to refresh this section.",
		);
		console.error(error);
	}
}

async function loadRoadmap() {
	try {
		const response = await fetch(`${roadmapPath}?t=${Date.now()}`, {
			cache: "no-store",
		});

		if (!response.ok) {
			throw new Error(
				`Failed to load roadmap: ${response.status}`,
			);
		}

		const payload = await response.json();
		roadmapState = normalizeRoadmapPayload(payload);

		if (!roadmapState) {
			throw new Error("Roadmap payload is invalid.");
		}

		if (roadmapIntro) {
			roadmapIntro.textContent = roadmapState.intro;
		}

		if (window.mermaid) {
			window.mermaid.initialize({
				startOnLoad: false,
				securityLevel: "loose",
				theme: "base",
				themeVariables: {
					primaryColor: "#121a2b",
					primaryTextColor: "#edf0ff",
					primaryBorderColor: "#8da2ff",
					lineColor: "#5367a8",
					secondaryColor: "#0b0d14",
					tertiaryColor: "#07080d",
					fontFamily: "Inter, sans-serif",
				},
			});
		}

		await renderRoadmap();
	} catch (error) {
		if (roadmapIntro) {
			roadmapIntro.textContent =
				"Roadmap data is temporarily unavailable. Update data/roadmap.json to refresh this section.";
		}

		if (roadmapMermaid) {
			roadmapMermaid.innerHTML =
				'<p class="dashboard-message">Roadmap diagram unavailable.</p>';
		}

		if (roadmapCurrent) {
			roadmapCurrent.innerHTML =
				'<p class="loading-copy">Current milestone unavailable.</p>';
		}

		if (roadmapNav) {
			roadmapNav.innerHTML =
				'<p class="dashboard-message">Milestones unavailable.</p>';
		}

		if (roadmapDetails) {
			roadmapDetails.innerHTML =
				'<p class="dashboard-message">Roadmap details unavailable.</p>';
		}

		console.error(error);
	}
}

async function loadDashboard() {
	if (!dashboard) {
		return;
	}

	try {
		const response = await fetch(
			`${latestWorkPath}?t=${Date.now()}`,
			{
				cache: "no-store",
			},
		);

		if (!response.ok) {
			throw new Error(
				`Failed to load latest work: ${response.status}`,
			);
		}

		const rawPayload = await response.json();
		const payload = normalizeLatestWork(rawPayload);

		if (!payload?.repo || payload.repo.name !== REPO_NAME) {
			throw new Error(
				"Latest work payload is missing the Spreading-Codes repository.",
			);
		}

		dashboard.replaceChildren(createRepoCard(payload));
	} catch (error) {
		renderDashboardMessage(
			"Latest work is temporarily unavailable. Run the GitHub Actions sync to refresh the site data.",
		);
		console.error(error);
	}
}

initializeHeroStars();
loadRoadmap();
loadTeamMembers();
loadDashboard();
setInterval(loadDashboard, 60000);
