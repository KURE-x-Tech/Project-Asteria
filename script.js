const REPO_NAME = "Speading-Codes";
const dashboard = document.getElementById("github-dashboard");
const teamMembers = document.getElementById("team-members");
const teamCollaborators = document.getElementById("team-collaborators");
const latestWorkPath =
	window.siteConfig?.latestWorkPath || "./data/latest-work.json";
const teamMembersPath =
	window.siteConfig?.teamMembersPath || "./data/team-members.json";

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

	article.className = "repo-card";
	copy.className = "repo-copy";
	titleRow.className = "repo-title-row";
	title.className = "repo-title";
	meta.className = "repo-meta";
	description.className = "repo-description";
	updated.className = "repo-updated";
	links.className = "repo-links";

	title.textContent = repo.name || REPO_NAME;
	meta.textContent = workflow
		? `Latest workflow: ${workflow.name} · ${workflow.status} · ${workflow.conclusion || "in progress"}`
		: "No workflow run data available yet.";
	description.textContent =
		repo.description || "No repository description available.";
	updated.textContent = `Last updated ${formatDate(workflow?.updatedAt || repo.updatedAt || payload.generatedAt)}`;

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

		const payload = await response.json();

		if (!payload?.repo || payload.repo.name !== REPO_NAME) {
			throw new Error(
				"Latest work payload is missing the Speading-Codes repository.",
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

loadTeamMembers();
loadDashboard();
setInterval(loadDashboard, 60000);
