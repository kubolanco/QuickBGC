document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");
    form.addEventListener("submit", event => {
        event.preventDefault();
        handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

// small delay helper (prevents rate-limit)
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// safely fetch via worker
async function fetchFromWorker(url) {
    const fullUrl = `${WORKER_URL}${encodeURIComponent(url)}`;
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`Failed fetch: ${url}`);
    return await response.json();
}

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!usernameOrId || !reason) return;

    try {
        if (platform.toLowerCase() === "roblox") {
            const userData = await getRobloxUserData(usernameOrId);
            if (userData) showResultModal(userData, reason, platform);
        } else {
            alert("Only Roblox checks are supported for now.");
        }
    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
        showResultModal({ error: "Failed to fetch data." }, reason, platform);
    }
}

async function getRobloxUserData(input) {
    let userId = input;

    // Resolve username → ID if needed
    if (isNaN(input)) {
        const searchData = await fetchFromWorker(
            `https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`
        );
        if (!searchData.data || searchData.data.length === 0) return null;
        userId = searchData.data[0].id;
    }

    await sleep(200);
    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);

    await sleep(200);
    const avatarData = await fetchFromWorker(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );

    await sleep(200);
    let groups = [];
    try {
        const groupsData = await fetchFromWorker(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );
        groups = groupsData.data
            ? groupsData.data.map(g => `${g.group.name} (${g.role.name})`)
            : [];
    } catch {
        groups = ["Unavailable"];
    }

    await sleep(200);
    let badges = [];
    try {
        const badgesData = await fetchFromWorker(
            `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
        );
        badges = badgesData.data
            ? badgesData.data.map(b => b.name)
            : [];
    } catch {
        badges = ["Unavailable"];
    }

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: userData.created,
        banned: userData.isBanned,
        avatar: avatarData.data?.[0]?.imageUrl || "",
        groups,
        badges
    };
}

// show Bootstrap modal
function showResultModal(user, reason, platform) {
    // create modal container if it doesn’t exist
    let modalEl = document.getElementById("resultModal");
    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.className = "modal fade";
        modalEl.id = "resultModal";
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">⚠ WARNING: This tool can be inaccurate.</h5>
                    <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
                </div>
                <div class="modal-body" id="modalBody"></div>
            </div>
        </div>`;
        document.body.appendChild(modalEl);
    }

    const body = document.getElementById("modalBody");

    if (user.error) {
        body.innerHTML = `<p class="text-danger">${user.error}</p>`;
    } else {
        const date = new Date(user.created).toLocaleString();
        const groupsHTML = user.groups.length ? user.groups.map(g => `<li>${g}</li>`).join("") : "<li>None</li>";
        const badgesHTML = user.badges.length ? user.badges.map(b => `<li>${b}</li>`).join("") : "<li>None</li>";

        body.innerHTML = `
            <div class="text-center mb-3">
                <img src="${user.avatar}" alt="Avatar" class="rounded-circle shadow-sm" width="120" height="120">
            </div>
            <h5 class="text-center mb-3">${platform} Background Check Report</h5>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Display Name:</strong> ${user.displayName}</p>
            <p><strong>Created:</strong> ${date}</p>
            <p><strong>Banned:</strong> ${user.banned}</p>
            <hr>
            <h6>Groups (${user.groups.length}):</h6>
            <ul>${groupsHTML}</ul>
            <hr>
            <h6>Badges (${user.badges.length}):</h6>
            <ul>${badgesHTML}</ul>
        `;
    }

    // show modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}
