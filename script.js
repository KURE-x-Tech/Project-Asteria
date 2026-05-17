const REPO_NAME = "Speading-Codes";
const dashboard = document.getElementById("github-dashboard");
const teamMembers = document.getElementById("team-members");
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
	link.textContent = label;

	return link;
}

function normalizeTeamMembers(payload) {
	if (Array.isArray(payload?.members)) {
		return payload.members;
	}

	if (payload && typeof payload === "object") {
		return Object.entries(payload).map(([name, member]) => ({
			name,
			role: member.role,
			roleLabel: member.roleLabel,
			imageUrl: member.imageUrl,
			links: {
				github: member.githubUrl,
				linkedin: member.linkedinUrl,
			},
		}));
	}

	return [];
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

function createTeamCard(member) {
	const name = member.name;
	const githubUrl = member.links?.github;
	const linkedinUrl = member.links?.linkedin;
	const article = document.createElement("article");
	const image = document.createElement("img");
	const summary = document.createElement("div");
	const title = document.createElement("h3");
	const role = document.createElement("p");
	const actions = document.createElement("div");

	article.className = "personcard";
	image.className = "profilepic";
	image.src = member.imageUrl || createAvatarUrl(name);
	image.alt = `${name} profile photo`;
	image.title = `${name} profile photo`;

	summary.className = "person-summary";
	title.className = "personname";
	title.textContent = name;
	role.className = "teamrole";
	role.textContent = member.role;
	role.setAttribute(
		"aria-label",
		member.roleLabel || member.role.toLowerCase(),
	);

	actions.className = "person-actions";

	if (githubUrl) {
		actions.appendChild(
			createExternalLink(
				githubUrl,
				"GitHub",
				`Open ${name} GitHub profile`,
				"personlink",
			),
		);
	}

	if (linkedinUrl) {
		actions.appendChild(
			createExternalLink(
				linkedinUrl,
				"LinkedIn",
				`Open ${name} LinkedIn profile`,
				"personlink",
			),
		);
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

function renderTeamMessage(message) {
	if (!teamMembers) {
		return;
	}

	const paragraph = document.createElement("p");

	paragraph.className = "team-message";
	paragraph.textContent = message;
	teamMembers.replaceChildren(paragraph);
}

async function loadTeamMembers() {
	if (!teamMembers) {
		return;
	}

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
		const members = normalizeTeamMembers(payload);

		if (!members.length) {
			throw new Error(
				"No team members found in data payload.",
			);
		}

		const cards = members.map((member) => createTeamCard(member));

		teamMembers.replaceChildren(...cards);
	} catch (error) {
		renderTeamMessage(
			"Team members are temporarily unavailable. Update data/team-members.json to refresh this section.",
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
