document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

async function fetchFromWorker(url) {
    const res = await fetch(`${WORKER_URL}${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Failed fetch: ${url}`);
    return await res.json();
}

async function getRobloxUserData(input) {
    let userId = input;

    if (isNaN(input)) {
        const search = await fetchFromWorker(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=20`);
        if (!search.data || search.data.length === 0) return null;
        userId = search.data[0].id;
    }

    const [userData, avatarData, badgeData, groupData] = await Promise.all([
        fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`),
        fetchFromWorker(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=100x100&format=Png`).catch(() => null),
        fetchFromWorker(`https://badges.roblox.com/v1/users/${userId}/badges?limit=50`).catch(() => ({ data: [] })),
        fetchFromWorker(`https://groups.roblox.com/v2/users/${userId}/groups/roles`).catch(() => ({ data: [] }))
    ]);

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        created: new Date(userData.created).toLocaleString(),
        banned: userData.isBanned,
        avatar: avatarData?.data?.[0]?.imageUrl || null,
        badges: badgeData.data?.map(b => b.name) || [],
        groups: groupData.data?.map(g => g.group.name) || []
    };
}

async function handleBGCFormSubmit() {
    const usernameInput = document.getElementById("username");
    const reasonInput = document.getElementById("reason");
    const platform = document.getElementById("platform").value;
    const username = usernameInput.value.trim();
    const reason = reasonInput.value.trim();

    if (!username || !reason) return;

    // Remove old modals
    document.querySelectorAll("#customModal, #errorModal").forEach(m => m.remove());

    try {
        const data = await getRobloxUserData(username);
        if (!data) return displayErrorModal(`User "${username}" not found.`);
        displayResultModal(data, reason, platform);

        usernameInput.value = "";
        reasonInput.value = "";

    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
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
          <div class="modal-body text-center">
            ${data.avatar ? `<img src="${data.avatar}" class="rounded mb-3" style="width:100px;height:100px;">` : ""}
            <h4 class="mb-2">${platform} Background Check Report</h4>
            <p><strong>Username:</strong> ${data.username}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>ID:</strong> ${data.id}</p>
            <p><strong>Display Name:</strong> ${data.displayName}</p>
            <p><strong>Created:</strong> ${data.created}</p>
            <p><strong>Banned:</strong> ${data.banned}</p>
            <p><strong>Badges:</strong> ${data.badges.length ? data.badges.join(", ") : "None"}</p>
            <p><strong>Groups:</strong>${data.groups.length ? "<br>" + data.groups.join("<br>") : " None"}</p>
            <button class="btn btn-outline-primary mt-2" id="copyJsonBtn">Copy JSON</button>
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

    document.getElementById("copyJsonBtn").addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert("User data copied to clipboard!");
    });
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
          <div class="modal-body text-center">
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
