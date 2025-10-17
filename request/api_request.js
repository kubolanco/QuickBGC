document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bgcForm");
    form.addEventListener("submit", event => {
        event.preventDefault();
        handleBGCFormSubmit();
    });
});

const WORKER_URL = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform = document.getElementById("platform").value;
    const reason = document.getElementById("reason").value.trim();

    if (!usernameOrId || !reason) return;

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxUserData(usernameOrId);
            if (userInfo) displayResultModal(userInfo, reason, platform);
        }
    } catch (err) {
        console.error("[ERROR] handleBGCFormSubmit:", err);
    }
}

async function fetchFromWorker(url) {
    const response = await fetch(`${WORKER_URL}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Failed fetch: ${url}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return await response.json();
    return await response.text();
}

async function getRobloxUserData(input) {
    let userId = input;

    // Resolve username → ID
    if (isNaN(input)) {
        const searchData = await fetchFromWorker(
            `https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`
        );
        if (!searchData.data || searchData.data.length === 0) return null;
        userId = searchData.data[0].id;
    }

    // Basic user info
    const userData = await fetchFromWorker(`https://users.roblox.com/v1/users/${userId}`);

    // Avatar
    const avatarData = await fetchFromWorker(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );

    // Groups
    let groupsList = [];
    try {
        const groups = await fetchFromWorker(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );
        groupsList = groups.data
            ? groups.data.map(g => `${g.group.name} (${g.role.name})`)
            : [];
    } catch {}

    // Badges
    let badgesCount = 0;
    try {
        const badges = await fetchFromWorker(
            `https://badges.roblox.com/v1/users/${userId}/badges?limit=100`
        );
        badgesCount = badges.data ? badges.data.length : 0;
    } catch {}

    // Favorite games count
    let favoritesCount = 0;
    try {
        const favorites = await fetchFromWorker(
            `https://games.roblox.com/v2/users/${userId}/favorite/games`
        );
        favoritesCount = favorites.data ? favorites.data.length : 0;
    } catch {}

    return {
        id: userData.id,
        username: userData.name,
        displayName: userData.displayName,
        description: userData.description || "None",
        created: userData.created,
        banned: userData.isBanned,
        avatar: avatarData?.data?.[0]?.imageUrl || null,
        badgesCount,
        favoritesCount,
        groupsList
    };
}

function displayResultModal(userInfo, reason, platform) {
    // Create modal dynamically if it doesn’t exist
    let modalHTML = `
    <div class="modal fade" id="resultModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow">
          <div class="modal-header bg-dark text-white">
            <h5 class="modal-title">${platform} Background Check</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p class="text-danger text-center fw-bold mb-3">⚠ WARNING: This tool can be inaccurate.</p>
            <div class="text-center mb-3">
              <img src="${userInfo.avatar}" alt="Avatar" class="rounded img-fluid" style="max-width:150px;">
            </div>
            <ul class="list-group">
              <li class="list-group-item"><strong>Reason:</strong> ${reason}</li>
              <li class="list-group-item"><strong>ID:</strong> ${userInfo.id}</li>
              <li class="list-group-item"><strong>Username:</strong> ${userInfo.username}</li>
              <li class="list-group-item"><strong>Display Name:</strong> ${userInfo.displayName}</li>
              <li class="list-group-item"><strong>Description:</strong> ${userInfo.description}</li>
              <li class="list-group-item"><strong>Created:</strong> ${new Date(userInfo.created).toLocaleString()}</li>
              <li class="list-group-item"><strong>Banned:</strong> ${userInfo.banned}</li>
              <li class="list-group-item"><strong>Badges:</strong> ${userInfo.badgesCount}</li>
              <li class="list-group-item"><strong>Favorite Games:</strong> ${userInfo.favoritesCount}</li>
              <li class="list-group-item"><strong>Groups:</strong>
                <ul class="mt-2">
                  ${userInfo.groupsList.length
                    ? userInfo.groupsList.map(g => `<li>${g}</li>`).join("")
                    : "<li>No groups found</li>"
                  }
                </ul>
              </li>
            </ul>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>`;

    // Remove existing modal if any
    const existing = document.getElementById("resultModal");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = new bootstrap.Modal(document.getElementById("resultModal"));
    modal.show();
}
