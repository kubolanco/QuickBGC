document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

// helper to sleep between requests
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// fetch via Worker
async function fetchFromWorker(apiUrl) {
    const res = await fetch(`${WORKER_URL}${encodeURIComponent(apiUrl)}`);
    if (!res.ok) throw new Error(`Failed fetch: ${apiUrl}`);
    return await res.json();
}

// fetch Roblox user data
async function getRobloxUserData(input) {
    let userId = input;

    // resolve username -> ID if input is not a number
    if (isNaN(input)) {
        const search = await fetchFromWorker(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=25`);
        if (!search.data || !search.data.length) throw new Error("User not found");
        userId = search.data[0].id;
        await sleep(200);
    }

    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);
    await sleep(200);

    let avatar = "";
    try {
        const avatarData = await fetchFromWorker(
            `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=100x100&format=Png&isCircular=false`
        );
        avatar = avatarData.data?.[0]?.imageUrl || "";
    } catch {}

    await sleep(200);

    let badges = [];
    try {
        const badgeData = await fetchFromWorker(`https://badges.roblox.com/v1/users/${userId}/badges?limit=100`);
        badges = badgeData.data?.map(b => b.name) || [];
    } catch {}

    await sleep(200);

    let groups = [];
    try {
        const groupData = await fetchFromWorker(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        groups = groupData.data?.map(g => g.group.name) || [];
    } catch {}

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: new Date(userData.created).toLocaleString(),
        banned: userData.isBanned,
        avatar,
        badges,
        groups
    };
}

// display result in custom modal
function displayResultModal(user, reason, platform) {
    // remove existing modal
    document.getElementById("customModal")?.remove();

    const modalHTML = `
    <div class="modal fade show" id="customModal" style="display:block; background:rgba(0,0,0,0.6); position:fixed; top:0; left:0; width:100%; height:100%; z-index:1050;">
      <div class="modal-dialog modal-dialog-centered" style="max-width:600px; margin:auto;">
        <div class="modal-content shadow-lg border border-danger border-2">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">⚠ WARNING: This tool can be inaccurate.</h5>
            <button type="button" id="closeModalBtn" class="btn-close"></button>
          </div>
          <div class="modal-body">
            ${user.avatar ? `<img src="${user.avatar}" class="rounded mb-3" style="width:80px;height:80px;">` : ""}
            <h5>${platform} Background Check Report</h5>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Display Name:</strong> ${user.displayName}</p>
            <p><strong>Created:</strong> ${user.created}</p>
            <p><strong>Banned:</strong> ${user.banned}</p>
            <p><strong>Badges:</strong> ${user.badges.join(", ") || "None"}</p>
            <p><strong>Groups:</strong> ${user.groups.join(", ") || "None"}</p>
          </div>
          <div class="modal-footer">
            <button type="button" id="closeModalFooterBtn" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = document.getElementById("customModal");
    modal.querySelector("#closeModalBtn").addEventListener("click", () => modal.remove());
    modal.querySelector("#closeModalFooterBtn").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

// main form handler
async function handleBGCFormSubmit() {
    const username = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!username || !reason) return;

    try {
        const data = await getRobloxUserData(username);
        displayResultModal(data, reason, platform);
    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
        alert("Failed to fetch user data.");
    }
}
