const REPO_NAME = "Spreading-Codes";
const dashboard = document.getElementById("github-dashboard");
const teamMembers = document.getElementById("team-members");
const teamCollaborators = document.getElementById("team-collaborators");
const roadmapIntro = document.getElementById("roadmap-intro");
const roadmapMermaid = document.getElementById("roadmap-mermaid");
const roadmapCurrent = document.getElementById("roadmap-current");
const roadmapNav = document.getElementById("roadmap-nav");
const roadmapDetails = document.getElementById("roadmap-details");
const latestWorkPath =
	window.siteConfig?.latestWorkPath || "./data/latest-work.json";
const teamMembersPath =
	window.siteConfig?.teamMembersPath || "./data/team-members.json";
const roadmapPath = window.siteConfig?.roadmapPath || "./data/roadmap.json";

let roadmapState = null;

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

loadRoadmap();
loadTeamMembers();
loadDashboard();
setInterval(loadDashboard, 60000);
