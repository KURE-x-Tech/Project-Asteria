const ORG_NAME = "KURE-x-Tech";

const dashboard =
  document.getElementById(
    "github-dashboard"
  );

async function fetchRepos(){

  const response =
    await fetch(
      `https://api.github.com/orgs/${ORG_NAME}/repos`
    );

  return await response.json();
}

async function fetchLatestWorkflow(repoName){

  const response =
    await fetch(
      `https://api.github.com/repos/${ORG_NAME}/${repoName}/actions/runs`
    );

  return await response.json();
}

function createRepoCard(repo, workflow){

  const latest =
    workflow.workflow_runs?.[0];

  const card =
    document.createElement("article");

  card.className = "repo-card";

  if(!latest){

    card.innerHTML = `
      <h2>${repo.name}</h2>

      <p>No workflow runs found.</p>

      <a href="${repo.html_url}" target="_blank">
        View Repository
      </a>
    `;

    return card;
  }

  card.innerHTML = `
    <h2>${repo.name}</h2>

    <p>
      Workflow:
      ${latest.name}
    </p>

    <p>
      Status:
      ${latest.status}
    </p>

    <p>
      Conclusion:
      ${latest.conclusion || "In Progress"}
    </p>

    <p>
      Branch:
      ${latest.head_branch}
    </p>

    <a
      href="${latest.html_url}"
      target="_blank"
    >
      View Workflow Run
    </a>
  `;

  return card;
}

async function loadDashboard(){

  dashboard.innerHTML = "";

  try{

    const repos =
      await fetchRepos();

    for(const repo of repos){

      const workflow =
        await fetchLatestWorkflow(
          repo.name
        );

      const card =
        createRepoCard(
          repo,
          workflow
        );

      dashboard.appendChild(card);
    }

  }catch(error){

    dashboard.innerHTML = `
      <p>
        Failed to load dashboard.
      </p>
    `;

    console.error(error);
  }
}

loadDashboard();

/* Optional auto refresh */
setInterval(
  loadDashboard,
  60000
);