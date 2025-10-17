document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchFromWorker(url) {
    const res = await fetch(`${WORKER_URL}${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Failed fetch: ${url}`);
    return await res.json();
}

async function getRobloxUserData(input) {
    let userId = input;

    // Resolve username to userId
    if (isNaN(input)) {
        const search = await fetchFromWorker(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`);
        if (!search.data || search.data.length === 0) throw new Error("User not found");
        userId = search.data[0].id;
        await sleep(200);
    }

    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);
    await sleep(200);

    // Avatar
    let avatarUrl = null;
    try {
        const avatarData = await fetchFromWorker(
            `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=100x100&format=png`
        );
        if (avatarData.data && avatarData.data[0]) avatarUrl = avatarData.data[0].imageUrl;
        await sleep(200);
    } catch { }

    // Badges
    let badges = [];
    try {
        const badgeData = await fetchFromWorker(`https://badges.roblox.com/v1/users/${userId}/badges?limit=10`);
        if (badgeData.data) badges = badgeData.data.map(b => b.name);
        await sleep(200);
    } catch { }

    // Groups
    let groups = [];
    try {
        const groupData = await fetchFromWorker(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        if (groupData.data) groups = groupData.data.map(g => g.group.name);
        await sleep(200);
    } catch { }

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: new Date(userData.created).toLocaleString(),
        banned: userData.isBanned,
        avatar: avatarUrl,
        badges,
        groups
    };
}

async function handleBGCFormSubmit() {
    const username = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!username || !reason) return;

    try {
        const data = await getRobloxUserData(username);
        displayResultModal(data, reason, platform);
    } catch (err) {
        console.error("[ERROR]", err);
        displayErrorModal("Failed to fetch user data. Please try again later.");
    }
}

function displayResultModal(data, reason, platform) {
    const modalHtml = `
    <div class="modal fade show" style="display:block; background:rgba(0,0,0,0.6);" id="customModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border border-danger border-2">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">⚠️ WARNING: This tool can be inaccurate.</h5>
            <button type="button" class="btn-close" id="closeModalBtn"></button>
          </div>
          <div class="modal-body">
            <h4 class="mb-3">${platform} Background Check Report</h4>
            ${data.avatar ? `<img src="${data.avatar}" class="rounded mb-3" style="width:80px;height:80px;">` : ""}
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>ID:</strong> ${data.id}</p>
            <p><strong>Username:</strong> ${data.username}</p>
            <p><strong>Display Name:</strong> ${data.displayName}</p>
            <p><strong>Created:</strong> ${data.created}</p>
            <p><strong>Banned:</strong> ${data.banned}</p>
            <p><strong>Badges:</strong> ${data.badges.length ? data.badges.join(", ") : "None"}</p>
            <p><strong>Groups:</strong> ${data.groups.length ? data.groups.join(", ") : "None"}</p>
          </div>
          <div class="modal-footer">
            <button type="button" id="closeModalFooterBtn" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("customModal");
    document.getElementById("closeModalBtn").addEventListener("click", () => modal.remove());
    document.getElementById("closeModalFooterBtn").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}

function displayErrorModal(message) {
    const modalHtml = `
    <div class="modal fade show" style="display:block; background:rgba(0,0,0,0.6);" id="errorModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border border-danger border-2">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">Error</h5>
            <button type="button" class="btn-close" id="closeErrorBtn"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" id="closeErrorFooterBtn" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("errorModal");
    document.getElementById("closeErrorBtn").addEventListener("click", () => modal.remove());
    document.getElementById("closeErrorFooterBtn").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}
